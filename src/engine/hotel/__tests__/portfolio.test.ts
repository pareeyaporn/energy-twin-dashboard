import { describe, expect, it } from 'vitest';
import {
  calculateBaselineEnergy,
  chooseOnePerGroup,
  evaluatePackage,
  hotelData,
  hotelPortfolio,
  optimizeInvestmentPortfolio,
  optimizePortfolioBudget,
  portfolioSummary,
  prepareProperty,
  presetProfile,
  propertyCandidates,
} from '..';
import type { PropertyCandidate } from '..';

const items = hotelPortfolio.properties.map((property) => ({ property }));

describe('portfolio data', () => {
  it('has five synthetic Chicago hotels with distinct inputs', () => {
    expect(hotelPortfolio.synthetic).toBe(true);
    expect(hotelPortfolio.properties).toHaveLength(5);
    const ids = new Set(hotelPortfolio.properties.map((p) => p.id));
    expect(ids.size).toBe(5);
    for (const p of hotelPortfolio.properties) {
      expect(p.synthetic).toBe(true);
      expect(p.buildingType).toBe('hotel');
      expect(p.lat).toBeGreaterThan(41.6);
      expect(p.lat).toBeLessThan(42.1);
      expect(p.lng).toBeGreaterThan(-88);
      expect(p.lng).toBeLessThan(-87.5);
    }
    const keys = hotelPortfolio.properties.map((p) => `${p.input.rooms}-${p.input.hvacType}-${p.input.yearBuilt}`);
    expect(new Set(keys).size).toBe(5);
  });
  it('reuses the preset inputs, so those hotels match the single-hotel demo', () => {
    for (const p of hotelPortfolio.properties.filter((x) => x.presetId)) {
      const preset = hotelData.presets.find((x) => x.id === p.presetId)!;
      expect(p.input).toEqual(preset.input);
      const prep = prepareProperty(p);
      expect(prep.baseline.annual.cost).toBeCloseTo(calculateBaselineEnergy(presetProfile(p.presetId!)).annual.cost, 6);
    }
  });
});

describe('portfolioSummary', () => {
  const s = portfolioSummary(items);
  it('totals equal the sum of the properties', () => {
    const sum = (f: (r: (typeof s.properties)[number]) => number) => s.properties.reduce((t, r) => t + f(r), 0);
    expect(s.totals.properties).toBe(5);
    expect(s.totals.cost).toBeCloseTo(sum((r) => r.annual.cost), 6);
    expect(s.totals.elecKWh).toBeCloseTo(sum((r) => r.annual.elecKWh), 6);
    expect(s.totals.gasTherms).toBeCloseTo(sum((r) => r.annual.gasTherms), 6);
    expect(s.totals.rooms).toBe(100 + 300 + 220 + 480 + 72);
    expect(s.totals.savingsPotential).toBeCloseTo(sum((r) => r.potential?.annualSavings ?? 0), 6);
  });
  it('per-property numbers equal the single-hotel engine', () => {
    const demo = s.properties.find((r) => r.id === 'lakeshore-inn')!;
    expect(demo.annual.cost).toBeCloseTo(calculateBaselineEnergy(presetProfile('demo-chicago-100')).annual.cost, 6);
    for (const r of s.properties) {
      if (!r.potential) continue;
      const prep = prepareProperty(hotelPortfolio.properties.find((p) => p.id === r.id)!);
      expect(r.potential.grossCost).toBeLessThanOrEqual(prep.hotel.profile.budget);
      const e = evaluatePackage(prep.ctx, r.potential.upgradeIds, { assumptions: { discountRate: 0.08 } });
      expect(e.financials.grossCost.mid).toBeCloseTo(r.potential.grossCost, 6);
      expect(e.financials.netInvestment.mid).toBeCloseTo(r.potential.netInvestment, 6);
      expect(e.financials.npv10!.mid).toBeCloseTo(r.potential.npv10, 4);
    }
  });
  it('scores priority 0–100 with the best property at 100', () => {
    const scores = s.properties.map((r) => r.priorityScore);
    expect(Math.max(...scores)).toBe(100);
    for (const x of scores) expect(x).toBeGreaterThanOrEqual(0);
  });
});

/** Brute force over every combination of one candidate (or none) per group. */
function brute(groups: { w: number; v: number }[][], cap: number): number {
  let best = 0;
  const rec = (g: number, w: number, v: number) => {
    if (g === groups.length) {
      best = Math.max(best, v);
      return;
    }
    rec(g + 1, w, v);
    for (const c of groups[g]!) if (w + c.w <= cap && c.v > 0) rec(g + 1, w + c.w, v + c.v);
  };
  rec(0, 0, 0);
  return best;
}

describe('chooseOnePerGroup (multiple-choice knapsack)', () => {
  it('matches a brute-force search on small cases', () => {
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let t = 0; t < 40; t++) {
      const groups = Array.from({ length: 3 + (t % 3) }, () =>
        Array.from({ length: 1 + Math.floor(rnd() * 5) }, () => ({ w: 1 + Math.floor(rnd() * 12), v: Math.round(rnd() * 100) - 10 })),
      );
      const cap = 5 + Math.floor(rnd() * 25);
      const dummy = {} as PropertyCandidate;
      const picked = chooseOnePerGroup(groups.map((g) => g.map((x) => ({ ...x, c: dummy }))), cap)!;
      const w = picked.reduce((s, x) => s + (x?.w ?? 0), 0);
      const v = picked.reduce((s, x) => s + (x?.v ?? 0), 0);
      expect(w).toBeLessThanOrEqual(cap);
      expect(v).toBeCloseTo(brute(groups, cap), 9);
    }
  });
});

