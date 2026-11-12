import { describe, expect, it } from 'vitest';
import { explainPortfolio } from '../explain';
import { optimizeInvestmentPortfolio } from '../optimizer';
import { evaluatePackage } from '../package';
import { presetProfile } from '../profile';
import { prepareUpgradeContext } from '../upgrades';
import type { Objective } from '../types';

const demo = presetProfile('demo-chicago-100');
const ctx = prepareUpgradeContext(demo);
const run = (budget: number, extra: Parameters<typeof optimizeInvestmentPortfolio>[1] = {}) =>
  optimizeInvestmentPortfolio(ctx, { budget, ...extra });
const sum = (xs: number[]) => xs.reduce((s, x) => s + x, 0);
const close = (a: number, b: number, tol = 1e-6) => expect(Math.abs(a - b)).toBeLessThanOrEqual(tol * Math.max(1, Math.abs(b)));

describe('optimizeInvestmentPortfolio', () => {
  it('never exceeds the budget', () => {
    for (const budget of [0, 5000, 7000, 20000, 30000, 50000, 100000, 250000, 1_000_000]) {
      const r = run(budget);
      for (const p of r.packages) expect(p.evaluation.cost.mid).toBeLessThanOrEqual(budget);
      for (const c of r.candidates) expect(c.cost).toBeLessThanOrEqual(budget);
      expect(r.objectiveWinner === null || r.objectiveWinner.evaluation.cost.mid <= budget).toBe(true);
    }
  });

  it('tests every combination of the eligible upgrades', () => {
    const r = run(50000);
    expect(r.combinationsTested).toBe(256);
    expect(r.feasibleCount).toBeGreaterThan(0);
    expect(r.feasibleCount + r.rejected.overBudget + r.rejected.comfort + r.rejected.invalid).toBe(255); // all but the empty set
  });

  it('is deterministic', () => {
    expect(run(50000)).toEqual(run(50000));
    expect(optimizeInvestmentPortfolio(demo, { budget: 50000 })).toEqual(run(50000));
  });

  it('returns the same three packages for the 100-room, $50,000 case (snapshot)', () => {
    const r = run(50000);
    expect(r.packages.map((p) => [p.role, p.evaluation.id])).toMatchInlineSnapshot(`
      [
        [
          "max_savings",
          "led_lighting+occupancy_sensors",
        ],
        [
          "fastest_payback",
          "occupancy_sensors",
        ],
        [
          "balanced",
          "led_lighting",
        ],
      ]
    `);
  });

  it('returns three distinct packages when enough fit', () => {
    for (const budget of [30000, 50000, 100000, 250000]) {
      const r = run(budget);
      expect(r.packages.map((p) => p.role)).toEqual(['max_savings', 'fastest_payback', 'balanced']);
      expect(new Set(r.packages.map((p) => p.evaluation.id)).size).toBe(3);
    }
  });

  it('gives each role its true winner, or the runner-up with a note when the winner already took another role', () => {
    for (const budget of [30000, 50000, 100000, 250000]) {
      const r = run(budget);
      const [maxS, fast, bal] = r.packages;
      const best = (f: (c: (typeof r.candidates)[number]) => number, dir: 1 | -1) => dir * Math.max(...r.candidates.map((c) => dir * f(c)));
      // Maximum savings is decided first, so it is always the true winner.
      close(maxS!.evaluation.annualSavings.mid, best((c) => c.annualSavings, 1));
      expect(maxS!.note).toBeUndefined();
      const taken = new Set([maxS!.evaluation.id]);
      for (const [p, f, dir] of [
        [fast!, (c: (typeof r.candidates)[number]) => c.paybackYears ?? Infinity, -1],
        [bal!, (c: (typeof r.candidates)[number]) => c.balancedScore, 1],
      ] as const) {
        const value = p === fast ? (p.evaluation.metrics.paybackYears ?? Infinity) : p.balancedScore;
        if (p.note === undefined) close(value, best(f, dir));
        else {
          expect(p.note).toMatch(/runner-up/);
          const rest = r.candidates.filter((c) => !taken.has(c.id));
          close(value, dir * Math.max(...rest.map((c) => dir * f(c))));
        }
        taken.add(p.evaluation.id);
      }
    }
  });

  it('shows the runner-up, with a note, when one package would win two roles', () => {
    const r = run(50000);
    const winnerId = r.objectiveWinner!.evaluation.id; // the true balanced winner
    const bal = r.packages.find((p) => p.role === 'balanced')!;
    expect(r.packages[0]!.evaluation.id).toBe(winnerId); // it already won maximum savings
    expect(bal.evaluation.id).not.toBe(winnerId);
    expect(bal.note).toMatch(/runner-up/);
    const others = r.candidates.filter((c) => c.id !== r.packages[0]!.evaluation.id && c.id !== r.packages[1]!.evaluation.id);
    close(bal.balancedScore, Math.max(...others.map((c) => c.balancedScore)));
  });

  it('highlights the winner for the objective', () => {
    const cases: [Objective, (c: (typeof run extends (...a: never[]) => infer R ? R : never)['candidates'][number]) => number, 1 | -1][] = [
      ['annual_savings', (c) => c.annualSavings, 1],
      ['payback', (c) => c.paybackYears ?? Infinity, -1],
      ['roi', (c) => c.roi ?? -Infinity, 1],
      ['carbon', (c) => c.carbonAvoidedKg, 1],
      ['balanced', (c) => c.balancedScore, 1],
    ];
    for (const [objective, f, dir] of cases) {
      const r = run(100000, { objective });
      const best = dir * Math.max(...r.candidates.map((c) => dir * f(c)));
      const winner = r.candidates.find((c) => c.id === r.objectiveWinner!.evaluation.id)!;
      close(f(winner), best);
      expect(r.objective).toBe(objective);
    }
  });

  it('accounts for interactions: a package saves less than the sum of its parts', () => {
    const r = run(100000);
    const ledSensors = r.candidates.find((c) => c.id === 'led_lighting+occupancy_sensors')!;
    const apart =
      r.candidates.find((c) => c.id === 'led_lighting')!.annualSavings + r.candidates.find((c) => c.id === 'occupancy_sensors')!.annualSavings;
    expect(ledSensors.annualSavings).toBeLessThan(apart);
    // and the optimizer's numbers agree with a direct package evaluation
    close(ledSensors.annualSavings, evaluatePackage(ctx, ['led_lighting', 'occupancy_sensors'], { lineItems: false }).annualSavings.mid);
  });

  it('fills in every field a package needs', () => {
    const r = run(50000);
    for (const p of r.packages) {
      const e = p.evaluation;
      expect(e.cost.mid).toBeGreaterThan(0);
      expect(e.annualSavings.low).toBeLessThanOrEqual(e.annualSavings.high);
      expect(e.metrics.netBenefit).toBeDefined();
      expect(e.carbonAvoidedKg.mid).toBeGreaterThan(0);
      close(e.metrics.remainingBudget, 50000 - e.cost.mid);
      expect(e.comfort.score).toBeGreaterThan(0);
      expect(e.lineItems.length).toBe(e.upgradeIds.length);
      close(sum(e.lineItems.map((l) => l.annualSavingsMid)), e.annualSavings.mid);
      expect(p.reason.length).toBeGreaterThan(10);
    }
  });

  it('flags a package whose high-end cost would exceed the budget', () => {
    const r = run(50000);
    for (const p of r.packages) expect(p.budgetRisk).toBe(p.evaluation.cost.high > 50000);
    expect(r.packages.some((p) => p.budgetRisk)).toBe(true);
    expect(r.packages.some((p) => !p.budgetRisk)).toBe(true);
  });

  it('returns a clear empty result when the budget is too small', () => {
    for (const budget of [0, 5000]) {
      const r = run(budget);
      expect(r.packages).toEqual([]);
      expect(r.objectiveWinner).toBeNull();
      expect(r.feasibleCount).toBe(0);
      expect(r.emptyReason).toMatch(/No combination fits/);
    }
    const r = run(5000);
    expect(r.cheapestUseful?.id).toBe('occupancy_sensors');
    expect(r.cheapestUseful!.cost).toBeGreaterThan(5000);
  });

  it('respects the comfort limit', () => {
    const r = run(100000, { minComfortScore: 0.96 });
    expect(r.rejected.comfort).toBeGreaterThan(0);
    for (const p of r.packages) expect(p.evaluation.comfort.score).toBeGreaterThanOrEqual(0.96);
    for (const c of r.candidates) expect(c.comfortScore).toBeGreaterThanOrEqual(0.96);
    expect(run(100000, { minComfortScore: 1.01 }).packages).toEqual([]);
  });

  it('only recommends packages that save a meaningful share of the bill', () => {
    const r = run(100000, { minSavingsShare: 0.05 });
    expect(r.rejected.belowSavingsThreshold).toBeGreaterThan(0);
    for (const p of r.packages) expect(p.evaluation.annualSavings.mid).toBeGreaterThanOrEqual(0.05 * r.baselineAnnualCost);
  });

  it('skips upgrades the hotel already has', () => {
    const withControls = prepareUpgradeContext({ ...demo, profile: { ...demo.profile, smartRoomControls: true } });
    const r = optimizeInvestmentPortfolio(withControls, { budget: 250000 });
    expect(r.combinationsTested).toBe(128);
    expect(r.candidates.every((c) => !c.upgradeIds.includes('smart_room_controls'))).toBe(true);
  });

  it('uses the profile budget and objective by default, and the horizon it is given', () => {
    const r = optimizeInvestmentPortfolio(demo);
    expect(r.budget).toBe(demo.profile.budget);
    expect(r.objective).toBe(demo.profile.objective);
    const long = run(50000, { assumptions: { horizonYears: 10 } });
    expect(long.packages[0]!.evaluation.metrics.horizonYears).toBe(10);
    expect(long.packages[0]!.evaluation.metrics.netBenefit).toBeGreaterThan(r.packages[0]!.evaluation.metrics.netBenefit);
  });

  it('is fast enough to run in the browser', () => {
    const t = performance.now();
    run(50000);
    run(250000);
    expect(performance.now() - t).toBeLessThan(2000);
  });
});

