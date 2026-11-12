import { DEFAULT_ASSUMPTIONS, ENVELOPE_UPGRADES, UPGRADE_ORDER } from './constants';
import { estimateBaseline } from './baseline';
import { packageCost } from './costs';
import { defaultData } from './data';
import { netValue, paybackYears } from './finance';
import { applyUpgrades, upgradeDef } from './upgrades';
import type {
  Assumptions,
  Baseline,
  EngineData,
  Goal,
  Home,
  OptimizerResult,
  Package,
  UpgradeId,
} from './types';

/** All subsets of `ids`, including the empty set. Order is deterministic. */
function subsets(ids: readonly UpgradeId[]): UpgradeId[][] {
  return ids.reduce<UpgradeId[][]>((acc, id) => acc.concat(acc.map((s) => [...s, id])), [[]]);
}

/** Upgrades that make sense for this home. */
export function eligibleUpgrades(home: Home): UpgradeId[] {
  return UPGRADE_ORDER.filter((id) => !(id === 'heat_pump' && home.heatingSystem === 'heat_pump'));
}

function buildPackage(
  home: Home,
  baseline: Baseline,
  ids: UpgradeId[],
  assumptions: Assumptions,
  data: EngineData,
): Package {
  const mid = applyUpgrades(home, baseline, ids, 'mid', data);
  const savingsAt = (sc: 'low' | 'mid' | 'high') =>
    baseline.costs.total - applyUpgrades(home, baseline, ids, sc, data).costs.total;
  const pc = packageCost(home, ids, mid, data);
  const annualSavings = { low: savingsAt('low'), mid: baseline.costs.total - mid.costs.total, high: savingsAt('high') };

  // Per-item savings: marginal, applying upgrades one at a time in the fixed order. They sum to the package savings.
  let prevTotal = baseline.costs.total;
  const lineItems = pc.items.map((item, i) => {
    const total = applyUpgrades(home, baseline, ids.slice(0, i + 1), 'mid', data).costs.total;
    const def = upgradeDef(item.id, data);
    const savings = prevTotal - total;
    prevTotal = total;
    return {
      id: item.id,
      label: def.label,
      cost: item.cost.mid,
      savings,
      lifetimeYears: def.lifetimeYears,
      source: def.source,
    };
  });

  return {
    id: ids.join('+'),
    upgradeIds: ids,
    name: lineItems.map((l) => l.label).join(' + '),
    cost: pc.total,
    annualSavings,
    newAnnualCost: mid.costs.total,
    paybackYears: paybackYears(pc.total.mid, annualSavings.mid),
    value15: netValue(annualSavings.mid, lineItems, assumptions),
    reason: '',
    outcome: mid,
    lineItems,
  };
}

/** Lower sorts first. null payback sorts last. Final tie-break on id keeps results deterministic. */
function comparator(goal: Goal): (a: Package, b: Package) => number {
  const byId = (a: Package, b: Package) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  switch (goal) {
    case 'max_savings':
      return (a, b) => b.annualSavings.mid - a.annualSavings.mid || a.cost.mid - b.cost.mid || byId(a, b);
    case 'fastest_payback':
      return (a, b) => {
        const pa = a.paybackYears ?? Infinity;
        const pb = b.paybackYears ?? Infinity;
        if (pa !== pb) return pa < pb ? -1 : 1;
        return b.annualSavings.mid - a.annualSavings.mid || byId(a, b);
      };
    case 'best_value':
      return (a, b) => b.value15 - a.value15 || a.cost.mid - b.cost.mid || byId(a, b);
  }
}

/** One-line, rule-based reason (no AI). First matching rule wins. */
function reasonFor(pkg: Package, top: Package[], home: Home, baseline: Baseline, data: EngineData): string {
  const hasHeatPump = pkg.upgradeIds.includes('heat_pump');
  const hasEnvelope = pkg.upgradeIds.some((id) => ENVELOPE_UPGRADES.includes(id));
  if (hasHeatPump && hasEnvelope) {
    const alone = applyUpgrades(home, baseline, ['heat_pump'], 'mid', data).heatPumpTons;
    if (pkg.outcome.heatPumpTons != null && alone != null && pkg.outcome.heatPumpTons < alone) {
      return 'Insulating first lets you buy a smaller heat pump.';
    }
  }
  if (!hasHeatPump && pkg.cost.mid === Math.min(...top.map((p) => p.cost.mid))) {
    // Only claim the quickest payback when it is true (the spec's wording assumed the cheapest is also the fastest).
    const fastest = pkg.paybackYears != null && pkg.paybackYears === Math.min(...top.map((p) => p.paybackYears ?? Infinity));
    return fastest ? 'Low-cost fixes with the quickest payback.' : 'The lowest-cost option that still saves money.';
  }
  if (hasHeatPump && !hasEnvelope) {
    return 'Biggest equipment upgrade, but the house still leaks heat.';
  }
  return 'Best balance of cost and savings for your goal.';
}

/**
 * Test every combination of eligible upgrades, keep those that fit the budget and save money, and rank them.
 * Packages that do not lower the yearly bill are counted in `feasibleCount` but never recommended.
 */
export function optimize(
  home: Home,
  budget: number,
  goal: Goal,
  assumptions: Assumptions = DEFAULT_ASSUMPTIONS,
  data: EngineData = defaultData,
): OptimizerResult {
  const baseline = estimateBaseline(home, data);
  const all = subsets(eligibleUpgrades(home));

  const saving: Package[] = [];
  let feasibleCount = 0;
  for (const ids of all) {
    if (ids.length === 0) continue; // the empty set is counted as tested but never returned
    const mid = applyUpgrades(home, baseline, ids, 'mid', data);
    if (packageCost(home, ids, mid, data).total.mid > budget) continue;
    feasibleCount++;
    const pkg = buildPackage(home, baseline, ids, assumptions, data);
    if (pkg.annualSavings.mid > 0) saving.push(pkg);
  }

  const top = saving.sort(comparator(goal)).slice(0, 3);
  for (const pkg of top) pkg.reason = reasonFor(pkg, top, home, baseline, data);

  return { combinationsTested: all.length, feasibleCount, top, baseline, goal, budget };
}
