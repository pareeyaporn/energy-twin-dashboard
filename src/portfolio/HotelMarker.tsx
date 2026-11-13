import { Building2 } from "lucide-react";
import { usd } from "@/twin/format";
import type { PropertySummary } from "@/engine/hotel";

/** The markers' keyframes (a slow glow pulse, the selected hotel's beam shimmer), added to the page once. */
const MARKER_CSS = `
@keyframes et-marker-pulse { 0%, 100% { opacity: .35; transform: translate(-50%, -50%) scale(.9); } 50% { opacity: .75; transform: translate(-50%, -50%) scale(1.15); } }
@keyframes et-marker-beam { 0%, 100% { opacity: .55; } 50% { opacity: .9; } }
@media (prefers-reduced-motion: reduce) { .et-marker-anim { animation: none !important; } }
`;
function ensureMarkerCss() {
  if (typeof document === "undefined" || document.getElementById("et-marker-css")) return;
  const el = document.createElement("style");
  el.id = "et-marker-css";
  el.textContent = MARKER_CSS;
  document.head.appendChild(el);
}

/**
 * One hotel on the map (street map and drawn map alike). Drawn at the hotel's position; when it has to move aside so close hotels stay
 * selectable (`dx`, `dy`), a dot and a thin line keep pointing at the true location. Colored by the selected metric; a tooltip shows the
 * hotel's value while hovered or focused.
 */