describe('explainPortfolio', () => {
  const r = run(50000);
  const text = explainPortfolio(r);

  it('is 4 to 6 sentences and mentions a limitation', () => {
    const sentences = text.split(/(?<=\.)\s+(?=[A-Z])/);
    expect(sentences.length).toBeGreaterThanOrEqual(4);
    expect(sentences.length).toBeLessThanOrEqual(6);
    expect(text).toMatch(/planning estimates/);
  });

  it('only uses numbers that are in the result', () => {
    const allowed = new Set<string>([String(r.combinationsTested), String(r.feasibleCount), String(Math.round(r.budget)), String(Math.round(r.baselineAnnualCost))]);
    const rounded = (n: number) => String(Math.round(Math.abs(n)));
    for (const p of r.packages) {
      const e = p.evaluation;
      [e.cost.low, e.cost.mid, e.cost.high, e.annualSavings.low, e.annualSavings.mid, e.annualSavings.high, e.metrics.netBenefit, e.metrics.remainingBudget].forEach((n) => allowed.add(rounded(n)));
      if (e.metrics.paybackYears != null) allowed.add(e.metrics.paybackYears.toFixed(1));
      allowed.add(String(Math.round(e.carbonAvoidedKg.mid / 100) / 10));
    }
    const numbers = (text.replace(/CO2e/g, 'carbon').replace(/(\d),(?=\d{3})/g, '$1').match(/\d+(\.\d+)?/g) ?? []).filter((n) => !allowed.has(n));
    expect(numbers).toEqual([]);
  });

  it('says plainly when nothing fits', () => {
    const empty = explainPortfolio(run(5000));
    expect(empty).toMatch(/none of them fit/);
    expect(empty).toMatch(/cheapest useful upgrade/);
    const sentences = empty.split(/(?<=\.)\s+(?=[A-Z])/);
    expect(sentences.length).toBeGreaterThanOrEqual(3);
  });
});
