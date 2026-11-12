import { OPTIMIZER_DEFAULTS } from './constants';
import { packageCost } from './costs';
import { hotelData } from './data';
import { DEFAULT_FINANCE, calculateFinancialMetrics } from './finance';
import { evaluatePackage } from './package';
import {
  calculateUpgradeSavings,
  eligibleUpgrades,
  isContext,
  prepareScenarioContext,
  prepareUpgradeContext,
  upgradeDef,
  validateUpgradeSet,
} from './upgrades';
import type { UpgradeContext } from './upgrades';
import type {
  Candidate,
  FinancialAssumptions,
  HotelData,
  HotelInput,
  Objective,
  OptimizerOptions,
  PackageRole,
  PortfolioResult,
  RankedPackage,
  ResolvedProfile,
  UpgradeId,
} from './types';

const usd = (n: number) => `$${Math.round(Math.abs(n)).toLocaleString('en-US')}`;

const ROLE_LABEL: Record<PackageRole, string> = {
  max_savings: 'Maximum savings',
  fastest_payback: 'Fastest payback',
  balanced: 'Balanced',
  max_roi: 'Highest return on investment',
  max_carbon: 'Maximum carbon reduction',
};

const OBJECTIVE_ROLE: Record<Objective, PackageRole> = {
  annual_savings: 'max_savings',
  payback: 'fastest_payback',
  roi: 'max_roi',
  carbon: 'max_carbon',
  balanced: 'balanced',
};

/** All subsets of `ids` (the empty set first), in a fixed order. */
function subsets<T>(ids: readonly T[]): T[][] {
  return ids.reduce<T[][]>((acc, id) => acc.concat(acc.map((s) => [...s, id])), [[]]);
}

const byId = (a: Candidate, b: Candidate) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

/** Ranking comparators: first in the sorted list wins. Ties fall through to cost and then id, so results are deterministic. */
const COMPARE: Record<PackageRole, (a: Candidate, b: Candidate) => number> = {
  max_savings: (a, b) => b.annualSavings - a.annualSavings || a.cost - b.cost || byId(a, b),
  fastest_payback: (a, b) => {
    const pa = a.paybackYears ?? Infinity;
    const pb = b.paybackYears ?? Infinity;
    if (pa !== pb) return pa < pb ? -1 : 1;
    return b.annualSavings - a.annualSavings || byId(a, b);
  },
  balanced: (a, b) => b.balancedScore - a.balancedScore || a.cost - b.cost || byId(a, b),
  max_roi: (a, b) => (b.roi ?? -Infinity) - (a.roi ?? -Infinity) || b.annualSavings - a.annualSavings || byId(a, b),
  max_carbon: (a, b) => b.carbonAvoidedKg - a.carbonAvoidedKg || a.cost - b.cost || byId(a, b),
};

function minMax(xs: number[]): { min: number; max: number } {
  return { min: Math.min(...xs), max: Math.max(...xs) };
}
const norm = (x: number, { min, max }: { min: number; max: number }) => (max > min ? (x - min) / (max - min) : 0.5);

function reasonFor(role: PackageRole, c: Candidate, baselineCost: number, minShare: number): string {
  const share = baselineCost > 0 ? Math.round((c.annualSavings / baselineCost) * 1000) / 10 : 0;
  switch (role) {
    case 'max_savings':
      return `Saves the most each year (${usd(c.annualSavings)}, about ${share}% of the bill) of any package that fits the budget.`;
    case 'fastest_payback':
      return `Pays back soonest (${c.paybackYears?.toFixed(1) ?? 'n/a'} years) among packages that save at least ${Math.round(minShare * 100)}% of the bill.`;
    case 'balanced':
      return `Best blend of five-year net benefit (${c.netBenefit < 0 ? '-' : ''}${usd(c.netBenefit)}), carbon avoided and guest comfort (score ${c.comfortScore.toFixed(2)}).`;
    case 'max_roi':
      return `Highest five-year return per dollar spent (${c.roi == null ? 'n/a' : `${Math.round(c.roi * 100)}%`}).`;
    case 'max_carbon':
      return `Avoids the most carbon (${Math.round(c.carbonAvoidedKg / 1000)} t CO2e a year, estimated).`;
  }
}

/**
 * Test every combination of eligible upgrades. Keep those that are valid, fit the budget and the comfort limit, and save a meaningful
 * share of the bill. Return at least three distinct packages (maximum savings, fastest payback, balanced) with the winner for the
 * profile's objective highlighted. The numbers come only from the engine; interactions between upgrades are accounted for.
 */
