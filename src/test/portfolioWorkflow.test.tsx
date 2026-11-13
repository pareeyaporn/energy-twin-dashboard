import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { evaluatePackage, hotelOrganizations, prepareProperty, resolveProfile } from "@/engine/hotel";
import { DEFAULT_PORTFOLIO_VIEW, useTwin } from "@/store/useTwin";
import { selectPortfolioItems, selectPortfolioSummary } from "@/store/hotelDerived";
import { userProperty } from "@/store/userHotels";
import { PortfolioPage } from "@/portfolio/PortfolioPage";
import { PortfolioBreadcrumb } from "@/twin/parts/PortfolioBreadcrumb";
import { HotelInPortfolio } from "@/portfolio/HotelInPortfolio";
import { PortfolioHome } from "@/app/PortfolioHome";
import { priorityRows, startHere } from "@/portfolio/priority";
import { cityGroups } from "@/portfolio/cities";
import { resetLanding, LAST_VIEW_KEY } from "@/app/landing";

const navigate = vi.fn((_: unknown) => Promise.resolve());
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, onClick, ...rest }: { children: React.ReactNode; onClick?: () => void; "data-testid"?: string }) => (
    <a data-testid={rest["data-testid"]} onClick={onClick}>{children}</a>
  ),
  useNavigate: () => navigate,
  useRouterState: ({ select }: { select: (s: { location: { pathname: string } }) => string }) => select({ location: { pathname: "/" } }),
}));

const get = () => useTwin.getState();

beforeEach(() => {
  window.localStorage.clear();
  get().resetDemo();
  navigate.mockClear();
  resetLanding();
});
afterEach(() => cleanup());

describe("multi-city portfolio", () => {
  it("each Meridian hotel resolves to its own city's weather, prices and grid", () => {
    const org = hotelOrganizations.find((o) => o.id === "meridian-hotels")!;
    const got = org.properties.map((p) => {
      const r = resolveProfile(p.input).profile;
      return [p.id, r.climateId, r.state, r.gridSubregion];
    });
    expect(got).toEqual([
      ["midtown-tower", "new_york", "NY", "NYCW"],
      ["brickell-bay", "miami", "FL", "FRCC"],
      ["south-beach-inn", "miami", "FL", "FRCC"],
      ["lodo-union-station", "denver", "CO", "RMPA"],
    ]);
    act(() => get().setOrganization("meridian-hotels"));
    const s = selectPortfolioSummary(get());
    expect(s.properties.map((r) => r.city)).toEqual(["New York", "Miami", "Miami", "Denver"]);
    expect(cityGroups(s.properties).map((g) => [g.city, g.hotels])).toEqual([["New York", 1], ["Miami", 2], ["Denver", 1]]);
    // City totals are sums of the hotels' engine figures.
    const miami = cityGroups(s.properties).find((g) => g.city === "Miami")!;
    expect(miami.cost).toBeCloseTo(s.properties.filter((r) => r.city === "Miami").reduce((x, r) => x + r.annual.cost, 0), 6);
    // No Illinois incentives outside Illinois.
    for (const r of s.properties) expect(r.potential?.incentives ?? 0).toBe(0);
  });

  it("the Chicago demo chain is unchanged by the new organization", () => {
    const s = selectPortfolioSummary(get());
    expect(s.properties).toHaveLength(5);
    expect(s.properties.every((r) => r.city === "Chicago")).toBe(true);
    expect(Math.round(s.totals.cost)).toBe(1_561_819);
  });

  it("the city filter narrows every view; the drawn map becomes one panel per city", () => {
    act(() => get().setOrganization("meridian-hotels"));
    render(<PortfolioPage />);
    expect(screen.getByTestId("map-fallback-cities")).toBeTruthy();
    expect(screen.getAllByTestId(/^city-panel-/)).toHaveLength(3);
    expect(screen.getByTestId("map-city-chips").textContent).toContain("Miami");
    fireEvent.change(screen.getByTestId("filter-city"), { target: { value: "Miami" } });
    expect(selectPortfolioItems(get())).toHaveLength(2);
    expect(screen.getAllByTestId("portfolio-row")).toHaveLength(2);
  });

  it("a hotel added in Miami uses Miami's data and says what is still Chicago-calibrated", () => {
    const p = userProperty("my-hotel-1", { rooms: 120, name: "Bayfront" }, "mia-brickell", 0);
    expect(p.input.city).toBe("Miami");
    expect(resolveProfile(p.input).profile.climateId).toBe("miami");
    expect(p.note).toMatch(/No Florida utility incentives/);
    expect(p.region).toBe("Southeast");
  });
});

describe("investment priority, explained", () => {
  it("the explanation's scores and per-dollar returns are the engine's", () => {
    const rows = selectPortfolioSummary(get()).properties;
    const list = priorityRows(rows);
    const best = Math.max(...list.map((r) => r.returnPerDollar ?? 0));
    for (const r of list) {
      const engine = rows.find((x) => x.id === r.id)!;
      expect(r.score).toBe(engine.priorityScore);
      expect(Math.round(((r.returnPerDollar ?? 0) / best) * 100)).toBe(engine.priorityScore);
    }
    const s = startHere(rows)!;
    expect(s.top.priorityScore).toBe(100);
    expect(s.reason).toMatch(/per dollar invested/);
  });

  it("Top investment opportunity, Why this hotel? and the full ranking on the page", () => {
    render(<PortfolioPage />);
    const top = startHere(selectPortfolioSummary(get()).properties)!.top;
    expect(screen.getByTestId("start-here").textContent).toContain(top.name);
    // "Why this hotel?" shows the reason first; the full ranking opens from there.
    fireEvent.click(screen.getByTestId("priority-why"));
    expect(screen.getByTestId("start-here-reason").textContent).toMatch(/per dollar invested/);
    fireEvent.click(screen.getByTestId("priority-why-all"));
    expect(screen.getByTestId("priority-explainer").textContent).toMatch(/Energy spending, floor area and intensity are not inputs/);
    expect(screen.getAllByTestId("priority-row")).toHaveLength(5);
  });
});

