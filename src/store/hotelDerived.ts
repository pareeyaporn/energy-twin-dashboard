// Hotel state helpers and selectors for the Energy Twin store. Pure functions that call the engine (src/engine/hotel);
import { withEquipment } from "./equipmentStorage";
// no math lives here. Selectors are memoized on their inputs so components can call them on every render.
import {
  STRESS_TESTS,
  applyScenario,
  compareUpgrades,
  daylight,
  outdoorTempF,
  solarHourKW,
  solarSizeKw,
  sunAzimuthDeg,
  sunElevationDeg,
  isSolar,
  hotelData,
  contextFromBaseline,
  energyFlows,
  opportunitiesByZone,
  equipmentInventory,
  roomOccupancyPattern,
  simulateEnergyScenario,
  simulatedMeter,
  toEnergyResult,
  typicalDayProfile,
  ZONE_IDS,
  ZONE_LABELS,
  evaluatePlan,
  explainPlan,
  planAmounts,
  stressRecommendation,
  stressTestReport,
  upgradeCatalog,
  portfolioSummary,
  evaluatePortfolioCustomPlan,
  portfolioStressReport,
  energyInsights,
  impactSummary,
  calculateBaselineEnergy,
  prepareUpgradeContext,
  resolveProfile,
} from "@/engine/hotel";
import type {
  UpgradeComparisonRow,
  Conditions,
  EnergyResult,
  HotelInput,
  PlanEvaluation,
  PortfolioResult,
  PortfolioProperty,
  PortfolioSummary,
  PortfolioCustomEvaluation,
  PortfolioPlan,
  PortfolioStressReport,
  StressPlanInput,
  StressReport,
  RankedPackage,
  ResolvedProfile,
  Scenario,
  ScenarioResult,
  StressTest,
  Totals,
  ZoneId,
  EnergyInsight,
  ImpactLine,
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
  (
    hotel: ResolvedProfile,
    baseline: EnergyResult,
    scenarioResult: ScenarioResult | null,
    pkg: RankedPackage | null,
    planBaseline: EnergyResult | null,
  ): Displayed => {
    if (pkg) {
      const smart = pkg.evaluation.upgradeIds.includes("smart_room_controls");
      const template = planBaseline ?? baseline;
      const conditions = smart ? applyScenario(hotel.profile, template.conditions, { smartRoomControls: true }) : template.conditions;
      return { kind: "package", result: packageResult(template, pkg), conditions, package: pkg };
    }
    if (scenarioResult) return { kind: "scenario", result: scenarioResult.after, conditions: scenarioResult.after.conditions, package: null };
    return { kind: "baseline", result: baseline, conditions: baseline.conditions, package: null };
  },
);

/** What the twin and the charts show: the applied package, else the scenario, else the baseline. */
export const selectDisplayed = (s: TwinState): Displayed =>
  displayedOf(s.hotel, s.baseline, s.scenarioResult, selectActiveHotelPackage(s), s.hotelPlanBaseline);

const compareOf = memoLast((before: EnergyResult, after: EnergyResult, kind: DisplayKind) => ({ before, after, kind }));

