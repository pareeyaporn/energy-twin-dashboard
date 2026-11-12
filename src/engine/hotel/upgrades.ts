import { calculateBaselineEnergy, simulate, sumCells } from './baseline';
import { applyScenario, comfortFlags } from './conditions';
import { simulateEnergyScenario } from './scenarios';
import { DAYS_IN_MONTH, KBTU_PER_KWH, KBTU_PER_THERM, LOAD_TYPES, UPGRADE_ORDER, isSolar } from './constants';
import { hotelData } from './data';
import { isResolved, resolveProfile } from './profile';
import { climateLatitude, climateSolar, daylightShape, exportCreditPerKWh, solarYield } from './solar';
import type {
  Cell,
  ComfortFlag,
  EnergyResult,
  HotelData,
  HotelInput,
  HotelProfile,
  LoadType,
  PackageComfort,
  PlanAmounts,
  ResolvedProfile,
  SavingsScenario,
  Scenario,
  UpgradeDef,
  UpgradeId,
  UpgradeOutcome,
  UpgradeSizing,
} from './types';

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

export function upgradeDef(id: UpgradeId, data: HotelData = hotelData): UpgradeDef {
  const def = data.upgrades.upgrades.find((u) => u.id === id);
  if (!def) throw new Error(`No upgrade "${id}" in upgrades.json`);
  return def;
}

function param(def: UpgradeDef, key: string, sc: SavingsScenario): number {
  const r = def.params[key];
  if (!r) throw new Error(`Upgrade ${def.id} is missing parameter "${key}"`);
  return r[sc];
}
const constant = (def: UpgradeDef, key: string): number => {
  const v = def.constants[key];
  if (v === undefined) throw new Error(`Upgrade ${def.id} is missing constant "${key}"`);
  return v;
};

/** Roof area (one floor's footprint) and the common-area floor area, from the profile. */
export function areasOf(p: HotelProfile, data: HotelData = hotelData) {
  const e = data.equipment;
  return {
    roofSqft: p.floorAreaSqft / p.floors,
    commonSqft: p.floorAreaSqft * (e.publicAreaShareOfFloorArea + e.corridorShareOfFloorArea),
  };
}

/**
 * Solar array size: what the usable roof holds, but never more than would produce the hotel's yearly electricity use (at the
 * location's mid output). Independent of the savings scenario.
 */
export function solarSizeKw(p: HotelProfile, baselineElecKWh: number, data: HotelData = hotelData, id: UpgradeId = 'rooftop_solar'): number {
  const def = upgradeDef(id, data);
  const fraction = def.constants['roofFraction'] ?? 1;
  const roofCap = (areasOf(p, data).roofSqft * constant(def, 'usableRoofShare') * fraction) / constant(def, 'sqftPerKw');
  const yieldMid = solarYield(p, 'mid', data);
  const useCap = yieldMid > 0 ? (constant(def, 'maxShareOfElectricity') * baselineElecKWh) / yieldMid : 0;
  return Math.round(Math.max(0, Math.min(roofCap, useCap)) * 10) / 10;
}

function hourWeights(data: HotelData): Record<string, number[]> {
  const out: Record<string, number[]> = {};
  for (const [u, raw] of Object.entries(data.shapes.hourly)) {
    const sum = raw.reduce((a, b) => a + b, 0);
    out[u] = raw.map((x) => (sum > 0 ? x / sum : 1 / 24));
  }
  return out;
}

/** Which upgrades make sense for this hotel. */
export function eligibleUpgrades(p: HotelProfile, baselineElecKWh = 1, data: HotelData = hotelData): UpgradeId[] {
  return UPGRADE_ORDER.filter((id) => {
    if (id === 'smart_room_controls') return !p.smartRoomControls;
    if (isSolar(id)) return solarSizeKw(p, baselineElecKWh, data, id) > 0;
    return true;
  });
}

