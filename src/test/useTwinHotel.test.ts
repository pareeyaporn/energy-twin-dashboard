import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ZONE_IDS } from "@/engine/hotel";
import { useTwin, selectCurrentCost } from "@/store/useTwin";
import {
  selectCompare,
  selectDisplayed,
  selectEquipment,
  selectFlows,
  selectHotelBaselineCost,
  selectHotelCost,
  selectHotelLabel,
  selectMeter,
  selectOpportunities,
  selectRooms,
  selectTypicalDay,
  selectZoneRows,
  selectUpgradeComparison,
  selectUpgradeBaseline,
} from "@/store/hotelDerived";

const get = () => useTwin.getState();
const sum = (xs: number[]) => xs.reduce((s, x) => s + x, 0);

async function runOptimizer() {
  const p = get().runHotelOptimizer();
  await vi.advanceTimersByTimeAsync(2000);
  await p;
}

describe("hotel state in the store", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    get().resetHotel();
    get().selectPreset("maya");
  });
  afterEach(() => vi.useRealTimers());

  it("starts with the synthetic 100-room demo hotel and a computed baseline", () => {
    expect(get().hotelPresetId).toBe("demo-chicago-100");
    expect(get().hotel.profile.rooms).toBe(100);
    expect(get().baseline.annual.cost).toBeGreaterThan(100000);
    expect(selectDisplayed(get()).kind).toBe("baseline");
    expect(selectHotelLabel(get())).toMatchObject({ title: "Lakeshore Inn", rooms: 100, synthetic: true });
    expect(selectHotelCost(get())).toBe(selectHotelBaselineCost(get()));
  });

  it("keeps the home-era state working", () => {
    expect(selectCurrentCost(get())).toBe(2340);
    expect(get().budget).toBe(15000);
  });

  it("recomputes the baseline when the hotel changes and clears results that no longer apply", async () => {
    await runOptimizer();
    expect(get().hotelPlan).not.toBeNull();
    const before = get().baseline.annual.cost;
    get().setHotelInput({ rooms: 150, floorAreaSqft: 82500 });
    expect(get().hotelPresetId).toBeNull();
    expect(get().baseline.annual.cost).toBeGreaterThan(before);
    expect(get().hotelPlan).toBeNull();
    expect(get().activeHotelPackageId).toBeNull();
  });

  it("can clear an input back to its default", () => {
    get().setHotelInput({ occupancy: 0.9 });
    expect(get().hotel.defaulted).not.toContain("occupancy");
    get().setHotelInput({}, ["occupancy"]);
    expect(get().hotel.defaulted).toContain("occupancy");
  });

  it("selecting a preset restores the hotel and drops scenario and plan", async () => {
    get().setScenario({ occupancy: 0.9 });
    await runOptimizer();
    get().selectHotelPreset("demo-chicago-100");
    expect(get().scenario).toEqual({});
    expect(get().scenarioResult).toBeNull();
    expect(get().hotelPlan).toBeNull();
    get().selectHotelPreset("no-such-preset");
    expect(get().hotelPresetId).toBe("demo-chicago-100");
  });
});

