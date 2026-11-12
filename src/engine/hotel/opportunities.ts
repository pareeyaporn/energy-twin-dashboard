import { ZONE_IDS } from './constants';
import { hotelData } from './data';
import { evaluatePackage } from './package';
import { eligibleUpgrades, upgradeDef } from './upgrades';
import type { UpgradeContext } from './upgrades';
import type { HotelData, UpgradeId, ZoneId } from './types';

export interface ZoneOpportunity {
  id: UpgradeId;
  label: string;
  description: string;
  /** Mid-estimate yearly saving in this zone, in dollars. */
  zoneAnnualSavings: number;
  /** The upgrade's total yearly saving across the whole hotel (mid). */
  totalAnnualSavings: number;
  /** Net investment (mid): installed cost minus applied incentives, for the whole hotel. */
  cost: number;
  /** Payback of the whole upgrade; null if it does not save money overall. */
  paybackYears: number | null;
  comfortImpact: 'none' | 'minor' | 'positive';
  comfortNote: string;
}

/**
 * For each zone, the upgrades that would lower that zone's energy cost, biggest first. Each upgrade is evaluated on its own
 * against the context's baseline (the plain baseline, or a what-if if the context was built with `prepareScenarioContext`).
 * An upgrade can help one zone and slightly hurt another (LEDs add heating), so the zone figure is the net change in that zone.
 */
export function opportunitiesByZone(ctx: UpgradeContext, data: HotelData = hotelData): Record<ZoneId, ZoneOpportunity[]> {
  const out = Object.fromEntries(ZONE_IDS.map((z) => [z, [] as ZoneOpportunity[]])) as Record<ZoneId, ZoneOpportunity[]>;
  const base = ctx.baseline;
  for (const id of eligibleUpgrades(ctx.profile, base.annual.elecKWh, data)) {
    // Same evaluation as the comparison cards and the optimizer, so cost and payback match everywhere.
    const e = evaluatePackage(ctx, [id], { lineItems: false }, data);
    const o = e.outcome;
    const def = upgradeDef(id, data);
    const cost = e.financials.netInvestment.mid;
    const total = o.savings.cost;
    for (const z of ZONE_IDS) {
      const after = o.cells.filter((c) => c.zone === z).reduce((s, c) => s + c.cost, 0);
      const saved = base.byZone[z].cost - after;
      if (saved < 0.5) continue;
      out[z].push({
        id,
        label: def.label,
        description: def.description,
        zoneAnnualSavings: saved,
        totalAnnualSavings: total,
        cost,
        paybackYears: e.financials.simplePaybackYears,
        comfortImpact: def.comfort.impact,
        comfortNote: def.comfort.note,
      });
    }
  }
  for (const z of ZONE_IDS) out[z].sort((a, b) => b.zoneAnnualSavings - a.zoneAnnualSavings || (a.id < b.id ? -1 : 1));
  return out;
}
