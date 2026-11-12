import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useTwin } from "@/store/useTwin";
import { selectActiveProperty, selectHotelLabel, selectPortfolioItems, selectPortfolioSummary, selectVisibleCustomPlans } from "@/store/hotelDerived";

const get = () => useTwin.getState();

beforeEach(() => {
  vi.useFakeTimers();
  get().resetHotel();
});
afterEach(() => vi.useRealTimers());

async function runPortfolio() {
  const p = get().runPortfolioOptimizer();
  await vi.advanceTimersByTimeAsync(1200);
  await p;
}
async function runHotel() {
  const p = get().runHotelOptimizer();
  await vi.advanceTimersByTimeAsync(2000);
  await p;
}

describe("portfolio store", () => {
  it("starts with the five-hotel chain and no property open", () => {
    expect(get().portfolio.properties).toHaveLength(5);
    expect(get().activePropertyId).toBeNull();
    expect(get().portfolioBudget).toBe(500_000);
    expect(selectPortfolioSummary(get()).totals.properties).toBe(5);
  });

  it("opening the demo hotel from the portfolio gives the same figures as the preset", () => {
    const before = get().baseline.annual.cost;
    get().openProperty("lakeshore-inn");
    expect(get().activePropertyId).toBe("lakeshore-inn");
    expect(get().baseline.annual.cost).toBeCloseTo(before, 6);
    expect(selectActiveProperty(get())?.id).toBe("lakeshore-inn");
    expect(selectHotelLabel(get()).synthetic).toBe(true);
  });

  it("switching properties and back restores the what-if, stress test and plan", async () => {
    get().openProperty("lakeshore-inn");
    get().setScenario({ occupancy: 0.85 });
    await runHotel();
    const plan = get().hotelPlan;
    expect(plan).not.toBeNull();
    const cost = get().scenarioResult!.after.annual.cost;

    get().openProperty("ohare-gateway");
    expect(get().hotel.profile.name).toBe("O'Hare Gateway Hotel");
    expect(get().scenario).toEqual({});
    expect(get().hotelPlan).toBeNull();
    expect(selectHotelLabel(get()).synthetic).toBe(true);

    get().openProperty("lakeshore-inn");
    expect(get().scenario).toEqual({ occupancy: 0.85 });
    expect(get().hotelPlan).toBe(plan);
    expect(get().scenarioResult!.after.annual.cost).toBeCloseTo(cost, 6);
  });

  it("edits to an open property flow into the portfolio and clear the portfolio plan", async () => {
    await runPortfolio();
    expect(get().portfolioPlan).not.toBeNull();
    get().openProperty("wells-street");
    const before = selectPortfolioSummary(get()).properties.find((p) => p.id === "wells-street")!.annual.cost;
    get().setHotelInput({ occupancy: 0.5 });
    expect(get().portfolioPlan).toBeNull();
    const after = selectPortfolioSummary(get()).properties.find((p) => p.id === "wells-street")!.annual.cost;
    expect(after).not.toBeCloseTo(before, 0);
    // The edit is kept when another property is opened.
    get().openProperty("riverwalk-grand");
    expect(selectPortfolioItems(get()).find((x) => x.property.id === "wells-street")!.input.occupancy).toBe(0.5);
  });

  it("runs the portfolio optimizer within the budget", async () => {
    get().setPortfolioBudget(200_000);
    get().setPortfolioObjective("npv10");
    await runPortfolio();
    const plan = get().portfolioPlan!;
    expect(plan.budget).toBe(200_000);
    expect(plan.objective).toBe("npv10");
    expect(plan.totals.grossCost).toBeLessThanOrEqual(200_000);
    expect(plan.allocations).toHaveLength(5);
  });

  it("custom plans belong to the property they were made for", () => {
    get().openProperty("lakeshore-inn");
    get().createCustomPlan("Lakeshore plan");
    expect(selectVisibleCustomPlans(get()).map((p) => p.name)).toContain("Lakeshore plan");
    get().openProperty("ohare-gateway");
    expect(selectVisibleCustomPlans(get()).map((p) => p.name)).not.toContain("Lakeshore plan");
    get().openProperty("lakeshore-inn");
    expect(selectVisibleCustomPlans(get()).map((p) => p.name)).toContain("Lakeshore plan");
  });

  it("choosing a preset leaves the portfolio property", () => {
    get().openProperty("ohare-gateway");
    get().selectHotelPreset("demo-chicago-300");
    expect(get().activePropertyId).toBeNull();
    expect(get().hotel.profile.name).toBe("Riverwalk Grand");
  });
});
