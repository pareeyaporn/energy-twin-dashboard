import { describe, expect, it } from 'vitest';
import { calculateBaselineEnergy } from '../baseline';
import { CATEGORIES, END_USES, LOAD_TYPES, ZONE_IDS } from '../constants';
import { presetProfile, resolveProfile } from '../profile';
import type { HotelInput } from '../types';

const demo = presetProfile('demo-chicago-100');
const base = calculateBaselineEnergy(demo);
const sum = (xs: number[]) => xs.reduce((s, x) => s + x, 0);
const close = (a: number, b: number, tol = 1e-6) => expect(Math.abs(a - b)).toBeLessThanOrEqual(tol * Math.max(1, Math.abs(b)));

describe('resolveProfile', () => {
  it('fills defaults and lists what was defaulted', () => {
    const r = resolveProfile({});
    expect(r.profile.rooms).toBe(100);
    expect(r.profile.floorAreaSqft).toBe(55000);
    expect(r.profile.floors).toBe(5);
    expect(r.profile.setpoints.vacantHeatF).toBe(r.profile.setpoints.occupiedHeatF);
    expect(r.defaulted).toEqual(expect.arrayContaining(['rooms', 'floorAreaSqft', 'hvacType', 'monthlyEnergyBill', 'occupancy']));
    expect(r.profile.monthlyEnergyBill).toBeNull();
  });

  it('keeps what the user entered and does not list it as defaulted', () => {
    const r = resolveProfile({ rooms: 60, occupancy: 0.7, hvacType: 'ptac', electricityRate: 0.2 });
    expect(r.profile.rooms).toBe(60);
    expect(r.profile.occupancy).toBe(0.7);
    expect(r.profile.electricityRate).toBe(0.2);
    expect(r.defaulted).not.toContain('rooms');
    expect(r.defaulted).not.toContain('hvacType');
    expect(r.defaulted).not.toContain('electricityRate');
    expect(r.defaulted).toContain('gasRate');
  });

  it('clamps out-of-range input and says so', () => {
    const r = resolveProfile({ occupancy: 1.4, operatingHours: 30 });
    expect(r.profile.occupancy).toBe(1);
    expect(r.profile.operatingHours).toBe(24);
    expect(r.notes.join(' ')).toMatch(/occupancy/);
  });

  it('notes an unknown city and falls back to the default climate', () => {
    const r = resolveProfile({ city: 'Nowhere', state: 'ZZ' });
    expect(r.defaulted).toContain('climate');
    expect(r.notes.join(' ')).toMatch(/No weather data/);
  });
});

describe('baseline', () => {
  it('lands near the benchmark intensity for the demo hotel', () => {
    const eui = base.annual.siteKBtu / demo.profile.floorAreaSqft;
    expect(eui).toBeGreaterThan(80);
    expect(eui).toBeLessThan(100);
    expect(base.estimated).toBe(true); // no bill entered: benchmarks stand in
    expect(base.calibration.source).toBe('benchmark');
  });

  it('adds up: zones, categories, end uses, months and load kinds all equal the annual total', () => {
    const a = base.annual;
    close(sum(ZONE_IDS.map((z) => base.byZone[z].cost)), a.cost);
    close(sum(CATEGORIES.map((c) => base.byCategory[c].cost)), a.cost);
    close(sum(END_USES.map((u) => base.byEndUse[u].cost)), a.cost);
    close(sum(base.months.map((m) => m.totals.cost)), a.cost);
    close(sum(base.months.map((m) => m.totals.elecKWh)), a.elecKWh);
    close(sum(base.months.map((m) => m.totals.gasTherms)), a.gasTherms);
    close(sum(LOAD_TYPES.map((l) => base.byLoadType[l])), a.siteKBtu);
    close(a.cost, a.elecCost + a.gasCost);
  });

  it('uses both electricity and gas for a central-plant hotel and mostly electricity for PTAC', () => {
    expect(base.annual.gasTherms).toBeGreaterThan(0);
    const ptac = calculateBaselineEnergy({ ...demo.profile, hvacType: 'ptac' } as never as HotelInput);
    expect(ptac).toBeDefined();
    const ptacProfile = resolveProfile({ rooms: 100, floorAreaSqft: 55000, hvacType: 'ptac', occupancy: 0.6 });
    const p = calculateBaselineEnergy(ptacProfile);
    expect(p.byEndUse.heating.gasTherms).toBe(0);
    expect(p.byEndUse.heating.elecKWh).toBeGreaterThan(0);
    expect(base.byEndUse.heating.elecKWh).toBe(0);
  });

  it('has the right seasonal shape: cooling peaks in summer, heating in winter', () => {
    const perMonth = (u: (typeof END_USES)[number]) =>
      Array.from({ length: 12 }, (_, m) => sum(base.cells.filter((c) => c.endUse === u && c.month === m).map((c) => c.cost)));
    const cool = perMonth('cooling');
    const heat = perMonth('heating');
    expect([5, 6, 7]).toContain(cool.indexOf(Math.max(...cool)));
    expect([11, 0, 1]).toContain(heat.indexOf(Math.max(...heat)));
    expect(cool[0]).toBeLessThan(cool[6]!);
    expect(heat[6]).toBeLessThan(heat[0]!);
  });

  it('responds to occupancy, but not linearly, and base loads do not move', () => {
    const at = (occupancy: number) => calculateBaselineEnergy(resolveProfile({ ...demoInput(), occupancy }));
    const low = at(0.5);
    const high = at(0.9);
    expect(high.annual.siteKBtu).toBeGreaterThan(low.annual.siteKBtu);
    expect(high.annual.siteKBtu / low.annual.siteKBtu).toBeLessThan(0.9 / 0.5);
    close(high.byLoadType.base, low.byLoadType.base);
    expect(high.byLoadType.occupancy).toBeGreaterThan(low.byLoadType.occupancy);
    close(high.byLoadType.weather, low.byLoadType.weather, 0.05); // weather loads move only a little with occupancy
  });

  it('calibrates to a bill within the allowed range', () => {
    const r = calculateBaselineEnergy(resolveProfile({ ...demoInput(), monthlyEnergyBill: 12000 }));
    expect(r.calibration.source).toBe('bill');
    expect(r.calibration.clamped).toBe(false);
    expect(Math.abs(r.annual.cost - 12000 * 12) / (12000 * 12)).toBeLessThan(0.001);
    expect(r.estimated).toBe(false);
  });

  it('flags a bill far outside the benchmark instead of trusting it blindly', () => {
    const r = calculateBaselineEnergy(resolveProfile({ ...demoInput(), monthlyEnergyBill: 500 }));
    expect(r.calibration.clamped).toBe(true);
    expect(r.estimated).toBe(true);
    expect(r.annual.cost).toBeGreaterThan(500 * 12);
  });

  it('is deterministic and does not mutate its input', () => {
    const input = Object.freeze({ ...demoInput() });
    const a = calculateBaselineEnergy(input);
    const b = calculateBaselineEnergy(input);
    expect(a).toEqual(b);
  });

  it('has twelve months and a cell for every nonzero zone and end use', () => {
    expect(base.months).toHaveLength(12);
    expect(base.cells.every((c) => c.siteKBtu >= 0)).toBe(true);
    expect(new Set(base.cells.map((c) => c.zone)).size).toBe(6);
  });
});

function demoInput(): HotelInput {
  return { rooms: 100, floorAreaSqft: 55000, floors: 5, yearBuilt: 1998, hvacType: 'central_plant', occupancy: 0.6, occupiedHoursPerRoom: 14 };
}