describe("portfolio ↔ hotel round trip", () => {
  it("keeps the organization, filters, map metric, sort and selected hotel; the breadcrumb goes back", () => {
    act(() => {
      get().setPortfolioFilter({ region: "Downtown" });
      get().setPortfolioView({ metric: "cost", tableSort: { id: "cost", dir: -1 } });
    });
    render(<PortfolioPage />);
    fireEvent.click(screen.getByTestId("table-open-riverwalk-grand"));
    expect(navigate).toHaveBeenCalledWith({ to: "/hotel" });
    expect(get().activePropertyId).toBe("riverwalk-grand");
    cleanup();
    // In the hotel: the breadcrumb.
    render(<PortfolioBreadcrumb />);
    const crumb = screen.getByTestId("portfolio-breadcrumb").textContent!;
    expect(crumb).toContain("Portfolio");
    expect(crumb).toContain("Lakefront Hotel Group");
    expect(crumb).toContain("Riverwalk Grand");
    fireEvent.click(screen.getByTestId("breadcrumb-portfolio"));
    cleanup();
    // Back on the portfolio: same filters, metric, sort and the hotel highlighted with its card open.
    expect(get().portfolioFilter.region).toBe("Downtown");
    render(<PortfolioPage />);
    expect(screen.getByTestId("map-metric-cost").getAttribute("aria-checked")).toBe("true");
    expect(screen.getByTestId("property-card").textContent).toContain("Riverwalk Grand");
    const rows = screen.getAllByTestId("portfolio-row");
    const costliest = [...selectPortfolioSummary(get()).properties].sort((x, y) => y.annual.cost - x.annual.cost)[0]!;
    expect(rows[0]!.textContent).toContain(costliest.name); // sorted by cost, highest first
    expect(rows.find((r) => r.dataset["last"] === "true")!.textContent).toContain("Riverwalk Grand");
  });

  it("Reset demo returns the portfolio view to its start", () => {
    act(() => get().setPortfolioView({ metric: "potential", selectedId: "lakeshore-inn" }));
    act(() => get().resetDemo());
    expect(get().portfolioView).toEqual(DEFAULT_PORTFOLIO_VIEW);
  });
});

describe("hotel and portfolio figures reconcile", () => {
  it("a hotel's own baseline equals its portfolio row, and its portfolio-plan package equals the single-hotel evaluation", async () => {
    const row = selectPortfolioSummary(get()).properties.find((r) => r.id === "wells-street")!;
    act(() => get().openProperty("wells-street"));
    expect(get().baseline.annual.cost).toBeCloseTo(row.annual.cost, 6);
    vi.useFakeTimers();
    const run = get().runPortfolioOptimizer();
    await vi.advanceTimersByTimeAsync(1300);
    await run;
    vi.useRealTimers();
    const plan = get().portfolioPlan!;
    const alloc = plan.allocations.find((a) => a.propertyId === "wells-street")!;
    expect(alloc.evaluation).not.toBeNull();
    const item = selectPortfolioItems(get()).find((x) => x.property.id === "wells-street")!;
    const own = evaluatePackage(prepareProperty(item.property, item.input).ctx, alloc.evaluation!.upgradeIds, { assumptions: { discountRate: get().hotelDiscountRate } });
    expect(own.financials.annualSavings.mid).toBeCloseTo(alloc.evaluation!.financials.annualSavings.mid, 6);
    expect(own.financials.netInvestment.mid).toBeCloseTo(alloc.evaluation!.financials.netInvestment.mid, 6);
    // The portfolio total is the sum of the hotels' allocations.
    const sum = plan.allocations.reduce((s, a) => s + (a.evaluation?.financials.annualSavings.mid ?? 0), 0);
    expect(plan.totals.annualSavings).toBeCloseTo(sum, 6);
    // The hotel's Invest tab shows the same allocation.
    render(<HotelInPortfolio />);
    const text = screen.getByTestId("hotel-in-portfolio-plan").textContent!;
    expect(text).toContain(`$${Math.round(alloc.evaluation!.financials.annualSavings.mid).toLocaleString("en-US")}`);
  });
});

describe("landing", () => {
  it("new visitors stay on the portfolio and it is remembered", () => {
    render(<PortfolioHome />);
    expect(navigate).not.toHaveBeenCalled();
    expect(window.localStorage.getItem(LAST_VIEW_KEY)).toBe("portfolio");
  });

  it("a returning user who was last in the hotel goes back there on the first load only", () => {
    window.localStorage.setItem(LAST_VIEW_KEY, "hotel");
    render(<PortfolioHome />);
    expect(navigate).toHaveBeenCalledWith({ to: "/hotel", replace: true });
    cleanup();
    navigate.mockClear();
    render(<PortfolioHome />);
    expect(navigate).not.toHaveBeenCalled();
  });

  it("an organization with a single hotel opens that hotel", () => {
    const org = get().portfolio;
    act(() => useTwin.setState({ portfolio: { ...org, properties: [org.properties[1]!] } }));
    render(<PortfolioHome />);
    expect(get().activePropertyId).toBe(org.properties[1]!.id);
    expect(navigate).toHaveBeenCalledWith({ to: "/hotel", replace: true });
  });
});
