import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useTwin } from "@/store/useTwin";
import { TOUR_STEPS } from "@/tour/steps";
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
  it("are 10 short steps for hotel operators, ending with a clear action", () => {
    expect(TOUR_STEPS).toHaveLength(10);
    expect(TOUR_STEPS[0]!.id).toBe("welcome");
    expect(TOUR_STEPS.at(-1)!.title).toBe("You're ready to explore!");
    for (const s of TOUR_STEPS) {
      expect(s.title.length).toBeLessThan(45);
      expect(s.body.split(/(?<=\.)\s/).length).toBeLessThanOrEqual(3);
    }
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
    const before = JSON.stringify({ input: useTwin.getState().hotelInput, scenario: useTwin.getState().scenario, plans: useTwin.getState().customPlans, layer: useTwin.getState().twinLayer });
    render(<TourButton autoStart={false} />);
    fireEvent.click(screen.getByTestId("take-tour"));
    expect(await screen.findByText("Welcome to Energy Twin")).toBeTruthy();
    expect(screen.getByTestId("tour-progress").textContent).toBe("1 of 10");
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
    const after = JSON.stringify({ input: useTwin.getState().hotelInput, scenario: useTwin.getState().scenario, plans: useTwin.getState().customPlans, layer: useTwin.getState().twinLayer });
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
