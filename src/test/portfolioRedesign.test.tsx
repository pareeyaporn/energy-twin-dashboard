import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useTwin } from "@/store/useTwin";
import { selectPortfolioSummary } from "@/store/hotelDerived";
import { PortfolioPage } from "@/portfolio/PortfolioPage";
import { compactNumber, compactUsd, pct, shareOf, tonnes } from "@/portfolio/format";
import { allocationView, HOTEL_COLORS } from "@/portfolio/allocation";
import { startHere } from "@/portfolio/priority";
import { OPTIMIZER_ANCHOR } from "@/portfolio/anchors";

const navigate = vi.fn();
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
  useNavigate: () => navigate,
}));

const get = () => useTwin.getState();

async function runOptimizer(budget: number) {
  vi.useFakeTimers();
  act(() => get().setPortfolioBudget(budget));
  const p = get().runPortfolioOptimizer();
  await act(async () => {
    await vi.advanceTimersByTimeAsync(1300);
  });
  await p;
  vi.useRealTimers();
  return get().portfolioPlan!;
}

describe("compact formatting", () => {
  it("formats dollars compactly", () => {
    expect(compactUsd(1_561_819)).toBe("$1.56M");
    expect(compactUsd(109_905)).toBe("$109.9K");
    expect(compactUsd(500_000)).toBe("$500K");
    expect(compactUsd(1_000_000)).toBe("$1M");
    expect(compactUsd(250_000)).toBe("$250K");
    expect(compactUsd(999_960)).toBe("$1M");
    expect(compactUsd(12_500_000)).toBe("$12.5M");
    expect(compactUsd(950)).toBe("$950");
    expect(compactUsd(-2_500)).toBe("-$2.5K");
    expect(compactUsd(0)).toBe("$0");
    expect(compactUsd(Number.NaN)).toBe("—");
  });
  it("formats quantities, tonnes and shares", () => {
    expect(compactNumber(9_400_000, "kWh/yr")).toBe("9.4M kWh/yr");
    expect(compactNumber(267_123, "therms/yr")).toBe("267K therms/yr");
    expect(compactNumber(1_172)).toBe("1,172");
    expect(tonnes(5_302_400)).toBe("5,302 t CO₂e");
    expect(pct(0.0704)).toBe("7.0%");
    expect(pct(0.254)).toBe("25%");
    expect(shareOf(1, 0)).toBeNull();
    expect(shareOf(25, 100)).toBe(0.25);
  });
});

