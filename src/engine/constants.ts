import type { Assumptions, Era, PartId, UpgradeId } from './types';

export const MONTHS_PER_YEAR = 12;
export const BASE_SQFT_FOR_AVG_ELEC = 1800;

/** Order is stable: the 3D scene and tests rely on it. */
export const PART_IDS: PartId[] = ['attic', 'walls', 'windows', 'air_leaks', 'foundation'];

export const DEFAULT_ASSUMPTIONS: Assumptions = {
  priceGrowth: 0.02,
  discountRate: 0.03,
  horizonYears: 15,
};

/** Zone used when a home's climate zone has no entry in the data files. */
export const FALLBACK_CLIMATE_ZONE = '4A';
/** Zone used to look up end-use splits when the home's zone has none. */
export const FALLBACK_SPLIT_ZONE = '5A';

export function eraOf(yearBuilt: number): Era {
  if (yearBuilt < 1980) return 'pre1980';
  if (yearBuilt < 2000) return '1980_1999';
  return '2000plus';
}

/** Equipment age is approximated from yearBuilt (see defaults.json equipmentAgeAssumption). */
export const FURNACE_BOILER_CUTOFF_YEAR = 2005;
export const HEAT_PUMP_AC_CUTOFF_YEAR = 2010;

/** hvacEfficiencyScore anchors: [efficiency, score]. Linear between, clamped to 0–1. */
export const AFUE_SCORE_ANCHORS: [[number, number], [number, number]] = [
  [0.78, 0.2],
  [0.95, 0.9],
];
export const COP_SCORE_ANCHORS: [[number, number], [number, number]] = [
  [2.3, 0.5],
  [3.5, 1],
];

/** Fixed order upgrades are applied in, whatever order the caller lists them (no double counting). */
export const UPGRADE_ORDER: UpgradeId[] = [
  'attic_insulation',
  'air_sealing',
  'windows',
  'heat_pump',
  'smart_thermostat',
];
export const ENVELOPE_UPGRADES: UpgradeId[] = ['attic_insulation', 'air_sealing', 'windows'];

/** Cooling is less envelope-driven than heating: coolingLoad' = coolingLoad x (W + (1 - W) x factor). */
export const COOLING_ENVELOPE_WEIGHT = 0.5;
export const SQFT_PER_WINDOW = 110;
export const HEAT_PUMP_TON_STEP = 0.5;
export const HEAT_PUMP_MIN_TONS = 1.5;
