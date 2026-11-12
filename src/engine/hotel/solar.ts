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
  // A user-entered price replaces the tier's middle value; the tier's low and high spread is kept around it.
  if (p.solarCostPerW !== undefined && t.mid > 0) {
    const k = p.solarCostPerW / t.mid;
    return { low: t.low * k, mid: p.solarCostPerW, high: t.high * k };
  }
  return { low: t.low, mid: t.mid, high: t.high };
}

/** Credit per exported kWh; $0 when the region's export compensation has not been researched. */
export function exportCreditPerKWh(p: HotelProfile, data: HotelData = hotelData): number {
  // User value first; otherwise the region's researched credit; otherwise $0, a conservative fallback until the tariff is confirmed.
  return p.solarExportCreditPerKWh ?? regionalSolar(p, data).exportCreditPerKWh ?? 0;
}

export function solarYield(p: HotelProfile, scenario: SavingsScenario, data: HotelData = hotelData): number {
  return climateSolar(p, data).kWhPerKwYear[scenario];
}

/** The sun's declination in the middle of a month, in radians. */
function declination(month: number): number {
  const n = MID_MONTH_DAY[month] ?? 15;
  return ((23.44 * Math.PI) / 180) * Math.sin((2 * Math.PI * (284 + n)) / 365);
}

/** Sunrise, sunset (clock hours) and day length for a latitude in the middle of a month. Clear-sky geometry, no refraction. */
export function daylight(latitudeDeg: number, month: number): { sunrise: number; sunset: number; dayHours: number } {
  const phi = (latitudeDeg * Math.PI) / 180;
  const cosW = Math.min(1, Math.max(-1, -Math.tan(phi) * Math.tan(declination(month))));
  const dayHours = (2 * Math.acos(cosW) * 180) / Math.PI / 15;
  return { sunrise: SOLAR_NOON_HOUR - dayHours / 2, sunset: SOLAR_NOON_HOUR + dayHours / 2, dayHours };
}

/** The sun's height above the horizon in degrees (negative below it) at a clock hour, mid-month. */
export function sunElevationDeg(latitudeDeg: number, month: number, hour: number): number {
  const phi = (latitudeDeg * Math.PI) / 180;
  const d = declination(month);
  const h = ((hour - SOLAR_NOON_HOUR) * 15 * Math.PI) / 180;
  const s = Math.sin(phi) * Math.sin(d) + Math.cos(phi) * Math.cos(d) * Math.cos(h);
  return (Math.asin(Math.min(1, Math.max(-1, s))) * 180) / Math.PI;
}

/** The sun's compass direction in degrees (0 north, 90 east, 180 south, 270 west) at a clock hour, mid-month. */
export function sunAzimuthDeg(latitudeDeg: number, month: number, hour: number): number {
  const phi = (latitudeDeg * Math.PI) / 180;
  const d = declination(month);
  const h = ((hour - SOLAR_NOON_HOUR) * 15 * Math.PI) / 180;
  const az = Math.atan2(Math.sin(h), Math.cos(h) * Math.sin(phi) - Math.tan(d) * Math.cos(phi));
  return ((az * 180) / Math.PI + 180 + 360) % 360;
}

/**
 * Average kW from a solar array during a clock hour of a typical day in a month: size × the location's yearly output per kW (mid) ×
 * the month's share ÷ days × the hour's share of the day (`daylightShape`). Zero at night. Matches the monthly totals the engine uses.
 */
export function solarHourKW(p: HotelProfile, sizeKw: number, month: number, hour: number, data: HotelData = hotelData): number {
  if (sizeKw <= 0) return 0;
  const sol = climateSolar(p, data);
  const days = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month] ?? 30;
  const monthKWh = sizeKw * sol.kWhPerKwYear.mid * (sol.monthlyShare[month] ?? 0);
  return (monthKWh / days) * (daylightShape(climateLatitude(p, data), month)[Math.min(23, Math.max(0, Math.round(hour)))] ?? 0);
}

/**
 * Modeled outdoor temperature (°F) at a clock hour of a typical day: the month's normal low around sunrise, rising to the normal high at
 * 3 pm, then falling back (a standard two-part cosine curve). Uses NOAA monthly normal highs and lows; falls back to the mean if absent.
 */
export function outdoorTempF(p: HotelProfile, month: number, hour: number, data: HotelData = hotelData): number {
  const c = data.weather.climates[p.climateId] ?? data.weather.climates[data.weather.defaultClimate];
  const mean = c?.meanTempF[month] ?? 50;
  const hi = c?.highTempF?.[month] ?? mean + 6;
  const lo = c?.lowTempF?.[month] ?? mean - 6;
  const { sunrise } = daylight(climateLatitude(p, data), month);
  const peak = 15;
  const h = ((hour % 24) + 24) % 24;
  let f: number;
  if (h >= sunrise && h <= peak) f = (1 - Math.cos((Math.PI * (h - sunrise)) / (peak - sunrise))) / 2;
  else {
    const since = h > peak ? h - peak : h + 24 - peak;
    f = (1 + Math.cos((Math.PI * since) / (24 - peak + sunrise))) / 2;
  }
  return lo + (hi - lo) * f;
}

/**
 * Share of a typical day's solar output in each clock hour for a month: a half-sine between sunrise and sunset, with the day length
 * from the latitude and the sun's declination in the middle of the month. A clear-sky shape: it ignores day-to-day weather, so the
 * exported share is a typical-day estimate. Weights sum to 1.
 */
export function daylightShape(latitudeDeg: number, month: number): number[] {
  const { sunrise, dayHours } = daylight(latitudeDeg, month);
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
