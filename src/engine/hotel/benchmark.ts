import { hotelData } from './data';
import type { BenchmarkComparison, EnergyResult, HotelData } from './types';

/**
 * The hotel's modeled site EUI (kBtu per ft² per year) next to published peer values (ENERGY STAR hotel median, CBECS lodging mean).
 * For context only: peers are national and mix climates, so a cold-climate hotel with a restaurant is expected to sit above the
 * ENERGY STAR median. Nothing in the model is adjusted toward these values.
 */
export function benchmarkComparison(result: EnergyResult, floorAreaSqft: number, data: HotelData = hotelData): BenchmarkComparison {
  const eui = floorAreaSqft > 0 ? result.annual.siteKBtu / floorAreaSqft : 0;
  const peers = (data.defaults.peerBenchmarks ?? []).map((p) => ({
    ...p,
    difference: p.siteEuiKBtuPerSqft > 0 ? (eui - p.siteEuiKBtuPerSqft) / p.siteEuiKBtuPerSqft : 0,
  }));
  return {
    siteEuiKBtuPerSqft: eui,
    peers,
    note: 'Modeled estimate compared with national peer values (all climates). Comparison only; the model is not adjusted toward them.',
  };
}
