import { STRESS_CATEGORIES, STRESS_TESTS } from "@/engine/hotel";
import type { StressTest } from "@/engine/hotel";
import { useTwin } from "@/store/useTwin";
import type { PortfolioStressPlanChoice } from "@/store/useTwin";
import { selectPortfolioStressReport } from "@/store/hotelDerived";
import { percent, signedUsd, usd } from "@/twin/format";

const PLAN_CHOICES: { id: PortfolioStressPlanChoice; label: string }[] = [
  { id: "ai", label: "AI portfolio" },
  { id: "mine", label: "My portfolio" },
  { id: "none", label: "No plans" },
];

/** A stress test on one hotel, a selection or the whole chain, with the chosen plans: normal vs stressed cost and what the plans absorb. */
export function PortfolioStress() {
  const properties = useTwin((s) => s.portfolio.properties);
  const testId = useTwin((s) => s.portfolioStressTestId);
  const setTest = useTwin((s) => s.setPortfolioStressTest);
  const scope = useTwin((s) => s.portfolioStressScope);
  const setScope = useTwin((s) => s.setPortfolioStressScope);
  const planChoice = useTwin((s) => s.portfolioStressPlan);
  const setPlanChoice = useTwin((s) => s.setPortfolioStressPlan);
  const aiPlan = useTwin((s) => s.portfolioPlan);
  const report = useTwin(selectPortfolioStressReport);
  const test = STRESS_TESTS.find((t) => t.id === testId) ?? null;
  const all = properties.map((p) => p.id);
  const label = (id: string) => properties.find((p) => p.id === id)?.input.name ?? id;

  return (
    <section aria-label="Portfolio stress tests" className="space-y-3 rounded-xl border border-glass-border p-4" data-testid="portfolio-stress">
      <div>
        <h2 className="text-base font-semibold">Portfolio stress tests</h2>
        <p className="text-xs text-muted-foreground">Test one hotel, a selection or the whole chain against weather, operating or price shocks, with or without the investment plans.</p>
      </div>
      <div className="flex flex-wrap gap-4">
        {STRESS_CATEGORIES.map((c) => (
          <div key={c.id} role="group" aria-label={c.label} className="space-y-1">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{c.label}</div>
            <div className="flex flex-wrap gap-1">
              {STRESS_TESTS.filter((t) => t.category === c.id).map((t) => (
                <button
                  key={t.id}
                  type="button"
                  aria-pressed={t.id === testId}
                  onClick={() => setTest(t.id === testId ? null : t.id)}
                  className={`rounded-full border px-2.5 py-1 text-xs ${t.id === testId ? "border-primary bg-primary/15 text-foreground" : "border-glass-border text-muted-foreground hover:text-foreground"}`}
                  data-testid={`pstress-${t.id}`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-start gap-6 text-xs">
        <fieldset className="space-y-1">
          <legend className="mb-1 text-muted-foreground">Hotels in the test</legend>
          <label className="flex items-center gap-1.5">
            <input type="checkbox" checked={scope.length === all.length} onChange={(e) => setScope(e.target.checked ? all : [])} />
            All hotels
          </label>
          {all.map((id) => (
            <label key={id} className="flex items-center gap-1.5">
              <input type="checkbox" checked={scope.includes(id)} onChange={(e) => setScope(e.target.checked ? [...scope, id] : scope.filter((x) => x !== id))} data-testid={`pscope-${id}`} />
              {label(id)}
            </label>
          ))}
        </fieldset>
        <fieldset className="space-y-1">
          <legend className="mb-1 text-muted-foreground">With these plans</legend>
          {PLAN_CHOICES.map((c) => (
            <label key={c.id} className="flex items-center gap-1.5">
              <input type="radio" name="pstress-plan" checked={planChoice === c.id} onChange={() => setPlanChoice(c.id)} />
              {c.label}
            </label>
          ))}
          {planChoice === "ai" && !aiPlan && <p className="max-w-56 text-[11px] text-heat">Run the portfolio optimizer first; until then the hotels are tested without plans.</p>}
        </fieldset>
        {test && <Assumptions test={test} />}
      </div>

      {report && test && (
        <div className="space-y-2" data-testid="portfolio-stress-report">
          <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {([
              ["Normal year", usd(report.totals.normalCost)],
              [test.label, `${usd(report.totals.stressedCost)} (${signedUsd(report.totals.increase)})`],
              ["With plans, under the test", usd(report.totals.withPlansStressed)],
              ["Extra cost the plans avoid", `${usd(report.totals.extraAvoided)}${report.totals.shareOfIncreaseAbsorbed != null ? ` (${percent(report.totals.shareOfIncreaseAbsorbed)} of the increase)` : ""}`],
            ] as const).map(([k, v]) => (
              <div key={k} className="rounded-lg bg-accent/30 p-2">
                <dt className="text-[11px] text-muted-foreground">{k}</dt>
                <dd className="num text-sm font-medium">{v}</dd>
              </div>
            ))}
          </dl>
          <div className="table-scroll overflow-x-auto">
            <table className="w-full min-w-[760px] text-xs">
              <caption className="sr-only">Stress test by hotel (estimates, energy cost per year)</caption>
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="p-1.5 text-left font-medium">Hotel</th>
                  <th className="p-1.5 text-right font-medium">Normal</th>
                  <th className="p-1.5 text-right font-medium">Under the test</th>
                  <th className="p-1.5 text-right font-medium">Change</th>
                  <th className="p-1.5 text-right font-medium">With plan, under the test</th>
                  <th className="p-1.5 text-right font-medium">Extra avoided</th>
                  <th className="p-1.5 text-right font-medium">{test.duration === "persistent" ? "Payback normal → stressed" : "Plan"}</th>
                </tr>
              </thead>
              <tbody>
                {report.rows.map((r) => {
                  const p = r.report?.plan ?? null;
                  return (
                    <tr key={r.propertyId} className={`border-b border-border/50 ${r.inScope ? "" : "text-muted-foreground"}`} data-testid="pstress-row">
                      <td className="p-1.5 font-medium">{r.name}{!r.inScope && <span className="ml-1 font-normal">(not in the test)</span>}</td>
                      <td className="num p-1.5 text-right">{usd(r.normalCost)}</td>
                      <td className="num p-1.5 text-right">{usd(r.stressedCost)}</td>
                      <td className={`num p-1.5 text-right ${r.stressedCost - r.normalCost > 0.5 ? "text-loss" : r.stressedCost - r.normalCost < -0.5 ? "text-savings" : ""}`}>{signedUsd(r.stressedCost - r.normalCost)}</td>
                      <td className="num p-1.5 text-right">{usd(r.withPlanStressed)}</td>
                      <td className="num p-1.5 text-right">{p ? usd(p.extraAvoided) : "—"}</td>
                      <td className="num p-1.5 text-right">
                        {p?.persistent
                          ? `${p.persistent.paybackNormal?.toFixed(1) ?? "—"} → ${p.persistent.paybackStressed?.toFixed(1) ?? "—"} yr`
                          : test.duration === "persistent" ? "—" : (r.planLabel ?? "No plan")}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {report.notes.map((n) => <p key={n} className="text-[11px] text-muted-foreground">{n}</p>)}
          <p className="text-[11px] text-muted-foreground">Each hotel is measured on its baseline with the same single-hotel stress test. Estimates from synthetic demonstration properties.</p>
        </div>
      )}
    </section>
  );
}

function Assumptions({ test }: { test: StressTest }) {
  return (
    <div className="max-w-md space-y-1">
      <div className="text-muted-foreground">{test.description} <span className="rounded-full border border-glass-border px-1.5">{test.duration === "persistent" ? "Persistent" : "Temporary"}</span></div>
      <ul className="list-disc pl-4 text-[11px] text-muted-foreground">
        {test.assumptions.map((a) => <li key={a.what}>{a.what}: {a.change} ({a.period})</li>)}
      </ul>
    </div>
  );
}
