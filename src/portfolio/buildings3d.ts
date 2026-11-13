import type { ExpressionSpecification, Map as MlMap } from "maplibre-gl";
import type { PropertySummary } from "@/engine/hotel";
import { columnHeights, columnPolygon, columnScale } from "./camera3d";

// The 3D street map's layers: extruded buildings from the basemap's own vector tiles (no extra source, no key) and the optional data
// columns. Display only. See docs/17 "3D mode".

export const BUILDINGS_3D_LAYER = "et-buildings-3d";
export const COLUMNS_SOURCE = "et-hotel-columns";
export const COLUMNS_LAYER = "et-hotel-columns";
/**
 * Height for a building whose tiles carry none (no OSM height, no levels): a low, uniform block so the footprint still reads, drawn in a
 * dimmer navy so it is never mistaken for a measured height. About two floors.
 */
export const FALLBACK_HEIGHT_M = 6;
/** Meters per floor when only the number of floors is known. */
export const METERS_PER_LEVEL = 3;
/** Extrusions appear from this zoom (individual footprints from 13; lower zooms carry merged, generalized blocks) and rise over one level. */
export const BUILDINGS_MIN_ZOOM = 10.5;

/**
 * The height used for each footprint, in order: `render_height` (OpenMapTiles schema), `height` (Carto's current Protomaps schema, from OSM
 * `height` or levels), floors × 3 m (`building:levels` or `levels`), else the low fallback. Never invented per building.
 */
export const HEIGHT_EXPR = [
  "case",
  ["has", "render_height"],
  ["to-number", ["get", "render_height"], FALLBACK_HEIGHT_M],
  ["has", "height"],
  ["to-number", ["get", "height"], FALLBACK_HEIGHT_M],
  ["has", "building:levels"],
  ["*", METERS_PER_LEVEL, ["to-number", ["get", "building:levels"], 2]],
  ["has", "levels"],
  ["*", METERS_PER_LEVEL, ["to-number", ["get", "levels"], 2]],
  FALLBACK_HEIGHT_M,
] as unknown as ExpressionSpecification;

const BASE_EXPR = [
  "min",
  ["case", ["has", "render_min_height"], ["to-number", ["get", "render_min_height"], 0], ["has", "min_height"], ["to-number", ["get", "min_height"], 0], 0],
  HEIGHT_EXPR,
] as unknown as ExpressionSpecification;

const HAS_HEIGHT = ["any", ["has", "render_height"], ["has", "height"], ["has", "building:levels"], ["has", "levels"]] as unknown as ExpressionSpecification;

/** Navy by height: low blocks melt into the land, towers catch a little more light. Buildings without height data stay the dimmest. */
export const BUILDING_COLORS = { none: "#0b1627", low: "#0e1c33", mid: "#13243f", high: "#192f52", tower: "#223d68" };
const COLOR_EXPR = [
  "case",
  HAS_HEIGHT,
  ["interpolate", ["linear"], HEIGHT_EXPR, 0, BUILDING_COLORS.low, 60, BUILDING_COLORS.mid, 150, BUILDING_COLORS.high, 320, BUILDING_COLORS.tower],
  BUILDING_COLORS.none,
] as unknown as ExpressionSpecification;

/** The basemap's building layer (vector source and source layer), whatever the upstream style calls it. */
export function findBuildingSource(m: MlMap): { source: string; sourceLayer: string } | null {
  for (const l of m.getStyle()?.layers ?? []) {
    const any = l as { type: string; source?: string; "source-layer"?: string; id: string };
    if ((any.type === "fill" || any.type === "fill-extrusion") && any.source && any["source-layer"] && /building/.test(any["source-layer"]))
      return { source: any.source, sourceLayer: any["source-layer"] };
  }
  return null;
}

/** Adds the extruded buildings (hidden) under the labels. Returns false when the basemap has no building layer or the layer cannot be added. */
export function addBuildings3D(m: MlMap, reduce: boolean): boolean {
  if (m.getLayer(BUILDINGS_3D_LAYER)) return true;
  const src = findBuildingSource(m);
  if (!src) return false;
  const firstSymbol = (m.getStyle()?.layers ?? []).find((l) => l.type === "symbol")?.id;
  try {
    m.addLayer(
      {
        id: BUILDINGS_3D_LAYER,
        type: "fill-extrusion",
        source: src.source,
        "source-layer": src.sourceLayer,
        minzoom: BUILDINGS_MIN_ZOOM,
        layout: { visibility: "none" },
        paint: {
          "fill-extrusion-color": COLOR_EXPR,
          "fill-extrusion-height": ["interpolate", ["linear"], ["zoom"], BUILDINGS_MIN_ZOOM, 0, BUILDINGS_MIN_ZOOM + 1, HEIGHT_EXPR] as unknown as ExpressionSpecification,
          "fill-extrusion-base": ["interpolate", ["linear"], ["zoom"], BUILDINGS_MIN_ZOOM, 0, BUILDINGS_MIN_ZOOM + 1, BASE_EXPR] as unknown as ExpressionSpecification,
          "fill-extrusion-opacity": 0.92,
          "fill-extrusion-vertical-gradient": true,
        },
      },
      firstSymbol,
    );
    // Soft light from the north-west, a little cool, so towers have a lit side and a shaded side.
    m.setLight({ anchor: "map", position: [1.4, 300, 35], color: "#c4d6f5", intensity: 0.32 });
    // A faint navy atmosphere where the tilted view reaches the horizon.
    try {
      m.setSky({ "sky-color": "#0a1830", "horizon-color": "#12284a", "fog-color": "#081326", "sky-horizon-blend": 0.6, "horizon-fog-blend": 0.7, "fog-ground-blend": 0.35, "atmosphere-blend": 0 });
    } catch {
      /* older styles: no sky */
    }
    if (reduce) m.setPaintProperty(BUILDINGS_3D_LAYER, "fill-extrusion-opacity-transition", { duration: 0 });
    return true;
  } catch {
    return false;
  }
}

