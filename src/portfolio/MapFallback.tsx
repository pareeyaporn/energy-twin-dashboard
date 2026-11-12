import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { HotelMarker } from "./HotelMarker";
import { BASEMAP } from "./MapLibreView";
import { fitPadding, overlayPadding } from "./mapTypes";
import type { MapViewProps } from "./mapTypes";
import { spreadOffsets } from "./spread";

// A drawn Chicago map used when the map tiles cannot load (offline, blocked network, no WebGL). In the same navy look as the street
// map. Geography is approximate and decorative; marker positions use each property's latitude and longitude.

type LatLng = [number, number];
const COS = Math.cos((41.88 * Math.PI) / 180);
const SHORE: LatLng[] = [
  [42.08, -87.68], [42.04, -87.672], [42.01, -87.664], [41.98, -87.652], [41.95, -87.638], [41.925, -87.628], [41.905, -87.622],
  [41.895, -87.612], [41.884, -87.613], [41.87, -87.612], [41.858, -87.608], [41.845, -87.603], [41.83, -87.598], [41.81, -87.583],
  [41.795, -87.578], [41.78, -87.572], [41.76, -87.553], [41.73, -87.532], [41.7, -87.525], [41.65, -87.52],
];
const RIVERS: LatLng[][] = [
  [[41.8888, -87.611], [41.8877, -87.625], [41.8868, -87.6375]],
  [[41.8868, -87.6375], [41.899, -87.642], [41.92, -87.656], [41.945, -87.68], [41.97, -87.7], [42.01, -87.71], [42.06, -87.72]],
  [[41.8868, -87.6375], [41.87, -87.637], [41.855, -87.64], [41.845, -87.66], [41.83, -87.69], [41.81, -87.74], [41.79, -87.8]],
];
// Expressways (major) and a few arterials (minor), simplified.
const MAJOR: LatLng[][] = [
  [[41.878, -87.645], [41.905, -87.665], [41.93, -87.7], [41.955, -87.735], [41.97, -87.78], [41.98, -87.83], [41.985, -87.9]],
  [[41.876, -87.643], [41.875, -87.7], [41.873, -87.78], [41.87, -87.94]],
  [[41.878, -87.645], [41.85, -87.632], [41.8, -87.631], [41.75, -87.63], [41.7, -87.628]],
  [[41.86, -87.635], [41.83, -87.68], [41.8, -87.73], [41.78, -87.8], [41.76, -87.9]],
  [[41.83, -87.605], [41.87, -87.616], [41.9, -87.625], [41.95, -87.642], [42.01, -87.668], [42.06, -87.68]],
];
const MINOR: LatLng[][] = [
  [[41.7, -87.66], [41.9, -87.66], [42.06, -87.66]],
  [[41.7, -87.7], [42.06, -87.7]],
  [[41.7, -87.744], [42.06, -87.744]],
  [[41.7, -87.8], [42.06, -87.8]],
  [[41.91, -87.94], [41.91, -87.63]],
  [[41.94, -87.94], [41.94, -87.645]],
  [[41.795, -87.94], [41.795, -87.585]],
  [[41.75, -87.94], [41.75, -87.56]],
  [[41.835, -87.94], [41.835, -87.6]],
  [[41.968, -87.94], [41.968, -87.655]],
];
// Downtown neighborhoods (`near`) are labeled only once the map is zoomed in, so they never crowd the markers.
const PLACES: { name: string; at: LatLng; near?: boolean }[] = [
  { name: "The Loop", at: [41.879, -87.6385], near: true },
  { name: "River North", at: [41.8965, -87.638], near: true },
  { name: "Gold Coast", at: [41.906, -87.631], near: true },
  { name: "Lincoln Park", at: [41.925, -87.655] },
  { name: "West Loop", at: [41.8835, -87.66], near: true },
  { name: "South Loop", at: [41.859, -87.632], near: true },
  { name: "Downtown", at: [41.872, -87.66] },
  { name: "Hyde Park", at: [41.796, -87.6] },
  { name: "O'Hare", at: [41.99, -87.905] },
  { name: "Midway", at: [41.786, -87.752] },
  { name: "Wicker Park", at: [41.909, -87.682] },
];
/** The view when there are no hotels to show. */
const DEFAULT_BOX = { south: 41.83, north: 42.0, west: -87.92, east: -87.58 };
/** Smallest area a fit shows (degrees), so one hotel is not zoomed to a single block. */
const MIN_SPAN = 0.05;

interface View {
  lat: number;
  lng: number;
  /** Pixels per degree of latitude. */
  k: number;
}

