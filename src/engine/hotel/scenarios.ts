import { calculateBaselineEnergy, simulate, subTotals, addTotals, emptyTotals } from './baseline';
import { applyScenario, comfortFlags } from './conditions';
import { CATEGORIES, END_USE_LABELS, END_USES, ZONE_IDS, ZONE_LABELS } from './constants';
import { hotelData } from './data';
import { isResolved, resolveProfile } from './profile';
import type {
  Category,
  Conditions,
  Driver,
  EnergyResult,
  HotelData,
  HotelInput,
  ResolvedProfile,
  Scenario,
  ScenarioResult,
  Setpoints,
  Totals,
  ZoneId,
} from './types';

const usd = (n: number) => `${n < 0 ? '-' : '+'}$${Math.round(Math.abs(n)).toLocaleString('en-US')}`;
const kwh = (n: number) => `${n < 0 ? '-' : '+'}${Math.round(Math.abs(n)).toLocaleString('en-US')} kWh`;

/** Monthly-resolution events for the twin's stress-test buttons (a heat wave is modeled as a hotter month). */
export interface StressTest {
  id: 'heat_wave' | 'cold_snap' | 'conference_surge' | 'price_up_20';
  label: string;
  description: string;
  scenario: Scenario;
}

const monthDelta = (idx: number, value: number): number[] => Array.from({ length: 12 }, (_, i) => (i === idx ? value : 0));

export const STRESS_TESTS: StressTest[] = [
  { id: 'heat_wave', label: 'Heat wave', description: 'July runs 10 F hotter than normal (monthly resolution).', scenario: { weatherOffsetF: monthDelta(6, 10) } },
  { id: 'cold_snap', label: 'Cold snap', description: 'January runs 12 F colder than normal (monthly resolution).', scenario: { weatherOffsetF: monthDelta(0, -12) } },
  { id: 'conference_surge', label: 'Conference surge', description: 'Occupancy rises 25 points in September (monthly resolution).', scenario: { occupancyDeltaPts: monthDelta(8, 0.25) } },
  { id: 'price_up_20', label: 'Electricity +20%', description: 'The electricity price rises 20% all year.', scenario: { electricityRateChangePct: 20 } },
];

function toResolved(input: HotelInput | ResolvedProfile, data: HotelData): ResolvedProfile {
  return isResolved(input) ? input : resolveProfile(input, data);
}

function deltaMaps(before: EnergyResult, after: EnergyResult) {
  const deltaByZone = {} as Record<ZoneId, Totals>;
  for (const z of ZONE_IDS) deltaByZone[z] = subTotals(after.byZone[z], before.byZone[z]);
  const deltaByCategory = {} as Record<Category, Totals>;
  for (const c of CATEGORIES) deltaByCategory[c] = subTotals(after.byCategory[c], before.byCategory[c]);
  return { deltaByZone, deltaByCategory };
}

type Group = Driver['id'];
const GROUP_LABEL: Record<Group, string> = {
  occupancy: 'Occupancy and guest activity',
  setpoints: 'Setpoints and room controls',
  schedules: 'Common-area schedules',
  weather: 'Weather',
  rates: 'Energy prices',
};

function groupFields(g: Group, c: Conditions): unknown {
  switch (g) {
    case 'occupancy':
      return [c.occupancyByMonth, c.occupiedHoursPerRoom, c.hotWaterGalPerOccupiedRoomDay];
    case 'setpoints':
      return [c.setpoints, c.smartRoomControls];
    case 'schedules':
      return [c.commonAreaHvacHours, c.lightingHoursPerDay];
    case 'weather':
      return c.weatherOffsetF;
    case 'rates':
      return [c.elecRateMult, c.gasRateMult];
  }
}

function applyGroup(g: Group, from: Conditions, to: Conditions): Conditions {
  switch (g) {
    case 'occupancy':
      return { ...from, occupancyByMonth: [...to.occupancyByMonth], occupiedHoursPerRoom: to.occupiedHoursPerRoom, hotWaterGalPerOccupiedRoomDay: to.hotWaterGalPerOccupiedRoomDay };
    case 'setpoints':
      return { ...from, setpoints: { ...to.setpoints }, smartRoomControls: to.smartRoomControls };
    case 'schedules':
      return { ...from, commonAreaHvacHours: to.commonAreaHvacHours, lightingHoursPerDay: to.lightingHoursPerDay };
    case 'weather':
      return { ...from, weatherOffsetF: [...to.weatherOffsetF] };
    case 'rates':
      return { ...from, elecRateMult: to.elecRateMult, gasRateMult: to.gasRateMult };
  }
}

