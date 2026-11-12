// Map and table metrics for the portfolio. Formatting and color only: every number comes from the engine via the store.
import type { PropertySummary } from "@/engine/hotel";
import { intensityColor, relativeIntensity, usd } from "@/twin/format";

export type MapMetric = "cost" | "eui" | "potential" | "priority";

export interface MetricDef {
  id: MapMetric;
  label: string;
  /** "use": higher means more energy or cost (blue → amber → red, as in the twin's heat map). "opportunity": higher is a bigger opportunity (green, dim → bright). */
  kind: "use" | "opportunity";
  value: (r: PropertySummary) => number;
  format: (n: number) => string;
  note: string;
}

export const eui = (n: number) => `${n.toFixed(1)} kBtu/ft²`;

export const MAP_METRICS: MetricDef[] = [
  {
    id: "cost",
    label: "Energy cost",
    kind: "use",
    value: (r) => r.annual.cost,
    format: (n) => `${usd(n)} / yr`,
    note: "Larger hotels naturally spend more; cost alone does not mean a hotel is inefficient. Compare energy intensity for that.",
  },
  {
    id: "eui",
    label: "Energy intensity",
    kind: "use",
    value: (r) => r.siteEui,
    format: eui,
    note: "Site energy per square foot a year (electricity and gas in one unit), so hotels of different sizes can be compared.",
  },
  {
    id: "potential",
    label: "Savings potential",
    kind: "opportunity",
    value: (r) => r.potential?.annualSavings ?? 0,
    format: (n) => `${usd(n)} / yr`,
    note: "Annual savings of the hotel's best package by 10-year NPV within its own budget.",
  },
  {
    id: "priority",
    label: "Investment priority",
    kind: "opportunity",
    value: (r) => r.priorityScore,
    format: (n) => `${Math.round(n)} / 100`,
    note: "10-year NPV per dollar invested, scaled so the best hotel in the portfolio scores 100.",
  },
];

export const metricDef = (id: MapMetric) => MAP_METRICS.find((m) => m.id === id)!;

export function opportunityColor(t: number): string {
  const x = Math.min(1, Math.max(0, Number.isFinite(t) ? t : 0));
  return `color-mix(in oklab, var(--savings) ${Math.round(25 + x * 75)}%, var(--muted-foreground))`;
}

export const colorAt = (kind: MetricDef["kind"], t: number) => (kind === "use" ? intensityColor(t) : opportunityColor(t));

/** Color of each property for a metric, scaled between the lowest and highest in the portfolio. */
export function metricColors(rows: PropertySummary[], metric: MapMetric): Record<string, string> {
  const def = metricDef(metric);
  const values = rows.map(def.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const out: Record<string, string> = {};
  rows.forEach((r, i) => {
    const t = relativeIntensity(values[i]!, min, max);
    out[r.id] = colorAt(def.kind, t);
  });
  return out;
}

export const HVAC_LABEL: Record<string, string> = {
  central_plant: "Central plant",
  ptac: "PTAC",
  pthp: "PTHP",
  rtu: "Rooftop units",
  vrf: "VRF",
};