/** Problems with a set of upgrades: unknown ids, missing requirements, exclusions, ineligible items. Empty means fine. */
export function validateUpgradeSet(
  ids: readonly UpgradeId[],
  p: HotelProfile,
  baselineElecKWh: number,
  data: HotelData = hotelData,
): string[] {
  const errors: string[] = [];
  const eligible = new Set(eligibleUpgrades(p, baselineElecKWh, data));
  for (const id of ids) {
    if (!UPGRADE_ORDER.includes(id)) {
      errors.push(`Unknown upgrade "${id}".`);
      continue;
    }
    const def = upgradeDef(id, data);
    if (!eligible.has(id)) errors.push(`${def.label} does not apply to this hotel.`);
    for (const r of def.requires) if (!ids.includes(r)) errors.push(`${def.label} needs ${upgradeDef(r, data).label}.`);
    for (const x of def.excludes) if (ids.includes(x)) errors.push(`${def.label} cannot be combined with ${upgradeDef(x, data).label}.`);
  }
  return errors;
}

/** Dedupe, sort into the fixed application order, and reject unknown ids. */
export function orderUpgrades(ids: readonly UpgradeId[]): UpgradeId[] {
  for (const id of ids) if (!UPGRADE_ORDER.includes(id)) throw new Error(`Unknown upgrade "${id}".`);
  return UPGRADE_ORDER.filter((id) => ids.includes(id));
}

/** Everything that does not depend on the chosen upgrades, computed once and reused across combinations. */
export interface UpgradeContext {
  profile: HotelProfile;
  baseline: EnergyResult;
  data: HotelData;
  smartCellsCache: Partial<Record<SavingsScenario, Cell[]>>;
}

export function prepareUpgradeContext(
  input: HotelInput | ResolvedProfile,
  data: HotelData = hotelData,
  baseline?: EnergyResult,
): UpgradeContext {
  const resolved = isResolved(input) ? input : resolveProfile(input, data);
  return { profile: resolved.profile, baseline: baseline ?? calculateBaselineEnergy(resolved, data), data, smartCellsCache: {} };
}

/**
 * A context whose baseline is the hotel under a what-if (for example electricity +20% or 85% occupancy), so upgrade savings,
 * payback and the optimizer are all measured against that situation. If the scenario already turns smart room controls on,
 * that upgrade no longer applies.
 */
export function prepareScenarioContext(
  input: HotelInput | ResolvedProfile,
  scenario: Scenario,
  data: HotelData = hotelData,
): UpgradeContext {
  const resolved = isResolved(input) ? input : resolveProfile(input, data);
  return contextFromBaseline(resolved, simulateEnergyScenario(resolved, scenario, data).after, data);
}

/** A context for a baseline you already have (for example a what-if's `after`). Smart room controls already on there no longer apply. */
export function contextFromBaseline(
  input: HotelInput | ResolvedProfile,
  baseline: EnergyResult,
  data: HotelData = hotelData,
): UpgradeContext {
  const resolved = isResolved(input) ? input : resolveProfile(input, data);
  const profile: HotelProfile = { ...resolved.profile, smartRoomControls: baseline.conditions.smartRoomControls };
  return { profile, baseline, data, smartCellsCache: {} };
}

export function isContext(x: HotelInput | ResolvedProfile | UpgradeContext): x is UpgradeContext {
  return typeof x === 'object' && x !== null && 'baseline' in x && 'smartCellsCache' in x;
}

const cloneCell = (c: Cell): Cell => ({ ...c, loadKBtu: { ...c.loadKBtu } });

