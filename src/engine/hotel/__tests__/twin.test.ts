import { describe, expect, it } from 'vitest';
import { calculateBaselineEnergy } from '../baseline';
import { ZONE_IDS, DAYS_IN_MONTH, CATEGORIES } from '../constants';
import { presetProfile, resolveProfile } from '../profile';
import { simulateHVACSettings } from '../scenarios';
import { energyFlows, equipmentInventory, roomOccupancyPattern, simulatedMeter, typicalDayProfile } from '../twin';

const demo = presetProfile('demo-chicago-100');
const base = calculateBaselineEnergy(demo);
const sum = (xs: number[]) => xs.reduce((s, x) => s + x, 0);
const close = (a: number, b: number, tol = 1e-9) => expect(Math.abs(a - b)).toBeLessThanOrEqual(tol * Math.max(1, Math.abs(b)));

describe('typicalDayProfile', () => {
  it('reconciles to the monthly totals', () => {
    for (let m = 0; m < 12; m++) {
      const day = typicalDayProfile(base, m);
      const days = DAYS_IN_MONTH[m]!;
      expect(day).toHaveLength(24);
      close(sum(day.map((h) => h.elecKW)) * days, base.months[m]!.totals.elecKWh);
      close(sum(day.map((h) => h.gasThermsPerHour)) * days, base.months[m]!.totals.gasTherms);
      close(sum(day.map((h) => h.costPerHour)) * days, base.months[m]!.totals.cost);
      for (const z of ZONE_IDS) {
        close(
          sum(day.map((h) => h.byZone[z].elecKW)) * days,
          sum(base.cells.filter((c) => c.month === m && c.zone === z).map((c) => c.elecKWh)),
        );
      }
    }
  });

  it('has a daytime electric peak in summer and a morning or evening gas peak', () => {
    const july = typicalDayProfile(base, 6).map((h) => h.elecKW);
    const peak = july.indexOf(Math.max(...july));
    expect(peak).toBeGreaterThanOrEqual(11);
    expect(peak).toBeLessThanOrEqual(20);
    expect(Math.min(...july)).toBeGreaterThan(0); // base load never goes to zero
    const gas = typicalDayProfile(base, 0).map((h) => h.gasThermsPerHour);
    expect([5, 6, 7, 8, 18, 19, 20]).toContain(gas.indexOf(Math.max(...gas)));
  });

  it('is deterministic', () => {
    expect(typicalDayProfile(base, 3)).toEqual(typicalDayProfile(base, 3));
  });
});

describe('simulatedMeter', () => {
  it('is always labeled simulated and matches the typical day', () => {
    const r = simulatedMeter(base, 6, 15);
    expect(r.simulated).toBe(true);
    expect(r.kW).toBe(typicalDayProfile(base, 6)[15]!.elecKW);
    expect(r.usdPerHour).toBeGreaterThan(0);
    expect(simulatedMeter(base, 6, 99).simulated).toBe(true); // out-of-range hours are clamped
  });
});

describe('roomOccupancyPattern', () => {
  const p = demo.profile;
  const cond = base.conditions;
  const at = (month: number, hour: number) => roomOccupancyPattern(p, cond, month, hour);

  it('has one entry per room with unique numbers on valid floors', () => {
    const rooms = at(6, 12);
    expect(rooms).toHaveLength(p.rooms);
    expect(new Set(rooms.map((r) => r.number)).size).toBe(p.rooms);
    expect(Math.max(...rooms.map((r) => r.floor))).toBeLessThanOrEqual(p.floors);
    expect(Math.min(...rooms.map((r) => r.floor))).toBe(1);
  });

  it('books exactly round(occupancy x rooms) rooms, with fewer guests present at midday than at night', () => {
    for (const m of [0, 6, 11]) {
      const rooms = at(m, 3);
      const booked = rooms.filter((r) => r.state !== 'vacant').length;
      expect(booked).toBe(Math.round(cond.occupancyByMonth[m]! * p.rooms));
    }
    const night = at(6, 2).filter((r) => r.state === 'occupied').length;
    const noon = at(6, 12).filter((r) => r.state === 'occupied').length;
    expect(night).toBeGreaterThan(noon);
  });

  it('is repeatable and spreads booked rooms across floors', () => {
    expect(at(6, 12)).toEqual(at(6, 12));
    const byFloor = new Map<number, number>();
    for (const r of at(6, 12)) if (r.state !== 'vacant') byFloor.set(r.floor, (byFloor.get(r.floor) ?? 0) + 1);
    expect(byFloor.size).toBe(p.floors);
  });

  it('marks setback only with smart controls, and only for rooms without a guest', () => {
    expect(at(6, 12).some((r) => r.setback)).toBe(false);
    const withControls = simulateHVACSettings(demo, { smartRoomControls: true }).after.conditions;
    const rooms = roomOccupancyPattern(p, withControls, 6, 12);
    expect(rooms.some((r) => r.setback)).toBe(true);
    expect(rooms.every((r) => r.setback === (r.state !== 'occupied'))).toBe(true);
  });

  it('shows more booked rooms when occupancy is higher', () => {
    const hi = { ...demo, profile: { ...demo.profile, occupancy: 0.9 } };
    const r = calculateBaselineEnergy(hi);
    const hiRooms = roomOccupancyPattern(hi.profile, r.conditions, 6, 12).filter((x) => x.state !== 'vacant').length;
    expect(hiRooms).toBeGreaterThan(at(6, 12).filter((x) => x.state !== 'vacant').length);
  });
});

describe('equipmentInventory', () => {
  it('covers every zone, scales with the hotel and is flagged estimated', () => {
    const items = equipmentInventory(demo.profile);
    for (const z of ZONE_IDS) expect(items.some((i) => i.zone === z)).toBe(true);
    expect(items.every((i) => i.estimated)).toBe(true);
    expect(items.find((i) => i.id === 'room-hvac')?.count).toBe(100);
    expect(items.some((i) => i.id === 'boilers')).toBe(true);
    const small = equipmentInventory(resolveProfile({ rooms: 40, hvacType: 'vrf' }).profile);
    expect(small.find((i) => i.id === 'room-hvac')?.count).toBe(40);
    expect(small.some((i) => i.id === 'boilers')).toBe(false);
    expect(small.some((i) => i.id === 'central-plant')).toBe(true);
  });
});

describe('energyFlows', () => {
  const g = energyFlows(base);
  const out = (id: string) => sum(g.links.filter((l) => l.source === id).map((l) => l.costUsd));
  const into = (id: string) => sum(g.links.filter((l) => l.target === id).map((l) => l.costUsd));

  it('conserves cost through every node', () => {
    close(out('grid'), base.annual.elecCost);
    close(out('gas'), base.annual.gasCost);
    for (const z of ZONE_IDS) {
      close(into(`zone:${z}`), out(`zone:${z}`));
      close(into(`zone:${z}`), base.byZone[z].cost);
    }
    for (const c of CATEGORIES) close(into(`category:${c}`), base.byCategory[c].cost);
    close(sum(CATEGORIES.map((c) => into(`category:${c}`))), base.annual.cost);
  });

  it('only links known nodes and has positive values', () => {
    const ids = new Set(g.nodes.map((n) => n.id));
    expect(g.links.every((l) => ids.has(l.source) && ids.has(l.target) && l.costUsd > 0)).toBe(true);
  });
});
