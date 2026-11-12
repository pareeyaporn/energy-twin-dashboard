import { describe, expect, it } from 'vitest';
import { evaluatePackage } from '../package';
import { optimizeInvestmentPortfolio } from '../optimizer';
import { evaluatePlan, evaluatePlanItem, explainPlan, planFromPackage, upgradeCatalog } from '../plans';
import { presetProfile } from '../profile';
import { prepareUpgradeContext } from '../upgrades';
import type { UpgradeId } from '../types';

const demo = presetProfile('demo-chicago-100');
const ctx = prepareUpgradeContext(demo);
const close = (a: number, b: number, tol = 1e-9) => expect(Math.abs(a - b)).toBeLessThanOrEqual(tol * Math.max(1, Math.abs(b)));

describe('custom plans use the optimizer’s calculation', () => {
  it('a plan copied from each recommended package gives exactly the package’s numbers', () => {
    for (const budget of [50000, 150000, 400000]) {
      const plan = optimizeInvestmentPortfolio(ctx, { budget });
      for (const pkg of plan.packages) {
        const custom = evaluatePlan(ctx, planFromPackage(ctx, pkg.evaluation.upgradeIds), { budget }).evaluation!;
        const a = pkg.evaluation.financials;
        const b = custom.financials;
        close(b.grossCost.mid, a.grossCost.mid);
        close(b.annualSavings.mid, a.annualSavings.mid);
        close(b.annualSavings.low, a.annualSavings.low);
        close(b.netBenefit10.mid, a.netBenefit10.mid);
        close(b.npv10!.mid, a.npv10!.mid);
        close(b.carbonAvoidedKgPerYear.mid, a.carbonAvoidedKgPerYear.mid);
        close(custom.comfort.score, pkg.evaluation.comfort.score);
      }
    }
  });

  it('full quantities equal evaluatePackage for every single upgrade and for a big combination', () => {
    const sets: UpgradeId[][] = [['led_lighting'], ['smart_room_controls'], ['insulation'], ['occupancy_sensors'], ['water_heating'],
      ['led_lighting', 'occupancy_sensors', 'smart_room_controls', 'energy_management', 'hvac_upgrade', 'insulation', 'water_heating', 'rooftop_solar']];
    for (const ids of sets) {
      const pkg = evaluatePackage(ctx, ids);
      const plan = evaluatePlan(ctx, ids.map((id) => ({ id }))).evaluation!;
      close(plan.financials.annualSavings.mid, pkg.financials.annualSavings.mid);
      close(plan.financials.grossCost.mid, pkg.financials.grossCost.mid);
    }
  });
});

describe('quantities', () => {
  it('scale cost and savings with coverage, monotonically, without exceeding the whole scope', () => {
    const half = evaluatePlanItem(ctx, { id: 'smart_room_controls', quantity: 50 })!;
    const all = evaluatePlanItem(ctx, { id: 'smart_room_controls', quantity: 100 })!;
    close(half.financials.grossCost.mid, all.financials.grossCost.mid / 2);
    expect(half.financials.annualSavings.mid).toBeGreaterThan(0);
    close(half.financials.annualSavings.mid, all.financials.annualSavings.mid / 2, 1e-6);
    const led = [25, 50, 100].map((q) => evaluatePlanItem(ctx, { id: 'led_lighting', quantity: q })!.financials.annualSavings.mid);
    expect(led[0]).toBeLessThan(led[1]!);
    expect(led[1]).toBeLessThan(led[2]!);
  });

  it('sizes solar in kW within the roof, priced by size', () => {
    const cat = upgradeCatalog(ctx).items.find((i) => i.id === 'rooftop_solar')!;
    expect(cat.quantity.kind).toBe('kw');
    const small = evaluatePlanItem(ctx, { id: 'rooftop_solar', quantity: 20 })!;
    expect(small.financials.solar!.sizeKw).toBe(20);
    const over = evaluatePlan(ctx, [{ id: 'rooftop_solar', quantity: cat.quantity.max * 3 }]);
    expect(over.evaluation!.financials.solar!.sizeKw).toBeCloseTo(cat.quantity.max, 6);
    expect(over.warnings.some((w) => w.kind === 'clamped')).toBe(true);
  });

  it('recomputes combinations instead of summing standalone savings', () => {
    const a = evaluatePlanItem(ctx, { id: 'led_lighting' })!.financials.annualSavings.mid;
    const b = evaluatePlanItem(ctx, { id: 'occupancy_sensors' })!.financials.annualSavings.mid;
    const both = evaluatePlan(ctx, [{ id: 'led_lighting' }, { id: 'occupancy_sensors' }]);
    expect(both.evaluation!.financials.annualSavings.mid).toBeLessThan(a + b);
    expect(both.warnings.some((w) => w.kind === 'overlap')).toBe(true);
  });
});

describe('plan checks and catalog', () => {
  it('warns over budget, ignores unavailable upgrades, and handles an empty plan', () => {
    const big = evaluatePlan(ctx, [{ id: 'hvac_upgrade' }, { id: 'rooftop_solar' }], { budget: 50000 });
    expect(big.warnings[0]!.kind).toBe('budget');
    expect(big.evaluation).not.toBeNull();
    const empty = evaluatePlan(ctx, []);
    expect(empty.evaluation).toBeNull();
    const withSmart = prepareUpgradeContext({ ...demo, profile: { ...demo.profile, smartRoomControls: true } });
    const r = evaluatePlan(withSmart, [{ id: 'smart_room_controls' }, { id: 'led_lighting' }]);
    expect(r.ids).toEqual(['led_lighting']);
    expect(r.warnings.some((w) => w.kind === 'unavailable')).toBe(true);
  });

  it('lists every modeled upgrade by category with its cost status, and the experimental ones separately', () => {
    const c = upgradeCatalog(ctx);
    expect(c.items.map((i) => i.category).sort()).toEqual(['building_water', 'building_water', 'hvac_controls', 'hvac_controls', 'hvac_controls', 'lighting', 'lighting', 'renewable']);
    expect(c.items.find((i) => i.id === 'smart_room_controls')!.costStatus).toBe('sourced');
    expect(c.items.find((i) => i.id === 'led_lighting')!.costStatus).toBe('placeholder');
    expect(c.experimental.length).toBeGreaterThanOrEqual(3);
    for (const x of c.experimental) expect(x.reason).toMatch(/Not modeled/);
  });

  it('explains the recommended package from its numbers', () => {
    const plan = optimizeInvestmentPortfolio(ctx, { budget: 50000 });
    const why = explainPlan(ctx, plan, plan.packages[0]!);
    expect(why[0]).toMatch(/combinations/);
    expect(why.some((l) => /adds \$[\d,]+ a year/.test(l))).toBe(true);
    expect(why.some((l) => /left out/.test(l))).toBe(true);
  });
});
