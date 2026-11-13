// The hotel's current equipment (Phase 14G, docs/20): the estimated inventory, the operator's corrections, validation, and the few
// simulation levers the inventory can defensibly drive. Pure functions; no React. Corrections change the baseline (what the hotel is),
// never the savings (what an investment would do).
import { ZONE_IDS } from './constants';
import { hotelData } from './data';
import type {
  EfficiencyKind,
  EquipmentCategory,
  EquipmentFuel,
  EquipmentLever,
  EquipmentLevers,
  EquipmentOverride,
  EquipmentTemplate,
  HotelData,
  HotelProfile,
  HvacType,
  RefrigerantRecord,
  ZoneId,
} from './types';

/** A modeled efficiency on an item: which lever it feeds, how it is expressed, and its value (estimated or entered). */
export interface LeverValue {
  lever: EquipmentLever;
  kind: EfficiencyKind | 'kw';
  value: number;
  /** The estimate's value, for comparison and reset. */
  estimate: number;
  label: string;
}

/** The service an item provides that the hotel cannot be left without (removal is blocked for the last one). */
export type EquipmentRole = 'heating' | 'cooling' | 'hotWater';

export interface EquipmentItem {
  id: string;
  zone: ZoneId;
  label: string;
  category: EquipmentCategory;
  /** Template of added equipment. */
  template?: string;
  /** Number of units. */
  count: number;
  /** Capacity per unit and its unit (kW, kBtu/h, tons, gal, kW DC). */
  capacity?: { value: number; unit: string };
  /** Kept for older readers: per-unit rating in the matching unit. */
  ratedKW?: number;
  ratedKBtuH?: number;
  ratedTons?: number;
  fuel: EquipmentFuel;
  schedule: string;
  /** Plain-language efficiency (estimated, or the entered value). */
  efficiency: string;
  /** Efficiencies the simulation uses (empty: the item is informational). */
  levers: LeverValue[];
  roles: EquipmentRole[];
  ageYears?: number;
  notes?: string;
  /** Why an entry does or does not change the model. */
  modelNote: string;
  source: string;
  /** True when nothing on the item was entered by the operator. */
  estimated: boolean;
  /** Fields the operator entered. */
  userEntered: string[];
  added: boolean;
  /** Entered refrigerant top-ups (cooling and refrigeration equipment). */
  refrigerant?: RefrigerantRecord;
}

const REFRIGERANT_TEMPLATES = new Set(['chiller', 'rooftop_unit', 'walk_in_refrigeration']);
/** Equipment that holds refrigerant: anything that cools, the kitchen's cold storage, and added chillers, rooftop units and walk-ins. */
export function holdsRefrigerant(i: Pick<EquipmentItem, 'id' | 'template' | 'roles'>): boolean {
  return i.roles.includes('cooling') || i.id === 'kitchen-cold' || (i.template !== undefined && REFRIGERANT_TEMPLATES.has(i.template));
}

const KIND_LABEL: Record<EfficiencyKind | 'kw', string> = {
  thermal: 'thermal efficiency',
  heatPumpCop: 'heating COP',
  chillerCop: 'cooling COP',
  dxCop: 'cooling COP',
  ledShare: 'share of fixtures that are LED',
  kw: 'kW DC',
};

const LEVER_ROLE: Partial<Record<EquipmentLever, EquipmentRole>> = { heatingEfficiency: 'heating', coolingCop: 'cooling', waterHeaterEfficiency: 'hotWater' };

const pct = (x: number) => `${Math.round(x * 100)}%`;
export function formatEfficiency(kind: EfficiencyKind | 'kw', v: number): string {
  if (kind === 'thermal') return `thermal efficiency ${v.toFixed(2)}`;
  if (kind === 'ledShare') return `${pct(v)} LED`;
  if (kind === 'kw') return `${v} kW DC`;
  return `COP ${v.toFixed(2)}`;
}

function lever(lever: EquipmentLever, kind: EfficiencyKind | 'kw', value: number): LeverValue {
  return { lever, kind, value, estimate: value, label: KIND_LABEL[kind] };
}

/** The reference (estimated) values each lever is measured against for this hotel. */
export function leverReference(p: Pick<HotelProfile, 'hvacType'>, data: HotelData = hotelData) {
  const L = data.equipment.levers;
  return {
    heatingEfficiency: data.defaults.heatingSystems[p.hvacType].efficiency,
    coolingCop: L?.coolingCopReference[p.hvacType] ?? 3,
    waterHeaterEfficiency: L?.waterHeaterReferenceEfficiency ?? 0.8,
  };
}

