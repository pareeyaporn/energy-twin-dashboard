// Hotel engine types. See docs/13_HOTEL_ENGINE_SPEC.md.

export type ZoneId =
  | 'guest_rooms'
  | 'lobby_common'
  | 'kitchen_restaurant'
  | 'hallways_shared'
  | 'central_hvac'
  | 'hot_water';

export type EndUse =
  | 'heating'
  | 'cooling'
  | 'ventilation'
  | 'lighting'
  | 'hotWater'
  | 'kitchen'
  | 'equipment'
  | 'other';

/** The spec's categories: HVAC = heating + cooling + ventilation. */
export type Category = 'hvac' | 'lighting' | 'hotWater' | 'kitchen' | 'equipment' | 'other';

/** The spec's load kinds. */
export type LoadType = 'base' | 'occupancy' | 'weather' | 'schedule';

export type HvacType = 'ptac' | 'vrf' | 'central_plant' | 'rtu';
export type Objective = 'annual_savings' | 'payback' | 'roi' | 'carbon' | 'balanced';
export type FuelKind = 'electric' | 'gas';

export interface Setpoints {
  occupiedHeatF: number;
  occupiedCoolF: number;
  vacantHeatF: number;
  vacantCoolF: number;
}

/** What a user may enter. Everything is optional; missing values get labeled defaults. */
export interface HotelInput {
  name?: string;
  city?: string;
  state?: string;
  country?: string;
  rooms?: number;
  floorAreaSqft?: number;
  floors?: number;
  yearBuilt?: number;
  operatingHours?: number;
  hvacType?: HvacType;
  monthlyEnergyBill?: number;
  electricityRate?: number; // $/kWh
  gasRate?: number; // $/therm
  occupancy?: number; // annual average, 0..1
  seasonalOccupancy?: number[]; // 12 relative factors
  occupiedHoursPerRoom?: number; // hours per day a guest is present in a booked room
  setpoints?: Partial<Setpoints>;
  smartRoomControls?: boolean;
  commonAreaHvacHours?: number;
  lightingHoursPerDay?: number;
  hotWaterGalPerOccupiedRoomDay?: number;
  budget?: number;
  horizonYears?: number;
  objective?: Objective;
}

/** Every field filled in. */
export interface HotelProfile {
  name: string;
  city: string;
  state: string;
  country: string;
  climateId: string;
  rooms: number;
  floorAreaSqft: number;
  floors: number;
  yearBuilt: number;
  operatingHours: number;
  hvacType: HvacType;
  monthlyEnergyBill: number | null;
  electricityRate: number;
  gasRate: number;
  occupancy: number;
  seasonalOccupancy: number[];
  occupiedHoursPerRoom: number;
  setpoints: Setpoints;
  smartRoomControls: boolean;
  commonAreaHvacHours: number;
  lightingHoursPerDay: number;
  hotWaterGalPerOccupiedRoomDay: number;
  budget: number;
  horizonYears: number;
  objective: Objective;
}

export interface ResolvedProfile {
  profile: HotelProfile;
  /** Field names that were not entered and got a default (the UI shows "default (estimate)"). */
  defaulted: string[];
  /** Notes about clamped or substituted values. */
  notes: string[];
}

/** A what-if. Every field overrides the profile; omitted fields keep the profile's value. */
export interface Scenario {
  occupancy?: number; // new annual average, 0..1
  occupancyDeltaPts?: number[]; // per-month change in occupancy (0.25 = +25 points), added after seasonal shaping
  setpoints?: Partial<Setpoints>;
  smartRoomControls?: boolean;
  commonAreaHvacHours?: number;
  lightingHoursPerDay?: number;
  hotWaterGalPerOccupiedRoomDay?: number;
  occupiedHoursPerRoom?: number;
  electricityRateChangePct?: number; // 20 = +20%
  gasRateChangePct?: number;
  weatherOffsetF?: number | number[]; // degrees F added to the monthly mean temperature
}

/** The effective operating conditions the simulation runs on. */
export interface Conditions {
  occupancyByMonth: number[];
  occupiedHoursPerRoom: number;
  setpoints: Setpoints;
  smartRoomControls: boolean;
  commonAreaHvacHours: number;
  lightingHoursPerDay: number;
  hotWaterGalPerOccupiedRoomDay: number;
  weatherOffsetF: number[];
  elecRateMult: number;
  gasRateMult: number;
}

export interface Totals {
  elecKWh: number;
  gasTherms: number;
  siteKBtu: number;
  elecCost: number;
  gasCost: number;
  cost: number;
  carbonKg: number;
}

export interface Cell {
  zone: ZoneId;
  endUse: EndUse;
  month: number; // 0..11
  elecKWh: number;
  gasTherms: number;
  siteKBtu: number;
  elecCost: number;
  gasCost: number;
  cost: number;
  carbonKg: number;
  /** Site kBtu by load kind (they sum to siteKBtu). */
  loadKBtu: Record<LoadType, number>;
}

export interface MonthSummary {
  month: number;
  days: number;
  occupancy: number;
  hdd: number;
  cdd: number;
  totals: Totals;
}

export interface Calibration {
  factor: number;
  source: 'bill' | 'benchmark';
  clamped: boolean;
}

