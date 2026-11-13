import { ArrowRight, Building2, X } from "lucide-react";
import { UtilityBadge } from "@/utility/UtilityBadge";
import type { PropertySummary } from "@/engine/hotel";
import { Button } from "@/components/ui/button";
import { percent, usd } from "@/twin/format";
import { eui } from "./metrics";
import type { MapMetric } from "./metrics";

/** The card for the selected hotel on the map: headline figures from the engine and the way into its digital twin. */
export function PropertyCard({
  row,
  onExplore,
  onClose,
  color,
  rank,
  metric,
  onWhy,
}: {
  row: PropertySummary;
  onExplore: (id: string) => void;
  onClose?: () => void;
  color?: string | undefined;
  rank?: number | undefined;
  metric?: MapMetric | undefined;
  /** Opens the explanation of the investment priority ranking. */
  onWhy?: ((id: string) => void) | undefined;
}) {
  const accent = color ?? "var(--primary)";
  const stats: { id: MapMetric | "rooms"; label: string; value: string }[] = [
    { id: "cost", label: "Annual energy cost", value: usd(row.annual.cost) },
    { id: "eui", label: "Energy intensity", value: eui(row.siteEui) },
    { id: "potential", label: "Savings potential", value: row.potential ? `${usd(row.potential.annualSavings)} / yr` : "None found" },
    { id: "rooms", label: "Rooms", value: String(row.rooms) },
  ];
  const minor: [string, string][] = [
    ["Occupancy", percent(row.occupancy)],
    ["Annual energy", `${Math.round(row.annual.siteKBtu / 1000).toLocaleString("en-US")} MMBtu`],
    ["Investment priority", `${row.priorityScore} / 100`],
  ];
  return (
    <div
      className="w-full overflow-hidden rounded-2xl border border-glass-border bg-[oklch(0.18_0.04_263/0.95)] text-sm shadow-[0_18px_40px_-18px_rgb(0_0_0/0.9)] backdrop-blur sm:w-[300px]"
      data-testid="property-card"
      role="group"
      aria-label={`${row.name} summary`}
    >
      <div className="h-1 w-full" style={{ background: `linear-gradient(90deg, ${accent}, transparent)` }} aria-hidden />
      <div className="p-3.5">
        <div className="flex items-start gap-2.5">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl border-2" style={{ borderColor: accent, color: accent, boxShadow: `0 0 14px -2px ${accent}` }} aria-hidden>
            <Building2 className="size-4.5" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="font-semibold leading-tight">{row.name}</div>
            <div className="text-xs text-muted-foreground">{row.neighborhood}, {row.city} · {row.segment}</div>
            {row.brand && <div className="text-[11px] text-primary">{row.brand}{row.region ? ` · ${row.region}` : ""}</div>}
          </div>
          {onClose && (
            <button type="button" onClick={onClose} className="rounded-md p-1 text-muted-foreground hover:bg-white/5 hover:text-foreground" aria-label="Close card">
              <X className="size-3.5" />
            </button>
          )}
        </div>
        {rank !== undefined && <div className="mt-2 inline-flex rounded-full border border-primary/25 bg-primary/10 px-2 py-0.5 text-[10px] text-primary">#{rank} in the portfolio by the map's metric</div>}
        <dl className="mt-3 grid grid-cols-2 gap-2">
          {stats.map((s) => (
            <div key={s.id} className={`rounded-xl border px-2.5 py-2 ${s.id === metric ? "border-primary/40 bg-primary/10" : "border-glass-border bg-white/[0.02]"}`}>
              <dt className="text-[10px] text-muted-foreground">{s.label}</dt>
              <dd className="num mt-0.5 text-sm font-semibold">{s.value}</dd>
            </div>
          ))}
        </dl>
        <dl className="mt-2 space-y-0.5 text-[11px]">
          {minor.map(([k, v]) => (
            <div key={k} className="flex justify-between gap-2">
              <dt className="text-muted-foreground">
                {k}
                {k === "Investment priority" && onWhy && (
                  <button type="button" className="ml-1 text-primary hover:underline" onClick={() => onWhy(row.id)} data-testid="card-priority-why">Why?</button>
                )}
              </dt>
              <dd className="num">{v}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-2 text-[10px] text-muted-foreground">{row.synthetic ? "Demonstration property · synthetic data · modeled estimates" : "Your hotel · your inputs (defaults where blank) · modeled estimates"}<UtilityBadge propertyId={row.id} /></p>
        <Button size="sm" className="mt-2.5 w-full" onClick={() => onExplore(row.id)} data-testid={`explore-${row.id}`}>
          Explore hotel <ArrowRight />
        </Button>
      </div>
    </div>
  );
}
