import { hotelData } from './data';
import { areasOf, orderUpgrades, upgradeDef } from './upgrades';
import { solarCostPerW } from './solar';
import { isSolar } from './constants';
import type { HotelData, HotelProfile, Range3, UpgradeId, UpgradeSizing } from './types';

const SCENARIOS = ['low', 'mid', 'high'] as const;

/**
 * Installed cost range for one upgrade: fixed + per room + per floor area + per roof area + per common-area floor area + per kW.
 * Equipment sized from the reduced load (HVAC) scales its floor-area part by the package's size factor. Solar adds the region's
 * installed cost per W for its size. This is the gross cost: incentives are subtracted in the financial breakdown.
 */
export function upgradeCost(
  p: HotelProfile,
  id: UpgradeId,
  sizing: Pick<UpgradeSizing, 'hvacSizeFactor' | 'solarKw'>,
  data: HotelData = hotelData,
  /** Share of the upgrade's scope installed (custom plans); scales every part except the fixed cost. Solar uses its kW instead. */
  coverage = 1,
): Range3 {
  const def = upgradeDef(id, data);
  const k = isSolar(id) ? 1 : Math.min(1, Math.max(0, coverage));
  const { roofSqft, commonSqft } = areasOf(p, data);
  const m = def.cost;
  const out: Range3 = { low: 0, mid: 0, high: 0 };
  const perW = isSolar(id) && sizing.solarKw > 0 ? solarCostPerW(sizing.solarKw, p, data) : null;
  for (const s of SCENARIOS) {
    out[s] =
      (m.fixed?.[s] ?? 0) +
      k *
        ((m.perRoom?.[s] ?? 0) * p.rooms +
          (m.perSqftFloor?.[s] ?? 0) * p.floorAreaSqft * (def.sizeScaled ? sizing.hvacSizeFactor : 1) +
          (m.perSqftRoof?.[s] ?? 0) * roofSqft +
          (m.perSqftCommon?.[s] ?? 0) * commonSqft) +
      (m.perKw?.[s] ?? 0) * sizing.solarKw +
      (perW ? perW[s] * 1000 * sizing.solarKw : 0);
  }
  return out;
}

/** Per-item and total cost of a package. */
export function packageCost(
  p: HotelProfile,
  ids: readonly UpgradeId[],
  sizing: Pick<UpgradeSizing, 'hvacSizeFactor' | 'solarKw'>,
  data: HotelData = hotelData,
  coverage: Partial<Record<UpgradeId, number>> = {},
): { items: { id: UpgradeId; cost: Range3 }[]; total: Range3 } {
  const items = orderUpgrades(ids).map((id) => ({ id, cost: upgradeCost(p, id, sizing, data, coverage[id] ?? 1) }));
  const total = items.reduce(
    (t, i) => ({ low: t.low + i.cost.low, mid: t.mid + i.cost.mid, high: t.high + i.cost.high }),
    { low: 0, mid: 0, high: 0 },
  );
  return { items, total };
}
