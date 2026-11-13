import { describe, expect, it } from 'vitest';
import { calculateBaselineEnergy } from '../baseline';
import { hotelData } from '../data';
import { evaluatePackage } from '../package';
import { presetProfile, resolveProfile } from '../profile';
import { prepareUpgradeContext } from '../upgrades';
import type { HotelInput } from '../types';

// Multi-city portfolios (13.35): New York, Miami and Denver carry their own sourced weather, solar, prices, grid and ComStock stock data.
const base: HotelInput = { rooms: 150, floors: 10, yearBuilt: 1995, hvacType: 'central_plant', occupancy: 0.7 };
const at = (city: string, state: string) => resolveProfile({ ...base, city, state });
const CITIES = [
  { city: 'New York', state: 'NY', climate: 'new_york', grid: 'NYCW', elec: 0.2293, gas: 1.106, eui: 89.3 },
  { city: 'Miami', state: 'FL', climate: 'miami', grid: 'FRCC', elec: 0.1178, gas: 1.176, eui: 84.8 },
  { city: 'Denver', state: 'CO', climate: 'denver', grid: 'RMPA', elec: 0.1337, gas: 0.877, eui: 88.4 },
];

describe('multi-city data', () => {
  it.each(CITIES)('$city resolves to its own climate, prices, grid subregion and stock energy intensity', (c) => {
    const r = at(c.city, c.state);
    expect(r.profile.climateId).toBe(c.climate);
    expect(r.profile.gridSubregion).toBe(c.grid);
    expect(r.profile.electricityRate).toBeCloseTo(c.elec, 6);
    expect(r.profile.gasRate).toBeCloseTo(c.gas, 6);
    expect(hotelData.defaults.euiKBtuPerSqft[c.climate]).toBe(c.eui);
    expect(r.notes.join(' ')).not.toMatch(/No weather data/);
    const split = hotelData.defaults.endUseShareOfSiteByClimate![c.climate]!;
    expect(Object.values(split).reduce((s, x) => s + x, 0)).toBeCloseTo(1, 9);
    const climate = hotelData.weather.climates[c.climate]!;
    expect(climate.meanTempF).toHaveLength(12);
    expect(climate.solar!.monthlyShare.reduce((s, x) => s + x, 0)).toBeCloseTo(1, 9);
    expect(climate.source).toMatch(/NOAA NCEI U\.S\. Climate Normals 1991-2020/);
  });

  it('a Miami hotel heats little and cools a lot; a Denver hotel heats more than it cools', () => {
    const share = (city: string, state: string) => {
      const b = calculateBaselineEnergy(at(city, state));
      const cost = (u: string) => b.cells.filter((x) => x.endUse === u).reduce((s, x) => s + x.siteKBtu, 0);
      const site = b.cells.reduce((s, x) => s + x.siteKBtu, 0);
      return { heat: cost('heating') / site, cool: cost('cooling') / site };
    };
    const miami = share('Miami', 'FL');
    const chicago = share('Chicago', 'IL');
    const denver = share('Denver', 'CO');
    expect(miami.heat).toBeLessThan(0.03);
    expect(miami.cool).toBeGreaterThan(chicago.cool * 2);
    expect(denver.heat).toBeGreaterThan(denver.cool);
    expect(chicago.heat).toBeGreaterThan(denver.heat);
  });

  it('a city without data still falls back to Chicago weather with a note', () => {
    const r = at('Boise', 'ID');
    expect(r.profile.climateId).toBe('chicago');
    expect(r.notes.join(' ')).toMatch(/No weather data for Boise, ID/);
  });
});

describe('utility incentives follow the territory', () => {
  const lines = (city: string, state: string) => {
    const ctx = prepareUpgradeContext(at(city, state));
    return evaluatePackage(ctx, ['led_lighting', 'occupancy_sensors', 'smart_room_controls', 'rooftop_solar']).financials.incentives;
  };
  it('ComEd programs are listed for a Chicago hotel and not for hotels in other states', () => {
    expect(lines('Chicago', 'IL').some((l) => /ComEd/.test(l.label))).toBe(true);
    for (const c of CITIES) {
      const l = lines(c.city, c.state);
      expect(l.some((x) => /ComEd|Peoples Gas|Illinois Shines/.test(x.label))).toBe(false);
      expect(l.some((x) => /Federal/.test(x.label))).toBe(true); // nationwide program still listed
    }
  });
  it('the Chicago presets are unchanged by the territory rule', () => {
    const f = evaluatePackage(prepareUpgradeContext(presetProfile('demo-chicago-100')), ['led_lighting', 'occupancy_sensors']).financials;
    expect(f.incentives.filter((l) => l.applied).every((l) => /ComEd/.test(l.label))).toBe(true);
  });
});
