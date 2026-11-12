import { describe, expect, it } from 'vitest';
import { hotelData } from '../data';
import { presetProfile, resolveProfile } from '../profile';
import { upgradeLifetime } from '../upgrades';

const input = hotelData.presets.find((x) => x.id === 'demo-chicago-100')!.input;

describe('upgrade lifetimes (IL-TRM v14.0 measure lives)', () => {
  it('uses the life of the equipment replaced for HVAC upgrades', () => {
    const life = (hvacType: 'central_plant' | 'ptac' | 'pthp' | 'rtu' | 'vrf') => upgradeLifetime('hvac_upgrade', resolveProfile({ ...input, hvacType }).profile);
    expect(life('central_plant')).toBe(23);
    expect(life('ptac')).toBe(8);
    expect(life('pthp')).toBe(8);
    expect(life('rtu')).toBe(15);
    expect(life('vrf')).toBe(16);
  });
  it('uses the TRM lives for the other upgrades', () => {
    const p = presetProfile('demo-chicago-100').profile;
    expect(upgradeLifetime('insulation', p)).toBe(20);
    expect(upgradeLifetime('water_heating', p)).toBe(15);
    expect(upgradeLifetime('smart_room_controls', p)).toBe(15);
    expect(upgradeLifetime('energy_management', p)).toBe(10);
  });
});

import { boilerKBtuH, coolingTons, upgradeCost } from '../costs';
describe('HVAC equipment cost by system (IL-TRM full installed costs)', () => {
  const at = (hvacType: 'central_plant' | 'ptac' | 'pthp' | 'rtu' | 'vrf') => resolveProfile({ ...input, hvacType }).profile;
  const mid = (hvacType: Parameters<typeof at>[0]) => upgradeCost(at(hvacType), 'hvac_upgrade', { hvacSizeFactor: 1, solarKw: 0 }).mid;
  it('prices rooftop units and PTAC/PTHP per ton, and a central plant as boiler plus chiller', () => {
    expect(mid('rtu')).toBeCloseTo(958 * coolingTons(at('rtu')), 6);
    expect(mid('ptac')).toBeCloseTo(1047 * coolingTons(at('ptac')), 6);
    expect(coolingTons(at('ptac'))).toBeCloseTo(100 * 0.75 + 55000 * 0.18 * 0.0025, 6);
    expect(mid('central_plant')).toBeCloseTo(22.95 * boilerKBtuH(at('central_plant')) + 1.31 * 55000, 6);
    expect(mid('vrf')).toBeCloseTo(2 * 55000, 6);
  });
});