describe("portfolio page redesign", () => {
  beforeEach(() => {
    get().resetHotel();
    navigate.mockClear();
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("shows the headline figures from the summary, with the savings share computed from the same totals", () => {
    render(<PortfolioPage />);
    const t = selectPortfolioSummary(get()).totals;
    expect(screen.getByTestId("kpi-cost").textContent).toContain(compactUsd(t.cost));
    expect(screen.getByTestId("kpi-savings").textContent).toContain(compactUsd(t.savingsPotential));
    expect(screen.getByTestId("kpi-carbon").textContent).toContain(tonnes(t.carbonKg));
    expect(screen.getByTestId("kpi-properties").textContent).toContain(`${t.properties} hotels`);
    const share = screen.getByTestId("kpi-savings-share");
    expect(Number(share.dataset["share"])).toBeCloseTo(t.savingsPotential / t.cost, 10);
    expect(share.textContent).toContain(pct(t.savingsPotential / t.cost));
    // Exact values in the title.
    expect(screen.getByTestId("kpi-cost").querySelector("dd")!.getAttribute("title")).toContain(`$${Math.round(t.cost).toLocaleString("en-US")}`);
  });

  it("filter chips clear one filter, Reset clears all, and the figures follow the store's filter", () => {
    render(<PortfolioPage />);
    const total = selectPortfolioSummary(get()).totals.properties;
    expect(screen.queryByTestId("filter-chips")).toBeNull();
    // The menu holds brand, region and ownership.
    fireEvent.click(screen.getByTestId("filter-menu"));
    const region = screen.getByTestId("filter-region") as HTMLSelectElement;
    const value = [...region.options].map((o) => o.value).find((v) => v)!;
    fireEvent.change(region, { target: { value } });
    expect(get().portfolioFilter.region).toBe(value);
    const shown = selectPortfolioSummary(get()).totals.properties;
    expect(shown).toBeLessThan(total);
    expect(screen.getByTestId("filter-count").textContent).toBe(`Showing ${shown} of ${total} hotels`);
    expect(screen.getByTestId("kpi-properties").textContent).toContain(`${shown} hotel`);
    expect(screen.getByTestId("filter-menu").textContent).toContain("1");
    act(() => get().setPortfolioFilter({ ownership: selectPortfolioSummary(get()).properties[0]!.ownership ?? null }));
    expect(screen.getByTestId("filter-chip-region")).toBeTruthy();
    fireEvent.click(screen.getByTestId("filter-chip-remove-region"));
    expect(get().portfolioFilter.region).toBeNull();
    expect(screen.queryByTestId("filter-chip-region")).toBeNull();
    fireEvent.click(screen.getByTestId("filter-clear"));
    expect(get().portfolioFilter).toEqual({ brand: null, region: null, ownership: null, city: null });
    expect(screen.getAllByTestId("portfolio-row")).toHaveLength(total);
  });

  it("the top investment opportunity is the ranking's first hotel and follows the filters", () => {
    render(<PortfolioPage />);
    const top = startHere(selectPortfolioSummary(get()).properties)!.top;
    expect(screen.getByTestId("start-here-name").textContent).toBe(top.name);
    const metrics = screen.getByTestId("start-here-metrics").textContent!;
    expect(metrics).toContain(compactUsd(top.potential!.annualSavings));
    expect(metrics).toContain(compactUsd(top.potential!.netInvestment));
    expect(metrics).toContain(top.potential!.paybackYears!.toFixed(1));
    // Filter the top hotel out: the card moves to the next hotel in the filtered ranking.
    const other = selectPortfolioSummary(get()).properties.find((p) => p.region && p.region !== top.region);
    expect(other).toBeTruthy();
    act(() => get().setPortfolioFilter({ region: other!.region! }));
    const next = startHere(selectPortfolioSummary(get()).properties);
    if (next) expect(screen.getByTestId("start-here-name").textContent).toBe(next.top.name);
    expect(screen.queryByText(top.name, { selector: '[data-testid="start-here-name"]' })).toBeNull();
    fireEvent.click(screen.getByTestId("start-here-open"));
    expect(get().activePropertyId).toBe(next!.top.id);
    expect(navigate).toHaveBeenCalledWith({ to: "/hotel" });
  });

  it("the allocation bar's segments are the optimizer's allocations and remainder, for two budgets", async () => {
    for (const budget of [100_000, 500_000]) {
      const plan = await runOptimizer(budget);
      const view = allocationView(plan);
      const funded = plan.allocations.filter((a) => a.evaluation);
      expect(view.segments.map((s) => s.propertyId)).toEqual(funded.map((a) => a.propertyId));
      view.segments.forEach((s, i) => expect(s.amount).toBe(funded[i]!.evaluation!.financials.grossCost.mid));
      expect(view.remainder).toBe(Math.max(0, plan.totals.remainingBudget));
      expect(view.segments.reduce((t, s) => t + s.amount, 0) + view.remainder).toBeCloseTo(plan.budget, 6);
      expect(view.segments.reduce((t, s) => t + s.amount, 0)).toBeCloseTo(plan.totals.grossCost, 6);

      render(<PortfolioPage />);
      const bar = screen.getByTestId("allocation-bar");
      expect(Number(bar.dataset["budget"])).toBe(budget);
      for (const s of view.segments) {
        const el = screen.getByTestId(`allocation-segment-${s.propertyId}`);
        expect(Number(el.dataset["amount"])).toBe(s.amount);
      }
      if (view.remainder > 0) expect(Number(screen.getByTestId("allocation-remainder").dataset["amount"])).toBe(view.remainder);
      // Tooltip on hover, with the hotel and its figures; a click opens the hotel's plan.
      const first = view.segments[0]!;
      fireEvent.mouseEnter(screen.getByTestId(`allocation-segment-${first.propertyId}`));
      const tip = screen.getByTestId("allocation-tooltip").textContent!;
      expect(tip).toContain(first.name);
      expect(tip).toContain(`$${Math.round(first.annualSavings).toLocaleString("en-US")}`);
      if (budget === 500_000) expect(screen.getByTestId("portfolio-placeholder-costs")).toBeTruthy();
      expect(screen.getByTestId("portfolio-current-vs-optimized").textContent).toMatch(/Projected, if funded/);
      fireEvent.click(screen.getByTestId(`allocation-segment-${first.propertyId}`));
      expect(get().activePropertyId).toBe(first.propertyId);
      cleanup();
      act(() => get().resetHotel());
    }
  });

  it("colors follow the hotel, not its rank", async () => {
    const plan = await runOptimizer(500_000);
    const order = get().portfolio.properties.map((p) => p.id);
    for (const s of allocationView(plan, order).segments) expect(s.color).toBe(HOTEL_COLORS[order.indexOf(s.propertyId) % HOTEL_COLORS.length]);
  });

  it("shows the empty state before a run and the plan when one is already in the store", async () => {
    render(<PortfolioPage />);
    expect(screen.getByTestId("portfolio-plan-empty").textContent).toContain("Set your budget to discover the best investment opportunities across your hotels.");
    cleanup();
    await runOptimizer(250_000);
    render(<PortfolioPage />);
    expect(screen.getByTestId("portfolio-plan")).toBeTruthy();
    expect(screen.getByTestId("portfolio-plan-kpis").textContent).toContain(compactUsd(get().portfolioPlan!.totals.annualSavings));
  });

  it("the header button and the planner's run button have different labels", () => {
    render(<PortfolioPage />);
    expect(screen.getAllByRole("button", { name: /Optimize portfolio/ })).toHaveLength(1);
    expect(screen.getByTestId("run-portfolio").textContent).toMatch(/Find the best split/);
  });

  it("Optimize portfolio in the header scrolls to the optimizer, without animation when effects are reduced", () => {
    const spy = vi.fn();
    Element.prototype.scrollIntoView = spy;
    render(<PortfolioPage />);
    fireEvent.click(screen.getByTestId("optimize-portfolio"));
    expect(spy).toHaveBeenCalledTimes(1);
    expect((spy.mock.contexts[0] as Element).getAttribute("data-anchor")).toBe(OPTIMIZER_ANCHOR);
    expect(spy.mock.calls[0]![0]).toMatchObject({ behavior: "smooth" });
    act(() => useTwin.setState({ reduceEffects: true }));
    fireEvent.click(screen.getByTestId("optimize-portfolio"));
    expect(spy.mock.calls[1]![0]).toMatchObject({ behavior: "auto" });
    act(() => useTwin.setState({ reduceEffects: false }));
  });

  it("keeps every portfolio tour target and the advisor and add-hotel entry points", () => {
    render(<PortfolioPage />);
    for (const sel of ['[data-testid="portfolio-kpis"]', 'section[aria-label="City map"]', '[data-testid="portfolio-table"]', 'section[aria-label="Portfolio investments"]'])
      expect(document.querySelector(sel), sel).toBeTruthy();
    expect(document.querySelector(`[data-anchor="${OPTIMIZER_ANCHOR}"]`)).toBeTruthy();
    expect(screen.getByTestId("portfolio-synthetic").textContent).toMatch(/Synthetic/);
    expect(screen.getByTestId("portfolio-chat-open").textContent).toContain("Ask AI");
    expect(screen.getByTestId("add-my-hotel").textContent).toContain("Add hotel");
    expect(screen.getByTestId("portfolio-deeper").textContent).toContain("Advanced analytics");
  });
});
