// "Add my hotel": hotels the user enters, kept in this browser (local storage) and shown in the portfolio next to the sample chain.
// Only the user's inputs are stored; every figure is recomputed by the engine. No address is sent anywhere: the location is a Chicago
// neighborhood chosen from a list (the model has Chicago weather only).
import type { HotelInput, HvacType, PortfolioProperty } from "@/engine/hotel";

export const USER_HOTELS_STORAGE_KEY = "energy-twin:my-hotels:v1";

/** Chicago areas a hotel can be placed in (approximate centers, for the map only). */
export const CHICAGO_AREAS = [
  { id: "loop", label: "The Loop", lat: 41.8818, lng: -87.6298 },
  { id: "river-north", label: "River North", lat: 41.8924, lng: -87.6341 },
  { id: "streeterville", label: "Streeterville", lat: 41.8927, lng: -87.6198 },
  { id: "gold-coast", label: "Gold Coast", lat: 41.9058, lng: -87.6273 },
  { id: "west-loop", label: "West Loop", lat: 41.8826, lng: -87.6502 },
  { id: "south-loop", label: "South Loop", lat: 41.8569, lng: -87.6256 },
  { id: "lincoln-park", label: "Lincoln Park", lat: 41.9214, lng: -87.6513 },
  { id: "wicker-park", label: "Wicker Park", lat: 41.9088, lng: -87.6796 },
  { id: "hyde-park", label: "Hyde Park", lat: 41.7943, lng: -87.5907 },
  { id: "ohare", label: "O'Hare / Rosemont", lat: 41.9742, lng: -87.8731 },
  { id: "midway", label: "Midway", lat: 41.7868, lng: -87.7522 },
] as const;
export type ChicagoAreaId = (typeof CHICAGO_AREAS)[number]["id"];

const HVAC: HvacType[] = ["ptac", "pthp", "vrf", "central_plant", "rtu"];
const NUMERIC: (keyof HotelInput)[] = ["rooms", "floors", "floorAreaSqft", "yearBuilt", "occupancy", "monthlyEnergyBill", "budget", "operatingHours", "occupiedHoursPerRoom", "electricityRate", "gasRate", "commonAreaHvacHours", "lightingHoursPerDay", "hotWaterGalPerOccupiedRoomDay", "horizonYears"];

/** Builds the portfolio property for a user's hotel (not synthetic: the inputs are the user's). */
export function userProperty(id: string, input: HotelInput, areaId: ChicagoAreaId, index: number): PortfolioProperty {
  const area = CHICAGO_AREAS.find((a) => a.id === areaId) ?? CHICAGO_AREAS[0];
  // Hotels in the same area are spread slightly so their markers do not sit on top of each other.
  const k = index % 6;
  return {
    id,
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
  const empty = { hotels: [], next: 1 };
  if (!raw || typeof raw !== "object") return empty;
  const r = raw as { version?: number; hotels?: unknown[]; next?: number };
  if (r.version !== 1 || !Array.isArray(r.hotels)) return empty;
  const hotels: (PortfolioProperty & { areaId: ChicagoAreaId })[] = [];
  r.hotels.forEach((h, i) => {
    if (!h || typeof h !== "object") return;
    const x = h as { id?: unknown; areaId?: unknown; input?: Record<string, unknown> };
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
    hotels.push({ ...userProperty(x.id, input, areaId, i), areaId });
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
    const data = { version: 1, next, hotels: hotels.map((h) => ({ id: h.id, areaId: h.areaId, input: h.input })) };
    window.localStorage.setItem(USER_HOTELS_STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Storage full or blocked: the hotel still works for this visit.
  }
}
