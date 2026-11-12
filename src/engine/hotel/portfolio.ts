// Hotel portfolio (Phase 13): totals across properties and a shared-budget optimizer. Every per-property number comes from the
// single-hotel engine (baseline, upgrade savings, costs, incentives, financial breakdown); this file only adds them up and chooses.
import { OPTIMIZER_DEFAULTS } from './constants';
import { packageCost } from './costs';
import { hotelData } from './data';
import { DEFAULT_FINANCE } from './finance';
import { benchmarkComparison } from './benchmark';
import { calculateBaselineEnergy } from './baseline';
import { normalizedWeights, subsets } from './optimizer';
import { evaluatePackage, packageMetrics } from './package';
import { resolveProfile } from './profile';
import { calculateUpgradeSavings, eligibleUpgrades, prepareUpgradeContext, validateUpgradeSet } from './upgrades';
import type { UpgradeContext } from './upgrades';
import type {
  EnergyResult,
  FinancialAssumptions,
  HotelData,
  HotelInput,
  PackageEvaluation,
  PortfolioObjective,
  PortfolioProperty,
  PropertyCandidate,
  ResolvedProfile,
} from './types';

export const PORTFOLIO_DEFAULTS = {
  budget: 500_000,
  objective: 'balanced' as PortfolioObjective,
  /** Budget resolution of the allocation (dollars). Package costs are rounded up to it, so the budget is never exceeded. */
  budgetStep: 1_000,
};

export const PORTFOLIO_OBJECTIVES: { id: PortfolioObjective; label: string }[] = [
  { id: 'balanced', label: 'Balanced' },
  { id: 'annual_savings', label: 'Annual savings' },
  { id: 'npv10', label: '10-year NPV' },
  { id: 'payback', label: 'Fastest payback' },
  { id: 'carbon', label: 'Carbon reduction' },
];

/** A property with its input resolved, its baseline and its upgrade context (the same objects the single-hotel screens use). */
export interface PreparedProperty {
  property: PortfolioProperty;
  input: HotelInput;
  hotel: ResolvedProfile;
  baseline: EnergyResult;
  ctx: UpgradeContext;
}

// Caches keyed by the input object: the store keeps each property's input stable until it is edited.
const preparedCache = new WeakMap<HotelInput, PreparedProperty>();
const candidateCache = new WeakMap<HotelInput, Map<number, { candidates: PropertyCandidate[]; tested: number }>>();

export function prepareProperty(property: PortfolioProperty, input: HotelInput = property.input, data: HotelData = hotelData): PreparedProperty {
  const cached = data === hotelData ? preparedCache.get(input) : undefined;
  if (cached && cached.property.id === property.id) return cached;
  const hotel = resolveProfile(input, data);
  const baseline = calculateBaselineEnergy(hotel, data);
  const out = { property, input, hotel, baseline, ctx: prepareUpgradeContext(hotel, data, baseline) };
  if (data === hotelData) preparedCache.set(input, out);
  return out;
}

const tenYear = (discountRate: number): FinancialAssumptions => ({
  ...DEFAULT_FINANCE,
  horizonYears: 10,
  discountRate,
});

/**
 * Every valid upgrade combination at one property that saves money and keeps guests comfortable, with no budget limit (the
 * portfolio budget is applied later). Same enumeration, exclusions, comfort limit, costs and incentives as the single-hotel
 * optimizer; savings interactions are computed inside the hotel, never summed across upgrades.
 */