/** The estimated inventory from rules of thumb (docs/20 lists the corrections made in the November 2026 audit). */
export function estimatedInventory(p: HotelProfile, data: HotelData = hotelData): EquipmentItem[] {
  const e = data.equipment;
  const src = e.source;
  const ref = leverReference(p, data);
  const publicSqft = p.floorAreaSqft * e.publicAreaShareOfFloorArea;
  const corridorSqft = p.floorAreaSqft * e.corridorShareOfFloorArea;
  const unit = e.inRoomUnit[p.hvacType];
  const base = (x: Omit<EquipmentItem, 'source' | 'estimated' | 'userEntered' | 'added' | 'levers' | 'roles' | 'modelNote'> & Partial<Pick<EquipmentItem, 'levers' | 'roles' | 'modelNote'>>): EquipmentItem => ({
    levers: [],
    roles: [],
    modelNote: '',
    ...x,
    source: src,
    estimated: true,
    userEntered: [],
    added: false,
  });
  const kw = (v: number) => ({ capacity: { value: v, unit: 'kW' }, ratedKW: v });
  const kbtu = (v: number) => ({ capacity: { value: v, unit: 'kBtu/h' }, ratedKBtuH: v });
  const tons = (v: number) => ({ capacity: { value: v, unit: 'tons' }, ratedTons: v });

  // Guest-room units: which efficiencies they carry depends on the system (docs/20 table).
  const roomLevers: LeverValue[] =
    p.hvacType === 'ptac'
      ? [lever('coolingCop', 'dxCop', ref.coolingCop)]
      : p.hvacType === 'pthp'
        ? [lever('heatingEfficiency', 'heatPumpCop', ref.heatingEfficiency), lever('coolingCop', 'dxCop', ref.coolingCop)]
        : [];
  const roomRoles: EquipmentRole[] = p.hvacType === 'ptac' || p.hvacType === 'pthp' ? ['heating', 'cooling'] : [];

  const heaterTotal = p.rooms * e.hotWater.heaterKBtuHPerRoom;
  const heaterUnit = e.hotWater.heaterUnitKBtuH ?? heaterTotal;
  const heaters = Math.max(1, Math.ceil(heaterTotal / heaterUnit - 1e-9));
  const lightingLever = (z: ZoneId): LeverValue[] => [{ ...lever('ledShare', 'ledShare', 0), label: `share of ${z === 'guest_rooms' ? 'guest-room' : 'these'} fixtures that are LED` }];

  const items: EquipmentItem[] = [
    base({
      id: 'room-hvac', zone: 'guest_rooms', label: unit.label, category: 'hvac', count: p.rooms, ...kw(unit.ratedKW), fuel: 'electric',
      schedule: 'On demand; follows room occupancy and setpoints', efficiency: unit.efficiency, levers: roomLevers, roles: roomRoles,
      modelNote: roomLevers.length ? 'Its efficiency sets the hotel’s heating or cooling efficiency.' : 'Fan nameplate is informational; guest-room HVAC follows the modeled zone loads.',
    }),
    base({
      id: 'room-lighting', zone: 'guest_rooms', label: 'Guest-room lighting', category: 'lighting', count: p.rooms, ...kw(e.guestRoomLightingKW), fuel: 'electric',
      schedule: 'Follows guest presence', efficiency: 'LED share unknown (the model assumes the benchmark mix)', levers: lightingLever('guest_rooms'),
      modelNote: 'The LED share lowers this zone’s lighting energy and what an LED retrofit can still save.',
    }),
    base({ id: 'room-plug', zone: 'guest_rooms', label: 'TVs and minibars', category: 'other', count: p.rooms, ...kw(e.guestRoomPlugKW), fuel: 'electric', schedule: 'Minibar 24/7; TV follows presence', efficiency: 'Not specified', modelNote: 'Informational.' }),
    base({
      id: 'lobby-lighting', zone: 'lobby_common', label: 'Lobby and public-area lighting', category: 'lighting', count: 1, ...kw((publicSqft * e.lightingWPerSqft) / 1000), fuel: 'electric',
      schedule: `${p.lightingHoursPerDay} h per day`, efficiency: 'LED share unknown (the model assumes the benchmark mix)', levers: lightingLever('lobby_common'),
      modelNote: 'The LED share lowers this zone’s lighting energy; the schedule is the hotel’s lighting hours.',
    }),
    base({
      id: 'lobby-hvac', zone: 'lobby_common', label: 'Public-area air handling', category: 'hvac', count: 1, ...kw(publicSqft * (e.publicAirHandlingKWPerSqft ?? 0.0015)), fuel: 'electric',
      schedule: `${p.commonAreaHvacHours} h per day`, efficiency: 'Constant-volume fans (assumed)',
      modelNote: 'Fan power is an assumption (1.5 W per ft² of public area) and informational; the schedule is the hotel’s common-area HVAC hours.',
    }),
    base({ id: 'kitchen-range', zone: 'kitchen_restaurant', label: 'Gas ranges and fryers', category: 'kitchen', count: 1, ...kbtu(p.rooms * e.kitchen.rangeKBtuHPerRoom), fuel: 'gas', schedule: 'Breakfast, lunch and dinner service', efficiency: 'Standard commercial (assumed)', modelNote: 'Informational.' }),
    base({ id: 'kitchen-hoods', zone: 'kitchen_restaurant', label: 'Exhaust hoods', category: 'hvac', count: e.kitchen.hoods, ...kw(e.kitchen.hoodKW), fuel: 'electric', schedule: 'During cooking hours', efficiency: 'Constant speed (assumed)', modelNote: 'Informational.' }),
    base({ id: 'kitchen-cold', zone: 'kitchen_restaurant', label: 'Walk-in refrigeration', category: 'kitchen', count: e.kitchen.refrigeration, ...kw(e.kitchen.refrigerationKW), fuel: 'electric', schedule: '24/7', efficiency: 'Not specified', modelNote: 'Informational.' }),
    base({
      id: 'corridor-lighting', zone: 'hallways_shared', label: 'Corridor lighting', category: 'lighting', count: 1, ...kw((corridorSqft * e.lightingWPerSqft) / 1000), fuel: 'electric',
      schedule: `${p.lightingHoursPerDay} h per day`, efficiency: 'LED share unknown (the model assumes the benchmark mix)', levers: lightingLever('hallways_shared'),
      modelNote: 'The LED share lowers this zone’s lighting energy; the schedule is the hotel’s lighting hours.',
    }),
    base({ id: 'elevators', zone: 'hallways_shared', label: 'Elevators', category: 'other', count: Math.max(1, Math.ceil(p.floors / e.elevators.perFloors)), ...kw(e.elevators.ratedKW), fuel: 'electric', schedule: 'On demand', efficiency: 'Not specified', modelNote: 'Informational.' }),
    base({ id: 'laundry', zone: 'hallways_shared', label: 'Laundry dryers', category: 'laundry', count: 1, ...kbtu(e.laundry.dryerKBtuH), fuel: 'gas', schedule: 'Daytime', efficiency: 'Not specified', modelNote: 'Informational.' }),
    base({
      id: 'dhw-heater', zone: 'hot_water', label: 'Water heaters', category: 'water', count: heaters, ...kbtu(heaterTotal / heaters), fuel: 'gas',
      schedule: '24/7, peaks morning and evening', efficiency: `Thermal efficiency about ${ref.waterHeaterEfficiency.toFixed(2)} (assumed)`,
      levers: [lever('waterHeaterEfficiency', 'thermal', ref.waterHeaterEfficiency)], roles: ['hotWater'],
      modelNote: 'Its efficiency sets the gas used for hot water.',
    }),
    base({
      id: 'dhw-storage', zone: 'hot_water', label: 'Hot-water storage', category: 'water', count: 1, capacity: { value: Math.round(p.rooms * e.hotWater.storageGalPerRoom), unit: 'gal' }, fuel: 'gas',
      schedule: '24/7', efficiency: 'Standby losses included in the hot-water estimate', modelNote: 'Informational (capacity in gallons; standby losses are part of the hot-water system).',
    }),
    base({ id: 'dhw-recirc', zone: 'hot_water', label: 'Recirculation pumps', category: 'water', count: e.hotWater.recircPumps, ...kw(e.hotWater.recircPumpKW), fuel: 'electric', schedule: '24/7', efficiency: 'Constant speed (assumed)', modelNote: 'Informational.' }),
  ];

  const c = e.central;
  switch (p.hvacType) {
    case 'ptac':
    case 'pthp':
      items.push(base({ id: 'central-plant', zone: 'central_hvac', label: c[p.hvacType].label, category: 'hvac', count: 1, ...tons(publicSqft * c[p.hvacType].tonsPerPublicSqft), fuel: 'electric', schedule: `${p.commonAreaHvacHours} h per day`, efficiency: c[p.hvacType].efficiency, modelNote: 'Informational; the guest-room units carry the hotel’s efficiency.' }));
      break;
    case 'vrf':
      items.push(base({
        id: 'central-plant', zone: 'central_hvac', label: c.vrf.label, category: 'hvac', count: 1, ...tons(p.rooms * c.vrf.tonsPerRoom), fuel: 'electric', schedule: 'On demand', efficiency: c.vrf.efficiency,
        levers: [lever('heatingEfficiency', 'heatPumpCop', ref.heatingEfficiency), lever('coolingCop', 'dxCop', ref.coolingCop)], roles: ['heating', 'cooling'],
        modelNote: 'Its heating and cooling COP set the hotel’s HVAC efficiency.',
      }));
      break;
    case 'central_plant':
      items.push(
        base({
          id: 'boilers', zone: 'central_hvac', label: 'Gas boilers', category: 'hvac', count: 2, ...kbtu((p.floorAreaSqft * c.central_plant.boilerKBtuHPerSqft) / 2), fuel: 'gas', schedule: 'Heating season',
          efficiency: c.central_plant.boilerEfficiency ?? 'Thermal efficiency about 0.80 (assumed)', levers: [lever('heatingEfficiency', 'thermal', ref.heatingEfficiency)], roles: ['heating'],
          modelNote: 'Their efficiency sets the gas used for heating; capacity sets the replacement cost.',
        }),
        base({
          id: 'chiller', zone: 'central_hvac', label: 'Chiller', category: 'hvac', count: 1, ...tons(p.floorAreaSqft * c.central_plant.tonsPerSqft), fuel: 'electric', schedule: 'Cooling season',
          efficiency: c.central_plant.chillerEfficiency ?? 'COP about 4.5 (assumed)', levers: [lever('coolingCop', 'chillerCop', ref.coolingCop)], roles: ['cooling'],
          modelNote: 'Its COP sets the electricity used for cooling; capacity sets the replacement cost.',
        }),
      );
      break;
    case 'rtu':
      items.push(base({
        id: 'central-plant', zone: 'central_hvac', label: c.rtu.label, category: 'hvac', count: 1, ...tons(p.floorAreaSqft * c.rtu.tonsPerSqft), fuel: 'gas', schedule: 'On demand', efficiency: c.rtu.efficiency,
        levers: [lever('heatingEfficiency', 'thermal', ref.heatingEfficiency), lever('coolingCop', 'dxCop', ref.coolingCop)], roles: ['heating', 'cooling'],
        modelNote: 'Their gas heat efficiency and cooling COP set the hotel’s HVAC efficiency.',
      }));
      break;
  }
  return items;
}