describe("scenarios and stress tests", () => {
  beforeEach(() => get().resetHotel());

  it("a scenario produces a result and changes what is displayed", () => {
    expect(get().scenarioResult).toBeNull();
    get().setScenario({ occupancy: 0.85 });
    expect(get().scenarioResult).not.toBeNull();
    expect(selectDisplayed(get()).kind).toBe("scenario");
    expect(selectHotelCost(get())).toBeGreaterThan(selectHotelBaselineCost(get()));
    const { before, after, kind } = selectCompare(get());
    expect(kind).toBe("scenario");
    expect(after.annual.cost).toBeGreaterThan(before.annual.cost);
  });

  it("resetScenario returns to the baseline", () => {
    get().setScenario({ occupancy: 0.85, smartRoomControls: true });
    get().applyStressTest("heat_wave");
    get().resetScenario();
    expect(get().scenario).toEqual({});
    expect(get().activeStressTest).toBeNull();
    expect(selectDisplayed(get()).kind).toBe("baseline");
  });

  it("merges scenario patches and can clear a field", () => {
    get().setScenario({ occupancy: 0.85 });
    get().setScenario({ smartRoomControls: true });
    expect(get().scenario).toEqual({ occupancy: 0.85, smartRoomControls: true });
    get().setScenario({}, ["occupancy"]);
    expect(get().scenario).toEqual({ smartRoomControls: true });
    get().setScenario({}, ["smartRoomControls"]);
    expect(get().scenarioResult).toBeNull();
  });

  it("a stress test lays over the user's scenario", () => {
    get().setScenario({ occupancy: 0.85 });
    get().applyStressTest("price_up_20");
    const ids = get().scenarioResult!.drivers.map((d) => d.id);
    expect(ids).toEqual(["occupancy", "rates"]);
    expect(get().scenario).toEqual({ occupancy: 0.85 }); // the user's own settings are untouched
    get().applyStressTest(null);
    expect(get().scenarioResult!.drivers.map((d) => d.id)).toEqual(["occupancy"]);
  });

  it("a stress test alone is a scenario", () => {
    get().applyStressTest("heat_wave");
    expect(selectDisplayed(get()).kind).toBe("scenario");
    expect(get().scenarioResult!.delta.cost).toBeGreaterThan(0);
  });

  it("changing the hotel keeps the scenario and recomputes it", () => {
    get().setScenario({ occupancy: 0.85 });
    const before = get().scenarioResult!.after.annual.cost;
    get().setHotelInput({ rooms: 150, floorAreaSqft: 82500 });
    expect(get().scenarioResult!.after.annual.cost).toBeGreaterThan(before);
  });
});

describe("budget optimizer in the store", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    get().resetHotel();
  });
  afterEach(() => vi.useRealTimers());

  it("holds optimizing for about two seconds, then shows three packages within the budget", async () => {
    get().setHotelBudget(50000);
    const p = get().runHotelOptimizer();
    expect(get().optimizing).toBe(true);
    expect(get().hotelPlan).toBeNull();
    await vi.advanceTimersByTimeAsync(1999);
    expect(get().optimizing).toBe(true);
    await vi.advanceTimersByTimeAsync(1);
    await p;
    expect(get().optimizing).toBe(false);
    const plan = get().hotelPlan!;
    expect(plan.packages).toHaveLength(3);
    expect(plan.budget).toBe(50000);
    for (const pk of plan.packages) expect(pk.evaluation.cost.mid).toBeLessThanOrEqual(50000);
  });

  it("exposes the number of combinations as soon as a run starts, so the UI can count up to it", async () => {
    expect(get().optimizerCombinations).toBeNull();
    const p = get().runHotelOptimizer();
    expect(get().optimizing).toBe(true);
    expect(get().hotelPlan).toBeNull();
    const n = get().optimizerCombinations;
    expect(n).toBeGreaterThan(1);
    await vi.advanceTimersByTimeAsync(2000);
    await p;
    expect(get().hotelPlan!.combinationsTested).toBe(n);
    get().resetHotel();
    expect(get().optimizerCombinations).toBeNull();
  });

  it("ignores a second request while one is running", async () => {
    const a = get().runHotelOptimizer();
    const b = get().runHotelOptimizer();
    await vi.advanceTimersByTimeAsync(2000);
    await Promise.all([a, b]);
    expect(get().hotelPlan).not.toBeNull();
  });

  it("drops the result if the hotel changed while it was running", async () => {
    const p = get().runHotelOptimizer();
    get().setHotelInput({ rooms: 120, floorAreaSqft: 66000 });
    await vi.advanceTimersByTimeAsync(2000);
    await p;
    expect(get().optimizing).toBe(false);
    expect(get().hotelPlan).toBeNull();
  });

  it("applying a package shows its after-upgrade result and lowers the bill", async () => {
    await (async () => {
      const p = get().runHotelOptimizer();
      await vi.advanceTimersByTimeAsync(2000);
      await p;
    })();
    const pkg = get().hotelPlan!.packages[0]!;
    get().applyHotelPackage(pkg.evaluation.id);
    const d = selectDisplayed(get());
    expect(d.kind).toBe("package");
    expect(d.package?.evaluation.id).toBe(pkg.evaluation.id);
    expect(selectHotelCost(get())).toBeCloseTo(pkg.evaluation.newAnnualCost, 6);
    expect(selectHotelCost(get())).toBeLessThan(selectHotelBaselineCost(get()));
    get().applyHotelPackage("not-a-package");
    expect(selectDisplayed(get()).kind).toBe("baseline");
    get().applyHotelPackage(pkg.evaluation.id);
    get().applyHotelPackage(null);
    expect(selectDisplayed(get()).kind).toBe("baseline");
  });

  it("changing the objective changes the highlighted winner's role", async () => {
    get().setHotelBudget(100000);
    get().setHotelObjective("payback");
    const p = get().runHotelOptimizer();
    await vi.advanceTimersByTimeAsync(2000);
    await p;
    expect(get().hotelPlan!.objective).toBe("payback");
    expect(get().hotelPlan!.objectiveWinner!.role).toBe("fastest_payback");
  });
});

