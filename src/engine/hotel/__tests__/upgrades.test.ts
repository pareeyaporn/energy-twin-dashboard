import { describe, expect, it } from 'vitest';
import { UPGRADE_ORDER } from '../constants';
import { upgradeCost, packageCost } from '../costs';
import { hotelData } from '../data';
import { calculateFinancialMetrics } from '../finance';
import { evaluatePackage } from '../package';
import { presetProfile } from '../profile';
import { calculateUpgradeSavings, comfortFor, orderUpgrades, prepareUpgradeContext, solarSizeKw } from '../upgrades';
import type { HotelData, UpgradeId } from '../types';

const profile = presetProfile('demo-chicago-100');
const ctx = prepareUpgradeContext(profile);
const base = ctx.baseline;
const sum = (xs: number[]) => xs.reduce((s, x) => s + x, 0);
const close = (a: number, b: number, tol = 1e-6) => expect(Math.abs(a - b)).toBeLessThanOrEqual(tol * Math.max(1, Math.abs(b)));
const clone = (d: HotelData): HotelData => JSON.parse(JSON.stringify(d)) as HotelData;
const save = (ids: UpgradeId[]) => calculateUpgradeSavings(ctx, ids, 'mid').savings.cost;
const zoneCost = (cells: { zone: string; cost: number }[], zone: string) => sum(cells.filter((c) => c.zone === zone).map((c) => c.cost));
const endUseCost = (cells: { endUse: string; cost: number }[], u: string) => sum(cells.filter((c) => c.endUse === u).map((c) => c.cost));

describe('ordering and validation', () => {
  it('applies upgrades in a fixed order whatever order they are listed in', () => {
    const a = calculateUpgradeSavings(ctx, ['rooftop_solar', 'led_lighting', 'smart_room_controls', 'insulation'], 'mid');
    const b = calculateUpgradeSavings(ctx, ['insulation', 'smart_room_controls', 'led_lighting', 'rooftop_solar'], 'mid');
    expect(a).toEqual(b);
    expect(orderUpgrades(['rooftop_solar', 'insulation'])).toEqual(['insulation', 'rooftop_solar']);
    expect(orderUpgrades(['led_lighting', 'led_lighting'])).toEqual(['led_lighting']);
  });

  it('rejects unknown upgrades and ones that do not apply', () => {
    expect(() => calculateUpgradeSavings(ctx, ['geothermal' as UpgradeId])).toThrow(/Unknown upgrade/);
    const withControls = prepareUpgradeContext({ ...profile, profile: { ...profile.profile, smartRoomControls: true } });
    expect(() => calculateUpgradeSavings(withControls, ['smart_room_controls'])).toThrow(/does not apply/);
  });

  it('enforces requirements and exclusions defined in the data', () => {
    const d = clone(hotelData);
    const ems = d.upgrades.upgrades.find((u) => u.id === 'energy_management')!;
    ems.requires = ['smart_room_controls'];
    const ins = d.upgrades.upgrades.find((u) => u.id === 'insulation')!;
    ins.excludes = ['hvac_upgrade'];
    const c2 = prepareUpgradeContext(profile, d);
    expect(() => calculateUpgradeSavings(c2, ['energy_management'])).toThrow(/needs/);
    expect(() => calculateUpgradeSavings(c2, ['insulation', 'hvac_upgrade'])).toThrow(/cannot be combined/);
    expect(() => calculateUpgradeSavings(c2, ['energy_management', 'smart_room_controls'])).not.toThrow();
  });

  it('an empty package changes nothing', () => {
    const o = calculateUpgradeSavings(ctx, []);
    expect(o.annual).toEqual(base.annual);
    expect(o.savings.cost).toBe(0);
    expect(o.comfort.score).toBe(1);
  });
});

