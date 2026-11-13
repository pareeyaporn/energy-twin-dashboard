import { Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CheckCircle2, CircleAlert, Info } from "lucide-react";
import type { FitMetrics, FuelCalibration } from "@/engine/hotel";
import { CALIBRATION_RULES, GUIDELINE_14_MONTHLY } from "@/engine/hotel";
import { useTwin } from "@/store/useTwin";
import { selectUtilityAnalysis, selectUtilityKey, selectUtilitySet, selectUtilityStatus } from "@/store/hotelDerived";
import type { UtilityAnalysis } from "@/store/hotelDerived";

const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const int = (n: number) => Math.round(n).toLocaleString("en-US");
const usd = (n: number) => `${n < 0 ? "−" : ""}$${Math.round(Math.abs(n)).toLocaleString("en-US")}`;
const pct = (n: number) => `${n >= 0 ? "+" : "−"}${Math.abs(n).toFixed(1)}%`;
const diff = (a: number, b: number) => (b > 0 ? ((a - b) / b) * 100 : 0);

function rowLabel(r: FuelCalibration["rows"][number]) {
  return r.start ? `${r.start.slice(5)}→${r.end!.slice(5)}` : MON[r.month]!;
}

function Metrics({ m }: { m: FitMetrics | null }) {
  if (!m) return <span className="text-muted-foreground">—</span>;
  return (
    <span className="num">
      NMBE {m.nmbePct.toFixed(1)}% · CV(RMSE) {m.cvrmsePct.toFixed(1)}%
    </span>
  );
}

function FuelPanel({ f }: { f: FuelCalibration }) {
  const name = f.fuel === "elec" ? "Electricity" : "Natural gas";
  if (f.bills === 0) return null;
  const data = f.rows.map((r) => ({ label: rowLabel(r), actual: r.actual, modeled: r.modeled, ...(f.usable ? { calibrated: r.calibrated } : {}) }));
  const meets = f.after?.meetsGuideline14;
  return (
    <section className="space-y-3 rounded-xl border border-glass-border p-3" aria-label={`${name} comparison`} data-testid={`calibration-${f.fuel}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">{name} <span className="font-normal text-muted-foreground">({f.unit})</span></h3>
        {f.usable ? (
          <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] ${meets ? "border-savings/40 text-savings" : "border-amber-500/50 text-amber-400"}`}>
            {meets ? <CheckCircle2 className="size-3" /> : <CircleAlert className="size-3" />}
            {meets ? "Meets ASHRAE Guideline 14 monthly criteria" : "Calibrated, but outside Guideline 14 criteria"}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground"><CircleAlert className="size-3" />Not calibrated — modeled values kept</span>
        )}
      </div>
      <div className="h-48 w-full" role="img" aria-label={`${name}: bills against the original model${f.usable ? " and the calibrated model" : ""}, by bill`}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid stroke="var(--border)" strokeOpacity={0.4} vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} stroke="var(--border)" interval={0} />
            <YAxis width={54} tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} stroke="var(--border)" tickFormatter={(v: number) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))} />
            <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", fontSize: 11 }} formatter={(v: unknown, n: string) => [`${int(Number(v))} ${f.unit}`, n]} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="actual" name="Bills (actual)" fill="var(--primary)" fillOpacity={0.55} isAnimationActive={false} />
            <Line dataKey="modeled" name="Original model" stroke="var(--muted-foreground)" strokeDasharray="5 4" dot={false} strokeWidth={1.5} isAnimationActive={false} />
            {f.usable && <Line dataKey="calibrated" name="Calibrated model" stroke="var(--savings)" dot={false} strokeWidth={2} isAnimationActive={false} />}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <dl className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
        <div className="rounded-lg bg-muted/30 p-2"><dt className="text-muted-foreground">Bills (actual)</dt><dd className="num font-medium">{int(f.actualTotal)}</dd></div>
        <div className="rounded-lg bg-muted/30 p-2"><dt className="text-muted-foreground">Original model</dt><dd className="num font-medium">{int(f.modeledTotal)} <span className="text-muted-foreground">({pct(diff(f.modeledTotal, f.actualTotal))})</span></dd></div>
        <div className="rounded-lg bg-muted/30 p-2"><dt className="text-muted-foreground">Calibrated</dt><dd className="num font-medium">{f.usable ? <>{int(f.calibratedTotal)} <span className="text-muted-foreground">({pct(diff(f.calibratedTotal, f.actualTotal))})</span></> : "—"}</dd></div>
        <div className="rounded-lg bg-muted/30 p-2"><dt className="text-muted-foreground">Coverage</dt><dd className="num font-medium">{f.bills} bills · {f.coverageDays} days</dd></div>
      </dl>
      <table className="w-full text-xs">
        <caption className="sr-only">{name} fit before and after calibration</caption>
        <tbody>
          <tr className="border-b border-border/40"><th className="py-1 text-left font-normal text-muted-foreground">Original model vs bills</th><td className="py-1 text-right"><Metrics m={f.before} /></td></tr>
          <tr className="border-b border-border/40"><th className="py-1 text-left font-normal text-muted-foreground">Calibrated model vs bills</th><td className="py-1 text-right"><Metrics m={f.usable ? f.after : null} /></td></tr>
          {f.usable && (
            <tr>
              <th className="py-1 text-left font-normal text-muted-foreground">Fitted factors {f.mode === "base_only" ? "(base only)" : ""}</th>
              <td className="num py-1 text-right">weather-independent ×{f.factors.base.toFixed(3)} · weather-driven ×{f.factors.weather.toFixed(3)}</td>
            </tr>
          )}
        </tbody>
      </table>
      {f.reason && <p className="text-xs text-muted-foreground">{f.reason}</p>}
    </section>
  );
}