export interface EnergyResult {
  hotelName: string;
  cells: Cell[];
  months: MonthSummary[];
  annual: Totals;
  byZone: Record<ZoneId, Totals>;
  byCategory: Record<Category, Totals>;
  byEndUse: Record<EndUse, Totals>;
  /** Site kBtu by load kind, whole hotel. */
  byLoadType: Record<LoadType, number>;
  calibration: Calibration;
  rates: { elecPerKWh: number; gasPerTherm: number };
  emissionFactors: { elecKgPerKWh: number; gasKgPerTherm: number };
  /** True when benchmarks stood in for the hotel's own bill, or any input was defaulted. */
  estimated: boolean;
  conditions: Conditions;
  sources: string[];
}

export interface ComfortFlag {
  id: string;
  severity: 'info' | 'warn';
  message: string;
}

export interface Driver {
  id: 'occupancy' | 'setpoints' | 'schedules' | 'weather' | 'rates';
  label: string;
  deltaElecKWh: number;
  deltaGasTherms: number;
  deltaCost: number;
  deltaCarbonKg: number;
  /** Largest cell changes behind this driver, as plain text built from the numbers. */
  detail: string;
}

export interface ScenarioResult {
  before: EnergyResult;
  after: EnergyResult;
  delta: Totals;
  deltaByZone: Record<ZoneId, Totals>;
  deltaByCategory: Record<Category, Totals>;
  drivers: Driver[];
  flags: ComfortFlag[];
}

// ---- Shapes of the JSON files in src/data/hotel ----

export interface DriverWeights {
  base: number;
  occupancy: number;
  weather: number;
  schedule: number;
}

export interface HotelData {
  defaults: {
    benchmarkOccupancy: number;
    benchmarkHotWaterGalPerOccupiedRoomDay: number;
    euiKBtuPerSqft: Record<string, number>;
    ageFactor: { before: number; factor: number }[];
    endUseShareOfSite: Record<EndUse, number>;
    heatingFuelByHvac: Record<HvacType, FuelKind>;
    fuelMix: Record<Exclude<EndUse, 'heating'>, { electric: number; gas: number }>;
    driverWeights: Record<EndUse, DriverWeights>;
    hvacZoneShares: Record<Exclude<ZoneId, 'central_hvac' | 'hot_water'>, number>;
    hvacPlantShare: Record<HvacType, number>;
    zoneAllocation: Record<'lighting' | 'equipment' | 'other' | 'kitchen' | 'hotWater', Record<ZoneId, number>>;
    referenceSetpoints: { heatF: number; coolF: number };
    setpointSensitivity: { heatingPerF: number; coolingPerF: number; min: number; max: number };
    commonHvacRecoveryFactor: number;
    smartControlSetbackF: number;
    vacantLimits: { minHeatF: number; maxCoolF: number };
    comfort: {
      occupiedHeatMinF: number;
      occupiedCoolMaxF: number;
      commonHvacMinHours: number;
      vacantHeatWarnF: number;
      vacantCoolWarnF: number;
    };
    profileDefaults: {
      rooms: number;
      sqftPerRoom: number;
      roomsPerFloorTarget: number;
      yearBuilt: number;
      operatingHours: number;
      hvacType: HvacType;
      occupancy: number;
      occupiedHoursPerRoom: number;
      setpoints: { occupiedHeatF: number; occupiedCoolF: number };
      smartRoomControls: boolean;
      lightingHoursPerDay: number;
      hotWaterGalPerOccupiedRoomDay: number;
      budget: number;
      horizonYears: number;
      objective: Objective;
      state: string;
      city: string;
      country: string;
      seasonalOccupancy: number[];
    };
    source: string;
    verified: boolean;
  };
  weather: {
    climates: Record<string, { label: string; meanTempF: number[]; balancePointF: number }>;
    cityToClimate: Record<string, string>;
    defaultClimate: string;
    source: string;
    verified: boolean;
  };
  rates: Record<string, { commercialElecPerKWh: number; commercialGasPerTherm: number; source: string; verified: boolean }>;
  emissions: {
    elecKgCO2ePerKWh: Record<string, number>;
    gasKgCO2ePerTherm: number;
    source: string;
    verified: boolean;
  };
  shapes: {
    hourly: Record<EndUse, number[]>;
    guestPresence: number[];
    source: string;
    verified: boolean;
  };
  equipment: {
    publicAreaShareOfFloorArea: number;
    corridorShareOfFloorArea: number;
    inRoomUnit: Record<HvacType, { label: string; ratedKW: number; efficiency: string }>;
    central: {
      ptac: { label: string; tonsPerPublicSqft: number; efficiency: string };
      vrf: { label: string; tonsPerRoom: number; efficiency: string };
      central_plant: { label: string; boilerKBtuHPerSqft: number; tonsPerSqft: number; efficiency: string };
      rtu: { label: string; tonsPerSqft: number; efficiency: string };
    };
    guestRoomLightingKW: number;
    guestRoomPlugKW: number;
    lightingWPerSqft: number;
    kitchen: { rangeKBtuHPerRoom: number; hoods: number; hoodKW: number; refrigeration: number; refrigerationKW: number };
    elevators: { perFloors: number; ratedKW: number };
    laundry: { dryerKBtuH: number };
    hotWater: { heaterKBtuHPerRoom: number; storageGalPerRoom: number; recircPumps: number; recircPumpKW: number };
    source: string;
    verified: boolean;
  };
  presets: { id: string; label: string; synthetic: boolean; input: HotelInput }[];
}