export function equipmentTemplates(data: HotelData = hotelData): EquipmentTemplate[] {
  return data.equipment.templates ?? [];
}

const boundsOf = (kind: EfficiencyKind | 'kw' | 'quantity' | 'capacity' | 'ageYears', data: HotelData): [number, number] => {
  const b = data.equipment.levers?.bounds;
  if (kind === 'kw') return [0, 1_000_000];
  return (b?.[kind as keyof NonNullable<typeof b>] as [number, number] | undefined) ?? [0, 1_000_000];
};

function fromTemplate(t: EquipmentTemplate, o: EquipmentOverride, data: HotelData): EquipmentItem {
  const levers: LeverValue[] = [];
  if (t.lever === 'existingSolarKw') levers.push({ lever: 'existingSolarKw', kind: 'kw', value: 0, estimate: 0, label: 'kW DC' });
  else if (t.lever && t.efficiencyKind) levers.push(lever(t.lever, t.efficiencyKind, t.defaultEfficiency ?? 0));
  const role = t.lever ? LEVER_ROLE[t.lever] : t.id === 'heat_pump_water_heater' ? 'hotWater' : undefined;
  const cap = t.defaultCapacity;
  return {
    id: o.id,
    template: t.id,
    zone: t.zone,
    label: t.label,
    category: t.category,
    count: 1,
    ...(cap !== undefined ? { capacity: { value: cap, unit: t.capacityUnit } } : { capacity: { value: 0, unit: t.capacityUnit } }),
    fuel: t.fuel,
    schedule: t.defaultSchedule ?? '',
    efficiency: t.efficiencyKind && t.defaultEfficiency !== undefined ? formatEfficiency(t.efficiencyKind, t.defaultEfficiency) : 'Not specified',
    levers,
    roles: role ? [role] : [],
    modelNote: t.note ?? (t.lever ? 'Feeds the simulation through its efficiency.' : 'Informational: adding it does not change modeled consumption.'),
    source: data.equipment.templatesSource ?? 'Template placeholder.',
    estimated: false,
    userEntered: ['added'],
    added: true,
  };
}

