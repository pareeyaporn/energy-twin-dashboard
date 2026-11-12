import { describe, expect, it } from 'vitest';
import { hotelData } from '../data';
import { ANALYSIS_YEAR, incentiveLines, incentiveStatus } from '../finance';
import { evaluatePackage } from '../package';
import { evaluatePlan } from '../plans';
import { presetProfile, resolveProfile } from '../profile';
import { prepareUpgradeContext } from '../upgrades';

const demo = presetProfile('demo-chicago-100');
const ctx = prepareUpgradeContext(demo);
const input = hotelData.presets.find((x) => x.id === 'demo-chicago-100')!.input;
const applied = (ids: Parameters<typeof evaluatePackage>[1], c = ctx) =>
  evaluatePackage(c, ids, { lineItems: false }).financials.incentives.filter((l) => l.applied);
const illustrative = (ids: Parameters<typeof evaluatePackage>[1], c = ctx) =>
  evaluatePackage(c, ids, { lineItems: false }).financials.incentives.filter((l) => l.illustrativeAmount !== undefined);

describe('ComEd standard incentives (2026 HVAC counted; 2025 lighting illustrative)', () => {
  it('the program-year rule: only verified rates for the analysis year count; another year is illustrative', () => {
    expect(ANALYSIS_YEAR).toBe(2026);
    const base = { verified: true, value: 1, applied: true };
    expect(incentiveStatus({ ...base, programYear: 2026 })).toBe('applied');
    expect(incentiveStatus({ ...base, programYear: 2025 })).toBe('illustrative');
    expect(incentiveStatus({ ...base, programYear: '2025 rate (latest worksheet)' })).toBe('illustrative');
    expect(incentiveStatus({ ...base, programYear: 2025 }, 2025)).toBe('applied');
    expect(incentiveStatus({ ...base, programYear: null })).toBe('listed');
    expect(incentiveStatus({ ...base })).toBe('applied'); // older data without the field: no year check
    expect(incentiveStatus({ ...base, verified: false, programYear: 2026 })).toBe('listed');
    expect(incentiveStatus({ ...base, value: null, programYear: 2026 })).toBe('listed');
    expect(incentiveStatus({ ...base, applied: false, programYear: 2026 })).toBe('listed');
  });

  it('does not count the 2025 LED and sensor rates; shows them as illustrative at $0.75 per watt reduced and $0.25 per watt controlled', () => {
    expect(applied(['led_lighting'])).toHaveLength(0);
    expect(applied(['occupancy_sensors'])).toHaveLength(0);
    // 100 rooms × 150 W + 16,500 ft² × 1.0 W = 31,500 W; LED mid reduction 45% → 14,175 W removed
    const led = illustrative(['led_lighting'])[0]!;
    expect(led.amount).toBe(0);
    expect(led.programYear).toBe(2025);
    expect(led.illustrativeAmount).toBeCloseTo(0.75 * 31500 * 0.45, 6);
    // public areas and corridors: 30% of 55,000 ft² × 1.0 W
    expect(illustrative(['occupancy_sensors'])[0]!.illustrativeAmount).toBeCloseTo(0.25 * 16500, 6);
  });

  it('the illustrative figures use the same savings stream, only a lower net investment', () => {
    const f = evaluatePackage(ctx, ['led_lighting', 'occupancy_sensors'], { lineItems: false }).financials;
    const i = f.illustrativeIncentives!;
    expect(i.label).toBe('if ComEd renews the 2025 rate');
    expect(i.programYears).toEqual([2025]);
    expect(i.total).toBeCloseTo(0.75 * 31500 * 0.45 + 0.25 * 16500, 6);
    expect(f.incentivesTotal).toBe(0);
    expect(f.netInvestment.mid).toBeCloseTo(f.grossCost.mid, 6);
    expect(i.netInvestment).toBeCloseTo(f.grossCost.mid - i.total, 6);
    expect(i.simplePaybackYears).toBeCloseTo(i.netInvestment / f.annualSavings.mid, 9);
    // Lowering the investment by the incentive raises the net benefit and NPV by exactly that amount.
    expect(i.netBenefit10 - f.netBenefit10.mid).toBeCloseTo(i.total, 6);
    expect(i.npv10 - f.npv10!.mid).toBeCloseTo(i.total, 6);
    expect(f.assumptions.some((a) => /Not counted: .*2025 rate/.test(a))).toBe(true);
    // An upgrade with only current-year incentives has no illustrative block.
    expect(evaluatePackage(ctx, ['smart_room_controls'], { lineItems: false }).financials.illustrativeIncentives).toBeUndefined();
  });

  it('pays guest room energy management per ton, by how rooms are heated', () => {
    expect(applied(['smart_room_controls'])[0]!.amount).toBeCloseTo(75 * 100 * 0.75, 6); // gas heat, electric AC
    const ptac = prepareUpgradeContext(resolveProfile({ ...input, hvacType: 'ptac' }));
    const lines = applied(['smart_room_controls'], ptac);
    expect(lines).toHaveLength(1);
    expect(lines[0]!.amount).toBeCloseTo(100 * 100 * 0.75, 6); // electric heat
  });

  it('lists HVAC equipment and energy management incentives without applying them', () => {
    for (const id of ['hvac_upgrade', 'energy_management'] as const) {
      const f = evaluatePackage(ctx, [id], { lineItems: false }).financials;
      expect(f.incentivesTotal).toBe(0);
      expect(f.incentives.some((l) => !l.applied && /ComEd/.test(l.label))).toBe(true);
    }
  });

  it('scales with the share installed in a custom plan, and nets out of the investment', () => {
    const half = evaluatePlan(ctx, [{ id: 'smart_room_controls', quantity: 50 }]).evaluation!.financials;
    expect(half.incentivesTotal).toBeCloseTo(75 * 50 * 0.75, 6);
    expect(half.netInvestment.mid).toBeCloseTo(half.grossCost.mid - half.incentivesTotal, 6);
  });

  it('never pays more than 90% of the upgrade’s cost (counted or illustrative)', () => {
    const r = incentiveLines([{ id: 'led_lighting', cost: { low: 1000, mid: 1000, high: 1000 } }], demo.profile, { solarKw: 0 });
    expect(r.total.mid).toBe(0);
    expect(r.illustrativeTotal.mid).toBeCloseTo(900, 6);
    const g = incentiveLines([{ id: 'smart_room_controls', cost: { low: 1000, mid: 1000, high: 1000 } }], demo.profile, { solarKw: 0 });
    expect(g.total.mid).toBeCloseTo(900, 6);
  });
});