describe("twin controls and derived selectors", () => {
  beforeEach(() => get().resetHotel());

  it("clamps the time controls and keeps other state", () => {
    get().setTime({ month: 14, hour: -3 });
    expect(get().timeMonth).toBe(11);
    expect(get().timeHour).toBe(0);
    get().setTime({ mode: "year", hour: 23.6 });
    expect(get().timeMode).toBe("year");
    expect(get().timeHour).toBe(23);
    expect(get().timeMonth).toBe(11);
    get().setPlaybackSpeed(4);
    expect(get().playbackSpeed).toBe(4);
    get().setPlaybackSpeed(-1);
    expect(get().playbackSpeed).toBe(1);
    get().setPlaying(true);
    get().setTwinLayer("flow");
    get().setCompareMode("split");
    get().selectZone("hot_water");
    expect(get()).toMatchObject({ playing: true, twinLayer: "flow", compareMode: "split", selectedZone: "hot_water" });
  });

  it("zone rows add up to the total and show the change against the baseline", () => {
    const rows = selectZoneRows(get());
    expect(rows.map((r) => r.zone)).toEqual(ZONE_IDS);
    expect(sum(rows.map((r) => r.totals.cost))).toBeCloseTo(get().baseline.annual.cost, 6);
    expect(sum(rows.map((r) => r.costShare))).toBeCloseTo(1, 9);
    expect(rows.every((r) => r.deltaCost === 0)).toBe(true);
    get().setScenario({ occupancy: 0.9 });
    const after = selectZoneRows(get());
    expect(after.find((r) => r.zone === "hot_water")!.deltaCost).toBeGreaterThan(0);
  });

  it("typical day, meter, rooms, flows and equipment follow the display and the time controls", () => {
    get().setTime({ month: 6, hour: 15 });
    const day = selectTypicalDay(get());
    expect(day).toHaveLength(24);
    expect(selectMeter(get())).toMatchObject({ simulated: true, kW: day[15]!.elecKW });
    expect(selectRooms(get())).toHaveLength(get().hotel.profile.rooms);
    expect(selectEquipment(get()).length).toBeGreaterThan(5);
    const flows = selectFlows(get());
    expect(sum(flows.links.filter((l) => l.source === "grid").map((l) => l.costUsd))).toBeCloseTo(get().baseline.annual.elecCost, 6);
  });

  it("rooms show setback when smart controls are on", () => {
    expect(selectRooms(get()).some((r) => r.setback)).toBe(false);
    get().setScenario({ smartRoomControls: true });
    expect(selectRooms(get()).some((r) => r.setback)).toBe(true);
  });

  it("returns the same object for the same state (safe to call on every render)", () => {
    const s = get();
    expect(selectDisplayed(s)).toBe(selectDisplayed(s));
    expect(selectZoneRows(s)).toBe(selectZoneRows(s));
    expect(selectTypicalDay(s)).toBe(selectTypicalDay(s));
    expect(selectRooms(s)).toBe(selectRooms(s));
    expect(selectFlows(s)).toBe(selectFlows(s));
    expect(selectCompare(s)).toBe(selectCompare(s));
    expect(selectHotelLabel(s)).toBe(selectHotelLabel(s));
    expect(selectEquipment(s)).toBe(selectEquipment(s));
    expect(selectMeter(s)).toBe(selectMeter(s));
    get().setTime({ hour: 3 });
    expect(selectRooms(get())).not.toBe(selectRooms(s));
  });
});

