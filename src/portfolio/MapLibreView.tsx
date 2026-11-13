import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Map as MlMap, Marker } from "maplibre-gl";
import type { PropertySummary } from "@/engine/hotel";
import { CityCluster } from "./CityCluster";
import { HotelMarker } from "./HotelMarker";
import { useTwin } from "@/store/useTwin";
import { fitPadding, overlayPadding } from "./mapTypes";
import type { MapViewProps } from "./mapTypes";
import { spreadOffsets } from "./spread";
import type { Offsets } from "./spread";

/** Free dark basemap, no API key (attribution shown on the map). Restyled after load (`restyleBasemap`). */
export const MAP_STYLE_URL = "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";
const LOAD_TIMEOUT_MS = 8000;
/** Below this zoom, with hotels in several cities, each city shows as one marker (the hotels of a city would overlap). */
export const CITY_CLUSTER_ZOOM = 7;

/** The navy palette the basemap is repainted with (see docs/17). */
export const BASEMAP = {
  background: "#060e1d",
  land: "#0a1426",
  park: "#0b1a2a",
  water: "#0e2c50",
  waterShadow: "#0a1f39",
  waterway: "#123760",
  building: "#0d1a2e",
  roadMajor: "#21324d",
  roadMinor: "#142139",
  boundary: "#1c2a43",
  label: "#5a6e8e",
  labelHalo: "#060e1d",
};

/**
 * Repaints Carto's dark-matter style in Energy Twin's navy: a clearly blue lake, muted roads, quiet labels, no points of interest, so the
 * hotel markers are what stands out. Rules match layer ids and types, so they survive small changes to the upstream style.
 */
export function restyleBasemap(m: MlMap): void {
  const set = (id: string, prop: string, value: unknown) => {
    try {
      m.setPaintProperty(id, prop, value);
    } catch {
      /* the layer lacks that property */
    }
  };
  const hide = (id: string) => {
    try {
      m.setLayoutProperty(id, "visibility", "none");
    } catch {
      /* ignore */
    }
  };
  for (const layer of m.getStyle()?.layers ?? []) {
    const id = layer.id;
    const t = layer.type;
    if (t === "background") set(id, "background-color", BASEMAP.background);
    else if (t === "fill" && /water_shadow/.test(id)) set(id, "fill-color", BASEMAP.waterShadow);
    else if (t === "fill" && /water/.test(id)) {
      set(id, "fill-color", BASEMAP.water);
      set(id, "fill-opacity", 1);
    } else if (t === "fill" && /park|nature|wood|grass/.test(id)) set(id, "fill-color", BASEMAP.park);
    else if (t === "fill" && /land|residential/.test(id)) set(id, "fill-color", BASEMAP.land);
    else if (t === "fill" && /building/.test(id)) {
      set(id, "fill-color", BASEMAP.building);
      set(id, "fill-outline-color", BASEMAP.building);
    } else if (t === "fill" && /aeroway/.test(id)) set(id, "fill-color", BASEMAP.roadMinor);
    else if (t === "line" && /waterway|river|canal/.test(id)) set(id, "line-color", BASEMAP.waterway);
    else if (t === "line" && /boundary/.test(id)) {
      set(id, "line-color", BASEMAP.boundary);
      set(id, "line-opacity", 0.6);
    } else if (t === "line" && /road|highway|motorway|trunk|primary|secondary|tertiary|street|bridge|tunnel|rail|path|service|aeroway/.test(id)) {
      set(id, "line-color", /motorway|trunk|primary|highway/.test(id) ? BASEMAP.roadMajor : BASEMAP.roadMinor);
      set(id, "line-opacity", /rail|path|service/.test(id) ? 0.45 : 0.9);
    } else if (t === "symbol") {
      if (/poi|housenumber|roadname|road_|shield|oneway|transit|rail|aeroway|water|ocean|lake|sea|marine/.test(id)) hide(id);
      else {
        set(id, "text-color", BASEMAP.label);
        set(id, "text-halo-color", BASEMAP.labelHalo);
        set(id, "text-halo-width", 1.2);
        set(id, "text-opacity", /country|state|continent/.test(id) ? 0.35 : 0.55);
      }
    }
  }
}

/**
 * The MapLibre city map, loaded only in the browser. Calls `onFail` if the library, WebGL or the map style cannot load, so the
 * page can show the drawn fallback map instead. Hotel markers are React components rendered into MapLibre markers.
 */
