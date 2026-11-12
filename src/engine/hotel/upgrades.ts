import { calculateBaselineEnergy, simulate, sumCells } from './baseline';
import { applyScenario, comfortFlags } from './conditions';
import { simulateEnergyScenario } from './scenarios';
import { KBTU_PER_KWH, KBTU_PER_THERM, LOAD_TYPES, UPGRADE_ORDER } from './constants';
import { hotelData } from './data';
import { isResolved, resolveProfile } from './profile';
import type {
  Cell,
  ComfortFlag,
  EnergyResult,
  HotelData,
  HotelInput,
  HotelProfile,
  LoadType,
  PackageComfort,
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

/** Solar array size: the smaller of the usable roof and a target share of electricity use. Independent of the savings scenario. */
export function solarSizeKw(p: HotelProfile, baselineElecKWh: number, data: HotelData = hotelData): number {
  const def = upgradeDef('rooftop_solar', data);
  const roofCap = (areasOf(p, data).roofSqft * constant(def, 'usableRoofShare')) / constant(def, 'sqftPerKw');
  const yieldMid = param(def, 'kWhPerKwYear', 'mid');
  const target = (constant(def, 'targetShareOfElectricity') * baselineElecKWh) / yieldMid;
  return Math.round(Math.max(0, Math.min(roofCap, target)) * 10) / 10;
}

/** Which upgrades make sense for this hotel. */
export function eligibleUpgrades(p: HotelProfile, baselineElecKWh = 1, data: HotelData = hotelData): UpgradeId[] {
  return UPGRADE_ORDER.filter((id) => {
    if (id === 'smart_room_controls') return !p.smartRoomControls;
    if (id === 'rooftop_solar') return solarSizeKw(p, baselineElecKWh, data) > 0;
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
function lightingInteraction(cells: Cell[], savedKBtu: number, ctx: UpgradeContext, env: Env): void {
  if (savedKBtu <= 0) return;
  const k = ctx.data.upgrades.interaction;
  const isCool = (c: Cell) => c.endUse === 'cooling';
  const isHeat = (c: Cell) => c.endUse === 'heating';
  const cool = siteOf(cells, isCool);
  const heat = siteOf(cells, isHeat);
  if (cool > 0) rescale(cells, isCool, 1 - Math.min(0.9, (k.coolingOffsetPerSavedLightingKBtu * savedKBtu) / cool), env);
  if (heat > 0) rescale(cells, isHeat, 1 + (k.heatingPenaltyPerSavedLightingKBtu * savedKBtu) / heat, env);
}

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
  options: { skipValidation?: boolean } = {},
): UpgradeOutcome {
  const ctx = isContext(input) ? input : prepareUpgradeContext(input, data);
  const d = ctx.data;
  const ids = orderUpgrades(upgradeIds);
  if (!options.skipValidation) {
    const errors = validateUpgradeSet(ids, ctx.profile, ctx.baseline.annual.elecKWh, d);
    if (errors.length) throw new Error(errors.join(' '));
  }
  const has = (id: UpgradeId) => ids.includes(id);
  const env: Env = {
    elecRate: ctx.baseline.rates.elecPerKWh,
    gasRate: ctx.baseline.rates.gasPerTherm,
    efElec: ctx.baseline.emissionFactors.elecKgPerKWh,
    efGas: ctx.baseline.emissionFactors.gasKgPerTherm,
  };

  const smart = has('smart_room_controls') ? smartControlCells(ctx, scenario) : null;
  const cells = (smart ? smart.cells : ctx.baseline.cells).map(cloneCell);
  let hvacSizeFactor = 1;
  let solarKw = 0;
  let solarOffsetKWh = 0;

  for (const id of ids) {
    const def = upgradeDef(id, d);
    switch (id) {
      case 'insulation': {
        const r = param(def, 'weatherLoadReduction', scenario);
        rescale(cells, (c) => c.endUse === 'heating' || c.endUse === 'cooling', { weather: 1 - r }, env);
        break;
      }
      case 'led_lighting': {
        const before = siteOf(cells, (c) => c.endUse === 'lighting');
        rescale(cells, (c) => c.endUse === 'lighting', 1 - param(def, 'lightingReduction', scenario), env);
        lightingInteraction(cells, before - siteOf(cells, (c) => c.endUse === 'lighting'), ctx, env);
        break;
      }
      case 'occupancy_sensors': {
        const common = (c: Cell) => c.zone === 'lobby_common' || c.zone === 'hallways_shared';
        const before = siteOf(cells, (c) => common(c) && c.endUse === 'lighting');
        rescale(cells, (c) => common(c) && c.endUse === 'lighting', 1 - param(def, 'commonLightingReduction', scenario), env);
        rescale(cells, (c) => common(c) && c.endUse === 'ventilation', 1 - param(def, 'commonVentilationReduction', scenario), env);
        lightingInteraction(cells, before - siteOf(cells, (c) => common(c) && c.endUse === 'lighting'), ctx, env);
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
      case 'rooftop_solar': {
        solarKw = solarSizeKw(ctx.profile, ctx.baseline.annual.elecKWh, d);
        const yieldKwh = param(def, 'kWhPerKwYear', scenario);
        for (let m = 0; m < 12; m++) {
          const monthCells = cells.filter((c) => c.month === m);
          const use = monthCells.reduce((s, c) => s + c.elecKWh, 0);
          if (use <= 0) continue;
          const produced = solarKw * yieldKwh * (d.upgrades.solarMonthlyShape[m] ?? 0);
          const self = Math.min(produced, use); // no export credit: only what the hotel uses is offset
          solarOffsetKWh += self;
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

  const annual = sumCells(cells);
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
  const sizing: UpgradeSizing = { hvacSizeFactor, solarKw, solarKWhYear: solarOffsetKWh };
  return { upgradeIds: ids, scenario, annual, savings, cells, sizing, comfort: comfortFor(ids, smart?.flags ?? [], d) };
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

