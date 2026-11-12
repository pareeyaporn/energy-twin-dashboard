// Hotel state helpers and selectors for the Energy Twin store. Pure functions that call the engine (src/engine/hotel);
// no math lives here. Selectors are memoized on their inputs so components can call them on every render.
import {
  STRESS_TESTS,
  applyScenario,
  energyFlows,
  equipmentInventory,
  roomOccupancyPattern,
  simulateEnergyScenario,
  simulatedMeter,
  toEnergyResult,
  typicalDayProfile,
  ZONE_IDS,
  ZONE_LABELS,
} from "@/engine/hotel";
import type {
  Conditions,
  EnergyResult,
  HotelInput,
  RankedPackage,
  ResolvedProfile,
  Scenario,
  ScenarioResult,
  StressTest,
  Totals,
  ZoneId,
} from "@/engine/hotel";
import type { TwinState } from "./useTwin";

/** Run `fn` again only when one of its arguments changed (by reference). */
function memoLast<A extends unknown[], R>(fn: (...a: A) => R): (...a: A) => R {
  let last: A | undefined;
  let result: R;
  return (...a: A) => {
    if (last && a.length === last.length && a.every((x, i) => Object.is(x, last![i]))) return result;
    last = a;
    result = fn(...a);
    return result;
  };
}

export const isEmpty = (o: object) => Object.keys(o).length === 0;

/** The user's scenario with the active stress test laid over it (the stress test wins where both set a field). */
export function effectiveScenario(user: Scenario, stressId: StressTest["id"] | null): Scenario {
  const stress = stressId ? STRESS_TESTS.find((t) => t.id === stressId)?.scenario : undefined;
  return stress ? { ...user, ...stress } : user;
}

/** Null when there is nothing to simulate. */
export function computeScenarioResult(hotel: ResolvedProfile, scenario: Scenario): ScenarioResult | null {
  return isEmpty(scenario) ? null : simulateEnergyScenario(hotel, scenario);
}

export function withoutKeys<T extends object>(o: T, keys: readonly (keyof T)[] | undefined): T {
  if (!keys || keys.length === 0) return o;
  const copy = { ...o };
  for (const k of keys) delete copy[k];
  return copy;
}

export function mergeInput(current: HotelInput, patch: HotelInput, clear?: (keyof HotelInput)[]): HotelInput {
  return { ...withoutKeys(current, clear), ...patch };
}

// ---- Selectors ----

export type DisplayKind = "baseline" | "scenario" | "package";

export interface Displayed {
  kind: DisplayKind;
  result: EnergyResult;
  /** Operating conditions for the twin; smart room controls count if an applied package includes them. */
  conditions: Conditions;
  package: RankedPackage | null;
}

/** The package currently applied (from the three shown or the objective winner). */
export function selectActiveHotelPackage(s: Pick<TwinState, "hotelPlan" | "activeHotelPackageId">): RankedPackage | null {
  const id = s.activeHotelPackageId;
  if (!id || !s.hotelPlan) return null;
  const all = [...s.hotelPlan.packages, ...(s.hotelPlan.objectiveWinner ? [s.hotelPlan.objectiveWinner] : [])];
  return all.find((p) => p.evaluation.id === id) ?? null;
}

const packageResult = memoLast((baseline: EnergyResult, pkg: RankedPackage) => toEnergyResult(baseline, pkg.evaluation.outcome.cells));

const displayedOf = memoLast(
  (hotel: ResolvedProfile, baseline: EnergyResult, scenarioResult: ScenarioResult | null, pkg: RankedPackage | null): Displayed => {
    if (pkg) {
      const smart = pkg.evaluation.upgradeIds.includes("smart_room_controls");
      const conditions = smart ? applyScenario(hotel.profile, baseline.conditions, { smartRoomControls: true }) : baseline.conditions;
      return { kind: "package", result: packageResult(baseline, pkg), conditions, package: pkg };
    }
    if (scenarioResult) return { kind: "scenario", result: scenarioResult.after, conditions: scenarioResult.after.conditions, package: null };
    return { kind: "baseline", result: baseline, conditions: baseline.conditions, package: null };
  },
);

/** What the twin and the charts show: the applied package, else the scenario, else the baseline. */
export const selectDisplayed = (s: TwinState): Displayed =>
  displayedOf(s.hotel, s.baseline, s.scenarioResult, selectActiveHotelPackage(s));

/** Before (the baseline) and after (what is displayed). */
export const selectCompare = (s: TwinState): { before: EnergyResult; after: EnergyResult; kind: DisplayKind } => {
  const d = selectDisplayed(s);
  return { before: s.baseline, after: d.result, kind: d.kind };
};

export interface ZoneRow {
  zone: ZoneId;
  label: string;
  totals: Totals;
  /** Share of the total cost. */
  costShare: number;
  /** Site energy per square foot of the whole hotel (kBtu per ft2 per year), a simple intensity for coloring. */
  kBtuPerSqft: number;
  /** After minus baseline cost for this zone (0 for the baseline itself). */
  deltaCost: number;
}

const zoneRowsOf = memoLast((hotel: ResolvedProfile, baseline: EnergyResult, displayed: EnergyResult): ZoneRow[] => {
  const total = displayed.annual.cost || 1;
  return ZONE_IDS.map((zone) => ({
    zone,
    label: ZONE_LABELS[zone],
    totals: displayed.byZone[zone],
    costShare: displayed.byZone[zone].cost / total,
    kBtuPerSqft: displayed.byZone[zone].siteKBtu / hotel.profile.floorAreaSqft,
    deltaCost: displayed.byZone[zone].cost - baseline.byZone[zone].cost,
  }));
});
export const selectZoneRows = (s: TwinState): ZoneRow[] => zoneRowsOf(s.hotel, s.baseline, selectDisplayed(s).result);

const typicalDayOf = memoLast((result: EnergyResult, month: number) => typicalDayProfile(result, month));
export const selectTypicalDay = (s: TwinState) => typicalDayOf(selectDisplayed(s).result, s.timeMonth);

const roomsOf = memoLast((hotel: ResolvedProfile, conditions: Conditions, month: number, hour: number) =>
  roomOccupancyPattern(hotel.profile, conditions, month, hour),
);
export const selectRooms = (s: TwinState) => roomsOf(s.hotel, selectDisplayed(s).conditions, s.timeMonth, s.timeHour);

const flowsOf = memoLast((result: EnergyResult) => energyFlows(result));
export const selectFlows = (s: TwinState) => flowsOf(selectDisplayed(s).result);

const equipmentOf = memoLast((hotel: ResolvedProfile) => equipmentInventory(hotel.profile));
export const selectEquipment = (s: TwinState) => equipmentOf(s.hotel);

const meterOf = memoLast((result: EnergyResult, month: number, hour: number) => simulatedMeter(result, month, hour));
export const selectMeter = (s: TwinState) => meterOf(selectDisplayed(s).result, s.timeMonth, s.timeHour);

export const selectHotelLabel = (s: TwinState) => {
  const p = s.hotel.profile;
  return { title: p.name, city: `${p.city}, ${p.state}`, rooms: p.rooms, synthetic: s.hotelPresetId !== null };
};
export const selectHotelCost = (s: TwinState) => selectDisplayed(s).result.annual.cost;
export const selectHotelBaselineCost = (s: TwinState) => s.baseline.annual.cost;