export function propertyCandidates(
  prepared: PreparedProperty,
  options: { discountRate?: number; minComfortScore?: number } = {},
  data: HotelData = hotelData,
): { candidates: PropertyCandidate[]; tested: number } {
  const rate = options.discountRate ?? DEFAULT_FINANCE.discountRate;
  const minComfort = options.minComfortScore ?? OPTIMIZER_DEFAULTS.minComfortScore;
  const useCache = data === hotelData && options.minComfortScore === undefined;
  const byRate = useCache ? candidateCache.get(prepared.input) : undefined;
  const hit = byRate?.get(rate);
  if (hit) return hit;

  const { ctx, property } = prepared;
  const p = ctx.profile;
  const elec = ctx.baseline.annual.elecKWh;
  const all = subsets(eligibleUpgrades(p, elec, data)).filter((ids) => validateUpgradeSet(ids, p, elec, data).length === 0);
  const a = tenYear(rate);
  const candidates: PropertyCandidate[] = [];
  for (const ids of all) {
    if (ids.length === 0) continue;
    const mid = calculateUpgradeSavings(ctx, ids, 'mid', data, { skipValidation: true });
    if (mid.comfort.score < minComfort || mid.savings.cost <= 0) continue;
    const costs = packageCost(p, ids, mid.sizing, data);
    const m = packageMetrics(ctx, ids, mid, costs, a, Infinity);
    candidates.push({
      id: ids.join('+'),
      propertyId: property.id,
      upgradeIds: ids,
      grossCost: costs.total.mid,
      incentives: costs.total.mid - m.netInvestment,
      netInvestment: m.netInvestment,
      annualSavings: mid.savings.cost,
      npv10: m.npv,
      carbonAvoidedKg: mid.savings.carbonKg,
      comfortScore: mid.comfort.score,
      paybackYears: m.paybackYears,
    });
  }
  candidates.sort((x, y) => x.grossCost - y.grossCost || (x.id < y.id ? -1 : x.id > y.id ? 1 : 0));
  const out = { candidates, tested: all.length };
  if (useCache) {
    const m = candidateCache.get(prepared.input) ?? new Map();
    m.set(rate, out);
    candidateCache.set(prepared.input, m);
  }
  return out;
}

// ---- Summary ----

export interface PropertySummary {
  id: string;
  name: string;
  /** Labels from the property (optional for older data). */
  brand?: string;
  region?: string;
  ownership?: PortfolioProperty['ownership'];
  neighborhood: string;
  segment: string;
  lat: number;
  lng: number;
  synthetic: boolean;
  rooms: number;
  floorAreaSqft: number;
  occupancy: number;
  hvacType: string;
  yearBuilt: number;
  annual: EnergyResult['annual'];
  /** Site energy intensity, kBtu per ft² a year (electricity and gas converted to one unit). */
  siteEui: number;
  /** The property's best package by 10-year NPV within its own budget, if one has a positive NPV. */
  potential: PropertyCandidate | null;
  /** 10-year NPV per dollar of net investment of `potential`, scaled 0–100 across the portfolio (the best property scores 100). */
  priorityScore: number;
  /** True when inputs were defaulted (the figures are estimates either way). */
  defaulted: boolean;
}

export interface PortfolioSummary {
  properties: PropertySummary[];
  totals: {
    properties: number;
    rooms: number;
    floorAreaSqft: number;
    elecKWh: number;
    gasTherms: number;
    siteKBtu: number;
    cost: number;
    carbonKg: number;
    /** Sum of the properties' savings potential (each within its own budget). */
    savingsPotential: number;
    investmentRequired: number;
  };
  definitions: string[];
}

export const PORTFOLIO_DEFINITIONS = [
  "Savings potential: the annual savings of a property's best upgrade package by 10-year net present value (NPV), among packages within the property's own budget that have a positive 10-year NPV.",
  'Investment required: that package’s net investment (installed cost minus verified incentives).',
  'Investment priority score: 10-year NPV per dollar of net investment, scaled 0 to 100 across the portfolio (the best property scores 100).',
  'Energy intensity: site energy (electricity and natural gas converted to kBtu) per square foot a year.',
];

