// Grouping the portfolio's hotels by city (multi-city organizations). Sums and weighted averages of each hotel's engine figures only.
import type { PropertySummary } from "@/engine/hotel";
import type { MapMetric } from "./metrics";

export interface CityGroup {
  city: string;
  state: string;
  ids: string[];
  hotels: number;
  /** Mean position of the city's hotels (where a city marker sits on the map). */
  lat: number;
  lng: number;
  cost: number;
  potential: number;
  /** The group's site energy divided by its floor area, kBtu/ft² a year. */
  eui: number;
  /** The highest investment priority score among the city's hotels. */
  bestPriority: number;
}

/** The cities of the hotels, largest energy cost first. */
export function cityGroups(rows: PropertySummary[]): CityGroup[] {
  const by = new Map<string, PropertySummary[]>();
  for (const r of rows) by.set(r.city, [...(by.get(r.city) ?? []), r]);
  return [...by.entries()]
    .map(([city, rs]) => {
      const area = rs.reduce((s, r) => s + r.floorAreaSqft, 0);
      return {
        city,
        state: rs[0]!.state,
        ids: rs.map((r) => r.id),
        hotels: rs.length,
        lat: rs.reduce((s, r) => s + r.lat, 0) / rs.length,
        lng: rs.reduce((s, r) => s + r.lng, 0) / rs.length,
        cost: rs.reduce((s, r) => s + r.annual.cost, 0),
        potential: rs.reduce((s, r) => s + (r.potential?.annualSavings ?? 0), 0),
        eui: area > 0 ? rs.reduce((s, r) => s + r.annual.siteKBtu, 0) / area : 0,
        bestPriority: Math.max(...rs.map((r) => r.priorityScore)),
      };
    })
    .sort((a, b) => b.cost - a.cost || a.city.localeCompare(b.city));
}

/** The city figure a city marker shows for the map's metric (a sum for dollars, a weighted average for intensity, the best score for priority). */
export function cityValue(g: CityGroup, metric: MapMetric): number {
  if (metric === "cost") return g.cost;
  if (metric === "potential") return g.potential;
  if (metric === "eui") return g.eui;
  return g.bestPriority;
}

/** True when the drawn Chicago map fits: every hotel is in Chicago (or there are none). */
export const allInChicago = (rows: PropertySummary[]) => rows.every((r) => r.city === "Chicago");