export function MapFallback({ rows, colors, ranks, hoverId, selectedId, metricLabel, valueText, onHover, onSelect, onBackground, flyTo, fitNonce, reduce }: MapViewProps) {
  const box = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const measure = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    measure();
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", measure);
      return () => window.removeEventListener("resize", measure);
    }
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  // In tests (no layout) draw at a nominal size.
  const w = size.w || 800;
  const h = size.h || 480;

  /** The view that shows every hotel (and downtown), clear of the card and list. */
  const fit = useMemo<View>(() => {
    const lats = rows.length ? rows.map((r) => r.lat) : [DEFAULT_BOX.south, DEFAULT_BOX.north];
    const lngs = rows.length ? rows.map((r) => r.lng) : [DEFAULT_BOX.west, DEFAULT_BOX.east];
    const midLat = (Math.min(...lats) + Math.max(...lats)) / 2;
    const midLng = (Math.min(...lngs) + Math.max(...lngs)) / 2;
    const halfLat = Math.max(MIN_SPAN, Math.max(...lats) - Math.min(...lats)) / 2;
    const halfLng = Math.max(MIN_SPAN, Math.max(...lngs) - Math.min(...lngs)) / 2;
    const s = midLat - halfLat;
    const n = midLat + halfLat;
    const west = midLng - halfLng;
    const east = midLng + halfLng;
    const pad = fitPadding(w);
    const k = Math.min((w - pad.left - pad.right) / ((east - west) * COS), (h - pad.top - pad.bottom) / (n - s));
    // Center so the box sits in the space between the overlays.
    const lng = (west + east) / 2 - ((pad.left - pad.right) / 2 / k) / COS;
    const lat = (s + n) / 2 + ((pad.top - pad.bottom) / 2) / k;
    return { lat, lng, k: Math.max(k, 40) };
  }, [rows, w, h]);

  const [view, setView] = useState<View>(fit);
  const viewRef = useRef(view);
  viewRef.current = view;
  const anim = useRef(0);
  const animateTo = (target: View) => {
    cancelAnimationFrame(anim.current);
    if (reduce) {
      setView(target);
      return;
    }
    const from = viewRef.current;
    const t0 = performance.now();
    const ms = 750;
    const step = (now: number) => {
      const x = Math.min(1, (now - t0) / ms);
      const e = x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2;
      // Zoom in log space so the move feels even.
      const k = Math.exp(Math.log(from.k) + (Math.log(target.k) - Math.log(from.k)) * e);
      setView({ lat: from.lat + (target.lat - from.lat) * e, lng: from.lng + (target.lng - from.lng) * e, k });
      if (x < 1) anim.current = requestAnimationFrame(step);
    };
    anim.current = requestAnimationFrame(step);
  };
  useEffect(() => () => cancelAnimationFrame(anim.current), []);
  // Fit when the size or the set of hotels changes, and on request.
  const idsKey = rows.map((r) => r.id).join("|");
  // A new size shows all hotels again at once (and stops any move in progress, which was aimed at the old size).
  useEffect(() => {
    cancelAnimationFrame(anim.current);
    setView(fit);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [w, h]);
  // Compared with the previous value (not a first-run flag, which double-run effects in development would defeat).
  const fitKey = `${idsKey}#${fitNonce}`;
  const lastFitKey = useRef(fitKey);
  useEffect(() => {
    if (lastFitKey.current === fitKey) return;
    lastFitKey.current = fitKey;
    animateTo(fit);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitKey]);
  useEffect(() => {
    const r = flyTo && rows.find((x) => x.id === flyTo.id);
    if (!r) return;
    const pad = overlayPadding(w);
    const k = Math.max(viewRef.current.k, fit.k * 2.6);
    animateTo({ lat: r.lat + ((pad.top - pad.bottom) / 2) / k, lng: r.lng - ((pad.left - pad.right) / 2 / k) / COS, k });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flyTo?.n]);

  const project = (lat: number, lng: number) => ({ x: w / 2 + (lng - view.lng) * view.k * COS, y: h / 2 - (lat - view.lat) * view.k });
  const path = (pts: LatLng[]) => pts.map(([lat, lng], i) => { const p = project(lat, lng); return `${i ? "L" : "M"}${p.x.toFixed(1)},${p.y.toFixed(1)}`; }).join(" ");
  const shore = path(SHORE);
  const lake = `${shore} L${w + 4000},${project(41.65, -87.52).y.toFixed(1)} L${w + 4000},${project(42.08, -87.68).y.toFixed(1)} Z`;
  const zoom = view.k / fit.k;
  const pts = rows.map((r) => ({ id: r.id, ...project(r.lat, r.lng) }));
  const offsets = size.w ? spreadOffsets(pts) : {};
  // Lake label: in the lower part of the view (clear of the list), just offshore.
  const labelLat = view.lat - (h * 0.2) / view.k;
  const shoreAt = (lat: number) => {
    for (let i = 1; i < SHORE.length; i++) {
      const [la, lna] = SHORE[i - 1]!;
      const [lb, lnb] = SHORE[i]!;
      if ((lat <= la && lat >= lb) || (lat >= la && lat <= lb)) return lna + ((lat - la) / (lb - la || 1)) * (lnb - lna);
    }
    return -87.6;
  };
  const lakeLabel = { x: Math.min(project(labelLat, shoreAt(labelLat)).x + 36, w - 190), y: h / 2 + h * 0.2 };

  return (
    <div
      ref={box}
      className="relative h-full w-full overflow-hidden"
      style={{ background: BASEMAP.background }}
      role="group"
      aria-label="Simplified map of Chicago with the portfolio's hotels"
      data-testid="map-fallback"
      onClick={onBackground}
    >
      <svg width={w} height={h} className="absolute inset-0" aria-hidden>
        <defs>
          <linearGradient id="mf-lake" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" stopColor="#0e2b4c" />
            <stop offset="1" stopColor="#0a1f3a" />
          </linearGradient>
          <pattern id="mf-grid" width="48" height="48" patternUnits="userSpaceOnUse">
            <path d="M48 0H0V48" fill="none" stroke="#ffffff" strokeOpacity="0.025" />
          </pattern>
        </defs>
        <rect width={w} height={h} fill={BASEMAP.land} />
        <rect width={w} height={h} fill="url(#mf-grid)" />
        {MINOR.map((r, i) => <path key={`n${i}`} d={path(r)} fill="none" stroke={BASEMAP.roadMinor} strokeWidth={zoom > 1.5 ? 1.5 : 1} />)}
        {MAJOR.map((r, i) => <path key={`m${i}`} d={path(r)} fill="none" stroke={BASEMAP.roadMajor} strokeWidth={zoom > 1.5 ? 3 : 2} strokeLinecap="round" />)}
        {RIVERS.map((r, i) => <path key={`r${i}`} d={path(r)} fill="none" stroke={BASEMAP.waterway} strokeWidth={zoom > 1.5 ? 3.5 : 2.5} strokeLinecap="round" />)}
        <path d={lake} fill="url(#mf-lake)" />
        <path d={shore} fill="none" stroke="#2f6ea3" strokeOpacity="0.45" strokeWidth="1.25" />
        <path d={shore} fill="none" stroke="#2f6ea3" strokeOpacity="0.12" strokeWidth="8" />
      </svg>
      <span
        aria-hidden
        className="pointer-events-none absolute whitespace-nowrap text-[12px] font-medium uppercase italic tracking-[0.28em]"
        style={{ left: lakeLabel.x, top: lakeLabel.y, color: "#4d85b8", opacity: lakeLabel.x > project(labelLat, shoreAt(labelLat)).x + 10 ? 0.75 : 0 }}
      >
        Lake Michigan
      </span>
      {PLACES.map((p) => {
        const q = project(p.at[0], p.at[1]);
        if (q.x < -60 || q.x > w + 60 || q.y < -20 || q.y > h + 20 || (p.near && zoom < 1.8) || (p.name === "Downtown" && zoom >= 1.8)) return null;
        return (
          <span key={p.name} aria-hidden className="pointer-events-none absolute -translate-x-1/2 whitespace-nowrap text-[10px] uppercase tracking-[0.14em]" style={{ left: q.x, top: q.y, color: BASEMAP.label, opacity: 0.8 }}>
            {p.name}
          </span>
        );
      })}
      {rows.map((r, i) => {
        const p = pts[i]!;
        const o = offsets[r.id];
        return (
          <div key={r.id} className="absolute" style={{ left: p.x, top: p.y, zIndex: r.id === hoverId ? 40 : r.id === selectedId ? 30 : 1 }}>
            <HotelMarker
              row={r}
              color={colors[r.id] ?? "var(--primary)"}
              rank={ranks[r.id] ?? 0}
              dx={o?.dx ?? 0}
              dy={o?.dy ?? 0}
              hovered={hoverId === r.id}
              selected={selectedId === r.id}
              valueText={valueText(r.id)}
              metricLabel={metricLabel}
              onHover={onHover}
              onSelect={onSelect}
              reduce={reduce}
            />
          </div>
        );
      })}
    </div>
  );
}
