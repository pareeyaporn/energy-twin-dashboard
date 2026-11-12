import { DAYS_IN_MONTH, DAYS_IN_YEAR } from './constants';
import { hotelData } from './data';
import type { ComfortFlag, Conditions, HotelData, HotelProfile, Scenario, Setpoints } from './types';

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/** Day-weighted mean of 12 monthly factors. */
function weightedMean(f: number[]): number {
  return f.reduce((s, x, i) => s + x * (DAYS_IN_MONTH[i] ?? 30), 0) / DAYS_IN_YEAR;
}

/**
 * Monthly occupancy: the annual average shaped by the seasonal curve (normalized so its day-weighted mean is 1),
 * capped at 100%. Capping can pull the realized annual mean slightly below the input at very high occupancy.
 */
export function monthlyOccupancy(annual: number, seasonal: number[], deltaPts?: number[]): number[] {
  const mean = weightedMean(seasonal) || 1;
  return seasonal.map((s, i) => clamp((annual * s) / mean + (deltaPts?.[i] ?? 0), 0, 1));
}

/** Vacant setpoints: explicit values win; with smart controls they are set back from occupied; otherwise a fallback. */
function vacantSetpoints(
  occHeat: number,
  occCool: number,
  controls: boolean,
  explicit: { heat?: number; cool?: number },
  fallback: { heat: number; cool: number },
  data: HotelData,
): { heat: number; cool: number } {
  const { smartControlSetbackF: setback, vacantLimits } = data.defaults;
  return {
    heat: explicit.heat ?? (controls ? Math.max(vacantLimits.minHeatF, occHeat - setback) : fallback.heat),
    cool: explicit.cool ?? (controls ? Math.min(vacantLimits.maxCoolF, occCool + setback) : fallback.cool),
  };
}

export function baselineConditions(p: HotelProfile, data: HotelData = hotelData): Conditions {
  const s = p.setpoints;
  const vac = vacantSetpoints(
    s.occupiedHeatF,
    s.occupiedCoolF,
    p.smartRoomControls,
    p.smartRoomControls ? {} : { heat: s.vacantHeatF, cool: s.vacantCoolF },
    { heat: s.vacantHeatF, cool: s.vacantCoolF },
    data,
  );
  return {
    occupancyByMonth: monthlyOccupancy(p.occupancy, p.seasonalOccupancy),
    occupiedHoursPerRoom: p.occupiedHoursPerRoom,
    setpoints: {
      occupiedHeatF: s.occupiedHeatF,
      occupiedCoolF: s.occupiedCoolF,
      vacantHeatF: vac.heat,
      vacantCoolF: vac.cool,
    },
    smartRoomControls: p.smartRoomControls,
    commonAreaHvacHours: p.commonAreaHvacHours,
    lightingHoursPerDay: p.lightingHoursPerDay,
    hotWaterGalPerOccupiedRoomDay: p.hotWaterGalPerOccupiedRoomDay,
    weatherOffsetF: new Array<number>(12).fill(0),
    elecRateMult: 1,
    gasRateMult: 1,
  };
}