/** 3D: the extrusions replace the flat building fills; 2D: the flat fills come back. */
export function showBuildings3D(m: MlMap, on: boolean): void {
  for (const l of m.getStyle()?.layers ?? []) {
    if (l.id === BUILDINGS_3D_LAYER) continue;
    const any = l as { type: string; "source-layer"?: string };
    if (any.type === "fill" && /building/.test(any["source-layer"] ?? l.id)) setVisible(m, l.id, !on);
  }
  setVisible(m, BUILDINGS_3D_LAYER, on);
}

function setVisible(m: MlMap, id: string, on: boolean) {
  try {
    if (m.getLayer(id)) m.setLayoutProperty(id, "visibility", on ? "visible" : "none");
  } catch {
    /* ignore */
  }
}

/** The data columns' features: one square column per hotel at its true location, height proportional to the metric's value. */
export function columnFeatures(rows: PropertySummary[], values: Record<string, number>, colors: Record<string, string>, zoom: number) {
  const lat = rows.length ? rows.reduce((s, r) => s + r.lat, 0) / rows.length : 41.88;
  const { maxHeight, halfWidth } = columnScale(zoom, lat);
  const heights = columnHeights(values, maxHeight);
  return {
    type: "FeatureCollection" as const,
    features: rows.map((r) => ({
      type: "Feature" as const,
      id: r.id,
      properties: { id: r.id, height: heights[r.id] ?? 0, color: colors[r.id] ?? "#22d3ee" },
      geometry: { type: "Polygon" as const, coordinates: [columnPolygon(r.lng, r.lat, halfWidth)] },
    })),
  };
}

/** Shows, updates or hides the optional data columns. */
export function syncColumns(m: MlMap, on: boolean, data: ReturnType<typeof columnFeatures>, reduce: boolean): void {
  try {
    const src = m.getSource(COLUMNS_SOURCE) as { setData?: (d: unknown) => void } | undefined;
    if (!on) {
      if (m.getLayer(COLUMNS_LAYER)) m.setLayoutProperty(COLUMNS_LAYER, "visibility", "none");
      return;
    }
    if (src?.setData) src.setData(data);
    else m.addSource(COLUMNS_SOURCE, { type: "geojson", data });
    if (!m.getLayer(COLUMNS_LAYER)) {
      const firstSymbol = (m.getStyle()?.layers ?? []).find((l) => l.type === "symbol")?.id;
      m.addLayer(
        {
          id: COLUMNS_LAYER,
          type: "fill-extrusion",
          source: COLUMNS_SOURCE,
          paint: {
            "fill-extrusion-color": ["get", "color"],
            "fill-extrusion-height": ["get", "height"],
            "fill-extrusion-base": 0,
            "fill-extrusion-opacity": 0.8,
            "fill-extrusion-vertical-gradient": true,
          },
        },
        firstSymbol,
      );
    }
    m.setPaintProperty(COLUMNS_LAYER, "fill-extrusion-height-transition", { duration: reduce ? 0 : 500 });
    m.setPaintProperty(COLUMNS_LAYER, "fill-extrusion-color-transition", { duration: reduce ? 0 : 450 });
    m.setLayoutProperty(COLUMNS_LAYER, "visibility", "visible");
  } catch {
    /* columns are optional: a failure leaves the map as it is */
  }
}

const colorCache = new Map<string, string>();
/**
 * The map's WebGL layers need plain colors; the app's metric colors are CSS (`color-mix` of theme variables). Resolved once per color by
 * painting one pixel with the computed color. Falls back to the app's cyan where the browser cannot tell.
 */
export function resolveCssColor(css: string, host: HTMLElement): string {
  const hit = colorCache.get(css);
  if (hit) return hit;
  let out = "#22d3ee";
  try {
    const probe = document.createElement("span");
    probe.style.color = css;
    probe.style.display = "none";
    host.appendChild(probe);
    const computed = getComputedStyle(probe).color;
    probe.remove();
    const c = document.createElement("canvas");
    c.width = c.height = 1;
    const ctx = c.getContext("2d", { willReadFrequently: true });
    if (ctx && computed) {
      ctx.fillStyle = computed;
      ctx.fillRect(0, 0, 1, 1);
      const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
      out = `rgb(${r}, ${g}, ${b})`;
    }
  } catch {
    /* keep the fallback */
  }
  colorCache.set(css, out);
  return out;
}