/** The biggest (zone, end use) cost changes between two results, as plain text built from the numbers. */
function detailFor(before: EnergyResult, after: EnergyResult): string {
  const rows: { label: string; dCost: number; dKWh: number }[] = [];
  for (const z of ZONE_IDS) {
    for (const u of END_USES) {
      let dCost = 0;
      let dKWh = 0;
      for (let i = 0; i < after.cells.length; i++) {
        const a = after.cells[i];
        const b = before.cells[i];
        if (!a || !b || a.zone !== z || a.endUse !== u) continue;
        dCost += a.cost - b.cost;
        dKWh += a.elecKWh - b.elecKWh;
      }
      if (Math.abs(dCost) > 0.5) {
        const zl = ZONE_LABELS[z];
        const ul = END_USE_LABELS[u];
        rows.push({ label: zl.toLowerCase() === ul.toLowerCase() ? zl : `${zl}: ${ul.toLowerCase()}`, dCost, dKWh });
      }
    }
  }
  rows.sort((x, y) => Math.abs(y.dCost) - Math.abs(x.dCost));
  if (rows.length === 0) return 'No change.';
  return 'Largest changes: ' + rows.slice(0, 3).map((r) => `${r.label} ${usd(r.dCost)} per year${Math.abs(r.dKWh) >= 1 ? ` (${kwh(r.dKWh)})` : ''}`).join('; ') + '.';
}

/** Explain a change by applying the scenario's parts one at a time, in a fixed order. The split depends on that order. */
function explain(p: ResolvedProfile['profile'], from: Conditions, to: Conditions, data: HotelData, start: EnergyResult): Driver[] {
  const order: Group[] = ['occupancy', 'setpoints', 'schedules', 'weather', 'rates'];
  const drivers: Driver[] = [];
  let cond = from;
  let current = start;
  for (const g of order) {
    if (JSON.stringify(groupFields(g, cond)) === JSON.stringify(groupFields(g, to))) continue;
    const next = applyGroup(g, cond, to);
    const result = simulate(p, next, data, start.calibration);
    const d = subTotals(result.annual, current.annual);
    drivers.push({
      id: g,
      label: GROUP_LABEL[g],
      deltaElecKWh: d.elecKWh,
      deltaGasTherms: d.gasTherms,
      deltaCost: d.cost,
      deltaCarbonKg: d.carbonKg,
      detail: detailFor(current, result),
    });
    cond = next;
    current = result;
  }
  return drivers;
}

/** Before, after, delta, the reasons it changed, and comfort flags for a what-if. */
export function simulateEnergyScenario(
  input: HotelInput | ResolvedProfile,
  scenario: Scenario,
  data: HotelData = hotelData,
): ScenarioResult {
  const resolved = toResolved(input, data);
  const p = resolved.profile;
  const before = calculateBaselineEnergy(resolved, data);
  const cond = applyScenario(p, before.conditions, scenario, data);
  const after = simulate(p, cond, data, before.calibration);
  return {
    before,
    after,
    delta: subTotals(after.annual, before.annual),
    ...deltaMaps(before, after),
    drivers: explain(p, before.conditions, cond, data, before),
    flags: comfortFlags(cond, data),
  };
}

/** Occupancy from one level to another (for example 60% to 85%). `fromOccupancy` defaults to the profile's own. */
export function simulateOccupancyChange(
  input: HotelInput | ResolvedProfile,
  toOccupancy: number,
  fromOccupancy?: number,
  data: HotelData = hotelData,
): ScenarioResult {
  const resolved = toResolved(input, data);
  const base =
    fromOccupancy === undefined ? resolved : { ...resolved, profile: { ...resolved.profile, occupancy: Math.min(1, Math.max(0, fromOccupancy)) } };
  return simulateEnergyScenario(base, { occupancy: toOccupancy }, data);
}

export interface HvacSettings {
  setpoints?: Partial<Setpoints>;
  smartRoomControls?: boolean;
  commonAreaHvacHours?: number;
}

/** Guest-room setpoints, vacant-room setback (smart controls) and common-area HVAC hours. */
export function simulateHVACSettings(
  input: HotelInput | ResolvedProfile,
  settings: HvacSettings,
  data: HotelData = hotelData,
): ScenarioResult {
  const scenario: Scenario = {};
  if (settings.setpoints) scenario.setpoints = settings.setpoints;
  if (settings.smartRoomControls !== undefined) scenario.smartRoomControls = settings.smartRoomControls;
  if (settings.commonAreaHvacHours !== undefined) scenario.commonAreaHvacHours = settings.commonAreaHvacHours;
  return simulateEnergyScenario(input, scenario, data);
}

export { addTotals, emptyTotals };
