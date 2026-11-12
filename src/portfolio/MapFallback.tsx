import type { PropertySummary } from "@/engine/hotel";

// A drawn Chicago map used when the map tiles cannot load (offline, blocked network, no WebGL). Geography is approximate and
// decorative; marker positions use each property's latitude and longitude.
const BOUNDS = { west: -87.94, east: -87.56, south: 41.83, north: 42.01 };
const W = 800;
const H = Math.round((W * ((BOUNDS.north - BOUNDS.south) * 111)) / ((BOUNDS.east - BOUNDS.west) * 82.8));

export const project = (lat: number, lng: number) => ({
  x: ((lng - BOUNDS.west) / (BOUNDS.east - BOUNDS.west)) * W,
  y: ((BOUNDS.north - lat) / (BOUNDS.north - BOUNDS.south)) * H,
});
const path = (pts: [number, number][]) => pts.map(([lat, lng], i) => `${i ? "L" : "M"}${project(lat, lng).x.toFixed(1)},${project(lat, lng).y.toFixed(1)}`).join(" ");

const SHORE: [number, number][] = [
  [42.01, -87.664], [41.98, -87.652], [41.95, -87.638], [41.925, -87.628], [41.905, -87.622], [41.895, -87.612], [41.884, -87.613],
  [41.87, -87.612], [41.858, -87.608], [41.845, -87.603], [41.83, -87.598],
];
const RIVER_MAIN: [number, number][] = [[41.8888, -87.611], [41.8877, -87.625], [41.8868, -87.6375]];
const RIVER_NORTH: [number, number][] = [[41.8868, -87.6375], [41.899, -87.642], [41.92, -87.656], [41.945, -87.68], [41.97, -87.7], [42.01, -87.71]];
const RIVER_SOUTH: [number, number][] = [[41.8868, -87.6375], [41.87, -87.637], [41.855, -87.64], [41.845, -87.66], [41.83, -87.69]];
const ROADS: [number, number][][] = [
  [[41.878, -87.645], [41.905, -87.665], [41.93, -87.7], [41.955, -87.735], [41.97, -87.78], [41.98, -87.83], [41.985, -87.9]],
  [[41.876, -87.643], [41.875, -87.7], [41.873, -87.78], [41.87, -87.94]],
  [[41.83, -87.633], [41.86, -87.635], [41.878, -87.645], [41.9, -87.648], [42.01, -87.66]],
  [[41.83, -87.605], [41.87, -87.616], [41.9, -87.625], [41.95, -87.642], [42.01, -87.668]],
];

export function MapFallback({
  rows,
  colors,
  focusId,
  onHover,
  onSelect,
  reduce,
}: {
  rows: PropertySummary[];
  colors: Record<string, string>;
  focusId: string | null;
  onHover: (id: string | null) => void;
  onSelect: (id: string) => void;
  reduce: boolean;
}) {
  const lake = `${path(SHORE)} L${W},${H} L${W},0 Z`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-full w-full" role="group" aria-label="Simplified map of Chicago with the portfolio's hotels" data-testid="map-fallback">
      <rect width={W} height={H} fill="var(--stage)" />
      <path d={lake} fill="color-mix(in oklab, var(--efficient) 18%, var(--stage))" />
      <text x={W - 70} y={H / 2} fill="var(--muted-foreground)" fontSize="13" textAnchor="middle" opacity="0.7">Lake Michigan</text>
      {ROADS.map((r, i) => <path key={i} d={path(r)} fill="none" stroke="var(--muted-foreground)" strokeOpacity="0.22" strokeWidth="2" />)}
      {[RIVER_MAIN, RIVER_NORTH, RIVER_SOUTH].map((r, i) => <path key={i} d={path(r)} fill="none" stroke="color-mix(in oklab, var(--efficient) 55%, var(--stage))" strokeWidth="2.5" />)}
      <text {...project(41.99, -87.905)} fill="var(--muted-foreground)" fontSize="11" opacity="0.8">O'Hare</text>
      <text {...project(41.879, -87.66)} fill="var(--muted-foreground)" fontSize="11" opacity="0.8" textAnchor="end">The Loop</text>
      {rows.map((r) => {
        const { x, y } = project(r.lat, r.lng);
        const on = r.id === focusId;
        return (
          <g
            key={r.id}
            transform={`translate(${x.toFixed(1)},${y.toFixed(1)})`}
            role="button"
            tabIndex={0}
            aria-label={`${r.name}, ${r.neighborhood}`}
            aria-pressed={on}
            data-testid={`marker-${r.id}`}
            className="cursor-pointer outline-none"
            onMouseEnter={() => onHover(r.id)}
            onMouseLeave={() => onHover(null)}
            onFocus={() => onHover(r.id)}
            onBlur={() => onHover(null)}
            onClick={() => onSelect(r.id)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelect(r.id);
              }
            }}
          >
            <circle r={on ? 20 : 15} fill={colors[r.id]} opacity="0.25" className={reduce ? undefined : "animate-pulse"} style={{ transition: reduce ? undefined : "fill 450ms ease" }} />
            <circle r={on ? 9 : 7} fill={colors[r.id]} stroke={r.synthetic ? "var(--background)" : "var(--foreground)"} strokeWidth="2" style={{ transition: reduce ? undefined : "fill 450ms ease" }} />
            {on && <circle r="13" fill="none" stroke="var(--foreground)" strokeWidth="1.5" />}
          </g>
        );
      })}
    </svg>
  );
}