function SpendPanel({ a }: { a: UtilityAnalysis }) {
  const set = useTwin(selectUtilitySet);
  const rows = (set?.records ?? []).filter((r) => !r.start && (r.elecCost !== undefined || r.gasCost !== undefined));
  if (rows.length < 2) return null;
  const data = rows.map((r) => ({
    label: MON[r.month]!,
    actual: (r.elecCost ?? 0) + (r.gasCost ?? 0),
    modeled: a.modeled.months[r.month]!.totals.cost,
    ...(a.report.usable ? { calibrated: a.calibrated.months[r.month]!.totals.cost } : {}),
  }));
  return (
    <section className="space-y-2 rounded-xl border border-glass-border p-3" aria-label="Utility spending comparison" data-testid="calibration-spend">
      <h3 className="text-sm font-semibold">Utility spending <span className="font-normal text-muted-foreground">($ per month)</span></h3>
      <div className="h-40 w-full" role="img" aria-label="Billed spending against modeled spending by month">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid stroke="var(--border)" strokeOpacity={0.4} vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} stroke="var(--border)" />
            <YAxis width={54} tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} stroke="var(--border)" tickFormatter={(v: number) => `$${Math.round(v / 1000)}k`} />
            <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", fontSize: 11 }} formatter={(v: unknown, n: string) => [usd(Number(v)), n]} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="actual" name="Billed" fill="var(--heat)" fillOpacity={0.5} isAnimationActive={false} />
            <Line dataKey="modeled" name="Original model" stroke="var(--muted-foreground)" strokeDasharray="5 4" dot={false} isAnimationActive={false} />
            {a.report.usable && <Line dataKey="calibrated" name="Calibrated model" stroke="var(--savings)" dot={false} strokeWidth={2} isAnimationActive={false} />}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <p className="text-[11px] text-muted-foreground">Modeled spending uses {set?.useBillRates ? "your bills' average rates" : "the state average rates"}; billed spending is what the bills say.</p>
    </section>
  );
}

