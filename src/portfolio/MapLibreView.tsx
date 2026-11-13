import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { IControl, Map as MlMap, Marker } from "maplibre-gl";
import type { PropertySummary } from "@/engine/hotel";
import { CityCluster } from "./CityCluster";
import { HotelMarker } from "./HotelMarker";
import { useTwin } from "@/store/useTwin";
import { fitPadding, overlayPadding } from "./mapTypes";
import type { MapViewProps } from "./mapTypes";
import { spreadOffsets } from "./spread";
import type { Offsets } from "./spread";
import { addBuildings3D, columnFeatures, resolveCssColor, showBuildings3D, syncColumns } from "./buildings3d";
import { FLY_ZOOM_3D, MAX_PITCH, PITCH_3D, bearingFor, fitPitchedCamera, recallAngles, rememberAngles } from "./camera3d";
import type { Camera, MapMode } from "./camera3d";

/** Free dark basemap, no API key (attribution shown on the map). Restyled after load (`restyleBasemap`). */
export const MAP_STYLE_URL = "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";
const LOAD_TIMEOUT_MS = 8000;
/** Building footprints and heights are OpenStreetMap data in Carto's tiles; the note says heights are approximate (docs/17). */
export const BUILDINGS_ATTRIBUTION = "3D buildings: OSM heights, approximate";
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

/** What the street map adds to the shared map props: the 2D / 3D mode and the optional data columns. */
export interface StreetMapExtras {
  /** "3d": extruded buildings, a tilted camera and rotation; "2d": the flat plan view. */
  mode: MapMode;
  /** The optional data columns (3D only), heights proportional to `values`. */
  columns: boolean;
  /** The selected metric's value per hotel (from the store), for the columns. */
  values: Record<string, number>;
  onFail: () => void;
  /** Called once the style loads: false when the basemap has no building layer to extrude (the toggle then stays on 2D). */
  onBuildings3D?: (ok: boolean) => void;
}

/** The tilted camera that shows these hotels on this map (no padding: the fit keeps clear of the overlays itself). */
function framed(m: MlMap, rows: PropertySummary[], width: number, cardOpen: boolean): Camera {
  const c = m.getContainer();
  return fitPitchedCamera(rows, { width: c.clientWidth, height: c.clientHeight, padding: fitPadding(width, cardOpen) }, { pitch: PITCH_3D, bearing: bearingFor(rows), maxZoom: 15 });
}
const NO_PAD = { top: 0, bottom: 0, left: 0, right: 0 };

/**
 * The MapLibre city map, loaded only in the browser. Calls `onFail` if the library, WebGL or the map style cannot load, so the
 * page can show the drawn fallback map instead. Hotel markers are React components rendered into MapLibre markers. In 3D the basemap's
 * own building footprints are extruded to their heights (`buildings3d.ts`) and the camera tilts and rotates.
 */
