// Display helpers for the twin. Formatting only: every number shown comes from the store.
import { MONTH_LABELS } from "@/engine/hotel";

export const usd = (n: number) => `${n < 0 ? "-" : ""}$${Math.round(Math.abs(n)).toLocaleString("en-US")}`;
export const signedUsd = (n: number) => `${n < 0 ? "-" : "+"}$${Math.round(Math.abs(n)).toLocaleString("en-US")}`;
export const kwh = (n: number) => `${Math.round(n).toLocaleString("en-US")} kWh`;
export const therms = (n: number) => `${Math.round(n).toLocaleString("en-US")} therms`;
export const percent = (share: number) => `${Math.round(share * 100)}%`;

export const monthLabel = (m: number) => MONTH_LABELS[m] ?? "";
export function hourLabel(h: number): string {
  const suffix = h < 12 ? "AM" : "PM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:00 ${suffix}`;
}

/** Heat-map color for a value between 0 (efficient, blue) and 1 (costly, red), through amber. */
/** Position of a value between the lowest and highest shown, 0 to 1 (0.5 when they are all equal), so the scale uses its full range. */
export function relativeIntensity(value: number, min: number, max: number): number {
  return max - min > 0 ? (value - min) / (max - min) : 0.5;
}

export function intensityColor(t: number): string {
  const x = Math.min(1, Math.max(0, Number.isFinite(t) ? t : 0));
  return x < 0.5
    ? `color-mix(in oklab, var(--efficient), var(--heat) ${Math.round(x * 200)}%)`
    : `color-mix(in oklab, var(--heat), var(--loss) ${Math.round((x - 0.5) * 200)}%)`;
}
