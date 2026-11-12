import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BudgetOptimizer } from "@/components/BudgetOptimizer";
import { useTwin } from "@/store/useTwin";

describe("Hotel investment selection timing", () => {
  beforeEach(() => { useTwin.getState().resetHotel(); vi.useFakeTimers(); });
  afterEach(() => { cleanup(); vi.useRealTimers(); });

  async function optimize() {
    const pending = useTwin.getState().runHotelOptimizer();
    await vi.advanceTimersByTimeAsync(2000);
    await pending;
    render(<BudgetOptimizer />);
  }

  it("opens the detailed investment comparison only on request", async () => {
    await optimize();
    expect(screen.queryByRole("group", { name: "Discount rate" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Compare investments" }));
    expect(screen.getByRole("group", { name: "Discount rate" })).toBeInTheDocument();
  });

  it("applies the objective winner after 600ms, not before", async () => {
    await optimize();
    expect(useTwin.getState().activeHotelPackageId).toBeNull();
    await act(async () => { await vi.advanceTimersByTimeAsync(599); });
    expect(useTwin.getState().activeHotelPackageId).toBeNull();
    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    expect(useTwin.getState().activeHotelPackageId).toBe(useTwin.getState().hotelPlan?.objectiveWinner?.evaluation.id);
  });

  it("preserves a manual package choice during the 600ms delay", async () => {
    await optimize();
    const plan = useTwin.getState().hotelPlan;
    const alternative = plan?.packages.find((pkg) => pkg.evaluation.id !== plan.objectiveWinner?.evaluation.id);
    if (!alternative) throw new Error("Demo must provide an alternative investment package");
    fireEvent.click(screen.getByRole("button", { name: `Apply ${alternative.roleLabel}` }));
    await act(async () => { await vi.advanceTimersByTimeAsync(600); });
    expect(useTwin.getState().activeHotelPackageId).toBe(alternative.evaluation.id);
  });

  it("counts toward optimizerCombinations as soon as the run starts", async () => {
    render(<BudgetOptimizer />);
    fireEvent.click(screen.getByRole("button", { name: "Find the best investments" }));
    const total = useTwin.getState().optimizerCombinations;
    expect(total).toBeGreaterThan(0);
    const counter = screen.getByTestId("optimizer-combination-counter");
    expect(counter).toHaveAttribute("data-total", String(total));
    const initial = Number(counter.getAttribute("data-count"));
    await act(async () => { await vi.advanceTimersByTimeAsync(400); });
    expect(Number(screen.getByTestId("optimizer-combination-counter").getAttribute("data-count"))).toBeGreaterThan(initial);
    await act(async () => { await vi.advanceTimersByTimeAsync(1600); });
  });

  it("labels packages measured against the current scenario", async () => {
    act(() => {
      useTwin.getState().setScenario({ electricityRateChangePct: 20 });
      useTwin.getState().setOptimizeOnScenario(true);
    });
    const pending = useTwin.getState().runHotelOptimizer();
    await vi.advanceTimersByTimeAsync(2000);
    await pending;
    render(<BudgetOptimizer />);
    expect(useTwin.getState().hotelPlan?.scenario).not.toBeNull();
    expect(screen.getByText("Measured against the current scenario")).toBeInTheDocument();
  });
});