/** Apply one override to an item: entered fields replace estimates and are flagged as user-entered. */
function applyOverride(item: EquipmentItem, o: EquipmentOverride, data: HotelData): EquipmentItem {
  const x: EquipmentItem = { ...item, levers: item.levers.map((l) => ({ ...l })), userEntered: [...item.userEntered] };
  const mark = (f: string) => {
    if (!x.userEntered.includes(f)) x.userEntered.push(f);
  };
  if (o.label !== undefined) (x.label = o.label), mark('label');
  if (o.quantity !== undefined) (x.count = o.quantity), mark('quantity');
  if (o.capacity !== undefined && x.capacity) {
    x.capacity = { ...x.capacity, value: o.capacity };
    if (x.ratedKW !== undefined) x.ratedKW = o.capacity;
    if (x.ratedKBtuH !== undefined) x.ratedKBtuH = o.capacity;
    if (x.ratedTons !== undefined) x.ratedTons = o.capacity;
    mark('capacity');
  }
  if (o.zone !== undefined && x.added) (x.zone = o.zone), mark('zone');
  if (o.schedule !== undefined) (x.schedule = o.schedule), mark('schedule');
  if (o.ageYears !== undefined) (x.ageYears = o.ageYears), mark('ageYears');
  if (o.notes !== undefined) (x.notes = o.notes), mark('notes');
  if (o.refrigerant !== undefined) (x.refrigerant = { ...o.refrigerant }), mark('refrigerant');
  if (o.efficiency !== undefined) {
    // The first lever takes the generic efficiency; a solar item's "efficiency" is not used (its size is the capacity).
    const l = x.levers.find((v) => v.lever !== 'existingSolarKw');
    if (l) {
      l.value = o.efficiency;
      x.efficiency = formatEfficiency(l.kind, o.efficiency);
    } else x.efficiency = String(o.efficiency);
    mark('efficiency');
  }
  if (o.levers) {
    for (const [k, v] of Object.entries(o.levers)) {
      const l = x.levers.find((y) => y.lever === k);
      if (l && typeof v === 'number') {
        l.value = v;
        mark(`levers.${k}`);
      }
    }
    x.efficiency = x.levers.filter((l) => l.lever !== 'existingSolarKw').map((l) => formatEfficiency(l.kind, l.value)).join(', ') || x.efficiency;
  }
  const solar = x.levers.find((l) => l.lever === 'existingSolarKw');
  if (solar) solar.value = x.count * (x.capacity?.value ?? 0);
  x.estimated = x.userEntered.length === 0;
  return x;
}

