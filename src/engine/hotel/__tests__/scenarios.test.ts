import { describe, expect, it } from 'vitest';
import { END_USES } from '../constants';
import { presetProfile, resolveProfile } from '../profile';
import { STRESS_TESTS, simulateEnergyScenario, simulateHVACSettings, simulateOccupancyChange } from '../scenarios';
import type { EnergyResult, EndUse } from '../types';

const demo = presetProfile('demo-chicago-100');
const sum = (xs: number[]) => xs.reduce((s, x) => s + x, 0);
const close = (a: number, b: number, tol = 1e-6) => expect(Math.abs(a - b)).toBeLessThanOrEqual(tol * Math.max(1, Math.abs(b)));
const endUseMonth = (r: EnergyResult, u: EndUse, m: number) =>
  sum(r.cells.filter((c) => c.endUse === u && c.month === m).map((c) => c.cost));

describe('scenarios', () => {
  it('an empty scenario changes nothing and has no drivers', () => {
    const s = simulateEnergyScenario(demo, {});
    close(s.delta.cost, 0);
    expect(s.drivers).toEqual([]);
    expect(s.after.annual).toEqual(s.before.annual);
  });

  it('occupancy 60% to 85% raises energy and cost, explained by one driver', () => {
    const s = simulateOccupancyChange(demo, 0.85, 0.6);
    expect(s.delta.siteKBtu).toBeGreaterThan(0);
    expect(s.delta.cost).toBeGreaterThan(0);
    expect(s.drivers.map((d) => d.id)).toEqual(['occupancy']);
    // sublinear: +42% occupancy costs less than +42% energy
    expect(s.after.annual.siteKBtu / s.before.annual.siteKBtu).toBeLessThan(0.85 / 0.6);
    // hot water and guest-room use rise; the detail text names the biggest movers
    expect(s.drivers[0]!.detail).toMatch(/Largest changes/);
    expect(s.deltaByZone.hot_water.cost).toBeGreaterThan(0);
  });

  it('driver changes add up to the total change', () => {
    const s = simulateEnergyScenario(demo, {
      occupancy: 0.85,
      smartRoomControls: true,
      commonAreaHvacHours: 18,
      weatherOffsetF: 3,
      electricityRateChangePct: 10,
    });
    expect(s.drivers.map((d) => d.id)).toEqual(['occupancy', 'setpoints', 'schedules', 'weather', 'rates']);
    close(sum(s.drivers.map((d) => d.deltaCost)), s.delta.cost);
    close(sum(s.drivers.map((d) => d.deltaElecKWh)), s.delta.elecKWh);
    close(sum(s.drivers.map((d) => d.deltaGasTherms)), s.delta.gasTherms);
  });

  it('a 20% electricity price rise raises only the electricity cost, by 20%', () => {
    const s = simulateEnergyScenario(demo, { electricityRateChangePct: 20 });
    close(s.delta.elecCost, 0.2 * s.before.annual.elecCost);
    close(s.delta.gasCost, 0);
    close(s.delta.elecKWh, 0);
    expect(s.drivers.map((d) => d.id)).toEqual(['rates']);
  });

  it('smart room controls save energy when rooms are vacant or the guest is out', () => {
    const s = simulateHVACSettings(demo, { smartRoomControls: true });
    expect(s.delta.cost).toBeLessThan(0);
    expect(s.delta.siteKBtu).toBeLessThan(0);
    // guest rooms and the central plant that serves them change; common areas and the kitchen do not
    expect(s.deltaByZone.lobby_common.cost).toBe(0);
    expect(s.deltaByZone.guest_rooms.cost).toBeLessThan(0);
    expect(s.deltaByZone.central_hvac.cost).toBeLessThan(0);
    expect(s.flags.some((f) => f.id === 'smart-controls')).toBe(true);
  });

  it('the setback saves more at low occupancy and nothing when every room always has a guest', () => {
    const savings = (occupancy: number, hours: number) => {
      const r = resolveProfile({ rooms: 100, floorAreaSqft: 55000, occupancy, occupiedHoursPerRoom: hours, seasonalOccupancy: new Array<number>(12).fill(1) });
      return -simulateHVACSettings(r, { smartRoomControls: true }).delta.cost;
    };
    expect(savings(0.4, 14)).toBeGreaterThan(savings(0.8, 14));
    expect(savings(0.6, 8)).toBeGreaterThan(savings(0.6, 20));
    expect(savings(1, 24)).toBeCloseTo(0, 6);
  });

  it('setpoints move heating and cooling in the right direction', () => {
    const cool = simulateHVACSettings(demo, { setpoints: { occupiedCoolF: 76 } });
    expect(cool.after.byEndUse.cooling.cost).toBeLessThan(cool.before.byEndUse.cooling.cost);
    const heat = simulateHVACSettings(demo, { setpoints: { occupiedHeatF: 71 } });
    expect(heat.after.byEndUse.heating.cost).toBeGreaterThan(heat.before.byEndUse.heating.cost);
  });

  it('shorter common-area HVAC hours cut energy and raise a comfort flag', () => {
    const s = simulateHVACSettings(demo, { commonAreaHvacHours: 14 });
    expect(s.delta.cost).toBeLessThan(0);
    expect(s.deltaByZone.guest_rooms.cost).toBe(0);
    const flag = s.flags.find((f) => f.id === 'common-hvac-hours');
    expect(flag?.severity).toBe('warn');
    expect(simulateHVACSettings(demo, { commonAreaHvacHours: 24 }).flags.some((f) => f.id === 'common-hvac-hours')).toBe(false);
  });

  it('a warmer year lowers heating and raises cooling', () => {
    const s = simulateEnergyScenario(demo, { weatherOffsetF: 4 });
    expect(s.after.byEndUse.heating.cost).toBeLessThan(s.before.byEndUse.heating.cost);
    expect(s.after.byEndUse.cooling.cost).toBeGreaterThan(s.before.byEndUse.cooling.cost);
    expect(s.drivers.map((d) => d.id)).toEqual(['weather']);
  });

  it('flags uncomfortable settings', () => {
    const s = simulateHVACSettings(demo, { setpoints: { occupiedHeatF: 64, occupiedCoolF: 80 } });
    const ids = s.flags.map((f) => f.id);
    expect(ids).toContain('occupied-heat-low');
    expect(ids).toContain('occupied-cool-high');
    expect(simulateEnergyScenario(demo, { lightingHoursPerDay: 16 }).flags.map((f) => f.id)).toContain('lighting-hours');
  });

  it('stress tests move energy and cost the expected way', () => {
    const byId = Object.fromEntries(STRESS_TESTS.map((t) => [t.id, t.scenario]));
    const heat = simulateEnergyScenario(demo, byId['heat_wave']!);
    expect(endUseMonth(heat.after, 'cooling', 6)).toBeGreaterThan(endUseMonth(heat.before, 'cooling', 6));
    expect(endUseMonth(heat.after, 'cooling', 0)).toBe(endUseMonth(heat.before, 'cooling', 0));
    const cold = simulateEnergyScenario(demo, byId['cold_snap']!);
    expect(endUseMonth(cold.after, 'heating', 0)).toBeGreaterThan(endUseMonth(cold.before, 'heating', 0));
    const conf = simulateEnergyScenario(demo, byId['conference_surge']!);
    expect(conf.after.months[8]!.totals.cost).toBeGreaterThan(conf.before.months[8]!.totals.cost);
    expect(conf.after.months[2]!.totals.cost).toBeCloseTo(conf.before.months[2]!.totals.cost, 6);
    const price = simulateEnergyScenario(demo, byId['price_up_20']!);
    expect(price.delta.cost).toBeGreaterThan(0);
    expect(price.delta.elecKWh).toBeCloseTo(0, 6);
  });

  it('keeps the bill calibration across a scenario', () => {
    const r = resolveProfile({ rooms: 100, floorAreaSqft: 55000, occupancy: 0.6, monthlyEnergyBill: 12000 });
    const s = simulateOccupancyChange(r, 0.85);
    expect(s.after.calibration).toEqual(s.before.calibration);
    expect(s.after.calibration.source).toBe('bill');
  });

  it('is deterministic and leaves its inputs alone', () => {
    const scenario = Object.freeze({ occupancy: 0.8, smartRoomControls: true });
    const a = simulateEnergyScenario(demo, scenario);
    const b = simulateEnergyScenario(demo, scenario);
    expect(a).toEqual(b);
    expect(END_USES.length).toBe(8);
  });
});
