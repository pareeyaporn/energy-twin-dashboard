import { CATEGORIES, CATEGORY_OF, DAYS_IN_MONTH, END_USES, ZONE_IDS, ZONE_LABELS } from './constants';
import { currentEquipment } from './equipment';
import type { EquipmentItem } from './equipment';
import { hotelData } from './data';
import type { Category, Conditions, EndUse, EnergyResult, HotelData, HotelProfile, ZoneId } from './types';

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/** An hourly shape normalized to sum to 1 (so a day's energy spreads over 24 hours exactly). */
function normalizedShape(u: EndUse, data: HotelData): number[] {
  const raw = data.shapes.hourly[u];
  const sum = raw.reduce((s, x) => s + x, 0);
  return raw.map((x) => (sum > 0 ? x / sum : 1 / 24));
}

export interface HourPoint {
  hour: number;
  elecKW: number;
  gasThermsPerHour: number;
  costPerHour: number;
  byZone: Record<ZoneId, { elecKW: number; gasThermsPerHour: number }>;
  /** The same hour by end use (heating, cooling, lighting, ...). */
  byEndUse: Record<EndUse, { elecKW: number; gasThermsPerHour: number }>;
}

/**
 * Hourly energy for a typical day of a month, by zone. Each cell's monthly energy is divided by the days in the
 * month and spread by the end use's hourly shape, so the 24 hours times the days reconcile to the monthly total.
 */
export function typicalDayProfile(result: EnergyResult, month: number, data: HotelData = hotelData): HourPoint[] {
  const days = DAYS_IN_MONTH[month] ?? 30;
  const shapes = {} as Record<EndUse, number[]>;
  for (const u of END_USES) shapes[u] = normalizedShape(u, data);
  const points: HourPoint[] = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    elecKW: 0,
    gasThermsPerHour: 0,
    costPerHour: 0,
    byZone: Object.fromEntries(ZONE_IDS.map((z) => [z, { elecKW: 0, gasThermsPerHour: 0 }])) as HourPoint['byZone'],
    byEndUse: Object.fromEntries(END_USES.map((u) => [u, { elecKW: 0, gasThermsPerHour: 0 }])) as HourPoint['byEndUse'],
  }));
  for (const c of result.cells) {
    if (c.month !== month) continue;
    const shape = shapes[c.endUse];
    for (let h = 0; h < 24; h++) {
      const s = shape[h] ?? 0;
      const kW = (c.elecKWh / days) * s;
      const th = (c.gasTherms / days) * s;
      const pt = points[h];
      if (!pt) continue;
      pt.elecKW += kW;
      pt.gasThermsPerHour += th;
      pt.costPerHour += kW * result.rates.elecPerKWh + th * result.rates.gasPerTherm;
      const zp = pt.byZone[c.zone];
      zp.elecKW += kW;
      zp.gasThermsPerHour += th;
      const up = pt.byEndUse[c.endUse];
      up.elecKW += kW;
      up.gasThermsPerHour += th;
    }
  }
  return points;
}

export interface MeterReading {
  kW: number;
  thermsPerHour: number;
  usdPerHour: number;
  /** Always true: these are modeled values, never measurements. */
  simulated: true;
}

/** A modeled "live" reading for a month and hour, from the typical-day profile. */
export function simulatedMeter(result: EnergyResult, month: number, hour: number, data: HotelData = hotelData): MeterReading {
  const pt = typicalDayProfile(result, month, data)[clamp(Math.round(hour), 0, 23)];
  return { kW: pt?.elecKW ?? 0, thermsPerHour: pt?.gasThermsPerHour ?? 0, usdPerHour: pt?.costPerHour ?? 0, simulated: true };
}

export type RoomState = 'occupied' | 'away' | 'vacant';

export interface RoomPoint {
  index: number;
  floor: number;
  number: number;
  /** occupied = booked with a guest present; away = booked, guest out; vacant = not booked. */
  state: RoomState;
  /** True when smart controls have this room set back (away or vacant). */
  setback: boolean;
}

const frac = (x: number) => x - Math.floor(x);
const GOLDEN = 0.6180339887498949;
const PLASTIC = 0.7548776662466927;

/**
 * Room-by-room state for an hour of a month. No randomness: booked rooms are the N rooms with the smallest
 * low-discrepancy key (so they spread over the floors), and present guests are the P booked rooms with the smallest
 * second key. N = round(occupancy × rooms); P follows the guest-presence curve scaled to the occupied hours per room.
 */
