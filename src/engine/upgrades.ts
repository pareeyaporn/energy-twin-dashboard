import {
  COOLING_ENVELOPE_WEIGHT,
  ENVELOPE_UPGRADES,
  FALLBACK_CLIMATE_ZONE,
  HEAT_PUMP_MIN_TONS,
  HEAT_PUMP_TON_STEP,
    UPGRADE_ORDER,
} from './constants';
import { defaultData } from './data';
import type {
  Baseline,
  Costs,
  EngineData,
  Home,
  PartLoss,
  Scenario,
  UpgradeDef,
  UpgradeId,
  UpgradeOutcome,
} from './types';

/** Dedupe, validate and sort upgrade ids into the fixed application order. */
export function orderUpgrades(upgradeIds: readonly UpgradeId[]): UpgradeId[] {
  for (const id of upgradeIds) {
    if (!UPGRADE_ORDER.includes(id)) throw new Error(`Unknown upgrade "${id}"`);
  }
  return UPGRADE_ORDER.filter((id) => upgradeIds.includes(id));
}

export function upgradeDef(id: UpgradeId, data: EngineData = defaultData): UpgradeDef {
  const def = data.upgrades.find((u) => u.id === id);
  if (!def) throw new Error(`No upgrade "${id}" in upgrades.json`);
  return def;
}

/** Σ over parts ( share × (1 − reduction) ) for the envelope upgrades in the list. 1 = no change. */
function envelopeFactor(
  baseline: Baseline,
  ids: readonly UpgradeId[],
  scenario: Scenario,
  data: EngineData,
): { factor: number; reducedShares: Record<string, number>; reductions: Record<string, number> } {
  const reductions: Record<string, number> = {};
  for (const id of ids) {
    if (!ENVELOPE_UPGRADES.includes(id)) continue;
    const pr = upgradeDef(id, data).partReduction ?? {};
    for (const [part, range] of Object.entries(pr)) {
      // Two upgrades on one part would compound: (1 − a)(1 − b).
      const prev = reductions[part] ?? 0;
      reductions[part] = 1 - (1 - prev) * (1 - range[scenario]);
    }
  }
  const reducedShares: Record<string, number> = {};
  let factor = 0;
  for (const p of baseline.parts) {
    const s = p.share * (1 - (reductions[p.part] ?? 0));
    reducedShares[p.part] = s;
    factor += s;
  }
  return { factor, reducedShares, reductions };
}

/** Heat pump size in tons: baseline size scaled by the load left after envelope upgrades, rounded up to 0.5, min 1.5. */
function heatPumpTons(home: Home, loadFactor: number, data: EngineData): number {
  const perK =
    data.defaults.baseTonsPer1000sqft[home.climateZone] ?? data.defaults.baseTonsPer1000sqft[FALLBACK_CLIMATE_ZONE] ?? 1.5;
  const raw = perK * (home.sqft / 1000) * loadFactor;
  const rounded = Math.ceil(raw / HEAT_PUMP_TON_STEP - 1e-9) * HEAT_PUMP_TON_STEP;
  return Math.max(HEAT_PUMP_MIN_TONS, rounded);
}

/**
 * Apply upgrades in a fixed order: envelope → heat pump (sized from the reduced load) → smart thermostat.
 * Savings are never added as percentages: every step recomputes the loads, then the costs from the loads.
 */
export function applyUpgrades(
  home: Home,
  baseline: Baseline,
  upgradeIds: readonly UpgradeId[],
  scenario: Scenario = 'mid',
  data: EngineData = defaultData,
): UpgradeOutcome {
  const ids = orderUpgrades(upgradeIds);
  if (ids.length === 0) {
    return { upgradeIds: ids, costs: { ...baseline.costs }, parts: baseline.parts.map((p) => ({ ...p })) };
  }
  const hasHeatPump = ids.includes('heat_pump');
  if (hasHeatPump && home.heatingSystem === 'heat_pump') {
    throw new Error('heat_pump is not applicable: the home already has a heat pump');
  }

  // 1. Envelope
  const env = envelopeFactor(baseline, ids, scenario, data);
  let heatingLoad = baseline.heatingLoadKWh * env.factor;
  let coolingLoad = baseline.coolingLoadKWh * (COOLING_ENVELOPE_WEIGHT + (1 - COOLING_ENVELOPE_WEIGHT) * env.factor);

  // 2. Heat pump sizing uses the mid-scenario envelope so size and cost do not vary with the savings scenario.
  let tons: number | undefined;
  if (hasHeatPump) {
    tons = heatPumpTons(home, envelopeFactor(baseline, ids, 'mid', data).factor, data);
  }

  // 3. Smart thermostat reduces whatever load remains.
  let thermostatFactor = 1;
  if (ids.includes('smart_thermostat')) {
    thermostatFactor = 1 - (upgradeDef('smart_thermostat', data).loadReduction?.[scenario] ?? 0);
    heatingLoad *= thermostatFactor;
    coolingLoad *= thermostatFactor;
  }

  // Cost of the remaining heating and cooling load at the ORIGINAL equipment and fuel. This is what the envelope
  // still loses; it does not depend on the heat pump, so the 3D leaks only change when the envelope or thermostat do.
  const lossHeating = baseline.heatingLoadKWh > 0 ? baseline.costs.heating * (heatingLoad / baseline.heatingLoadKWh) : 0;
  const lossCooling = baseline.coolingLoadKWh > 0 ? baseline.costs.cooling * (coolingLoad / baseline.coolingLoadKWh) : 0;

  // Bill: from the remaining loads, through the new equipment if there is a heat pump.
  const costs: Costs = { ...baseline.costs, heating: lossHeating, cooling: lossCooling };
  if (hasHeatPump) {
    const hp = upgradeDef('heat_pump', data);
    const heatCOP = (hp.heatingCOP?.[home.climateZone] ?? hp.heatingCOP?.['default'])?.[scenario];
    const coolCOP = hp.coolingCOP?.[scenario];
    if (heatCOP == null || coolCOP == null) throw new Error('heat_pump COP missing in upgrades.json');
    costs.heating = (heatingLoad / heatCOP) * baseline.elecRate; // heating becomes all-electric
    costs.cooling = (coolingLoad / coolCOP) * baseline.elecRate;
  }
  // Water heating and other uses are unchanged (a heat pump does not remove the rest of the fuel bill).
  costs.total = costs.heating + costs.cooling + costs.waterHeating + costs.other;

  // Parts: each part's loss is its baseline loss x (1 - its envelope reduction) x thermostat factor. Intensity stays
  // relative to the baseline's worst part, so upgraded parts cool from red towards blue in 3D and no part can get
  // hotter. Shares are the reduced shares, normalized to sum to 1.
  const baselineMax = Math.max(...baseline.parts.map((p) => p.annualCost));
  const parts: PartLoss[] = baseline.parts.map((p) => {
    const annualCost = p.annualCost * (1 - (env.reductions[p.part] ?? 0)) * thermostatFactor;
    const share = env.factor > 0 ? (env.reducedShares[p.part] ?? 0) / env.factor : 0;
    return { part: p.part, share, annualCost, intensity: baselineMax > 0 ? Math.min(1, annualCost / baselineMax) : 0 };
  });

  const outcome: UpgradeOutcome = { upgradeIds: ids, costs, parts };
  if (tons != null) outcome.heatPumpTons = tons;
  return outcome;
}
