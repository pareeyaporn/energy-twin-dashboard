import { describe, expect, it } from 'vitest';
import { evaluatePackage } from '../package';
import { presetProfile } from '../profile';
import { STRESS_CATEGORIES, STRESS_TESTS, simulateEnergyScenario } from '../scenarios';
import { stressTestReport } from '../stress';
import { prepareScenarioContext, prepareUpgradeContext } from '../upgrades';
import type { StressTest } from '../scenarios';

const demo = presetProfile('demo-chicago-100');
const opts = { budget: 50000, objective: 'balanced' as const, discountRate: 0.08 };
const test = (id: StressTest['id']) => STRESS_TESTS.find((t) => t.id === id)!;
const plan = { label: 'LED + sensors', source: 'ai' as const, ids: ['led_lighting', 'occupancy_sensors'] as const };

describe('stress tests', () => {
  it('has eight tests in three categories, each with stated assumptions and a duration', () => {
    expect(STRESS_TESTS).toHaveLength(8);
    expect(new Set(STRESS_TESTS.map((t) => t.category))).toEqual(new Set(STRESS_CATEGORIES.map((c) => c.id)));
    for (const t of STRESS_TESTS) {
      expect(t.assumptions.length).toBeGreaterThan(0);
      for (const a of t.assumptions) expect(a.change && a.period && a.what).toBeTruthy();
      expect(['temporary', 'persistent']).toContain(t.duration);
    }
    expect(STRESS_TESTS.filter((t) => t.duration === 'persistent').map((t) => t.id).sort()).toEqual(['gas_up_20', 'hvac_decline', 'price_up_20']);
  });

  it('moves costs in the expected direction', () => {
    const d = (id: StressTest['id']) => simulateEnergyScenario(demo, test(id).scenario).delta;
    expect(d('heat_wave').elecKWh).toBeGreaterThan(0);
    expect(d('cold_snap').gasTherms).toBeGreaterThan(0);
    expect(d('low_occupancy').cost).toBeLessThan(0);
    expect(d('conference_surge').cost).toBeGreaterThan(0);
    expect(d('hvac_decline').cost).toBeGreaterThan(0);
    expect(d('gas_up_20').gasCost).toBeGreaterThan(0);
    expect(d('gas_up_20').gasTherms).toBeCloseTo(0, 6);
    expect(Math.abs(d('low_solar').cost)).toBeLessThan(1e-6); // no solar today
  });

  it('evaluates the plan with the optimizer’s function on both years', () => {
    const r = stressTestReport(demo, test('price_up_20'), {}, test('price_up_20').scenario, { ...plan, ids: [...plan.ids] }, opts);
    const a = evaluatePackage(prepareUpgradeContext(demo), [...plan.ids], { lineItems: false });
    const b = evaluatePackage(prepareScenarioContext(demo, test('price_up_20').scenario), [...plan.ids], { lineItems: false });
    expect(r.plan!.savingsNormal).toBeCloseTo(a.financials.annualSavings.mid, 6);
    expect(r.plan!.savingsStressed).toBeCloseTo(b.financials.annualSavings.mid, 6);
    expect(r.plan!.extraAvoided).toBeGreaterThan(0); // dearer electricity makes the savings worth more
    expect(r.plan!.persistent!.paybackStressed!).toBeLessThan(r.plan!.persistent!.paybackNormal!);
    expect(r.recommendation).not.toBeNull();
  });

  it('does not change returns or the recommendation for temporary events', () => {
    const r = stressTestReport(demo, test('heat_wave'), {}, test('heat_wave').scenario, { ...plan, ids: [...plan.ids] }, opts);
    expect(r.plan!.persistent).toBeNull();
    expect(r.recommendation).toBeNull();
    expect(r.notes.join(' ')).toMatch(/temporary/i);
    expect(r.delta.cost).toBeGreaterThan(0);
  });

  it('shows low solar only through a plan with solar', () => {
    const solar = { label: 'Solar', source: 'custom' as const, ids: ['rooftop_solar' as const], amounts: { solarKw: 40 } };
    const r = stressTestReport(demo, test('low_solar'), {}, test('low_solar').scenario, { ...solar, ids: [...solar.ids] }, opts);
    expect(r.delta.cost).toBeCloseTo(0, 6);
    expect(r.plan!.savingsStressed).toBeLessThan(r.plan!.savingsNormal);
    expect(r.plan!.savingsStressed / r.plan!.savingsNormal).toBeCloseTo(0.85, 1);
  });
});
