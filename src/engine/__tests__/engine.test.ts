import { describe, expect, it } from 'vitest';
import presets from '@/data/presetHomes.json';
import rates from '@/data/rates.json';
import { estimateBaseline } from '../baseline';
import type { Home } from '../types';

function homeFromPreset(id: string): Home {
  const p = presets.find((x) => x.id === id);
  if (!p) throw new Error(`unknown preset ${id}`);
  return {
    id: p.id,
    label: p.label,
    zip: p.zip,
    state: p.state,
    climateZone: p.climateZone,
    sqft: p.sqft,
    stories: p.stories as Home['stories'],
    yearBuilt: p.yearBuilt,
    heatingFuel: p.heatingFuel as Home['heatingFuel'],
    heatingSystem: p.heatingSystem as Home['heatingSystem'],
    coolingSystem: p.coolingSystem as Home['coolingSystem'],
    monthlyElectricBill: p.monthlyElectricBill,
    monthlyFuelBill: p.monthlyFuelBill,
    ...('inspectionNotes' in p ? { inspectionNotes: p.inspectionNotes } : {}),
  };
}

describe('baseline', () => {
  // Test 1
  it("Maya's baseline total is within 2% of her bills minus fixed charges", () => {
    const maya = homeFromPreset('maya');
    const il = rates.IL;
    const expected =
      (maya.monthlyElectricBill! - il.elecFixedMonthly) * 12 + (maya.monthlyFuelBill! - il.gasFixedMonthly) * 12;
    const b = estimateBaseline(maya);
    expect(Math.abs(b.costs.total - expected) / expected).toBeLessThan(0.02);
    expect(b.estimated).toBe(false);
  });

  it('cost categories add up to the total, for every preset', () => {
    for (const p of presets) {
      const { costs } = estimateBaseline(homeFromPreset(p.id));
      expect(costs.heating + costs.cooling + costs.waterHeating + costs.other).toBeCloseTo(costs.total, 6);
    }
  });

  // Test 7 (baseline part): pure and deterministic. The upgrade half of test 7 arrives with applyUpgrades (P4).
  it('is deterministic and does not mutate its input', () => {
    const maya = homeFromPreset('maya');
    const snapshot = JSON.stringify(maya);
    expect(estimateBaseline(maya)).toEqual(estimateBaseline(maya));
    expect(JSON.stringify(maya)).toBe(snapshot);
  });

  // Test 11
  it('part intensities are in [0, 1] and at least one equals 1', () => {
    for (const p of presets) {
      const { parts } = estimateBaseline(homeFromPreset(p.id));
      for (const part of parts) {
        expect(part.intensity).toBeGreaterThanOrEqual(0);
        expect(part.intensity).toBeLessThanOrEqual(1);
      }
      expect(Math.max(...parts.map((x) => x.intensity))).toBe(1);
      expect(parts.reduce((s, x) => s + x.share, 0)).toBeCloseTo(1, 6);
    }
  });

  it('handles an all-electric home (Phoenix): no fuel use, heat pump efficiency', () => {
    const b = estimateBaseline(homeFromPreset('phoenix'));
    expect(b.fuelKWh).toBe(0);
    expect(b.heatingEfficiency).toBe(2.3);
    expect(b.costs.cooling).toBeGreaterThan(b.costs.heating);
  });

  it('handles oil and no cooling (Boston)', () => {
    const b = estimateBaseline(homeFromPreset('boston'));
    expect(b.fuelKWh).toBeGreaterThan(0);
    expect(b.coolingCOP).toBe(0);
    expect(b.costs.cooling).toBe(0);
    expect(b.coolingLoadKWh).toBe(0);
  });

  it('uses climate-zone averages and flags estimated when the electric bill is missing', () => {
    const { monthlyElectricBill: _omit, ...rest } = homeFromPreset('maya');
    const b = estimateBaseline(rest as Home);
    expect(b.estimated).toBe(true);
    expect(b.elecKWh).toBeCloseTo(9500 * (1850 / 1800), 6);
  });

  it('older furnaces score lower than newer ones', () => {
    const old = estimateBaseline(homeFromPreset('maya'));
    const newer = estimateBaseline({ ...homeFromPreset('maya'), yearBuilt: 2015 });
    expect(newer.hvacEfficiencyScore).toBeGreaterThan(old.hvacEfficiencyScore);
  });

  it('throws a clear error for a state with no rates', () => {
    expect(() => estimateBaseline({ ...homeFromPreset('maya'), state: 'ZZ' })).toThrow(/No rates/);
  });
});
