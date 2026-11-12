import { describe, expect, it } from 'vitest';
import {
  STRESS_TESTS,
  evaluatePlan,
  evaluatePortfolioCustomPlan,
  hotelPortfolio,
  optimizePortfolioBudget,
  planFromPackage,
  portfolioStressReport,
  prepareProperty,
  stressTestReport,
} from '..';

const props = hotelPortfolio.properties;
const byId = (id: string) => props.find((p) => p.id === id)!;
const test = (id: string) => STRESS_TESTS.find((t) => t.id === id)!;

describe('evaluatePortfolioCustomPlan', () => {
  it('evaluates each property exactly like its own plan builder and adds them up', () => {
    const plans = {
      'lakeshore-inn': [{ id: 'led_lighting' as const }, { id: 'occupancy_sensors' as const }],
      'ohare-gateway': [{ id: 'smart_room_controls' as const, quantity: 110 }],
    };
    const items = props.map((property) => ({
      property,
      plan: plans[property.id as keyof typeof plans] ? { id: `p-${property.id}`, name: 'Mine', items: plans[property.id as keyof typeof plans] } : null,
    }));
    const r = evaluatePortfolioCustomPlan(items, { budget: 500_000 });
    expect(r.rows).toHaveLength(5);
    for (const [id, planItems] of Object.entries(plans)) {
      const own = evaluatePlan(prepareProperty(byId(id)).ctx, planItems, { assumptions: { discountRate: 0.08 }, budget: 500_000, lineItems: false });
      const row = r.rows.find((x) => x.propertyId === id)!;
      expect(row.plan!.evaluation!.financials.annualSavings.mid).toBeCloseTo(own.evaluation!.financials.annualSavings.mid, 6);
    }
    const sum = r.rows.reduce((t, x) => t + (x.plan?.evaluation?.financials.annualSavings.mid ?? 0), 0);
    expect(r.totals.annualSavings).toBeCloseTo(sum, 6);
    expect(r.totals.propertiesWithPackage).toBe(2);
    expect(r.overBudget).toBe(false);
    expect(r.totals.remainingBudget).toBeCloseTo(500_000 - r.totals.grossCost, 6);
  });

  it('flags a portfolio over budget and an empty selection', () => {
    const items = props.map((property) => ({ property, plan: { id: 'x', name: 'All LED', items: [{ id: 'led_lighting' as const }] } }));
    const r = evaluatePortfolioCustomPlan(items, { budget: 50_000 });
    expect(r.overBudget).toBe(true);
    expect(r.warnings[0]).toMatch(/over the \$50,000 portfolio budget/);
    const none = evaluatePortfolioCustomPlan(props.map((property) => ({ property, plan: null })), { budget: 50_000 });
    expect(none.totals.grossCost).toBe(0);
    expect(none.warnings.join(' ')).toMatch(/Choose a custom plan/);
  });

  it('copying the AI portfolio into custom plans gives the same totals', () => {
    const ai = optimizePortfolioBudget(props.map((property) => ({ property })), { budget: 500_000 });
    const items = props.map((property) => {
      const a = ai.allocations.find((x) => x.propertyId === property.id)!;
      return {
        property,
        plan: a.candidate ? { id: property.id, name: 'Copy', items: planFromPackage(prepareProperty(property).ctx, a.candidate.upgradeIds) } : null,
      };
    });
    const mine = evaluatePortfolioCustomPlan(items, { budget: 500_000 });
    expect(mine.totals.annualSavings).toBeCloseTo(ai.totals.annualSavings, 4);
    expect(mine.totals.grossCost).toBeCloseTo(ai.totals.grossCost, 4);
    expect(mine.totals.npv10).toBeCloseTo(ai.totals.npv10, 2);
    expect(ai.totals.comfortScore).not.toBeNull();
  });
});

describe('portfolioStressReport', () => {
  const ai = optimizePortfolioBudget(props.map((property) => ({ property })), { budget: 500_000 });
  const withAi = props.map((property) => {
    const a = ai.allocations.find((x) => x.propertyId === property.id)!;
    return { property, plan: a.candidate ? { label: 'AI', source: 'ai' as const, ids: a.candidate.upgradeIds } : null };
  });
  const all = props.map((p) => p.id);

  it('matches the single-hotel stress report for every property in scope', () => {
    const r = portfolioStressReport(withAi, test('heat_wave'), all);
    for (const row of r.rows) {
      const item = withAi.find((x) => x.property.id === row.propertyId)!;
      const own = stressTestReport(prepareProperty(item.property).hotel, test('heat_wave'), {}, test('heat_wave').scenario, item.plan, { budget: Infinity, objective: 'balanced', discountRate: 0.08, recommend: false });
      expect(row.stressedCost).toBeCloseTo(own.stressed.cost, 6);
      expect(row.withPlanStressed).toBeCloseTo(own.plan?.costWithPlanStressed ?? own.stressed.cost, 6);
    }
    expect(r.totals.increase).toBeGreaterThan(0);
    expect(r.totals.stressedCost).toBeCloseTo(r.rows.reduce((t, x) => t + x.stressedCost, 0), 6);
    expect(r.notes[0]).toMatch(/temporary/i);
  });

  it('leaves properties outside the scope unchanged', () => {
    const r = portfolioStressReport(withAi, test('price_up_20'), ['ohare-gateway']);
    for (const row of r.rows) {
      if (row.propertyId === 'ohare-gateway') expect(row.stressedCost).toBeGreaterThan(row.normalCost);
      else {
        expect(row.inScope).toBe(false);
        expect(row.stressedCost).toBe(row.normalCost);
        expect(row.withPlanStressed).toBe(row.withPlanNormal);
      }
    }
    expect(r.rows.find((x) => x.propertyId === 'ohare-gateway')!.report!.plan!.persistent).not.toBeNull();
    // Plans save more when electricity costs more, so they absorb part of the increase.
    expect(r.totals.extraAvoided).toBeGreaterThan(0);
    expect(r.totals.shareOfIncreaseAbsorbed).toBeGreaterThan(0);
  });

  it('without plans, costs with and without plans are equal', () => {
    const r = portfolioStressReport(props.map((property) => ({ property, plan: null })), test('cold_snap'), all);
    expect(r.totals.withPlansStressed).toBeCloseTo(r.totals.stressedCost, 6);
    expect(r.totals.savingsStressed).toBeCloseTo(0, 6);
  });
});