/** With smart room controls, vacant and away rooms are set back: re-run the simulation with those setpoints. */
function smartControlCells(ctx: UpgradeContext, sc: SavingsScenario): { cells: Cell[]; flags: ComfortFlag[] } {
  const def = upgradeDef('smart_room_controls', ctx.data);
  const setback = param(def, 'setbackF', sc);
  const base = ctx.baseline.conditions;
  const lim = ctx.data.defaults.vacantLimits;
  const cond = applyScenario(
    ctx.profile,
    base,
    {
      smartRoomControls: true,
      setpoints: {
        vacantHeatF: Math.max(lim.minHeatF, base.setpoints.occupiedHeatF - setback),
        vacantCoolF: Math.min(lim.maxCoolF, base.setpoints.occupiedCoolF + setback),
      },
    },
    ctx.data,
  );
  let cells = ctx.smartCellsCache[sc];
  if (!cells) {
    cells = simulate(ctx.profile, cond, ctx.data, ctx.baseline.calibration).cells;
    ctx.smartCellsCache[sc] = cells;
  }
  return { cells, flags: comfortFlags(cond, ctx.data) };
}

/** Cells between two simulations: `a` + share × (`b` − `a`), energy and load kinds alike (both runs have the same cell order). */
function blendCells(a: Cell[], b: Cell[], share: number, env: Env): Cell[] {
  if (share >= 1) return b.map(cloneCell);
  if (share <= 0) return a.map(cloneCell);
  return a.map((x, i) => {
    const y = b[i];
    const c = cloneCell(x);
    if (!y || y.zone !== x.zone || y.endUse !== x.endUse || y.month !== x.month) return c;
    for (const lt of LOAD_TYPES) c.loadKBtu[lt] = x.loadKBtu[lt] + share * (y.loadKBtu[lt] - x.loadKBtu[lt]);
    setEnergy(c, x.elecKWh + share * (y.elecKWh - x.elecKWh), x.gasTherms + share * (y.gasTherms - x.gasTherms), env);
    return c;
  });
}

interface Env {
  elecRate: number;
  gasRate: number;
  efElec: number;
  efGas: number;
}

function setEnergy(c: Cell, elecKWh: number, gasTherms: number, env: Env): void {
  c.elecKWh = elecKWh;
  c.gasTherms = gasTherms;
  c.siteKBtu = elecKWh * KBTU_PER_KWH + gasTherms * KBTU_PER_THERM;
  c.elecCost = elecKWh * env.elecRate;
  c.gasCost = gasTherms * env.gasRate;
  c.cost = c.elecCost + c.gasCost;
  c.carbonKg = elecKWh * env.efElec + gasTherms * env.efGas;
}

/** Scale the matching cells' load kinds (one factor for all, or a factor per kind). Fuel mix stays the same. */
function rescale(
  cells: Cell[],
  match: (c: Cell) => boolean,
  factor: number | Partial<Record<LoadType, number>>,
  env: Env,
): void {
  for (const c of cells) {
    if (!match(c) || c.siteKBtu <= 0) continue;
    const elecFrac = (c.elecKWh * KBTU_PER_KWH) / c.siteKBtu;
    const gasFrac = (c.gasTherms * KBTU_PER_THERM) / c.siteKBtu;
    let site = 0;
    for (const lt of LOAD_TYPES) {
      const k = typeof factor === 'number' ? factor : (factor[lt] ?? 1);
      c.loadKBtu[lt] *= k;
      site += c.loadKBtu[lt];
    }
    setEnergy(c, (site * elecFrac) / KBTU_PER_KWH, (site * gasFrac) / KBTU_PER_THERM, env);
  }
}

const siteOf = (cells: Cell[], match: (c: Cell) => boolean) =>
  cells.reduce((s, c) => (match(c) ? s + c.siteKBtu : s), 0);

/** Less lighting heat: cooling falls and heating rises, in proportion to the lighting energy saved. */
/**
 * Less lighting heat lowers cooling and raises heating (IL-TRM waste-heat and interaction factors). `saved` is the lighting energy
 * saved in guest rooms and in all other spaces (site kBtu); factors depend on the space and on how the hotel is heated.
 */
