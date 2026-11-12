import { useEffect, useMemo, useState } from "react";
import type { PropertySummary } from "@/engine/hotel";
import { hasWebGL } from "@/twin/parts/View3D";
import { MapFallback } from "./MapFallback";
import { MapLibreView } from "./MapLibreView";
import { PropertyCard } from "./PropertyCard";
import { MAP_METRICS, colorAt, metricColors, metricDef } from "./metrics";
import type { MapMetric } from "./metrics";

/**
 * The portfolio's city map: MapLibre with a free dark basemap when WebGL and the network allow, otherwise a drawn map of Chicago.
 * Markers are colored by the chosen metric; hovering or focusing a marker shows its card, clicking pins it.
 */
export function CityMap({ rows, onExplore, reduce }: { rows: PropertySummary[]; onExplore: (id: string) => void; reduce: boolean }) {
  const [metric, setMetric] = useState<MapMetric>("eui");
  const [hover, setHover] = useState<string | null>(null);
  const [pinned, setPinned] = useState<string | null>(null);
  // Decided after mount (the server renders the drawn map).
  const [useTiles, setUseTiles] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (hasWebGL()) setUseTiles(true);
  }, []);
  const colors = useMemo(() => metricColors(rows, metric), [rows, metric]);
  const def = metricDef(metric);
  const focusId = hover ?? pinned;
  const focus = rows.find((r) => r.id === focusId) ?? null;
  const values = rows.map(def.value);
  const tiles = useTiles && !failed;
  const props = { rows, colors, focusId, onHover: setHover, onSelect: (id: string) => setPinned((p) => (p === id ? null : id)), reduce };

  return (
    <section aria-label="City map" className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div role="radiogroup" aria-label="Color the hotels by" className="flex flex-wrap gap-1">
          {MAP_METRICS.map((m) => (
            <button
              key={m.id}
              type="button"
              role="radio"
              aria-checked={metric === m.id}
              onClick={() => setMetric(m.id)}
              className={`rounded-full border px-2.5 py-1 text-xs ${metric === m.id ? "border-primary bg-primary/15 text-foreground" : "border-glass-border text-muted-foreground hover:text-foreground"}`}
            >
              {m.label}
            </button>
          ))}
        </div>
        {useTiles && (
          <button type="button" className="text-xs text-muted-foreground underline-offset-2 hover:underline" onClick={() => setFailed((f) => !f)}>
            {failed ? "Try the street map" : "Use the simplified map"}
          </button>
        )}
      </div>
      <div className="relative h-[420px] overflow-hidden rounded-xl border border-glass-border bg-stage">
        {tiles ? <MapLibreView {...props} onFail={() => setFailed(true)} /> : <MapFallback {...props} />}
        {focus && (
          <div className="absolute left-3 top-3 z-10">
            <PropertyCard row={focus} onExplore={onExplore} {...(pinned === focus.id ? { onClose: () => setPinned(null) } : {})} />
          </div>
        )}
        <div className="pointer-events-none absolute bottom-3 left-3 z-10 rounded-lg border border-glass-border bg-popover/90 px-2.5 py-1.5 text-[11px]" data-testid="map-legend">
          <div className="font-medium">{def.label}</div>
          <div className="mt-1 flex items-center gap-2">
            <span className="num">{def.format(Math.min(...values))}</span>
            <span
              className="h-2 w-24 rounded-full"
              style={{ background: `linear-gradient(90deg, ${[0, 0.25, 0.5, 0.75, 1].map((t) => colorAt(def.kind, t)).join(", ")})` }}
              aria-hidden
            />
            <span className="num">{def.format(Math.max(...values))}</span>
          </div>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">{def.note} {!tiles && "Simplified map (the street map needs WebGL and a network connection); positions are approximate."}</p>
      <ul className="sr-only" aria-label="Hotels in the portfolio">
        {rows.map((r) => (
          <li key={r.id}>
            {r.name}, {r.neighborhood}: {def.label} {def.format(def.value(r))}.{" "}
            <button type="button" onClick={() => onExplore(r.id)}>Explore digital twin</button>
          </li>
        ))}
      </ul>
    </section>
  );
}

