import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useTwin } from "@/store/useTwin";
import { selectEnergyInsights, selectPortfolioSummary } from "@/store/hotelDerived";
import { TOUR_STEPS, bodyOf, tourSteps } from "@/tour/steps";
import { REPORT_SECTIONS, advisorExample, finishSummary, insightFor, projectionSeries, reportOutline, topPriorityId } from "@/tour/insights";
import { overlaps, placeCard } from "@/tour/layout";
import { TOUR_STORAGE_KEY, readTourOutcome, useTour } from "@/tour/useTour";
import { TourButton, resetTourAutoStart } from "@/tour/TourButton";
import { TOUR_TIMING } from "@/tour/TourOverlay";

TOUR_TIMING.waitMs = 150;
TOUR_TIMING.navMs = 200;

const navigate = vi.fn();
let pathname = "/hotel";
vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => navigate,
  useRouterState: ({ select }: { select: (s: { location: { pathname: string } }) => string }) => select({ location: { pathname } }),
}));

describe("tour card placement", () => {
  it("never covers the highlighted area, on desktop and phone sizes", () => {
    const screens = [
      [1440, 900],
      [1024, 768],
      [390, 844],
      [360, 640],
    ] as const;
    for (const [vw, vh] of screens)
      for (let top = 0; top < vh; top += vh / 7)
        for (const h of [40, 160, vh * 0.5, vh * 0.9])
          for (const [left, w] of [[8, vw * 0.3], [vw * 0.2, vw * 0.6], [8, vw - 16]] as const) {
            const spot = { top, left, width: w, height: Math.min(h, vh - top - 6) };
            if (spot.height <= 0) continue;
            const p = placeCard(spot, { width: 360, height: 200 }, vw, vh);
            const card = { top: p.card.top, left: p.card.left, width: Math.min(360, vw - 24), height: 200 };
            if (p.spot) expect(overlaps(card, p.spot)).toBe(false);
            expect(card.left).toBeGreaterThanOrEqual(0);
            expect(card.left + card.width).toBeLessThanOrEqual(vw);
            expect(card.top).toBeGreaterThanOrEqual(0);
            expect(card.top + card.height).toBeLessThanOrEqual(vh + 0.5);
          }
  });
  it("centers the card when a step has no target", () => {
    const p = placeCard(null, { width: 360, height: 200 }, 1440, 900);
    expect(p.side).toBe("center");
    expect(p.card.left).toBe(540);
  });
});

describe("tour steps", () => {
  it("the full tour has 18 short steps and the quick tour 8: the portfolio first, then one hotel, ending with a clear action", () => {
    expect(TOUR_STEPS).toHaveLength(18);
    const quick = tourSteps("quick");
    expect(quick.map((x) => x.id)).toEqual(["welcome", "ranking", "portfolio", "explore", "drivers", "optimizer", "advisor", "finish"]);
    expect(tourSteps("full")).toBe(TOUR_STEPS);
    expect(TOUR_STEPS.slice(0, 5).every((x) => x.route === "/")).toBe(true);
    expect(TOUR_STEPS.slice(5).every((x) => x.route === "/hotel" && x.focus)).toBe(true);
    expect(TOUR_STEPS.map((x) => x.id)).toEqual(expect.arrayContaining(["portfolio-optimizer", "explore", "equipment", "insights", "flow", "report", "advisor", "projections", "optimizer", "ranking"]));
    expect(TOUR_STEPS[0]!.id).toBe("welcome");
    expect(TOUR_STEPS.at(-1)!.title).toBe("You're ready to explore!");
    for (const s of TOUR_STEPS) {
      expect(s.title.length).toBeLessThan(45);
      expect(bodyOf(s, useTwin.getState()).split(/(?<=\.)\s/).length).toBeLessThanOrEqual(3);
    }
  });
  it("live figures come from the engine for the open hotel (and change with it)", () => {
    useTwin.getState().resetHotel();
    const s = useTwin.getState();
    const sum = selectPortfolioSummary(s);
    expect(insightFor("welcome", s)!.value).toBeCloseTo(sum.totals.cost, 6);
    expect(insightFor("portfolio-kpis", s)!.value).toBeCloseTo(sum.totals.savingsPotential, 6);
    const top = [...sum.properties].sort((x, y) => y.priorityScore - x.priorityScore)[0]!;
    expect(insightFor("ranking", s)!.label).toContain(top.name);
    expect(insightFor("portfolio", s)!.value).toBeCloseTo(Math.max(...sum.properties.map((x) => x.siteEui)), 6);
    expect(insightFor("insights", s)!.value).toBeCloseTo(selectEnergyInsights(s)[0]!.metric.value, 6);
    const opt = insightFor("optimizer", s)!;
    expect(opt.value).toBeGreaterThan(0);
    expect(insightFor("stress", s)!.value).toBeGreaterThan(0);
    // The 10-year chart: each recommended package, year 0 = minus the net investment, year 10 = the engine's 10-year net benefit.
    const series = projectionSeries(s);
    expect(series.length).toBeGreaterThan(0);
    for (const x of series) {
      expect(x.cumulative).toHaveLength(11);
      expect(x.cumulative[0]).toBeCloseTo(-x.netInvestment, 6);
      expect(x.cumulative[10]).toBeCloseTo(x.net10, 0);
    }
    expect(insightFor("projections", s)!.value).toBeCloseTo(Math.max(...series.map((x) => x.net10)), 6);
    expect(finishSummary(s)[0]!.value).toBeCloseTo(s.baseline.annual.cost, 6);
    useTwin.getState().selectHotelPreset("demo-chicago-300");
    expect(insightFor("insights", useTwin.getState())!.note).toMatch(/Riverwalk|Grand|300|findings/);
    // Computing them changes nothing in the app.
    expect(useTwin.getState().hotelPlan).toBeNull();
    useTwin.getState().resetHotel();
  });
});

