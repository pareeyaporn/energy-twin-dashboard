import { ArrowRight, X } from "lucide-react";
import type { PropertySummary } from "@/engine/hotel";
import { Button } from "@/components/ui/button";
import { percent, usd } from "@/twin/format";
import { eui } from "./metrics";

/** The hover or click card for one property on the map. */
export function PropertyCard({ row, onExplore, onClose }: { row: PropertySummary; onExplore: (id: string) => void; onClose?: () => void }) {
  const items: [string, string][] = [
    ["Rooms", String(row.rooms)],
    ["Occupancy", percent(row.occupancy)],
    ["Annual energy", `${Math.round(row.annual.siteKBtu / 1000).toLocaleString("en-US")} MMBtu`],
    ["Annual energy cost", usd(row.annual.cost)],
    ["Energy intensity", eui(row.siteEui)],
    ["Savings potential", row.potential ? `${usd(row.potential.annualSavings)} / yr` : "None found"],
    ["Investment priority", `${row.priorityScore} / 100`],
  ];
  return (
    <div className="w-72 rounded-xl border border-glass-border bg-popover/95 p-3 text-sm shadow-xl backdrop-blur" data-testid="property-card" role="group" aria-label={`${row.name} summary`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="font-semibold leading-tight">{row.name}</div>
          <div className="text-xs text-muted-foreground">{row.neighborhood} · {row.segment}</div>
          {row.brand && <div className="text-[11px] text-primary">{row.brand}{row.region ? ` · ${row.region}` : ""}</div>}
        </div>
        {onClose && (
          <button type="button" onClick={onClose} className="rounded p-1 text-muted-foreground hover:bg-accent" aria-label="Close card">
            <X className="size-3.5" />
          </button>
        )}
      </div>
      <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
        {items.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-muted-foreground">{k}</dt>
            <dd className="num text-right">{v}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-2 text-[11px] text-muted-foreground">{row.synthetic ? "Demonstration property · synthetic data · modeled estimates" : "Your hotel · your inputs (defaults where blank) · modeled estimates"}</p>
      <Button size="sm" className="mt-2 w-full" onClick={() => onExplore(row.id)} data-testid={`explore-${row.id}`}>
        Explore digital twin <ArrowRight />
      </Button>
    </div>
  );
}
