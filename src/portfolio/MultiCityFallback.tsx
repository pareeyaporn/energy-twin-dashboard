import { useEffect, useRef } from "react";
import { MapPin } from "lucide-react";
import { HotelMarker } from "./HotelMarker";
import { BASEMAP } from "./MapLibreView";
import type { MapViewProps } from "./mapTypes";
import { spreadOffsets } from "./spread";
import { cityGroups } from "./cities";

const PANEL_H = 190;
const PAD = 34;

/**
 * The drawn map for hotels in several cities (or one city other than Chicago, which the drawn Chicago map does not cover): a schematic
 * with one panel per city. No streets or coastlines are drawn (none are sourced for these cities); inside a panel the hotels keep their
 * relative positions, scaled to fit, and the panels are not to scale with each other. Same markers, hover, selection and keyboard
 * behavior as the other maps.
 */
export function MultiCityFallback({ rows, colors, ranks, hoverId, selectedId, metricLabel, valueText, onHover, onSelect, onBackground, flyTo, cityValueText, selectedOffset, reduce }: MapViewProps & { selectedOffset: boolean }) {
  const groups = cityGroups(rows);
  const panelRefs = useRef<Record<string, HTMLElement | null>>({});
  // "Fly to" a hotel: bring its city's panel into view.
  useEffect(() => {
    const r = flyTo && rows.find((x) => x.id === flyTo.id);
    if (!r) return;
    panelRefs.current[r.city]?.scrollIntoView?.({ block: "nearest", behavior: "smooth" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flyTo?.n]);
  return (
    <div
      className={`relative h-full w-full overflow-y-auto p-3 pb-32 lg:pr-[19.5rem] ${selectedOffset ? "sm:pl-[330px]" : ""}`}
      style={{ background: BASEMAP.background }}
      role="group"
      aria-label={`Schematic map of the portfolio's hotels in ${groups.length} ${groups.length === 1 ? "city" : "cities"}`}
      data-testid="map-fallback-cities"
      onClick={onBackground}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        {groups.map((g) => {
          const hotels = rows.filter((r) => r.city === g.city);
          const lats = hotels.map((r) => r.lat);
          const lngs = hotels.map((r) => r.lng);
          const cos = Math.cos((g.lat * Math.PI) / 180);
          const spanLat = Math.max(0.01, Math.max(...lats) - Math.min(...lats));
          const spanLng = Math.max(0.01, (Math.max(...lngs) - Math.min(...lngs)) * cos);
          // Each panel is sized by its own container; positions are a share of the inner box (percent), so it works at any width.
          const pos = (r: (typeof hotels)[number]) => ({
            x: hotels.length === 1 ? 0.5 : ((r.lng - Math.min(...lngs)) * cos) / spanLng,
            y: hotels.length === 1 ? 0.5 : (Math.max(...lats) - r.lat) / spanLat,
          });
          const pts = hotels.map((r) => ({ id: r.id, x: pos(r).x * 300, y: pos(r).y * (PANEL_H - 2 * PAD) }));
          const offsets = spreadOffsets(pts);
          return (
            <section
              key={g.city}
              ref={(el) => {
                panelRefs.current[g.city] = el;
              }}
              aria-label={`${g.city}, ${hotels.length} hotel${hotels.length === 1 ? "" : "s"}`}
              className="relative overflow-hidden rounded-xl border border-glass-border"
              style={{ background: BASEMAP.land, height: PANEL_H }}
              data-testid={`city-panel-${g.city}`}
            >
              <svg className="absolute inset-0 h-full w-full" aria-hidden>
                <defs>
                  <pattern id={`mc-grid-${g.city.replace(/\s/g, "")}`} width="32" height="32" patternUnits="userSpaceOnUse">
                    <path d="M32 0H0V32" fill="none" stroke="#ffffff" strokeOpacity="0.03" />
                  </pattern>
                </defs>
                <rect width="100%" height="100%" fill={`url(#mc-grid-${g.city.replace(/\s/g, "")})`} />
              </svg>
              <header className="absolute left-2.5 top-2 flex items-center gap-1.5 text-[11px]">
                <MapPin className="size-3 text-primary" aria-hidden />
                <span className="font-semibold uppercase tracking-[0.14em]" style={{ color: BASEMAP.label }}>{g.city}, {g.state}</span>
                <span className="text-muted-foreground">· {hotels.length} hotel{hotels.length === 1 ? "" : "s"}</span>
              </header>
              {cityValueText && <span className="num absolute right-2.5 top-2 text-[10px] text-muted-foreground">{cityValueText(g.city)}</span>}
              <div className="absolute" style={{ left: PAD, right: PAD, top: PAD + 6, bottom: PAD - 6 }}>
                {hotels.map((r) => {
                  const p = pos(r);
                  const o = offsets[r.id];
                  return (
                    <div key={r.id} className="absolute" style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%`, zIndex: r.id === hoverId ? 40 : r.id === selectedId ? 30 : 1 }}>
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
            </section>
          );
        })}
      </div>
      <p className="mt-2 text-[10px] text-muted-foreground">Schematic: one panel per city, not to scale with each other; hotel positions within a city are relative.</p>
    </div>
  );
}
