import { Loader2, Sparkles } from "lucide-react";
import { PORTFOLIO_OBJECTIVES, upgradeDef } from "@/engine/hotel";
import type { PortfolioObjective } from "@/engine/hotel";
import { useTwin } from "@/store/useTwin";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usd } from "@/twin/format";
import { PortfolioCompare } from "./PortfolioCompare";
import { PortfolioCustomPlan } from "./PortfolioCustomPlan";
import { TotalsGrid } from "./TotalsGrid";
import { PortfolioReportActions } from "@/report/ResultsSummary";

const BUDGETS = [100_000, 250_000, 500_000, 750_000, 1_000_000];

/** Portfolio investments: one budget across the chain, as the AI recommends it, as I build it, and the two compared. */
export function PortfolioOptimizer({ onExplore, onEdit }: { onExplore: (id: string) => void; onEdit: (propertyId: string, planId: string | null) => void }) {
  const budget = useTwin((s) => s.portfolioBudget);
  const setBudget = useTwin((s) => s.setPortfolioBudget);

  return (
    <section aria-label="Portfolio investments" className="space-y-3 rounded-xl border border-glass-border p-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Portfolio investments</h2>
          <p className="text-xs text-muted-foreground">One budget across the hotels, at most one upgrade package per hotel.</p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
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
        </div>
      </div>
      <Tabs defaultValue="ai">
        <TabsList>
          <TabsTrigger value="ai">AI recommended</TabsTrigger>
          <TabsTrigger value="mine" data-testid="tab-mine">My portfolio</TabsTrigger>
          <TabsTrigger value="compare" data-testid="tab-compare">Compare</TabsTrigger>
        </TabsList>
        <TabsContent value="ai" className="mt-3"><AiPortfolio onExplore={onExplore} /></TabsContent>
        <TabsContent value="mine" className="mt-3"><PortfolioCustomPlan onEdit={onEdit} /></TabsContent>
        <TabsContent value="compare" className="mt-3"><PortfolioCompare /></TabsContent>
      </Tabs>
    </section>
  );
}

function AiPortfolio({ onExplore }: { onExplore: (id: string) => void }) {
  const objective = useTwin((s) => s.portfolioObjective);
  const setObjective = useTwin((s) => s.setPortfolioObjective);
  const plan = useTwin((s) => s.portfolioPlan);
  const busy = useTwin((s) => s.portfolioOptimizing);
  const run = useTwin((s) => s.runPortfolioOptimizer);
  return (
    <div className="space-y-3">
      <p className="text-[11px] text-muted-foreground">Picked by the portfolio optimizer, an exact search over every hotel's combinations with the energy model. The AI advisor only explains results.</p>
      <div className="flex flex-wrap items-end gap-3">
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
          <TotalsGrid totals={plan.totals} />
          <PortfolioReportActions />
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
    </div>
  );
}