/** The conditions after a what-if. The base is not modified. */
export function applyScenario(
  p: HotelProfile,
  base: Conditions,
  s: Scenario,
  data: HotelData = hotelData,
): Conditions {
  const controls = s.smartRoomControls ?? base.smartRoomControls;
  const occHeat = s.setpoints?.occupiedHeatF ?? base.setpoints.occupiedHeatF;
  const occCool = s.setpoints?.occupiedCoolF ?? base.setpoints.occupiedCoolF;

  // With controls off, vacant rooms follow the occupied setpoint unless the base had its own vacant setpoint.
  const baseVacantFollows =
    base.setpoints.vacantHeatF === base.setpoints.occupiedHeatF && base.setpoints.vacantCoolF === base.setpoints.occupiedCoolF;
  const fallback =
    base.smartRoomControls || baseVacantFollows
      ? { heat: occHeat, cool: occCool }
      : { heat: base.setpoints.vacantHeatF, cool: base.setpoints.vacantCoolF };
  const explicit: { heat?: number; cool?: number } = {};
  if (s.setpoints?.vacantHeatF !== undefined) explicit.heat = s.setpoints.vacantHeatF;
  if (s.setpoints?.vacantCoolF !== undefined) explicit.cool = s.setpoints.vacantCoolF;
  const vac = vacantSetpoints(occHeat, occCool, controls, explicit, fallback, data);
  const setpoints: Setpoints = {
    occupiedHeatF: occHeat,
    occupiedCoolF: occCool,
    vacantHeatF: vac.heat,
    vacantCoolF: vac.cool,
  };

  const annual = s.occupancy !== undefined ? clamp(s.occupancy, 0, 1) : p.occupancy;
  const shapeChanged = s.occupancy !== undefined || s.occupancyDeltaPts !== undefined;
  const occupancyByMonth = shapeChanged ? monthlyOccupancy(annual, p.seasonalOccupancy, s.occupancyDeltaPts) : [...base.occupancyByMonth];

  let weatherOffsetF = [...base.weatherOffsetF];
  if (typeof s.weatherOffsetF === 'number') weatherOffsetF = new Array<number>(12).fill(s.weatherOffsetF);
  else if (Array.isArray(s.weatherOffsetF) && s.weatherOffsetF.length === 12) weatherOffsetF = [...s.weatherOffsetF];

  return {
    occupancyByMonth,
    occupiedHoursPerRoom: clamp(s.occupiedHoursPerRoom ?? base.occupiedHoursPerRoom, 0, 24),
    setpoints,
    smartRoomControls: controls,
    commonAreaHvacHours: clamp(s.commonAreaHvacHours ?? base.commonAreaHvacHours, 0, 24),
    lightingHoursPerDay: clamp(s.lightingHoursPerDay ?? base.lightingHoursPerDay, 0, 24),
    hotWaterGalPerOccupiedRoomDay: clamp(s.hotWaterGalPerOccupiedRoomDay ?? base.hotWaterGalPerOccupiedRoomDay, 1, 200),
    weatherOffsetF,
    elecRateMult: base.elecRateMult * (1 + (s.electricityRateChangePct ?? 0) / 100),
    gasRateMult: base.gasRateMult * (1 + (s.gasRateChangePct ?? 0) / 100),
  };
}

/** Comfort and safety notes for a set of conditions. Thresholds come from the data file (placeholders). */
export function comfortFlags(c: Conditions, data: HotelData = hotelData): ComfortFlag[] {
  const k = data.defaults.comfort;
  const out: ComfortFlag[] = [];
  if (c.setpoints.occupiedHeatF < k.occupiedHeatMinF) {
    out.push({
      id: 'occupied-heat-low',
      severity: 'warn',
      message: `Occupied rooms are heated to only ${c.setpoints.occupiedHeatF} F, below the usual comfort range (about ${k.occupiedHeatMinF} F or more).`,
    });
  }
  if (c.setpoints.occupiedCoolF > k.occupiedCoolMaxF) {
    out.push({
      id: 'occupied-cool-high',
      severity: 'warn',
      message: `Occupied rooms are cooled only to ${c.setpoints.occupiedCoolF} F, above the usual comfort range (about ${k.occupiedCoolMaxF} F or less).`,
    });
  }
  if (c.commonAreaHvacHours < k.commonHvacMinHours) {
    out.push({
      id: 'common-hvac-hours',
      severity: 'warn',
      message: `Common-area HVAC runs only ${c.commonAreaHvacHours} hours a day; the lobby and hallways may be uncomfortable when guests are present.`,
    });
  }
  if (c.lightingHoursPerDay < 20) {
    out.push({
      id: 'lighting-hours',
      severity: 'warn',
      message: `Common-area lighting runs only ${c.lightingHoursPerDay} hours a day; check safety and code requirements for corridors and entrances.`,
    });
  }
  if (c.smartRoomControls) {
    const heatSetback = c.setpoints.occupiedHeatF - c.setpoints.vacantHeatF;
    const coolSetback = c.setpoints.vacantCoolF - c.setpoints.occupiedCoolF;
    out.push({
      id: 'smart-controls',
      severity: 'info',
      message: `Vacant and away rooms are set back (heating ${heatSetback} F lower, cooling ${coolSetback} F higher); rooms need recovery time when a guest returns.`,
    });
  }
  if (c.setpoints.vacantHeatF < k.vacantHeatWarnF || c.setpoints.vacantCoolF > k.vacantCoolWarnF) {
    out.push({
      id: 'deep-setback',
      severity: 'warn',
      message: 'The vacant-room setback is deep; check moisture and freeze protection and the time guests wait for comfort.',
    });
  }
  return out;
}