describe('savings', () => {
  it('every upgrade saves money, energy and carbon on its own', () => {
    for (const id of UPGRADE_ORDER) {
      const s = calculateUpgradeSavings(ctx, [id], 'mid').savings;
      expect(s.cost, id).toBeGreaterThan(0);
      expect(s.carbonKg, id).toBeGreaterThan(0);
      expect(s.siteKBtu, id).toBeGreaterThan(0);
    }
  });

  it('LED lighting lowers lighting and cooling energy and raises heating (less lighting heat)', () => {
    const o = calculateUpgradeSavings(ctx, ['led_lighting'], 'mid');
    expect(endUseCost(o.cells, 'lighting')).toBeLessThan(endUseCost(base.cells, 'lighting'));
    expect(endUseCost(o.cells, 'cooling')).toBeLessThan(endUseCost(base.cells, 'cooling'));
    expect(endUseCost(o.cells, 'heating')).toBeGreaterThan(endUseCost(base.cells, 'heating'));
    expect(endUseCost(o.cells, 'hotWater')).toBe(endUseCost(base.cells, 'hotWater'));
  });

  it('smart room controls only change guest rooms and the plant that serves them', () => {
    const o = calculateUpgradeSavings(ctx, ['smart_room_controls'], 'mid');
    expect(zoneCost(o.cells, 'guest_rooms')).toBeLessThan(zoneCost(base.cells, 'guest_rooms'));
    expect(zoneCost(o.cells, 'central_hvac')).toBeLessThan(zoneCost(base.cells, 'central_hvac'));
    for (const z of ['lobby_common', 'kitchen_restaurant', 'hallways_shared', 'hot_water']) {
      close(zoneCost(o.cells, z), zoneCost(base.cells, z));
    }
  });

  it('overlapping upgrades never double count: the package saves less than the sum of its parts', () => {
    const pairs: UpgradeId[][] = [
      ['smart_room_controls', 'energy_management'],
      ['led_lighting', 'occupancy_sensors'],
      ['insulation', 'hvac_upgrade'],
      ['insulation', 'energy_management'],
    ];
    for (const [a, b] of pairs) {
      const together = save([a!, b!]);
      const apart = save([a!]) + save([b!]);
      expect(together, `${a}+${b}`).toBeLessThan(apart);
      expect(together, `${a}+${b}`).toBeGreaterThan(Math.max(save([a!]), save([b!])));
    }
  });

  it('energy management adds nothing for guest rooms once smart room controls are in', () => {
    const smart = calculateUpgradeSavings(ctx, ['smart_room_controls'], 'mid');
    const both = calculateUpgradeSavings(ctx, ['smart_room_controls', 'energy_management'], 'mid');
    close(zoneCost(both.cells, 'guest_rooms'), zoneCost(smart.cells, 'guest_rooms'));
    expect(zoneCost(both.cells, 'central_hvac')).toBeLessThan(zoneCost(smart.cells, 'central_hvac'));
  });

  it('independent upgrades add up (solar offsets the same kWh whatever else is installed)', () => {
    close(save(['led_lighting', 'rooftop_solar']), save(['led_lighting']) + save(['rooftop_solar']), 1e-9);
    close(save(['water_heating', 'led_lighting']) - save(['water_heating']) - save(['led_lighting']), 0, 1e-9);
  });

  it('solar is sized by the roof or the target share, applied last, and never exceeds what the hotel uses', () => {
    const kw = solarSizeKw(profile.profile, base.annual.elecKWh);
    const roofCap = ((profile.profile.floorAreaSqft / profile.profile.floors) * 0.5) / 100;
    expect(kw).toBeGreaterThan(0);
    expect(kw).toBeLessThanOrEqual(roofCap + 0.05);
    const o = calculateUpgradeSavings(ctx, ['rooftop_solar'], 'mid');
    expect(o.sizing.solarKw).toBe(kw);
    expect(o.sizing.solarKWhYear).toBeCloseTo(o.savings.elecKWh, 6);

    // a giant array on a tiny-use hotel: offset is capped month by month
    const d = clone(hotelData);
    const solar = d.upgrades.upgrades.find((u) => u.id === 'rooftop_solar')!;
    solar.constants['targetShareOfElectricity'] = 5;
    solar.constants['usableRoofShare'] = 1;
    solar.constants['sqftPerKw'] = 5;
    const c2 = prepareUpgradeContext(profile, d);
    const big = calculateUpgradeSavings(c2, ['rooftop_solar'], 'high', d);
    expect(big.annual.elecKWh).toBeGreaterThanOrEqual(0);
    expect(big.savings.elecKWh).toBeLessThanOrEqual(c2.baseline.annual.elecKWh + 1e-6);
    for (let m = 0; m < 12; m++) {
      expect(sum(big.cells.filter((c) => c.month === m).map((c) => c.elecKWh))).toBeGreaterThanOrEqual(-1e-9);
    }
    expect(big.annual.gasTherms).toBeCloseTo(c2.baseline.annual.gasTherms, 6); // gas untouched
  });

  it('savings ranges are ordered low <= mid <= high for every combination', () => {
    for (let mask = 0; mask < 256; mask++) {
      const ids = UPGRADE_ORDER.filter((_, i) => mask & (1 << i));
      const s = (sc: 'low' | 'mid' | 'high') => calculateUpgradeSavings(ctx, ids, sc).savings.cost;
      expect(s('low'), ids.join('+')).toBeLessThanOrEqual(s('mid') + 1e-6);
      expect(s('mid'), ids.join('+')).toBeLessThanOrEqual(s('high') + 1e-6);
    }
  });

  it('is deterministic and leaves the baseline untouched', () => {
    const before = JSON.stringify(base.cells);
    const a = calculateUpgradeSavings(ctx, ['led_lighting', 'smart_room_controls', 'rooftop_solar'], 'high');
    const b = calculateUpgradeSavings(ctx, ['led_lighting', 'smart_room_controls', 'rooftop_solar'], 'high');
    expect(a).toEqual(b);
    expect(JSON.stringify(base.cells)).toBe(before);
  });
});