/** Before (the baseline; for a package, the situation the plan was measured against) and after (what is displayed). */
export const selectCompare = (s: TwinState): { before: EnergyResult; after: EnergyResult; kind: DisplayKind } => {
  const d = selectDisplayed(s);
  return compareOf(d.kind === "package" ? (s.hotelPlanBaseline ?? s.baseline) : s.baseline, d.result, d.kind);
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
export const selectZoneRows = (s: TwinState): ZoneRow[] => zoneRowsOf(s.hotel, selectCompare(s).before, selectDisplayed(s).result);

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

const labelOf = memoLast((hotel: ResolvedProfile, presetId: string | null) => {
  const p = hotel.profile;
  return { title: p.name, city: `${p.city}, ${p.state}`, rooms: p.rooms, synthetic: presetId !== null };
});
/** True when the open hotel's data is synthetic: a preset, or a sample portfolio hotel (not one the user added). */
const allPropertiesOf = memoLast((orgs: TwinState["organizations"], userHotels: TwinState["userHotels"]): PortfolioProperty[] => [
  ...orgs.flatMap((o) => o.properties),
  ...userHotels,
]);
/** Every hotel in every organization, plus the user's own (for looking a hotel up by id). */
export const selectAllProperties = (s: TwinState): PortfolioProperty[] => allPropertiesOf(s.organizations, s.userHotels);

export const selectIsSynthetic = (s: TwinState): boolean => {
  if (s.activePropertyId) return selectAllProperties(s).find((p) => p.id === s.activePropertyId)?.synthetic ?? true;
  return s.hotelPresetId !== null;
};
export const selectHotelLabel = (s: TwinState) => labelOf(s.hotel, selectIsSynthetic(s) ? "synthetic" : null);
export const selectHotelCost = (s: TwinState) => selectDisplayed(s).result.annual.cost;
export const selectHotelBaselineCost = (s: TwinState) => s.baseline.annual.cost;

/** Upgrades that would help each zone, measured against the current scenario's result if there is one, else the baseline. */
const opportunitiesOf = memoLast((hotel: ResolvedProfile, measuredAgainst: EnergyResult) =>
  opportunitiesByZone(contextFromBaseline(hotel, measuredAgainst)),
);
/**
 * What upgrades are measured against: the what-if when "optimize for this scenario" is on and a scenario is running, otherwise the
 * plain baseline. The optimizer, the comparison cards, the zone opportunities and the advisor all follow this one rule.
 */
export const selectUpgradeBaseline = (s: TwinState): EnergyResult =>
  s.optimizeOnScenario && s.scenarioResult ? s.scenarioResult.after : s.baseline;

export const selectOpportunities = (s: TwinState) => opportunitiesOf(s.hotel, selectUpgradeBaseline(s));

const comparisonOf = memoLast((hotel: ResolvedProfile, measuredAgainst: EnergyResult, discountRate: number): UpgradeComparisonRow[] =>
  compareUpgrades(contextFromBaseline(hotel, measuredAgainst), { assumptions: { discountRate } }),
);
/**
 * Every eligible upgrade on its own with the common financial breakdown (gross cost, incentives, net investment, kWh and $ saved,
 * payback, 5- and 10-year net benefit, CO2). Same calculation as the optimizer's packages and the advisor's figures.
 */
export const selectUpgradeComparison = (s: TwinState): UpgradeComparisonRow[] => comparisonOf(s.hotel, selectUpgradeBaseline(s), s.hotelDiscountRate);

/** Everything the twin shows for the current month and hour, from the engine. Read-only; memoized. */
export interface HourState {
  month: number;
  hour: number;
  /** Modeled from NOAA monthly normal highs and lows. */
  outdoorTempF: number;
  sunrise: number;
  sunset: number;
  sunElevationDeg: number;
  sunAzimuthDeg: number;
  isDay: boolean;
  rooms: { total: number; booked: number; present: number; setback: number };
  /** That hour of a typical day of the month, by end use (site kW: electricity kW plus gas converted at 29.3 kW per therm/h). */
  demandKW: { heating: number; cooling: number; ventilation: number; lighting: number; hotWater: number; other: number; total: number };
  elecKW: number;
  gasThermsPerHour: number;
  costPerHour: number;
  solar: { installed: boolean; sizeKw: number; kW: number; previewSizeKw: number; previewKW: number };
}

const KW_PER_THERM_H = 29.3071;

const hourStateOf = memoLast(
  (hotel: ResolvedProfile, baselineElecKWh: number, result: EnergyResult, conditions: Conditions, month: number, hour: number, solarId: string | null, solarKw: number): HourState => {
    const p = hotel.profile;
    const day = typicalDayProfile(result, month)[hour]!;
    const site = (u: { elecKW: number; gasThermsPerHour: number }) => u.elecKW + u.gasThermsPerHour * KW_PER_THERM_H;
    const e = day.byEndUse;
    const rooms = roomOccupancyPattern(p, conditions, month, hour);
    const dl = daylight(climateLat(hotel), month);
    const elev = sunElevationDeg(climateLat(hotel), month, hour + 0.5);
    const preview = solarSizeKw(p, baselineElecKWh, undefined, 'rooftop_solar');
    const other = site(e.kitchen) + site(e.equipment) + site(e.other);
    const demand = {
      heating: site(e.heating),
      cooling: site(e.cooling),
      ventilation: site(e.ventilation),
      lighting: site(e.lighting),
      hotWater: site(e.hotWater),
      other,
    };
    return {
      month,
      hour,
      outdoorTempF: outdoorTempF(p, month, hour + 0.5),
      sunrise: dl.sunrise,
      sunset: dl.sunset,
      sunElevationDeg: elev,
      sunAzimuthDeg: sunAzimuthDeg(climateLat(hotel), month, hour + 0.5),
      isDay: elev > 0,
      rooms: {
        total: rooms.length,
        booked: rooms.filter((r) => r.state !== 'vacant').length,
        present: rooms.filter((r) => r.state === 'occupied').length,
        setback: rooms.filter((r) => r.setback).length,
      },
      demandKW: { ...demand, total: demand.heating + demand.cooling + demand.ventilation + demand.lighting + demand.hotWater + other },
      elecKW: day.elecKW,
      gasThermsPerHour: day.gasThermsPerHour,
      costPerHour: day.costPerHour,
      solar: {
        installed: solarId !== null && solarKw > 0,
        sizeKw: solarKw,
        kW: solarId !== null ? solarHourKW(p, solarKw, month, hour) : 0,
        previewSizeKw: preview,
        previewKW: solarHourKW(p, preview, month, hour),
      },
    };
  },
);

function climateLat(hotel: ResolvedProfile): number {
  return hotelData.weather.climates[hotel.profile.climateId]?.latitude ?? 40;
}

/** The current hour of the twin: outdoor temperature (modeled), sun, rooms, demand by end use, cost and solar. */
export const selectHourState = (s: TwinState): HourState => {
  const d = selectDisplayed(s);
  const ids = d.package?.evaluation.upgradeIds ?? [];
  const solarId = ids.find((id) => isSolar(id)) ?? null;
  const solarKw = d.package?.evaluation.sizing.solarKw ?? 0;
  return hourStateOf(s.hotel, s.baseline.annual.elecKWh, d.result, d.conditions, s.timeMonth, s.timeHour, solarId, solarKw);
};

// ---- Custom investment plans ----

/** The upgrade context custom plans are measured against: the same as the optimizer and the upgrade comparison (scenario-aware). */
const planContextOf = memoLast((hotel: ResolvedProfile, measuredAgainst: EnergyResult) => contextFromBaseline(hotel, measuredAgainst));
export const selectPlanContext = (s: TwinState) => planContextOf(s.hotel, selectUpgradeBaseline(s));

const catalogOf = memoLast((ctx: ReturnType<typeof contextFromBaseline>) => upgradeCatalog(ctx));
export const selectCatalog = (s: TwinState) => catalogOf(selectPlanContext(s));

export const selectActiveCustomPlan = (s: TwinState) => s.customPlans.find((p) => p.id === s.activeCustomPlanId) ?? null;

/** The custom plans shown for the open hotel: its own, plus plans made before the portfolio existed (no property). */
const visiblePlansOf = memoLast((plans: TwinState["customPlans"], propertyId: string | null) =>
  plans.filter((p) => !p.propertyId || p.propertyId === propertyId),
);
export const selectVisibleCustomPlans = (s: TwinState) => visiblePlansOf(s.customPlans, s.activePropertyId);

// ---- Hotel portfolio (Phase 13) ----

let lastItems: { property: PortfolioProperty; input: HotelInput }[] = [];
/** Each property with its current input: the open one's live input, the others' saved or original input. Stable while unchanged. */
export function selectPortfolioItems(s: TwinState): { property: PortfolioProperty; input: HotelInput }[] {
  const f = s.portfolioFilter;
  const shown = s.portfolio.properties.filter(
    (p) => (!f.brand || p.brand === f.brand) && (!f.region || p.region === f.region) && (!f.ownership || p.ownership === f.ownership),
  );
  const next = shown.map((property) => ({
    property,
    // Unopened hotels carry their saved equipment corrections too (docs/20), so portfolio totals match each hotel's own view.
    input: property.id === s.activePropertyId ? s.hotelInput : (s.propertyStates[property.id]?.hotelInput ?? withEquipment(property, s.equipmentByProperty?.[property.id])),
  }));
  const same = next.length === lastItems.length && next.every((x, i) => x.property === lastItems[i]!.property && x.input === lastItems[i]!.input);
  if (!same) lastItems = next;
  return lastItems;
}
const summaryOf = memoLast((items: { property: PortfolioProperty; input: HotelInput }[], discountRate: number) =>
  portfolioSummary(items, { discountRate }),
);
export const selectPortfolioSummary = (s: TwinState): PortfolioSummary => summaryOf(selectPortfolioItems(s), s.hotelDiscountRate);
export const selectActiveProperty = (s: TwinState): PortfolioProperty | null =>
  selectAllProperties(s).find((p) => p.id === s.activePropertyId) ?? null;

/** Per-plan memo: re-evaluates a plan only when its items, the context, the budget or the discount rate change. */
const planEvalCache = new Map<string, { items: unknown; ctx: unknown; budget: number; rate: number; result: PlanEvaluation }>();
export function selectCustomPlanEvaluation(s: TwinState, planId?: string): PlanEvaluation | null {
  const plan = planId ? s.customPlans.find((p) => p.id === planId) : selectActiveCustomPlan(s);
  if (!plan) return null;
  const ctx = selectPlanContext(s);
  const budget = s.hotel.profile.budget;
  const rate = s.hotelDiscountRate;
  const hit = planEvalCache.get(plan.id);
  if (hit && hit.items === plan.items && hit.ctx === ctx && hit.budget === budget && hit.rate === rate) return hit.result;
  const result = evaluatePlan(ctx, plan.items, { budget, assumptions: { discountRate: rate } });
  planEvalCache.set(plan.id, { items: plan.items, ctx, budget, rate, result });
  return result;
}

const explainOf = memoLast((ctx: ReturnType<typeof contextFromBaseline>, plan: PortfolioResult, pkg: RankedPackage) => explainPlan(ctx, plan, pkg));
/** Why the optimizer chose a package (deterministic lines from the numbers). */
export function selectPlanExplanation(s: TwinState, packageId?: string): string[] {
  const plan = s.hotelPlan;
  if (!plan) return [];
  const all = [...plan.packages, ...(plan.objectiveWinner ? [plan.objectiveWinner] : [])];
  const pkg = (packageId ? all.find((p) => p.evaluation.id === packageId) : null) ?? plan.objectiveWinner ?? plan.packages[0];
  if (!pkg) return [];
  // Explain against the context the plan was measured against (scenario or baseline).
  const ctx = planContextOf(s.hotel, s.hotelPlanBaseline ?? s.baseline);
  return explainOf(ctx, plan, pkg);
}

// ---- Stress tests ----

/** Which plan a stress test evaluates: chosen explicitly, or automatically (the applied AI package, else the active custom plan, else the AI's pick). */
export type StressPlanChoice = { kind: "auto" } | { kind: "ai"; role: string } | { kind: "custom"; id: string } | { kind: "none" };

export function stressPlanInput(s: TwinState, choice: StressPlanChoice = { kind: "auto" }): StressPlanInput | null {
  // The plan the user had before the stress test (the optimizer may have re-run under a persistent change).
  const base = s.planBeforeStress ?? s.hotelPlan;
  const pkgs = base ? [...base.packages, ...(base.objectiveWinner ? [base.objectiveWinner] : [])] : [];
  const fromPkg = (pkg: RankedPackage | undefined): StressPlanInput | null =>
    pkg ? { label: `AI · ${pkg.roleLabel}`, source: "ai", ids: pkg.evaluation.upgradeIds } : null;
  const fromCustom = (id: string | null): StressPlanInput | null => {
    const plan = s.customPlans.find((p) => p.id === id);
    if (!plan || !plan.items.length) return null;
    const a = planAmounts(selectPlanContext(s), plan.items);
    return { label: plan.name, source: "custom", ids: a.ids, amounts: a.amounts };
  };
  if (choice.kind === "none") return null;
  if (choice.kind === "ai") return fromPkg(pkgs.find((p) => p.role === choice.role));
  if (choice.kind === "custom") return fromCustom(choice.id);
  const applied = pkgs.find((p) => p.evaluation.id === s.activeHotelPackageId);
  return fromPkg(applied) ?? fromCustom(s.activeCustomPlanId) ?? fromPkg(base?.objectiveWinner ?? pkgs[0]);
}

const stressCache = new Map<string, { deps: unknown[]; result: StressReport }>();
/** The active stress test against the normal year (the user's what-if without the stress), with the chosen plan. Null when no test is active. */
export function selectStressReport(s: TwinState, choice: StressPlanChoice = { kind: "auto" }): StressReport | null {
  const test = STRESS_TESTS.find((t) => t.id === s.activeStressTest);
  if (!test) return null;
  const plan = stressPlanInput(s, choice);
  const key = JSON.stringify(choice);
  const deps = [s.hotel, s.scenario, test, JSON.stringify(plan ? { ...plan, amounts: plan.amounts ?? null } : null), s.hotel.profile.budget, s.hotel.profile.objective, s.hotelDiscountRate];
  const hit = stressCache.get(key);
  if (hit && hit.deps.every((d, i) => Object.is(d, deps[i]))) return hit.result;
  const result = stressTestReport(s.hotel, test, s.scenario, effectiveScenario(s.scenario, test.id), plan, {
    budget: s.hotel.profile.budget,
    objective: s.hotel.profile.objective,
    discountRate: s.hotelDiscountRate,
    recommend: false, // computed separately (selectStressRecommendation), so the panel appears at once
  });
  stressCache.set(key, { deps, result });
  return result;
}

const recCache: { deps: unknown[]; result: StressReport["recommendation"] } = { deps: [], result: null };
/** For a persistent stress test: does the optimizer's pick change? Slow (two optimizer runs); call it after the panel has rendered. */
export function computeStressRecommendation(s: TwinState): StressReport["recommendation"] {
  const test = STRESS_TESTS.find((t) => t.id === s.activeStressTest);
  if (!test || test.duration !== "persistent") return null;
  const deps = [s.hotel, s.scenario, test, s.hotel.profile.budget, s.hotel.profile.objective, s.hotelDiscountRate];
  if (recCache.deps.length && recCache.deps.every((d, i) => Object.is(d, deps[i]))) return recCache.result;
  const result = stressRecommendation(s.hotel, s.scenario, effectiveScenario(s.scenario, test.id), {
    budget: s.hotel.profile.budget,
    objective: s.hotel.profile.objective,
    discountRate: s.hotelDiscountRate,
  });
  recCache.deps = deps;
  recCache.result = result;
  return result;
}

/** The custom plan used for each property in "my portfolio": the chosen one, else the latest plan made for that property. */
const choiceOf = memoLast((properties: PortfolioProperty[], plans: TwinState["customPlans"], ids: Record<string, string | null>) => {
  const out: Record<string, TwinState["customPlans"][number] | null> = {};
  for (const p of properties) {
    const own = plans.filter((x) => x.propertyId === p.id);
    if (p.id in ids) {
      const id = ids[p.id];
      const chosen = id === null ? null : plans.find((x) => x.id === id && (!x.propertyId || x.propertyId === p.id));
      out[p.id] = chosen === undefined ? (own[own.length - 1] ?? null) : chosen;
    } else out[p.id] = own[own.length - 1] ?? null;
  }
  return out;
});
export const selectPortfolioPlanChoice = (s: TwinState) => choiceOf(s.portfolio.properties, s.customPlans, s.portfolioCustomPlanIds);

/** Plans a property can use in "my portfolio": its own plus plans made before the portfolio existed. */
export const plansForProperty = (s: TwinState, propertyId: string) => s.customPlans.filter((p) => !p.propertyId || p.propertyId === propertyId);

const customEvalOf = memoLast(
  (items: { property: PortfolioProperty; input: HotelInput }[], choice: ReturnType<typeof selectPortfolioPlanChoice>, budget: number, discountRate: number): PortfolioCustomEvaluation =>
    evaluatePortfolioCustomPlan(
      items.map((x) => ({ ...x, plan: choice[x.property.id] ?? null })),
      { budget, discountRate },
    ),
);
export const selectPortfolioCustomEvaluation = (s: TwinState): PortfolioCustomEvaluation =>
  customEvalOf(selectPortfolioItems(s), selectPortfolioPlanChoice(s), s.portfolioBudget, s.hotelDiscountRate);

function stressPlans(
  choice: TwinState["portfolioStressPlan"],
  ai: PortfolioPlan | null,
  mine: PortfolioCustomEvaluation,
): Record<string, StressPlanInput | null> {
  const out: Record<string, StressPlanInput | null> = {};
  if (choice === "ai" && ai)
    for (const a of ai.allocations) out[a.propertyId] = a.candidate ? { label: "AI portfolio", source: "ai", ids: a.candidate.upgradeIds } : null;
  if (choice === "mine")
    for (const r of mine.rows) {
      const e = r.plan;
      out[r.propertyId] = e?.evaluation ? { label: r.planName ?? "My plan", source: "custom", ids: e.ids, amounts: e.amounts } : null;
    }
  return out;
}
const portfolioStressOf = memoLast(
  (
    items: { property: PortfolioProperty; input: HotelInput }[],
    testId: StressTest["id"] | null,
    scope: string[],
    choice: TwinState["portfolioStressPlan"],
    ai: PortfolioPlan | null,
    mine: PortfolioCustomEvaluation,
    discountRate: number,
  ): PortfolioStressReport | null => {
    const test = STRESS_TESTS.find((t) => t.id === testId);
    if (!test) return null;
    const plans = stressPlans(choice, ai, mine);
    return portfolioStressReport(items.map((x) => ({ ...x, plan: plans[x.property.id] ?? null })), test, scope, { discountRate });
  },
);
/** Null when no portfolio stress test is chosen. With "AI portfolio" and no optimizer run yet, the hotels are tested without plans. */
export const selectPortfolioStressReport = (s: TwinState): PortfolioStressReport | null =>
  portfolioStressOf(
    selectPortfolioItems(s),
    s.portfolioStressTestId,
    s.portfolioStressScope,
    s.portfolioStressPlan,
    s.portfolioPlan,
    selectPortfolioCustomEvaluation(s),
    s.hotelDiscountRate,
  );

// ---- Energy insights and scenario impact (Phase 14A) ----

const peerEui = new WeakMap<HotelInput, number>();
/** Modeled site energy intensity of a portfolio hotel (baseline only, cached per input; no optimizer run). */
function euiOf(input: HotelInput): number {
  const hit = peerEui.get(input);
  if (hit !== undefined) return hit;
  const r = resolveProfile(input);
  const b = calculateBaselineEnergy(r);
  const v = r.profile.floorAreaSqft > 0 ? b.annual.siteKBtu / r.profile.floorAreaSqft : 0;
  peerEui.set(input, v);
  return v;
}

const insightsOf = memoLast(
  (hotel: ResolvedProfile, baseline: EnergyResult, discountRate: number, peers: { name: string; siteEui: number }[], portfolioName: string): EnergyInsight[] => {
    const comparison = compareUpgrades(prepareUpgradeContext(hotel, undefined, baseline), { assumptions: { discountRate } });
    return energyInsights({ hotel, baseline, comparison, peers, portfolioName });
  },
);
let lastPeers: { name: string; siteEui: number }[] = [];
/** The other hotels in the open portfolio (all of them, whatever the filter), with their modeled intensity. */
function selectInsightPeers(s: TwinState): { name: string; siteEui: number }[] {
  const own = s.activePropertyId ?? s.portfolio.properties.find((p) => p.presetId && p.presetId === s.hotelPresetId)?.id ?? null;
  const next = s.portfolio.properties
    .filter((p) => p.id !== own)
    .map((p) => ({ name: p.input.name ?? p.id, siteEui: euiOf(s.propertyStates[p.id]?.hotelInput ?? p.input) }));
  const same = next.length === lastPeers.length && next.every((x, i) => x.name === lastPeers[i]!.name && x.siteEui === lastPeers[i]!.siteEui);
  if (!same) lastPeers = next;
  return lastPeers;
}
/** 3 to 5 prioritized findings for the open hotel, from its baseline (not the what-if), the upgrade comparison and scenario runs. */
export const selectEnergyInsights = (s: TwinState): EnergyInsight[] =>
  insightsOf(s.hotel, s.baseline, s.hotelDiscountRate, selectInsightPeers(s), s.portfolio.name);

const impactOf = memoLast((before: Totals, after: Totals) => impactSummary(before, after));
/** Reference (baseline) vs the active what-if or stress test; null when none is active. */
export const selectScenarioImpact = (s: TwinState): ImpactLine[] | null =>
  s.scenarioResult ? impactOf(s.scenarioResult.before.annual, s.scenarioResult.after.annual) : null;
