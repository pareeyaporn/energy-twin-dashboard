import { useState } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import type { PropertySummary } from "@/engine/hotel";
import { percent, usd } from "@/twin/format";
import { HVAC_LABEL } from "./metrics";
import { OWNERSHIP_LABEL } from "@/store/userHotels";

type Col = {
  id: string;
  label: string;
  value: (r: PropertySummary) => number | string;
  show: (r: PropertySummary) => string;
  numeric?: boolean;
};

const COLS: Col[] = [
  { id: "name", label: "Property", value: (r) => r.name, show: (r) => r.name },
  { id: "location", label: "Location", value: (r) => r.neighborhood, show: (r) => r.neighborhood },
  { id: "brand", label: "Brand · ownership", value: (r) => r.brand ?? "", show: (r) => [r.brand, r.ownership ? OWNERSHIP_LABEL[r.ownership] : undefined].filter(Boolean).join(" · ") || "—" },
  { id: "rooms", label: "Rooms", value: (r) => r.rooms, show: (r) => String(r.rooms), numeric: true },
  { id: "area", label: "Floor area", value: (r) => r.floorAreaSqft, show: (r) => `${Math.round(r.floorAreaSqft).toLocaleString("en-US")} ft²`, numeric: true },
  { id: "hvac", label: "HVAC", value: (r) => r.hvacType, show: (r) => HVAC_LABEL[r.hvacType] ?? r.hvacType },
  { id: "occ", label: "Occupancy", value: (r) => r.occupancy, show: (r) => percent(r.occupancy), numeric: true },
  { id: "cost", label: "Energy cost / yr", value: (r) => r.annual.cost, show: (r) => usd(r.annual.cost), numeric: true },
  { id: "eui", label: "Intensity (kBtu/ft²)", value: (r) => r.siteEui, show: (r) => r.siteEui.toFixed(1), numeric: true },
  { id: "pot", label: "Savings potential / yr", value: (r) => r.potential?.annualSavings ?? 0, show: (r) => (r.potential ? usd(r.potential.annualSavings) : "—"), numeric: true },
  { id: "inv", label: "Investment required", value: (r) => r.potential?.netInvestment ?? 0, show: (r) => (r.potential ? usd(r.potential.netInvestment) : "—"), numeric: true },
  { id: "pay", label: "Payback", value: (r) => r.potential?.paybackYears ?? Infinity, show: (r) => (r.potential?.paybackYears != null ? `${r.potential.paybackYears.toFixed(1)} yr` : "—"), numeric: true },
  { id: "prio", label: "Priority", value: (r) => r.priorityScore, show: (r) => `${r.priorityScore}`, numeric: true },
];

/** Every property side by side; click a header to sort. */
export function PortfolioTable({ rows, onExplore, onRemove }: { rows: PropertySummary[]; onExplore: (id: string) => void; onRemove?: (id: string) => void }) {
  const [sort, setSort] = useState<{ id: string; dir: 1 | -1 }>({ id: "prio", dir: -1 });
  const col = COLS.find((c) => c.id === sort.id)!;
  const sorted = [...rows].sort((a, b) => {
    const x = col.value(a);
    const y = col.value(b);
    const c = typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y));
    return c * sort.dir || a.name.localeCompare(b.name);
  });
  return (
    <div className="table-scroll overflow-x-auto rounded-xl border border-glass-border">
      <table className="sticky-first-column w-full min-w-[1080px] text-xs" data-testid="portfolio-table">
        <caption className="sr-only">Portfolio comparison (synthetic demonstration properties, modeled estimates)</caption>
        <thead>
          <tr className="border-b border-border text-muted-foreground">
            {COLS.map((c) => {
              const on = c.id === sort.id;
              return (
                <th key={c.id} scope="col" aria-sort={on ? (sort.dir === 1 ? "ascending" : "descending") : "none"} className={`p-2 font-medium ${c.numeric ? "text-right" : "text-left"}`}>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 hover:text-foreground"
                    onClick={() => setSort((s) => ({ id: c.id, dir: s.id === c.id ? (s.dir === 1 ? -1 : 1) : c.numeric ? -1 : 1 }))}
                    data-testid={`sort-${c.id}`}
                  >
                    {c.label}
                    {on && (sort.dir === 1 ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />)}
                  </button>
                </th>
              );
            })}
            <th className="p-2"><span className="sr-only">Open</span></th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => (
            <tr key={r.id} className="border-b border-border/50 hover:bg-accent/30" data-testid="portfolio-row">
              {COLS.map((c) => (
                <td key={c.id} className={`p-2 ${c.numeric ? "num text-right" : ""} ${c.id === "name" ? "font-medium" : ""}`}>
                  {c.show(r)}
                  {c.id === "name" && !r.synthetic && <span className="ml-1.5 rounded-full border border-primary/40 px-1.5 text-[10px] font-normal text-primary">Your hotel</span>}
                </td>
              ))}
              <td className="p-2 text-right">
                <button type="button" className="whitespace-nowrap text-primary hover:underline" onClick={() => onExplore(r.id)}>Open twin</button>
                {!r.synthetic && onRemove && (
                  <button type="button" className="ml-2 whitespace-nowrap text-muted-foreground hover:text-loss hover:underline" onClick={() => onRemove(r.id)} aria-label={`Remove ${r.name}`}>Remove</button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