describe('costs', () => {
  const sizing = { hvacSizeFactor: 1, solarKw: 50 };
  const p = profile.profile; // 100 rooms, 55,000 ft2, 5 floors
  const mid = (id: UpgradeId, s = sizing) => upgradeCost(p, id, s).mid;

  it('follow the cost models', () => {
    close(mid('smart_room_controls'), 260 * 100); // IL-TRM $260 per room
    close(mid('led_lighting'), 0.6 * 55000);
    close(mid('occupancy_sensors'), 0.4 * 55000 * 0.3);
    close(mid('insulation'), 3.5 * (55000 / 5));
    close(mid('water_heating'), 220 * 100);
    close(mid('energy_management'), 15000 + 0.2 * 55000);
    close(mid('hvac_upgrade'), 2 * 55000);
    close(mid('rooftop_solar'), 2800 * 50);
  });

  it('HVAC equipment is cheaper when sized from a reduced load, and ranges are ordered', () => {
    expect(mid('hvac_upgrade', { hvacSizeFactor: 0.8, solarKw: 0 })).toBeCloseTo(0.8 * mid('hvac_upgrade'), 6);
    for (const id of UPGRADE_ORDER) {
      const c = upgradeCost(p, id, sizing);
      expect(c.low).toBeLessThanOrEqual(c.mid);
      expect(c.mid).toBeLessThanOrEqual(c.high);
    }
  });

  it('a package costs the sum of its items; insulation first shrinks the HVAC bill', () => {
    const o = calculateUpgradeSavings(ctx, ['insulation', 'hvac_upgrade'], 'mid');
    expect(o.sizing.hvacSizeFactor).toBeLessThan(1);
    const pc = packageCost(p, ['insulation', 'hvac_upgrade'], o.sizing);
    close(pc.total.mid, sum(pc.items.map((i) => i.cost.mid)));
    const alone = packageCost(p, ['hvac_upgrade'], calculateUpgradeSavings(ctx, ['hvac_upgrade'], 'mid').sizing);
    expect(pc.items.find((i) => i.id === 'hvac_upgrade')!.cost.mid).toBeLessThan(alone.total.mid);
  });
});

describe('comfort', () => {
  it('scores 1 with no upgrades and loses a little for each minor-impact upgrade', () => {
    expect(comfortFor([]).score).toBe(1);
    const smart = calculateUpgradeSavings(ctx, ['smart_room_controls'], 'mid').comfort;
    expect(smart.score).toBeCloseTo(0.95, 9);
    expect(smart.notes.some((n) => n.id === 'smart-controls')).toBe(true);
    expect(comfortFor(['insulation', 'hvac_upgrade', 'led_lighting']).score).toBe(1); // positive or no impact
    expect(comfortFor(['smart_room_controls', 'occupancy_sensors', 'energy_management', 'water_heating']).score).toBeCloseTo(0.8, 9);
  });

  it('warning flags lower the score more', () => {
    const c = comfortFor(['led_lighting'], [{ id: 'x', severity: 'warn', message: 'x' }]);
    expect(c.score).toBeCloseTo(0.85, 9);
  });
});