export function MapLibreView(props: MapViewProps & { onFail: () => void }) {
  const { rows, colors, ranks, hoverId, selectedId, metricLabel, valueText, onHover, onSelect, flyTo, fitNonce, fitIds, cities = [], cityValueText, onPickCity, reduce } = props;
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<MlMap | null>(null);
  const markers = useRef<Map<string, Marker>>(new Map());
  const [containers, setContainers] = useState<Record<string, HTMLElement>>({});
  const [offsets, setOffsets] = useState<Offsets>({});
  const [ready, setReady] = useState(false);
  const [zoom, setZoom] = useState(13);
  const cityMarkers = useRef<Map<string, Marker>>(new Map());
  const [cityEls, setCityEls] = useState<Record<string, HTMLElement>>({});
  const lakeLabel = useRef<HTMLElement | null>(null);
  const handlers = useRef(props);
  handlers.current = props;
  const lib = useRef<typeof import("maplibre-gl") | null>(null);
  const rowsRef = useRef(rows);
  rowsRef.current = rows;
  const raf = useRef(0);

  /** Recomputes how markers fan out (depends on zoom only, so it runs on zoom and when hotels change). */
  const respread = () => {
    cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(() => {
      const m = map.current;
      if (!m) return;
      setOffsets(spreadOffsets(rowsRef.current.map((r) => ({ id: r.id, ...m.project([r.lng, r.lat]) }))));
      setZoom(m.getZoom());
    });
  };

  /** Adds a marker for each hotel that has none and removes markers of hotels no longer listed (filters, a hotel added or removed). */
  const syncMarkers = () => {
    const m = map.current;
    const L = lib.current;
    if (!m || !L) return;
    const ids = new Set(rowsRef.current.map((r) => r.id));
    let changed = false;
    for (const [id, marker] of markers.current)
      if (!ids.has(id)) {
        marker.remove();
        markers.current.delete(id);
        changed = true;
      }
    for (const r of rowsRef.current) {
      const existing = markers.current.get(r.id);
      if (existing) {
        existing.setLngLat([r.lng, r.lat]);
        continue;
      }
      const el = document.createElement("div");
      el.style.cssText = "width:0;height:0;";
      const marker = new L.Marker({ element: el, anchor: "center" }).setLngLat([r.lng, r.lat]).addTo(m);
      markers.current.set(r.id, marker);
      changed = true;
    }
    if (changed) setContainers(Object.fromEntries([...markers.current].map(([id, mk]) => [id, mk.getElement()])));
    syncCities();
    respread();
  };

  const citiesRef = useRef(cities);
  citiesRef.current = cities;
  /** One marker per city (shown only when zoomed out over several cities). */
  const syncCities = () => {
    const m = map.current;
    const L = lib.current;
    if (!m || !L) return;
    const want = new Map(citiesRef.current.map((g) => [g.city, g]));
    let changed = false;
    for (const [city, mk] of cityMarkers.current)
      if (!want.has(city)) {
        mk.remove();
        cityMarkers.current.delete(city);
        changed = true;
      }
    for (const g of want.values()) {
      const existing = cityMarkers.current.get(g.city);
      if (existing) {
        existing.setLngLat([g.lng, g.lat]);
        continue;
      }
      const el = document.createElement("div");
      el.style.cssText = "width:0;height:0;";
      cityMarkers.current.set(g.city, new L.Marker({ element: el, anchor: "center" }).setLngLat([g.lng, g.lat]).addTo(m));
      changed = true;
    }
    if (changed) setCityEls(Object.fromEntries([...cityMarkers.current].map(([c, mk]) => [c, mk.getElement()])));
  };
  const idsKey = rows.map((r) => `${r.id}@${r.lat},${r.lng}`).join("|");
  const citiesKey = cities.map((g) => `${g.city}@${g.lat},${g.lng}`).join("|");
  useEffect(() => {
    syncCities();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [citiesKey]);
  useEffect(() => {
    syncMarkers();
    // A different set of hotels (filters, organization): show them all.
    const m = map.current;
    if (m && ready && rows.length) m.fitBounds(boundsOf(rows), { padding: fitPadding(box.current?.clientWidth ?? 0), maxZoom: 13, duration: reduce ? 0 : 800 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey]);

  // Create the map once.
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    (async () => {
      try {
        const mod = (await import("maplibre-gl")).default;
        await import("maplibre-gl/dist/maplibre-gl.css");
        if (cancelled || !box.current) return;
        // Back from a hotel: the camera the user left (portfolioView.camera); otherwise all hotels.
        const cam = useTwin.getState().portfolioView.camera;
        const m = new mod.Map({
          container: box.current,
          style: MAP_STYLE_URL,
          ...(cam
            ? { center: [cam.lng, cam.lat] as [number, number], zoom: cam.zoom }
            : { bounds: boundsOf(rowsRef.current), fitBoundsOptions: { padding: fitPadding(box.current.clientWidth), maxZoom: 13 } }),
          attributionControl: { compact: true },
          fadeDuration: reduce ? 0 : 300,
          dragRotate: false,
          pitchWithRotate: false,
        });
        map.current = m;
        m.touchZoomRotate.disableRotation();
        m.addControl(new mod.NavigationControl({ showCompass: false }), "bottom-right");
        let loaded = false;
        timer = setTimeout(() => !loaded && handlers.current.onFail(), LOAD_TIMEOUT_MS);
        m.on("load", () => {
          loaded = true;
          restyleBasemap(m);
          // Lake Michigan, labeled in the app's style (the basemap's water labels are hidden).
          const label = document.createElement("div");
          label.textContent = "Lake Michigan";
          label.setAttribute("aria-hidden", "true");
          label.style.cssText = "pointer-events:none;font:italic 500 12px/1 ui-sans-serif,system-ui;letter-spacing:.28em;text-transform:uppercase;color:#4d85b8;opacity:.75;white-space:nowrap;";
          lakeLabel.current = label;
          new mod.Marker({ element: label }).setLngLat([-87.545, 41.8]).addTo(m);
          setReady(true);
          respread();
        });
        m.on("error", () => {
          if (!loaded) handlers.current.onFail();
        });
        m.on("zoom", respread);
        m.on("moveend", () => {
          const c = m.getCenter();
          useTwin.getState().setPortfolioView({ camera: { lng: c.lng, lat: c.lat, zoom: m.getZoom() } });
        });
        m.on("click", (e) => {
          // Marker clicks also reach the map; only a click on the map itself closes the card.
          const t = e.originalEvent?.target;
          if (t instanceof Element && t.closest("[data-marker-root]")) return;
          handlers.current.onBackground();
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
      cancelAnimationFrame(raf.current);
      markers.current.clear();
      cityMarkers.current.clear();
      map.current?.remove();
      map.current = null;
    };
    // The map is created once; markers re-render through portals.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fly to a hotel picked in the list or on the map.
  useEffect(() => {
    const m = map.current;
    const r = flyTo && rows.find((x) => x.id === flyTo.id);
    if (!m || !r) return;
    const target = { center: [r.lng, r.lat] as [number, number], zoom: Math.max(m.getZoom(), 13), padding: overlayPadding(box.current?.clientWidth ?? 0) };
    if (reduce) m.jumpTo(target);
    else m.flyTo({ ...target, speed: 1.1, curve: 1.42, essential: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flyTo?.n]);

  // Fit all hotels, or the hotels of one city.
  useEffect(() => {
    const m = map.current;
    const subset = fitIds ? rows.filter((r) => fitIds.includes(r.id)) : rows;
    if (!m || fitNonce === 0 || !subset.length) return;
    m.fitBounds(boundsOf(subset), { padding: fitPadding(box.current?.clientWidth ?? 0), maxZoom: 13, duration: reduce ? 0 : 900 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitNonce]);

  // Zoomed out over several cities: one marker per city instead of overlapping hotels.
  const clustered = cities.length > 1 && zoom < CITY_CLUSTER_ZOOM;
  useEffect(() => {
    for (const [id, mk] of markers.current) {
      const hidden = clustered && id !== selectedId;
      mk.getElement().style.visibility = hidden ? "hidden" : "visible";
    }
    for (const mk of cityMarkers.current.values()) mk.getElement().style.visibility = clustered ? "visible" : "hidden";
    if (lakeLabel.current) lakeLabel.current.style.visibility = clustered ? "hidden" : "visible";
  });

  // Hovered and selected markers draw above the others (the tooltip stays readable).
  useEffect(() => {
    for (const [id, mk] of markers.current) mk.getElement().style.zIndex = id === hoverId ? "40" : id === selectedId ? "30" : "1";
  });

  const byId = new Map(rows.map((r) => [r.id, r]));
  return (
    <>
      <div ref={box} className="h-full w-full" data-testid="maplibre-map" data-clustered={clustered ? "true" : "false"} />
      {Object.entries(cityEls).map(([city, el]) => {
        const g = cities.find((x) => x.city === city);
        if (!g) return null;
        return createPortal(
          <CityCluster group={g} valueText={cityValueText?.(city) ?? ""} metricLabel={metricLabel} onPick={(c) => onPickCity?.(c)} />,
          el,
          `city-${city}`,
        );
      })}
      {Object.entries(containers).map(([id, el]) => {
        const r = byId.get(id);
        if (!r) return null;
        const o = offsets[id];
        return createPortal(
          <HotelMarker
            row={r}
            color={colors[id] ?? "var(--primary)"}
            rank={ranks[id] ?? 0}
            dx={o?.dx ?? 0}
            dy={o?.dy ?? 0}
            hovered={hoverId === id}
            selected={selectedId === id}
            valueText={valueText(id)}
            metricLabel={metricLabel}
            onHover={onHover}
            onSelect={onSelect}
            reduce={reduce}
          />,
          el,
          id,
        );
      })}
    </>
  );
}

function boundsOf(rows: PropertySummary[]): [[number, number], [number, number]] {
  const lngs = rows.map((r) => r.lng);
  const lats = rows.map((r) => r.lat);
  if (!lngs.length) return [[-87.94, 41.83], [-87.56, 42.01]];
  return [
    [Math.min(...lngs), Math.min(...lats)],
    [Math.max(...lngs), Math.max(...lats)],
  ];
}
