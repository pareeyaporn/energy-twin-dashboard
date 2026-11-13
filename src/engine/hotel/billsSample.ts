// Sample utility bills for demonstrations (docs/19 §3): SYNTHETIC, derived from the model's own months for the hotel, then shifted so
// that calibration has something to find. Never real data; the app labels them "Sample data (synthetic)".
import { modeledParts } from './bills';
import type { EnergyResult, HotelProfile, UtilityBillMonth } from './types';

/** The sample's billing year (a full past year before the 2026 analysis year). */
export const SAMPLE_YEAR = 2025;

/**
 * How the sample differs from the model, on purpose and documented: electricity's weather-independent part ×1.06 and its weather
 * part ×0.88; gas ×0.94 and ×1.12 (as if the plug loads ran higher and the heating plant were less efficient than assumed), plus a
 * fixed month-to-month wobble of up to ±2.5% (meter-read timing). Costs are use × the hotel's current rates, rounded to cents.
 */
export const SAMPLE_SHIFT = { elec: { base: 1.06, weather: 0.88 }, gas: { base: 0.94, weather: 1.12 } } as const;
export const SAMPLE_WOBBLE = [0.012, -0.018, 0.025, -0.006, 0.014, -0.022, 0.009, 0.017, -0.013, 0.021, -0.008, -0.015] as const;

/** Twelve calendar-month sample bills for the hotel, from its uncalibrated model result. */
export function sampleUtilityBills(profile: Pick<HotelProfile, 'electricityRate' | 'gasRate'>, raw: Pick<EnergyResult, 'cells'>): UtilityBillMonth[] {
  const e = modeledParts(raw, 'elec');
  const g = modeledParts(raw, 'gas');
  return Array.from({ length: 12 }, (_, m) => {
    const w = 1 + SAMPLE_WOBBLE[m]!;
    const elecKWh = Math.round((e.base[m]! * SAMPLE_SHIFT.elec.base + e.weather[m]! * SAMPLE_SHIFT.elec.weather) * w);
    const gasTherms = Math.round((g.base[m]! * SAMPLE_SHIFT.gas.base + g.weather[m]! * SAMPLE_SHIFT.gas.weather) * (1 - SAMPLE_WOBBLE[(m + 5) % 12]! / 2));
    return {
      month: m,
      elecKWh,
      elecCost: Math.round(elecKWh * profile.electricityRate * 100) / 100,
      gasTherms,
      gasCost: Math.round(gasTherms * profile.gasRate * 100) / 100,
    };
  });
}
