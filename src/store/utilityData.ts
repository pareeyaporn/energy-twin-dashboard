// Utility records per hotel (docs/19): what the operator entered, uploaded or edited, where it came from, and which baseline the hotel
// uses. Kept in this browser's local storage only; nothing is sent anywhere (the advisor receives calibrated results, not records).
import { normalizeBills } from "@/engine/hotel";
import type { HotelInput, UtilityBillMonth } from "@/engine/hotel";
import type { GridMode } from "@/engine/hotel";

export const UTILITY_STORAGE_KEY = "energy-twin:utility-data:v1";

/**
 * Where the records came from. Sample data stays synthetic, even when edited, unless the user explicitly says the numbers are the
 * hotel's real records (`markedActual`).
 */
export type UtilityProvenance = "sample" | "sample_edited" | "user_entered" | "uploaded";
export type UtilityBaseline = "modeled" | "calibrated";

export interface UtilitySet {
  records: UtilityBillMonth[];
  provenance: UtilityProvenance;
  /** The user confirmed these are the hotel's real utility records (never true for unedited sample data). */
  markedActual: boolean;
  /** Billing year shown in the editor (calendar-month records). */
  year: number;
  mode: GridMode;
  /** Use the bills' average rates instead of the state averages. */
  useBillRates: boolean;
  /** Which baseline the hotel uses; changed only by the user. */
  baseline: UtilityBaseline;
  /** File name for uploaded records. */
  fileName?: string;
}

export const PROVENANCE_LABEL: Record<UtilityProvenance, string> = {
  sample: "Sample data (synthetic)",
  sample_edited: "Edited sample data (synthetic)",
  user_entered: "User-entered data",
  uploaded: "Uploaded utility data",
};

/** True for records the user stands behind as real (not sample data). */
export const isActualData = (u: UtilitySet | undefined) => !!u && (u.markedActual || u.provenance === "user_entered" || u.provenance === "uploaded");

const PROVENANCES: UtilityProvenance[] = ["sample", "sample_edited", "user_entered", "uploaded"];

/** Keep only well-formed sets (local storage can hold anything). */
export function sanitizeUtilityData(raw: unknown): Record<string, UtilitySet> {
  if (!raw || typeof raw !== "object") return {};
  const r = raw as { version?: number; hotels?: Record<string, unknown> };
  if (r.version !== 1 || !r.hotels || typeof r.hotels !== "object") return {};
  const out: Record<string, UtilitySet> = {};
  for (const [key, v] of Object.entries(r.hotels)) {
    if (!v || typeof v !== "object" || key.length > 80) continue;
    const x = v as Partial<UtilitySet>;
    const records = normalizeBills(Array.isArray(x.records) ? (x.records as UtilityBillMonth[]) : []);
    if (!records.length) continue;
    const provenance = PROVENANCES.includes(x.provenance as UtilityProvenance) ? (x.provenance as UtilityProvenance) : "user_entered";
    out[key] = {
      records,
      provenance,
      markedActual: provenance === "sample" ? false : x.markedActual === true,
      year: Number.isInteger(x.year) && (x.year as number) > 1990 && (x.year as number) < 2100 ? (x.year as number) : 2025,
      mode: x.mode === "periods" ? "periods" : "monthly",
      useBillRates: x.useBillRates === true,
      baseline: x.baseline === "calibrated" ? "calibrated" : "modeled",
      ...(typeof x.fileName === "string" ? { fileName: x.fileName.slice(0, 120) } : {}),
    };
  }
  return out;
}

export function readUtilityData(): Record<string, UtilitySet> {
  try {
    if (typeof window === "undefined" || !window.localStorage) return {};
    const txt = window.localStorage.getItem(UTILITY_STORAGE_KEY);
    return sanitizeUtilityData(txt ? JSON.parse(txt) : null);
  } catch {
    return {};
  }
}

export function writeUtilityData(data: Record<string, UtilitySet>): void {
  try {
    if (typeof window === "undefined" || !window.localStorage) return;
    window.localStorage.setItem(UTILITY_STORAGE_KEY, JSON.stringify({ version: 1, hotels: data }));
  } catch {
    // Storage full or blocked: the data still works for this visit.
  }
}

/**
 * The key a hotel's utility data is kept under: the open portfolio property's id; a preset opened directly maps to the portfolio
 * property built from it (so the 100-room preset and Lakeshore Inn share their data); otherwise the preset id or "custom".
 */
export function utilityKeyFor(activePropertyId: string | null, presetId: string | null, properties: readonly { id: string; presetId?: string }[]): string {
  if (activePropertyId) return activePropertyId;
  if (presetId) return properties.find((p) => p.presetId === presetId)?.id ?? `preset:${presetId}`;
  return "custom";
}

/** The hotel input without utility records (the original modeled baseline). */
export function withoutUtility(input: HotelInput): HotelInput {
  if (!("utilityBills" in input) && !("useBillRates" in input)) return input;
  const { utilityBills: _b, useBillRates: _r, ...rest } = input;
  return rest;
}

/** The input the engine runs on: with the records when the calibrated baseline is chosen, else without. */
export function inputForBaseline(input: HotelInput, set: UtilitySet | undefined): HotelInput {
  const clean = withoutUtility(input);
  if (!set || set.baseline !== "calibrated") return clean;
  return { ...clean, utilityBills: set.records, ...(set.useBillRates ? { useBillRates: true } : {}) };
}
