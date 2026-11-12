// Shared engine types. See docs/02_ENGINE_SPEC.md section 1.

export type HeatingFuel = 'gas' | 'electric' | 'oil' | 'propane';
export type HeatingSystem = 'furnace' | 'boiler' | 'heat_pump' | 'baseboard';
export type CoolingSystem = 'central_ac' | 'heat_pump' | 'none';
export type ClimateZone = '2B' | '4A' | '5A' | '6A' | string; // demo uses 2B (Phoenix), 5A (Chicago, Boston)
export type Goal = 'max_savings' | 'fastest_payback' | 'best_value';
export type UpgradeId = 'attic_insulation' | 'air_sealing' | 'windows' | 'heat_pump' | 'smart_thermostat';
export type PartId = 'attic' | 'walls' | 'windows' | 'air_leaks' | 'foundation';
export type Scenario = 'low' | 'mid' | 'high'; // low = pessimistic savings, high = optimistic

export interface Home {
  id?: string;
  label?: string;
  zip: string;
  state: string; // 2-letter, used for rates
  climateZone: ClimateZone;
  sqft: number;
  stories: 1 | 2 | 3;
  yearBuilt: number;
  heatingFuel: HeatingFuel;
  heatingSystem: HeatingSystem;
  coolingSystem: CoolingSystem;
  monthlyElectricBill?: number; // $ average
  monthlyFuelBill?: number; // $ average (gas / oil / propane)
  inspectionNotes?: string;
}

export interface Assumptions {
  priceGrowth: number; // e.g. 0.02 per year
  discountRate: number; // e.g. 0.03
  horizonYears: number; // 15
}

export interface Sourced<T> {
  value: T;
  source: string;
  estimated?: boolean;
}

export interface PartLoss {
  part: PartId;
  share: number; // share of heating+cooling load through this part (0–1)
  annualCost: number; // $ / yr lost through this part
  intensity: number; // 0–1, normalized for 3D color (1 = worst part)
}

export interface Costs {
  heating: number;
  cooling: number;
  waterHeating: number;
  other: number;
  total: number;
}

export interface Baseline {
  elecKWh: number;
  fuelKWh: number; // fuel energy input converted to kWh (0 if all-electric)
  elecRate: number; // $/kWh
  fuelRatePerKWh: number; // $/kWh of fuel energy
  heatingLoadKWh: number; // delivered heat (kWh thermal)
  coolingLoadKWh: number; // delivered cooling (kWh thermal)
  heatingEfficiency: number; // AFUE or COP
  coolingCOP: number;
  costs: Costs;
  parts: PartLoss[];
  hvacEfficiencyScore: number; // 0–1 for 3D (1 = excellent)
  sources: string[];
  estimated: boolean; // true if bills were missing and averages were used
}

export interface UpgradeOutcome {
  upgradeIds: UpgradeId[];
  costs: Costs;
  parts: PartLoss[];
  heatPumpTons?: number;
}

export interface Package {
  id: string; // e.g. "attic_insulation+air_sealing+heat_pump"
  upgradeIds: UpgradeId[];
  name: string; // human readable
  cost: { low: number; mid: number; high: number };
  annualSavings: { low: number; mid: number; high: number };
  newAnnualCost: number; // mid
  paybackYears: number | null; // null if savings <= 0
  value15: number; // net present value over horizon (mid)
  reason: string; // one line, rule-based
  outcome: UpgradeOutcome; // mid scenario, for the 3D
  lineItems: {
    id: UpgradeId;
    label: string;
    cost: number;
    savings: number;
    lifetimeYears: number;
    source: string;
  }[];
}

export interface OptimizerResult {
  combinationsTested: number; // 32 for the demo (shown in the UI counter)
  feasibleCount: number;
  top: Package[]; // top 3, ranked by goal
  baseline: Baseline;
  goal: Goal;
  budget: number;
}

// ---- Shapes of the JSON files in src/data (see docs/03_DATA_SPEC.md) ----

export interface RateEntry {
  elecRate: number;
  elecFixedMonthly: number;
  gasPerTherm?: number;
  gasFixedMonthly?: number;
  oilPerGallon?: number;
  oilFixedMonthly?: number;
  propanePerGallon?: number;
  propaneFixedMonthly?: number;
  source: string;
  verified: boolean;
}

export interface ElecSplit {
  heating: number;
  cooling: number;
  waterHeating: number;
  other: number;
}
export interface FuelSplit {
  heating: number;
  waterHeating: number;
  other: number;
}
export interface EndUseSplit {
  elec: ElecSplit;
  fuel: FuelSplit | null;
}

export type Era = 'pre1980' | '1980_1999' | '2000plus';

export interface EngineData {
  rates: Record<string, RateEntry>;
  endUseSplits: {
    source: string;
    verified: boolean;
    zones: Record<string, Partial<Record<HeatingFuel, EndUseSplit>>>;
  };
  componentLossShares: {
    source: string;
    verified: boolean;
    eras: Record<Era, Record<PartId, number>>;
  };
  defaults: {
    efficiency: {
      furnace: { pre2005: number; '2005plus': number };
      boiler: { pre2005: number; '2005plus': number };
      baseboard: { any: number };
      heat_pump: { pre2010: number; '2010plus': number };
      central_ac_cop: { pre2010: number; '2010plus': number };
    };
    avgElecKWhPer1800sqft: Record<string, number>;
    kWhPerUnit: { therm: number; oil_gallon: number; propane_gallon: number };
    baseTonsPer1000sqft: Record<string, number>;
    source: string;
    verified: boolean;
  };
}
