import { hotelData } from './data';
import { evaluatePackage } from './package';
import type { EvaluateOptions } from './package';
import { eligibleUpgrades } from './upgrades';
import type { UpgradeContext } from './upgrades';
import type { FinancialBreakdown, FinancialMetrics, HotelData, PackageComfort, UpgradeId } from './types';

export interface UpgradeComparisonRow {
  id: UpgradeId;
  label: string;
  description: string;
  /** The common breakdown: gross cost, incentives, net investment, kWh and $ saved, payback, 5- and 10-year benefit, CO2. */
  financials: FinancialBreakdown;
  /** The same numbers the optimizer ranks with (at the hotel's horizon). */
  metrics: FinancialMetrics;
  comfort: PackageComfort;
  lifetimeYears: number;
  source: string;
}

/**
 * Every eligible upgrade evaluated on its own, against the context's baseline (the plain baseline, or a what-if built with
 * `prepareScenarioContext`). Each row is `evaluatePackage` for that one upgrade, so the cards, the optimizer and the advisor
 * all use the same calculation. Order: the fixed upgrade order.
 */
export function compareUpgrades(ctx: UpgradeContext, options: Omit<EvaluateOptions, 'lineItems'> = {}, data: HotelData = hotelData): UpgradeComparisonRow[] {
  return eligibleUpgrades(ctx.profile, ctx.baseline.annual.elecKWh, data).map((id) => {
    const e = evaluatePackage(ctx, [id], { ...options, lineItems: false }, data);
    const def = data.upgrades.upgrades.find((u) => u.id === id)!;
    return {
      id,
      label: def.label,
      description: def.description,
      financials: e.financials,
      metrics: e.metrics,
      comfort: e.comfort,
      lifetimeYears: def.lifetimeYears,
      source: def.source,
    };
  });
}
