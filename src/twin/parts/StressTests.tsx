import { useEffect, useState } from "react";
import { ArrowRight, RotateCcw } from "lucide-react";
import { STRESS_CATEGORIES, STRESS_KIND_LABEL, STRESS_TESTS, stressKind, stressPeriodText } from "@/engine/hotel";
import { openWorkspaceTab } from "@/tour/dom";
import { useTwin } from "@/store/useTwin";
import { computeStressRecommendation, selectStressReport } from "@/store/hotelDerived";
import type { StressPlanChoice } from "@/store/hotelDerived";
import { signedUsd, usd } from "../format";

const kwh = (n: number) => `${Math.round(n).toLocaleString("en-US")} kWh`;
const therms = (n: number) => `${Math.round(n).toLocaleString("en-US")} therms`;
const signed = (n: number, unit: string) => `${n >= 0 ? "+" : "−"}${Math.round(Math.abs(n)).toLocaleString("en-US")} ${unit}`;
const yrs = (n: number | null) => (n === null ? "No payback" : `${n.toFixed(1)} yr`);
const pctOf = (delta: number, base: number) => (Math.abs(base) > 1e-9 ? `${delta > 0 ? "+" : delta < 0 ? "−" : ""}${Math.abs((delta / base) * 100).toFixed(1)}%` : "—");

/** Three costs on one scale: the normal year, the stress, and the stress with the plan (bars only draw the engine's figures). */
function CostBars({ rows }: { rows: { label: string; value: number; tone: string }[] }) {
  const max = Math.max(...rows.map((r) => r.value), 1);
  return (
    <div className="mt-2 space-y-1" role="img" aria-label={rows.map((r) => `${r.label} ${usd(r.value)}`).join(", ")} data-testid="stress-bars">
      {rows.map((r) => (
        <div key={r.label} className="flex items-center gap-2 text-[10px]">
          <span className="w-24 shrink-0 text-muted-foreground">{r.label}</span>
          <span className="h-2 flex-1 overflow-hidden rounded-full bg-muted/40">
            <span className={`block h-full rounded-full ${r.tone}`} style={{ width: `${(r.value / max) * 100}%` }} />
          </span>
          <span className="num w-16 shrink-0 text-right">{usd(r.value)}</span>
        </div>
      ))}
    </div>
  );
}

/**
 * Stress tests: pick an event (weather, operations or financial). The twin shows the hotel under it; this panel states the exact
 * assumptions, compares the normal year with the stressed one, and shows how the selected investment plan (AI or your own) performs,
 * all with the same engine. Temporary events do not change long-term returns; persistent changes do.
 */
