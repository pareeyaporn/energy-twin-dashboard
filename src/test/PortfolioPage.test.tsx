import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useTwin } from "@/store/useTwin";
import { PortfolioPage } from "@/portfolio/PortfolioPage";
import { PortfolioBreadcrumb } from "@/twin/parts/PortfolioBreadcrumb";
import { selectPortfolioSummary } from "@/store/hotelDerived";
import { spreadOffsets } from "@/portfolio/spread";

describe("marker spreading", () => {
  it("leaves distant markers alone and fans out close or identical ones so each is selectable", () => {
    const far = spreadOffsets([{ id: "a", x: 0, y: 0 }, { id: "b", x: 200, y: 0 }]);
    expect(far).toEqual({ a: { dx: 0, dy: 0 }, b: { dx: 0, dy: 0 } });
    const pts = [{ id: "a", x: 100, y: 100 }, { id: "b", x: 100, y: 100 }, { id: "c", x: 110, y: 104 }];
    const o = spreadOffsets(pts, 34);
    const placed = pts.map((p) => ({ x: p.x + o[p.id]!.dx, y: p.y + o[p.id]!.dy }));
    for (let i = 0; i < placed.length; i++)
      for (let j = i + 1; j < placed.length; j++) expect(Math.hypot(placed[i]!.x - placed[j]!.x, placed[i]!.y - placed[j]!.y)).toBeGreaterThanOrEqual(33.9);
    expect(spreadOffsets(pts, 34)).toEqual(o); // deterministic
  });
});

const navigate = vi.fn();
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
  useNavigate: () => navigate,
}));