export function roomOccupancyPattern(
  p: HotelProfile,
  c: Conditions,
  month: number,
  hour: number,
  data: HotelData = hotelData,
): RoomPoint[] {
  const rooms = p.rooms;
  const perFloor = Math.ceil(rooms / p.floors);
  const occ = c.occupancyByMonth[month] ?? 0;
  const booked = Math.round(occ * rooms);

  const curve = data.shapes.guestPresence;
  const mean = curve.reduce((s, x) => s + x, 0) / curve.length || 1;
  const presence = clamp(((curve[clamp(Math.round(hour), 0, 23)] ?? 0) / mean) * (c.occupiedHoursPerRoom / 24), 0, 1);
  const present = Math.min(booked, Math.round(booked * presence));

  const idx = Array.from({ length: rooms }, (_, i) => i);
  const bookedSet = new Set([...idx].sort((a, b) => frac((a + 1) * GOLDEN) - frac((b + 1) * GOLDEN)).slice(0, booked));
  const presentSet = new Set(
    [...bookedSet].sort((a, b) => frac((a + 1) * PLASTIC) - frac((b + 1) * PLASTIC)).slice(0, present),
  );

  return idx.map((i) => {
    const state: RoomState = presentSet.has(i) ? 'occupied' : bookedSet.has(i) ? 'away' : 'vacant';
    const floor = Math.floor(i / perFloor) + 1;
    return { index: i, floor, number: floor * 100 + (i % perFloor) + 1, state, setback: c.smartRoomControls && state !== 'occupied' };
  });
}

export type { EquipmentItem } from './equipment';

/**
 * The hotel's current equipment: the estimated inventory from rules of thumb with the operator's corrections applied (docs/20).
 * Every estimated item is labeled so; entered fields are listed in `userEntered`.
 */
export function equipmentInventory(p: HotelProfile, data: HotelData = hotelData): EquipmentItem[] {
  return currentEquipment(p, data);
}

export interface FlowNode {
  id: string;
  label: string;
  kind: 'source' | 'zone' | 'category';
}
export interface FlowLink {
  source: string;
  target: string;
  costUsd: number;
  siteKBtu: number;
  /** The electricity and gas parts of the link (they sum to `costUsd` and `siteKBtu`). */
  elecCostUsd: number;
  gasCostUsd: number;
  elecKBtu: number;
  gasKBtu: number;
  elecKWh: number;
  gasTherms: number;
  /** Carbon of the link's electricity and gas (kg CO₂e, the result's emission factors); they sum to `carbonKg`. */
  elecCarbonKg: number;
  gasCarbonKg: number;
  carbonKg: number;
}
export interface FlowGraph {
  nodes: FlowNode[];
  links: FlowLink[];
  /** "year": annual totals ($ and kBtu per year). "hour": one hour of a typical day ($ and kBtu in that hour). */
  period?: 'year' | 'hour';
}

const CATEGORY_LABELS: Record<Category, string> = {
  hvac: 'HVAC',
  lighting: 'Lighting',
  hotWater: 'Hot water',
  kitchen: 'Kitchen',
  equipment: 'Equipment',
  other: 'Other',
};

interface FlowPart {
  zone: ZoneId;
  endUse: EndUse;
  elecKWh: number;
  gasTherms: number;
  elecCost: number;
  gasCost: number;
}

const KBTU_PER_KWH = 3.412;
const KBTU_PER_THERM = 100;

function flowGraph(parts: FlowPart[], period: 'year' | 'hour', ef: EnergyResult['emissionFactors']): FlowGraph {
  const nodes: FlowNode[] = [
    { id: 'grid', label: 'Grid electricity', kind: 'source' },
    { id: 'gas', label: 'Natural gas', kind: 'source' },
    ...ZONE_IDS.map((z) => ({ id: `zone:${z}`, label: ZONE_LABELS[z], kind: 'zone' as const })),
    ...CATEGORIES.map((c) => ({ id: `category:${c}`, label: CATEGORY_LABELS[c], kind: 'category' as const })),
  ];
  const link = (source: string, target: string, ps: FlowPart[], fuel: 'both' | 'elec' | 'gas'): FlowLink => {
    const e = fuel !== 'gas';
    const g = fuel !== 'elec';
    const elecKWh = e ? ps.reduce((s, x) => s + x.elecKWh, 0) : 0;
    const gasTherms = g ? ps.reduce((s, x) => s + x.gasTherms, 0) : 0;
    const elecCostUsd = e ? ps.reduce((s, x) => s + x.elecCost, 0) : 0;
    const gasCostUsd = g ? ps.reduce((s, x) => s + x.gasCost, 0) : 0;
    const elecKBtu = elecKWh * KBTU_PER_KWH;
    const gasKBtu = gasTherms * KBTU_PER_THERM;
    const elecCarbonKg = elecKWh * ef.elecKgPerKWh;
    const gasCarbonKg = gasTherms * ef.gasKgPerTherm;
    return {
      source, target, costUsd: elecCostUsd + gasCostUsd, siteKBtu: elecKBtu + gasKBtu, elecCostUsd, gasCostUsd, elecKBtu, gasKBtu, elecKWh, gasTherms,
      elecCarbonKg, gasCarbonKg, carbonKg: elecCarbonKg + gasCarbonKg,
    };
  };
  const links: FlowLink[] = [];
  for (const z of ZONE_IDS) {
    const zp = parts.filter((x) => x.zone === z);
    const el = link('grid', `zone:${z}`, zp, 'elec');
    const gl = link('gas', `zone:${z}`, zp, 'gas');
    if (el.costUsd > 0) links.push(el);
    if (gl.costUsd > 0) links.push(gl);
    for (const cat of CATEGORIES) {
      const cl = link(`zone:${z}`, `category:${cat}`, zp.filter((x) => CATEGORY_OF[x.endUse] === cat), 'both');
      if (cl.costUsd > 0) links.push(cl);
    }
  }
  return { nodes, links, period };
}

