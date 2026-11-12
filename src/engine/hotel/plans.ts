// Custom investment plans: the catalog of upgrades with quantity controls, converting quantities into the engine's amounts, and
// evaluating a plan with exactly the same function the optimizer uses (`evaluatePackage`). No separate calculation.
import { hotelData } from './data';
import { isSolar } from './constants';
import { evaluatePackage } from './package';
import type { EvaluateOptions } from './package';
import { compareUpgrades } from './comparison';
import { areasOf, eligibleUpgrades, solarSizeKw, upgradeDef, validateUpgradeSet } from './upgrades';
import type { UpgradeContext } from './upgrades';
import type {
  CatalogCategory,
  ExperimentalUpgrade,
  HotelData,
  PackageEvaluation,
  PlanAmounts,
  PortfolioResult,
  RankedPackage,
  UpgradeId,
} from './types';

export const CATALOG_CATEGORIES: { id: CatalogCategory; label: string }[] = [
  { id: 'hvac_controls', label: 'HVAC & Controls' },
  { id: 'lighting', label: 'Lighting' },
  { id: 'renewable', label: 'Renewable Energy' },
  { id: 'building_water', label: 'Building & Water' },
];

/** How a catalog item's quantity is entered. `whole` = the whole system, on or off. */
export type QuantityKind = 'rooms' | 'percent' | 'sqft_common' | 'sqft_roof' | 'kw' | 'whole';

export interface CatalogQuantity {
  kind: QuantityKind;
  unit: string;
  min: number;
  max: number;
  step: number;
  /** The default when added: the whole scope (or the full-roof array). */
  default: number;
  /** What the quantity covers, in plain words. */
  scope: string;
}

export interface CatalogItem {
  id: UpgradeId;
  label: string;
  description: string;
  category: CatalogCategory;
  quantity: CatalogQuantity;
  available: boolean;
  /** Why it cannot be added, when not available. */
  unavailableReason?: string;
  costStatus: 'sourced' | 'placeholder';
  lifetimeYears: number;
  comfort: { impact: 'none' | 'minor' | 'positive'; note: string };
  source: string;
}

export interface PlanItem {
  id: UpgradeId;
  /** In the item's unit (rooms, %, ft², kW); omitted = the default (whole scope). */
  quantity?: number;
}

/** Upgrades offered in the catalog. The quarter- and half-roof solar sizes are optimizer presets of the same array; the catalog has one solar item sized in kW. */
export const CATALOG_IDS: UpgradeId[] = [
  'smart_room_controls',
  'energy_management',
  'hvac_upgrade',
  'led_lighting',
  'occupancy_sensors',
  'rooftop_solar',
  'insulation',
  'water_heating',
];

function quantityFor(ctx: UpgradeContext, id: UpgradeId, d: HotelData): CatalogQuantity {
  const p = ctx.profile;
  const { roofSqft, commonSqft } = areasOf(p, d);
  switch (id) {
    case 'smart_room_controls':
      return { kind: 'rooms', unit: 'rooms', min: 1, max: p.rooms, step: 1, default: p.rooms, scope: `guest rooms with smart thermostats (of ${p.rooms})` };
    case 'led_lighting':
      return { kind: 'percent', unit: '%', min: 5, max: 100, step: 5, default: 100, scope: "of the hotel's lighting retrofitted to LED" };
    case 'occupancy_sensors':
      return { kind: 'sqft_common', unit: 'ft²', min: Math.round(commonSqft * 0.05), max: Math.round(commonSqft), step: 100, default: Math.round(commonSqft), scope: `of common areas and hallways with sensors (of ${Math.round(commonSqft).toLocaleString('en-US')} ft²)` };
    case 'insulation':
      return { kind: 'sqft_roof', unit: 'ft²', min: Math.round(roofSqft * 0.05), max: Math.round(roofSqft), step: 100, default: Math.round(roofSqft), scope: `of roof insulated (of ${Math.round(roofSqft).toLocaleString('en-US')} ft²)` };
    case 'rooftop_solar': {
      const max = solarSizeKw(p, ctx.baseline.annual.elecKWh, d, 'rooftop_solar');
      return { kind: 'kw', unit: 'kW', min: Math.min(1, max), max, step: 1, default: max, scope: `array size (the usable roof holds up to ${max.toLocaleString('en-US')} kW)` };
    }
    default:
      return { kind: 'whole', unit: '', min: 1, max: 1, step: 1, default: 1, scope: 'whole system' };
  }
}

