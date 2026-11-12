import {
  AFUE_SCORE_ANCHORS,
  BASE_SQFT_FOR_AVG_ELEC,
  COP_SCORE_ANCHORS,
  FALLBACK_CLIMATE_ZONE,
  FALLBACK_SPLIT_ZONE,
  FURNACE_BOILER_CUTOFF_YEAR,
  HEAT_PUMP_AC_CUTOFF_YEAR,
  MONTHS_PER_YEAR,
  PART_IDS,
  eraOf,
} from './constants';
import { defaultData } from './data';
import type {
  Baseline,
  Costs,
  ElecSplit,
  EndUseSplit,
  EngineData,
  FuelSplit,
  Home,
  PartLoss,
} from './types';

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

function interpolateScore(eff: number, [[x0, y0], [x1, y1]]: [[number, number], [number, number]]) {
  return clamp01(y0 + ((eff - x0) / (x1 - x0)) * (y1 - y0));
}

/** Fuel price per unit, fixed monthly charge and kWh per unit for a home's fuel. */
function fuelPricing(home: Home, data: EngineData) {
  const rates = data.rates[home.state];
  if (!rates) throw new Error(`No rates for state "${home.state}" in rates.json`);
  const { kWhPerUnit } = data.defaults;
  switch (home.heatingFuel) {
    case 'gas':
      if (rates.gasPerTherm == null) throw new Error(`No gas rate for ${home.state}`);
      return { price: rates.gasPerTherm, fixed: rates.gasFixedMonthly ?? 0, kWhPerUnit: kWhPerUnit.therm };
    case 'oil':
      if (rates.oilPerGallon == null) throw new Error(`No oil rate for ${home.state}`);
      return { price: rates.oilPerGallon, fixed: rates.oilFixedMonthly ?? 0, kWhPerUnit: kWhPerUnit.oil_gallon };
    case 'propane':
      if (rates.propanePerGallon == null) throw new Error(`No propane rate for ${home.state}`);
      return {
        price: rates.propanePerGallon,
        fixed: rates.propaneFixedMonthly ?? 0,
        kWhPerUnit: kWhPerUnit.propane_gallon,
      };
    case 'electric':
      return null;
  }
}

/** End-use split for a zone and fuel, falling back to the 5A zone when the data has no entry. */
function endUseSplit(home: Home, data: EngineData): EndUseSplit {
  const zones = data.endUseSplits.zones;
  const split = zones[home.climateZone]?.[home.heatingFuel] ?? zones[FALLBACK_SPLIT_ZONE]?.[home.heatingFuel];
  if (!split) throw new Error(`No end-use split for ${home.heatingFuel} heating in zone ${home.climateZone}`);
  return split;
}

function heatingEfficiency(home: Home, data: EngineData): number {
  const eff = data.defaults.efficiency;
  switch (home.heatingSystem) {
    case 'furnace':
    case 'boiler': {
      const table = eff[home.heatingSystem];
      return home.yearBuilt < FURNACE_BOILER_CUTOFF_YEAR ? table.pre2005 : table['2005plus'];
    }
    case 'baseboard':
      return eff.baseboard.any;
    case 'heat_pump':
      return home.yearBuilt < HEAT_PUMP_AC_CUTOFF_YEAR ? eff.heat_pump.pre2010 : eff.heat_pump['2010plus'];
  }
}

function coolingCOP(home: Home, data: EngineData): number {
  if (home.coolingSystem === 'none') return 0;
  const cop = data.defaults.efficiency.central_ac_cop;
  return home.yearBuilt < HEAT_PUMP_AC_CUTOFF_YEAR ? cop.pre2010 : cop['2010plus'];
}

