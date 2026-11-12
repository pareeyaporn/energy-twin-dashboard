import { describe, expect, it } from 'vitest';
import presets from '@/data/presetHomes.json';
import rates from '@/data/rates.json';
import { estimateBaseline } from '../baseline';
import { applyUpgrades, orderUpgrades } from '../upgrades';
import { packageCost } from '../costs';
import { financials } from '../finance';
import { DEFAULT_ASSUMPTIONS } from '../constants';
import { defaultData } from '../data';
import type { Home, UpgradeId } from '../types';

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
    expect(b.costs.cooling).toBeGreaterThan(0);
    expect(b.costs.heating).toBeGreaterThan(0);
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
    expect(b.elecKWh).toBeCloseTo(defaultData.defaults.avgElecKWhPer1800sqft['5A']! * (1850 / 1800), 6);
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

const ALL: UpgradeId[] = ['attic_insulation', 'air_sealing', 'windows', 'heat_pump', 'smart_thermostat'];
const subsets = (ids: UpgradeId[]): UpgradeId[][] =>
  ids.reduce<UpgradeId[][]>((acc, id) => acc.concat(acc.map((s) => [...s, id])), [[]]);

describe('upgrades', () => {
  const maya = homeFromPreset('maya');
  const base = estimateBaseline(maya);

  // Test 7 (upgrade half)
  it('applyUpgrades([]) returns the baseline costs exactly', () => {
    const o = applyUpgrades(maya, base, []);
    expect(o.costs).toEqual(base.costs);
    expect(o.parts).toEqual(base.parts);
  });

  it('applies upgrades in a fixed order regardless of input order', () => {
    const a = applyUpgrades(maya, base, ['smart_thermostat', 'heat_pump', 'attic_insulation']);
    const b = applyUpgrades(maya, base, ['attic_insulation', 'heat_pump', 'smart_thermostat']);
    expect(a).toEqual(b);
    expect(orderUpgrades(['heat_pump', 'attic_insulation'])).toEqual(['attic_insulation', 'heat_pump']);
  });

  it('rejects unknown upgrades and a heat pump for a home that already has one', () => {
    expect(() => orderUpgrades(['solar' as UpgradeId])).toThrow(/Unknown upgrade/);
    const phoenix = homeFromPreset('phoenix');
    expect(() => applyUpgrades(phoenix, estimateBaseline(phoenix), ['heat_pump'])).toThrow(/already has a heat pump/);
  });

  it('no upgrade raises any part intensity, and the non-heat-pump ones lower the bill', () => {
    for (const id of ALL) {
      const o = applyUpgrades(maya, base, [id]);
      if (id !== 'heat_pump') expect(o.costs.total).toBeLessThan(base.costs.total);
      o.parts.forEach((p, i) => expect(p.intensity).toBeLessThanOrEqual(base.parts[i]!.intensity + 1e-9));
    }
  });

  it('attic insulation cools the attic the most', () => {
    const o = applyUpgrades(maya, base, ['attic_insulation']);
    const drop = o.parts.map((p, i) => base.parts[i]!.intensity - p.intensity);
    expect(drop[0]).toBe(Math.max(...drop));
  });

  // Test 5
  it('heat pump is smaller after attic insulation + air sealing than on its own', () => {
    const alone = applyUpgrades(maya, base, ['heat_pump']);
    const sealed = applyUpgrades(maya, base, ['attic_insulation', 'air_sealing', 'heat_pump']);
    expect(sealed.heatPumpTons!).toBeLessThan(alone.heatPumpTons!);
    const cost = (o: typeof alone, ids: UpgradeId[]) => packageCost(maya, ids, o).items.find((i) => i.id === 'heat_pump')!.cost.mid;
    expect(cost(sealed, ['attic_insulation', 'air_sealing', 'heat_pump'])).toBeLessThan(cost(alone, ['heat_pump']));
  });

  // Test 6. The spec states this as "savings <= alone", which assumes the heat pump saves money. At today's
  // prices it costs Maya MORE to run than her gas furnace, so "saves less" is checked on the magnitude: the
  // envelope work shrinks the load the heat pump serves, and the effect is not added on top.
  it('heat pump effect after envelope work is smaller than alone (no double counting)', () => {
    const env = applyUpgrades(maya, base, ['attic_insulation', 'air_sealing']);
    const envHp = applyUpgrades(maya, base, ['attic_insulation', 'air_sealing', 'heat_pump']);
    const hpAlone = applyUpgrades(maya, base, ['heat_pump']);
    const incremental = env.costs.total - envHp.costs.total;
    const alone = base.costs.total - hpAlone.costs.total;
    expect(Math.abs(incremental)).toBeLessThan(Math.abs(alone));
    // Combined saving = envelope saving + incremental heat pump saving, never envelope + full heat pump saving
    const combined = base.costs.total - envHp.costs.total;
    expect(combined).toBeCloseTo(base.costs.total - env.costs.total + incremental, 6);
    expect(combined).not.toBeCloseTo(base.costs.total - env.costs.total + alone, 0);
  });

  it('a heat pump does not change the 3D leaks, only the envelope and thermostat do', () => {
    const hp = applyUpgrades(maya, base, ['heat_pump']);
    hp.parts.forEach((p, i) => expect(p.intensity).toBeCloseTo(base.parts[i]!.intensity, 9));
  });

  it('heat pump removes heating fuel but keeps water heating and other costs', () => {
    const o = applyUpgrades(maya, base, ['heat_pump']);
    expect(o.costs.waterHeating).toBe(base.costs.waterHeating);
    expect(o.costs.other).toBe(base.costs.other);
  });

  it('costs follow the cost models', () => {
    const o = applyUpgrades(maya, base, ALL);
    const { items, total } = packageCost(maya, ALL, o);
    const by = Object.fromEntries(items.map((i) => [i.id, i.cost]));
    expect(by['attic_insulation']!.mid).toBeCloseTo(2.0 * (1850 / 2), 6);
    expect(by['windows']!.mid).toBeCloseTo(850 * Math.round(1850 / 110), 6);
    expect(by['air_sealing']!.mid).toBe(1200);
    expect(by['smart_thermostat']!.mid).toBe(250);
    expect(total.mid).toBeCloseTo(items.reduce((s, i) => s + i.cost.mid, 0), 6);
    expect(() => packageCost(maya, ['heat_pump'], applyUpgrades(maya, base, []))).toThrow(/heatPumpTons/);
  });

  // Test 9
  it('savings ranges are ordered low <= mid <= high for every combination', () => {
    for (const ids of subsets(ALL)) {
      const s = (sc: 'low' | 'mid' | 'high') => base.costs.total - applyUpgrades(maya, base, ids, sc).costs.total;
      expect(s('low')).toBeLessThanOrEqual(s('mid') + 1e-9);
      expect(s('mid')).toBeLessThanOrEqual(s('high') + 1e-9);
    }
  });

  it('heat pump size and cost do not change with the savings scenario', () => {
    const t = (sc: 'low' | 'mid' | 'high') => applyUpgrades(maya, base, ['attic_insulation', 'heat_pump'], sc).heatPumpTons;
    expect(t('low')).toBe(t('mid'));
    expect(t('high')).toBe(t('mid'));
  });
});

