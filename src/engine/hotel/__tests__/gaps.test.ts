import { describe, expect, it } from 'vitest';
import { calculateBaselineEnergy } from '../baseline';
import { hotelData } from '../data';
import { opportunitiesByZone } from '../opportunities';
import { optimizeInvestmentPortfolio } from '../optimizer';
import { presetProfile, resolveProfile } from '../profile';
import { simulateEnergyScenario } from '../scenarios';
import { calculateUpgradeSavings, prepareScenarioContext, prepareUpgradeContext } from '../upgrades';
import type { HotelData } from '../types';

const demo = presetProfile('demo-chicago-100');
const ctx = prepareUpgradeContext(demo);
const sum = (xs: number[]) => xs.reduce((s, x) => s + x, 0);
const close = (a: number, b: number, tol = 1e-6) => expect(Math.abs(a - b)).toBeLessThanOrEqual(tol * Math.max(1, Math.abs(b)));
const clone = (d: HotelData): HotelData => JSON.parse(JSON.stringify(d)) as HotelData;
const noRecovery = (): HotelData => {
  const d = clone(hotelData);
  d.defaults.recovery.kBtuPerRoomPerF = 0;
  return d;
};

describe('recovery after a setback', () => {
  const dNo = noRecovery();
  const ctxNo = prepareUpgradeContext(demo, dNo);

  it('does not change a hotel with no setback', () => {
    close(calculateBaselineEnergy(demo, dNo).annual.cost, ctx.baseline.annual.cost);
  });

  it('makes smart room controls save less than they would for free', () => {
    const gross = calculateUpgradeSavings(ctxNo, ['smart_room_controls'], 'mid', dNo).savings.cost;
    const net = calculateUpgradeSavings(ctx, ['smart_room_controls'], 'mid').savings.cost;
    expect(net).toBeGreaterThan(0);
    expect(net).toBeLessThan(gross);
  });

  it('lands in guest-room heating and cooling, as occupancy-driven load', () => {
    const withCtl = calculateUpgradeSavings(ctx, ['smart_room_controls'], 'mid');
    const loadOf = (cells: typeof withCtl.cells, u: string) =>
      sum(cells.filter((c) => c.zone === 'guest_rooms' && c.endUse === u).map((c) => c.loadKBtu.occupancy));
    expect(loadOf(withCtl.cells, 'heating')).toBeGreaterThan(loadOf(ctx.baseline.cells, 'heating'));
    expect(loadOf(withCtl.cells, 'cooling')).toBeGreaterThan(loadOf(ctx.baseline.cells, 'cooling'));
    // heating recovery happens in heating months only, cooling recovery in cooling months only
    const july = withCtl.cells.filter((c) => c.zone === 'guest_rooms' && c.endUse === 'heating' && c.month === 6);
    const julyBase = ctx.baseline.cells.filter((c) => c.zone === 'guest_rooms' && c.endUse === 'heating' && c.month === 6);
    close(sum(july.map((c) => c.loadKBtu.occupancy)), sum(julyBase.map((c) => c.loadKBtu.occupancy)));
  });

  it('is zero when guests are always in their rooms, and grows with the number of returns', () => {
    const always = resolveProfile({ rooms: 100, floorAreaSqft: 55000, occupancy: 1, occupiedHoursPerRoom: 24, seasonalOccupancy: new Array<number>(12).fill(1) });
    const cA = prepareUpgradeContext(always);
    const cAno = prepareUpgradeContext(always, dNo);
    close(
      calculateUpgradeSavings(cA, ['smart_room_controls']).savings.cost,
      calculateUpgradeSavings(cAno, ['smart_room_controls'], 'mid', dNo).savings.cost,
    );
    const cost = (occupancy: number) => {
      const r = resolveProfile({ rooms: 100, floorAreaSqft: 55000, occupancy, occupiedHoursPerRoom: 14 });
      const a = prepareUpgradeContext(r);
      const b = prepareUpgradeContext(r, dNo);
      return (
        calculateUpgradeSavings(b, ['smart_room_controls'], 'mid', dNo).savings.cost - calculateUpgradeSavings(a, ['smart_room_controls']).savings.cost
      );
    };
    expect(cost(0.4)).toBeGreaterThan(0);
    expect(cost(0.8)).toBeGreaterThan(cost(0.4));
  });

  it('applies to a scenario setback too, not only to the upgrade', () => {
    const s = simulateEnergyScenario(demo, { smartRoomControls: true });
    const sNo = simulateEnergyScenario(resolveProfile(demo.profile as never), { smartRoomControls: true }, dNo);
    expect(s.delta.cost).toBeGreaterThan(sNo.delta.cost); // less negative: recovery eats part of the saving
    expect(s.delta.cost).toBeLessThan(0);
  });
});