export function estimateBaseline(home: Home, data: EngineData = defaultData): Baseline {
  const rates = data.rates[home.state];
  if (!rates) throw new Error(`No rates for state "${home.state}" in rates.json`);
  const pricing = fuelPricing(home, data);
  const split = endUseSplit(home, data);
  let estimated = false;

  // 2. Electricity kWh
  const elecRate = rates.elecRate;
  let elecKWh: number;
  if (home.monthlyElectricBill == null) {
    const zone = data.defaults.avgElecKWhPer1800sqft[home.climateZone] != null ? home.climateZone : FALLBACK_CLIMATE_ZONE;
    elecKWh = (data.defaults.avgElecKWhPer1800sqft[zone] ?? 0) * (home.sqft / BASE_SQFT_FOR_AVG_ELEC);
    estimated = true;
  } else {
    elecKWh = (Math.max(0, home.monthlyElectricBill - rates.elecFixedMonthly) * MONTHS_PER_YEAR) / elecRate;
  }

  // 3. Fuel energy (kWh)
  let fuelKWh = 0;
  let fuelRatePerKWh = 0;
  if (pricing) {
    if (home.monthlyFuelBill == null) {
      throw new Error(`monthlyFuelBill is required for ${home.heatingFuel}-heated homes`);
    }
    fuelRatePerKWh = pricing.price / pricing.kWhPerUnit;
    fuelKWh = (Math.max(0, home.monthlyFuelBill - pricing.fixed) * MONTHS_PER_YEAR) / pricing.price * pricing.kWhPerUnit;
  }

  // 4–5. End-use split. Without cooling equipment, the cooling share is plain "other" use.
  const e: ElecSplit = { ...split.elec };
  if (home.coolingSystem === 'none') {
    e.other += e.cooling;
    e.cooling = 0;
  }
  const f: FuelSplit | null = pricing ? split.fuel : null;
  const heatingInputKWh = f ? f.heating * fuelKWh : e.heating * elecKWh;

  // 6–7. Efficiency and delivered loads
  const heatingEff = heatingEfficiency(home, data);
  const coolCOP = coolingCOP(home, data);
  const heatingLoadKWh = heatingInputKWh * heatingEff;
  const coolingLoadKWh = e.cooling * elecKWh * coolCOP;

  // 8. Costs
  const elecCost = (share: number) => share * elecKWh * elecRate;
  const fuelCost = (share: number) => (f ? share * fuelKWh * fuelRatePerKWh : 0);
  const costs: Costs = {
    heating: elecCost(e.heating) + fuelCost(f?.heating ?? 0),
    cooling: elecCost(e.cooling),
    waterHeating: elecCost(e.waterHeating) + fuelCost(f?.waterHeating ?? 0),
    other: elecCost(e.other) + fuelCost(f?.other ?? 0),
    total: 0,
  };
  costs.total = costs.heating + costs.cooling + costs.waterHeating + costs.other;

  // 9. Parts
  const shares = data.componentLossShares.eras[eraOf(home.yearBuilt)];
  const envelopeCost = costs.heating + costs.cooling;
  const raw = PART_IDS.map((part) => ({ part, share: shares[part], annualCost: envelopeCost * shares[part] }));
  const maxCost = Math.max(...raw.map((p) => p.annualCost));
  const parts: PartLoss[] = raw.map((p) => ({ ...p, intensity: maxCost > 0 ? p.annualCost / maxCost : 0 }));

  // 10. HVAC score
  const hvacEfficiencyScore =
    home.heatingSystem === 'furnace' || home.heatingSystem === 'boiler'
      ? interpolateScore(heatingEff, AFUE_SCORE_ANCHORS)
      : interpolateScore(heatingEff, COP_SCORE_ANCHORS);

  const sources = [
    rates.source,
    data.endUseSplits.source,
    data.componentLossShares.source,
    data.defaults.source,
  ];

  return {
    elecKWh,
    fuelKWh,
    elecRate,
    fuelRatePerKWh,
    heatingLoadKWh,
    coolingLoadKWh,
    heatingEfficiency: heatingEff,
    coolingCOP: coolCOP,
    costs,
    parts,
    hvacEfficiencyScore,
    sources,
    estimated,
  };
}
