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
