// Equipment corrections (docs/20) and a calibrated utility baseline (docs/19) on the same hotel: both apply, in the hotel's own view, in
// the portfolio totals while another hotel is open, and when the hotel is opened again.
import { beforeEach, describe, expect, it } from "vitest";
import { useTwin } from "@/store/useTwin";
import { selectPortfolioSummary } from "@/store/hotelDerived";
import { inputForBaseline } from "@/store/utilityData";
import { calculateBaselineEnergy, resolveProfile, sampleUtilityBills } from "@/engine/hotel";

const get = () => useTwin.getState();
const row = (id: string) => selectPortfolioSummary(get()).properties.find((p) => p.id === id)!;

beforeEach(() => {
  window.localStorage.clear();
  get().resetDemo();
});

describe("equipment corrections and a calibrated baseline together", () => {
  it("apply to the hotel, survive opening another hotel, and match the portfolio row", () => {
    get().openProperty("lakeshore-inn");
    const plain = get().baseline.annual.cost;
    get().setEquipment([{ id: "boilers", efficiency: 0.95 }]);
    const corrected = get().baseline.annual.cost;
    expect(corrected).toBeLessThan(plain);

    const s = get();
    const records = sampleUtilityBills(s.hotel.profile, calculateBaselineEnergy(resolveProfile(inputForBaseline(s.hotelInput, undefined))));
    get().saveUtilityData("lakeshore-inn", { records, provenance: "sample", markedActual: false, year: 2025, mode: "monthly", useBillRates: false });
    expect(get().setUtilityBaseline("lakeshore-inn", "calibrated")).toBe(true);
    const both = get();
    expect(both.hotelInput.equipment).toEqual([{ id: "boilers", efficiency: 0.95 }]);
    expect(both.baseline.calibration.method).toBe("utility_bills");
    const bothCost = both.baseline.annual.cost;
    expect(row("lakeshore-inn").annual.cost).toBeCloseTo(bothCost, 6);

    // Another hotel open: the portfolio still counts Lakeshore with both.
    get().openProperty("riverwalk-grand");
    expect(row("lakeshore-inn").annual.cost).toBeCloseTo(bothCost, 6);

    // Reopened: both still apply.
    get().openProperty("lakeshore-inn");
    expect(get().hotelInput.equipment).toEqual([{ id: "boilers", efficiency: 0.95 }]);
    expect(get().baseline.calibration.method).toBe("utility_bills");
    expect(get().baseline.annual.cost).toBeCloseTo(bothCost, 6);
  });

  it("Reset demo clears both", () => {
    get().openProperty("lakeshore-inn");
    get().setEquipment([{ id: "boilers", efficiency: 0.95 }]);
    get().resetDemo();
    expect(get().equipmentByProperty).toEqual({});
    expect(get().utilityData).toEqual({});
    expect(get().hotelInput.equipment).toBeUndefined();
  });
});