function lightingInteraction(cells: Cell[], saved: { guest: number; common: number }, ctx: UpgradeContext, env: Env): void {
  const k = ctx.data.upgrades.interaction;
  const kind = k.heatingKindByHvac[ctx.profile.hvacType] ?? 'gas';
  const coolSaved = Math.max(0, saved.guest) * k.guest.coolingPerSavedKBtu + Math.max(0, saved.common) * k.common.coolingPerSavedKBtu;
  const heatAdded = Math.max(0, saved.guest) * k.guest.heatingPerSavedKBtu[kind] + Math.max(0, saved.common) * k.common.heatingPerSavedKBtu[kind];
  if (coolSaved <= 0 && heatAdded <= 0) return;
  const isCool = (c: Cell) => c.endUse === 'cooling';
  const isHeat = (c: Cell) => c.endUse === 'heating';
  const cool = siteOf(cells, isCool);
  const heat = siteOf(cells, isHeat);
  if (cool > 0) rescale(cells, isCool, 1 - Math.min(0.9, coolSaved / cool), env);
  if (heat > 0) rescale(cells, isHeat, 1 + heatAdded / heat, env);
}

/** Lighting energy (site kBtu) in guest rooms and in all other spaces. */
function lightingBySpace(cells: Cell[]): { guest: number; common: number } {
  const guest = siteOf(cells, (c) => c.endUse === 'lighting' && c.zone === 'guest_rooms');
  return { guest, common: siteOf(cells, (c) => c.endUse === 'lighting') - guest };
}
const savedBetween = (a: { guest: number; common: number }, b: { guest: number; common: number }) => ({ guest: a.guest - b.guest, common: a.common - b.common });

const isHvac = (c: Cell) => c.endUse === 'heating' || c.endUse === 'cooling' || c.endUse === 'ventilation';
const weatherKBtu = (cells: Cell[]) =>
  cells.reduce((s, c) => (c.endUse === 'heating' || c.endUse === 'cooling' ? s + c.loadKBtu.weather : s), 0);

/**
 * Savings from a set of upgrades, recomputed from the hotel's own loads in a fixed order (envelope, lighting, controls,
 * equipment, water heating, solar last). Savings are never added as percentages, so overlapping upgrades do not double count.
 */
