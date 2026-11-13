import { describe, expect, it } from 'vitest';
import { calculateBaselineEnergy } from '../baseline';
import { currentEquipment, equipmentLevers, estimatedInventory, replacementUpgrade, usableRoofKw, validateEquipment } from '../equipment';
import { hotelData } from '../data';
import { evaluatePackage } from '../package';
import { optimizeInvestmentPortfolio } from '../optimizer';
import { presetProfile, resolveProfile } from '../profile';
import { eligibleUpgrades, prepareUpgradeContext } from '../upgrades';
import { boilerKBtuH, coolingTons } from '../costs';
import type { EquipmentOverride, HotelInput } from '../types';

const preset = hotelData.presets.find((p) => p.id === 'demo-chicago-100')!.input;
const demo = presetProfile('demo-chicago-100');
const base = calculateBaselineEnergy(demo);
const withEq = (equipment: EquipmentOverride[], extra: HotelInput = {}) => resolveProfile({ ...preset, ...extra, equipment });
const sum = (r: ReturnType<typeof calculateBaselineEnergy>, endUse: string, key: 'gasTherms' | 'elecKWh') =>
  r.cells.filter((c) => c.endUse === endUse).reduce((s, c) => s + c[key], 0);

describe('equipment audit fixes', () => {
  it('separates quantity from capacity and carries modeled efficiencies on the right items', () => {
    const items = estimatedInventory(demo.profile);
    const tank = items.find((i) => i.id === 'dhw-storage')!;
    expect(tank.count).toBe(1);
    expect(tank.capacity).toEqual({ value: 600, unit: 'gal' });
    const heaters = items.find((i) => i.id === 'dhw-heater')!;
    expect(heaters.count).toBe(3); // 600 kBtu/h in 200 kBtu/h units, matching the water-heating cost assumption
    expect(heaters.count * heaters.capacity!.value).toBeCloseTo(600, 9);
    const boilers = items.find((i) => i.id === 'boilers')!;
    expect(boilers.count * boilers.capacity!.value).toBeCloseTo(demo.profile.floorAreaSqft * 0.03, 6);
    expect(boilers.efficiency).toMatch(/0\.80/);
    expect(items.find((i) => i.id === 'chiller')!.efficiency).toMatch(/COP/);
    expect(items.find((i) => i.id === 'room-hvac')!.levers).toEqual([]); // fan coils: informational on a central plant
    expect(items.every((i) => i.estimated && i.userEntered.length === 0)).toBe(true);
  });
});

