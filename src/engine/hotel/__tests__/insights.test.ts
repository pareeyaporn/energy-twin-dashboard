import { describe, expect, it } from 'vitest';
import { calculateBaselineEnergy } from '../baseline';
import { compareUpgrades } from '../comparison';
import { impactSummary, stressKind } from '../impact';
import { INSIGHT_THRESHOLDS, energyInsights } from '../insights';
import { presetProfile } from '../profile';
import { STRESS_TESTS, simulateEnergyScenario, simulateOccupancyChange } from '../scenarios';
import { prepareUpgradeContext } from '../upgrades';
import type { EnergyInsight } from '../insights';

function insightsFor(id: string, peers: { name: string; siteEui: number }[] = []) {
  const hotel = presetProfile(id);
  const baseline = calculateBaselineEnergy(hotel);
  const comparison = compareUpgrades(prepareUpgradeContext(hotel, undefined, baseline));
  return { hotel, baseline, comparison, list: energyInsights({ hotel, baseline, comparison, peers, portfolioName: 'Test group' }) };
}
const find = (list: EnergyInsight[], id: EnergyInsight['id']) => list.find((x) => x.id === id);

describe('energy insights', () => {
  it('are 3 to 5 cards, each with a title, a body, a figure, a category, a priority, an action and a method', () => {
    const { list } = insightsFor('demo-chicago-100', [{ name: 'A', siteEui: 70 }, { name: 'B', siteEui: 75 }]);
    expect(list.length).toBeGreaterThanOrEqual(3);
    expect(list.length).toBeLessThanOrEqual(INSIGHT_THRESHOLDS.max);
    for (const i of list) {
      expect(i.title.length).toBeGreaterThan(5);
      expect(i.body.split(/(?<=\.)\s/).length).toBeLessThanOrEqual(2);
      expect(Number.isFinite(i.metric.value)).toBe(true);
      expect(i.action.label.length).toBeGreaterThan(3);
      expect(i.method.length).toBeGreaterThan(20);
    }
    expect(new Set(list.map((i) => i.id)).size).toBe(list.length);
    expect(list.filter((i) => i.category === 'energy_resilience').length).toBeLessThanOrEqual(1);
  });

  it('use the engine figures: the cost driver share, the occupancy change and the best upgrade', () => {
    const { hotel, baseline, comparison, list } = insightsFor('demo-chicago-100');
    const driver = find(list, 'cost_driver')!;
    expect(driver.metric.value).toBeCloseTo(baseline.byCategory.hvac.cost / baseline.annual.cost, 12);
    expect(driver.action.kind).toBe('equipment');
    const occ = find(list, 'occupancy');
    if (occ) expect(occ.metric.value).toBeCloseTo(simulateOccupancyChange(hotel, Math.min(1, hotel.profile.occupancy + 0.1), hotel.profile.occupancy).delta.cost, 6);
    const inv = find(list, 'investment')!;
    const best = Math.max(...comparison.filter((r) => r.financials.grossCost.mid <= hotel.profile.budget && r.financials.netBenefit10.mid > 0).map((r) => r.financials.netBenefit10.mid));
    const row = comparison.find((r) => r.financials.netBenefit10.mid === best)!;
    expect(inv.metric.value).toBeCloseTo(row.financials.annualSavings.mid, 6);
    expect(inv.body).toContain(row.label);
  });

  it('the resilience card is the larger of the price and weather exposures, from the stress-test simulations', () => {
    const { hotel, list } = insightsFor('demo-chicago-100');
    const r = list.find((i) => i.category === 'energy_resilience')!;
    const cost = (id: string) => simulateEnergyScenario(hotel, STRESS_TESTS.find((t) => t.id === id)!.scenario).delta.cost;
    const max = Math.max(cost('price_up_20'), cost('gas_up_20'), cost('heat_wave'), cost('cold_snap'));
    expect(r.metric.value).toBeCloseTo(max, 6);
    expect(r.action.kind).toBe('stress');
  });

  it('change with the hotel', () => {
    const a = insightsFor('demo-chicago-100').list;
    const b = insightsFor('demo-chicago-300').list;
    expect(find(a, 'investment')!.metric.value).not.toBeCloseTo(find(b, 'investment')!.metric.value, 0);
  });

  it('leave out what the data does not support: no peers → intensity only against ENERGY STAR; no upgrades → no investment card', () => {
    const { hotel, baseline, comparison } = insightsFor('demo-chicago-100');
    const noPeers = energyInsights({ hotel, baseline, comparison });
    const intensity = find(noPeers, 'intensity');
    if (intensity) expect(intensity.action.kind).toBe('invest');
    const noUpgrades = energyInsights({ hotel, baseline, comparison: [] });
    expect(find(noUpgrades, 'investment')).toBeUndefined();
    // Peers that use more energy per square foot do not trigger the portfolio comparison.
    const efficient = energyInsights({ hotel, baseline, comparison, peers: [{ name: 'A', siteEui: 500 }] });
    expect(find(efficient, 'intensity')?.action.kind ?? 'invest').toBe('invest');
    // A zero bill gives nothing rather than dividing by zero.
    expect(energyInsights({ hotel, baseline: { ...baseline, annual: { ...baseline.annual, cost: 0 } }, comparison })).toEqual([]);
  });
});

describe('simulation impact and stress kinds', () => {
  it('impact lines are the scenario minus the reference, with percentages', () => {
    const hotel = presetProfile('demo-chicago-100');
    const r = simulateOccupancyChange(hotel, 0.85);
    const lines = impactSummary(r.before.annual, r.after.annual);
    expect(lines.map((l) => l.id)).toEqual(['elecKWh', 'gasTherms', 'cost', 'carbonKg']);
    for (const l of lines) {
      expect(l.delta).toBeCloseTo(r.after.annual[l.id] - r.before.annual[l.id], 9);
      expect(l.pct!).toBeCloseTo(l.delta / l.before, 12);
    }
    expect(lines.find((l) => l.id === 'cost')!.delta).toBeCloseTo(r.delta.cost, 9);
    expect(impactSummary({ ...r.before.annual, gasTherms: 0 }, r.after.annual).find((l) => l.id === 'gasTherms')!.pct).toBeNull();
  });

  it('classifies every stress test; only persistent ones are financial or long-term', () => {
    const kinds = Object.fromEntries(STRESS_TESTS.map((t) => [t.id, stressKind(t)]));
    expect(kinds).toEqual({
      heat_wave: 'temporary_event',
      cold_snap: 'temporary_event',
      low_solar: 'temporary_event',
      conference_surge: 'operational_scenario',
      low_occupancy: 'operational_scenario',
      hvac_decline: 'operational_scenario',
      price_up_20: 'persistent_financial',
      gas_up_20: 'persistent_financial',
    });
    for (const t of STRESS_TESTS) if (stressKind(t) === 'persistent_financial') expect(t.duration).toBe('persistent');
    for (const t of STRESS_TESTS) if (stressKind(t) === 'temporary_event') expect(t.duration).toBe('temporary');
  });
});
