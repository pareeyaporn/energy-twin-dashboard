import { packageCost } from './costs';
import { hotelData } from './data';
import { DEFAULT_FINANCE, calculateFinancialMetrics } from './finance';
import { calculateUpgradeSavings, isContext, orderUpgrades, prepareUpgradeContext, upgradeDef } from './upgrades';
import type { UpgradeContext } from './upgrades';
import type {
  FinancialAssumptions,
  HotelData,
  HotelInput,
  PackageEvaluation,
  PackageLineItem,
  ResolvedProfile,
  UpgradeId,
} from './types';

export interface EvaluateOptions {
  assumptions?: Partial<FinancialAssumptions>;
  /** Budget used for the remaining-budget figure; defaults to the profile's budget. */
  budget?: number;
  /** Marginal per-item savings (extra runs). On by default; turn off when scanning many combinations. */
  lineItems?: boolean;
}

/**
 * One package, fully evaluated: cost range, savings range (low, mid, high), financial metrics at mid, carbon, comfort and sizing.
 * Equipment size and cost come from the mid scenario so they do not change with the savings scenario.
 */
export function evaluatePackage(
  input: HotelInput | ResolvedProfile | UpgradeContext,
  upgradeIds: readonly UpgradeId[],
  options: EvaluateOptions = {},
  data: HotelData = hotelData,
): PackageEvaluation {
  const ctx = isContext(input) ? input : prepareUpgradeContext(input, data);
  const d = ctx.data;
  const p = ctx.profile;
  const ids = orderUpgrades(upgradeIds);

  const mid = calculateUpgradeSavings(ctx, ids, 'mid', d);
  const low = calculateUpgradeSavings(ctx, ids, 'low', d, { skipValidation: true });
  const high = calculateUpgradeSavings(ctx, ids, 'high', d, { skipValidation: true });
  const costs = packageCost(p, ids, mid.sizing, d);

  const annualSavings = { low: low.savings.cost, mid: mid.savings.cost, high: high.savings.cost };
  const carbonAvoidedKg = { low: low.savings.carbonKg, mid: mid.savings.carbonKg, high: high.savings.carbonKg };
  const assumptions: FinancialAssumptions = { ...DEFAULT_FINANCE, horizonYears: p.horizonYears, ...options.assumptions };
  const metrics = calculateFinancialMetrics(
    {
      annualSavings: annualSavings.mid,
      carbonAvoidedKgPerYear: carbonAvoidedKg.mid,
      items: costs.items.map((i) => ({ cost: i.cost.mid, lifetimeYears: upgradeDef(i.id, d).lifetimeYears })),
      budget: options.budget ?? p.budget,
    },
    assumptions,
  );

  let lineItems: PackageLineItem[] = [];
  if (options.lineItems !== false) {
    let prev = ctx.baseline.annual.cost;
    lineItems = costs.items.map((item, i) => {
      const upTo = calculateUpgradeSavings(ctx, ids.slice(0, i + 1), 'mid', d, { skipValidation: true });
      const marginal = prev - upTo.annual.cost;
      prev = upTo.annual.cost;
      const def = upgradeDef(item.id, d);
      return { id: item.id, label: def.label, cost: item.cost, annualSavingsMid: marginal, lifetimeYears: def.lifetimeYears, source: def.source };
    });
  }

  return {
    id: ids.join('+'),
    upgradeIds: ids,
    name: ids.length ? ids.map((id) => upgradeDef(id, d).label).join(' + ') : 'No upgrades',
    cost: costs.total,
    annualSavings,
    newAnnualCost: mid.annual.cost,
    carbonAvoidedKg,
    metrics,
    comfort: mid.comfort,
    sizing: mid.sizing,
    lineItems,
    outcome: mid,
  };
}
