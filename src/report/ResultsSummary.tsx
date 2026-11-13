import { useMemo, useState } from "react";
import { ChevronDown, CircleCheck, CircleAlert, CircleX } from "lucide-react";
import { useTwin } from "@/store/useTwin";
import { cn } from "@/lib/utils";
import type { HotelReportData, ReportMetricPair } from "./data";
import { aiReportFromState, customReportFromState, portfolioReportFromState } from "./fromStore";
import { ReportActions } from "./ReportActions";

// The investment results, written for an owner: what it costs, what it saves, when it pays back, what it is worth, and which upgrades
// do it. Every figure is the report data built from the engine's evaluation (the same data as the PDF).
const usd = (n: number) => `${n < 0 ? "-" : ""}$${Math.round(Math.abs(n)).toLocaleString("en-US")}`;
const num = (n: number, d = 0) => n.toLocaleString("en-US", { maximumFractionDigits: d, minimumFractionDigits: d });
const pct = (r: number) => `${Math.round(r * 100)}%`;
const yrs = (n: number | null) => (n === null ? "No payback" : `${n.toFixed(1)} years`);
const COLORS = ["var(--primary)", "var(--savings)", "var(--heat)", "oklch(0.7 0.12 260)", "oklch(0.75 0.13 320)", "oklch(0.8 0.1 120)", "oklch(0.7 0.1 30)", "oklch(0.72 0.08 200)"];

function Tile({ label, value, note, tone, question }: { label: string; value: string; note?: string | undefined; tone?: "good" | "bad" | undefined; question?: string | undefined }) {
  return (
    <div className="min-w-0 rounded-lg border border-glass-border bg-background/40 p-2.5" title={question}>
      <dt className="text-[11px] text-muted-foreground">{label}</dt>
      <dd className={cn("num mt-0.5 text-base font-semibold tabular-nums", tone === "good" && "text-savings", tone === "bad" && "text-heat")}>{value}</dd>
      {note && <dd className="text-[10px] text-muted-foreground">{note}</dd>}
    </div>
  );
}

function fmtPair(c: ReportMetricPair, v: number) {
  if (c.unit.startsWith("$")) return usd(v);
  return num(v, c.unit.startsWith("kBtu") || c.unit.startsWith("t ") ? 1 : 0);
}