export function portfolioSummary(
  items: { property: PortfolioProperty; input?: HotelInput }[],
  options: { discountRate?: number } = {},
  data: HotelData = hotelData,
): PortfolioSummary {
  const rows = items.map(({ property, input }) => {
    const prep = prepareProperty(property, input ?? property.input, data);
    const p = prep.hotel.profile;
    const { candidates } = propertyCandidates(prep, options, data);
    let best: PropertyCandidate | null = null;
    for (const c of candidates) {
      if (c.grossCost > p.budget || c.npv10 <= 0) continue;
      if (!best || c.npv10 > best.npv10 + 1e-9) best = c;
    }
    return { prep, best };
  });
  const ratio = (c: PropertyCandidate | null) => (c && c.netInvestment > 0 ? c.npv10 / c.netInvestment : 0);
  const maxRatio = Math.max(0, ...rows.map((r) => ratio(r.best)));
  const properties: PropertySummary[] = rows.map(({ prep, best }) => {
    const p = prep.hotel.profile;
    const { brand, region, ownership } = prep.property;
    return {
      id: prep.property.id,
      name: p.name,
      ...(brand ? { brand } : {}),
      ...(region ? { region } : {}),
      ...(ownership ? { ownership } : {}),
      neighborhood: prep.property.neighborhood,
      segment: prep.property.segment,
      lat: prep.property.lat,
      lng: prep.property.lng,
      synthetic: prep.property.synthetic,
      rooms: p.rooms,
      floorAreaSqft: p.floorAreaSqft,
      occupancy: p.occupancy,
      hvacType: p.hvacType,
      yearBuilt: p.yearBuilt,
      annual: prep.baseline.annual,
      siteEui: benchmarkComparison(prep.baseline, p.floorAreaSqft, data).siteEuiKBtuPerSqft,
      potential: best,
      priorityScore: maxRatio > 0 ? Math.round((ratio(best) / maxRatio) * 100) : 0,
      defaulted: prep.hotel.defaulted.length > 0,
    };
  });
  const sum = (f: (r: PropertySummary) => number) => properties.reduce((s, r) => s + f(r), 0);
  return {
    properties,
    totals: {
      properties: properties.length,
      rooms: sum((r) => r.rooms),
      floorAreaSqft: sum((r) => r.floorAreaSqft),
      elecKWh: sum((r) => r.annual.elecKWh),
      gasTherms: sum((r) => r.annual.gasTherms),
      siteKBtu: sum((r) => r.annual.siteKBtu),
      cost: sum((r) => r.annual.cost),
      carbonKg: sum((r) => r.annual.carbonKg),
      savingsPotential: sum((r) => r.potential?.annualSavings ?? 0),
      investmentRequired: sum((r) => r.potential?.netInvestment ?? 0),
    },
    definitions: PORTFOLIO_DEFINITIONS,
  };
}

// ---- Shared-budget optimizer ----

export interface PortfolioAllocation {
  propertyId: string;
  name: string;
  /** null when the property gets nothing (no package improves the objective within the remaining budget). */
  candidate: PropertyCandidate | null;
  /** The full single-hotel evaluation of the chosen package (cost range, incentives, breakdown, projection). */
  evaluation: PackageEvaluation | null;
  baselineCost: number;
  combinationsTested: number;
}

/** Totals of one package (or plan) per property; the same shape for the AI portfolio and the user's portfolio, so they compare directly. */
export interface PortfolioTotals {
  grossCost: number;
  incentives: number;
  netInvestment: number;
  remainingBudget: number;
  annualSavings: number;
  npv5: number;
  npv10: number;
  netBenefit10: number;
  paybackYears: number | null;
  carbonAvoidedKg: number;
  /** Annual savings as a share of the portfolio's annual energy cost. */
  shareOfPortfolioCost: number;
  baselineCost: number;
  /** Lowest comfort score among the chosen packages (null when nothing is chosen). Optional for backwards compatibility. */
  comfortScore?: number | null;
  /** How many properties get a package. Optional for backwards compatibility. */
  propertiesWithPackage?: number;
}

/** Adds up the full evaluations (null = nothing at that property); payback is total net investment / total annual savings. */
export function portfolioTotals(evaluations: (PackageEvaluation | null)[], baselineCost: number, budget: number): PortfolioTotals {
  const chosen = evaluations.filter((e): e is PackageEvaluation => e !== null);
  const sum = (f: (e: PackageEvaluation) => number) => chosen.reduce((t, e) => t + f(e), 0);
  const grossCost = sum((e) => e.financials.grossCost.mid);
  const netInvestment = sum((e) => e.financials.netInvestment.mid);
  const annualSavings = sum((e) => e.financials.annualSavings.mid);
  return {
    grossCost,
    incentives: sum((e) => e.financials.incentivesTotal),
    netInvestment,
    remainingBudget: budget - grossCost,
    annualSavings,
    npv5: sum((e) => e.financials.npv5?.mid ?? 0),
    npv10: sum((e) => e.financials.npv10?.mid ?? 0),
    netBenefit10: sum((e) => e.financials.netBenefit10.mid),
    paybackYears: annualSavings > 0 ? netInvestment / annualSavings : null,
    carbonAvoidedKg: sum((e) => e.financials.carbonAvoidedKgPerYear.mid),
    shareOfPortfolioCost: baselineCost > 0 ? annualSavings / baselineCost : 0,
    baselineCost,
    comfortScore: chosen.length ? Math.min(...chosen.map((e) => e.comfort.score)) : null,
    propertiesWithPackage: chosen.length,
  };
}