/** The catalog for this hotel: every modeled upgrade with its quantity control, plus the upgrades that are not modeled yet. */
export function upgradeCatalog(ctx: UpgradeContext, data: HotelData = hotelData): { items: CatalogItem[]; experimental: ExperimentalUpgrade[] } {
  const d = ctx.data ?? data;
  const eligible = new Set(eligibleUpgrades(ctx.profile, ctx.baseline.annual.elecKWh, d));
  const items = CATALOG_IDS.map((id): CatalogItem => {
    const def = upgradeDef(id, d);
    const available = eligible.has(id);
    const item: CatalogItem = {
      id,
      label: id === 'rooftop_solar' ? 'Rooftop solar' : def.label,
      description: def.description,
      category: def.category ?? 'building_water',
      quantity: quantityFor(ctx, id, d),
      available,
      costStatus: def.costStatus ?? 'placeholder',
      lifetimeYears: def.lifetimeYears,
      comfort: def.comfort,
      source: def.source,
    };
    if (!available) {
      item.unavailableReason =
        id === 'smart_room_controls' ? 'This hotel already has smart room controls.' : isSolar(id) ? 'The roof cannot hold an array for this hotel.' : 'Does not apply to this hotel.';
    }
    return item;
  });
  return { items, experimental: d.upgrades.experimental ?? [] };
}

export type PlanWarningKind = 'budget' | 'conflict' | 'unavailable' | 'clamped' | 'overlap' | 'empty';

export interface PlanWarning {
  kind: PlanWarningKind;
  severity: 'info' | 'warn';
  message: string;
  upgradeId?: UpgradeId;
}

export interface PlanEvaluation {
  /** The plan's items after clamping to their limits, in catalog order. */
  items: Required<PlanItem>[];
  ids: UpgradeId[];
  amounts: PlanAmounts;
  /** Null for an empty plan. Otherwise exactly what `evaluatePackage` returns for these upgrades and amounts. */
  evaluation: PackageEvaluation | null;
  warnings: PlanWarning[];
  budget: number;
}

/** Quantities → the engine's amounts (coverage shares and the solar size), clamped to each item's limits. */
export function planAmounts(ctx: UpgradeContext, items: readonly PlanItem[], data: HotelData = hotelData): { items: Required<PlanItem>[]; ids: UpgradeId[]; amounts: PlanAmounts; clamped: UpgradeId[] } {
  const d = ctx.data ?? data;
  const coverage: Partial<Record<UpgradeId, number>> = {};
  const amounts: PlanAmounts = { coverage };
  const out: Required<PlanItem>[] = [];
  const clamped: UpgradeId[] = [];
  const seen = new Set<UpgradeId>();
  for (const id of CATALOG_IDS) {
    const it = items.find((x) => x.id === id);
    if (!it || seen.has(id)) continue;
    seen.add(id);
    const q = quantityFor(ctx, id, d);
    const raw = it.quantity ?? q.default;
    const v = q.kind === 'whole' ? 1 : Math.min(q.max, Math.max(q.min, Number.isFinite(raw) ? raw : q.default));
    if (q.kind !== 'whole' && Math.abs(v - raw) > 1e-9) clamped.push(id);
    out.push({ id, quantity: v });
    if (q.kind === 'kw') amounts.solarKw = v;
    else if (q.kind !== 'whole') coverage[id] = q.max > 0 ? v / q.max : 1;
  }
  return { items: out, ids: out.map((x) => x.id), amounts, clamped };
}

/**
 * Evaluates a custom plan with the optimizer's own function, recomputing the whole building model with all the plan's upgrades together
 * (never summing standalone savings), and lists what the user should know: over budget, conflicts, clamped quantities, overlaps.
 */
export function evaluatePlan(
  ctx: UpgradeContext,
  items: readonly PlanItem[],
  options: Omit<EvaluateOptions, 'amounts'> = {},
  data: HotelData = hotelData,
): PlanEvaluation {
  const d = ctx.data ?? data;
  const budget = options.budget ?? ctx.profile.budget;
  const warnings: PlanWarning[] = [];
  const eligible = new Set(eligibleUpgrades(ctx.profile, ctx.baseline.annual.elecKWh, d));
  const wanted = items.filter((x) => {
    if (!CATALOG_IDS.includes(x.id)) {
      warnings.push({ kind: 'unavailable', severity: 'warn', message: `${x.id} is not in the catalog.`, upgradeId: x.id });
      return false;
    }
    if (!eligible.has(x.id)) {
      warnings.push({ kind: 'unavailable', severity: 'warn', message: `${upgradeDef(x.id, d).label} does not apply to this hotel and was left out.`, upgradeId: x.id });
      return false;
    }
    return true;
  });
  const { items: clean, ids, amounts, clamped } = planAmounts(ctx, wanted, d);
  for (const id of clamped) warnings.push({ kind: 'clamped', severity: 'info', message: `${upgradeDef(id, d).label}: quantity limited to what this hotel can hold.`, upgradeId: id });
  for (const e of validateUpgradeSet(ids, ctx.profile, ctx.baseline.annual.elecKWh, d)) warnings.push({ kind: 'conflict', severity: 'warn', message: e });
  if (!ids.length) {
    warnings.push({ kind: 'empty', severity: 'info', message: 'Add upgrades from the catalog to build a plan.' });
    return { items: clean, ids, amounts, evaluation: null, warnings, budget };
  }
  if (warnings.some((w) => w.kind === 'conflict')) return { items: clean, ids, amounts, evaluation: null, warnings, budget };

  // Overlaps the model handles (so savings are counted once), stated so users know why a combination saves less than its parts.
  const has = (id: UpgradeId) => ids.includes(id);
  if (has('energy_management') && has('smart_room_controls'))
    warnings.push({ kind: 'overlap', severity: 'info', message: 'Energy management adds no extra guest-room savings where smart room controls already set rooms back (counted once).' });
  if (has('led_lighting') && has('occupancy_sensors'))
    warnings.push({ kind: 'overlap', severity: 'info', message: 'Occupancy sensors save on the lighting left after the LED retrofit (counted once).' });
  if (has('hvac_upgrade') && (has('insulation') || has('energy_management') || has('smart_room_controls')))
    warnings.push({ kind: 'overlap', severity: 'info', message: 'The new HVAC equipment is sized from the load left after the other upgrades.' });
  if (has('rooftop_solar') && ids.length > 1)
    warnings.push({ kind: 'overlap', severity: 'info', message: 'Solar is applied last: it offsets the electricity left after the other upgrades.' });
  if (has('led_lighting') || has('occupancy_sensors'))
    warnings.push({ kind: 'overlap', severity: 'info', message: 'Less lighting heat lowers cooling and raises heating; the plan includes that effect.' });

  const evaluation = evaluatePackage(ctx, ids, { ...options, budget, amounts }, d);
  if (evaluation.financials.grossCost.mid > budget)
    warnings.unshift({ kind: 'budget', severity: 'warn', message: `The plan's gross cost is over the ${fmtUsd(budget)} budget by ${fmtUsd(evaluation.financials.grossCost.mid - budget)}.` });
  else if (evaluation.financials.grossCost.high > budget)
    warnings.unshift({ kind: 'budget', severity: 'info', message: `The high-end cost estimate (${fmtUsd(evaluation.financials.grossCost.high)}) would exceed the budget.` });
  return { items: clean, ids, amounts, evaluation, warnings, budget };
}

