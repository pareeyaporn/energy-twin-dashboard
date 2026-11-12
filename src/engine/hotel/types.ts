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

export type HvacType = 'ptac' | 'pthp' | 'vrf' | 'central_plant' | 'rtu';
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
  /** EPA eGRID subregion acronym (for example RFCW); defaults from the city, then the state, then the U.S. rate. */
  gridSubregion?: string;
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
  /** EPA eGRID subregion used for the grid emission factor ('US' when only the national rate applies). */
  gridSubregion: string;
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
    /** Published peer site EUIs, for comparison only (they do not change the model). Optional for older data files. */
    peerBenchmarks?: { id: string; label: string; siteEuiKBtuPerSqft: number; source: string }[];
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
    /** Heating system by HVAC type: kind and seasonal efficiency (COP for heat pumps); `reference` is the efficiency behind the CBECS share. */
    heatingSystems: Record<HvacType, { kind: 'gas' | 'resistance' | 'heatPump'; efficiency: number }> & { reference: { efficiency: number }; source: string };
    zoneAllocation: Record<'lighting' | 'equipment' | 'other' | 'kitchen' | 'hotWater', Record<ZoneId, number>>;
    referenceSetpoints: { heatF: number; coolF: number };
    setpointSensitivity: { heatingPerF: number; coolingPerF: number; min: number; max: number };
    commonHvacRecoveryFactor: number;
    smartControlSetbackF: number;
    recovery: {
      kBtuPerRoomPerF: number;
      returnsPerBookedRoomPerDay: number;
      referenceOccupiedHoursPerRoom: number;
      coolingCOP: number;
    };
    vacantLimits: { minHeatF: number; maxCoolF: number };
    comfort: {
      occupiedHeatMinF: number;
      occupiedCoolMaxF: number;
      commonHvacMinHours: number;
      vacantHeatWarnF: number;
      vacantCoolWarnF: number;
    };
    /** With smart room controls, the share of guest-room fan energy saved while a room is empty (calibrated to the IL-TRM). */
    smartControlFan: { reductionWhenEmpty: number; source: string };
    /** Energy price growth (nominal, a year) and the discount rate, with their source. */
    finance: { elecPriceGrowth: number; gasPriceGrowth: number; discountRate: number; discountRateAlternatives: number[]; source: string; verified: boolean };
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
    climates: Record<string, { label: string; meanTempF: number[]; highTempF?: number[]; lowTempF?: number[]; balancePointF: number; latitude?: number; solar?: ClimateSolar }>;
    cityToClimate: Record<string, string>;
    defaultClimate: string;
    source: string;
    verified: boolean;
  };
  rates: Record<string, { commercialElecPerKWh: number; commercialGasPerTherm: number; solar?: RegionalSolar; source: string; verified: boolean }>;
  incentives: { incentives: IncentiveProgram[]; source: string; verified: boolean };
  emissions: {
    /** EPA eGRID subregion output emission rates, CO2e. */
    subregions: Record<string, { name: string; kgCO2ePerKWh: number }>;
    usKgCO2ePerKWh: number;
    cityToSubregion: Record<string, string>;
    stateDefaultSubregion: Record<string, string>;
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
      pthp: { label: string; tonsPerPublicSqft: number; efficiency: string };
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
  presets: { id: string; label: string; synthetic: boolean; note?: string; input: HotelInput }[];
  upgrades: UpgradesData;
}

// ---- Upgrades, costs and financial metrics (Phase 2) ----

export type UpgradeId =
  | 'smart_room_controls'
  | 'insulation'
  | 'led_lighting'
  | 'occupancy_sensors'
  | 'energy_management'
  | 'hvac_upgrade'
  | 'water_heating'
  | 'rooftop_solar_quarter'
  | 'rooftop_solar_half'
  | 'rooftop_solar';

/** low = pessimistic savings (and cheapest-to-install for cost ranges are separate); high = optimistic. */
export type SavingsScenario = 'low' | 'mid' | 'high';

/** Location-specific solar output: kWh per kW (DC) per year and the share produced in each month. */
export interface ClimateSolar {
  kWhPerKwYear: Range3;
  monthlyShare: number[];
  source: string;
  verified: boolean;
}

