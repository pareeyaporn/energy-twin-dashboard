import { hotelData } from './data';
import type { ClimateSolar, HotelData, HotelProfile, Range3, RegionalSolar, SavingsScenario } from './types';

const MID_MONTH_DAY = [15, 46, 74, 105, 135, 166, 196, 227, 258, 288, 319, 349];
/** Hours are local clock time; solar noon in Chicago is close to 12:30 on average across the year. */
const SOLAR_NOON_HOUR = 12.5;

/** The climate's solar data. Throws if the climate has none, so a missing source is never silently replaced by a guess. */
export function climateSolar(p: HotelProfile, data: HotelData = hotelData): ClimateSolar {
  const c = data.weather.climates[p.climateId] ?? data.weather.climates[data.weather.defaultClimate];
  if (!c?.solar) throw new Error(`No solar data for climate ${p.climateId}.`);
  return c.solar;
}

export function climateLatitude(p: HotelProfile, data: HotelData = hotelData): number {
  const c = data.weather.climates[p.climateId] ?? data.weather.climates[data.weather.defaultClimate];
  return c?.latitude ?? 40;
}

/** Regional solar pricing and export credit for the hotel's state (falls back to the default region). */
export function regionalSolar(p: HotelProfile, data: HotelData = hotelData): RegionalSolar {
  const r = data.rates[p.state]?.solar ?? data.rates['default']?.solar;
  if (!r) throw new Error(`No solar pricing for ${p.state}.`);
  return r;
}

/** Installed cost per W (DC) for a system of this size in the hotel's region: the first size tier that covers it. */
export function solarCostPerW(sizeKw: number, p: HotelProfile, data: HotelData = hotelData): Range3 {
  const tiers = regionalSolar(p, data).installedCostPerW;
  const t = tiers.find((x) => x.upToKw === null || sizeKw <= x.upToKw) ?? tiers[tiers.length - 1];
  if (!t) throw new Error('No solar cost tiers.');
  return { low: t.low, mid: t.mid, high: t.high };
}

/** Credit per exported kWh; $0 when the region's export compensation has not been researched. */
export function exportCreditPerKWh(p: HotelProfile, data: HotelData = hotelData): number {
  return regionalSolar(p, data).exportCreditPerKWh ?? 0;
}

export function solarYield(p: HotelProfile, scenario: SavingsScenario, data: HotelData = hotelData): number {
  return climateSolar(p, data).kWhPerKwYear[scenario];
}

/**
 * Share of a typical day's solar output in each clock hour for a month: a half-sine between sunrise and sunset, with the day length
 * from the latitude and the sun's declination in the middle of the month. A clear-sky shape: it ignores day-to-day weather, so the
 * exported share is a typical-day estimate. Weights sum to 1.
 */
export function daylightShape(latitudeDeg: number, month: number): number[] {
  const n = MID_MONTH_DAY[month] ?? 15;
  const decl = ((23.44 * Math.PI) / 180) * Math.sin((2 * Math.PI * (284 + n)) / 365);
  const phi = (latitudeDeg * Math.PI) / 180;
  const cosW = Math.min(1, Math.max(-1, -Math.tan(phi) * Math.tan(decl)));
  const dayHours = (2 * Math.acos(cosW) * 180) / Math.PI / 15;
  const sunrise = SOLAR_NOON_HOUR - dayHours / 2;
  const w = Array.from({ length: 24 }, (_, h) => {
    // Average of the curve over the hour, sampled at quarter hours.
    let s = 0;
    for (const q of [0.125, 0.375, 0.625, 0.875]) {
      const x = (h + q - sunrise) / dayHours;
      s += x > 0 && x < 1 ? Math.sin(Math.PI * x) : 0;
    }
    return s / 4;
  });
  const sum = w.reduce((a, b) => a + b, 0);
  return w.map((x) => (sum > 0 ? x / sum : 0));
}
