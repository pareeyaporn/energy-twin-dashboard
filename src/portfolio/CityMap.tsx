import { useEffect, useMemo, useRef, useState } from "react";
import { BarChart3, DollarSign, Gauge, Maximize2, PiggyBank, Target } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { PropertySummary } from "@/engine/hotel";
import { hasWebGL } from "@/twin/parts/View3D";
import { motionAllowed } from "@/twin/useCountUp";
import { useTwin } from "@/store/useTwin";
import { allInChicago, cityGroups, cityValue } from "./cities";
import { MapFallback } from "./MapFallback";
import { MultiCityFallback } from "./MultiCityFallback";
import { MapLegend } from "./MapLegend";
import { MapLibreView } from "./MapLibreView";
import { PropertyCard } from "./PropertyCard";
import { PropertyList } from "./PropertyList";
import { MAP_METRICS, metricColors, metricDef } from "./metrics";
import type { MapMetric } from "./metrics";
import type { MapViewProps } from "./mapTypes";
import { loadMapMode, saveMapMode } from "./camera3d";
import type { MapMode } from "./camera3d";

const ICONS: Record<MapMetric, LucideIcon> = { cost: DollarSign, eui: Gauge, potential: PiggyBank, priority: Target };

/** Hotels ordered by a metric, highest first (ties by name), as shown in the list and the markers' rank badges. */
export function rankBy(rows: PropertySummary[], metric: MapMetric): PropertySummary[] {
  const def = metricDef(metric);
  return [...rows].sort((a, b) => def.value(b) - def.value(a) || a.name.localeCompare(b.name));
}

/**
 * The portfolio's city map, the chain's command center: the street map (MapLibre, a free dark basemap repainted in navy) when WebGL and
 * the network allow, otherwise a drawn map in the same look (Chicago; a schematic with one panel per city when the hotels are in several
 * cities). Markers are colored and ranked by the chosen metric; hovering shows a tooltip, clicking selects a hotel (card, fly-to); the
 * list beside the map ranks the hotels and drives the same selection. With several cities, chips zoom to a city and, zoomed out, the
 * street map shows one marker per city. The metric, the selected hotel and the list state live in the store (`portfolioView`), so they
 * are the same after visiting a hotel and coming back. Display only: every value comes from the engine through the store.
 */
