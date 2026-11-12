import { packageCost } from './costs';
import { hotelData } from './data';
import { DEFAULT_FINANCE, calculateFinancialMetrics, financialBreakdown, incentiveLines } from './finance';
import type { IncentiveOverrides } from './finance';
import { exportCreditPerKWh, solarCostPerW } from './solar';
import { isSolar } from './constants';
import { calculateUpgradeSavings, isContext, orderUpgrades, prepareUpgradeContext, upgradeDef } from './upgrades';
import type { UpgradeContext } from './upgrades';
import type {
  FinancialAssumptions,
  FinancialMetrics,
  Range3,
  SolarDetails,
  UpgradeOutcome,
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
  /** Confirmed incentive amounts entered by the user, per upgrade. */
  incentives?: IncentiveOverrides;
}

/** Yearly degradation of the solar part of the savings (0 if the package has no solar). */
export function solarDegradation(ids: readonly UpgradeId[], data: HotelData = hotelData): number {
  const solar = ids.find(isSolar);
  return solar ? (upgradeDef(solar, data).constants['degradationPerYear'] ?? 0) : 0;
}

/**
 * The mid-scenario financial metrics of a package. The optimizer ranks with this and `evaluatePackage` reports it, so the ranking
 * and the cards always show the same numbers.
 */
export function packageMetrics(
  ctx: UpgradeContext,
  ids: readonly UpgradeId[],
  mid: UpgradeOutcome,
  costs: ReturnType<typeof packageCost>,
  assumptions: FinancialAssumptions,
  budget: number,
  overrides: IncentiveOverrides = {},
): FinancialMetrics {
  const d = ctx.data;
  const inc = incentiveLines(costs.items, ctx.profile, mid.sizing, overrides, d);
  return calculateFinancialMetrics(
    {
      annualSavings: mid.savings.cost,
      carbonAvoidedKgPerYear: mid.savings.carbonKg,
      items: costs.items.map((i) => ({ cost: i.cost.mid, lifetimeYears: upgradeDef(i.id, d).lifetimeYears })),
      budget,
      incentivesTotal: inc.total.mid,
      solarValuePerYear: mid.sizing.solarValuePerYear,
      degradationPerYear: solarDegradation(ids, d),
      gasSavingsPerYear: mid.savings.gasCost,
    },
    assumptions,
  );
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
  const metrics = packageMetrics(ctx, ids, mid, costs, assumptions, options.budget ?? p.budget, options.incentives);
  const solarValue: Range3 = { low: low.sizing.solarValuePerYear, mid: mid.sizing.solarValuePerYear, high: high.sizing.solarValuePerYear };
  const solar: SolarDetails | null =
    ids.some(isSolar) && mid.sizing.solarKw > 0
      ? {
          sizeKw: mid.sizing.solarKw,
          generationKWh: mid.sizing.solarGenerationKWhYear,
          selfConsumedKWh: mid.sizing.solarKWhYear,
          exportedKWh: mid.sizing.solarExportKWhYear,
          exportCreditPerKWh: exportCreditPerKWh(p, d),
          omPerYear: mid.sizing.solarOmPerYear,
          installedCostPerW: solarCostPerW(mid.sizing.solarKw, p, d).mid,
          degradationPerYear: solarDegradation(ids, d),
        }
      : null;
  const financials = financialBreakdown({
    grossCost: costs.total,
    incentives: incentiveLines(costs.items, p, mid.sizing, options.incentives, d),
    annualSavings,
    solarValue,
    gasValue: { low: low.savings.gasCost, mid: mid.savings.gasCost, high: high.savings.gasCost },
    energy: { elecKWh: mid.savings.elecKWh, gasTherms: mid.savings.gasTherms, siteKBtu: mid.savings.siteKBtu },
    carbonAvoidedKgPerYear: carbonAvoidedKg,
    solar,
    priceGrowth: assumptions.priceGrowth,
    gasPriceGrowth: assumptions.gasPriceGrowth ?? assumptions.priceGrowth,
    discountRate: assumptions.discountRate,
  });

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
    financials,
    comfort: mid.comfort,
    sizing: mid.sizing,
    lineItems,
    outcome: mid,
  };
}