describe('optimizing under a scenario', () => {
  const price = { electricityRateChangePct: 20 };

  it('records the scenario and measures everything against it', () => {
    const plain = optimizeInvestmentPortfolio(demo, { budget: 100000 });
    const scn = optimizeInvestmentPortfolio(demo, { budget: 100000, scenario: price });
    expect(plain.scenario).toBeNull();
    expect(scn.scenario).toEqual(price);
    close(scn.baselineAnnualCost, simulateEnergyScenario(demo, price).after.annual.cost);
    expect(scn.baselineAnnualCost).toBeGreaterThan(plain.baselineAnnualCost);
  });

  it('makes electricity-saving upgrades more attractive when electricity gets more expensive', () => {
    const plain = optimizeInvestmentPortfolio(demo, { budget: 250000 });
    const scn = optimizeInvestmentPortfolio(demo, { budget: 250000, scenario: price });
    const pay = (r: typeof plain, id: string) => r.candidates.find((c) => c.id === id)!.paybackYears!;
    expect(pay(scn, 'led_lighting')).toBeLessThan(pay(plain, 'led_lighting'));
    expect(pay(scn, 'rooftop_solar')).toBeLessThan(pay(plain, 'rooftop_solar'));
    expect(scn.candidates.find((c) => c.id === 'led_lighting')!.annualSavings).toBeGreaterThan(
      plain.candidates.find((c) => c.id === 'led_lighting')!.annualSavings,
    );
  });

  it('an empty scenario is the same as none, and a scenario with smart controls removes that upgrade', () => {
    expect(optimizeInvestmentPortfolio(demo, { budget: 50000, scenario: {} })).toEqual(optimizeInvestmentPortfolio(demo, { budget: 50000 }));
    const r = optimizeInvestmentPortfolio(demo, { budget: 250000, scenario: { smartRoomControls: true } });
    expect(r.combinationsTested).toBe(2 ** 6 * 4); // 6 independent upgrades x (no solar or one of 3 sizes)
    expect(r.candidates.every((c) => !c.upgradeIds.includes('smart_room_controls'))).toBe(true);
  });

  it('prepareScenarioContext has the scenario result as its baseline', () => {
    const c = prepareScenarioContext(demo, { occupancy: 0.85 });
    close(c.baseline.annual.cost, simulateEnergyScenario(demo, { occupancy: 0.85 }).after.annual.cost);
    expect(c.profile.smartRoomControls).toBe(false);
    expect(prepareScenarioContext(demo, { smartRoomControls: true }).profile.smartRoomControls).toBe(true);
  });

  it('is deterministic and stays within the budget', () => {
    const a = optimizeInvestmentPortfolio(demo, { budget: 50000, scenario: price });
    expect(a).toEqual(optimizeInvestmentPortfolio(demo, { budget: 50000, scenario: price }));
    for (const p of a.packages) expect(p.evaluation.cost.mid).toBeLessThanOrEqual(50000);
  });
});

describe('opportunities by zone', () => {
  const opp = opportunitiesByZone(ctx);
  const ids = (z: keyof typeof opp) => opp[z].map((o) => o.id);

  it('lists the upgrades that help each zone, biggest first', () => {
    for (const list of Object.values(opp)) {
      for (const o of list) expect(o.zoneAnnualSavings).toBeGreaterThan(0);
      const s = list.map((o) => o.zoneAnnualSavings);
      expect(s).toEqual([...s].sort((a, b) => b - a));
    }
  });

  it('matches upgrades to the zones they touch', () => {
    expect(ids('hot_water')[0]).toBe('water_heating'); // solar also trims its electric share
    expect(ids('kitchen_restaurant')).toContain('led_lighting');
    expect(ids('guest_rooms')).toEqual(expect.arrayContaining(['led_lighting', 'smart_room_controls']));
    expect(ids('central_hvac')).toEqual(expect.arrayContaining(['smart_room_controls', 'hvac_upgrade', 'energy_management']));
    expect(ids('lobby_common')).not.toContain('smart_room_controls');
    expect(ids('hallways_shared')).toContain('occupancy_sensors');
  });

  it('gives the whole upgrade a cost and payback, and the zone saving never exceeds the total for single-zone upgrades', () => {
    const water = opp.hot_water.find((o) => o.id === 'water_heating')!;
    close(water.zoneAnnualSavings, water.totalAnnualSavings);
    close(water.paybackYears!, water.cost / water.totalAnnualSavings);
    expect(water.comfortImpact).toBe('minor');
    expect(water.comfortNote.length).toBeGreaterThan(0);
  });

  it('every eligible upgrade helps at least one zone, and ineligible ones are left out', () => {
    const all = new Set(Object.values(opp).flatMap((l) => l.map((o) => o.id)));
    expect(all.size).toBe(10);
    const withCtl = prepareUpgradeContext({ ...demo, profile: { ...demo.profile, smartRoomControls: true } });
    const none = new Set(Object.values(opportunitiesByZone(withCtl)).flatMap((l) => l.map((o) => o.id)));
    expect(none.has('smart_room_controls')).toBe(false);
  });

  it('follows a scenario context: dearer electricity raises zone savings from LED', () => {
    const scn = opportunitiesByZone(prepareScenarioContext(demo, { electricityRateChangePct: 20 }));
    const led = (o: typeof opp, z: keyof typeof opp) => o[z].find((x) => x.id === 'led_lighting')!.zoneAnnualSavings;
    expect(led(scn, 'hallways_shared')).toBeGreaterThan(led(opp, 'hallways_shared'));
  });

  it('is deterministic', () => {
    expect(opportunitiesByZone(ctx)).toEqual(opp);
  });
});
