// The 3D street map's camera and the optional data columns: pure functions (no MapLibre, no DOM), so they are testable and the same input
// always gives the same camera. Display only: nothing here changes a figure; the columns' heights are the store's values, scaled.

export interface Padding {
  top: number;
  bottom: number;
  left: number;
  right: number;
}
export interface Viewport {
  width: number;
  height: number;
  padding: Padding;
}
export interface Camera {
  lng: number;
  lat: number;
  zoom: number;
  /** Degrees away from straight down (0 = flat plan view). */
  pitch: number;
  /** Compass direction at the top of the screen, degrees (0 = north up). */
  bearing: number;
}
export interface LngLat {
  lng: number;
  lat: number;
}

/** MapLibre's defaults: 512 px world tiles and a vertical field of view of 36.87° (camera at 1.5 × the viewport height). */
const TILE = 512;
const FOV = 0.6435011087932844;
const D2R = Math.PI / 180;

/** The 3D view's tilt and its limits. */
export const PITCH_3D = 55;
export const MAX_PITCH = 70;
/**
 * The 3D view's default heading when the hotels are in one city: looking north-north-west, so the downtown skyline stands in the foreground
 * with Lake Michigan to the right and outlying hotels (O'Hare) further back. With hotels across several cities the map stays north up.
 */
export const BEARING_3D = -25;
/** A hotel picked in 3D is flown to at least this zoom, where the tiles carry individual building footprints and heights. */
export const FLY_ZOOM_3D = 15;

const mercX = (lng: number) => (lng + 180) / 360;
const mercY = (lat: number) => (1 - Math.log(Math.tan(Math.PI / 4 + (lat * D2R) / 2)) / Math.PI) / 2;
const lngOf = (x: number) => x * 360 - 180;
const latOf = (y: number) => (360 / Math.PI) * Math.atan(Math.exp(Math.PI * (1 - 2 * y))) - 90;

/** Where a ground point lands on screen for a camera (MapLibre's perspective model, no padding, no terrain). Null when behind the camera. */
export function projectPitched(cam: Camera, vp: Viewport, p: LngLat): { x: number; y: number } | null {
  const scale = TILE * 2 ** cam.zoom;
  const dx = (mercX(p.lng) - mercX(cam.lng)) * scale;
  const dy = (mercY(p.lat) - mercY(cam.lat)) * scale;
  const b = cam.bearing * D2R;
  const rx = dx * Math.cos(b) + dy * Math.sin(b);
  const ry = -dx * Math.sin(b) + dy * Math.cos(b);
  const pitch = cam.pitch * D2R;
  const dist = vp.height / 2 / Math.tan(FOV / 2);
  const depth = dist - ry * Math.sin(pitch);
  if (depth <= 1e-6) return null;
  return { x: vp.width / 2 + (rx * dist) / depth, y: vp.height / 2 + (ry * Math.cos(pitch) * dist) / depth };
}

/** The ground point under a screen point (the inverse of `projectPitched`). */
export function unprojectPitched(cam: Camera, vp: Viewport, x: number, y: number): LngLat {
  const scale = TILE * 2 ** cam.zoom;
  const pitch = cam.pitch * D2R;
  const dist = vp.height / 2 / Math.tan(FOV / 2);
  const u = x - vp.width / 2;
  const v = y - vp.height / 2;
  const ry = (v * dist) / (Math.cos(pitch) * dist + v * Math.sin(pitch));
  const rx = (u * (dist - ry * Math.sin(pitch))) / dist;
  const b = cam.bearing * D2R;
  const dx = rx * Math.cos(b) - ry * Math.sin(b);
  const dy = rx * Math.sin(b) + ry * Math.cos(b);
  return { lng: lngOf(mercX(cam.lng) + dx / scale), lat: latOf(mercY(cam.lat) + dy / scale) };
}

/** True when every point lands inside the padded part of the viewport (1 px tolerance). */
export function allInView(cam: Camera, vp: Viewport, points: LngLat[], tolerance = 1): boolean {
  const { padding: pad } = vp;
  return points.every((p) => {
    const s = projectPitched(cam, vp, p);
    return !!s && s.x >= pad.left - tolerance && s.x <= vp.width - pad.right + tolerance && s.y >= pad.top - tolerance && s.y <= vp.height - pad.bottom + tolerance;
  });
}

/**
 * The tilted camera that shows every point inside the padded viewport, as large as possible (up to `maxZoom`): MapLibre's `fitBounds`
 * ignores pitch, so a tilted fit is solved here by iterating zoom and center on the perspective model, then checked.
 */