export function calculateUpgradeSavings(
  input: HotelInput | ResolvedProfile | UpgradeContext,
  upgradeIds: readonly UpgradeId[],
  scenario: SavingsScenario = 'mid',
  data: HotelData = hotelData,
  options: { skipValidation?: boolean; amounts?: PlanAmounts } = {},
): UpgradeOutcome {
  const ctx = isContext(input) ? input : prepareUpgradeContext(input, data);
  const d = ctx.data;
  const ids = orderUpgrades(upgradeIds);
  if (!options.skipValidation) {
    const errors = validateUpgradeSet(ids, ctx.profile, ctx.baseline.annual.elecKWh, d);
    if (errors.length) throw new Error(errors.join(' '));
  }
  const has = (id: UpgradeId) => ids.includes(id);
  // Share of each upgrade's scope that is installed (1 = the whole hotel, as the optimizer uses).
  const cov = (id: UpgradeId) => clamp(options.amounts?.coverage?.[id] ?? 1, 0, 1);
  const env: Env = {
    elecRate: ctx.baseline.rates.elecPerKWh,
    gasRate: ctx.baseline.rates.gasPerTherm,
    efElec: ctx.baseline.emissionFactors.elecKgPerKWh,
    efGas: ctx.baseline.emissionFactors.gasKgPerTherm,
  };

  const smart = has('smart_room_controls') ? smartControlCells(ctx, scenario) : null;
  // Smart controls in only some rooms: rooms are modeled alike, so blend the baseline and the set-back simulation by the share of rooms.
  const cells = smart ? blendCells(ctx.baseline.cells, smart.cells, cov('smart_room_controls'), env) : ctx.baseline.cells.map(cloneCell);
  let hvacSizeFactor = 1;
  let solarKw = 0;
  let solarId: UpgradeId | null = null;
  let solarOffsetKWh = 0;
  let solarGenerationKWh = 0;
  let solarExportKWh = 0;
  let exportCredit = 0;

  for (const id of ids) {
    const def = upgradeDef(id, d);
    switch (id) {
      case 'insulation': {
        // The reduction is for a low-rise building; on a taller one the roof is a smaller part of the envelope, so it scales down.
        const refFloors = constant(def, 'referenceFloors');
        const r = param(def, 'weatherLoadReduction', scenario) * Math.min(1, refFloors / Math.max(1, ctx.profile.floors)) * cov(id);
        rescale(cells, (c) => c.endUse === 'heating' || c.endUse === 'cooling', { weather: 1 - r }, env);
        break;
      }
      case 'led_lighting': {
        const before = lightingBySpace(cells);
        rescale(cells, (c) => c.endUse === 'lighting', 1 - param(def, 'lightingReduction', scenario) * cov(id), env);
        lightingInteraction(cells, savedBetween(before, lightingBySpace(cells)), ctx, env);
        break;
      }
      case 'occupancy_sensors': {
        const common = (c: Cell) => c.zone === 'lobby_common' || c.zone === 'hallways_shared';
        const before = lightingBySpace(cells);
        rescale(cells, (c) => common(c) && c.endUse === 'lighting', 1 - param(def, 'commonLightingReduction', scenario) * cov(id), env);
        rescale(cells, (c) => common(c) && c.endUse === 'ventilation', 1 - param(def, 'commonVentilationReduction', scenario) * cov(id), env);
        lightingInteraction(cells, savedBetween(before, lightingBySpace(cells)), ctx, env);
        break;
      }
      case 'smart_room_controls':
        break; // already applied through the setpoints
      case 'energy_management': {
        const e = param(def, 'hvacReduction', scenario);
        // Without smart room controls the system also reaches guest rooms; with them the two overlap, so no extra guest-room savings.
        const guestShare = has('smart_room_controls') ? 0 : constant(def, 'guestRoomShareWithoutSmartControls');
        rescale(cells, (c) => isHvac(c) && c.zone !== 'guest_rooms' && c.zone !== 'kitchen_restaurant', 1 - e, env);
        rescale(cells, (c) => isHvac(c) && c.zone === 'guest_rooms', 1 - e * guestShare, env);
        break;
      }
      case 'hvac_upgrade': {
        const baseWeather = weatherKBtu(ctx.baseline.cells);
        hvacSizeFactor = baseWeather > 0 ? clamp(weatherKBtu(cells) / baseWeather, 0.6, 1) : 1;
        rescale(cells, (c) => c.endUse === 'heating', 1 - param(def, 'heatingReduction', scenario), env);
        rescale(cells, (c) => c.endUse === 'cooling', 1 - param(def, 'coolingReduction', scenario), env);
        break;
      }
      case 'water_heating':
        rescale(cells, (c) => c.endUse === 'hotWater', 1 - param(def, 'hotWaterReduction', scenario), env);
        break;
      case 'rooftop_solar_quarter':
      case 'rooftop_solar_half':
      case 'rooftop_solar': {
        // Generation from the location's solar data; each hour of a typical day the hotel uses what it can (its load after the
        // other upgrades) and the rest is exported at the region's export credit.
        // A custom plan may choose any size up to what the full usable roof holds (and never more than the hotel uses).
        const maxKw = solarSizeKw(ctx.profile, ctx.baseline.annual.elecKWh, d, 'rooftop_solar');
        solarKw =
          options.amounts?.solarKw !== undefined
            ? Math.round(clamp(options.amounts.solarKw, 0, maxKw) * 10) / 10
            : solarSizeKw(ctx.profile, ctx.baseline.annual.elecKWh, d, id);
        solarId = id;
        const sol = climateSolar(ctx.profile, d);
        const yieldKwh = solarYield(ctx.profile, scenario, d);
        const lat = climateLatitude(ctx.profile, d);
        const weights = hourWeights(d);
        for (let m = 0; m < 12; m++) {
          const monthCells = cells.filter((c) => c.month === m);
          const use = monthCells.reduce((s, c) => s + c.elecKWh, 0);
          const days = DAYS_IN_MONTH[m] ?? 30;
          const produced = solarKw * yieldKwh * (sol.monthlyShare[m] ?? 0);
          solarGenerationKWh += produced;
          if (use <= 0) {
            solarExportKWh += produced;
            continue;
          }
          const sun = daylightShape(lat, m);
          let selfDay = 0;
          for (let h = 0; h < 24; h++) {
            const gen = (produced / days) * (sun[h] ?? 0);
            const load = monthCells.reduce((s2, c) => s2 + (c.elecKWh / days) * (weights[c.endUse]?.[h] ?? 1 / 24), 0);
            selfDay += Math.min(gen, load);
          }
          const self = Math.min(use, selfDay * days);
          solarOffsetKWh += self;
          const exported = produced - self;
          if (exported > 1e-6) solarExportKWh += exported; // ignore floating-point dust
          const f = 1 - self / use;
          for (const c of monthCells) {
            const oldSite = c.siteKBtu;
            setEnergy(c, c.elecKWh * f, c.gasTherms, env);
            const k = oldSite > 0 ? c.siteKBtu / oldSite : 0;
            for (const lt of LOAD_TYPES) c.loadKBtu[lt] *= k;
          }
        }
        break;
      }
    }
  }

  exportCredit = solarExportKWh * exportCreditPerKWhIf(solarId !== null, ctx, d);
  const solarOm = solarId && solarKw > 0 ? solarKw * constant(upgradeDef(solarId, d), 'omPerKwYear') : 0;
  const annual = sumCells(cells);
  // The export credit lowers the electricity bill without changing the hotel's own use; solar upkeep adds an operating cost.
  annual.elecCost -= exportCredit;
  annual.cost += solarOm - exportCredit;
  const b = ctx.baseline.annual;
  const savings = {
    elecKWh: b.elecKWh - annual.elecKWh,
    gasTherms: b.gasTherms - annual.gasTherms,
    siteKBtu: b.siteKBtu - annual.siteKBtu,
    elecCost: b.elecCost - annual.elecCost,
    gasCost: b.gasCost - annual.gasCost,
    cost: b.cost - annual.cost,
    carbonKg: b.carbonKg - annual.carbonKg,
  };
  const sizing: UpgradeSizing = {
    hvacSizeFactor,
    solarKw,
    solarKWhYear: solarOffsetKWh,
    solarGenerationKWhYear: solarGenerationKWh,
    solarExportKWhYear: solarExportKWh,
    // Solar is applied last, so its value is exactly the purchases it avoids at the rate, plus the export credit.
    solarValuePerYear: solarOffsetKWh * env.elecRate + exportCredit,
    solarOmPerYear: solarOm,
  };
  return { upgradeIds: ids, scenario, annual, savings, cells, sizing, comfort: comfortFor(ids, smart?.flags ?? [], d) };
}

function exportCreditPerKWhIf(on: boolean, ctx: UpgradeContext, d: HotelData): number {
  return on ? exportCreditPerKWh(ctx.profile, d) : 0;
}

/** Comfort impact of a package: each minor-impact upgrade and each warning flag lowers the score from 1. */
export function comfortFor(ids: readonly UpgradeId[], conditionFlags: ComfortFlag[] = [], data: HotelData = hotelData): PackageComfort {
  const k = data.upgrades.comfortScore;
  const notes: ComfortFlag[] = [];
  let score = 1;
  for (const id of ids) {
    const def = upgradeDef(id, data);
    if (def.comfort.impact === 'minor') {
      score -= k.minorPenalty;
      notes.push({ id: `upgrade:${id}`, severity: 'info', message: `${def.label}: ${def.comfort.note}` });
    } else if (def.comfort.impact === 'positive' && def.comfort.note) {
      notes.push({ id: `upgrade:${id}`, severity: 'info', message: `${def.label}: ${def.comfort.note}` });
    }
  }
  for (const f of conditionFlags) {
    notes.push(f);
    if (f.severity === 'warn') score -= k.flagPenalty;
  }
  return { score: clamp(score, 0, 1), notes };
}