export function HotelMarker({
  row,
  color,
  rank,
  dx = 0,
  dy = 0,
  hovered,
  selected,
  valueText,
  metricLabel,
  onHover,
  onSelect,
  reduce,
  beam = false,
}: {
  row: PropertySummary;
  color: string;
  rank: number;
  dx?: number;
  dy?: number;
  hovered: boolean;
  selected: boolean;
  valueText: string;
  metricLabel: string;
  onHover: (id: string | null) => void;
  onSelect: (id: string) => void;
  reduce: boolean;
  /** 3D street map: a soft light beam rises from the selected hotel. */
  beam?: boolean;
}) {
  if (!reduce) ensureMarkerCss();
  const moved = Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5;
  const tipId = `marker-tip-${row.id}`;
  const ease = reduce ? undefined : "transform 260ms cubic-bezier(.2,.8,.2,1)";
  return (
    <div className="pointer-events-none absolute left-0 top-0 h-0 w-0" data-marker-root={row.id}>
      {moved && (
        <svg aria-hidden className="absolute left-0 top-0 overflow-visible" width="1" height="1">
          <line x1="0" y1="0" x2={dx} y2={dy} stroke={color} strokeOpacity="0.7" strokeWidth="1.25" strokeDasharray="2 2" />
          <circle r="3" fill={color} stroke="rgb(2 6 23)" strokeWidth="1" />
        </svg>
      )}
      <div className="absolute left-0 top-0" style={{ transform: `translate(${dx}px, ${dy}px)`, transition: ease }}>
        {/* A soft halo in the metric color that breathes slowly (none with reduced effects or reduced motion). */}
        {!reduce && (
          <span
            aria-hidden
            className="et-marker-anim absolute left-0 top-0 size-12 rounded-full"
            style={{
              background: `radial-gradient(circle, color-mix(in oklab, ${color} ${selected ? 55 : 35}%, transparent) 0%, transparent 70%)`,
              transform: "translate(-50%, -50%)",
              animation: `et-marker-pulse ${selected ? 2.4 : 3.6}s ease-in-out infinite`,
              transition: "background 450ms ease",
            }}
            data-testid={`marker-pulse-${row.id}`}
          />
        )}
        {selected && beam && (
          <span
            aria-hidden
            className={`${reduce ? "" : "et-marker-anim "}absolute bottom-3 left-0 h-24 w-[3px] -translate-x-1/2 rounded-full`}
            style={{
              background: `linear-gradient(to top, color-mix(in oklab, ${color} 85%, white), color-mix(in oklab, ${color} 40%, transparent) 55%, transparent)`,
              boxShadow: `0 0 10px 2px color-mix(in oklab, ${color} 35%, transparent)`,
              opacity: reduce ? 0.7 : undefined,
              animation: reduce ? undefined : "et-marker-beam 2.4s ease-in-out infinite",
            }}
            data-testid={`marker-beam-${row.id}`}
          />
        )}
        {selected && !reduce && (
          <span aria-hidden className="et-marker-anim absolute -left-6 -top-6 size-12 animate-ping rounded-full border border-primary/60 [animation-duration:2.2s]" />
        )}
        <button
          type="button"
          data-testid={`marker-${row.id}`}
          aria-label={`${row.name}, ${row.neighborhood}. ${metricLabel} ${valueText}, rank ${rank}.${row.synthetic ? "" : " Your hotel."}`}
          aria-pressed={selected}
          aria-describedby={hovered ? tipId : undefined}
          onMouseEnter={() => onHover(row.id)}
          onMouseLeave={() => onHover(null)}
          onFocus={() => onHover(row.id)}
          onBlur={() => onHover(null)}
          onClick={(e) => {
            e.stopPropagation();
            onSelect(row.id);
          }}
          className="pointer-events-auto absolute flex size-8 -translate-x-1/2 -translate-y-1/2 cursor-pointer items-center justify-center rounded-[10px] border-2 bg-[oklch(0.2_0.045_263)] outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-[oklch(0.2_0.045_263)]"
          style={{
            borderColor: color,
            color,
            scale: selected ? "1.18" : hovered ? "1.08" : "1",
            boxShadow: reduce
              ? undefined
              : `0 0 0 ${selected ? 3 : 1}px color-mix(in oklab, ${selected ? "white" : color} ${selected ? 85 : 35}%, transparent), 0 0 ${selected || hovered ? 22 : 14}px ${selected || hovered ? 5 : 2}px color-mix(in oklab, ${color} ${selected || hovered ? 60 : 40}%, transparent), 0 6px 14px -6px rgb(0 0 0 / 0.7)`,
            transition: reduce ? undefined : "scale 200ms ease, box-shadow 250ms ease, border-color 450ms ease, color 450ms ease",
          }}
        >
          <Building2 className="size-4" strokeWidth={2.25} aria-hidden />
          <span
            aria-hidden
            className="num absolute -right-2 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full border border-[rgb(2_6_23)] px-1 text-[9px] font-semibold leading-none text-[rgb(2_6_23)]"
            style={{ background: color, transition: reduce ? undefined : "background 450ms ease" }}
          >
            {rank}
          </span>
          {!row.synthetic && <span aria-hidden className="absolute -bottom-1 -left-1 size-2.5 rounded-full border border-[rgb(2_6_23)] bg-foreground" />}
        </button>
        {hovered && !selected && (
          <div
            id={tipId}
            role="tooltip"
            className="absolute bottom-6 left-0 w-max max-w-[240px] -translate-x-1/2 rounded-lg border border-primary/25 bg-[oklch(0.18_0.04_263/0.96)] px-2.5 py-1.5 text-[11px] shadow-[0_8px_24px_-8px_rgb(0_0_0/0.8)] backdrop-blur"
            data-testid="marker-tooltip"
          >
            <div className="font-semibold leading-tight text-foreground">{row.name}</div>
            <div className="text-[10px] text-muted-foreground">{row.neighborhood}, {row.city} · {row.rooms} rooms</div>
            <div className="mt-0.5 flex items-center gap-1.5 text-muted-foreground">
              <span className="size-1.5 rounded-full" style={{ background: color }} aria-hidden />
              {metricLabel} <span className="num font-medium text-foreground">{valueText}</span>
            </div>
            <dl className="mt-1 grid grid-cols-2 gap-x-3 text-[10px]">
              <dt className="text-muted-foreground">Energy cost</dt><dd className="num text-right">{usd(row.annual.cost)}</dd>
              <dt className="text-muted-foreground">Intensity</dt><dd className="num text-right">{row.siteEui.toFixed(1)} kBtu/ft²</dd>
              <dt className="text-muted-foreground">Savings</dt><dd className="num text-right">{row.potential ? `${usd(row.potential.annualSavings)}/yr` : "—"}</dd>
              <dt className="text-muted-foreground">Priority</dt><dd className="num text-right">{row.priorityScore}/100</dd>
            </dl>
            <div className="mt-0.5 text-[10px] text-primary/90">Click to open · Explore hotel</div>
          </div>
        )}
      </div>
    </div>
  );
}
