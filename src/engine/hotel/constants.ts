import type { Category, EndUse, LoadType, UpgradeId, ZoneId } from './types';

export const ZONE_IDS: ZoneId[] = [
  'guest_rooms',
  'lobby_common',
  'kitchen_restaurant',
  'hallways_shared',
  'central_hvac',
  'hot_water',
];

export const ZONE_LABELS: Record<ZoneId, string> = {
  guest_rooms: 'Guest rooms',
  lobby_common: 'Lobby and common areas',
  kitchen_restaurant: 'Kitchen and restaurant',
  hallways_shared: 'Hallways and shared facilities',
  central_hvac: 'Central HVAC and mechanical',
  hot_water: 'Hot water',
};

export const END_USES: EndUse[] = [
  'heating',
  'cooling',
  'ventilation',
  'lighting',
  'hotWater',
  'kitchen',
  'equipment',
  'other',
];

export const END_USE_LABELS: Record<EndUse, string> = {
  heating: 'Heating',
  cooling: 'Cooling',
  ventilation: 'Ventilation',
  lighting: 'Lighting',
  hotWater: 'Hot water',
  kitchen: 'Cooking and refrigeration',
  equipment: 'Plug loads and equipment',
  other: 'Other',
};

export const CATEGORIES: Category[] = ['hvac', 'lighting', 'hotWater', 'kitchen', 'equipment', 'other'];

export const CATEGORY_OF: Record<EndUse, Category> = {
  heating: 'hvac',
  cooling: 'hvac',
  ventilation: 'hvac',
  lighting: 'lighting',
  hotWater: 'hotWater',
  kitchen: 'kitchen',
  equipment: 'equipment',
  other: 'other',
};

export const HVAC_END_USES: EndUse[] = ['heating', 'cooling', 'ventilation'];

export const LOAD_TYPES: LoadType[] = ['base', 'occupancy', 'weather', 'schedule'];

export const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** A 365-day year; leap days are ignored. */
export const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
export const DAYS_IN_YEAR = 365;

export const KBTU_PER_KWH = 3.412;
export const KBTU_PER_THERM = 100;

/** Calibrating to a bill may scale the benchmark by at most this range; beyond it the result is flagged. */
export const CALIBRATION_RANGE: [number, number] = [0.4, 2.5];

/**
 * The fixed order upgrades are applied in, whatever order the caller lists them (so savings are never double counted):
 * envelope, lighting, controls, equipment, water heating, solar last.
 */
export const UPGRADE_ORDER: UpgradeId[] = [
  'insulation',
  'led_lighting',
  'occupancy_sensors',
  'smart_room_controls',
  'energy_management',
  'hvac_upgrade',
  'water_heating',
  'rooftop_solar_quarter',
  'rooftop_solar_half',
  'rooftop_solar',
];

/** Optimizer defaults. These are modeling choices, not sourced data. */
export const OPTIMIZER_DEFAULTS = {
  /** Packages below this comfort score are excluded unless the caller changes it. */
  minComfortScore: 0.7,
  /**
   * Minimum share of the bill a package must save. PRODUCT DECISION: 0 (no floor), because small upgrades can still be financially
   * attractive; a package must still save money (savings above zero).
   */
  minSavingsShare: 0,
  /**
   * Weights of the balanced score (PRODUCT DECISION, configurable; normalized to sum to 1). Each objective is scaled to 0..1 first:
   * financial = net benefit over the horizon, min-max scaled across the feasible packages; carbon = CO2 avoided per year, min-max
   * scaled the same way; comfort = the package's comfort score (already 0..1, see comfortFor).
   */
  balancedWeights: { financial: 0.5, carbon: 0.3, comfort: 0.2 },
};

/** Rooftop solar at three sizes (a quarter, half or all of the usable roof). They exclude each other; at most one is in a package. */
export const SOLAR_UPGRADES: readonly UpgradeId[] = ['rooftop_solar_quarter', 'rooftop_solar_half', 'rooftop_solar'];
export const isSolar = (id: UpgradeId): boolean => SOLAR_UPGRADES.includes(id);
