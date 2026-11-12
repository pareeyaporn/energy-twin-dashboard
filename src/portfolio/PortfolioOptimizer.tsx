import { Loader2, Sparkles } from "lucide-react";
import { PORTFOLIO_OBJECTIVES, upgradeDef } from "@/engine/hotel";
import type { PortfolioObjective } from "@/engine/hotel";
import { useTwin } from "@/store/useTwin";
import { Button } from "@/components/ui/button";
import { percent, usd } from "@/twin/format";

const BUDGETS = [100_000, 250_000, 500_000, 750_000, 1_000_000];

/** One budget across the chain: which package goes to which hotel. Every figure comes from the engine. */
export function PortfolioOptimizer({ onExplore }: { onExplore: (id: string) => void }) {
  const budget = useTwin((s) => s.portfolioBudget);
  const setBudget = useTwin((s) => s.setPortfolioBudget);
  const objective = useTwin((s) => s.portfolioObjective);
  const setObjective = useTwin((s) => s.setPortfolioObjective);
  const plan = useTwin((s) => s.portfolioPlan);
  const busy = useTwin((s) => s.portfolioOptimizing);
  const run = useTwin((s) => s.runPortfolioOptimizer);

  return (
    <section aria-label="Portfolio investment optimizer" className="space-y-3 rounded-xl border border-glass-border p-4">
      <div>
        <h2 className="text-base font-semibold">Portfolio investment optimizer</h2>
        <p className="text-xs text-muted-foreground">Split one budget across the hotels: at most one upgrade package per hotel, chosen from every combination the single-hotel optimizer tests.</p>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-xs">
          <span className="mb-1 block text-muted-foreground">Total budget</span>
          <span className="flex items-center gap-1">
            <span className="text-muted-foreground">$</span>
            <input
              type="number"
              min={0}
              step={10_000}
              value={budget}
              onChange={(e) => setBudget(Number(e.target.value))}
              className="num w-32 rounded-md border border-input bg-background px-2 py-1 text-sm"
              aria-label="Total portfolio budget in dollars"
              data-testid="portfolio-budget"
            />
          </span>
        </label>
        <div className="flex flex-wrap gap-1" aria-label="Budget presets">
          {BUDGETS.map((b) => (
            <button key={b} type="button" onClick={() => setBudget(b)} className={`rounded-full border px-2 py-0.5 text-[11px] ${b === budget ? "border-primary text-foreground" : "border-glass-border text-muted-foreground"}`}>
              {b >= 1_000_000 ? `$${b / 1_000_000}M` : `$${b / 1000}k`}
            </button>
          ))}
        </div>
        <label className="text-xs">
          <span className="mb-1 block text-muted-foreground">Objective</span>
          <select value={objective} onChange={(e) => setObjective(e.target.value as PortfolioObjective)} className="rounded-md border border-input bg-background px-2 py-1 text-sm" data-testid="portfolio-objective">
            {PORTFOLIO_OBJECTIVES.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
          </select>
        </label>
        <Button onClick={() => void run()} disabled={busy} data-testid="run-portfolio">
          {busy ? <Loader2 className="animate-spin" /> : <Sparkles />}
          {busy ? "Testing combinations…" : "Optimize the portfolio"}
        </Button>
      </div>

      {plan && (
        <div className="space-y-3" data-testid="portfolio-plan">
          <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {([
              ["Investment (gross)", usd(plan.totals.grossCost)],
              ["Incentives", usd(plan.totals.incentives)],
              ["Net investment", usd(plan.totals.netInvestment)],
              ["Budget left", usd(plan.totals.remainingBudget)],
              ["Annual savings", `${usd(plan.totals.annualSavings)} (${percent(plan.totals.shareOfPortfolioCost)} of energy cost)`],
              ["Payback", plan.totals.paybackYears != null ? `${plan.totals.paybackYears.toFixed(1)} years` : "—"],
              ["NPV 5 / 10 years", `${usd(plan.totals.npv5)} / ${usd(plan.totals.npv10)}`],
              ["CO₂ avoided", `${Math.round(plan.totals.carbonAvoidedKg / 1000).toLocaleString("en-US")} t / yr`],
            ] as const).map(([k, v]) => (
              <div key={k} className="rounded-lg bg-accent/30 p-2">
                <dt className="text-[11px] text-muted-foreground">{k}</dt>
                <dd className="num text-sm font-medium">{v}</dd>
              </div>
            ))}
          </dl>
          <div className="table-scroll overflow-x-auto">
            <table className="w-full min-w-[720px] text-xs">
              <caption className="sr-only">Recommended package per hotel (estimates)</caption>
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="p-1.5 font-medium">Hotel</th>
                  <th className="p-1.5 font-medium">Recommended package</th>
                  <th className="p-1.5 text-right font-medium">Gross cost</th>
                  <th className="p-1.5 text-right font-medium">Incentives</th>
                  <th className="p-1.5 text-right font-medium">Net</th>
                  <th className="p-1.5 text-right font-medium">Savings / yr</th>
                  <th className="p-1.5 text-right font-medium">Payback</th>
                  <th className="p-1.5"><span className="sr-only">Open</span></th>
                </tr>
              </thead>
              <tbody>
                {plan.allocations.map((a) => {
                  const f = a.evaluation?.financials;
                  return (
                    <tr key={a.propertyId} className="border-b border-border/50" data-testid="allocation-row">
                      <td className="p-1.5 font-medium">{a.name}</td>
                      <td className="p-1.5">{a.evaluation ? a.evaluation.upgradeIds.map((id) => upgradeDef(id).label).join(" + ") : <span className="text-muted-foreground">No package (budget better used elsewhere)</span>}</td>
                      <td className="num p-1.5 text-right">{f ? usd(f.grossCost.mid) : "—"}</td>
                      <td className="num p-1.5 text-right">{f ? usd(f.incentivesTotal) : "—"}</td>
                      <td className="num p-1.5 text-right">{f ? usd(f.netInvestment.mid) : "—"}</td>
                      <td className="num p-1.5 text-right text-savings">{f ? usd(f.annualSavings.mid) : "—"}</td>
                      <td className="num p-1.5 text-right">{f?.simplePaybackYears != null ? `${f.simplePaybackYears.toFixed(1)} yr` : "—"}</td>
                      <td className="p-1.5 text-right"><button type="button" className="whitespace-nowrap text-primary hover:underline" onClick={() => onExplore(a.propertyId)}>Open twin</button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="text-[11px] text-muted-foreground">
            {plan.combinationsTested.toLocaleString("en-US")} combinations tested across the hotels. {plan.method} {plan.notes.join(" ")}
          </p>
        </div>
      )}
    </section>
  );
}
