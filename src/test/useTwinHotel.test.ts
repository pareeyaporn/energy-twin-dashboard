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
  selectRooms,
  selectTypicalDay,
  selectZoneRows,
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
