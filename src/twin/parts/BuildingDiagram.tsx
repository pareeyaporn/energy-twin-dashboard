import { useId } from "react";
import { ZONE_IDS, ZONE_LABELS } from "@/engine/hotel";
import type { ZoneId } from "@/engine/hotel";
import { useTwin } from "@/store/useTwin";
import { selectCompare, selectZoneRows } from "@/store/hotelDerived";
import { intensityColor, percent, usd } from "../format";
import { GhostUpgradeOverlay } from "./GhostUpgrades";
import { VIEW, ZONE_SHAPES } from "./zoneLayout";

/**
 * The building cross-section with six clickable zones, colored by yearly cost (blue = lower, red = higher).
 * Before, after or a split view. Everything shown is read from the store.
 */
export function BuildingDiagram() {
  const uid = useId().replace(/:/g, "");
  const compare = useTwin(selectCompare);
  const rows = useTwin(selectZoneRows);
  const selected = useTwin((s) => s.selectedZone);
  const mode = useTwin((s) => s.compareMode);
  const reduce = useTwin((s) => s.reduceEffects);
  const selectZone = useTwin((s) => s.selectZone);

  const before = (z: ZoneId) => compare.before.byZone[z].cost;
  const after = (z: ZoneId) => compare.after.byZone[z].cost;
  const max = Math.max(1, ...ZONE_IDS.flatMap((z) => [before(z), after(z)]));
  const rowOf = (z: ZoneId) => rows.find((r) => r.zone === z);
  const transition = reduce ? "none" : "fill 400ms ease";
  const split = mode === "split";
  const shownCost = (z: ZoneId) => (mode === "before" ? before(z) : after(z));

  const fills = (cost: (z: ZoneId) => number, clip?: string) => (
    <g clipPath={clip ? `url(#${clip})` : undefined}>
      {ZONE_IDS.flatMap((z) =>
        ZONE_SHAPES[z].rects.map((r, i) => (
          <rect key={`${z}-${i}`} x={r.x} y={r.y} width={r.w} height={r.h} rx="8" fill={intensityColor(cost(z) / max)} fillOpacity="0.85" style={{ transition }} />
        )),
      )}
    </g>
  );

  return (
    <div>
      <svg viewBox={`0 0 ${VIEW.w} ${VIEW.h}`} className="h-auto w-full" role="group" aria-label="Hotel cross-section with six energy zones">
        <defs>
          <clipPath id={`${uid}-left`}>
            <rect x="0" y="0" width="320" height={VIEW.h} />
          </clipPath>
          <clipPath id={`${uid}-right`}>
            <rect x="320" y="0" width="320" height={VIEW.h} />
          </clipPath>
        </defs>
        <line x1="60" y1="412" x2="580" y2="412" stroke="var(--border)" strokeWidth="2" />
        {split ? (
          <>
            {fills(before, `${uid}-left`)}
            {fills(after, `${uid}-right`)}
            <line x1="320" y1="20" x2="320" y2="414" stroke="var(--foreground)" strokeWidth="1.5" strokeDasharray="4 4" opacity="0.6" />
            <text x="200" y="16" textAnchor="middle" fontSize="12" fill="var(--muted-foreground)">Before</text>
            <text x="440" y="16" textAnchor="middle" fontSize="12" fill="var(--muted-foreground)">After</text>
          </>
        ) : (
          fills(mode === "before" ? before : after)
        )}

        <GhostUpgradeOverlay />

        {ZONE_IDS.map((z) => {
          const shape = ZONE_SHAPES[z];
          const row = rowOf(z);
          const label = ZONE_LABELS[z];
          const cost = shownCost(z);
          const isSel = selected === z;
          const changed = split && Math.abs(after(z) - before(z)) >= 1;
          return (
            <g
              key={z}
              role="button"
              tabIndex={0}
              aria-pressed={isSel}
              aria-label={`${label}: ${usd(cost)} a year${row ? `, ${percent(row.costShare)} of the total` : ""}`}
              className="cursor-pointer outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
              onClick={() => selectZone(isSel ? null : z)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  selectZone(isSel ? null : z);
                }
              }}
            >
              {shape.rects.map((r, i) => (
                <rect key={i} x={r.x} y={r.y} width={r.w} height={r.h} rx="8" fill="transparent" stroke={isSel ? "var(--primary)" : "var(--glass-border)"} strokeWidth={isSel ? 3 : 1.5} />
              ))}
              {z === "hallways_shared" ? (
                <text x={shape.label.x} y={shape.label.y} textAnchor="middle" fontSize="11" fill="var(--foreground)" transform={`rotate(-90 ${shape.label.x} ${shape.label.y})`}>
                  {shape.short} {usd(cost)}
                </text>
              ) : (
                <>
                  <text x={shape.label.x} y={shape.label.y} textAnchor="middle" fontSize="14" fontWeight="600" fill="var(--foreground)">{shape.short}</text>
                  <text x={shape.label.x} y={shape.label.y + 18} textAnchor="middle" fontSize="13" fill="var(--foreground)">{usd(cost)} / yr</text>
                  {changed && (
                    <text x={shape.label.x} y={shape.label.y + 34} textAnchor="middle" fontSize="11" fill="var(--foreground)" fillOpacity="0.85">was {usd(before(z))}</text>
                  )}
                </>
              )}
            </g>
          );
        })}
      </svg>
      <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground" aria-hidden="true">
        <span>Lower cost</span>
        <span className="h-2 flex-1 rounded-full" style={{ background: "var(--gradient-thermal)" }} />
        <span>Higher cost</span>
      </div>
    </div>
  );
}