describe("tour views", () => {
  beforeEach(() => {
    useTwin.getState().resetHotel();
    useTour.setState({ active: false, index: 0, direction: 1, origin: null, restore: null });
  });
  afterEach(() => cleanup());
  it("plays the time-lapse during its step, then restores the user's view", () => {
    pathname = "/hotel";
    useTwin.getState().setTwinLayer("rooms");
    render(<TourButton autoStart={false} />);
    fireEvent.click(screen.getByTestId("take-tour"));
    act(() => useTour.setState({ mode: "full", index: TOUR_STEPS.findIndex((s) => s.id === "seasons") }));
    expect(useTwin.getState().timeMode).toBe("seasons");
    expect(useTwin.getState().playing).toBe(true);
    act(() => useTour.setState({ mode: "full", index: TOUR_STEPS.findIndex((s) => s.id === "drivers") }));
    expect(useTwin.getState().playing).toBe(false);
    act(() => useTour.getState().end("skipped"));
    expect(useTwin.getState().twinLayer).toBe("rooms");
    expect(useTwin.getState().timeMode).toBe("day");
  });
  it("the finish card's main button asks for Invest and the optimizer", () => {
    render(<TourButton autoStart={false} />);
    fireEvent.click(screen.getByTestId("take-tour"));
    act(() => useTour.getState().end("completed", "optimize"));
    expect(useTour.getState().restore).toEqual({ path: "/hotel", tab: "Invest", then: "optimize" });
  });
});

describe("one story, one hotel (the top priority), and nothing changed afterwards", () => {
  beforeEach(() => {
    window.localStorage.clear();
    useTwin.getState().resetDemo();
    useTour.setState({ active: false, index: 0, direction: 1, origin: null, restore: null });
  });

  it("the hotel steps open the top-priority hotel; the tour puts the user's own state back at the end", () => {
    const s0 = useTwin.getState();
    const top = topPriorityId(s0)!;
    const sum = selectPortfolioSummary(s0);
    expect(top).toBe([...sum.properties].sort((a, b) => b.priorityScore - a.priorityScore)[0]!.id);
    const before = { input: s0.hotelInput, active: s0.activePropertyId, preset: s0.hotelPresetId, states: s0.propertyStates, baseline: s0.baseline };
    useTour.getState().start({ path: "/", tab: null });
    useTour.getState().focusHotel(top);
    expect(useTwin.getState().activePropertyId).toBe(top);
    expect(insightFor("explore", useTwin.getState())!.label).toContain(useTwin.getState().hotel.profile.name);
    useTour.getState().end("completed");
    const s1 = useTwin.getState();
    expect({ input: s1.hotelInput, active: s1.activePropertyId, preset: s1.hotelPresetId, states: s1.propertyStates, baseline: s1.baseline }).toEqual(before);
    expect(s1.hotelInput).toBe(before.input);
  });

  it("Find my best investments keeps the hotel the tour showed (the user asked to act on it)", () => {
    const top = topPriorityId(useTwin.getState())!;
    useTour.getState().start({ path: "/", tab: null });
    useTour.getState().focusHotel(top);
    useTour.getState().end("completed", "optimize");
    expect(useTwin.getState().activePropertyId).toBe(top);
  });

  it("the portfolio optimizer, report and advisor cards come from the engine", () => {
    const s = useTwin.getState();
    const opt = insightFor("portfolio-optimizer", s)!;
    expect(opt.value).toBeGreaterThan(0);
    expect(opt.label).toMatch(/\$500,000/);
    const o = reportOutline(s)!;
    expect(o.sections).toEqual(REPORT_SECTIONS);
    expect(o.headline.length).toBeGreaterThan(10);
    const ex = advisorExample(s)!;
    expect(ex.answer).toMatch(/\$/);
    expect(ex.question).toMatch(/85%/);
    expect(ex.answer).toMatch(/occupancy at 85%/i);
    expect(useTwin.getState().hotelPlan).toBeNull(); // nothing was run or stored
  });
});