describe('equipment levers (current equipment changes the baseline)', () => {
  it('without corrections the hotel is unchanged', () => {
    expect(calculateBaselineEnergy(withEq([])).annual.cost).toBeCloseTo(base.annual.cost, 6);
    // An edit that feeds no lever (a fan-coil count) changes nothing in the model.
    const info = calculateBaselineEnergy(withEq([{ id: 'room-hvac', quantity: 90 }, { id: 'elevators', ageYears: 30 }]));
    expect(info.annual.cost).toBeCloseTo(base.annual.cost, 6);
    // Adding informational equipment does not add consumption.
    const added = calculateBaselineEnergy(withEq([{ id: 'user-1', template: 'dishwasher', quantity: 2 }]));
    expect(added.annual.cost).toBeCloseTo(base.annual.cost, 6);
  });

  it('a 95% boiler instead of the assumed 80% lowers heating gas by 80/95', () => {
    const r = calculateBaselineEnergy(withEq([{ id: 'boilers', efficiency: 0.95 }]));
    expect(sum(r, 'heating', 'gasTherms') / sum(base, 'heating', 'gasTherms')).toBeCloseTo(0.8 / 0.95, 9);
    expect(sum(r, 'cooling', 'elecKWh')).toBeCloseTo(sum(base, 'cooling', 'elecKWh'), 6);
  });

  it('a chiller COP of 6 instead of 4.5 lowers cooling electricity by 4.5/6', () => {
    const r = calculateBaselineEnergy(withEq([{ id: 'chiller', efficiency: 6 }]));
    expect(sum(r, 'cooling', 'elecKWh') / sum(base, 'cooling', 'elecKWh')).toBeCloseTo(4.5 / 6, 9);
  });

  it('water heaters at 0.90 lower the gas part of hot water only', () => {
    const r = calculateBaselineEnergy(withEq([{ id: 'dhw-heater', efficiency: 0.9 }]));
    expect(sum(r, 'hotWater', 'gasTherms') / sum(base, 'hotWater', 'gasTherms')).toBeCloseTo(0.8 / 0.9, 9);
    expect(sum(r, 'hotWater', 'elecKWh')).toBeCloseTo(sum(base, 'hotWater', 'elecKWh'), 6);
  });

  it('LED lighting already installed lowers lighting and removes the LED retrofit when complete', () => {
    const r = calculateBaselineEnergy(withEq([{ id: 'corridor-lighting', efficiency: 1 }]));
    const corr = (x: typeof r) => x.cells.filter((c) => c.endUse === 'lighting' && c.zone === 'hallways_shared').reduce((s, c) => s + c.elecKWh, 0);
    expect(corr(r) / corr(base)).toBeCloseTo(1 - 0.45, 9);
    const all = withEq([
      { id: 'corridor-lighting', efficiency: 1 },
      { id: 'lobby-lighting', efficiency: 1 },
      { id: 'room-lighting', efficiency: 1 },
    ]);
    const ctx = prepareUpgradeContext(all);
    expect(eligibleUpgrades(all.profile, ctx.baseline.annual.elecKWh)).not.toContain('led_lighting');
    expect(eligibleUpgrades(demo.profile, base.annual.elecKWh)).toContain('led_lighting');
  });

  it('a partial LED share leaves the retrofit only the rest of the fixtures', () => {
    const half = withEq([{ id: 'room-lighting', efficiency: 0.5 }]);
    const ctxHalf = prepareUpgradeContext(half);
    const after = evaluatePackage(ctxHalf, ['led_lighting']).outcome.cells;
    const zoneKWh = (cells: typeof after) => cells.filter((c) => c.endUse === 'lighting' && c.zone === 'guest_rooms').reduce((s, c) => s + c.elecKWh, 0);
    const full = evaluatePackage(prepareUpgradeContext(demo), ['led_lighting']).outcome.cells;
    // Both end at the same all-LED lighting in guest rooms: converting the rest reaches the same place, without double counting.
    expect(zoneKWh(after)).toBeCloseTo(zoneKWh(full), 3);
  });

  it('existing solar lowers purchased electricity and the roof left for more solar', () => {
    const r = calculateBaselineEnergy(withEq([{ id: 'pv', template: 'solar_pv', quantity: 1, capacity: 40 }]));
    const yearly = 40 * hotelData.weather.climates['chicago']!.solar!.kWhPerKwYear.mid;
    expect(base.annual.elecKWh - r.annual.elecKWh).toBeCloseTo(yearly, 0);
    expect(r.annual.gasTherms).toBeCloseTo(base.annual.gasTherms, 6);
    const resolved = withEq([{ id: 'pv', template: 'solar_pv', quantity: 1, capacity: 40 }]);
    expect(resolved.profile.equipmentLevers!.existingSolarKw).toBe(40);
    const roof = usableRoofKw(demo.profile);
    const ctx = prepareUpgradeContext(resolved);
    const size = evaluatePackage(ctx, ['rooftop_solar']).sizing.solarKw;
    expect(size).toBeLessThanOrEqual(roof - 40 + 0.1);
  });

  it('entered plant capacity sets the HVAC replacement cost basis', () => {
    const p = withEq([{ id: 'chiller', quantity: 2, capacity: 100 }, { id: 'boilers', quantity: 1, capacity: 1200 }]).profile;
    expect(coolingTons(p)).toBe(200);
    expect(boilerKBtuH(p)).toBe(1200);
    expect(coolingTons(demo.profile)).toBeCloseTo(demo.profile.floorAreaSqft * 0.0025, 6);
  });
});

