// Display formatting for the portfolio page: compact figures for cards and strips. Formatting only; every number comes from the store
// (the engine). Exact values stay available through `usd` (src/twin/format) in titles and accessible labels.

const trim = (s: string) => s.replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1");

/** Compact dollars: $1.56M, $109.9K, $500K, $950. Negative values keep their sign. */
export function compactUsd(n: number): string {
  if (!Number.isFinite(n)) return "—";
  const sign = n < 0 ? "-" : "";
  const a = Math.abs(n);
  if (a >= 1e9) return `${sign}$${trim((a / 1e9).toFixed(2))}B`;
  if (a >= 1e6) return `${sign}$${trim((a / 1e6).toFixed(a >= 1e8 ? 0 : a >= 1e7 ? 1 : 2))}M`;
  if (a >= 1e3) {
    const k = a / 1e3;
    // 999,950 rounds to 1,000.0K: show it as $1M instead.
    if (Number(k.toFixed(1)) >= 1000) return `${sign}$1M`;
    return `${sign}$${trim(k.toFixed(1))}K`;
  }
  return `${sign}$${Math.round(a).toLocaleString("en-US")}`;
}

/** Compact quantity with a unit: 9.4M kWh, 267K therms, 59K MMBtu, 1,172 rooms. */
export function compactNumber(n: number, unit = ""): string {
  if (!Number.isFinite(n)) return "—";
  const a = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  const v =
    a >= 1e6 ? `${trim((a / 1e6).toFixed(1))}M` : a >= 1e4 ? `${Math.round(a / 1e3).toLocaleString("en-US")}K` : Math.round(a).toLocaleString("en-US");
  return `${sign}${v}${unit ? ` ${unit}` : ""}`;
}

/** Tonnes from kilograms, whole tonnes with separators: 5,302 t CO₂e. */
export const tonnes = (kg: number) => `${Math.round(kg / 1000).toLocaleString("en-US")} t CO₂e`;

/** A share of a total (0–1), or null when the total is not positive. */
export function shareOf(part: number, total: number): number | null {
  return total > 0 && Number.isFinite(part) ? part / total : null;
}

/** A share as a percent with one decimal below 10% (7.0%), whole above (12%). */
export function pct(share: number): string {
  const p = share * 100;
  return `${Math.abs(p) < 10 ? p.toFixed(1) : Math.round(p).toString()}%`;
}