function BeforeAfter({ rows }: { rows: ReportMetricPair[] }) {
  return (
    <ul className="space-y-2" aria-label="Before and after the upgrades">
      {rows.map((c) => {
        const max = Math.max(Math.abs(c.before), Math.abs(c.after), 1);
        const better = c.lowerIsBetter ? c.change < 0 : c.change > 0;
        const flat = Math.abs(c.changePct ?? 0) < 0.0005;
        return (
          <li key={c.label} className="text-xs" data-testid="before-after-row">
            <div className="flex flex-wrap items-baseline justify-between gap-x-2">
              <span className="font-medium">{c.label} <span className="text-[10px] text-muted-foreground">({c.unit})</span></span>
              <span className={cn("num tabular-nums", flat ? "text-muted-foreground" : better ? "text-savings" : "text-heat")}>
                {c.change > 0 ? "+" : ""}{fmtPair(c, c.change)}{c.changePct !== null ? ` (${c.changePct > 0 ? "+" : ""}${(c.changePct * 100).toFixed(1)}%)` : ""}
              </span>
            </div>
            <div className="mt-1 grid grid-cols-[3.2rem_1fr] items-center gap-x-2 gap-y-0.5 text-[10px] text-muted-foreground">
              <span>Before</span>
              <span className="flex items-center gap-1.5"><span className="h-1.5 rounded-full bg-muted-foreground/50" style={{ width: `${(Math.abs(c.before) / max) * 70}%` }} /><span className="num tabular-nums">{fmtPair(c, c.before)}</span></span>
              <span>After</span>
              <span className="flex items-center gap-1.5"><span className="h-1.5 rounded-full bg-primary" style={{ width: `${(Math.abs(c.after) / max) * 70}%` }} /><span className="num tabular-nums text-foreground">{fmtPair(c, c.after)}</span></span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function Contribution({ d }: { d: HotelReportData }) {
  const total = d.financial.annualSavings;
  const positive = d.upgrades.filter((u) => u.annualSavings > 0);
  const sum = positive.reduce((s, u) => s + u.annualSavings, 0);
  if (!d.contributionsAdd || sum <= 0) {
    return <p className="text-xs text-muted-foreground">Combined savings: {usd(total)} a year. The upgrades interact, so their individual effects are not additive.</p>;
  }
  return (
    <div className="space-y-1.5" data-testid="savings-contribution">
      <div className="flex h-3 overflow-hidden rounded-full bg-muted" role="img" aria-label={`Savings by upgrade: ${d.upgrades.map((u) => `${u.label} ${usd(u.annualSavings)}`).join(", ")}`}>
        {positive.map((u, i) => <span key={u.id} style={{ width: `${(u.annualSavings / sum) * 100}%`, background: COLORS[i % COLORS.length] }} />)}
      </div>
      <ul className="grid gap-x-3 gap-y-0.5 text-[11px] sm:grid-cols-2">
        {d.upgrades.map((u) => {
          const i = positive.indexOf(u);
          return (
            <li key={u.id} className="flex items-center gap-1.5">
              <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ background: i >= 0 ? COLORS[i % COLORS.length] : "var(--heat)" }} />
              <span className="min-w-0 flex-1 truncate">{u.label}</span>
              <span className={cn("num tabular-nums", u.annualSavings < 0 ? "text-heat" : "text-muted-foreground")}>{usd(u.annualSavings)}{total > 0 ? ` · ${pct(u.annualSavings / total)}` : ""}</span>
            </li>
          );
        })}
      </ul>
      <p className="text-[10px] text-muted-foreground">
        Each upgrade's share as the model applies them one after another, interactions included (for example LED lighting adds a little heating), so the shares add up to the package's {usd(total)} a year without double counting. The split depends on that order.
      </p>
    </div>
  );
}

function Breakdown({ d }: { d: HotelReportData }) {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <ul className="divide-y divide-border rounded-lg border border-glass-border" aria-label="Upgrades in this plan">
      {d.upgrades.map((u) => {
        const isOpen = open === u.id;
        const applied = u.incentives.filter((x) => x.applied);
        return (
          <li key={u.id} className="text-xs" data-testid="upgrade-line">
            <button type="button" className="flex w-full items-center gap-2 p-2.5 text-left hover:bg-accent/40" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : u.id)}>
              <span className="min-w-0 flex-1">
                <span className="block font-medium">{u.label}</span>
                <span className="block truncate text-[10px] text-muted-foreground">{u.quantity}</span>
              </span>
              <span className="num shrink-0 text-right tabular-nums">
                <span className="block">{usd(u.installedCost)}</span>
                <span className="block text-[10px] text-savings">{usd(u.annualSavings)} / yr</span>
              </span>
              <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition-transform", isOpen && "rotate-180")} aria-hidden />
            </button>
            {isOpen && (
              <div className="space-y-1.5 px-2.5 pb-2.5">
                {u.description && <p className="text-muted-foreground">{u.description}</p>}
                <dl className="grid grid-cols-2 gap-x-3 gap-y-1 sm:grid-cols-3">
                  <div><dt className="text-[10px] text-muted-foreground">Installed cost</dt><dd className="num tabular-nums">{usd(u.installedCost)} <span className="text-[10px] text-muted-foreground">({usd(u.costRange[0])}–{usd(u.costRange[1])})</span></dd></div>
                  <div><dt className="text-[10px] text-muted-foreground">Saves a year</dt><dd className="num tabular-nums">{usd(u.annualSavings)}</dd></div>
                  <div><dt className="text-[10px] text-muted-foreground">Pays for itself in</dt><dd className={cn("num tabular-nums", u.paybackBeyondLife && "text-heat")}>{u.paybackYears === null ? "No payback alone" : `${u.paybackYears.toFixed(1)} years`}{u.paybackBeyondLife ? " (longer than its life)" : ""}</dd></div>
                  <div><dt className="text-[10px] text-muted-foreground">Expected life</dt><dd className="num tabular-nums">{u.lifetimeYears} years</dd></div>
                  <div className="col-span-2"><dt className="text-[10px] text-muted-foreground">Incentives</dt><dd>{applied.length ? applied.map((x) => `${x.label}: ${usd(x.amount)}`).join("; ") : u.incentives.length ? "Listed, not counted (unverified)" : "None counted"}</dd></div>
                </dl>
                <p className="text-[10px] text-muted-foreground"><span className="font-medium">Key assumptions:</span> {u.source.length > 360 ? `${u.source.slice(0, 357)}…` : u.source}</p>
                <p className="text-[10px] text-muted-foreground">Line payback = installed cost ÷ this upgrade's contribution, before incentives.</p>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function Verdict({ v }: { v: HotelReportData["interpretation"] }) {
  const Icon = v.verdict === "attractive" ? CircleCheck : v.verdict === "marginal" ? CircleAlert : CircleX;
  const tone = v.verdict === "attractive" ? "border-savings/40 bg-savings/10" : v.verdict === "marginal" ? "border-heat/40 bg-heat/10" : "border-loss/50 bg-loss/10";
  return (
    <section aria-label="What this means" className={cn("space-y-1 rounded-lg border p-3 text-xs", tone)} data-testid="plan-interpretation" data-verdict={v.verdict}>
      <h4 className="flex items-start gap-1.5 font-semibold"><Icon className="mt-px size-4 shrink-0" aria-hidden /> {v.headline}</h4>
      {v.sentences.map((s, i) => <p key={i} className="text-muted-foreground">{s}</p>)}
    </section>
  );
}

/** The full results view for one plan (AI or custom). */
export function ResultsSummary({ d, compact = false, show = "all" }: { d: HotelReportData; compact?: boolean; show?: "all" | "extras" }) {
  const f = d.financial;
  const [section, setSection] = useState<"before" | "upgrades">("before");
  return (
    <div className="space-y-3" data-testid="results-summary">
      {show === "all" && (
        <dl className={cn("grid gap-2", compact ? "grid-cols-2" : "grid-cols-2 md:grid-cols-4")} aria-label="Executive summary (modeled estimates)">
          <Tile label="Recommended investment" value={usd(d.investment.netInvestment)} note={`${usd(d.investment.grossCost)} installed${d.investment.incentivesApplied > 0 ? ` − ${usd(d.investment.incentivesApplied)} incentives` : ""}`} question="How much do I need to invest?" />
          <Tile label="Budget left" value={usd(d.investment.remainingBudget)} note={`of ${usd(d.budget)}`} tone={d.investment.overBudget ? "bad" : undefined} />
          <Tile label="Estimated annual savings" value={usd(f.annualSavings)} note={`${usd(f.savingsRange[0])} to ${usd(f.savingsRange[1])}`} tone="good" question="How much money will I save?" />
          <Tile label="Cut in energy cost" value={pct(f.savingsPctOfBill)} note={`of ${usd(d.current.cost)} a year`} />
          <Tile label="Pays for itself in" value={yrs(f.paybackYears)} note="simple payback" question="How long until I recover my investment?" />
          <Tile label="NPV, 5 years" value={usd(f.npv5)} note={`at ${pct(f.discountRate)} a year`} tone={f.npv5 < 0 ? "bad" : undefined} question="What is the long-term financial return?" />
          <Tile label="NPV, 10 years" value={usd(f.npv10)} note={`at ${pct(f.discountRate)} a year`} tone={f.npv10 < 0 ? "bad" : "good"} />
          <Tile label="Carbon avoided" value={`${num(d.environment.carbonKgAvoided / 1000, 1)} t`} note={`CO₂e a year (${pct(d.environment.carbonPct)})`} />
        </dl>
      )}
      <Verdict v={d.interpretation} />
      {d.investment.illustrative.length > 0 && (
        <p className="rounded-md border border-dashed border-glass-border p-2 text-[11px] text-muted-foreground" data-testid="illustrative-incentives">
          <span className="font-medium text-foreground">Not in the base case:</span>{" "}
          {d.investment.illustrative.map((x) => `${x.label} (${usd(x.amount)})`).join("; ")}. Shown for illustration only, because the program rate is not confirmed for this year
          {d.investment.netIfIllustrative !== null ? `; if confirmed, the net investment would be ${usd(d.investment.netIfIllustrative)}` : ""}. No figure above includes it.
        </p>
      )}
      <div role="tablist" aria-label="Plan details" className="flex gap-1 text-xs">
        {(["before", "upgrades"] as const).map((k) => (
          <button key={k} type="button" role="tab" aria-selected={section === k} onClick={() => setSection(k)} className={cn("rounded-full border px-2.5 py-0.5", section === k ? "border-primary bg-primary/15" : "border-glass-border text-muted-foreground")} data-testid={`results-tab-${k}`}>
            {k === "before" ? "Before vs after" : "Upgrades and savings"}
          </button>
        ))}
      </div>
      {section === "before" ? (
        <BeforeAfter rows={d.comparison} />
      ) : (
        <div className="space-y-3">
          <Breakdown d={d} />
          <Contribution d={d} />
        </div>
      )}
      <p className="text-[10px] text-muted-foreground">
        Modeled estimates{d.hotel.synthetic ? " for a synthetic demonstration hotel" : ""}{d.measuredAgainst ? ", measured against the current what-if" : ""}. Not an engineering audit or a guarantee of savings.
      </p>
    </div>
  );
}

/** The recommended (AI) plan's results and report: the package applied to the twin, else the objective winner. */
export function AiPlanResults({ compact = false }: { compact?: boolean }) {
  const plan = useTwin((s) => s.hotelPlan);
  const active = useTwin((s) => s.activeHotelPackageId);
  const hotel = useTwin((s) => s.hotel);
  const base = useTwin((s) => s.hotelPlanBaseline);
  const rate = useTwin((s) => s.hotelDiscountRate);
  const d = useMemo(() => (plan ? aiReportFromState(useTwin.getState()) : null), [plan, active, hotel, base, rate]);
  if (!d) return null;
  return (
    <section aria-label="Recommended investment plan" className="space-y-3 rounded-xl border border-primary/30 bg-primary/5 p-3" data-testid="ai-plan-results">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold">Recommended investment plan</h2>
        <span className="text-[11px] text-muted-foreground">{d.planLabel.replace("AI recommended · ", "")}{active ? " (applied to the twin)" : ""}</span>
      </div>
      <p className="text-xs">{d.planName}</p>
      <ResultsSummary d={d} compact={compact} />
      <ReportActions getData={() => aiReportFromState(useTwin.getState())} label="Investment summary" compact={compact} />
    </section>
  );
}

/** A custom plan's interpretation, before/after and upgrade breakdown, plus its report (the totals are in PlanSummary). */
export function CustomPlanResults({ planId, compact = false }: { planId: string; compact?: boolean }) {
  const plans = useTwin((s) => s.customPlans);
  const hotel = useTwin((s) => s.hotel);
  const rate = useTwin((s) => s.hotelDiscountRate);
  const scenario = useTwin((s) => s.scenarioResult);
  const onScenario = useTwin((s) => s.optimizeOnScenario);
  const d = useMemo(() => customReportFromState(useTwin.getState(), planId), [planId, plans, hotel, rate, scenario, onScenario]);
  if (!d) return null;
  return (
    <section aria-label="Plan results" className="space-y-3" data-testid="custom-plan-results">
      <ResultsSummary d={d} compact={compact} show="extras" />
      <ReportActions getData={() => customReportFromState(useTwin.getState(), planId)} label="Plan summary" compact={compact} />
    </section>
  );
}

/** The portfolio optimizer's report. */
export function PortfolioReportActions() {
  const plan = useTwin((s) => s.portfolioPlan);
  if (!plan) return null;
  return <ReportActions getData={() => portfolioReportFromState(useTwin.getState())} label="Portfolio investment summary" />;
}