export interface EquipmentProblem {
  id: string;
  field?: string;
  message: string;
  /** Errors stop a change in the editor; when stored data is invalid the field is dropped instead. */
  severity: 'error' | 'warning';
}

const inRange = (v: unknown, [lo, hi]: [number, number]) => typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi;
const txt = (v: unknown, max: number) => typeof v === 'string' && v.trim().length > 0 && v.length <= max;

/**
 * Check a list of overrides against the hotel: unknown items or templates, numbers outside their bounds (by efficiency kind), a
 * removal that would leave the hotel without heating, cooling or hot water, and solar larger than the usable roof. Returns the
 * valid overrides (invalid fields dropped) and every problem found.
 */
export function validateEquipment(
  raw: readonly EquipmentOverride[] | undefined,
  p: HotelProfile,
  data: HotelData = hotelData,
): { overrides: EquipmentOverride[]; problems: EquipmentProblem[] } {
  const problems: EquipmentProblem[] = [];
  if (!Array.isArray(raw) || raw.length === 0) return { overrides: [], problems };
  const estimated = estimatedInventory(p, data);
  const templates = equipmentTemplates(data);
  const byId = new Map<string, EquipmentOverride>();
  for (const o of raw) if (o && typeof o.id === 'string' && o.id) byId.set(o.id, o);
  const out: EquipmentOverride[] = [];
  for (const o of byId.values()) {
    const est = estimated.find((i) => i.id === o.id);
    const tpl = o.template ? templates.find((t) => t.id === o.template) : undefined;
    if (!est && !tpl) {
      problems.push({ id: o.id, message: `Unknown equipment "${o.id}"${o.template ? ` (template ${o.template})` : ''}; ignored.`, severity: 'error' });
      continue;
    }
    const item = est ?? fromTemplate(tpl!, o, data);
    const clean: EquipmentOverride = { id: o.id, ...(tpl ? { template: tpl.id } : {}) };
    if (o.removed === true) clean.removed = true;
    const bad = (field: string, message: string) => problems.push({ id: o.id, field, message, severity: 'error' });
    if (o.label !== undefined) (txt(o.label, 80) ? (clean.label = o.label.trim()) : bad('label', 'A name needs 1 to 80 characters.'));
    if (o.quantity !== undefined) {
      const [lo, hi] = boundsOf('quantity', data);
      if (inRange(o.quantity, [tpl ? 1 : lo, hi]) && Number.isInteger(o.quantity)) clean.quantity = o.quantity;
      else bad('quantity', `Quantity must be a whole number from ${tpl ? 1 : lo} to ${hi.toLocaleString('en-US')}.`);
    }
    if (o.capacity !== undefined) {
      const [, hi] = boundsOf('capacity', data);
      if (item.capacity && inRange(o.capacity, [Number.MIN_VALUE, hi])) clean.capacity = o.capacity;
      else bad('capacity', item.capacity ? `Capacity must be above 0 and at most ${hi.toLocaleString('en-US')} ${item.capacity.unit}.` : 'This item has no capacity.');
    }
    if (o.zone !== undefined) (tpl && (ZONE_IDS as readonly string[]).includes(o.zone) ? (clean.zone = o.zone) : bad('zone', 'Only added equipment can change zone, and only to a modeled zone.'));
    if (o.schedule !== undefined) (txt(o.schedule, 120) ? (clean.schedule = o.schedule.trim()) : bad('schedule', 'A schedule needs 1 to 120 characters.'));
    if (o.ageYears !== undefined) (inRange(o.ageYears, boundsOf('ageYears', data)) ? (clean.ageYears = o.ageYears) : bad('ageYears', 'Age must be 0 to 100 years.'));
    if (o.notes !== undefined) (typeof o.notes === 'string' && o.notes.length <= 500 ? (clean.notes = o.notes) : bad('notes', 'Notes can have up to 500 characters.'));
    if (o.refrigerant !== undefined) {
      const r = o.refrigerant as Partial<RefrigerantRecord> | null;
      const known = data.emissions.refrigerants ?? {};
      if (!holdsRefrigerant(item)) bad('refrigerant', `${item.label} holds no refrigerant.`);
      else if (!r || typeof r.type !== 'string' || !(r.type in known)) bad('refrigerant', 'Choose a refrigerant from the list.');
      else if (!inRange(r.lbsPerYear, [0, 10000])) bad('refrigerant', 'Pounds added a year must be 0 to 10,000.');
      else clean.refrigerant = { type: r.type, lbsPerYear: r.lbsPerYear as number };
    }
    const checkLever = (l: LeverValue | undefined, v: unknown, field: string) => {
      if (!l) return false;
      const b = boundsOf(l.kind, data);
      if (inRange(v, b)) return true;
      bad(field, `${l.label[0]!.toUpperCase()}${l.label.slice(1)} must be between ${b[0]} and ${b[1]}.`);
      return false;
    };
    if (o.efficiency !== undefined) {
      const l = item.levers.find((x) => x.lever !== 'existingSolarKw');
      if (!l) {
        if (inRange(o.efficiency, [0, 100])) clean.efficiency = o.efficiency;
        else bad('efficiency', 'Efficiency must be a number from 0 to 100.');
      } else if (checkLever(l, o.efficiency, 'efficiency')) clean.efficiency = o.efficiency;
    }
    if (o.levers) {
      const levers: Partial<Record<EquipmentLever, number>> = {};
      for (const [k, v] of Object.entries(o.levers)) {
        const l = item.levers.find((x) => x.lever === k);
        if (!l) bad(`levers.${k}`, `${item.label} has no ${k}.`);
        else if (checkLever(l, v, `levers.${k}`)) levers[k as EquipmentLever] = v as number;
      }
      if (Object.keys(levers).length) clean.levers = levers;
    }
    out.push(clean);
  }

  // A hotel needs heating, cooling and hot water: the last item serving one cannot be removed.
  const rolesOf = (o: EquipmentOverride): EquipmentRole[] => {
    const est = estimated.find((i) => i.id === o.id);
    if (est) return est.roles;
    const t = o.template ? templates.find((x) => x.id === o.template) : undefined;
    return t ? fromTemplate(t, o, data).roles : [];
  };
  for (const role of ['heating', 'cooling', 'hotWater'] as const) {
    if (!estimated.some((i) => i.roles.includes(role))) continue;
    if (!applyEquipment(estimated, out, data).some((i) => i.roles.includes(role))) {
      for (const o of out.filter((x) => x.removed && rolesOf(x).includes(role))) {
        delete o.removed;
        problems.push({
          id: o.id,
          field: 'removed',
          message: `This is the hotel's only ${role === 'hotWater' ? 'water heating' : role} equipment. Add or replace it first, or change the HVAC type in the hotel profile; it was kept so ${role === 'hotWater' ? 'hot water' : role} stays modeled.`,
          severity: 'error',
        });
      }
    }
  }

  // Existing solar cannot exceed the usable roof (the same rule the solar upgrade uses).
  const roofKw = usableRoofKw(p, data);
  const solarKw = existingSolarKw(applyEquipment(estimated, out, data));
  if (solarKw > roofKw + 1e-9) problems.push({ id: 'solar', field: 'capacity', message: `Existing solar (${solarKw} kW) is more than the usable roof holds (about ${Math.round(roofKw)} kW); please check the size.`, severity: 'warning' });
  return { overrides: out, problems };
}

