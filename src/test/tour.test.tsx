import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useTwin } from "@/store/useTwin";
import { TOUR_STEPS, bodyOf } from "@/tour/steps";
import { finishSummary, insightFor, projectionSeries } from "@/tour/insights";
import { overlaps, placeCard } from "@/tour/layout";
import { TOUR_STORAGE_KEY, readTourOutcome, useTour } from "@/tour/useTour";
import { TourButton, resetTourAutoStart } from "@/tour/TourButton";
import { TOUR_TIMING } from "@/tour/TourOverlay";

TOUR_TIMING.waitMs = 150;
TOUR_TIMING.navMs = 200;

const navigate = vi.fn();
let pathname = "/";
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
  it("are 15 short steps for hotel operators, ending with a clear action", () => {
    expect(TOUR_STEPS).toHaveLength(15);
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
    expect(insightFor("welcome", s)!.value).toBeCloseTo(s.baseline.annual.cost, 6);
    expect(insightFor("flow", s)!.value).toBeCloseTo(s.baseline.annual.elecCost / s.baseline.annual.cost, 9);
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
    expect(insightFor("portfolio", s)!.note).toMatch(/Top priority/);
    expect(finishSummary(s)[0]!.value).toBeCloseTo(s.baseline.annual.cost, 6);
    useTwin.getState().selectHotelPreset("demo-chicago-300");
    expect(insightFor("welcome", useTwin.getState())!.value).not.toBeCloseTo(s.baseline.annual.cost, 0);
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
  it("plays the time-lapse and the energy flow during their steps, then restores the user's view", () => {
    pathname = "/";
    useTwin.getState().setTwinLayer("rooms");
    render(<TourButton autoStart={false} />);
    fireEvent.click(screen.getByTestId("take-tour"));
    act(() => useTour.setState({ index: TOUR_STEPS.findIndex((s) => s.id === "seasons") }));
    expect(useTwin.getState().timeMode).toBe("seasons");
    expect(useTwin.getState().playing).toBe(true);
    act(() => useTour.setState({ index: TOUR_STEPS.findIndex((s) => s.id === "flow") }));
    expect(useTwin.getState().twinLayer).toBe("flow");
    expect(useTwin.getState().playing).toBe(false);
    act(() => useTour.getState().end("skipped"));
    expect(useTwin.getState().twinLayer).toBe("rooms");
    expect(useTwin.getState().timeMode).toBe("day");
  });
  it("the finish card's main button asks for Invest and the optimizer", () => {
    render(<TourButton autoStart={false} />);
    fireEvent.click(screen.getByTestId("take-tour"));
    act(() => useTour.getState().end("completed", "optimize"));
    expect(useTour.getState().restore).toEqual({ path: "/", tab: "Invest", then: "optimize" });
  });
});

describe("tour flow", () => {
  beforeEach(() => {
    window.localStorage.clear();
    useTwin.getState().resetHotel();
    useTour.setState({ active: false, index: 0, direction: 1, origin: null, restore: null });
    resetTourAutoStart();
    navigate.mockClear();
    pathname = "/";
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
    const snap = () => {
      const t = useTwin.getState();
      return JSON.stringify({ input: t.hotelInput, scenario: t.scenario, plans: t.customPlans, layer: t.twinLayer, time: [t.timeMode, t.timeMonth, t.timeHour, t.playing, t.playbackSpeed], plan: t.hotelPlan });
    };
    const before = snap();
    render(<TourButton autoStart={false} />);
    fireEvent.click(screen.getByTestId("take-tour"));
    expect(await screen.findByText("Meet your hotel's digital twin")).toBeTruthy();
    expect(screen.getByTestId("tour-progress").textContent).toBe("1 of 15");
    expect((await screen.findByTestId("tour-insight")).textContent).toMatch(/a year on energy/);
    fireEvent.click(screen.getByTestId("tour-next"));
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

  it("Skip ends the tour, saves the choice and asks to return to the starting page", () => {
    render(<TourButton autoStart={false} />);
    fireEvent.click(screen.getByTestId("take-tour"));
    fireEvent.click(screen.getByText("Skip tour"));
    expect(useTour.getState().active).toBe(false);
    expect(readTourOutcome()).toBe("skipped");
    expect(useTour.getState().restore?.path ?? "/").toBe("/");
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
    act(() => useTour.setState({ index: TOUR_STEPS.findIndex((s) => s.id === "portfolio") }));
    expect(navigate).toHaveBeenCalledWith({ to: "/portfolio" });
  });
});