describe("Portfolio page", () => {
  beforeEach(() => {
    useTwin.getState().resetHotel();
    navigate.mockClear();
  });
  afterEach(() => cleanup());

  it("renders the chain, its totals, the drawn map (no WebGL in tests) and the synthetic label", () => {
    render(<PortfolioPage />);
    expect(screen.getByRole("heading", { name: /Your Hotel Portfolio/ })).toBeTruthy();
    expect(screen.getByTestId("portfolio-page").textContent).toContain("Lakefront Hotel Group");
    expect(screen.getByTestId("portfolio-synthetic").textContent).toMatch(/Synthetic/);
    expect(screen.getByTestId("map-fallback")).toBeTruthy();
    expect(screen.getAllByTestId("portfolio-row")).toHaveLength(5);
    expect(screen.getByLabelText("Portfolio totals").textContent).toContain("1,172");
  });

  it("sorts the comparison table", () => {
    render(<PortfolioPage />);
    // The table keeps the decision columns (cost, intensity, savings, investment, payback, priority); sort by energy cost.
    fireEvent.click(screen.getByTestId("sort-cost"));
    const first = () => within(screen.getAllByTestId("portfolio-row")[0]!).getAllByRole("cell")[0]!.textContent;
    const firstTwice = first();
    fireEvent.click(screen.getByTestId("sort-cost"));
    expect([firstTwice, first()].sort()).toEqual(["Lakefront Convention Hotel", "Wells Street Hotel"]);
    expect(screen.queryByTestId("sort-rooms")).toBeNull();
  });

  it("hovering a marker shows a tooltip, clicking it opens its card, and Explore hotel opens that hotel", () => {
    render(<PortfolioPage />);
    fireEvent.mouseEnter(screen.getByTestId("marker-ohare-gateway"));
    expect(screen.getByTestId("marker-tooltip").textContent).toContain("O'Hare Gateway Hotel");
    expect(screen.queryByTestId("property-card")).toBeNull();
    fireEvent.click(screen.getByTestId("marker-ohare-gateway"));
    const card = screen.getByTestId("property-card");
    expect(card.textContent).toContain("O'Hare Gateway Hotel");
    expect(card.textContent).toContain("Demonstration property");
    fireEvent.click(screen.getByTestId("explore-ohare-gateway"));
    expect(useTwin.getState().activePropertyId).toBe("ohare-gateway");
    expect(useTwin.getState().hotel.profile.name).toBe("O'Hare Gateway Hotel");
    expect(navigate).toHaveBeenCalledWith({ to: "/hotel" });
  });

  it("the hotel list ranks by the map's metric; hover highlights the marker, click selects and the card follows", () => {
    render(<PortfolioPage />);
    const s = useTwin.getState();
    const rows = selectPortfolioSummary(s).properties;
    const order = () => screen.getAllByTestId("property-list-item").map((b) => b.getAttribute("data-id"));
    // Default metric: energy intensity, highest first.
    expect(order()).toEqual([...rows].sort((a, b) => b.siteEui - a.siteEui || a.name.localeCompare(b.name)).map((r) => r.id));
    fireEvent.click(screen.getByTestId("map-metric-cost"));
    expect(order()).toEqual([...rows].sort((a, b) => b.annual.cost - a.annual.cost || a.name.localeCompare(b.name)).map((r) => r.id));
    const [firstId] = order();
    expect(screen.getByTestId(`marker-${firstId}`).getAttribute("aria-label")).toMatch(/rank 1/);
    const item = screen.getAllByTestId("property-list-item")[1]!;
    const id = item.getAttribute("data-id")!;
    fireEvent.mouseEnter(item);
    expect(screen.getByTestId("marker-tooltip")).toBeTruthy();
    fireEvent.mouseLeave(item);
    fireEvent.click(item);
    expect(screen.getByTestId(`marker-${id}`).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByTestId("property-card").textContent).toContain(rows.find((r) => r.id === id)!.name);
    expect(screen.getByTestId("property-card").textContent).toMatch(/#2 in the portfolio/);
    // Escape closes the card; the list collapses.
    fireEvent.keyDown(item, { key: "Escape" });
    expect(screen.queryByTestId("property-card")).toBeNull();
    fireEvent.click(screen.getByTestId("property-list-toggle"));
    expect(screen.queryAllByTestId("property-list-item")).toHaveLength(0);
    expect(screen.getByTestId("map-legend").textContent).toMatch(/Energy cost/);
  });

  it("runs the portfolio optimizer and lists a package per hotel", async () => {
    vi.useFakeTimers();
    render(<PortfolioPage />);
    fireEvent.click(screen.getByTestId("run-portfolio"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1300);
    });
    expect(screen.getByTestId("portfolio-plan")).toBeTruthy();
    expect(screen.getAllByTestId("allocation-row")).toHaveLength(5);
    vi.useRealTimers();
  });

  it("shows the breadcrumb in the twin only for a portfolio hotel", () => {
    const { container, rerender } = render(<PortfolioBreadcrumb />);
    expect(container.textContent).toBe("");
    act(() => useTwin.getState().openProperty("wells-street"));
    rerender(<PortfolioBreadcrumb />);
    expect(screen.getByTestId("portfolio-breadcrumb").textContent).toContain("Wells Street Hotel");
  });
});

describe("Portfolio page, P1", () => {
  beforeEach(() => {
    useTwin.getState().resetHotel();
    navigate.mockClear();
  });
  afterEach(() => cleanup());

  it("Customize AI plan fills My portfolio, and Compare shows both", async () => {
    vi.useFakeTimers();
    render(<PortfolioPage />);
    fireEvent.click(screen.getByTestId("run-portfolio"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1300);
    });
    vi.useRealTimers();
    act(() => {
      useTwin.getState().customizeAiPortfolio();
    });
    const mine = await import("@/store/hotelDerived").then((m) => m.selectPortfolioCustomEvaluation(useTwin.getState()));
    expect(mine.totals.annualSavings).toBeCloseTo(useTwin.getState().portfolioPlan!.totals.annualSavings, 4);
  });

  it("runs a portfolio stress test for a selection of hotels", () => {
    render(<PortfolioPage />);
    // The portfolio stress tests sit in "Deeper analysis", closed by default.
    expect(screen.queryByTestId("pstress-heat_wave")).toBeNull();
    fireEvent.click(screen.getByTestId("portfolio-deeper-toggle"));
    fireEvent.click(screen.getByTestId("pstress-heat_wave"));
    expect(screen.getByTestId("portfolio-stress-report")).toBeTruthy();
    expect(screen.getAllByTestId("pstress-row")).toHaveLength(5);
    fireEvent.click(screen.getByTestId("pscope-wells-street"));
    expect(screen.getAllByText("(not in the test)")).toHaveLength(1);
  });
});
