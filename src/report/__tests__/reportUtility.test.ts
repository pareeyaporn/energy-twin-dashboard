import { beforeEach, describe, expect, it, vi } from "vitest";
import { useTwin } from "@/store/useTwin";
import { inputForBaseline } from "@/store/utilityData";
import { calculateBaselineEnergy, resolveProfile, sampleUtilityBills } from "@/engine/hotel";
import { aiReportFromState } from "@/report/fromStore";

const get = () => useTwin.getState();

async function optimize() {
  vi.useFakeTimers();
  const run = get().runHotelOptimizer();
  await vi.advanceTimersByTimeAsync(2100);
  await run;
  vi.useRealTimers();
}

const saveSample = () => {
  const s = get();
  const records = sampleUtilityBills(s.hotel.profile, calculateBaselineEnergy(resolveProfile(inputForBaseline(s.hotelInput, undefined))));
  get().saveUtilityData("lakeshore-inn", { records, provenance: "sample", markedActual: false, year: 2025, mode: "monthly", useBillRates: false });
};

beforeEach(() => {
  window.localStorage.clear();
  get().resetDemo();
});

describe("the report shows the hotel's utility data and the baseline it used (docs/19, docs/18)", () => {
  it("no records: no utility section", async () => {
    await optimize();
    expect(aiReportFromState(get())!.utility).toBeNull();
  });

  it("sample records on the modeled baseline: labeled synthetic, modeled baseline, calibrated figures not used", async () => {
    saveSample();
    await optimize();
    const u = aiReportFromState(get())!.utility!;
    expect(u.source).toMatch(/Sample data \(synthetic\)/);
    expect(u.synthetic).toBe(true);
    expect(u.activeBaseline).toBe("Original modeled baseline");
    expect(u.fuels.every((f) => !f.calibrated_used)).toBe(true);
    expect(u.billingPeriod).toMatch(/Jan–Dec 2025 \(12 monthly records\)/);
    expect(u.limits.join(" ")).toMatch(/normal-year weather/);
  });

  it("calibrated baseline: the report says so, quotes the fit, and its figures are measured against the calibrated hotel", async () => {
    saveSample();
    expect(get().setUtilityBaseline("lakeshore-inn", "calibrated")).toBe(true);
    await optimize();
    const s = get();
    const d = aiReportFromState(s)!;
    const u = d.utility!;
    expect(u.activeBaseline).toMatch(/Calibrated baseline/);
    const elec = u.fuels.find((f) => f.fuel === "Electricity")!;
    expect(elec.calibrated_used).toBe(true);
    expect(elec.cvrmseAfter).not.toBeNull();
    expect(Math.abs(elec.calibrated - elec.actual)).toBeLessThan(Math.abs(elec.modeled - elec.actual));
    // The report's current figures are the calibrated baseline the optimizer used.
    expect(d.current.cost).toBeCloseTo(s.baseline.annual.cost, 6);
    expect(s.baseline.calibration.method).toBe("utility_bills");
  });
});
