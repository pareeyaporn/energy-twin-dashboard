import { useState } from "react";
import type { PropertySummary } from "@/engine/hotel";
import { OWNERSHIP_LABEL } from "@/store/userHotels";
import { usd } from "@/twin/format";

type GroupBy = "brand" | "region" | "ownership";
const LABEL: Record<GroupBy, string> = { brand: "Brand", region: "Region", ownership: "Ownership" };

/** Totals by brand, region or ownership type: sums of each hotel's engine figures. */
export function PortfolioGroups({ rows }: { rows: PropertySummary[] }) {
  const [by, setBy] = useState<GroupBy>("brand");
  const keyOf = (r: PropertySummary) => {
    const v = r[by];
    return by === "ownership" && v ? OWNERSHIP_LABEL[v as keyof typeof OWNERSHIP_LABEL] : (v ?? "Unassigned");
  };
  const groups = new Map<string, { hotels: number; rooms: number; cost: number; potential: number; investment: number; area: number; site: number }>();
  for (const r of rows) {
    const k = keyOf(r);
    const g = groups.get(k) ?? { hotels: 0, rooms: 0, cost: 0, potential: 0, investment: 0, area: 0, site: 0 };
    g.hotels += 1;
    g.rooms += r.rooms;
    g.cost += r.annual.cost;
    g.potential += r.potential?.annualSavings ?? 0;
    g.investment += r.potential?.netInvestment ?? 0;
    g.area += r.floorAreaSqft;
    g.site += r.annual.siteKBtu;
    groups.set(k, g);
  }
  const list = [...groups.entries()].sort((a, b) => b[1].cost - a[1].cost);
  return (
    <section aria-label="Totals by group" className="space-y-2" data-testid="portfolio-groups">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold">By {LABEL[by].toLowerCase()}</h2>
        <div role="radiogroup" aria-label="Group the hotels by" className="flex gap-1">
          {(Object.keys(LABEL) as GroupBy[]).map((g) => (
            <button key={g} type="button" role="radio" aria-checked={by === g} onClick={() => setBy(g)} className={`rounded-full border px-2.5 py-0.5 text-xs ${by === g ? "border-primary bg-primary/15" : "border-glass-border text-muted-foreground"}`} data-testid={`group-${g}`}>
              {LABEL[g]}
            </button>
          ))}
        </div>
      </div>
      <div className="table-scroll overflow-x-auto rounded-xl border border-glass-border">
        <table className="w-full min-w-[640px] text-xs">
          <caption className="sr-only">Portfolio totals by {LABEL[by].toLowerCase()} (modeled estimates)</caption>
          <thead>
            <tr className="border-b border-border text-muted-foreground">
              <th className="p-2 text-left font-medium">{LABEL[by]}</th>
              <th className="p-2 text-right font-medium">Hotels</th>
              <th className="p-2 text-right font-medium">Rooms</th>
              <th className="p-2 text-right font-medium">Energy cost / yr</th>
              <th className="p-2 text-right font-medium">Intensity (kBtu/ft²)</th>
              <th className="p-2 text-right font-medium">Savings potential / yr</th>
              <th className="p-2 text-right font-medium">Investment required</th>
            </tr>
          </thead>
          <tbody>
            {list.map(([k, g]) => (
              <tr key={k} className="border-b border-border/50" data-testid="group-row">
                <td className="p-2 font-medium">{k}</td>
                <td className="num p-2 text-right">{g.hotels}</td>
                <td className="num p-2 text-right">{g.rooms.toLocaleString("en-US")}</td>
                <td className="num p-2 text-right">{usd(g.cost)}</td>
                <td className="num p-2 text-right">{g.area > 0 ? (g.site / g.area).toFixed(1) : "—"}</td>
                <td className="num p-2 text-right text-savings">{usd(g.potential)}</td>
                <td className="num p-2 text-right">{usd(g.investment)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-muted-foreground">Sums of each hotel's modeled figures; intensity is the group's site energy divided by its floor area.</p>
    </section>
  );
}