export function StressTests() {
  const active = useTwin((s) => s.activeStressTest);
  const apply = useTwin((s) => s.applyStressTest);
  const result = useTwin((s) => s.scenarioResult);
  const hotelPlan = useTwin((s) => s.planBeforeStress ?? s.hotelPlan);
  const customPlans = useTwin((s) => s.customPlans);
  const [choice, setChoice] = useState<StressPlanChoice>({ kind: "auto" });
  const report = useTwin((s) => selectStressReport(s, choice));
  const current = STRESS_TESTS.find((t) => t.id === active);
  // Whether the recommendation changes needs two optimizer runs: do it just after the panel has rendered.
  const [rec, setRec] = useState<{ key: string; value: ReturnType<typeof computeStressRecommendation> } | null>(null);
  const hotel = useTwin((s) => s.hotel);
  const scenario = useTwin((s) => s.scenario);
  const rate = useTwin((s) => s.hotelDiscountRate);
  const recKey = current?.duration === "persistent" ? `${current.id}|${hotel.profile.budget}|${hotel.profile.objective}|${rate}|${JSON.stringify(scenario)}` : "";
  useEffect(() => {
    if (!recKey) return;
    const t = window.setTimeout(() => setRec({ key: recKey, value: computeStressRecommendation(useTwin.getState()) }), 30);
    return () => window.clearTimeout(t);
  }, [recKey, hotel]);
  const recommendation = rec && rec.key === recKey ? rec.value : null;
  const choiceValue = choice.kind === "ai" ? `ai:${choice.role}` : choice.kind === "custom" ? `custom:${choice.id}` : choice.kind;

  return (
    <section aria-label="Stress tests" className="rounded-xl border border-glass-border bg-glass p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-xs uppercase tracking-wide text-muted-foreground">Stress tests</span>
        {current && (
          <button type="button" onClick={() => apply(null)} className="flex items-center gap-1 rounded-md border border-glass-border px-2 py-0.5 text-xs text-muted-foreground hover:bg-accent" aria-label="Reset to baseline">
            <RotateCcw className="h-3 w-3" /> Reset to baseline
          </button>
        )}
      </div>
      <div className="space-y-1.5">
        {STRESS_CATEGORIES.map((c) => (
          <div key={c.id} role="group" aria-label={c.label} className="flex flex-wrap items-center gap-1.5">
            <span className="w-20 shrink-0 text-[11px] text-muted-foreground">{c.label}</span>
            {STRESS_TESTS.filter((t) => t.category === c.id).map((t) => (
              <button
                key={t.id}
                type="button"
                aria-pressed={active === t.id}
                onClick={() => apply(active === t.id ? null : t.id)}
                className={`rounded-full border px-2.5 py-0.5 text-xs transition-colors ${active === t.id ? "border-primary bg-primary/10 text-primary" : "border-glass-border text-muted-foreground hover:border-input hover:text-foreground"}`}
              >
                {t.label}
              </button>
            ))}
          </div>
        ))}
      </div>

      {current && (
        <div className="mt-3 space-y-3 border-t border-glass-border pt-3">
          <div className="text-xs text-muted-foreground" data-testid="stress-description">
            <span className={`mr-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${current.duration === "temporary" ? "bg-heat/15 text-heat" : "bg-primary/15 text-primary"}`} data-testid="stress-kind">
              {STRESS_KIND_LABEL[stressKind(current)]}{stressKind(current) === "operational_scenario" ? ` · ${current.duration}` : ""}
            </span>
            {current.description}
            {result && <span className="ml-1 font-medium text-foreground">Estimated change: {signedUsd(result.delta.cost)} {stressPeriodText(current)}.</span>}
          </div>
          <table className="w-full text-xs" aria-label="Assumptions changed">
            <thead>
              <tr className="text-left text-muted-foreground"><th className="pb-1 font-normal">Assumption</th><th className="pb-1 font-normal">Change</th><th className="pb-1 font-normal">Period</th></tr>
            </thead>
            <tbody>
              {current.assumptions.map((a) => (
                <tr key={a.what}><td className="py-0.5">{a.what}</td><td className="py-0.5 tabular-nums">{a.change}</td><td className="py-0.5">{a.period}</td></tr>
              ))}
            </tbody>
          </table>

          {report && (
            <div className="grid gap-3 lg:grid-cols-2">
              <div className="rounded-lg border border-glass-border/70 bg-background/40 p-2.5" data-testid="stress-compare">
                <h4 className="mb-1.5 text-xs font-medium">The hotel: normal year vs this stress (no new upgrades)</h4>
                <div className="table-scroll overflow-x-auto">
                <table className="w-full min-w-[300px] text-xs tabular-nums">
                  <thead><tr className="text-muted-foreground"><th className="text-left font-normal" /><th className="text-right font-normal">Normal</th><th className="text-right font-normal">Stress</th><th className="text-right font-normal">Change</th></tr></thead>
                  <tbody>
                    <tr><td>Electricity</td><td className="text-right">{kwh(report.normal.elecKWh)}</td><td className="text-right">{kwh(report.stressed.elecKWh)}</td><td className="text-right">{signed(report.delta.elecKWh, "kWh")} <span className="text-[10px] opacity-80">({pctOf(report.delta.elecKWh, report.normal.elecKWh)})</span></td></tr>
                    <tr><td>Natural gas</td><td className="text-right">{therms(report.normal.gasTherms)}</td><td className="text-right">{therms(report.stressed.gasTherms)}</td><td className="text-right">{signed(report.delta.gasTherms, "therms")} <span className="text-[10px] opacity-80">({pctOf(report.delta.gasTherms, report.normal.gasTherms)})</span></td></tr>
                    <tr><td>Carbon</td><td className="text-right">{Math.round(report.normal.carbonKg / 1000).toLocaleString("en-US")} t</td><td className="text-right">{Math.round(report.stressed.carbonKg / 1000).toLocaleString("en-US")} t</td><td className="text-right">{report.delta.carbonKg >= 0 ? "+" : "−"}{(Math.abs(report.delta.carbonKg) / 1000).toFixed(1)} t <span className="text-[10px] opacity-80">({pctOf(report.delta.carbonKg, report.normal.carbonKg)})</span></td></tr>
                    <tr className="font-medium" data-testid="stress-cost-row"><td>Energy cost</td><td className="text-right">{usd(report.normal.cost)}</td><td className="text-right">{usd(report.stressed.cost)}</td><td className={`text-right ${report.delta.cost > 0 ? "text-heat" : "text-savings"}`}>{signedUsd(report.delta.cost)} <span className="text-[10px] opacity-80">({pctOf(report.delta.cost, report.normal.cost)})</span></td></tr>
                  </tbody>
                </table>
                </div>
                <p className="mt-1 text-[10px] text-muted-foreground">Whole year, the same 12 months in both columns{current.duration === "temporary" ? "; the change is the total for the one event" : ""}.</p>
              </div>

              <div className="rounded-lg border border-glass-border/70 bg-background/40 p-2.5" data-testid="stress-plan">
                <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                  <h4 className="text-xs font-medium">How a plan holds up</h4>
                  <select
                    value={choiceValue}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v === "auto" || v === "none") setChoice({ kind: v });
                      else if (v.startsWith("ai:")) setChoice({ kind: "ai", role: v.slice(3) });
                      else setChoice({ kind: "custom", id: v.slice(7) });
                    }}
                    aria-label="Plan to test"
                    className="h-6 max-w-[60%] rounded-md border border-glass-border bg-background px-1 text-[11px]"
                  >
                    <option value="auto">Selected plan</option>
                    {hotelPlan?.packages.map((p) => <option key={p.role} value={`ai:${p.role}`}>AI · {p.roleLabel}</option>)}
                    {customPlans.map((p) => <option key={p.id} value={`custom:${p.id}`}>{p.name}</option>)}
                    <option value="none">No plan</option>
                  </select>
                </div>
                {report.plan ? (
                  <>
                    <p className="mb-1 text-[11px] text-muted-foreground">{report.plan.label}</p>
                    <table className="w-full text-xs tabular-nums">
                      <thead><tr className="text-muted-foreground"><th className="text-left font-normal" /><th className="text-right font-normal">Normal</th><th className="text-right font-normal">Stress</th></tr></thead>
                      <tbody>
                        <tr><td>Cost with the plan / yr</td><td className="text-right">{usd(report.plan.costWithPlanNormal)}</td><td className="text-right">{usd(report.plan.costWithPlanStressed)}</td></tr>
                        <tr><td>Plan saves / yr</td><td className="text-right text-savings">{usd(report.plan.savingsNormal)}</td><td className="text-right text-savings">{usd(report.plan.savingsStressed)}</td></tr>
                        {report.plan.persistent && (
                          <>
                            <tr><td>Simple payback</td><td className="text-right">{yrs(report.plan.persistent.paybackNormal)}</td><td className="text-right">{yrs(report.plan.persistent.paybackStressed)}</td></tr>
                            <tr><td>NPV, 10 years</td><td className="text-right">{usd(report.plan.persistent.npv10Normal)}</td><td className="text-right">{usd(report.plan.persistent.npv10Stressed)}</td></tr>
                          </>
                        )}
                      </tbody>
                    </table>
                    <p className="mt-1.5 text-xs" data-testid="stress-avoided">
                      {report.plan.extraAvoided >= 0 ? "Extra costs avoided by the upgrades: " : "The upgrades save less under this stress: "}
                      <span className={`font-medium tabular-nums ${report.plan.extraAvoided >= 0 ? "text-savings" : "text-heat"}`}>{signedUsd(report.plan.extraAvoided)}</span>
                      {current.duration === "temporary" ? " in the year it happens" : " per year"}
                      {report.plan.shareOfIncreaseAbsorbed !== null && report.plan.extraAvoided > 0 && ` (${Math.round(report.plan.shareOfIncreaseAbsorbed * 100)}% of the stress's extra cost)`}.
                    </p>
                    <CostBars
                      rows={[
                        { label: "Normal year", value: report.normal.cost, tone: "bg-muted-foreground/60" },
                        { label: "Stress", value: report.stressed.cost, tone: "bg-heat" },
                        { label: "Stress with plan", value: report.plan.costWithPlanStressed, tone: "bg-savings" },
                      ]}
                    />
                  </>
                ) : (
                  <p className="text-[11px] text-muted-foreground">No plan selected. Run "Find the best investments" or build a plan in the Invest step.</p>
                )}
              </div>
            </div>
          )}

          {current.duration === "persistent" &&
            (recommendation ? (
              <p className={`text-xs ${recommendation.changed ? "text-heat" : "text-muted-foreground"}`} data-testid="stress-recommendation">
                {recommendation.changed
                  ? `If this change persists, the recommended package for your objective changes from ${recommendation.normalName} to ${recommendation.stressedName}.`
                  : `If this change persists, the recommended package stays the same: ${recommendation.normalName}.`}
              </p>
            ) : recKey && rec?.key !== recKey ? (
              <p className="text-xs text-muted-foreground">Checking whether the recommendation changes…</p>
            ) : null)}
          {report?.notes.map((n) => <p key={n} className="text-[11px] text-muted-foreground">{n}</p>)}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[10px] text-muted-foreground">Modeled estimates. Magnitudes are illustrative what-ifs, not forecasts.</p>
            <button type="button" onClick={() => openWorkspaceTab("Invest")} className="inline-flex items-center gap-1 rounded-md border border-primary/40 bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary hover:bg-primary/20" data-testid="stress-invest">
              {current.duration === "persistent" ? "Find investments for this change" : "See investments"} <ArrowRight className="size-3" />
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