/** Regional solar pricing: installed cost per W (DC) by system size, and the credit for each kWh exported (null = not researched, so $0). */
export interface RegionalSolar {
  installedCostPerW: ({ upToKw: number | null } & Range3)[];
  exportCreditPerKWh: number | null;
  source: string;
  verified: boolean;
}

/** A program that may lower an upgrade's upfront cost. Only applied when its amount and eligibility are confirmed. */
export interface IncentiveProgram {
  id: string;
  label: string;
  appliesTo: UpgradeId[];
  /** percent_of_cost: value is a share (0.3 = 30%); per_kw: $ per kW of solar; per_room: $ per guest room; fixed: $. */
  kind: 'percent_of_cost' | 'per_kw' | 'per_room' | 'fixed';
  value: number | null;
  applied: boolean;
  note: string;
  source: string;
  verified: boolean;
  /** 'verified' once the amount and eligibility are confirmed from the program's own source; 'unverified' until then. */
  status?: 'verified' | 'unverified';
}

/** One incentive line on an upgrade's financial breakdown. */
export interface IncentiveLine {
  id: string;
  label: string;
  /** Dollar amount at the mid cost; 0 when not applied. */
  amount: number;
  applied: boolean;
  /** "program" (from the incentives data) or "user" (an amount the user entered). */
  origin: 'program' | 'user';
  note: string;
  source: string;
}

/**
 * The same financial breakdown for every upgrade and package, so they can be compared fairly. All dollar values are estimates.
 * Net benefit over N years = sum of yearly savings (first-year savings, solar output falling by its degradation rate, energy prices
 * rising by the price growth rate) minus the net upfront investment. Ranges pair low savings with high cost and the reverse.
 */
export interface FinancialBreakdown {
  /** 1. Installed cost before incentives. */
  grossCost: Range3;
  /** 2. Incentives considered (applied or listed as possible but not applied). */
  incentives: IncentiveLine[];
  /** Sum of the applied incentives at the mid cost. */
  incentivesTotal: number;
  /** 3. Gross cost minus applied incentives. */
  netInvestment: Range3;
  /** 4. Energy saved each year (mid), including solar electricity the hotel no longer buys. */
  annualEnergySavings: { elecKWh: number; gasTherms: number; siteKBtu: number };
  /** 5. Money saved each year (first year), including any export credit. */
  annualSavings: Range3;
  /** 6. Net investment (mid) divided by first-year savings (mid); null if it does not save money. */
  simplePaybackYears: number | null;
  /** 7. Net financial benefit over 5 and 10 years. */
  netBenefit5: Range3;
  netBenefit10: Range3;
  /** 8. CO2 avoided each year, kg. */
  carbonAvoidedKgPerYear: Range3;
  /** Net present value over 5 and 10 years at `discountRate` (same savings stream, discounted). For the detailed comparison. */
  /** Optional in the type for backwards compatibility; the engine always sets them. */
  discountRate?: number;
  npv5?: Range3;
  npv10?: Range3;
  /**
   * Year-by-year projection, years 1 to 10, from the same savings stream as the net benefit and NPV (so year 5 and year 10 match
   * `netBenefit5` and `netBenefit10`). Optional in the type for backwards compatibility; the engine always sets it.
   */
  projection?: ProjectionYear[];
  /** Solar details when the upgrade includes solar. */
  solar: SolarDetails | null;
  /** Plain-language assumptions behind these numbers (shown next to them). */
  assumptions: string[];
}

export interface ProjectionYear {
  /** 1 is the first year after installation. */
  year: number;
  /** Savings in this year (price growth and solar wear included; solar upkeep subtracted). */
  savings: Range3;
  /** Savings to date minus the net investment (negative until the upgrade has paid back). */
  cumulativeNet: Range3;
  /** The same, with savings discounted at `discountRate` (mid case). */
  cumulativeNpv: number;
}

export interface SolarDetails {
  sizeKw: number;
  /** Yearly generation (mid). */
  generationKWh: number;
  /** Used by the hotel as it is produced. */
  selfConsumedKWh: number;
  /** Sent to the grid. */
  exportedKWh: number;
  /** Credit per exported kWh used ($0 when not researched). */
  exportCreditPerKWh: number;
  /** Yearly operation and maintenance, already subtracted from the annual savings. */
  omPerYear: number;
  /** Installed cost per W used for this size and region (mid). */
  installedCostPerW: number;
  degradationPerYear: number;
}

