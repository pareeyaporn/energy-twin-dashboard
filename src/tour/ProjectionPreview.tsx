import type { ProjectionSeries } from "./insights";

const COLORS = ["var(--primary)", "var(--savings)", "var(--heat)"];
const W = 340;
const H = 124;
const PAD = { top: 8, right: 8, bottom: 16, left: 40 };
const usd = (n: number) => `${n < 0 ? "−" : ""}$${Math.round(Math.abs(n)).toLocaleString("en-US")}`;
const kusd = (n: number) => `${n < 0 ? "−" : ""}$${Math.round(Math.abs(n) / 1000)}k`;

/**
 * The tour's 10-year chart: cumulative net benefit of each recommended package, year 0 (the net investment) to year 10. A line crosses
 * zero at payback. Every point comes from the engine's projection; the chart only draws them.
 */
export function ProjectionPreview({ series, reduce }: { series: ProjectionSeries[]; reduce: boolean }) {
  if (series.length === 0) return null;
  const values = series.flatMap((s) => s.cumulative);
  const lo = Math.min(0, ...values);
  const hi = Math.max(0, ...values);
  const span = hi - lo || 1;
  const years = Math.max(...series.map((s) => s.cumulative.length - 1), 1);
  const x = (i: number) => PAD.left + (i / years) * (W - PAD.left - PAD.right);
  const y = (v: number) => PAD.top + ((hi - v) / span) * (H - PAD.top - PAD.bottom);
  const summary = series
    .map((s) => `${s.role}: ${usd(-s.netInvestment)} at year 0, ${usd(s.net10)} after 10 years`)
    .join("; ");

  return (
    <div className="mt-3 rounded-xl border border-primary/25 bg-primary/5 p-2" data-testid="tour-projection">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={`10-year projection, estimate. ${summary}.`}>
        <line x1={PAD.left} x2={W - PAD.right} y1={y(0)} y2={y(0)} stroke="var(--muted-foreground)" strokeDasharray="3 3" strokeWidth={1} />
        <text x={PAD.left - 4} y={y(hi) + 4} textAnchor="end" fontSize={9} fill="var(--muted-foreground)">{kusd(hi)}</text>
        <text x={PAD.left - 4} y={y(0) + 3} textAnchor="end" fontSize={9} fill="var(--muted-foreground)">$0</text>
        {lo < 0 && <text x={PAD.left - 4} y={y(lo)} textAnchor="end" fontSize={9} fill="var(--muted-foreground)">{kusd(lo)}</text>}
        <text x={x(0)} y={H - 3} textAnchor="middle" fontSize={9} fill="var(--muted-foreground)">Year 0</text>
        <text x={x(years)} y={H - 3} textAnchor="end" fontSize={9} fill="var(--muted-foreground)">Year {years}</text>
        {series.map((s, k) => {
          const points = s.cumulative.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
          return (
            <polyline
              key={s.role}
              points={points}
              fill="none"
              stroke={COLORS[k % COLORS.length]}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
              pathLength={1}
              strokeDasharray={reduce ? undefined : 1}
              style={reduce ? undefined : { strokeDashoffset: 1, animation: `tour-draw 1.1s ease-out ${0.15 * k}s forwards` }}
              data-testid="tour-projection-line"
            />
          );
        })}
      </svg>
      <style>{`@keyframes tour-draw { to { stroke-dashoffset: 0; } }`}</style>
      <ul className="mt-1 space-y-0.5 text-[11px]">
        {series.map((s, k) => (
          <li key={s.role} className="flex items-center gap-1.5">
            <span aria-hidden className="inline-block h-0.5 w-3 shrink-0 rounded" style={{ background: COLORS[k % COLORS.length] }} />
            <span className="min-w-0 flex-1 truncate" title={s.name}>{s.role}</span>
            <span className="num shrink-0 text-muted-foreground">{usd(s.netInvestment)} in</span>
            <span className={`num shrink-0 font-medium ${s.net10 < 0 ? "text-heat" : "text-savings"}`}>{usd(s.net10)} at 10 yrs</span>
          </li>
        ))}
      </ul>
      <p className="mt-1 text-[10px] text-muted-foreground">Estimates, mid case. Each line crosses $0 at payback; ranges and the discounted view are in each package.</p>
    </div>
  );
}
