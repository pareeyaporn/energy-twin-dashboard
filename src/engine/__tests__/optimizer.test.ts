import { describe, expect, it } from 'vitest';
import presets from '@/data/presetHomes.json';
import { DEFAULT_ASSUMPTIONS } from '../constants';
import { templateExplanation } from '../explain';
import { optimize } from '../optimizer';
import type { Goal, Home, OptimizerResult } from '../types';

// The preset entries already carry every Home field (plus UI-only extras the engine ignores).
const preset = (id: string): Home => {
  const p = presets.find((x) => x.id === id);
  if (!p) throw new Error(`unknown preset ${id}`);
  return p as unknown as Home;
};

const maya = preset('maya');
const usd = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`;

describe('optimizer', () => {
  const result = optimize(maya, 15000, 'best_value');

  it("prints Maya's top 3 for a $15,000 budget and the best_value goal", () => {
    const lines = result.top.map(
      (p, i) =>
        `#${i + 1} ${p.name}\n` +
        `   cost mid ${usd(p.cost.mid)} [${usd(p.cost.low)}–${usd(p.cost.high)}]  ` +
        `savings/yr low ${usd(p.annualSavings.low)} mid ${usd(p.annualSavings.mid)} high ${usd(p.annualSavings.high)}  ` +
        `payback ${p.paybackYears?.toFixed(1) ?? 'none'} yr  value15 ${usd(p.value15)}  ` +
        `heatPumpTons ${p.outcome.heatPumpTons ?? '-'}\n` +
        `   new bill ${usd(p.newAnnualCost)}  reason: ${p.reason}`,
    );
    console.log(
      `Maya, budget $15,000, best_value: ${result.combinationsTested} tested, ${result.feasibleCount} fit the budget\n` +
        lines.join('\n'),
    );
    expect(result.top.length).toBeGreaterThan(0);
  });

  // Test 2
  it("returns the same top 3 for Maya at $15,000 and best_value every run", () => {
    const ids = (r: OptimizerResult) => r.top.map((p) => p.id);
    expect(ids(optimize(maya, 15000, 'best_value'))).toEqual(ids(result));
    expect(ids(result)).toMatchInlineSnapshot(`
      [
        "attic_insulation+smart_thermostat",
        "attic_insulation+air_sealing+smart_thermostat",
        "attic_insulation",
      ]
    `);
  });

  // Test 3
  it('never returns a package over budget', () => {
    for (const home of presets as unknown as Home[]) {
      for (const budget of [0, 300, 1500, 5000, 15000, 40000]) {
        for (const goal of ['max_savings', 'fastest_payback', 'best_value'] as Goal[]) {
          for (const p of optimize(home, budget, goal).top) expect(p.cost.mid).toBeLessThanOrEqual(budget);
        }
      }
    }
  });

  // Test 4
  it('tests 32 combinations for Maya', () => {
    expect(result.combinationsTested).toBe(32);
    expect(result.feasibleCount).toBeLessThanOrEqual(31); // the empty set is tested but never returned
  });

  // Test 10
  it('never offers a heat pump to a home that already has one (Phoenix)', () => {
    const r = optimize(preset('phoenix'), 40000, 'max_savings');
    expect(r.combinationsTested).toBe(16);
    for (const p of r.top) expect(p.upgradeIds).not.toContain('heat_pump');
  });

  it('returns at most 3 packages, all saving money, with ordered ranges and a reason', () => {
    expect(result.top.length).toBeLessThanOrEqual(3);
    for (const p of result.top) {
      expect(p.annualSavings.mid).toBeGreaterThan(0);
      expect(p.annualSavings.low).toBeLessThanOrEqual(p.annualSavings.mid);
      expect(p.annualSavings.mid).toBeLessThanOrEqual(p.annualSavings.high);
      expect(p.cost.low).toBeLessThanOrEqual(p.cost.mid);
      expect(p.cost.mid).toBeLessThanOrEqual(p.cost.high);
      expect(p.reason.length).toBeGreaterThan(0);
      expect(p.id).toBe(p.upgradeIds.join('+'));
    }
  });

  it('line items add up to the package cost and savings', () => {
    for (const p of result.top) {
      expect(p.lineItems.reduce((s, l) => s + l.cost, 0)).toBeCloseTo(p.cost.mid, 6);
      expect(p.lineItems.reduce((s, l) => s + l.savings, 0)).toBeCloseTo(p.annualSavings.mid, 6);
    }
  });

  it('ranks by the chosen goal', () => {
    const savings = optimize(maya, 15000, 'max_savings').top.map((p) => p.annualSavings.mid);
    expect(savings).toEqual([...savings].sort((a, b) => b - a));
    const payback = optimize(maya, 15000, 'fastest_payback').top.map((p) => p.paybackYears ?? Infinity);
    expect(payback).toEqual([...payback].sort((a, b) => a - b));
    const value = optimize(maya, 15000, 'best_value').top.map((p) => p.value15);
    expect(value).toEqual([...value].sort((a, b) => b - a));
  });

  it('returns nothing when the budget is too small, and says so', () => {
    const r = optimize(maya, 100, 'best_value');
    expect(r.top).toEqual([]);
    expect(r.feasibleCount).toBe(0);
    expect(templateExplanation(r)).toMatch(/None of the combinations/);
  });

  it('is fast: well under 50 ms', () => {
    const t = performance.now();
    optimize(maya, 15000, 'best_value');
    expect(performance.now() - t).toBeLessThan(50);
  });

  it('lower discount rate never lowers the best net value', () => {
    const lo = optimize(maya, 15000, 'best_value', { ...DEFAULT_ASSUMPTIONS, discountRate: 0.03 });
    const hi = optimize(maya, 15000, 'best_value', { ...DEFAULT_ASSUMPTIONS, discountRate: 0.05 });
    expect(lo.top[0]!.value15).toBeGreaterThan(hi.top[0]!.value15);
  });
});