export interface Range3 {
  low: number;
  mid: number;
  high: number;
}

export interface CostModel {
  fixed?: Range3;
  perRoom?: Range3;
  perSqftFloor?: Range3;
  perSqftRoof?: Range3;
  perSqftCommon?: Range3;
  perKw?: Range3;
}

export interface UpgradeDef {
  id: UpgradeId;
  label: string;
  description: string;
  lifetimeYears: number;
  cost: CostModel;
  /** The floor-area part of the cost scales with the HVAC size factor (equipment sized from the reduced load). */
  sizeScaled?: boolean;
  params: Record<string, Range3>;
  constants: Record<string, number>;
  comfort: { impact: 'none' | 'minor' | 'positive'; note: string };
  requires: UpgradeId[];
  excludes: UpgradeId[];
  source: string;
  verified: boolean;
}

export interface LightingInteraction {
  coolingPerSavedKBtu: number;
  heatingPerSavedKBtu: { gas: number; resistance: number; heatPump: number };
}

export interface UpgradesData {
  /** Lighting-HVAC interaction per kBtu of lighting saved, by space (guest rooms or common areas) and heating kind (IL-TRM). */
  interaction: {
    guest: LightingInteraction;
    common: LightingInteraction;
    heatingKindByHvac: Record<HvacType, 'gas' | 'resistance' | 'heatPump'>;
    source: string;
  };
  comfortScore: { minorPenalty: number; flagPenalty: number };
  upgrades: UpgradeDef[];
  source: string;
  verified: boolean;
}

export interface PackageComfort {
  /** 1 = no comfort impact; each upgrade with a minor impact and each warning flag lowers it. */
  score: number;
  notes: ComfortFlag[];
}

export interface UpgradeSizing {
  /** Share of baseline heating and cooling weather load left before the HVAC step (1 = no reduction). Sizes the equipment cost. */
  hvacSizeFactor: number;
  solarKw: number;
  /** Solar electricity the hotel uses itself (no longer bought), kWh a year. */
  solarKWhYear: number;
  /** Total solar generation and the part exported, kWh a year. */
  solarGenerationKWhYear: number;
  solarExportKWhYear: number;
  /** Dollars a year from solar: avoided purchases plus export credit. The part of the savings that degrades with the panels. */
  solarValuePerYear: number;
  /** Yearly operation and maintenance of the solar array, subtracted from the savings. */
  solarOmPerYear: number;
}

export interface UpgradeOutcome {
  upgradeIds: UpgradeId[];
  scenario: SavingsScenario;
  /** Annual totals after the upgrades. */
  annual: Totals;
  /** Baseline minus after (positive = saved). */
  savings: Totals;
  /** The adjusted cells (rebuild a full result with `toEnergyResult`). */
  cells: Cell[];
  sizing: UpgradeSizing;
  comfort: PackageComfort;
}

export interface FinancialAssumptions {
  /** Electricity price growth a year (nominal), for example 0.0212. */
  priceGrowth: number;
  /** Natural gas price growth a year (nominal); defaults to priceGrowth when absent. */
  gasPriceGrowth?: number;
  discountRate: number; // for example 0.03
  horizonYears: number;
}

export interface FinancialMetrics {
  /** Gross installed cost (mid). The budget is checked against this, because most incentives arrive after installation. */
  cost: number; // mid
  /** Gross cost minus applied incentives (mid). Payback, net benefit, NPV and ROI use this. */
  netInvestment: number;
  annualSavings: number; // mid, first year
  paybackYears: number | null; // null if savings <= 0
  /** Sum of yearly savings (with price growth) over the horizon minus cost. No residual value. */
  netBenefit: number;
  /** The same, discounted. */
  npv: number;
  /** NPV including the remaining life of the equipment beyond the horizon. */
  npvWithResidual: number;
  /** Net benefit divided by cost. null if cost is 0. */
  roi: number | null;
  horizonYears: number;
  carbonAvoidedKgPerYear: number;
  carbonAvoidedKgHorizon: number;
  remainingBudget: number;
}