export function CityMap({ rows, onExplore, reduce: reduceEffects, onWhy }: { rows: PropertySummary[]; onExplore: (id: string) => void; reduce: boolean; onWhy?: (id: string) => void }) {
  // Calm: the app's Reduce effects setting or the system's reduced-motion preference (no pulses, jumps instead of flights).
  const [motionOk, setMotionOk] = useState(false);
  useEffect(() => {
    setMotionOk(motionAllowed());
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia("(prefers-reduced-motion: no-preference)");
    const on = () => setMotionOk(mq.matches);
    mq.addEventListener?.("change", on);
    return () => mq.removeEventListener?.("change", on);
  }, []);
  const reduce = reduceEffects || !motionOk;
  const view = useTwin((s) => s.portfolioView);
  const setView = useTwin((s) => s.setPortfolioView);
  const metric: MapMetric = view.metric;
  const setMetric = (m: MapMetric) => setView({ metric: m });
  const [hover, setHover] = useState<string | null>(null);
  const pinned = view.selectedId;
  const setPinned = (id: string | null) => setView({ selectedId: id });
  const listOpen = view.listOpen;
  const setListOpen = (f: (o: boolean) => boolean) => setView({ listOpen: f(listOpen) });
  const [flyTo, setFlyTo] = useState<{ id: string; n: number } | null>(null);
  const [fit, setFit] = useState<{ n: number; ids: string[] | null; city: string | null }>({ n: 0, ids: null, city: null });
  const fitTo = (city: string | null) =>
    setFit((f) => ({ n: f.n + 1, ids: city ? rows.filter((r) => r.city === city).map((r) => r.id) : null, city }));
  const cities = useMemo(() => cityGroups(rows), [rows]);
  const multi = cities.length > 1;
  // Coming back from a hotel's breadcrumb city link: zoom to that city once the map is there.
  const focused = useRef(false);
  useEffect(() => {
    if (focused.current || !view.focusCity) return;
    focused.current = true;
    const city = view.focusCity;
    const t = setTimeout(() => {
      fitTo(city);
      setView({ focusCity: null });
    }, 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view.focusCity]);
  // A selected hotel that is no longer shown (filters, another organization) is let go.
  useEffect(() => {
    if (pinned && !rows.some((r) => r.id === pinned)) setPinned(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, pinned]);
  // Decided after mount (the server renders the drawn map).
  const [useTiles, setUseTiles] = useState(false);
  const [failed, setFailed] = useState(false);
  // 2D or 3D street map (a view preference in local storage; 3D by default). Null until the style says whether it has buildings to extrude.
  const [mode, setModeState] = useState<MapMode>("3d");
  const [buildingsOk, setBuildingsOk] = useState<boolean | null>(null);
  const [columns, setColumns] = useState(false);
  useEffect(() => {
    if (hasWebGL()) setUseTiles(true);
    setModeState(loadMapMode());
  }, []);
  const setMode = (m: MapMode) => {
    setModeState(m);
    saveMapMode(m);
  };
  const colors = useMemo(() => metricColors(rows, metric), [rows, metric]);
  const def = metricDef(metric);
  const ranked = useMemo(() => rankBy(rows, metric), [rows, metric]);
  const ranks = useMemo(() => Object.fromEntries(ranked.map((r, i) => [r.id, i + 1])), [ranked]);
  const selected = rows.find((r) => r.id === pinned) ?? null;
  const tiles = useTiles && !failed;
  const three = tiles && mode === "3d" && buildingsOk !== false;
  const values = useMemo(() => Object.fromEntries(rows.map((r) => [r.id, def.value(r)])), [rows, def]);
  // The drawn map for several cities is a schematic of panels: its legend goes below the map so it never covers a panel's hotels.
  const panels = !tiles && !allInChicago(rows);
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
    fitNonce: fit.n,
    fitIds: fit.ids,
    cities,
    cityValueText: (city) => {
      const g = cities.find((x) => x.city === city);
      return g ? def.format(cityValue(g, metric)) : "";
    },
    onPickCity: (city) => fitTo(city),
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
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {tiles && (
            <div
              role="radiogroup"
              aria-label="Map view"
              className="inline-flex gap-0.5 rounded-lg border border-glass-border bg-[oklch(0.18_0.04_263/0.7)] p-0.5"
              data-testid="map-mode-toggle"
            >
              {(["2d", "3d"] as const).map((m) => {
                const on = (m === "3d") === three;
                const disabled = m === "3d" && buildingsOk === false;
                return (
                  <button
                    key={m}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    disabled={disabled}
                    title={disabled ? "3D buildings are not available for this basemap; showing the flat map" : m === "3d" ? "Tilted view with 3D buildings; drag with the right mouse button or two fingers to rotate and tilt" : "Flat plan view, north up"}
                    onClick={() => setMode(m)}
                    className={`rounded-md px-2 py-1 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${on ? "bg-primary/15 text-primary shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--primary)_40%,transparent)]" : "text-muted-foreground hover:text-foreground"}`}
                    data-testid={`map-mode-${m}`}
                  >
                    {m.toUpperCase()}
                  </button>
                );
              })}
            </div>
          )}
          {three && (
            <button
              type="button"
              aria-pressed={columns}
              onClick={() => setColumns((c) => !c)}
              title="Columns above the hotels, heights proportional to the map's metric"
              className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs transition-colors ${columns ? "border-primary/50 bg-primary/10 text-primary" : "border-glass-border text-muted-foreground hover:border-primary/40 hover:text-foreground"}`}
              data-testid="map-columns"
            >
              <BarChart3 className="size-3.5" aria-hidden /> Columns
            </button>
          )}
          <button
            type="button"
            onClick={() => fitTo(null)}
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

      {multi && (
        <div role="group" aria-label="Zoom to a city" className="flex flex-wrap items-center gap-1.5" data-testid="map-city-chips">
          <span className="text-[11px] text-muted-foreground">Cities:</span>
          {cities.map((g) => (
            <button
              key={g.city}
              type="button"
              onClick={() => fitTo(g.city)}
              aria-pressed={fit.city === g.city}
              className={`rounded-full border px-2.5 py-0.5 text-xs transition-colors ${fit.city === g.city ? "border-primary bg-primary/15 text-primary" : "border-glass-border text-muted-foreground hover:border-primary/40 hover:text-foreground"}`}
              data-testid={`map-city-${g.city}`}
            >
              {g.city} <span className="num text-[10px] opacity-75">· {g.hotels}</span>
            </button>
          ))}
        </div>
      )}

      <div className="relative">
        <div className="relative h-[400px] overflow-hidden rounded-2xl border border-glass-border bg-[#060e1d] shadow-[0_24px_60px_-30px_rgb(0_0_0/0.9),inset_0_0_0_1px_color-mix(in_oklab,var(--primary)_8%,transparent)] sm:h-[480px] lg:h-[540px]">
          {tiles ? (
            <MapLibreView {...props} mode={mode} columns={columns && three} values={values} onFail={() => setFailed(true)} onBuildings3D={setBuildingsOk} />
          ) : !panels ? (
            <MapFallback {...props} />
          ) : (
            <MultiCityFallback {...props} selectedOffset={!!selected} />
          )}
          {/* A soft edge vignette keeps the overlays readable without hiding the map. */}
          <div aria-hidden className="pointer-events-none absolute inset-0 z-[5] rounded-2xl shadow-[inset_0_0_80px_10px_rgb(6_14_29/0.75)]" />
          {!panels && (
            <div className="absolute bottom-3 left-3 z-10">
              <MapLegend def={def} values={rows.map(def.value)} columns={columns && three} />
            </div>
          )}
        </div>
        {panels && (
          <div className="mt-3">
            <MapLegend def={def} values={rows.map(def.value)} />
          </div>
        )}
        {selected && (
          <div
            key={selected.id}
            className={`mt-3 sm:absolute sm:left-3 sm:top-3 sm:z-20 sm:mt-0 ${reduce ? "" : "animate-in fade-in-0 slide-in-from-left-2 duration-300"}`}
            data-testid="map-card-slot"
          >
            <PropertyCard row={selected} onExplore={onExplore} onClose={() => setPinned(null)} color={colors[selected.id]} rank={ranks[selected.id]} metric={metric} {...(onWhy ? { onWhy } : {})} />
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
        {def.note}{" "}
        {!tiles &&
          (allInChicago(rows)
            ? "Simplified map (the street map needs WebGL and a network connection); geography is approximate, hotel positions are exact."
            : "Simplified schematic (the street map needs WebGL and a network connection): one panel per city.")}
        {multi && tiles && " Zoomed out, each city shows as one marker; click it or a city chip to zoom in."}
        {three &&
          " 3D buildings: OpenStreetMap footprints and heights from the basemap's tiles (approximate; buildings without height data are drawn low, in a dimmer navy). Right-drag or two fingers to rotate and tilt."}
        {tiles && buildingsOk === false && " 3D buildings are not available from the basemap right now; showing the flat street map."}
        {columns && three && " Columns: height proportional to the metric (the tallest is the highest hotel), not a building height."}
        {" "}Hotels close together fan out so each can be selected; a dot marks the true location.
      </p>
      <ul className="sr-only" aria-label="Hotels in the portfolio">
        {ranked.map((r) => (
          <li key={r.id}>
            {r.name}, {r.neighborhood}, {r.city}: {def.label} {def.format(def.value(r))}.{" "}
            <button type="button" onClick={() => onExplore(r.id)}>Explore digital twin</button>
          </li>
        ))}
      </ul>
    </section>
  );
}