describe('current vs proposed (no double counting)', () => {
  it('a correction is a new baseline, not a saving: the optimizer measures against the corrected hotel', () => {
    const p = withEq([{ id: 'boilers', efficiency: 0.95 }]);
    const ctx = prepareUpgradeContext(p);
    const plan = optimizeInvestmentPortfolio(ctx, { budget: 50_000 });
    expect(plan.baselineAnnualCost).toBeCloseTo(ctx.baseline.annual.cost, 6);
    expect(plan.baselineAnnualCost).toBeLessThan(base.annual.cost);
  });

  it('an efficient boiler leaves the HVAC upgrade less heating to save; one at the target leaves none', () => {
    const at = (e: number) => {
      const ctx = prepareUpgradeContext(withEq([{ id: 'boilers', efficiency: e }]));
      const o = evaluatePackage(ctx, ['hvac_upgrade']).outcome;
      const heat = (cells: typeof o.cells) => cells.filter((c) => c.endUse === 'heating').reduce((s, c) => s + c.gasTherms, 0);
      return 1 - heat(o.cells) / heat(ctx.baseline.cells);
    };
    expect(at(0.8)).toBeCloseTo(0.13, 6); // the estimate: the upgrade's own mid
    expect(at(0.92)).toBeCloseTo(0, 6);
    expect(at(0.86)).toBeGreaterThan(0);
    expect(at(0.86)).toBeLessThan(0.13);
  });

  it('a replacement is evaluated by the same engine as the optimizer', () => {
    const items = currentEquipment(demo.profile);
    expect(replacementUpgrade(items.find((i) => i.id === 'boilers')!)).toBe('hvac_upgrade');
    expect(replacementUpgrade(items.find((i) => i.id === 'room-lighting')!)).toBe('led_lighting');
    expect(replacementUpgrade(items.find((i) => i.id === 'dhw-heater')!)).toBe('water_heating');
    expect(replacementUpgrade(items.find((i) => i.id === 'elevators')!)).toBeNull(); // needs more information
  });
});

describe('validation', () => {
  it('rejects values outside their bounds and unknown items', () => {
    const v = validateEquipment(
      [
        { id: 'boilers', efficiency: 1.4 },
        { id: 'chiller', efficiency: 0.5 },
        { id: 'room-lighting', efficiency: -0.1 },
        { id: 'elevators', quantity: 2.5 },
        { id: 'nope' },
        { id: 'x', template: 'not-a-template' },
        { id: 'dhw-heater', efficiency: 0.88, ageYears: 12 },
      ],
      demo.profile,
    );
    expect(v.problems.filter((p) => p.severity === 'error')).toHaveLength(6);
    expect(v.overrides.find((o) => o.id === 'dhw-heater')).toEqual({ id: 'dhw-heater', efficiency: 0.88, ageYears: 12 });
    expect(v.overrides.find((o) => o.id === 'boilers')).toEqual({ id: 'boilers' });
  });

  it('keeps the only heating, cooling or hot-water equipment, but allows removing it once a replacement is added', () => {
    const v = validateEquipment([{ id: 'boilers', removed: true }], demo.profile);
    expect(v.problems[0]!.message).toMatch(/only heating equipment/);
    expect(v.overrides[0]!.removed).toBeUndefined();
    const ok = validateEquipment([{ id: 'boilers', removed: true }, { id: 'new-boiler', template: 'condensing_boiler', quantity: 2, capacity: 800 }], demo.profile);
    expect(ok.problems).toEqual([]);
    const lev = equipmentLevers(demo.profile, ok.overrides);
    expect(lev.heatingEfficiency).toBeCloseTo(0.92, 9);
    const r = calculateBaselineEnergy(withEq(ok.overrides));
    expect(sum(r, 'heating', 'gasTherms') / sum(base, 'heating', 'gasTherms')).toBeCloseTo(0.8 / 0.92, 9);
  });

  it('labels user-entered fields and keeps hotels independent', () => {
    const items = currentEquipment(withEq([{ id: 'boilers', efficiency: 0.9, quantity: 1 }]).profile);
    const b = items.find((i) => i.id === 'boilers')!;
    expect(b.estimated).toBe(false);
    expect(b.userEntered.sort()).toEqual(['efficiency', 'quantity']);
    expect(items.find((i) => i.id === 'chiller')!.estimated).toBe(true);
    // The input carries the corrections; another hotel's profile is untouched.
    expect(presetProfile('demo-chicago-300').profile.equipment).toBeUndefined();
  });

  it('warns when existing solar is larger than the usable roof', () => {
    const v = validateEquipment([{ id: 'pv', template: 'solar_pv', capacity: 5000 }], demo.profile);
    expect(v.problems.some((p) => p.severity === 'warning' && /usable roof/.test(p.message))).toBe(true);
  });
});