export interface PortfolioPlan {
  budget: number;
  objective: PortfolioObjective;
  discountRate: number;
  allocations: PortfolioAllocation[];
  totals: PortfolioTotals;
  combinationsTested: number;
  method: string;
  notes: string[];
}

type Valued = { c: PropertyCandidate; w: number; v: number };

/**
 * Exact multiple-choice knapsack: at most one candidate per group (exactly one per non-empty group when `required`), total weight
 * ≤ cap, maximize the sum of values. Returns null when `required` cannot be met within the cap.
 */
export function chooseOnePerGroup(groups: Valued[][], cap: number, required = false): (Valued | null)[] | null {
  const n = groups.length;
  let dp = new Float64Array(cap + 1);
  const pick: Int32Array[] = [];
  for (let g = 0; g < n; g++) {
    const list = groups[g]!;
    const must = required && list.length > 0;
    const next = must ? new Float64Array(cap + 1).fill(-Infinity) : Float64Array.from(dp);
    const choice = new Int32Array(cap + 1).fill(-1);
    for (let i = 0; i < list.length; i++) {
      const { w, v } = list[i]!;
      if (w > cap || (!must && !(v > 0))) continue;
      for (let k = cap; k >= w; k--) {
        const val = dp[k - w]! + v;
        if (val > next[k]! + 1e-9) {
          next[k] = val;
          choice[k] = i;
        }
      }
    }
    pick.push(choice);
    dp = next;
  }
  if (!Number.isFinite(dp[cap]!)) return null;
  // dp[k] is the best value with total weight at most k (unused budget allowed), so trace back from the full budget.
  const out: (Valued | null)[] = new Array(n).fill(null);
  let k = cap;
  for (let g = n - 1; g >= 0; g--) {
    const i = pick[g]![k]!;
    if (i >= 0) {
      const item = groups[g]![i]!;
      out[g] = item;
      k -= item.w;
    }
  }
  return out;
}

/**
 * Split one investment budget across the portfolio: at most one package per property, total gross cost within the budget,
 * maximizing the objective. Additive objectives (annual savings, 10-year NPV, carbon, balanced) are solved exactly by dynamic
 * programming over the budget in $1,000 steps; fastest payback (a ratio) is solved exactly by repeating that program
 * (Dinkelbach's method). Each chosen package is then evaluated in full with the single-hotel engine.
 */
