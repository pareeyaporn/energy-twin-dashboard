import type { MetricDef } from "./metrics";
import { colorAt } from "./metrics";

/** The map legend: the metric, its unit, the color scale with the portfolio's lowest, middle and highest values, and what high means. */
export function MapLegend({ def, values }: { def: MetricDef; values: number[] }) {
  const finite = values.filter(Number.isFinite);
  const lo = finite.length ? Math.min(...finite) : 0;
  const hi = finite.length ? Math.max(...finite) : 0;
  const stops = [0, 0.25, 0.5, 0.75, 1].map((t) => colorAt(def.kind, t)).join(", ");
  return (
    <div
      className="pointer-events-none w-[170px] rounded-xl border border-glass-border bg-[oklch(0.18_0.04_263/0.9)] px-2.5 py-1.5 text-[11px] sm:w-[240px] sm:px-3 sm:py-2 shadow-[0_8px_24px_-12px_rgb(0_0_0/0.8)] backdrop-blur"
      data-testid="map-legend"
    >
      <div className="hidden items-baseline justify-between gap-2 sm:flex">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Colored by</span>
        <span className="text-[10px] text-muted-foreground">Estimate</span>
      </div>
      <div className="font-semibold text-foreground">{def.label}</div>
      <div className="hidden text-[10px] text-muted-foreground sm:block">{def.unit}</div>
      <div className="mt-1.5 h-1.5 rounded-full sm:mt-2 sm:h-2 ring-1 ring-white/10" style={{ background: `linear-gradient(90deg, ${stops})` }} aria-hidden />
      <div className="num mt-1 flex justify-between text-[10px] text-foreground/90">
        <span>{def.format(lo)}</span>
        <span className="hidden text-muted-foreground sm:inline">{def.format((lo + hi) / 2)}</span>
        <span>{def.format(hi)}</span>
      </div>
      <div className="mt-0.5 hidden justify-between text-[10px] text-muted-foreground sm:flex">
        <span>Lowest</span>
        <span>Higher = {def.high}</span>
      </div>
    </div>
  );
}
