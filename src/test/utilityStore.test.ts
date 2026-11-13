import { beforeEach, describe, expect, it, vi } from "vitest";
import { useTwin } from "@/store/useTwin";
import { selectPortfolioItems, selectPortfolioSummary, selectUtilityAnalysis, selectUtilityKey, selectUtilitySet, selectUtilityStatus } from "@/store/hotelDerived";
import { UTILITY_STORAGE_KEY, inputForBaseline, readUtilityData, sanitizeUtilityData } from "@/store/utilityData";
import type { UtilitySet } from "@/store/utilityData";
import { calculateBaselineEnergy, resolveProfile, sampleUtilityBills } from "@/engine/hotel";

const get = () => useTwin.getState();

function sampleSet(over: Partial<UtilitySet> = {}): Omit<UtilitySet, "baseline"> {
  const s = get();
  return { records: sampleUtilityBills(s.hotel.profile, calculateBaselineEnergy(resolveProfile(inputForBaseline(s.hotelInput, undefined)))), provenance: "sample", markedActual: false, year: 2025, mode: "monthly", useBillRates: false, ...over };
}

async function optimize() {
  vi.useFakeTimers();
  const run = get().runHotelOptimizer();
  await vi.advanceTimersByTimeAsync(2100);
  await run;
  vi.useRealTimers();
}

beforeEach(() => {
  window.localStorage.clear();
  get().resetDemo();
});

describe("utility data in the store", () => {
  it("keys the 100-room preset to its portfolio hotel, Lakeshore Inn", () => {
    expect(selectUtilityKey(get())).toBe("lakeshore-inn");
  });

  it("saving keeps the modeled baseline; nothing changes until the user chooses the calibrated one", () => {
    const before = get().baseline.annual.cost;
    get().saveUtilityData("lakeshore-inn", sampleSet());
    expect(selectUtilitySet(get())!.baseline).toBe("modeled");
    expect(selectUtilityStatus(get())).toBe("provided");
    expect(get().baseline.annual.cost).toBe(before);
    expect(readUtilityData()["lakeshore-inn"]!.records).toHaveLength(12);
  });

  it("the calibrated baseline changes the results, drops stale plans with a notice, and the optimizer uses it", async () => {
    get().saveUtilityData("lakeshore-inn", sampleSet());
    await optimize();
    expect(get().hotelPlan).not.toBeNull();
    const modeledBaseline = get().baseline;
    expect(get().setUtilityBaseline("lakeshore-inn", "calibrated")).toBe(true);
    const s = get();
    expect(selectUtilityStatus(s)).toBe("calibrated");
    expect(s.baseline.calibration.method).toBe("utility_bills");
    expect(s.baseline.annual.elecKWh).not.toBeCloseTo(modeledBaseline.annual.elecKWh, 0);
    expect(s.hotelPlan).toBeNull();
    expect(s.utilityNotice).toMatch(/cleared because the baseline changed/);
    expect(s.hotelPresetId).toBe("demo-chicago-100"); // still the synthetic sample hotel
    await optimize();
    expect(get().hotelPlan!.baselineAnnualCost).toBeCloseTo(s.baseline.annual.cost, 6);
    // Back to modeled: the original baseline returns exactly.
    get().setUtilityBaseline("lakeshore-inn", "modeled");
    expect(get().baseline.annual.cost).toBeCloseTo(modeledBaseline.annual.cost, 9);
  });

  it("the analysis compares modeled, actual and calibrated", () => {
    get().saveUtilityData("lakeshore-inn", sampleSet());
    const a = selectUtilityAnalysis(get())!;
    expect(a.report.elec.usable).toBe(true);
    expect(a.report.elec.rows).toHaveLength(12);
    expect(a.modeled.annual.cost).toBeCloseTo(get().baseline.annual.cost, 6);
    expect(Math.abs(a.report.elec.calibratedTotal - a.report.elec.actualTotal)).toBeLessThan(Math.abs(a.report.elec.modeledTotal - a.report.elec.actualTotal));
  });

  it("refuses the calibrated baseline when calibration is not possible (too few bills)", () => {
    get().saveUtilityData("lakeshore-inn", sampleSet({ records: sampleSet().records.slice(0, 4) }));
    expect(get().setUtilityBaseline("lakeshore-inn", "calibrated")).toBe(false);
    expect(selectUtilityStatus(get())).toBe("provided");
  });

  it("each hotel keeps its own data; the portfolio uses each hotel's chosen baseline", () => {
    get().saveUtilityData("lakeshore-inn", sampleSet());
    get().setUtilityBaseline("lakeshore-inn", "calibrated");
    const calibratedCost = get().baseline.annual.cost;
    get().openProperty("riverwalk-grand");
    expect(selectUtilitySet(get())).toBeUndefined();
    expect(get().baseline.calibration.method).toBeUndefined();
    const items = selectPortfolioItems(get());
    expect(items.find((x) => x.property.id === "lakeshore-inn")!.input.utilityBills).toHaveLength(12);
    expect(items.find((x) => x.property.id === "riverwalk-grand")!.input.utilityBills).toBeUndefined();
    const row = selectPortfolioSummary(get()).properties.find((p) => p.id === "lakeshore-inn")!;
    expect(row.annual.cost).toBeCloseTo(calibratedCost, 6);
  });

  it("removing the data restores the modeled baseline; Reset demo clears it", () => {
    const before = get().baseline.annual.cost;
    get().saveUtilityData("lakeshore-inn", sampleSet());
    get().setUtilityBaseline("lakeshore-inn", "calibrated");
    get().removeUtilityData("lakeshore-inn");
    expect(get().baseline.annual.cost).toBeCloseTo(before, 9);
    expect(selectUtilityStatus(get())).toBe("modeled");
    get().saveUtilityData("lakeshore-inn", sampleSet());
    get().resetDemo();
    expect(get().utilityData).toEqual({});
    expect(window.localStorage.getItem(UTILITY_STORAGE_KEY)).toContain('"hotels":{}');
  });

  it("hydrates a chosen calibrated baseline after a reload", () => {
    get().saveUtilityData("lakeshore-inn", sampleSet());
    get().setUtilityBaseline("lakeshore-inn", "calibrated");
    const stored = window.localStorage.getItem(UTILITY_STORAGE_KEY)!;
    useTwin.setState({ utilityData: {}, utilityHydrated: false });
    get().resetHotel();
    window.localStorage.setItem(UTILITY_STORAGE_KEY, stored);
    get().hydrateUtilityData();
    expect(get().baseline.calibration.method).toBe("utility_bills");
  });

  it("sanitizes stored data: sample data cannot be marked actual, bad entries are dropped", () => {
    const out = sanitizeUtilityData({ version: 1, hotels: { a: { records: [{ month: 0, elecKWh: 5 }], provenance: "sample", markedActual: true, baseline: "calibrated" }, b: { records: [] }, c: "x" } });
    expect(Object.keys(out)).toEqual(["a"]);
    expect(out["a"]!.markedActual).toBe(false);
    expect(sanitizeUtilityData({ version: 2 })).toEqual({});
  });
});