describe('templateExplanation', () => {
  const text = templateExplanation(optimize(maya, 15000, 'best_value'));

  it('is 4–6 sentences', () => {
    const sentences = text.split(/(?<=\.)\s+(?=[A-Z])/);
    expect(sentences.length).toBeGreaterThanOrEqual(4);
    expect(sentences.length).toBeLessThanOrEqual(6);
  });

  it('only uses numbers from the result and mentions a limitation', () => {
    const r = optimize(maya, 15000, 'best_value');
    const allowed = new Set<string>([
      String(r.combinationsTested),
      String(r.feasibleCount),
      '15',
      '000',
      '1',
      '2',
      '3',
    ]);
    const usdNum = (n: number) => String(Math.round(Math.abs(n)));
    allowed.add(usdNum(r.budget));
    allowed.add(usdNum(r.baseline.costs.total));
    for (const p of r.top) {
      [p.cost.low, p.cost.mid, p.cost.high, p.annualSavings.low, p.annualSavings.mid, p.annualSavings.high, p.newAnnualCost].forEach((n) => allowed.add(usdNum(n)));
      if (p.paybackYears != null) allowed.add(p.paybackYears.toFixed(1));
    }
    const first = r.top[0]!;
    for (const p of r.top.slice(1)) {
      allowed.add(usdNum(p.annualSavings.mid - first.annualSavings.mid));
      allowed.add(usdNum(p.cost.mid - first.cost.mid));
    }
    // strip thousands separators, then check every number in the text
    const nums = (text.replace(/(\d),(?=\d{3})/g, '$1').match(/\d+(\.\d+)?/g) ?? []).filter((n) => !allowed.has(n));
    // numbers inside upgrade names (e.g. "R-49") come from upgrades.json labels
    expect(nums.filter((n) => n !== '49')).toEqual([]);
    expect(text).toMatch(/planning estimates/);
  });
});