describe("saved scenarios", () => {
  beforeEach(() => get().resetHotel());

  it("saves, loads, renames and deletes", () => {
    get().setScenario({ occupancy: 0.85, smartRoomControls: true });
    get().applyStressTest("price_up_20");
    get().saveScenario("Busy summer");
    get().resetScenario();
    get().saveScenario();
    expect(get().savedScenarios.map((s) => s.name)).toEqual(["Busy summer", "Scenario 2"]);
    expect(get().savedScenarios.map((s) => s.id)).toEqual(["scn-1", "scn-2"]);

    get().loadScenario("scn-1");
    expect(get().scenario).toEqual({ occupancy: 0.85, smartRoomControls: true });
    expect(get().activeStressTest).toBe("price_up_20");
    expect(get().scenarioResult).not.toBeNull();

    get().renameScenario("scn-2", "  Baseline  ");
    expect(get().savedScenarios[1]!.name).toBe("Baseline");
    get().renameScenario("scn-2", "   ");
    expect(get().savedScenarios[1]!.name).toBe("Baseline");
    get().deleteScenario("scn-1");
    expect(get().savedScenarios.map((s) => s.id)).toEqual(["scn-2"]);
    get().loadScenario("nope");
    expect(get().savedScenarios).toHaveLength(1);
  });

  it("a saved scenario is a copy: later changes do not alter it", () => {
    get().setScenario({ occupancy: 0.8 });
    get().saveScenario();
    get().setScenario({ occupancy: 0.5 });
    expect(get().savedScenarios[0]!.scenario).toEqual({ occupancy: 0.8 });
  });
});

describe("optimizing under a scenario", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    get().resetHotel();
    get().setHotelBudget(100000);
  });
  afterEach(() => vi.useRealTimers());

  async function run() {
    const p = get().runHotelOptimizer();
    await vi.advanceTimersByTimeAsync(2000);
    await p;
  }

  it("turns on by itself when a scenario starts and off when the scenario is cleared", async () => {
    expect(get().optimizeOnScenario).toBe(false);
    await run();
    expect(get().hotelPlan!.scenario).toBeNull();
    get().setScenario({ occupancy: 0.85 });
    expect(get().optimizeOnScenario).toBe(true);
    expect(get().hotelPlan).toBeNull(); // the baseline plan no longer matches what is shown
    get().setScenario({ smartRoomControls: true }); // already on: nothing else changes
    expect(get().optimizeOnScenario).toBe(true);
    get().resetScenario();
    expect(get().optimizeOnScenario).toBe(false);
    get().applyStressTest("heat_wave");
    expect(get().optimizeOnScenario).toBe(true);
    get().applyStressTest(null);
    expect(get().optimizeOnScenario).toBe(false);
  });

  it("can be switched off during a scenario, and then measures against the plain baseline", async () => {
    get().applyStressTest("price_up_20");
    get().setOptimizeOnScenario(false);
    get().setScenario({ occupancy: 0.85 }); // a scenario already running: the user's choice stays
    expect(get().optimizeOnScenario).toBe(false);
    await run();
    expect(get().hotelPlan!.scenario).toBeNull();
    expect(get().hotelPlanBaseline).toBe(get().baseline);
  });

  it("when on, measures against the scenario and says so", async () => {
    get().applyStressTest("price_up_20");
    get().setOptimizeOnScenario(false);
    await run();
    const plain = get().hotelPlan!;
    get().setOptimizeOnScenario(true);
    expect(get().hotelPlan).toBeNull();
    await run();
    const scn = get().hotelPlan!;
    expect(scn.scenario).not.toBeNull();
    expect(scn.baselineAnnualCost).toBeCloseTo(get().scenarioResult!.after.annual.cost, 6);
    expect(scn.baselineAnnualCost).toBeGreaterThan(plain.baselineAnnualCost);
    expect(get().hotelPlanBaseline).not.toBe(get().baseline);
  });

  it("applying a package then shows it against the situation it was measured against", async () => {
    get().applyStressTest("price_up_20");
    get().setOptimizeOnScenario(true);
    await run();
    const pkg = get().hotelPlan!.packages[0]!;
    get().applyHotelPackage(pkg.evaluation.id);
    const { before, after, kind } = selectCompare(get());
    expect(kind).toBe("package");
    expect(before).toBe(get().hotelPlanBaseline);
    expect(before.annual.cost - after.annual.cost).toBeCloseTo(pkg.evaluation.annualSavings.mid, 6);
  });

  it("a plan made on a scenario goes stale when the scenario changes; a plain plan does not", async () => {
    get().applyStressTest("price_up_20");
    get().setOptimizeOnScenario(true);
    await run();
    get().applyHotelPackage(get().hotelPlan!.packages[0]!.evaluation.id);
    get().setScenario({ occupancy: 0.9 });
    expect(get().hotelPlan).toBeNull();
    expect(get().activeHotelPackageId).toBeNull();
    expect(get().hotelPlanBaseline).toBeNull();

    get().setOptimizeOnScenario(false);
    await run();
    get().setScenario({ occupancy: 0.5 });
    expect(get().hotelPlan).not.toBeNull();
  });

  it("drops a result if the scenario changed while it was running", async () => {
    get().setOptimizeOnScenario(true);
    get().applyStressTest("heat_wave");
    const p = get().runHotelOptimizer();
    get().applyStressTest("cold_snap");
    await vi.advanceTimersByTimeAsync(2000);
    await p;
    expect(get().hotelPlan).toBeNull();
    expect(get().optimizing).toBe(false);
  });
});

