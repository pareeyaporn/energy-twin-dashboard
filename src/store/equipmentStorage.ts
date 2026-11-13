import type { EquipmentOverride, HotelInput, PortfolioProperty } from "@/engine/hotel";

/** Where each hotel's equipment corrections are kept in this browser (docs/20). One entry per property; never shared across hotels. */
export const EQUIPMENT_STORAGE_KEY = "energy-twin:equipment:v1";

export type EquipmentByProperty = Record<string, EquipmentOverride[]>;

const isObj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === "object" && !Array.isArray(x);

/** Keeps only well-formed entries (the engine validates the values again when the hotel is resolved). */
export function sanitizeEquipment(raw: unknown): EquipmentByProperty {
  if (!isObj(raw) || raw["version"] !== 1 || !isObj(raw["byProperty"])) return {};
  const out: EquipmentByProperty = {};
  for (const [key, list] of Object.entries(raw["byProperty"] as Record<string, unknown>)) {
    if (!Array.isArray(list)) continue;
    const items = list.filter((o): o is EquipmentOverride => isObj(o) && typeof o["id"] === "string" && (o["id"] as string).length > 0 && (o["id"] as string).length < 80);
    if (items.length) out[key] = items;
  }
  return out;
}

export function readEquipment(): EquipmentByProperty {
  try {
    if (typeof window === "undefined" || !window.localStorage) return {};
    const txt = window.localStorage.getItem(EQUIPMENT_STORAGE_KEY);
    return sanitizeEquipment(txt ? JSON.parse(txt) : null);
  } catch {
    return {};
  }
}

export function writeEquipment(byProperty: EquipmentByProperty): void {
  try {
    if (typeof window === "undefined" || !window.localStorage) return;
    if (Object.keys(byProperty).length === 0) window.localStorage.removeItem(EQUIPMENT_STORAGE_KEY);
    else window.localStorage.setItem(EQUIPMENT_STORAGE_KEY, JSON.stringify({ version: 1, byProperty }));
  } catch {
    /* storage full or blocked: the change still applies for this visit */
  }
}

/** A property's input with its saved equipment (the same object while nothing changed, so selectors stay memoized). */
const merged = new WeakMap<HotelInput, { equipment: EquipmentOverride[]; input: HotelInput }>();
export function withEquipment(property: Pick<PortfolioProperty, "input">, equipment: EquipmentOverride[] | undefined): HotelInput {
  if (!equipment?.length) return property.input;
  const hit = merged.get(property.input);
  if (hit && hit.equipment === equipment) return hit.input;
  const input = { ...property.input, equipment };
  merged.set(property.input, { equipment, input });
  return input;
}
