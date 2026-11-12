import { useEffect, useMemo, useState } from "react";
import { DollarSign, Gauge, Maximize2, PiggyBank, Target } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { PropertySummary } from "@/engine/hotel";
import { hasWebGL } from "@/twin/parts/View3D";
import { MapFallback } from "./MapFallback";
import { MapLegend } from "./MapLegend";
import { MapLibreView } from "./MapLibreView";
import { PropertyCard } from "./PropertyCard";
import { PropertyList } from "./PropertyList";
import { MAP_METRICS, metricColors, metricDef } from "./metrics";
import type { MapMetric } from "./metrics";
import type { MapViewProps } from "./mapTypes";

const ICONS: Record<MapMetric, LucideIcon> = { cost: DollarSign, eui: Gauge, potential: PiggyBank, priority: Target };

/** Hotels ordered by a metric, highest first (ties by name), as shown in the list and the markers' rank badges. */
export function rankBy(rows: PropertySummary[], metric: MapMetric): PropertySummary[] {
  const def = metricDef(metric);
  return [...rows].sort((a, b) => def.value(b) - def.value(a) || a.name.localeCompare(b.name));
}

/**
 * The portfolio's city map, the chain's command center: the street map (MapLibre, a free dark basemap repainted in navy) when WebGL and
 * the network allow, otherwise a drawn map of Chicago in the same look. Markers are colored and ranked by the chosen metric; hovering
 * shows a tooltip, clicking selects a hotel (card, fly-to); the list beside the map ranks the hotels and drives the same selection.
 * Display only: every value comes from the engine through the store.
 */
export function CityMap({ rows, onExplore, reduce }: { rows: PropertySummary[]; onExplore: (id: string) => void; reduce: boolean }) {
  const [metric, setMetric] = useState<MapMetric>("eui");
  const [hover, setHover] = useState<string | null>(null);
  const [pinned, setPinned] = useState<string | null>(null);
  const [listOpen, setListOpen] = useState(true);
  const [flyTo, setFlyTo] = useState<{ id: string; n: number } | null>(null);
  const [fitNonce, setFitNonce] = useState(0);
  // Decided after mount (the server renders the drawn map).
  const [useTiles, setUseTiles] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (hasWebGL()) setUseTiles(true);
  }, []);
  const colors = useMemo(() => metricColors(rows, metric), [rows, metric]);
  const def = metricDef(metric);
  const ranked = useMemo(() => rankBy(rows, metric), [rows, metric]);
  const ranks = useMemo(() => Object.fromEntries(ranked.map((r, i) => [r.id, i + 1])), [ranked]);
  const selected = rows.find((r) => r.id === pinned) ?? null;
  const tiles = useTiles && !failed;
  const fly = (id: string) => setFlyTo((f) => ({ id, n: (f?.n ?? 0) + 1 }));

  const props: MapViewProps = {
    rows,
    colors,
    ranks,
    hoverId: hover,
    selectedId: selected?.id ?? null,
    metricLabel: def.label,
    valueText: (id) => {
      const r = rows.find((x) => x.id === id);
      return r ? def.format(def.value(r)) : "";
    },
    onHover: setHover,
    onSelect: (id) => {
      const next = pinned === id ? null : id;
      setPinned(next);
      if (next) fly(next);
    },
    onBackground: () => setPinned(null),
    flyTo,
    fitNonce,
    reduce,
  };

  return (
    <section
      aria-label="City map"
      className="space-y-3"
      onKeyDown={(e) => {
        if (e.key === "Escape" && pinned) {
          e.stopPropagation();
          setPinned(null);
        }
      }}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div
          role="radiogroup"
          aria-label="Color the hotels by"
          className="inline-flex max-w-full gap-0.5 overflow-x-auto rounded-xl border border-glass-border bg-[oklch(0.18_0.04_263/0.7)] p-1 shadow-[inset_0_1px_0_rgb(255_255_255/0.03)]"
          data-testid="map-metric-toolbar"
        >
          {MAP_METRICS.map((m) => {
            const Icon = ICONS[m.id];
            const on = metric === m.id;
            return (
              <button
                key={m.id}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => setMetric(m.id)}
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${on ? "bg-primary/15 text-primary shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--primary)_40%,transparent)]" : "text-muted-foreground hover:bg-white/[0.04] hover:text-foreground"}`}
                data-testid={`map-metric-${m.id}`}
              >
                <Icon className="size-3.5" aria-hidden />
                <span className="sm:hidden">{m.short}</span>
                <span className="hidden sm:inline">{m.label}</span>
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setFitNonce((n) => n + 1)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-glass-border px-2.5 py-1.5 text-xs text-muted-foreground hover:border-primary/40 hover:text-foreground"
            data-testid="map-fit"
          >
            <Maximize2 className="size-3.5" aria-hidden /> Show all hotels
          </button>
          {useTiles && (
            <button type="button" className="text-xs text-muted-foreground underline-offset-2 hover:underline" onClick={() => setFailed((f) => !f)}>
              {failed ? "Try the street map" : "Use the simplified map"}
            </button>
          )}
        </div>
      </div>

      <div className="relative">
        <div className="relative h-[400px] overflow-hidden rounded-2xl border border-glass-border bg-[#060e1d] shadow-[0_24px_60px_-30px_rgb(0_0_0/0.9),inset_0_0_0_1px_color-mix(in_oklab,var(--primary)_8%,transparent)] sm:h-[480px] lg:h-[540px]">
          {tiles ? <MapLibreView {...props} onFail={() => setFailed(true)} /> : <MapFallback {...props} />}
          {/* A soft edge vignette keeps the overlays readable without hiding the map. */}
          <div aria-hidden className="pointer-events-none absolute inset-0 z-[5] rounded-2xl shadow-[inset_0_0_80px_10px_rgb(6_14_29/0.75)]" />
          <div className="absolute bottom-3 left-3 z-10">
            <MapLegend def={def} values={rows.map(def.value)} />
          </div>
        </div>
        {selected && (
          <div className="mt-3 sm:absolute sm:left-3 sm:top-3 sm:z-20 sm:mt-0" data-testid="map-card-slot">
            <PropertyCard row={selected} onExplore={onExplore} onClose={() => setPinned(null)} color={colors[selected.id]} rank={ranks[selected.id]} metric={metric} />
          </div>
        )}
        <div className="mt-3 lg:absolute lg:right-3 lg:top-3 lg:z-20 lg:mt-0 lg:flex lg:max-h-[calc(100%-7.5rem)] lg:w-72 lg:flex-col">
          <PropertyList
            ranked={ranked}
            def={def}
            colors={colors}
            hoverId={hover}
            selectedId={selected?.id ?? null}
            open={listOpen}
            onToggle={() => setListOpen((o) => !o)}
            onHover={setHover}
            onPick={(id) => {
              setPinned(id);
              fly(id);
            }}
          />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        {def.note} {!tiles && "Simplified map (the street map needs WebGL and a network connection); geography is approximate, hotel positions are exact."}
        {" "}Hotels close together fan out so each can be selected; a dot marks the true location.
      </p>
      <ul className="sr-only" aria-label="Hotels in the portfolio">
        {ranked.map((r) => (
          <li key={r.id}>
            {r.name}, {r.neighborhood}: {def.label} {def.format(def.value(r))}.{" "}
            <button type="button" onClick={() => onExplore(r.id)}>Explore digital twin</button>
          </li>
        ))}
      </ul>
    </section>
  );
}