/** Usable roof for solar, kW DC: roof area × usable share ÷ ft² per kW (the solar upgrade's own constants). */
export function usableRoofKw(p: Pick<HotelProfile, 'floorAreaSqft' | 'floors'>, data: HotelData = hotelData): number {
  const def = data.upgrades.upgrades.find((u) => u.id === 'rooftop_solar');
  const share = def?.constants['usableRoofShare'] ?? 0.5;
  const perKw = def?.constants['sqftPerKw'] ?? 100;
  return ((p.floorAreaSqft / Math.max(1, p.floors)) * share) / perKw;
}

/** The estimated items with the overrides applied (removed items dropped, added items appended). */
export function applyEquipment(estimated: EquipmentItem[], overrides: readonly EquipmentOverride[], data: HotelData = hotelData): EquipmentItem[] {
  const byId = new Map(overrides.map((o) => [o.id, o]));
  const templates = equipmentTemplates(data);
  const out: EquipmentItem[] = [];
  for (const i of estimated) {
    const o = byId.get(i.id);
    if (o?.removed) continue;
    out.push(o ? applyOverride(i, o, data) : i);
  }
  for (const o of overrides) {
    if (!o.template || o.removed || estimated.some((i) => i.id === o.id)) continue;
    const t = templates.find((x) => x.id === o.template);
    if (t) out.push(applyOverride(fromTemplate(t, o, data), o, data));
  }
  return out;
}

