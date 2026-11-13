// Refrigerant leaks (docs/24 §3): carbon from the refrigerant an operator added to top up cooling and refrigeration equipment, from
// service records. EPA's simplified material balance idea: what was added to replace losses is what leaked. Pure; carbon only, it never
// changes energy, cost or savings, and nothing is assumed when the operator enters nothing.
import { hotelData } from './data';
import { currentEquipment, holdsRefrigerant } from './equipment';
import type { HotelData, HotelProfile, ZoneId } from './types';

export const KG_PER_LB = 0.45359237;

export interface RefrigerantLeak {
  /** Equipment item id. */
  id: string;
  label: string;
  zone: ZoneId;
  /** Where the flow chart puts it: air conditioning (HVAC) or the kitchen's refrigeration. */
  category: 'hvac' | 'kitchen';
  type: string;
  typeLabel: string;
  lbsPerYear: number;
  /** 100-year GWP (null: recorded, not counted). */
  gwp: number | null;
  /** kg CO2e a year (0 when not counted). */
  carbonKg: number;
  counted: boolean;
}

export interface RefrigerantSummary {
  leaks: RefrigerantLeak[];
  /** kg CO2e a year from counted refrigerants. Reported next to, not inside, the energy carbon. */
  carbonKg: number;
  source: string;
}

/** The refrigerant leaks the operator entered on the current equipment, with their carbon. */
export function refrigerantEmissions(p: HotelProfile, data: HotelData = hotelData): RefrigerantSummary {
  const known = data.emissions.refrigerants ?? {};
  const leaks: RefrigerantLeak[] = [];
  for (const i of currentEquipment(p, data)) {
    const r = i.refrigerant;
    if (!r || !holdsRefrigerant(i)) continue;
    const ref = known[r.type];
    if (!ref) continue;
    const counted = ref.gwp !== null;
    const carbonKg = counted ? r.lbsPerYear * KG_PER_LB * (ref.gwp as number) : 0;
    const kitchen = i.id === 'kitchen-cold' || i.template === 'walk_in_refrigeration';
    leaks.push({ id: i.id, label: i.label, zone: i.zone, category: kitchen ? 'kitchen' : 'hvac', type: r.type, typeLabel: ref.label, lbsPerYear: r.lbsPerYear, gwp: ref.gwp, carbonKg, counted });
  }
  return { leaks, carbonKg: leaks.reduce((s, l) => s + l.carbonKg, 0), source: data.emissions.refrigerantSource ?? '' };
}

/** The refrigerants an operator can choose, in a stable order. */
export function refrigerantOptions(data: HotelData = hotelData): { id: string; label: string; gwp: number | null; typicalUse: string }[] {
  return Object.entries(data.emissions.refrigerants ?? {}).map(([id, r]) => ({ id, ...r }));
}
