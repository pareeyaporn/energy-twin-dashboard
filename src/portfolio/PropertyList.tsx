import { ChevronDown, ListOrdered } from "lucide-react";
import type { PropertySummary } from "@/engine/hotel";
import type { MetricDef } from "./metrics";

/** Hotels ranked by the map's metric (highest first). Hovering highlights a hotel's marker; clicking selects it and flies the map to it. */
export function PropertyList({
  ranked,
  def,
  colors,
  hoverId,
  selectedId,
  open,
  onToggle,
  onHover,
  onPick,
}: {
  ranked: PropertySummary[];
  def: MetricDef;
  colors: Record<string, string>;
  hoverId: string | null;
  selectedId: string | null;
  open: boolean;
  onToggle: () => void;
  onHover: (id: string | null) => void;
  onPick: (id: string) => void;
}) {
  const values = ranked.map(def.value);
  const max = Math.max(0, ...values.filter(Number.isFinite));
  return (
    <div
      className="overflow-hidden rounded-xl border border-glass-border bg-[oklch(0.18_0.04_263/0.92)] shadow-[0_12px_32px_-16px_rgb(0_0_0/0.9)] backdrop-blur lg:flex lg:max-h-full lg:flex-col"
      data-testid="property-list"
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls="portfolio-property-list"
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left hover:bg-white/[0.03]"
        data-testid="property-list-toggle"
      >
        <ListOrdered className="size-4 text-primary" aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="block text-xs font-semibold">Hotels · {ranked.length}</span>
          <span className="block truncate text-[10px] text-muted-foreground">Ranked by {def.label.toLowerCase()}, highest first</span>
        </span>
        <ChevronDown className={`size-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} aria-hidden />
      </button>
      {open && (
        <ol id="portfolio-property-list" className="min-h-0 space-y-0.5 overflow-y-auto border-t border-glass-border p-1.5" aria-label={`Hotels ranked by ${def.label.toLowerCase()}`}>
          {ranked.map((r, i) => {
            const v = values[i]!;
            const on = r.id === selectedId;
            const hot = r.id === hoverId;
            const c = colors[r.id] ?? "var(--primary)";
            return (
              <li key={r.id}>
                <button
                  type="button"
                  data-testid="property-list-item"
                  data-id={r.id}
                  aria-current={on ? "true" : undefined}
                  onMouseEnter={() => onHover(r.id)}
                  onMouseLeave={() => onHover(null)}
                  onFocus={() => onHover(r.id)}
                  onBlur={() => onHover(null)}
                  onClick={() => onPick(r.id)}
                  className={`group flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors ${on ? "bg-primary/15 ring-1 ring-primary/40" : hot ? "bg-white/[0.05]" : "hover:bg-white/[0.04]"}`}
                >
                  <span className="num w-4 shrink-0 text-right text-[10px] text-muted-foreground">{i + 1}</span>
                  <span className="size-2 shrink-0 rounded-full" style={{ background: c, boxShadow: `0 0 8px ${c}` }} aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-medium">{r.name}</span>
                    <span className="mt-0.5 flex items-center gap-2">
                      <span className="block h-1 flex-1 overflow-hidden rounded-full bg-white/[0.06]" aria-hidden>
                        <span className="block h-full rounded-full" style={{ width: `${max > 0 ? Math.max(4, (v / max) * 100) : 0}%`, background: c }} />
                      </span>
                      <span className="truncate text-[10px] text-muted-foreground">{r.neighborhood}</span>
                    </span>
                  </span>
                  <span className="num shrink-0 text-[11px] font-medium">{def.format(v)}</span>
                </button>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