describe('finance', () => {
  const maya = homeFromPreset('maya');
  const base = estimateBaseline(maya);
  const ids: UpgradeId[] = ['attic_insulation', 'air_sealing'];
  const o = applyUpgrades(maya, base, ids);
  const savings = base.costs.total - o.costs.total;
  const items = packageCost(maya, ids, o).items.map((i) => ({
    cost: i.cost.mid,
    lifetimeYears: i.id === 'attic_insulation' ? 30 : 15,
  }));

  // Test 8
  it('net value is lower with a 5% discount rate than 3%', () => {
    const v3 = financials(savings, items, { ...DEFAULT_ASSUMPTIONS, discountRate: 0.03 }).value;
    const v5 = financials(savings, items, { ...DEFAULT_ASSUMPTIONS, discountRate: 0.05 }).value;
    expect(v5).toBeLessThan(v3);
  });

  it('payback is cost / first-year savings, and null without savings', () => {
    const f = financials(savings, items, DEFAULT_ASSUMPTIONS);
    expect(f.paybackYears).toBeCloseTo(f.cost / savings, 9);
    expect(financials(0, items, DEFAULT_ASSUMPTIONS).paybackYears).toBeNull();
    expect(financials(-5, items, DEFAULT_ASSUMPTIONS).paybackYears).toBeNull();
  });

  it('matches a hand calculation and counts residual life', () => {
    const a = { priceGrowth: 0, discountRate: 0, horizonYears: 15 };
    // no growth, no discount: 15 x savings - cost + residual (30-year item has half its life left)
    const v = financials(100, [{ cost: 1000, lifetimeYears: 30 }], a).value;
    expect(v).toBeCloseTo(15 * 100 - 1000 + 500, 6);
  });

  it('price growth raises net value', () => {
    const lo = financials(savings, items, { ...DEFAULT_ASSUMPTIONS, priceGrowth: 0 }).value;
    const hi = financials(savings, items, { ...DEFAULT_ASSUMPTIONS, priceGrowth: 0.04 }).value;
    expect(hi).toBeGreaterThan(lo);
  });
});