/** Grid and gas → zones → categories, with cost, site energy and carbon (split by fuel) on every link, for the year. Flows are conserved. */
export function energyFlows(result: EnergyResult): FlowGraph {
  return flowGraph(
    result.cells.map((c) => ({ zone: c.zone, endUse: c.endUse, elecKWh: c.elecKWh, gasTherms: c.gasTherms, elecCost: c.elecCost, gasCost: c.gasCost })),
    'year',
    result.emissionFactors,
  );
}

/**
 * The same flows for one hour of a typical day of `month`, computed exactly like the meter (`typicalDayProfile`): each cell's monthly
 * energy divided by the days and spread by its end use's hourly shape, priced at the flat rates. So the hour's flows add up to the meter.
 */
export function energyFlowsAt(result: EnergyResult, month: number, hour: number, data: HotelData = hotelData): FlowGraph {
  const days = DAYS_IN_MONTH[month] ?? 30;
  const h = clamp(Math.round(hour), 0, 23);
  const parts: FlowPart[] = [];
  const shapes = new Map<EndUse, number[]>();
  for (const c of result.cells) {
    if (c.month !== month) continue;
    let shape = shapes.get(c.endUse);
    if (!shape) {
      shape = normalizedShape(c.endUse, data);
      shapes.set(c.endUse, shape);
    }
    const sh = shape[h] ?? 0;
    const kWh = (c.elecKWh / days) * sh;
    const th = (c.gasTherms / days) * sh;
    parts.push({ zone: c.zone, endUse: c.endUse, elecKWh: kWh, gasTherms: th, elecCost: kWh * result.rates.elecPerKWh, gasCost: th * result.rates.gasPerTherm });
  }
  return flowGraph(parts, 'hour', result.emissionFactors);
}

/** One zone and end use over a typical day: electricity (kW), gas (therms per hour) and cost per hour, 24 values each. */
export interface ZoneEndUseDay {
  elecKW: number[];
  gasThermsPerHour: number[];
  costPerHour: number[];
}

/**
 * A typical day of `month` for every zone and end use, computed exactly like the meter (`typicalDayProfile`), keyed `${zone}|${endUse}`.
 * Used to show which systems are running at an hour; the model has no per-appliance energy.
 */
export function typicalDayByZoneEndUse(result: EnergyResult, month: number, data: HotelData = hotelData): Record<string, ZoneEndUseDay> {
  const days = DAYS_IN_MONTH[month] ?? 30;
  const out: Record<string, ZoneEndUseDay> = {};
  for (const c of result.cells) {
    if (c.month !== month) continue;
    const key = `${c.zone}|${c.endUse}`;
    const d = (out[key] ??= { elecKW: Array(24).fill(0), gasThermsPerHour: Array(24).fill(0), costPerHour: Array(24).fill(0) });
    const shape = normalizedShape(c.endUse, data);
    for (let h = 0; h < 24; h++) {
      const s = shape[h] ?? 0;
      const kW = (c.elecKWh / days) * s;
      const th = (c.gasTherms / days) * s;
      d.elecKW[h] = (d.elecKW[h] ?? 0) + kW;
      d.gasThermsPerHour[h] = (d.gasThermsPerHour[h] ?? 0) + th;
      d.costPerHour[h] = (d.costPerHour[h] ?? 0) + kW * result.rates.elecPerKWh + th * result.rates.gasPerTherm;
    }
  }
  return out;
}
