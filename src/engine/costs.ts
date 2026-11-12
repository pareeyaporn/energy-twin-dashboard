import { SQFT_PER_WINDOW } from './constants';
import { defaultData } from './data';
import { orderUpgrades, upgradeDef } from './upgrades';
import type { EngineData, Home, Range3, UpgradeId, UpgradeOutcome } from './types';

/**
 * Installed cost range for one upgrade. For the heat pump the cost depends on its size, which depends on the
 * envelope upgrades in the same package, so pass the outcome of the whole package.
 */
export function upgradeCost(
  home: Home,
  id: UpgradeId,
  outcome: Pick<UpgradeOutcome, 'heatPumpTons'>,
  data: EngineData = defaultData,
): Range3 {
  const model = upgradeDef(id, data).costModel;
  const scale = (f: (r: number) => number): Range3 => {
    if (model.type === 'fixed_plus_per_ton') throw new Error(`Unexpected cost model for ${id}`);
    return { low: f(model.low), mid: f(model.mid), high: f(model.high) };
  };
  switch (model.type) {
    case 'per_sqft_attic': {
      const atticArea = home.sqft / home.stories;
      return scale((r) => r * atticArea);
    }
    case 'per_window': {
      const windows = Math.round(home.sqft / SQFT_PER_WINDOW);
      return scale((r) => r * windows);
    }
    case 'flat':
      return scale((r) => r);
    case 'fixed_plus_per_ton': {
      const tons = outcome.heatPumpTons;
      if (tons == null) throw new Error('heat_pump cost needs heatPumpTons from the package outcome');
      return {
        low: model.fixed.low + model.perTon.low * tons,
        mid: model.fixed.mid + model.perTon.mid * tons,
        high: model.fixed.high + model.perTon.high * tons,
      };
    }
  }
}

/** Per-item and total cost of a package. Incentives are 0 by default. */
export function packageCost(
  home: Home,
  upgradeIds: readonly UpgradeId[],
  outcome: UpgradeOutcome,
  data: EngineData = defaultData,
): { items: { id: UpgradeId; cost: Range3 }[]; total: Range3 } {
  const items = orderUpgrades(upgradeIds).map((id) => ({ id, cost: upgradeCost(home, id, outcome, data) }));
  const total = items.reduce(
    (t, i) => ({ low: t.low + i.cost.low, mid: t.mid + i.cost.mid, high: t.high + i.cost.high }),
    { low: 0, mid: 0, high: 0 },
  );
  return { items, total };
}
