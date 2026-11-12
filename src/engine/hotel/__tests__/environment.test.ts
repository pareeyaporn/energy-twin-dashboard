import { describe, expect, it } from 'vitest';
import { calculateBaselineEnergy } from '../baseline';
import { END_USES } from '../constants';
import { hotelData } from '../data';
import { presetProfile } from '../profile';
import { daylight, daylightShape, outdoorTempF, solarHourKW, sunElevationDeg } from '../solar';
import { typicalDayProfile } from '../twin';

const demo = presetProfile('demo-chicago-100');
const p = demo.profile;
const chicago = hotelData.weather.climates['chicago']!;

describe('modeled outdoor temperature (NOAA normal highs and lows)', () => {
  it('reaches the normal high at 3 pm and the normal low around sunrise, every month', () => {
    for (let m = 0; m < 12; m++) {
      expect(outdoorTempF(p, m, 15)).toBeCloseTo(chicago.highTempF![m]!, 6);
      const { sunrise } = daylight(41.88, m);
      expect(outdoorTempF(p, m, sunrise)).toBeCloseTo(chicago.lowTempF![m]!, 6);
      for (let h = 0; h < 24; h += 0.5) {
        const t = outdoorTempF(p, m, h);
        expect(t).toBeGreaterThanOrEqual(chicago.lowTempF![m]! - 1e-9);
        expect(t).toBeLessThanOrEqual(chicago.highTempF![m]! + 1e-9);
      }
    }
  });

  it('is cold on a January night and warm on a July afternoon', () => {
    expect(outdoorTempF(p, 0, 2)).toBeLessThan(25);
    expect(outdoorTempF(p, 6, 15)).toBeGreaterThan(80);
  });
});

describe('sun and daylight', () => {
  it('rises later and sets earlier in winter than in summer, and is below the horizon at midnight', () => {
    const jan = daylight(41.88, 0);
    const jun = daylight(41.88, 5);
    expect(jan.sunrise).toBeGreaterThan(jun.sunrise);
    expect(jan.sunset).toBeLessThan(jun.sunset);
    expect(jun.dayHours - jan.dayHours).toBeGreaterThan(5);
    expect(sunElevationDeg(41.88, 0, 0)).toBeLessThan(0);
    expect(sunElevationDeg(41.88, 6, 12.5)).toBeGreaterThan(sunElevationDeg(41.88, 0, 12.5));
  });
});

describe('hourly solar', () => {
  it('is zero at night, positive at noon, and adds up to the monthly output the engine uses', () => {
    expect(solarHourKW(p, 55, 0, 1)).toBe(0);
    expect(solarHourKW(p, 55, 6, 13)).toBeGreaterThan(0);
    const sol = chicago.solar!;
    for (const m of [0, 6]) {
      let day = 0;
      for (let h = 0; h < 24; h++) day += solarHourKW(p, 55, m, h);
      const days = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m]!;
      expect(day * days).toBeCloseTo(55 * sol.kWhPerKwYear.mid * sol.monthlyShare[m]!, 6);
    }
    expect(daylightShape(41.88, 6).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 9);
  });
});

describe('typical day by end use', () => {
  it('splits each hour by end use and the parts add up to the hour', () => {
    const day = typicalDayProfile(calculateBaselineEnergy(demo), 0);
    for (const pt of day) {
      const elec = END_USES.reduce((s, u) => s + pt.byEndUse[u].elecKW, 0);
      const gas = END_USES.reduce((s, u) => s + pt.byEndUse[u].gasThermsPerHour, 0);
      expect(elec).toBeCloseTo(pt.elecKW, 9);
      expect(gas).toBeCloseTo(pt.gasThermsPerHour, 9);
    }
    // January heating is larger at 6 am than July heating
    const july = typicalDayProfile(calculateBaselineEnergy(demo), 6);
    expect(day[6]!.byEndUse.heating.gasThermsPerHour).toBeGreaterThan(july[6]!.byEndUse.heating.gasThermsPerHour);
    expect(july[15]!.byEndUse.cooling.elecKW).toBeGreaterThan(day[15]!.byEndUse.cooling.elecKW);
  });
});