export function optimizePortfolioBudget(
  items: { property: PortfolioProperty; input?: HotelInput }[],
  options: { budget?: number; objective?: PortfolioObjective; discountRate?: number; budgetStep?: number } = {},
  data: HotelData = hotelData,
): PortfolioPlan {
  const budget = Math.max(0, options.budget ?? PORTFOLIO_DEFAULTS.budget);
  const objective = options.objective ?? PORTFOLIO_DEFAULTS.objective;
  const discountRate = options.discountRate ?? DEFAULT_FINANCE.discountRate;
  const step = options.budgetStep ?? PORTFOLIO_DEFAULTS.budgetStep;
  const cap = Math.floor(budget / step + 1e-9);

  const prepared = items.map(({ property, input }) => prepareProperty(property, input ?? property.input, data));
  const sets = prepared.map((prep) => propertyCandidates(prep, { discountRate }, data));
  const weight = (c: PropertyCandidate) => Math.max(0, Math.ceil(c.grossCost / step - 1e-9));
  const fitting = sets.map((s) => s.candidates.filter((c) => weight(c) <= cap));

  const flat = fitting.flat();
  const maxNpv = Math.max(0, ...flat.map((c) => c.npv10));
  const maxCo2 = Math.max(0, ...flat.map((c) => c.carbonAvoidedKg));
  const wts = normalizedWeights();
  const wf = wts.financial / (wts.financial + wts.carbon);
  const wc = wts.carbon / (wts.financial + wts.carbon);
  const valueOf: Record<Exclude<PortfolioObjective, 'payback'>, (c: PropertyCandidate) => number> = {
    annual_savings: (c) => c.annualSavings,
    npv10: (c) => c.npv10,
    carbon: (c) => c.carbonAvoidedKg,
    balanced: (c) => wf * (maxNpv > 0 ? c.npv10 / maxNpv : 0) + wc * (maxCo2 > 0 ? c.carbonAvoidedKg / maxCo2 : 0),
  };
  const solve = (v: (c: PropertyCandidate) => number, required = false) =>
    chooseOnePerGroup(fitting.map((list) => list.map((c) => ({ c, w: weight(c), v: v(c) }))), cap, required);

  let chosen: (Valued | null)[];
  let method: string;
  if (objective === 'payback') {
    // Product decision (docs/15): fastest payback gives every property a package when the budget allows (otherwise the exact
    // answer is one small package at one hotel), then minimizes the portfolio's simple payback = net investment / annual savings.
    // Dinkelbach: start from the largest savings, then repeatedly maximize savings - λ × net investment with λ the current
    // savings per dollar, until no allocation does better (exact for this ratio).
    const everyone = solve(valueOf.annual_savings, true);
    const required = everyone !== null;
    chosen = everyone ?? solve(valueOf.annual_savings)!;
    let rounds = 0;
    for (; rounds < 50; rounds++) {
      const s = chosen.reduce((t, x) => t + (x?.c.annualSavings ?? 0), 0);
      const n = chosen.reduce((t, x) => t + (x?.c.netInvestment ?? 0), 0);
      if (s <= 0 || n <= 0) break;
      const lambda = s / n;
      const next = solve((c) => c.annualSavings - lambda * c.netInvestment, required);
      if (!next) break;
      const gain = next.reduce((t, x) => t + (x ? x.c.annualSavings - lambda * x.c.netInvestment : 0), 0);
      if (gain <= 1e-6 || next.every((x) => x === null)) break;
      chosen = next;
    }
    method = `Exact: dynamic programming over the budget in $${step.toLocaleString('en-US')} steps, repeated ${rounds + 1} times (Dinkelbach's method) to minimize the portfolio's simple payback${required ? ', with a package at every property' : ' (the budget cannot cover every property)'}.`;
  } else {
    chosen = solve(valueOf[objective])!;
    method = `Exact: dynamic programming over the budget in $${step.toLocaleString('en-US')} steps (at most one package per property).`;
  }

  const allocations: PortfolioAllocation[] = prepared.map((prep, i) => {
    const c = chosen[i]?.c ?? null;
    const evaluation = c
      ? evaluatePackage(prep.ctx, c.upgradeIds, { assumptions: { discountRate }, budget: c.grossCost, lineItems: false }, data)
      : null;
    return {
      propertyId: prep.property.id,
      name: prep.hotel.profile.name,
      candidate: c,
      evaluation,
      baselineCost: prep.baseline.annual.cost,
      combinationsTested: sets[i]!.tested,
    };
  });
  const baselineCost = allocations.reduce((t, x) => t + x.baselineCost, 0);
  return {
    budget,
    objective,
    discountRate,
    allocations,
    totals: portfolioTotals(allocations.map((x) => x.evaluation), baselineCost, budget),
    combinationsTested: sets.reduce((s, x) => s + x.tested, 0),
    method,
    notes: [
      'The budget is compared with the gross installed cost (before incentives), as in the single-hotel optimizer, because most incentives arrive after installation.',
      `Package costs are rounded up to the next $${step.toLocaleString('en-US')} when fitting them in the budget, so the plan never exceeds it.`,
      'Each property is measured on its current baseline (no what-if or stress test). Savings interactions are computed inside each hotel.',
      'Balanced: 10-year NPV and carbon avoided, each scaled by the best package in the portfolio and weighted as in the single-hotel balanced score; comfort is a limit every package must pass.',
      'Estimates from synthetic demonstration properties.',
    ],
  };
}
