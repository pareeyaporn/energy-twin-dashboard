import { hotelData } from './data';
import { billRates, normalizeBills } from './bills';
import type { HotelData, HotelInput, HotelProfile, ResolvedProfile } from './types';

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const isNum = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);

/**
 * Fill a hotel profile. Every missing input gets a documented default and is listed in `defaulted`
 * so the UI can show "default (estimate)". Out-of-range inputs are clamped and noted, never silently changed.
 */
export function resolveProfile(input: HotelInput = {}, data: HotelData = hotelData): ResolvedProfile {
  const d = data.defaults.profileDefaults;
  const defaulted: string[] = [];
  const notes: string[] = [];

  function num(field: string, value: number | undefined, dflt: number, lo: number, hi: number): number {
    if (!isNum(value)) {
      defaulted.push(field);
      return dflt;
    }
    const c = clamp(value, lo, hi);
    if (c !== value) notes.push(`${field} ${value} was outside ${lo}–${hi} and was set to ${c}.`);
    return c;
  }
  function str(field: string, value: string | undefined, dflt: string): string {
    if (typeof value !== 'string' || value.trim() === '') {
      defaulted.push(field);
      return dflt;
    }
    return value.trim();
  }

  const rooms = Math.round(num('rooms', input.rooms, d.rooms, 1, 5000));
  const floorAreaSqft = num('floorAreaSqft', input.floorAreaSqft, rooms * d.sqftPerRoom, 1000, 5_000_000);
  const floors = Math.round(
    num('floors', input.floors, clamp(Math.ceil(rooms / d.roomsPerFloorTarget), 1, 20), 1, 80),
  );
  const yearBuilt = Math.round(num('yearBuilt', input.yearBuilt, d.yearBuilt, 1800, 2100));
  const operatingHours = num('operatingHours', input.operatingHours, d.operatingHours, 1, 24);
  const hvacType = input.hvacType ?? (defaulted.push('hvacType'), d.hvacType);

  const city = str('city', input.city, d.city);
  const stateRaw = str('state', input.state, d.state).toUpperCase();
  const state = stateRaw.length === 2 ? stateRaw : d.state;
  if (state !== stateRaw) notes.push(`State "${stateRaw}" is not a 2-letter code; ${d.state} was used for rates.`);
  const country = str('country', input.country, d.country);

  const climateKey = `${city},${state}`.toLowerCase();
  let climateId = data.weather.cityToClimate[climateKey];
  if (!climateId) {
    climateId = data.weather.defaultClimate;
    defaulted.push('climate');
    notes.push(`No weather data for ${city}, ${state}; ${data.weather.climates[climateId]?.label ?? climateId} was used.`);
  }

  const em = data.emissions;
  let gridSubregion = typeof input.gridSubregion === 'string' ? input.gridSubregion.trim().toUpperCase() : '';
  if (gridSubregion && !em.subregions[gridSubregion]) {
    notes.push(`Grid subregion "${gridSubregion}" is not in the eGRID table; it was set from the location instead.`);
    gridSubregion = '';
  }
  if (!gridSubregion) {
    defaulted.push('gridSubregion');
    gridSubregion = em.cityToSubregion[climateKey] ?? em.stateDefaultSubregion[state] ?? 'US';
  }

  const rateEntry = data.rates[state] ?? data.rates['default'];
  // The hotel's own bills: their average rates stand in for the state averages only when asked (useBillRates) and no rate is entered.
  const utilityBills = normalizeBills(input.utilityBills);
  if (input.utilityBills?.length && utilityBills.length === 0) notes.push('The utility bills had no usable bill; the model was not calibrated.');
  const fromBills = billRates(utilityBills);
  const elecFromBills = fromBills.elecPerKWh !== null && fromBills.elecPerKWh >= 0.01 && fromBills.elecPerKWh <= 2 ? fromBills.elecPerKWh : null;
  const gasFromBills = fromBills.gasPerTherm !== null && fromBills.gasPerTherm >= 0.05 && fromBills.gasPerTherm <= 20 ? fromBills.gasPerTherm : null;
  let electricityRate: number;
  const useBillRates = input.useBillRates === true;
  if (useBillRates && input.electricityRate === undefined && elecFromBills !== null) {
    electricityRate = elecFromBills;
    notes.push(`Electricity rate from your bills: $${elecFromBills.toFixed(4)} per kWh.`);
  } else electricityRate = num('electricityRate', input.electricityRate, rateEntry?.commercialElecPerKWh ?? 0.14, 0.01, 2);
  let gasRate: number;
  if (useBillRates && input.gasRate === undefined && gasFromBills !== null) {
    gasRate = gasFromBills;
    notes.push(`Gas rate from your bills: $${gasFromBills.toFixed(3)} per therm.`);
  } else gasRate = num('gasRate', input.gasRate, rateEntry?.commercialGasPerTherm ?? 1, 0.05, 20);

  const occupancy = num('occupancy', input.occupancy, d.occupancy, 0, 1);
  let seasonalOccupancy = d.seasonalOccupancy;
  if (input.seasonalOccupancy && input.seasonalOccupancy.length === 12 && input.seasonalOccupancy.every((x) => isNum(x) && x >= 0)) {
    seasonalOccupancy = input.seasonalOccupancy;
  } else {
    defaulted.push('seasonalOccupancy');
    if (input.seasonalOccupancy) notes.push('seasonalOccupancy needs 12 non-negative numbers; the default curve was used.');
  }

  const occupiedHoursPerRoom = num('occupiedHoursPerRoom', input.occupiedHoursPerRoom, d.occupiedHoursPerRoom, 0, 24);
  const occupiedHeatF = num('setpoints.occupiedHeatF', input.setpoints?.occupiedHeatF, d.setpoints.occupiedHeatF, 50, 85);
  const occupiedCoolF = num('setpoints.occupiedCoolF', input.setpoints?.occupiedCoolF, d.setpoints.occupiedCoolF, 60, 90);
  const vacantHeatF = num('setpoints.vacantHeatF', input.setpoints?.vacantHeatF, occupiedHeatF, 45, 85);
  const vacantCoolF = num('setpoints.vacantCoolF', input.setpoints?.vacantCoolF, occupiedCoolF, 60, 95);

  const smartRoomControls = input.smartRoomControls ?? (defaulted.push('smartRoomControls'), d.smartRoomControls);
  const commonAreaHvacHours = num('commonAreaHvacHours', input.commonAreaHvacHours, operatingHours, 0, 24);
  const lightingHoursPerDay = num('lightingHoursPerDay', input.lightingHoursPerDay, d.lightingHoursPerDay, 0, 24);
  const hotWaterGalPerOccupiedRoomDay = num(
    'hotWaterGalPerOccupiedRoomDay',
    input.hotWaterGalPerOccupiedRoomDay,
    d.hotWaterGalPerOccupiedRoomDay,
    1,
    200,
  );

  let monthlyEnergyBill: number | null = null;
  if (isNum(input.monthlyEnergyBill) && input.monthlyEnergyBill > 0) monthlyEnergyBill = input.monthlyEnergyBill;
  else if (utilityBills.length === 0) defaulted.push('monthlyEnergyBill');

  const budget = num('budget', input.budget, d.budget, 0, 100_000_000);
  const horizonYears = Math.round(num('horizonYears', input.horizonYears, d.horizonYears, 1, 30));
  const objective = input.objective ?? (defaulted.push('objective'), d.objective);

  const profile: HotelProfile = {
    name: str('name', input.name, 'Your hotel'),
    city,
    state,
    country,
    climateId,
    gridSubregion,
    rooms,
    floorAreaSqft,
    floors,
    yearBuilt,
    operatingHours,
    hvacType,
    monthlyEnergyBill,
    utilityBills,
    useBillRates,
    electricityRate,
    gasRate,
    occupancy,
    seasonalOccupancy: [...seasonalOccupancy],
    occupiedHoursPerRoom,
    setpoints: { occupiedHeatF, occupiedCoolF, vacantHeatF, vacantCoolF },
    smartRoomControls,
    commonAreaHvacHours,
    lightingHoursPerDay,
    hotWaterGalPerOccupiedRoomDay,
    budget,
    horizonYears,
    objective,
  };
  // Optional solar assumptions: used only when the user sets them, within plausible bounds.
  if (input.solarCostPerW !== undefined) {
    if (Number.isFinite(input.solarCostPerW) && input.solarCostPerW >= 0.5 && input.solarCostPerW <= 10) profile.solarCostPerW = input.solarCostPerW;
    else notes.push('Solar price per W must be between $0.50 and $10; the size-based benchmark is used instead.');
  }
  if (input.solarExportCreditPerKWh !== undefined) {
    if (Number.isFinite(input.solarExportCreditPerKWh) && input.solarExportCreditPerKWh >= 0 && input.solarExportCreditPerKWh <= 0.5) profile.solarExportCreditPerKWh = input.solarExportCreditPerKWh;
    else notes.push('Solar export credit must be between $0 and $0.50 per kWh; the default is used instead.');
  }
  return { profile, defaulted, notes };
}

export function isResolved(x: HotelInput | ResolvedProfile): x is ResolvedProfile {
  return typeof x === 'object' && x !== null && 'profile' in x && 'defaulted' in x;
}

/** A synthetic preset, resolved. */
export function presetProfile(id: string, data: HotelData = hotelData): ResolvedProfile {
  const preset = data.presets.find((p) => p.id === id);
  if (!preset) throw new Error(`Unknown hotel preset "${id}"`);
  return resolveProfile(preset.input, data);
}