/** The hotel's current equipment: the estimate with the operator's corrections (what the Equipment tab shows). */
export function currentEquipment(p: HotelProfile, data: HotelData = hotelData): EquipmentItem[] {
  return applyEquipment(estimatedInventory(p, data), p.equipment ?? [], data);
}

const existingSolarKw = (items: EquipmentItem[]) =>
  items.reduce((s, i) => s + (i.levers.some((l) => l.lever === 'existingSolarKw') ? i.count * (i.capacity?.value ?? 0) : 0), 0);

/**
 * The simulation levers set by the current equipment. A lever is set only when the operator changed something that feeds it
 * (an entered efficiency, or added or removed equipment of that kind); otherwise the estimate's reference value applies and the
 * baseline is exactly the estimated one. Several items on one lever combine as a capacity-weighted average (docs/20).
 */
export function equipmentLevers(p: HotelProfile, overrides: readonly EquipmentOverride[], data: HotelData = hotelData): EquipmentLevers {
  if (!overrides.length) return {};
  const estimated = estimatedInventory(p, data);
  const items = applyEquipment(estimated, overrides, data);
  const touched = (k: EquipmentLever) =>
    overrides.some((o) => {
      const est = estimated.find((i) => i.id === o.id);
      const tpl = o.template ? equipmentTemplates(data).find((t) => t.id === o.template) : undefined;
      const has = est ? est.levers.some((l) => l.lever === k) : tpl?.lever === k;
      if (!has) return false;
      if (o.removed || tpl) return true;
      const first = est!.levers.find((l) => l.lever !== 'existingSolarKw');
      return (o.efficiency !== undefined && first?.lever === k) || o.levers?.[k] !== undefined;
    });
  const weighted = (k: EquipmentLever): number | undefined => {
    if (!touched(k)) return undefined;
    let w = 0;
    let acc = 0;
    for (const i of items) {
      const l = i.levers.find((x) => x.lever === k);
      if (!l) continue;
      const weight = Math.max(1e-9, i.count * (i.capacity?.value ?? 1));
      acc += weight * l.value;
      w += weight;
    }
    return w > 0 ? acc / w : undefined;
  };
  const out: EquipmentLevers = {};
  const heat = weighted('heatingEfficiency');
  if (heat !== undefined) out.heatingEfficiency = heat;
  const cool = weighted('coolingCop');
  if (cool !== undefined) out.coolingCop = cool;
  const wh = weighted('waterHeaterEfficiency');
  if (wh !== undefined) out.waterHeaterEfficiency = wh;
  const led: Partial<Record<ZoneId, number>> = {};
  for (const i of items) {
    const l = i.levers.find((x) => x.lever === 'ledShare');
    if (l && !i.added && i.userEntered.some((f) => f === 'efficiency' || f === 'levers.ledShare')) led[i.zone] = l.value;
  }
  if (Object.keys(led).length) out.ledShare = led;
  const solar = existingSolarKw(items);
  if (solar > 0) out.existingSolarKw = Math.min(solar, usableRoofKw(p, data));
  return out;
}

