// Linked use and cost in the utility spreadsheet: editing a month's kWh updates its electricity cost at that month's rate, and the other way
// round (same for therms and gas cost). Pure functions; the grid captures the rate when a cell gets focus, so it stays steady while typing.
import type { UtilityGridRow } from "@/engine/hotel";

export type LinkFuel = "elec" | "gas";
type LinkedField = "elecKWh" | "elecCost" | "gasTherms" | "gasCost";

const PAIR: Record<LinkedField, { fuel: LinkFuel; other: LinkedField; kind: "use" | "cost" }> = {
  elecKWh: { fuel: "elec", other: "elecCost", kind: "use" },
  elecCost: { fuel: "elec", other: "elecKWh", kind: "cost" },
  gasTherms: { fuel: "gas", other: "gasCost", kind: "use" },
  gasCost: { fuel: "gas", other: "gasTherms", kind: "cost" },
};

export const isLinkedField = (f: string): f is LinkedField => f in PAIR;
export const fuelOf = (f: LinkedField): LinkFuel => PAIR[f].fuel;

/** A cell's number ("$12,000" → 12000); null when empty or not a number. */
export function parseCell(s: string): number | null {
  const t = s.replace(/[$,\s]/g, "");
  if (!t) return null;
  const v = Number(t);
  return Number.isFinite(v) ? v : null;
}

/**
 * The rate to keep: the row's own (cost ÷ use) when both are positive, else the hotel's price for that fuel (its EIA state average or
 * its own rate), else null (then nothing is linked).
 */
export function rowRate(row: UtilityGridRow, fuel: LinkFuel, fallback: number | null | undefined): number | null {
  const use = parseCell(fuel === "elec" ? row.elecKWh : row.gasTherms);
  const cost = parseCell(fuel === "elec" ? row.elecCost : row.gasCost);
  if (use !== null && cost !== null && use > 0 && cost > 0) return cost / use;
  return fallback && fallback > 0 ? fallback : null;
}

/**
 * The row after typing `value` into `field`. With a rate, the paired cell follows: cost = use × rate (to the cent), use = cost ÷ rate (whole
 * kWh or therms). An empty or unreadable entry leaves the paired cell as it was; other fields are unaffected.
 */
export function linkedEdit(row: UtilityGridRow, field: keyof UtilityGridRow, value: string, rate: number | null): UtilityGridRow {
  const next = { ...row, [field]: value } as UtilityGridRow;
  if (!isLinkedField(field) || rate === null || rate <= 0) return next;
  const v = parseCell(value);
  if (v === null || v < 0) return next;
  const { other, kind } = PAIR[field];
  next[other] = kind === "use" ? (v * rate).toFixed(2) : String(Math.round(v / rate));
  return next;
}
