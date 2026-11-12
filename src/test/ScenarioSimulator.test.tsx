import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ScenarioSimulator } from "@/components/ScenarioSimulator";
import { selectCompare } from "@/store/hotelDerived";
import { useTwin } from "@/store/useTwin";

vi.mock("@/components/ui/chart", () => ({
  ChartContainer: () => null,
  ChartTooltip: () => null,
  ChartTooltipContent: () => null,
}));

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}
vi.stubGlobal("ResizeObserver", ResizeObserverMock);

describe("Scenario simulator controls", () => {
  beforeEach(() => useTwin.getState().resetHotel());
  afterEach(cleanup);

  it("supports the full 0 to 100% occupancy range and clears the override", () => {
    render(<ScenarioSimulator />);
    const occupancy = screen.getByRole("slider", { name: "Occupancy" });
    fireEvent.keyDown(occupancy, { key: "End" });
    expect(useTwin.getState().scenario.occupancy).toBe(1);
    fireEvent.keyDown(occupancy, { key: "Home" });
    expect(useTwin.getState().scenario.occupancy).toBe(0);
    fireEvent.click(screen.getByRole("button", { name: "Clear occupancy scenario override" }));
    expect(useTwin.getState().scenario.occupancy).toBeUndefined();
  });

  it("clears one occupied setpoint without removing the other", () => {
    act(() => useTwin.getState().setScenario({ setpoints: { occupiedHeatF: 68, occupiedCoolF: 76 } }));
    render(<ScenarioSimulator />);
    fireEvent.click(screen.getByRole("button", { name: "Clear guest-room occupied heating scenario override" }));
    expect(useTwin.getState().scenario.setpoints).toEqual({ occupiedCoolF: 76 });
  });

  it("clears an active stress test when its button is clicked again", () => {
    render(<ScenarioSimulator />);
    const heatWave = screen.getByRole("button", { name: /Heat wave/ });
    fireEvent.click(heatWave);
    expect(useTwin.getState().activeStressTest).toBe("heat_wave");
    fireEvent.click(heatWave);
    expect(useTwin.getState().activeStressTest).toBeNull();
  });

  it("binds scenario optimization and resets all scenario controls", () => {
    render(<ScenarioSimulator />);
    fireEvent.click(screen.getByRole("switch", { name: "Optimize for this scenario" }));
    expect(useTwin.getState().optimizeOnScenario).toBe(true);
    act(() => {
      useTwin.getState().setScenario({ electricityRateChangePct: 20 });
      useTwin.getState().applyStressTest("cold_snap");
    });
    fireEvent.click(screen.getByRole("button", { name: "Reset" }));
    expect(useTwin.getState().scenario).toEqual({});
    expect(useTwin.getState().activeStressTest).toBeNull();
    expect(useTwin.getState().scenarioResult).toBeNull();
  });

  it("shows before and after annual cost from the comparison selector", () => {
    act(() => useTwin.getState().setScenario({ electricityRateChangePct: 20 }));
    render(<ScenarioSimulator />);
    const compare = selectCompare(useTwin.getState());
    expect(screen.getByTestId("scenario-cost-before")).toHaveAttribute("data-value", String(compare.before.annual.cost));
    expect(screen.getByTestId("scenario-cost-after")).toHaveAttribute("data-value", String(compare.after.annual.cost));
    expect(screen.getByText("Energy prices")).toBeInTheDocument();
  });
});