/** Compare the saved records with the model, show the calibration and let the user choose the baseline. */
export function CalibrationReview() {
  const a = useTwin((s) => selectUtilityAnalysis(s));
  const key = useTwin(selectUtilityKey);
  const set = useTwin(selectUtilitySet);
  const status = useTwin(selectUtilityStatus);
  const choose = useTwin((s) => s.setUtilityBaseline);
  if (!a || !set) return <p className="text-sm text-muted-foreground">No utility data saved for this hotel yet.</p>;
  const active = set.baseline;
  return (
    <div className="space-y-4" data-testid="calibration-review">
      <ol className="flex flex-wrap items-center gap-2 text-xs" aria-label="Steps">
        {["Compare with model", "Calibrate", "Review results"].map((step, i) => (
          <li key={step} className="flex items-center gap-2">
            <span className="grid size-5 place-items-center rounded-full bg-primary/20 text-[10px] font-semibold text-primary">{i + 1}</span>
            {step}
            {i < 2 && <span className="text-muted-foreground">→</span>}
          </li>
        ))}
      </ol>
      <div className="grid gap-3 lg:grid-cols-2">
        <FuelPanel f={a.report.elec} />
        <FuelPanel f={a.report.gas} />
      </div>
      <SpendPanel a={a} />
      <section className="space-y-2 rounded-xl border border-primary/30 bg-primary/5 p-3" aria-label="Simulation baseline">
        <h3 className="text-sm font-semibold">Which baseline should Energy Twin use for this hotel?</h3>
        <div role="radiogroup" aria-label="Simulation baseline" className="grid gap-2 sm:grid-cols-2">
          {(["modeled", "calibrated"] as const).map((b) => {
            const disabled = b === "calibrated" && !a.report.usable;
            const on = active === b && (b === "modeled" || status === "calibrated");
            return (
              <button
                key={b}
                type="button"
                role="radio"
                aria-checked={on}
                disabled={disabled}
                onClick={() => choose(key, b)}
                data-testid={`baseline-${b}`}
                className={`rounded-lg border p-3 text-left text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${on ? "border-primary bg-primary/15" : "border-border hover:border-primary/50"}`}
              >
                <span className="flex items-center justify-between font-medium text-sm">
                  {b === "modeled" ? "Original modeled baseline" : "Calibrated baseline"}
                  {on && <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] text-primary-foreground">Active</span>}
                </span>
                <span className="mt-1 block text-muted-foreground">
                  {b === "modeled"
                    ? `Energy Twin's estimate: ${usd(a.modeled.annual.cost)} a year (benchmarks for this building, weather and prices).`
                    : a.report.usable
                      ? `Adjusted to these bills: ${usd(a.calibrated.annual.cost)} a year. Upgrades, scenarios, stress tests and the portfolio use it.`
                      : "Not available: the records cannot calibrate the model (see the reasons above)."}
                </span>
              </button>
            );
          })}
        </div>
        <p className="text-[11px] text-muted-foreground">
          Switching recomputes every result for this hotel; investment results made on the other baseline are cleared. The original model stays available.
        </p>
      </section>
      <details className="rounded-lg border border-border p-3 text-xs text-muted-foreground">
        <summary className="cursor-pointer font-medium text-foreground"><Info className="mr-1 inline size-3.5" />How the calibration works and its limits</summary>
        <div className="mt-2 space-y-2">
          <p>For each fuel the model's use is split into a weather-independent part (base loads, occupancy, schedules) and a weather-driven part (heating, cooling and fan energy that follows degree days). Two multipliers, each kept between {CALIBRATION_RULES.factorBounds[0]}× and {CALIBRATION_RULES.factorBounds[1]}×, are fitted to the bills by least squares; when the weather part is small or too steady between bills, only the first is fitted. Bills with dates are compared with the model's days in that billing period, not a whole month.</p>
          <p><strong>NMBE</strong> (normalized mean bias error) is the overall over- or under-prediction; <strong>CV(RMSE)</strong> (coefficient of variation of the root-mean-square error) is the typical bill-by-bill miss. ASHRAE Guideline 14 counts a monthly model calibrated when, over 12 bills, NMBE is within ±{GUIDELINE_14_MONTHLY.nmbePct}% and CV(RMSE) at most {GUIDELINE_14_MONTHLY.cvrmsePct}%. Energy Twin uses a fuel's calibration only with 12 bills covering at least {CALIBRATION_RULES.minCoverageDays} days and a CV(RMSE) of at most {CALIBRATION_RULES.maxCvrmsePct}%.</p>
          <p><strong>Limits:</strong> the bills are compared with a normal-weather year (NOAA 1991–2020), not the weather of the billing year, so an unusually hot or cold year shows up in the factors. Monthly bills say nothing about individual hours: the hourly twin stays a simulation, not a measurement. Calibrated results are still estimates.</p>
        </div>
      </details>
    </div>
  );
}
