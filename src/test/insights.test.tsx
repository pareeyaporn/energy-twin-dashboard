import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { STRESS_TESTS } from "@/engine/hotel";
import { useTwin } from "@/store/useTwin";
import { selectEnergyInsights, selectScenarioImpact } from "@/store/hotelDerived";
import { EnergyInsights } from "@/insights/EnergyInsights";
import { ScenarioImpact } from "@/scenario/ScenarioImpact";
import { StressTests } from "@/twin/parts/StressTests";

const navigate = vi.fn(() => Promise.resolve());
vi.mock("@tanstack/react-router", () => ({ useNavigate: () => navigate }));

const get = () => useTwin.getState();

beforeEach(() => {
  get().resetDemo();
  navigate.mockClear();
});
afterEach(() => cleanup());

describe("energy insights in the app", () => {
  it("follow the open hotel and compare it with the other hotels in the portfolio", () => {
    const a = selectEnergyInsights(get());
    expect(selectEnergyInsights(get())).toBe(a); // memoized
    expect(a.length).toBeGreaterThanOrEqual(3);
    get().selectHotelPreset("demo-chicago-300");
    const b = selectEnergyInsights(get());
    expect(b).not.toBe(a);
    const money = (l: typeof a) => l.find((i) => i.id === "investment")?.metric.value;
    expect(money(b)).not.toBeCloseTo(money(a)!, 0);
  });

  it("render as cards whose buttons open the feature they name", () => {
    render(<EnergyInsights />);
    fireEvent.click(screen.getByTestId("insights-toggle")); // the Hotel step shows the top 2; open all
    const cards = screen.getAllByTestId("insight-card");
    expect(cards.length).toBeGreaterThanOrEqual(3);
    const card = (id: string) => cards.find((c) => c.getAttribute("data-insight") === id);
    // HVAC → the equipment view.
    fireEvent.click(within(card("cost_driver")!).getByTestId("insight-action"));
    expect(get().twinLayer).toBe("equipment");
    // A stress exposure → that stress test, applied (resettable).
    const res = cards.find((c) => ["price", "weather", "equipment"].includes(c.getAttribute("data-insight") ?? ""));
    if (res) {
      fireEvent.click(within(res).getByTestId("insight-action"));
      expect(get().activeStressTest).not.toBeNull();
      get().resetScenario();
    }
    // Occupancy → the same +10-point what-if.
    const occ = card("occupancy");
    if (occ) {
      const from = get().hotel.profile.occupancy;
      fireEvent.click(within(occ).getByTestId("insight-action"));
      expect(get().scenario.occupancy).toBeCloseTo(Math.min(1, from + 0.1), 6);
    }
    // Intensity against the portfolio → the portfolio page.
    const intensity = card("intensity");
    if (intensity && /Compare/.test(intensity.textContent ?? "")) {
      fireEvent.click(within(intensity).getByTestId("insight-action"));
      expect(navigate).toHaveBeenCalledWith({ to: "/portfolio" });
    }
    // How was this calculated?
    fireEvent.click(within(cards[0]!).getByTestId("insight-how"));
    expect(within(cards[0]!).getByText(/Estimates|baseline|simulation/i)).toBeTruthy();
  });

  it("a hotel above the other hotels' median intensity links to the portfolio comparison", () => {
    get().openProperty("ohare-gateway");
    render(<EnergyInsights />);
    fireEvent.click(screen.getByTestId("insights-toggle"));
    const card = screen.getAllByTestId("insight-card").find((c) => c.getAttribute("data-insight") === "intensity")!;
    expect(card.textContent).toMatch(/median of the other 4 hotels/);
    fireEvent.click(within(card).getByTestId("insight-action"));
    expect(navigate).toHaveBeenCalledWith({ to: "/portfolio" });
  });

  it("the investment button runs the optimizer only when clicked", async () => {
    vi.useFakeTimers();
    render(<EnergyInsights />);
    expect(get().hotelPlan).toBeNull();
    const card = screen.getAllByTestId("insight-card").find((c) => c.getAttribute("data-insight") === "investment")!;
    fireEvent.click(within(card).getByTestId("insight-action"));
    expect(get().optimizing).toBe(true);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2100);
    });
    expect(get().hotelPlan).not.toBeNull();
    vi.useRealTimers();
  });
});

describe("simulation impact and stress results", () => {
  it("the impact summary shows the scenario minus today and resets to the baseline", () => {
    render(<ScenarioImpact />);
    expect(screen.queryByTestId("scenario-impact")).toBeNull();
    act(() => get().setScenario({ occupancy: 0.85 }));
    const lines = selectScenarioImpact(get())!;
    const r = get().scenarioResult!;
    expect(lines.find((l) => l.id === "cost")!.delta).toBeCloseTo(r.after.annual.cost - r.before.annual.cost, 9);
    expect(screen.getByTestId("impact-cost").textContent).toContain(`$${Math.round(r.after.annual.cost).toLocaleString("en-US")}`);
    fireEvent.click(screen.getByLabelText("Reset to baseline"));
    expect(get().scenarioResult).toBeNull();
    expect(screen.queryByTestId("scenario-impact")).toBeNull();
  });

  it("a temporary event is labeled and its cost is the total for the one event, not a yearly rate", () => {
    render(<StressTests />);
    act(() => get().applyStressTest("heat_wave"));
    expect(screen.getByTestId("stress-kind").textContent).toMatch(/Temporary event/);
    expect(screen.getByTestId("stress-description").textContent).toMatch(/in the year it happens \(one-off, not annualized\)/);
    expect(screen.getByTestId("stress-cost-row").textContent).toMatch(/%/);
    act(() => get().applyStressTest("price_up_20"));
    expect(screen.getByTestId("stress-kind").textContent).toMatch(/Persistent financial assumption/);
    expect(screen.getByTestId("stress-description").textContent).toMatch(/per year, every year/);
    // The heat wave's description matches what the scenario actually does: July only, +10 °F.
    const hw = STRESS_TESTS.find((t) => t.id === "heat_wave")!;
    expect(hw.assumptions[0]!.period).toMatch(/July only/);
    expect((hw.scenario.weatherOffsetF as number[]).filter((x) => x !== 0)).toEqual([10]);
  });
});