export function MapLibreView(props: MapViewProps & StreetMapExtras) {
  const { rows, colors, ranks, hoverId, selectedId, metricLabel, valueText, onHover, onSelect, flyTo, fitNonce, fitIds, cities = [], cityValueText, onPickCity, reduce, mode, columns, values } = props;
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
  const nav = useRef<IControl | null>(null);
  const [has3D, setHas3D] = useState(false);
  const has3DRef = useRef(false);
  const rowsRef = useRef(rows);
  rowsRef.current = rows;
  const raf = useRef(0);
  const is3D = mode === "3d" && has3D;

  /** Recomputes how markers fan out (screen distances change with zoom, tilt and rotation). */
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
      // Markers face the viewer at any tilt or heading, so they stay readable and clickable.
      const marker = new L.Marker({ element: el, anchor: "center", pitchAlignment: "viewport", rotationAlignment: "viewport" }).setLngLat([r.lng, r.lat]).addTo(m);
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
      cityMarkers.current.set(g.city, new L.Marker({ element: el, anchor: "center", pitchAlignment: "viewport", rotationAlignment: "viewport" }).setLngLat([g.lng, g.lat]).addTo(m));
      changed = true;
    }
    if (changed) setCityEls(Object.fromEntries([...cityMarkers.current].map(([c, mk]) => [c, mk.getElement()])));
  };

  /** Shows these hotels: the tilted fit in 3D, MapLibre's flat fit in 2D. */
  const fitRows = (subset: PropertySummary[], duration: number) => {
    const m = map.current;
    if (!m || !subset.length) return;
    const width = box.current?.clientWidth ?? 0;
    const calm = handlers.current.reduce || duration === 0;
    if (handlers.current.mode === "3d" && has3DRef.current) {
      const cam = framed(m, subset, width, !!handlers.current.selectedId);
      const target = { center: [cam.lng, cam.lat] as [number, number], zoom: cam.zoom, pitch: cam.pitch, bearing: cam.bearing, padding: NO_PAD };
      if (calm) m.jumpTo(target);
      else m.flyTo({ ...target, duration, essential: true });
    } else {
      m.fitBounds(boundsOf(subset), { padding: fitPadding(width, !!handlers.current.selectedId), maxZoom: 13, pitch: 0, bearing: 0, duration: calm ? 0 : duration });
    }
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
    if (map.current && ready && rows.length) fitRows(rows, 800);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey]);

  /** Rotation and tilt gestures, and the compass, only in 3D (the flat map stays a north-up plan). */
  const applyInteraction = (m: MlMap, three: boolean) => {
    const L = lib.current;
    if (three) {
      m.dragRotate.enable();
      m.touchZoomRotate.enableRotation();
      m.touchPitch.enable();
      m.keyboard.enableRotation();
    } else {
      m.dragRotate.disable();
      m.touchZoomRotate.disableRotation();
      m.touchPitch.disable();
      m.keyboard.disableRotation();
    }
    if (L) {
      if (nav.current) m.removeControl(nav.current);
      nav.current = new L.NavigationControl({ showCompass: three, visualizePitch: three });
      m.addControl(nav.current, "bottom-right");
    }
  };

  // Create the map once.
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    (async () => {
      try {
        const mod = (await import("maplibre-gl")).default;
        await import("maplibre-gl/dist/maplibre-gl.css");
        if (cancelled || !box.current) return;
        lib.current = mod;
        const three = handlers.current.mode === "3d";
        // Back from a hotel: the camera the user left (portfolioView.camera and the remembered tilt); otherwise all hotels.
        const cam = useTwin.getState().portfolioView.camera;
        const angles = recallAngles();
        const width = box.current.clientWidth;
        const fit3 = three
          ? fitPitchedCamera(rowsRef.current, { width, height: box.current.clientHeight, padding: fitPadding(width) }, { pitch: PITCH_3D, bearing: bearingFor(rowsRef.current), maxZoom: 15 })
          : null;
        const m = new mod.Map({
          container: box.current,
          style: MAP_STYLE_URL,
          ...(cam
            ? {
                center: [cam.lng, cam.lat] as [number, number],
                zoom: cam.zoom,
                pitch: three ? (angles?.pitch ?? PITCH_3D) : 0,
                bearing: three ? (angles?.bearing ?? bearingFor(rowsRef.current)) : 0,
              }
            : fit3
              ? { center: [fit3.lng, fit3.lat] as [number, number], zoom: fit3.zoom, pitch: fit3.pitch, bearing: fit3.bearing }
              : { bounds: boundsOf(rowsRef.current), fitBoundsOptions: { padding: fitPadding(width), maxZoom: 13 } }),
          attributionControl: { compact: true, customAttribution: BUILDINGS_ATTRIBUTION },
          fadeDuration: reduce ? 0 : 300,
          maxPitch: MAX_PITCH,
          dragRotate: three,
          pitchWithRotate: true,
        });
        map.current = m;
        applyInteraction(m, three);
        let loaded = false;
        timer = setTimeout(() => !loaded && handlers.current.onFail(), LOAD_TIMEOUT_MS);
        m.on("load", () => {
          loaded = true;
          restyleBasemap(m);
          // The attribution stays one tap away (the ⓘ button) instead of covering the bottom of the map.
          box.current?.querySelector(".maplibregl-ctrl-attrib.maplibregl-compact-show")?.classList.remove("maplibregl-compact-show");
          const ok = addBuildings3D(m, handlers.current.reduce);
          has3DRef.current = ok;
          setHas3D(ok);
          showBuildings3D(m, ok && handlers.current.mode === "3d");
          // No buildings to extrude: the flat plan view, without rotation.
          if (!ok && three) {
            applyInteraction(m, false);
            m.jumpTo({ pitch: 0, bearing: 0 });
            fitRows(rowsRef.current, 0);
          }
          handlers.current.onBuildings3D?.(ok);
          // Lake Michigan, labeled in the app's style (the basemap's water labels are hidden).
          const label = document.createElement("div");
          label.textContent = "Lake Michigan";
          label.setAttribute("aria-hidden", "true");
          label.style.cssText = "pointer-events:none;font:italic 500 12px/1 ui-sans-serif,system-ui;letter-spacing:.28em;text-transform:uppercase;color:#4d85b8;opacity:.75;white-space:nowrap;";
          lakeLabel.current = label;
          new mod.Marker({ element: label, pitchAlignment: "map", rotationAlignment: "map" }).setLngLat([-87.545, 41.8]).addTo(m);
          setReady(true);
          respread();
        });
        m.on("error", () => {
          if (!loaded) handlers.current.onFail();
        });
        // A lost WebGL context (GPU reset, too many contexts): the drawn map takes over.
        m.on("webglcontextlost", () => handlers.current.onFail());
        m.on("move", respread);
        m.on("moveend", () => {
          const c = m.getCenter();
          rememberAngles({ pitch: m.getPitch(), bearing: m.getBearing() });
          useTwin.getState().setPortfolioView({ camera: { lng: c.lng, lat: c.lat, zoom: m.getZoom() } });
        });
        m.on("click", (e) => {
          // Marker clicks also reach the map; only a click on the map itself closes the card.
          const t = e.originalEvent?.target;
          if (t instanceof Element && t.closest("[data-marker-root]")) return;
          handlers.current.onBackground();
        });
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

  // 2D ⇄ 3D: buildings, gestures and the camera follow the mode.
  const shownMode = useRef<MapMode | null>(null);
  useEffect(() => {
    const m = map.current;
    if (!m || !ready) return;
    const three = mode === "3d" && has3DRef.current;
    const before = shownMode.current;
    shownMode.current = three ? "3d" : "2d";
    if (before === null || before === shownMode.current) return;
    showBuildings3D(m, three);
    applyInteraction(m, three);
    if (three) {
      // A hotel is open: tilt around it; otherwise the default 3D view of every hotel.
      if (selectedId) {
        const target = { pitch: PITCH_3D, bearing: bearingFor(rows) };
        if (reduce) m.jumpTo(target);
        else m.easeTo({ ...target, duration: 700 });
      } else fitRows(rows, 900);
    } else {
      const target = { pitch: 0, bearing: 0 };
      if (reduce) m.jumpTo(target);
      else m.easeTo({ ...target, duration: 600 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, ready]);

  // Fly to a hotel picked in the list or on the map (closer in 3D, where its block and its neighbors rise).
  useEffect(() => {
    const m = map.current;
    const r = flyTo && rows.find((x) => x.id === flyTo.id);
    if (!m || !r) return;
    const three = handlers.current.mode === "3d" && has3DRef.current;
    const target = {
      center: [r.lng, r.lat] as [number, number],
      zoom: Math.max(m.getZoom(), three ? FLY_ZOOM_3D : 13),
      padding: overlayPadding(box.current?.clientWidth ?? 0),
      ...(three ? { pitch: Math.max(m.getPitch(), 40) } : {}),
    };
    if (reduce) m.jumpTo(target);
    else m.flyTo({ ...target, speed: 1.1, curve: 1.42, essential: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flyTo?.n]);

  // Fit all hotels, or the hotels of one city.
  useEffect(() => {
    const subset = fitIds ? rows.filter((r) => fitIds.includes(r.id)) : rows;
    if (!map.current || fitNonce === 0 || !subset.length) return;
    fitRows(subset, 900);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitNonce]);

  // The optional data columns: heights proportional to the metric's values, eased between metrics (instant with reduced motion).
  const scaleZoom = Math.round(zoom * 2) / 2;
  const colorKey = rows.map((r) => `${r.id}:${colors[r.id]}:${values[r.id]}`).join("|");
  const shownHeights = useRef<Record<string, number>>({});
  useEffect(() => {
    const m = map.current;
    if (!m || !ready || !box.current) return;
    const on = columns && is3D;
    const host = box.current;
    const plain = Object.fromEntries(rows.map((r) => [r.id, resolveCssColor(colors[r.id] ?? "var(--primary)", host)]));
    const target = columnFeatures(rows, values, plain, scaleZoom);
    if (!on) {
      syncColumns(m, false, target, reduce);
      shownHeights.current = {};
      return;
    }
    const to = Object.fromEntries(target.features.map((f) => [f.properties.id, f.properties.height]));
    const from = shownHeights.current;
    shownHeights.current = to;
    if (reduce) {
      syncColumns(m, true, target, true);
      return;
    }
    const at = (t: number) => ({
      ...target,
      features: target.features.map((f) => {
        const a = from[f.properties.id] ?? 0;
        return { ...f, properties: { ...f.properties, height: a + ((to[f.properties.id] ?? 0) - a) * t } };
      }),
    });
    let frame = 0;
    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / 500);
      syncColumns(m, true, at(1 - (1 - t) ** 3), false);
      if (t < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(frame);
      syncColumns(m, true, target, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [columns, is3D, ready, colorKey, scaleZoom, reduce]);

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
      <div
        ref={box}
        className="h-full w-full"
        data-testid="maplibre-map"
        data-clustered={clustered ? "true" : "false"}
        data-mode={is3D ? "3d" : "2d"}
        data-ready={ready ? "true" : "false"}
      />
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
            beam={is3D}
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