/** Installed capacity the operator entered for the central plant (for replacement costs); null when it is still the estimate. */
export function enteredPlantCapacity(p: HotelProfile, data: HotelData = hotelData): { boilerKBtuH: number | null; chillerTons: number | null } {
  if (!p.equipment?.length || p.hvacType !== 'central_plant') return { boilerKBtuH: null, chillerTons: null };
  const items = currentEquipment(p, data);
  const entered = (pred: (i: EquipmentItem) => boolean) => {
    const xs = items.filter(pred);
    if (!xs.some((i) => i.added || i.userEntered.includes('capacity') || i.userEntered.includes('quantity'))) return null;
    return xs.reduce((s, i) => s + i.count * (i.capacity?.value ?? 0), 0);
  };
  const gasHeat = (i: EquipmentItem) => i.zone === 'central_hvac' && i.fuel === 'gas' && i.levers.some((l) => l.lever === 'heatingEfficiency');
  const chill = (i: EquipmentItem) => i.zone === 'central_hvac' && i.capacity?.unit === 'tons' && i.levers.some((l) => l.lever === 'coolingCop');
  const boilersRemoved = p.equipment.some((o) => o.id === 'boilers' && o.removed);
  const chillerRemoved = p.equipment.some((o) => o.id === 'chiller' && o.removed);
  return {
    boilerKBtuH: entered(gasHeat) ?? (boilersRemoved ? 0 : null),
    chillerTons: entered(chill) ?? (chillerRemoved ? 0 : null),
  };
}

/** Which upgrade replaces an item, if the model has one (docs/20); null: "needs more information". */
export function replacementUpgrade(item: Pick<EquipmentItem, 'id' | 'template' | 'category' | 'levers'>): 'hvac_upgrade' | 'led_lighting' | 'water_heating' | 'rooftop_solar' | null {
  const levers = item.levers.map((l) => l.lever);
  if (levers.includes('heatingEfficiency') || levers.includes('coolingCop')) return 'hvac_upgrade';
  if (levers.includes('ledShare')) return 'led_lighting';
  if (levers.includes('waterHeaterEfficiency')) return 'water_heating';
  if (levers.includes('existingSolarKw')) return 'rooftop_solar';
  return null;
}

export type { HvacType };