export interface PackageLineItem {
  id: UpgradeId;
  label: string;
  cost: Range3;
  /** Marginal annual savings at mid, applying upgrades one at a time in the fixed order. They sum to the package savings. */
  annualSavingsMid: number;
  lifetimeYears: number;
  source: string;
}

export interface PackageEvaluation {
  id: string;
  upgradeIds: UpgradeId[];
  name: string;
  cost: Range3;
  annualSavings: Range3;
  newAnnualCost: number;
  carbonAvoidedKg: Range3;
  metrics: FinancialMetrics;
  /** The common financial breakdown (gross cost, incentives, net investment, energy and money saved, payback, 5- and 10-year benefit, CO2). */
  financials: FinancialBreakdown;
  comfort: PackageComfort;
  sizing: UpgradeSizing;
  lineItems: PackageLineItem[];
  /** The mid-scenario outcome (for the twin's before/after). */
  outcome: UpgradeOutcome;
}

// ---- Budget optimizer (Phase 3) ----

export type PackageRole = 'max_savings' | 'fastest_payback' | 'balanced' | 'max_roi' | 'max_carbon';

export interface OptimizerOptions {
  /** Defaults to the profile's budget. */
  budget?: number;
  /** Which winner to highlight; defaults to the profile's objective. */
  objective?: Objective;
  /** Packages scoring below this comfort score are excluded (see comfortFor). */
  minComfortScore?: number;
  /** Packages must save at least this share of the current bill to be recommended (so a trivial package is not "fastest"). */
  minSavingsShare?: number;
  assumptions?: Partial<FinancialAssumptions>;
  /** Confirmed incentive amounts entered by the user, per upgrade (dollars). */
  incentives?: Partial<Record<UpgradeId, number>>;
  /** Weights of the balanced score (financial, carbon, comfort); any positive numbers, normalized to sum to 1. */
  balancedWeights?: Partial<{ financial: number; carbon: number; comfort: number }>;
  /**
   * Optimize against the hotel under this what-if (savings, payback and ranking are all relative to it). With a plain profile the
   * context is built for you; with a prepared context (`prepareScenarioContext`) it is only recorded in the result.
   */
  scenario?: Scenario;
}

/** The key numbers of every package that was considered, for tables and charts. */
export interface Candidate {
  id: string;
  upgradeIds: UpgradeId[];
  cost: number; // mid
  costHigh: number;
  annualSavings: number; // mid
  paybackYears: number | null;
  netBenefit: number;
  roi: number | null;
  carbonAvoidedKg: number;
  comfortScore: number;
  /** 0 to 1, from the weighted blend of financial return, carbon and comfort. */
  balancedScore: number;
}

export interface RankedPackage {
  role: PackageRole;
  roleLabel: string;
  evaluation: PackageEvaluation;
  /** One rule-based line explaining why this package won its role. */
  reason: string;
  /** True when the high-end cost estimate would exceed the budget. */
  budgetRisk: boolean;
  /** Set when the role's best package was already taken by another role and the runner-up is shown. */
  note?: string;
  balancedScore: number;
}

export interface PortfolioResult {
  /** The what-if the packages were measured against; null for the plain baseline. */
  scenario: Scenario | null;
  budget: number;
  objective: Objective;
  baselineAnnualCost: number;
  /** All subsets of the eligible upgrades, including the empty set. */
  combinationsTested: number;
  /** Valid, non-empty combinations within the budget and comfort limit. */
  feasibleCount: number;
  rejected: { overBudget: number; comfort: number; belowSavingsThreshold: number; invalid: number };
  minComfortScore: number;
  minSavingsShare: number;
  /** At least three distinct packages when enough exist: maximum savings, fastest payback, balanced. */
  packages: RankedPackage[];
  /** The winner for the objective (may repeat one of the packages above). */
  objectiveWinner: RankedPackage | null;
  candidates: Candidate[];
  emptyReason: string | null;
  cheapestUseful: { id: UpgradeId; label: string; cost: number } | null;
}

/** The hotel's modeled site energy intensity against published peers (comparison only; see `benchmarkComparison`). */
export interface BenchmarkComparison {
  siteEuiKBtuPerSqft: number;
  peers: { id: string; label: string; siteEuiKBtuPerSqft: number; source: string; /** (hotel - peer) / peer; positive = uses more. */ difference: number }[];
  note: string;
}