describe("opportunities by zone in the store", () => {
  beforeEach(() => get().resetHotel());

  it("lists the upgrades that help each zone", () => {
    const opp = selectOpportunities(get());
    expect(opp.hot_water[0]!.id).toBe("water_heating");
    expect(opp.guest_rooms.map((o) => o.id)).toContain("smart_room_controls");
  });

  it("is the same object for the same state and follows the scenario", () => {
    const s = get();
    expect(selectOpportunities(s)).toBe(selectOpportunities(s));
    const led = (z: "hallways_shared") => selectOpportunities(get())[z].find((o) => o.id === "led_lighting")!.zoneAnnualSavings;
    const before = led("hallways_shared");
    get().applyStressTest("price_up_20");
    expect(led("hallways_shared")).toBeGreaterThan(before);
  });
});

describe("upgrade comparison in the store", () => {
  beforeEach(() => get().resetHotel());

  it("lists every eligible upgrade with the common breakdown, measured like the optimizer", () => {
    const rows = selectUpgradeComparison(get());
    expect(rows.map((r) => r.id)).toContain("rooftop_solar");
    expect(selectUpgradeComparison(get())).toBe(rows); // memoized
    for (const r of rows) {
      expect(r.financials.netInvestment.mid).toBeCloseTo(r.financials.grossCost.mid - r.financials.incentivesTotal, 6);
      expect(Number.isFinite(r.financials.netBenefit10.mid)).toBe(true);
    }
  });

  it("follows the scenario while optimize-for-scenario is on, and the baseline when it is off", () => {
    const base = selectUpgradeComparison(get()).find((r) => r.id === "led_lighting")!.financials.annualSavings.mid;
    get().applyStressTest("price_up_20"); // turns optimize-for-scenario on
    const onScenario = selectUpgradeComparison(get()).find((r) => r.id === "led_lighting")!.financials.annualSavings.mid;
    expect(onScenario).toBeGreaterThan(base);
    expect(selectUpgradeBaseline(get())).toBe(get().scenarioResult!.after);
    get().setOptimizeOnScenario(false);
    expect(selectUpgradeComparison(get()).find((r) => r.id === "led_lighting")!.financials.annualSavings.mid).toBeCloseTo(base, 6);
    expect(selectUpgradeBaseline(get())).toBe(get().baseline);
  });
});