describe('optimizePortfolioBudget', () => {
  const objectives = ['balanced', 'annual_savings', 'npv10', 'payback', 'carbon'] as const;
  it.each(objectives)('never exceeds the budget (%s)', (objective) => {
    for (const budget of [0, 25_000, 150_000, 500_000]) {
      const plan = optimizePortfolioBudget(items, { budget, objective });
      expect(plan.totals.grossCost).toBeLessThanOrEqual(budget + 1e-6);
      expect(plan.totals.remainingBudget).toBeCloseTo(budget - plan.totals.grossCost, 6);
      expect(plan.allocations).toHaveLength(5);
    }
  });
  it('each property figure equals evaluatePackage for its package', () => {
    const plan = optimizePortfolioBudget(items, { budget: 500_000, objective: 'balanced' });
    expect(plan.allocations.some((a) => a.evaluation)).toBe(true);
    for (const a of plan.allocations) {
      if (!a.evaluation || !a.candidate) continue;
      const prep = prepareProperty(hotelPortfolio.properties.find((p) => p.id === a.propertyId)!);
      const e = evaluatePackage(prep.ctx, a.candidate.upgradeIds, { assumptions: { discountRate: 0.08 } });
      expect(a.evaluation.financials.annualSavings.mid).toBeCloseTo(e.financials.annualSavings.mid, 6);
      expect(a.evaluation.financials.grossCost.mid).toBeCloseTo(e.financials.grossCost.mid, 6);
    }
    const sumSavings = plan.allocations.reduce((s, a) => s + (a.evaluation?.financials.annualSavings.mid ?? 0), 0);
    expect(plan.totals.annualSavings).toBeCloseTo(sumSavings, 6);
  });
  it('maximizes annual savings exactly (no other single swap does better)', () => {
    const budget = 200_000;
    const plan = optimizePortfolioBudget(items, { budget, objective: 'annual_savings' });
    const sets = items.map(({ property }) => propertyCandidates(prepareProperty(property)).candidates);
    // Swapping one property's package for any other that still fits must not increase savings.
    plan.allocations.forEach((a, i) => {
      const others = plan.allocations.reduce((s, b, j) => s + (j === i ? 0 : (b.candidate ? Math.ceil(b.candidate.grossCost / 1000 - 1e-9) : 0)), 0);
      const rest = plan.totals.annualSavings - (a.candidate?.annualSavings ?? 0);
      for (const c of sets[i]!) {
        if (others + Math.ceil(c.grossCost / 1000 - 1e-9) > budget / 1000) continue;
        expect(rest + c.annualSavings).toBeLessThanOrEqual(plan.totals.annualSavings + 1e-6);
      }
    });
  });
  it('fastest payback gives every property a package and beats picking each property its own fastest package', () => {
    const plan = optimizePortfolioBudget(items, { budget: 500_000, objective: 'payback' });
    expect(plan.totals.paybackYears).not.toBeNull();
    expect(plan.allocations.every((a) => a.candidate)).toBe(true);
    const own = items.map(({ property }) =>
      [...propertyCandidates(prepareProperty(property)).candidates].sort((a, b) => a.netInvestment / a.annualSavings - b.netInvestment / b.annualSavings)[0]!,
    );
    const ownPayback = own.reduce((s, c) => s + c.netInvestment, 0) / own.reduce((s, c) => s + c.annualSavings, 0);
    expect(plan.totals.paybackYears!).toBeLessThanOrEqual(ownPayback + 1e-9);
  });
  it('required mode picks exactly one per group, or returns null if the cap is too small', () => {
    const groups = [[{ w: 3, v: -2 }, { w: 1, v: -5 }], [{ w: 2, v: 4 }, { w: 5, v: 9 }], [{ w: 4, v: 1 }]];
    const dummy = {} as PropertyCandidate;
    const wrap = () => groups.map((g) => g.map((x) => ({ ...x, c: dummy })));
    const picked = chooseOnePerGroup(wrap(), 9, true)!;
    expect(picked.every((x) => x)).toBe(true);
    expect(picked.reduce((s, x) => s + x!.v, 0)).toBe(-2 + 4 + 1);
    expect(chooseOnePerGroup(wrap(), 5, true)).toBeNull();
  });
  it('leaves the $50,000 single-hotel answer unchanged', () => {
    const plan = optimizeInvestmentPortfolio(presetProfile('demo-chicago-100'));
    const top = plan.packages.find((p) => p.role === 'max_savings')!;
    expect(top.evaluation.cost.mid).toBeLessThanOrEqual(50_000);
    const alone = optimizePortfolioBudget([{ property: hotelPortfolio.properties[0]! }], { budget: 50_000, objective: 'annual_savings' });
    expect(alone.totals.annualSavings).toBeCloseTo(top.evaluation.annualSavings.mid, 6);
  });
});