describe("tour flow", () => {
  beforeEach(() => {
    window.localStorage.clear();
    useTwin.getState().resetHotel();
    useTour.setState({ active: false, index: 0, direction: 1, origin: null, restore: null });
    resetTourAutoStart();
    navigate.mockClear();
    pathname = "/hotel";
  });
  afterEach(() => cleanup());

  it("starts on a first visit, once, and not again after it is finished", async () => {
    vi.useFakeTimers();
    // The main view has loaded.
    const kpi = document.createElement("div");
    kpi.dataset["testid"] = "kpi-cost";
    kpi.getBoundingClientRect = () => ({ top: 10, left: 10, right: 210, bottom: 110, width: 200, height: 100, x: 10, y: 10, toJSON: () => ({}) });
    document.body.appendChild(kpi);
    render(<TourButton autoStart />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(useTour.getState().active).toBe(true);
    act(() => useTour.getState().end("completed"));
    expect(readTourOutcome()).toBe("completed");
    cleanup();
    resetTourAutoStart();
    render(<TourButton autoStart />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(useTour.getState().active).toBe(false);
    kpi.remove();
    vi.useRealTimers();
  });

  it("Take a tour replays from the first step; Next, Back, Skip and Finish work, and hotel state is unchanged", async () => {
    window.localStorage.setItem(TOUR_STORAGE_KEY, "completed");
    pathname = "/"; // the tour starts on the portfolio homepage
    const snap = () => {
      const t = useTwin.getState();
      return JSON.stringify({ input: t.hotelInput, scenario: t.scenario, plans: t.customPlans, layer: t.twinLayer, time: [t.timeMode, t.timeMonth, t.timeHour, t.playing, t.playbackSpeed], plan: t.hotelPlan });
    };
    const before = snap();
    render(<TourButton autoStart={false} />);
    fireEvent.click(screen.getByTestId("take-tour"));
    expect(await screen.findByText("Welcome to Energy Twin")).toBeTruthy();
    expect(screen.getByTestId("tour-progress").textContent).toBe("1 of 8");
    expect(screen.getByTestId("tour-full").textContent).toMatch(/Full tour · 18 steps/);
    expect(screen.getByTestId("tour-next").textContent).toMatch(/Quick tour · 8 steps/);
    expect((await screen.findByTestId("tour-insight")).textContent).toMatch(/a year on energy across/);
    fireEvent.click(screen.getByTestId("tour-full"));
    expect(useTour.getState().mode).toBe("full");
    expect(useTour.getState().index).toBe(1);
    act(() => useTour.getState().back());
    expect(useTour.getState().index).toBe(0);
    // In the test DOM the highlighted parts do not exist, so the tour skips them instead of breaking; it reaches the end.
    act(() => useTour.getState().next());
    await vi.waitFor(() => expect(useTour.getState().index === TOUR_STEPS.length - 1 || !useTour.getState().active).toBe(true), { timeout: 15000, interval: 50 });
    if (useTour.getState().active) act(() => useTour.getState().next());
    expect(useTour.getState().active).toBe(false);
    expect(readTourOutcome()).toBe("completed");
    const after = snap();
    expect(after).toBe(before);
  }, 30000);

  it("Quick tour: the welcome's main button picks the 8-step story and counts it", async () => {
    pathname = "/";
    render(<TourButton autoStart={false} />);
    fireEvent.click(screen.getByTestId("take-tour"));
    fireEvent.click(await screen.findByTestId("tour-next"));
    expect(useTour.getState().mode).toBe("quick");
    expect(useTour.getState().index).toBe(1);
    await vi.waitFor(() => expect(screen.getByTestId("tour-progress").textContent).toMatch(/of 8$/));
  });

  it("Skip ends the tour, saves the choice and asks to return to the starting page", () => {
    render(<TourButton autoStart={false} />);
    fireEvent.click(screen.getByTestId("take-tour"));
    fireEvent.click(screen.getByText("Skip tour"));
    expect(useTour.getState().active).toBe(false);
    expect(readTourOutcome()).toBe("skipped");
    expect(useTour.getState().restore?.path ?? "/hotel").toBe("/hotel");
  });

  it("Escape skips the tour", () => {
    render(<TourButton autoStart={false} />);
    fireEvent.click(screen.getByTestId("take-tour"));
    fireEvent.keyDown(window, { key: "Escape" });
    expect(useTour.getState().active).toBe(false);
    expect(readTourOutcome()).toBe("skipped");
  });

  it("goes to the portfolio page for the portfolio steps", () => {
    render(<TourButton autoStart={false} />);
    fireEvent.click(screen.getByTestId("take-tour"));
    act(() => useTour.setState({ mode: "full", index: TOUR_STEPS.findIndex((s) => s.id === "portfolio") }));
    expect(navigate).toHaveBeenCalledWith({ to: "/" });
  });
});
