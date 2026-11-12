import { CATEGORIES, CATEGORY_OF, DAYS_IN_MONTH, END_USES, ZONE_IDS, ZONE_LABELS } from './constants';
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

export interface EquipmentItem {
  id: string;
  zone: ZoneId;
  label: string;
  count: number;
  ratedKW?: number;
  ratedKBtuH?: number;
  ratedTons?: number;
  fuel: 'electric' | 'gas';
  schedule: string;
  efficiency: string;
  source: string;
  estimated: true;
}

/** Major equipment per zone with rule-of-thumb sizing from the profile. Every item is an estimate. */
export function equipmentInventory(p: HotelProfile, data: HotelData = hotelData): EquipmentItem[] {
  const e = data.equipment;
  const src = e.source;
  const publicSqft = p.floorAreaSqft * e.publicAreaShareOfFloorArea;
  const corridorSqft = p.floorAreaSqft * e.corridorShareOfFloorArea;
  const unit = e.inRoomUnit[p.hvacType];
  const items: EquipmentItem[] = [
    { id: 'room-hvac', zone: 'guest_rooms', label: unit.label, count: p.rooms, ratedKW: unit.ratedKW, fuel: 'electric', schedule: 'On demand; follows room occupancy and setpoints', efficiency: unit.efficiency, source: src, estimated: true },
    { id: 'room-lighting', zone: 'guest_rooms', label: 'Guest-room lighting', count: p.rooms, ratedKW: e.guestRoomLightingKW, fuel: 'electric', schedule: 'Follows guest presence', efficiency: 'Lamp type unknown (assumed)', source: src, estimated: true },
    { id: 'room-plug', zone: 'guest_rooms', label: 'TVs and minibars', count: p.rooms, ratedKW: e.guestRoomPlugKW, fuel: 'electric', schedule: 'Minibar 24/7; TV follows presence', efficiency: 'Not specified', source: src, estimated: true },
    { id: 'lobby-lighting', zone: 'lobby_common', label: 'Lobby and public-area lighting', count: 1, ratedKW: (publicSqft * e.lightingWPerSqft) / 1000, fuel: 'electric', schedule: `${p.lightingHoursPerDay} h per day`, efficiency: 'Lamp type unknown (assumed)', source: src, estimated: true },
    { id: 'lobby-hvac', zone: 'lobby_common', label: 'Public-area air handling', count: 1, ratedKW: publicSqft * 0.0015, fuel: 'electric', schedule: `${p.commonAreaHvacHours} h per day`, efficiency: 'Constant-volume fans (assumed)', source: src, estimated: true },
    { id: 'kitchen-range', zone: 'kitchen_restaurant', label: 'Gas ranges and fryers', count: 1, ratedKBtuH: p.rooms * e.kitchen.rangeKBtuHPerRoom, fuel: 'gas', schedule: 'Breakfast, lunch and dinner service', efficiency: 'Standard commercial (assumed)', source: src, estimated: true },
    { id: 'kitchen-hoods', zone: 'kitchen_restaurant', label: 'Exhaust hoods', count: e.kitchen.hoods, ratedKW: e.kitchen.hoodKW, fuel: 'electric', schedule: 'During cooking hours', efficiency: 'Constant speed (assumed)', source: src, estimated: true },
    { id: 'kitchen-cold', zone: 'kitchen_restaurant', label: 'Walk-in refrigeration', count: e.kitchen.refrigeration, ratedKW: e.kitchen.refrigerationKW, fuel: 'electric', schedule: '24/7', efficiency: 'Not specified', source: src, estimated: true },
    { id: 'corridor-lighting', zone: 'hallways_shared', label: 'Corridor lighting', count: 1, ratedKW: (corridorSqft * e.lightingWPerSqft) / 1000, fuel: 'electric', schedule: `${p.lightingHoursPerDay} h per day`, efficiency: 'Lamp type unknown (assumed)', source: src, estimated: true },
    { id: 'elevators', zone: 'hallways_shared', label: 'Elevators', count: Math.max(1, Math.ceil(p.floors / e.elevators.perFloors)), ratedKW: e.elevators.ratedKW, fuel: 'electric', schedule: 'On demand', efficiency: 'Not specified', source: src, estimated: true },
    { id: 'laundry', zone: 'hallways_shared', label: 'Laundry dryers', count: 1, ratedKBtuH: e.laundry.dryerKBtuH, fuel: 'gas', schedule: 'Daytime', efficiency: 'Not specified', source: src, estimated: true },
    { id: 'dhw-heater', zone: 'hot_water', label: 'Water heaters', count: 1, ratedKBtuH: p.rooms * e.hotWater.heaterKBtuHPerRoom, fuel: 'gas', schedule: '24/7, peaks morning and evening', efficiency: 'Thermal efficiency about 0.80 (assumed)', source: src, estimated: true },
    { id: 'dhw-storage', zone: 'hot_water', label: 'Storage tanks (gallons)', count: Math.round(p.rooms * e.hotWater.storageGalPerRoom), fuel: 'gas', schedule: '24/7', efficiency: 'Standby losses assumed', source: src, estimated: true },
    { id: 'dhw-recirc', zone: 'hot_water', label: 'Recirculation pumps', count: e.hotWater.recircPumps, ratedKW: e.hotWater.recircPumpKW, fuel: 'electric', schedule: '24/7', efficiency: 'Constant speed (assumed)', source: src, estimated: true },
  ];

  const central = e.central;
  switch (p.hvacType) {
    case 'ptac':
      items.push({ id: 'central-plant', zone: 'central_hvac', label: central.ptac.label, count: 1, ratedTons: publicSqft * central.ptac.tonsPerPublicSqft * 1000, fuel: 'electric', schedule: `${p.commonAreaHvacHours} h per day`, efficiency: central.ptac.efficiency, source: src, estimated: true });
      break;
    case 'vrf':
      items.push({ id: 'central-plant', zone: 'central_hvac', label: central.vrf.label, count: 1, ratedTons: p.rooms * central.vrf.tonsPerRoom, fuel: 'electric', schedule: 'On demand', efficiency: central.vrf.efficiency, source: src, estimated: true });
      break;
    case 'central_plant':
      items.push(
        { id: 'boilers', zone: 'central_hvac', label: 'Gas boilers', count: 2, ratedKBtuH: p.floorAreaSqft * central.central_plant.boilerKBtuHPerSqft, fuel: 'gas', schedule: 'Heating season', efficiency: central.central_plant.efficiency, source: src, estimated: true },
        { id: 'chiller', zone: 'central_hvac', label: 'Chiller', count: 1, ratedTons: p.floorAreaSqft * central.central_plant.tonsPerSqft, fuel: 'electric', schedule: 'Cooling season', efficiency: central.central_plant.efficiency, source: src, estimated: true },
      );
      break;
    case 'rtu':
      items.push({ id: 'central-plant', zone: 'central_hvac', label: central.rtu.label, count: 1, ratedTons: p.floorAreaSqft * central.rtu.tonsPerSqft, fuel: 'electric', schedule: 'On demand', efficiency: central.rtu.efficiency, source: src, estimated: true });
      break;
  }
  return items;
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
}
export interface FlowGraph {
  nodes: FlowNode[];
  links: FlowLink[];
}