export function fitPitchedCamera(
  points: LngLat[],
  vp: Viewport,
  opts: { pitch: number; bearing: number; maxZoom?: number; minZoom?: number },
): Camera {
  const maxZoom = opts.maxZoom ?? 15;
  const minZoom = opts.minZoom ?? 1;
  const pts = points.filter((p) => Number.isFinite(p.lng) && Number.isFinite(p.lat));
  const clampZ = (z: number) => Math.min(maxZoom, Math.max(minZoom, z));
  if (!pts.length) return { lng: -87.75, lat: 41.92, zoom: clampZ(10), pitch: opts.pitch, bearing: opts.bearing };
  const xs = pts.map((p) => mercX(p.lng));
  const ys = pts.map((p) => mercY(p.lat));
  const availW = Math.max(40, vp.width - vp.padding.left - vp.padding.right);
  const availH = Math.max(40, vp.height - vp.padding.top - vp.padding.bottom);
  const span = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys), 1e-9);
  let cam: Camera = {
    lng: lngOf((Math.min(...xs) + Math.max(...xs)) / 2),
    lat: latOf((Math.min(...ys) + Math.max(...ys)) / 2),
    zoom: clampZ(Math.log2(Math.min(availW, availH) / (span * TILE))),
    pitch: opts.pitch,
    bearing: opts.bearing,
  };
  const tx = vp.padding.left + availW / 2;
  const ty = vp.padding.top + availH / 2;
  for (let i = 0; i < 60; i++) {
    const proj = pts.map((p) => projectPitched(cam, vp, p));
    if (proj.some((s) => !s)) {
      cam = { ...cam, zoom: clampZ(cam.zoom - 0.5) };
      continue;
    }
    const sx = proj.map((s) => s!.x);
    const sy = proj.map((s) => s!.y);
    const bw = Math.max(...sx) - Math.min(...sx);
    const bh = Math.max(...sy) - Math.min(...sy);
    const bx = (Math.max(...sx) + Math.min(...sx)) / 2;
    const by = (Math.max(...sy) + Math.min(...sy)) / 2;
    const fit = Math.min(availW / Math.max(bw, 1e-6), availH / Math.max(bh, 1e-6));
    const center = unprojectPitched(cam, vp, vp.width / 2 + (bx - tx), vp.height / 2 + (by - ty));
    const zoom = clampZ(cam.zoom + 0.8 * Math.log2(fit));
    const done = Math.abs(zoom - cam.zoom) < 1e-4 && Math.abs(bx - tx) < 0.25 && Math.abs(by - ty) < 0.25;
    cam = { ...cam, ...center, zoom };
    if (done) break;
  }
  // Guarantee: nothing left outside (a few small steps out if the iteration stopped short).
  for (let i = 0; i < 80 && cam.zoom > minZoom && !allInView(cam, vp, pts); i++) cam = { ...cam, zoom: clampZ(cam.zoom - 0.05) };
  return cam;
}

/** The 3D view's heading for a set of hotels: the skyline heading in one city, north up across several cities (a wide extent). */
export function bearingFor(points: LngLat[]): number {
  if (points.length < 2) return BEARING_3D;
  const lngs = points.map((p) => p.lng);
  const lats = points.map((p) => p.lat);
  const wide = Math.max(...lngs) - Math.min(...lngs) > 2 || Math.max(...lats) - Math.min(...lats) > 2;
  return wide ? 0 : BEARING_3D;
}

// ── Optional data columns (off by default) ────────────────────────────────────────────────────────────────────────────────────────────

/** Meters per screen pixel at a zoom and latitude (Web Mercator, 512 px tiles). */
export function metersPerPixel(zoom: number, lat: number): number {
  return (40075016.686 * Math.cos(lat * D2R)) / (TILE * 2 ** zoom);
}

/**
 * Column heights strictly proportional to the values: the highest value gets `maxHeight`, zero (or less) stays on the ground. Values come
 * from the store (the engine's figures); nothing is rescaled per hotel, so the columns compare exactly as the numbers do.
 */
export function columnHeights(values: Record<string, number>, maxHeight: number): Record<string, number> {
  const finite = Object.values(values).filter((v) => Number.isFinite(v));
  const max = finite.length ? Math.max(...finite) : 0;
  return Object.fromEntries(
    Object.entries(values).map(([id, v]) => [id, max > 0 && Number.isFinite(v) ? (Math.max(0, v) / max) * maxHeight : 0]),
  );
}

/**
 * The columns' screen-relative size at a zoom (quantized to half levels so they do not resize on every frame): the tallest column is about
 * `tallPx` pixels high at that zoom and each column `widthPx` wide. Only the common scale changes with zoom; the ratios between hotels never do.
 */
export function columnScale(zoom: number, lat: number, tallPx = 140, widthPx = 12): { maxHeight: number; halfWidth: number; zoom: number } {
  const z = Math.round(zoom * 2) / 2;
  const mpp = metersPerPixel(z, lat);
  return { maxHeight: mpp * tallPx, halfWidth: (mpp * widthPx) / 2, zoom: z };
}

/** A square footprint (closed ring of [lng, lat]) centered on a point, `half` meters from the center to each side. */
export function columnPolygon(lng: number, lat: number, half: number): [number, number][] {
  const dLat = half / 111320;
  const dLng = half / (111320 * Math.cos(lat * D2R));
  return [
    [lng - dLng, lat - dLat],
    [lng + dLng, lat - dLat],
    [lng + dLng, lat + dLat],
    [lng - dLng, lat + dLat],
    [lng - dLng, lat - dLat],
  ];
}

// ── 2D / 3D mode and the tilted camera, kept across a hotel visit without changing the store ─────────────────────────────────────────

export type MapMode = "2d" | "3d";
export const MAP_MODE_KEY = "energy-twin:map-mode";

/** The saved 2D / 3D choice (3D by default). A view preference only, in local storage. */
export function loadMapMode(): MapMode {
  try {
    return typeof localStorage !== "undefined" && localStorage.getItem(MAP_MODE_KEY) === "2d" ? "2d" : "3d";
  } catch {
    return "3d";
  }
}
export function saveMapMode(mode: MapMode): void {
  try {
    localStorage.setItem(MAP_MODE_KEY, mode);
  } catch {
    /* private mode: the choice lasts for this page only */
  }
}

/**
 * The store keeps the street map's center and zoom (`portfolioView.camera`); the tilt and heading the user left are kept here, in memory, for
 * the same return trip. They are used only while the store still has a camera (Reset demo or a filter change clears it, and the default
 * view comes back).
 */
let lastAngles: { pitch: number; bearing: number } | null = null;
export function rememberAngles(a: { pitch: number; bearing: number } | null): void {
  lastAngles = a;
}
export function recallAngles(): { pitch: number; bearing: number } | null {
  return lastAngles;
}
