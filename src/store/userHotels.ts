// "Add my hotel": hotels the user enters, kept in this browser (local storage) and shown in the portfolio next to the sample chain.
// Only the user's inputs are stored; every figure is recomputed by the engine. No address is sent anywhere: the location is a Chicago
// neighborhood chosen from a list (the model has Chicago weather only).
import type { HotelInput, HvacType, Ownership, PortfolioProperty } from "@/engine/hotel";

export const USER_HOTELS_STORAGE_KEY = "energy-twin:my-hotels:v1";

/** Chicago areas a hotel can be placed in (approximate centers, for the map only). */
export const CHICAGO_AREAS = [
  { id: "loop", label: "The Loop", region: "Downtown", lat: 41.8818, lng: -87.6298 },
  { id: "river-north", label: "River North", region: "Downtown", lat: 41.8924, lng: -87.6341 },
  { id: "streeterville", label: "Streeterville", region: "Downtown", lat: 41.8927, lng: -87.6198 },
  { id: "gold-coast", label: "Gold Coast", region: "Downtown", lat: 41.9058, lng: -87.6273 },
  { id: "west-loop", label: "West Loop", region: "Downtown", lat: 41.8826, lng: -87.6502 },
  { id: "south-loop", label: "South Loop", region: "Downtown", lat: 41.8569, lng: -87.6256 },
  { id: "lincoln-park", label: "Lincoln Park", region: "North Side", lat: 41.9214, lng: -87.6513 },
  { id: "wicker-park", label: "Wicker Park", region: "North Side", lat: 41.9088, lng: -87.6796 },
  { id: "hyde-park", label: "Hyde Park", region: "South Side", lat: 41.7943, lng: -87.5907 },
  { id: "ohare", label: "O'Hare / Rosemont", region: "Airports", lat: 41.9742, lng: -87.8731 },
  { id: "midway", label: "Midway", region: "Airports", lat: 41.7868, lng: -87.7522 },
] as const;

export const OWNERSHIP_LABEL: Record<Ownership, string> = { owned: "Owned", managed: "Managed", franchised: "Franchised", leased: "Leased" };
const OWNERSHIPS = Object.keys(OWNERSHIP_LABEL) as Ownership[];

/** Brand, ownership and organization of a user's hotel (defaults: "Independent", owned, the first organization). */
export interface UserHotelMeta {
  organizationId?: string;
  brand?: string;
  ownership?: Ownership;
}
export type ChicagoAreaId = (typeof CHICAGO_AREAS)[number]["id"];

const HVAC: HvacType[] = ["ptac", "pthp", "vrf", "central_plant", "rtu"];
const NUMERIC: (keyof HotelInput)[] = ["rooms", "floors", "floorAreaSqft", "yearBuilt", "occupancy", "monthlyEnergyBill", "budget", "operatingHours", "occupiedHoursPerRoom", "electricityRate", "gasRate", "commonAreaHvacHours", "lightingHoursPerDay", "hotWaterGalPerOccupiedRoomDay", "horizonYears"];

/** Builds the portfolio property for a user's hotel (not synthetic: the inputs are the user's). */
export function userProperty(id: string, input: HotelInput, areaId: ChicagoAreaId, index: number, meta: UserHotelMeta = {}): PortfolioProperty {
  const area = CHICAGO_AREAS.find((a) => a.id === areaId) ?? CHICAGO_AREAS[0];
  // Hotels in the same area are spread slightly so their markers do not sit on top of each other.
  const k = index % 6;
  return {
    id,
    ...(meta.organizationId ? { organizationId: meta.organizationId } : {}),
    brand: meta.brand?.trim().slice(0, 60) || "Independent",
    region: area.region,
    ownership: meta.ownership ?? "owned",
    neighborhood: area.label,
    segment: "Your hotel",
    buildingType: "hotel",
    lat: area.lat + 0.004 * Math.sin((k * Math.PI) / 3),
    lng: area.lng + 0.005 * Math.cos((k * Math.PI) / 3),
    synthetic: false,
    note: "Your hotel: your inputs; anything left blank uses the documented defaults (marked in the profile). Chicago weather, Illinois rates and ComEd incentives.",
    input: { city: "Chicago", state: "IL", country: "US", ...input },
  };
}

/** Keeps only valid stored hotels and inputs (known HVAC types, finite numbers). */
export function sanitizeUserHotels(raw: unknown): { hotels: (PortfolioProperty & { areaId: ChicagoAreaId })[]; next: number } {
  // Hotels keep their organization, brand and ownership (older saved hotels get the defaults).
  const empty = { hotels: [], next: 1 };
  if (!raw || typeof raw !== "object") return empty;
  const r = raw as { version?: number; hotels?: unknown[]; next?: number };
  if (r.version !== 1 || !Array.isArray(r.hotels)) return empty;
  const hotels: (PortfolioProperty & { areaId: ChicagoAreaId })[] = [];
  r.hotels.forEach((h, i) => {
    if (!h || typeof h !== "object") return;
    const x = h as { id?: unknown; areaId?: unknown; input?: Record<string, unknown>; organizationId?: unknown; brand?: unknown; ownership?: unknown };
    if (typeof x.id !== "string" || !x.id.startsWith("my-hotel-") || !x.input || typeof x.input !== "object") return;
    const areaId = (CHICAGO_AREAS.some((a) => a.id === x.areaId) ? x.areaId : "loop") as ChicagoAreaId;
    const input: HotelInput = {};
    if (typeof x.input["name"] === "string") input.name = x.input["name"].slice(0, 80);
    for (const k of NUMERIC) {
      const v = x.input[k];
      if (typeof v === "number" && Number.isFinite(v)) (input as Record<string, unknown>)[k] = v;
    }
    if (HVAC.includes(x.input["hvacType"] as HvacType)) input.hvacType = x.input["hvacType"] as HvacType;
    if (typeof input.rooms !== "number" || input.rooms < 1) return;
    const meta: UserHotelMeta = {
      ...(typeof x.organizationId === "string" ? { organizationId: x.organizationId } : {}),
      ...(typeof x.brand === "string" ? { brand: x.brand } : {}),
      ...(OWNERSHIPS.includes(x.ownership as Ownership) ? { ownership: x.ownership as Ownership } : {}),
    };
    hotels.push({ ...userProperty(x.id, input, areaId, i, meta), areaId });
  });
  const next = typeof r.next === "number" && Number.isFinite(r.next) ? Math.max(1, Math.floor(r.next)) : hotels.length + 1;
  return { hotels, next };
}

export function readUserHotels(): ReturnType<typeof sanitizeUserHotels> {
  try {
    if (typeof window === "undefined" || !window.localStorage) return sanitizeUserHotels(null);
    const txt = window.localStorage.getItem(USER_HOTELS_STORAGE_KEY);
    return sanitizeUserHotels(txt ? JSON.parse(txt) : null);
  } catch {
    return sanitizeUserHotels(null);
  }
}

export function writeUserHotels(hotels: (PortfolioProperty & { areaId: ChicagoAreaId })[], next: number): void {
  try {
    if (typeof window === "undefined" || !window.localStorage) return;
    const data = { version: 1, next, hotels: hotels.map((h) => ({ id: h.id, areaId: h.areaId, input: h.input, organizationId: h.organizationId, brand: h.brand, ownership: h.ownership })) };
    window.localStorage.setItem(USER_HOTELS_STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Storage full or blocked: the hotel still works for this visit.
  }
}