const CATEGORY_LABELS: Record<Category, string> = {
  hvac: 'HVAC',
  lighting: 'Lighting',
  hotWater: 'Hot water',
  kitchen: 'Kitchen',
  equipment: 'Equipment',
  other: 'Other',
};

/** Grid and gas → zones → categories, with cost and site energy on every link. Flows are conserved. */
export function energyFlows(result: EnergyResult): FlowGraph {
  const nodes: FlowNode[] = [
    { id: 'grid', label: 'Grid electricity', kind: 'source' },
    { id: 'gas', label: 'Natural gas', kind: 'source' },
    ...ZONE_IDS.map((z) => ({ id: `zone:${z}`, label: ZONE_LABELS[z], kind: 'zone' as const })),
    ...CATEGORIES.map((c) => ({ id: `category:${c}`, label: CATEGORY_LABELS[c], kind: 'category' as const })),
  ];
  const links: FlowLink[] = [];
  for (const z of ZONE_IDS) {
    const cells = result.cells.filter((c) => c.zone === z);
    const elecCost = cells.reduce((s, c) => s + c.elecCost, 0);
    const gasCost = cells.reduce((s, c) => s + c.gasCost, 0);
    const elecKBtu = cells.reduce((s, c) => s + c.elecKWh * 3.412, 0);
    const gasKBtu = cells.reduce((s, c) => s + c.gasTherms * 100, 0);
    if (elecCost > 0) links.push({ source: 'grid', target: `zone:${z}`, costUsd: elecCost, siteKBtu: elecKBtu });
    if (gasCost > 0) links.push({ source: 'gas', target: `zone:${z}`, costUsd: gasCost, siteKBtu: gasKBtu });
    for (const cat of CATEGORIES) {
      const cc = cells.filter((c) => CATEGORY_OF[c.endUse] === cat);
      const cost = cc.reduce((s, c) => s + c.cost, 0);
      if (cost > 0) links.push({ source: `zone:${z}`, target: `category:${cat}`, costUsd: cost, siteKBtu: cc.reduce((s, c) => s + c.siteKBtu, 0) });
    }
  }
  return { nodes, links };
}