export function optimizeInvestmentPortfolio(
  input: HotelInput | ResolvedProfile | UpgradeContext,
  options: OptimizerOptions = {},
  data: HotelData = hotelData,
): PortfolioResult {
  const scenario = options.scenario && Object.keys(options.scenario).length > 0 ? options.scenario : null;
  const ctx = isContext(input)
    ? input
    : scenario
      ? prepareScenarioContext(input, scenario, data)
      : prepareUpgradeContext(input, data);
  const d = ctx.data;
  const p = ctx.profile;
  const baselineCost = ctx.baseline.annual.cost;
  const budget = options.budget ?? p.budget;
  const objective = options.objective ?? p.objective;
  const minComfortScore = options.minComfortScore ?? OPTIMIZER_DEFAULTS.minComfortScore;
  const minSavingsShare = options.minSavingsShare ?? OPTIMIZER_DEFAULTS.minSavingsShare;
  const assumptions: FinancialAssumptions = { ...DEFAULT_FINANCE, horizonYears: p.horizonYears, ...options.assumptions };

  const eligible = eligibleUpgrades(p, ctx.baseline.annual.elecKWh, d);
  const all = subsets(eligible);
  const rejected = { overBudget: 0, comfort: 0, belowSavingsThreshold: 0, invalid: 0 };
  const scored: Candidate[] = [];
  let feasibleCount = 0;

  for (const ids of all) {
    if (ids.length === 0) continue; // counted as tested, never returned
    if (validateUpgradeSet(ids, p, ctx.baseline.annual.elecKWh, d).length) {
      rejected.invalid++;
      continue;
    }
    const mid = calculateUpgradeSavings(ctx, ids, 'mid', d, { skipValidation: true });
    const costs = packageCost(p, ids, mid.sizing, d);
    if (costs.total.mid > budget) {
      rejected.overBudget++;
      continue;
    }
    if (mid.comfort.score < minComfortScore) {
      rejected.comfort++;
      continue;
    }
    feasibleCount++;
    const savings = mid.savings.cost;
    if (savings <= 0 || savings < minSavingsShare * baselineCost) {
      rejected.belowSavingsThreshold++;
      continue;
    }
    const m = calculateFinancialMetrics(
      {
        annualSavings: savings,
        carbonAvoidedKgPerYear: mid.savings.carbonKg,
        items: costs.items.map((i) => ({ cost: i.cost.mid, lifetimeYears: upgradeDef(i.id, d).lifetimeYears })),
        budget,
      },
      assumptions,
    );
    scored.push({
      id: ids.join('+'),
      upgradeIds: ids,
      cost: costs.total.mid,
      costHigh: costs.total.high,
      annualSavings: savings,
      paybackYears: m.paybackYears,
      netBenefit: m.netBenefit,
      roi: m.roi,
      carbonAvoidedKg: mid.savings.carbonKg,
      comfortScore: mid.comfort.score,
      balancedScore: 0,
    });
  }

  // Balanced score: min-max normalized five-year net benefit and carbon, plus the comfort score, with fixed weights.
  if (scored.length) {
    const net = minMax(scored.map((c) => c.netBenefit));
    const co2 = minMax(scored.map((c) => c.carbonAvoidedKg));
    const w = OPTIMIZER_DEFAULTS.balancedWeights;
    for (const c of scored) c.balancedScore = w.financial * norm(c.netBenefit, net) + w.carbon * norm(c.carbonAvoidedKg, co2) + w.comfort * c.comfortScore;
  }

  const roles: PackageRole[] = ['max_savings', 'fastest_payback', 'balanced'];
  const sorted: Record<PackageRole, Candidate[]> = {
    max_savings: [...scored].sort(COMPARE.max_savings),
    fastest_payback: [...scored].sort(COMPARE.fastest_payback),
    balanced: [...scored].sort(COMPARE.balanced),
    max_roi: [...scored].sort(COMPARE.max_roi),
    max_carbon: [...scored].sort(COMPARE.max_carbon),
  };

  const rank = (cand: Candidate, role: PackageRole, note?: string): RankedPackage => {
    const evaluation = evaluatePackage(ctx, cand.upgradeIds, { assumptions, budget, lineItems: true }, d);
    const out: RankedPackage = {
      role,
      roleLabel: ROLE_LABEL[role],
      evaluation,
      reason: reasonFor(role, cand, baselineCost, minSavingsShare),
      budgetRisk: evaluation.cost.high > budget,
      balancedScore: cand.balancedScore,
    };
    if (note) out.note = note;
    return out;
  };

  // Three distinct packages: if one package wins more than one role, the later role takes its next best.
  const taken = new Set<string>();
  const packages: RankedPackage[] = [];
  for (const role of roles) {
    const list = sorted[role];
    const idx = list.findIndex((c) => !taken.has(c.id));
    if (idx < 0) continue;
    const cand = list[idx]!;
    taken.add(cand.id);
    const note =
      idx > 0 ? `The top ${ROLE_LABEL[role].toLowerCase()} package was already chosen for another role, so this is the runner-up.` : undefined;
    packages.push(rank(cand, role, note));
  }

  const objRole = OBJECTIVE_ROLE[objective];
  const objTop = sorted[objRole][0];
  const objectiveWinner = objTop ? (packages.find((x) => x.role === objRole && x.evaluation.id === objTop.id) ?? rank(objTop, objRole)) : null;

  // Why there is nothing to show, and the cheapest single upgrade that would help.
  let cheapestUseful: PortfolioResult['cheapestUseful'] = null;
  let emptyReason: string | null = null;
  if (scored.length === 0) {
    for (const id of eligible) {
      const o = calculateUpgradeSavings(ctx, [id], 'mid', d, { skipValidation: true });
      if (o.savings.cost <= 0) continue;
      const cost = packageCost(p, [id], o.sizing, d).total.mid;
      if (!cheapestUseful || cost < cheapestUseful.cost) cheapestUseful = { id, label: upgradeDef(id, d).label, cost };
    }
    emptyReason =
      feasibleCount === 0 && rejected.overBudget > 0
        ? `No combination fits within ${usd(budget)}.${cheapestUseful ? ` The cheapest useful upgrade is ${cheapestUseful.label} at about ${usd(cheapestUseful.cost)}.` : ''}`
        : rejected.comfort > 0 && feasibleCount === 0
          ? `Every combination that fits the budget falls below the comfort limit (${minComfortScore}).`
          : `No combination within the budget saves at least ${Math.round(minSavingsShare * 100)}% of the bill.`;
  }

  return {
    scenario,
    budget,
    objective,
    baselineAnnualCost: baselineCost,
    combinationsTested: all.length,
    feasibleCount,
    rejected,
    minComfortScore,
    minSavingsShare,
    packages,
    objectiveWinner,
    candidates: scored,
    emptyReason,
    cheapestUseful,
  };
}

