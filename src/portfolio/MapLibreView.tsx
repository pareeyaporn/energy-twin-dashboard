import { useEffect, useRef } from "react";
import type { Map as MlMap, Marker } from "maplibre-gl";
import type { PropertySummary } from "@/engine/hotel";

/** Free dark basemap, no API key (attribution shown on the map). */
export const MAP_STYLE_URL = "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";
const LOAD_TIMEOUT_MS = 8000;

/**
 * The MapLibre city map, loaded only in the browser. Calls `onFail` if the library, WebGL or the map style cannot load, so the
 * page can show the drawn fallback map instead.
 */
export function MapLibreView({
  rows,
  colors,
  focusId,
  onHover,
  onSelect,
  onFail,
  reduce,
}: {
  rows: PropertySummary[];
  colors: Record<string, string>;
  focusId: string | null;
  onHover: (id: string | null) => void;
  onSelect: (id: string) => void;
  onFail: () => void;
  reduce: boolean;
}) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<MlMap | null>(null);
  const markers = useRef<Map<string, { marker: Marker; el: HTMLButtonElement }>>(new Map());
  const handlers = useRef({ onHover, onSelect, onFail });
  handlers.current = { onHover, onSelect, onFail };
  const lib = useRef<typeof import("maplibre-gl") | null>(null);
  const rowsRef = useRef(rows);
  rowsRef.current = rows;

  /** Adds a marker for each hotel that has none and removes markers of hotels no longer listed (a hotel added or removed). */
  const syncMarkers = () => {
    const m = map.current;
    const L = lib.current;
    if (!m || !L) return;
    const ids = new Set(rowsRef.current.map((r) => r.id));
    for (const [id, { marker }] of markers.current)
      if (!ids.has(id)) {
        marker.remove();
        markers.current.delete(id);
      }
    for (const r of rowsRef.current) {
      if (markers.current.has(r.id)) continue;
      const el = document.createElement("button");
      el.type = "button";
      el.style.cssText = `width:16px;height:16px;padding:0;border-radius:9999px;border:2px solid ${r.synthetic ? "var(--background)" : "var(--foreground)"};cursor:pointer;`;
      el.setAttribute("aria-label", `${r.name}, ${r.neighborhood}`);
      el.dataset["testid"] = `marker-${r.id}`;
      el.addEventListener("mouseenter", () => handlers.current.onHover(r.id));
      el.addEventListener("mouseleave", () => handlers.current.onHover(null));
      el.addEventListener("focus", () => handlers.current.onHover(r.id));
      el.addEventListener("blur", () => handlers.current.onHover(null));
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        handlers.current.onSelect(r.id);
      });
      const marker = new L.Marker({ element: el }).setLngLat([r.lng, r.lat]).addTo(m);
      markers.current.set(r.id, { marker, el });
    }
  };
  const idsKey = rows.map((r) => r.id).join("|");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => syncMarkers(), [idsKey]);

  // Create the map once.
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    (async () => {
      try {
        const mod = (await import("maplibre-gl")).default;
        await import("maplibre-gl/dist/maplibre-gl.css");
        if (cancelled || !box.current) return;
        const m = new mod.Map({
          container: box.current,
          style: MAP_STYLE_URL,
          bounds: boundsOf(rows),
          fitBoundsOptions: { padding: 60 },
          attributionControl: { compact: true },
          fadeDuration: reduce ? 0 : 300,
        });
        map.current = m;
        m.addControl(new mod.NavigationControl({ showCompass: false }), "top-right");
        let loaded = false;
        timer = setTimeout(() => !loaded && handlers.current.onFail(), LOAD_TIMEOUT_MS);
        m.on("load", () => {
          loaded = true;
        });
        m.on("error", () => {
          if (!loaded) handlers.current.onFail();
        });
        lib.current = mod;
        syncMarkers();
      } catch {
        if (!cancelled) handlers.current.onFail();
      }
    })();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      markers.current.clear();
      map.current?.remove();
      map.current = null;
    };
    // The map is created once; markers are restyled below when the metric or focus changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Restyle markers (color by metric, focus ring, glow unless effects are reduced).
  useEffect(() => {
    for (const [id, { el }] of markers.current) {
      const c = colors[id] ?? "var(--primary)";
      const on = id === focusId;
      el.style.transition = reduce ? "none" : "background 450ms ease, box-shadow 450ms ease";
      el.style.background = c;
      el.style.boxShadow = reduce ? "none" : `0 0 0 ${on ? 8 : 5}px color-mix(in oklab, ${c} 30%, transparent), 0 0 18px 4px color-mix(in oklab, ${c} 45%, transparent)`;
      el.style.outline = on ? "2px solid var(--foreground)" : "none";
      el.style.outlineOffset = "3px";
      el.setAttribute("aria-pressed", on ? "true" : "false");
    }
  });

  return <div ref={box} className="h-full w-full" data-testid="maplibre-map" />;
}

function boundsOf(rows: PropertySummary[]): [[number, number], [number, number]] {
  const lngs = rows.map((r) => r.lng);
  const lats = rows.map((r) => r.lat);
  return [
    [Math.min(...lngs), Math.min(...lats)],
    [Math.max(...lngs), Math.max(...lats)],
  ];
}