describe('financial metrics', () => {
  const a = { priceGrowth: 0, discountRate: 0, horizonYears: 5 };
  const items = [{ cost: 3000, lifetimeYears: 15 }];

  it('matches a hand calculation', () => {
    const m = calculateFinancialMetrics({ annualSavings: 1000, carbonAvoidedKgPerYear: 500, items, budget: 10000 }, a);
    expect(m.cost).toBe(3000);
    expect(m.paybackYears).toBe(3);
    expect(m.netBenefit).toBe(5 * 1000 - 3000);
    expect(m.npv).toBe(2000);
    expect(m.npvWithResidual).toBeCloseTo(2000 + 3000 * (10 / 15), 9); // two thirds of the life remains
    expect(m.roi).toBeCloseTo(2000 / 3000, 9);
    expect(m.carbonAvoidedKgHorizon).toBe(2500);
    expect(m.remainingBudget).toBe(7000);
  });

  it('has no payback without savings, and responds to growth and discounting', () => {
    expect(calculateFinancialMetrics({ annualSavings: 0, carbonAvoidedKgPerYear: 0, items, budget: 0 }, a).paybackYears).toBeNull();
    expect(calculateFinancialMetrics({ annualSavings: -50, carbonAvoidedKgPerYear: 0, items, budget: 0 }, a).paybackYears).toBeNull();
    const at = (g: number, r: number) =>
      calculateFinancialMetrics({ annualSavings: 1000, carbonAvoidedKgPerYear: 0, items, budget: 0 }, { priceGrowth: g, discountRate: r, horizonYears: 5 });
    expect(at(0.04, 0.03).netBenefit).toBeGreaterThan(at(0, 0.03).netBenefit);
    expect(at(0.02, 0.05).npv).toBeLessThan(at(0.02, 0.03).npv);
    expect(calculateFinancialMetrics({ annualSavings: 1, carbonAvoidedKgPerYear: 0, items: [], budget: 0 }, a).roi).toBeNull();
  });
});

describe('evaluatePackage', () => {
  it('ties cost, savings ranges, metrics, comfort and line items together', () => {
    const e = evaluatePackage(ctx, ['occupancy_sensors', 'led_lighting']);
    expect(e.id).toBe('led_lighting+occupancy_sensors');
    expect(e.upgradeIds).toEqual(['led_lighting', 'occupancy_sensors']);
    close(e.cost.mid, 33000 + 6600);
    expect(e.annualSavings.low).toBeLessThanOrEqual(e.annualSavings.mid);
    expect(e.annualSavings.mid).toBeLessThanOrEqual(e.annualSavings.high);
    close(e.newAnnualCost, base.annual.cost - e.annualSavings.mid);
    expect(e.metrics.cost).toBe(e.cost.mid);
    close(e.metrics.remainingBudget, profile.profile.budget - e.cost.mid);
    expect(e.metrics.paybackYears).toBeCloseTo(e.cost.mid / e.annualSavings.mid, 9);
    close(sum(e.lineItems.map((l) => l.annualSavingsMid)), e.annualSavings.mid);
    close(sum(e.lineItems.map((l) => l.cost.mid)), e.cost.mid);
    expect(e.comfort.score).toBeCloseTo(0.95, 9);
    expect(e.carbonAvoidedKg.mid).toBeGreaterThan(0);
  });

  it('uses the horizon and assumptions it is given', () => {
    const e = evaluatePackage(ctx, ['led_lighting'], { assumptions: { horizonYears: 10, priceGrowth: 0, gasPriceGrowth: 0 }, budget: 40000, lineItems: false });
    expect(e.metrics.horizonYears).toBe(10);
    close(e.metrics.netBenefit, 10 * e.annualSavings.mid - e.cost.mid);
    close(e.metrics.remainingBudget, 40000 - e.cost.mid);
    expect(e.lineItems).toEqual([]);
  });

  it('keeps equipment size and cost fixed across savings scenarios', () => {
    const e = evaluatePackage(ctx, ['insulation', 'hvac_upgrade'], { lineItems: false });
    expect(e.sizing.hvacSizeFactor).toBeLessThan(1);
    expect(e.cost.low).toBeLessThanOrEqual(e.cost.mid);
    expect(e.cost.mid).toBeLessThanOrEqual(e.cost.high);
  });

  it('handles the empty package', () => {
    const e = evaluatePackage(ctx, []);
    expect(e.name).toBe('No upgrades');
    expect(e.cost.mid).toBe(0);
    expect(e.metrics.paybackYears).toBeNull();
  });

  it('is fast enough to scan every combination', () => {
    const t = performance.now();
    for (let mask = 0; mask < 256; mask++) {
      evaluatePackage(ctx, UPGRADE_ORDER.filter((_, i) => mask & (1 << i)), { lineItems: false });
    }
    expect(performance.now() - t).toBeLessThan(3000);
  });
});