/** One upgrade on its own at a given quantity (for its catalog card), with the same function. */
export function evaluatePlanItem(ctx: UpgradeContext, item: PlanItem, options: Omit<EvaluateOptions, 'amounts'> = {}, data: HotelData = hotelData): PackageEvaluation | null {
  return evaluatePlan(ctx, [item], { ...options, lineItems: false }, data).evaluation;
}

/** A recommended package as plan items: the whole scope of each upgrade, and solar at the package's own array size. */
export function planFromPackage(ctx: UpgradeContext, ids: readonly UpgradeId[], data: HotelData = hotelData): PlanItem[] {
  const d = ctx.data ?? data;
  return ids.map((id) =>
    isSolar(id) ? { id: 'rooftop_solar' as UpgradeId, quantity: solarSizeKw(ctx.profile, ctx.baseline.annual.elecKWh, d, id) } : { id },
  );
}

function fmtUsd(n: number): string {
  return `$${Math.round(n).toLocaleString('en-US')}`;
}

/**
 * Why the optimizer chose a package, from the numbers: what each upgrade adds inside the package, how much of the budget it uses, and
 * the best upgrades it left out with the reason (over budget, slower payback, comfort). Deterministic; the advisor can explain further.
 */
export function explainPlan(ctx: UpgradeContext, plan: PortfolioResult, pkg: RankedPackage, data: HotelData = hotelData): string[] {
  const d = ctx.data ?? data;
  const e = pkg.evaluation;
  const f = e.financials;
  const out: string[] = [];
  out.push(`Tested ${plan.combinationsTested.toLocaleString('en-US')} combinations; ${plan.feasibleCount.toLocaleString('en-US')} fit the ${fmtUsd(plan.budget)} budget and the comfort limit.`);
  out.push(pkg.reason);
  for (const li of e.lineItems) out.push(`${li.label}: ${fmtUsd(li.cost.mid)}, adds ${fmtUsd(li.annualSavingsMid)} a year in this package.`);
  const used = f.grossCost.mid;
  out.push(`Uses ${fmtUsd(used)} of the budget (${Math.round((used / Math.max(1, plan.budget)) * 100)}%), leaving ${fmtUsd(plan.budget - used)}.`);
  const rows = compareUpgrades(ctx, {}, d).filter((r) => !e.upgradeIds.includes(r.id) && r.financials.annualSavings.mid > 0);
  const left = rows
    .map((r) => {
      const cost = r.financials.grossCost.mid;
      const pb = r.financials.simplePaybackYears;
      const reason =
        cost > plan.budget
          ? `costs ${fmtUsd(cost)} on its own, more than the budget`
          : used + cost > plan.budget
            ? `would not fit in the remaining ${fmtUsd(plan.budget - used)} (${fmtUsd(cost)})`
            : pb !== null && f.simplePaybackYears !== null && pb > f.simplePaybackYears
              ? `pays back more slowly (${pb.toFixed(1)} years on its own)`
              : 'scored lower on this objective';
      return { label: r.label, value: r.financials.netBenefit10.mid, text: `${r.label} was left out: it ${reason}.` };
    })
    .sort((a, b) => b.value - a.value)
    .slice(0, 2);
  for (const l of left) out.push(l.text);
  return out;
}

