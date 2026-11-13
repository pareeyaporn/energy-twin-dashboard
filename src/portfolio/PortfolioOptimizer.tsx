import { ArrowRight, ChevronDown, Loader2, Sparkles } from "lucide-react";
import { PORTFOLIO_OBJECTIVES, upgradeDef } from "@/engine/hotel";
import type { PortfolioObjective, PortfolioPlan } from "@/engine/hotel";
import { useTwin } from "@/store/useTwin";
import { selectPortfolioSummary } from "@/store/hotelDerived";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usd } from "@/twin/format";
import { PortfolioCompare } from "./PortfolioCompare";
import { PortfolioCustomPlan } from "./PortfolioCustomPlan";
import { TotalsGrid } from "./TotalsGrid";
import { AllocationBar } from "./AllocationBar";
import { compactUsd, pct, tonnes } from "./format";
import { EstimateBadge, SectionHeading } from "./Section";
import { PortfolioReportActions } from "@/report/ResultsSummary";

const BUDGETS = [100_000, 250_000, 500_000, 750_000, 1_000_000];
const fieldCls = "h-9 rounded-lg border border-input bg-background px-2.5 text-sm transition-colors hover:border-foreground/30 focus-visible:border-primary";

/** Portfolio investments: one budget across the chain, as the optimizer recommends it, as I build it, and the two compared. */
export function PortfolioOptimizer({ onExplore, onEdit }: { onExplore: (id: string) => void; onEdit: (propertyId: string, planId: string | null) => void }) {
  const budget = useTwin((s) => s.portfolioBudget);
  const setBudget = useTwin((s) => s.setPortfolioBudget);
  const objective = useTwin((s) => s.portfolioObjective);
  const setObjective = useTwin((s) => s.setPortfolioObjective);
  const busy = useTwin((s) => s.portfolioOptimizing);
  const run = useTwin((s) => s.runPortfolioOptimizer);

  return (
    <section aria-label="Portfolio investments" className="space-y-5">
      <SectionHeading title="Plan your portfolio investments" subtitle="Find the best combination of energy upgrades across your hotels." />
      <div className="rounded-2xl border border-glass-border bg-card/40 p-4 md:p-6">
        <div className="flex flex-wrap items-end gap-x-5 gap-y-4" role="group" aria-label="Optimizer settings" data-testid="optimizer-toolbar">
          <div className="space-y-1.5">
            <label htmlFor="portfolio-budget" className="block text-xs font-medium text-muted-foreground">Total budget</label>
            <div className="flex flex-wrap items-center gap-2">
              <span className="relative">
                <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
                <input
                  id="portfolio-budget"
                  type="number"
                  min={0}
                  step={10_000}
                  value={budget}
                  onChange={(e) => setBudget(Number(e.target.value))}
                  className={`num w-36 pl-6 ${fieldCls}`}
                  aria-label="Total portfolio budget in dollars"
                  data-testid="portfolio-budget"
                />
              </span>
              <div className="flex flex-wrap gap-1" role="group" aria-label="Budget presets">
                {BUDGETS.map((b) => (
                  <button
                    key={b}
                    type="button"
                    onClick={() => setBudget(b)}
                    aria-pressed={b === budget}
                    className={`num h-8 rounded-full border px-3 text-xs transition-colors motion-reduce:transition-none ${
                      b === budget ? "border-primary/70 bg-primary/10 text-foreground" : "border-glass-border text-muted-foreground hover:border-foreground/25 hover:text-foreground"
                    }`}
                    data-testid={`budget-preset-${b}`}
                  >
                    {compactUsd(b)}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <label className="space-y-1.5 text-xs">
            <span className="block font-medium text-muted-foreground">Optimize for</span>
            <select value={objective} onChange={(e) => setObjective(e.target.value as PortfolioObjective)} className={fieldCls} data-testid="portfolio-objective">
              {PORTFOLIO_OBJECTIVES.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
            </select>
          </label>
          <Button onClick={() => void run()} disabled={busy} className="sm:ml-auto" data-testid="run-portfolio">
            {busy ? <Loader2 className="animate-spin motion-reduce:animate-none" /> : <Sparkles />}
            {busy ? "Testing combinations…" : "Find the best split"}
          </Button>
        </div>

        <Tabs defaultValue="ai" className="mt-6">
          <TabsList aria-label="Portfolio plan">
            <TabsTrigger value="ai">Recommended plan</TabsTrigger>
            <TabsTrigger value="mine" data-testid="tab-mine">My plan</TabsTrigger>
            <TabsTrigger value="compare" data-testid="tab-compare">Compare plans</TabsTrigger>
          </TabsList>
          <TabsContent value="ai" className="mt-5"><AiPortfolio onExplore={onExplore} /></TabsContent>
          <TabsContent value="mine" className="mt-5"><PortfolioCustomPlan onEdit={onEdit} /></TabsContent>
          <TabsContent value="compare" className="mt-5"><PortfolioCompare /></TabsContent>
        </Tabs>
      </div>
    </section>
  );
}

function AiPortfolio({ onExplore }: { onExplore: (id: string) => void }) {
  const plan = useTwin((s) => s.portfolioPlan);
  const busy = useTwin((s) => s.portfolioOptimizing);
  const properties = useTwin((s) => s.portfolio.properties);
  if (!plan) {
    return (
      <div className="rounded-xl border border-dashed border-glass-border px-5 py-10 text-center" data-testid="portfolio-plan-empty">
        <Sparkles className="mx-auto size-5 text-primary" aria-hidden />
        <p className="mt-3 text-sm font-medium">{busy ? "Testing every combination across your hotels…" : "Set your budget to discover the best investment opportunities across your hotels."}</p>
        <p className="mt-1 text-xs text-muted-foreground">Then press Find the best split. The engine picks at most one upgrade package per hotel within the budget.</p>
        <OptimizerMethod />
      </div>
    );
  }
  // Upgrades whose installed cost is a placeholder (assumption or bound) for that hotel's HVAC type, labeled under the results.
  const placeholder = new Set<string>();
  for (const a of plan.allocations) {
    const hvac = properties.find((p) => p.id === a.propertyId)?.input.hvacType;
    for (const id of a.evaluation?.upgradeIds ?? []) {
      const d = upgradeDef(id);
      if (((hvac && d.costStatusByHvac?.[hvac]) ?? d.costStatus ?? "placeholder") === "placeholder") placeholder.add(d.label);
    }
  }
  return (
    <div className="space-y-7" data-testid="portfolio-plan">
      <PlanKpis plan={plan} />
      {placeholder.size > 0 && (
        <p className="rounded-lg border border-heat/25 bg-heat/[0.06] px-3 py-2 text-xs text-heat" data-testid="portfolio-placeholder-costs">
          Includes placeholder installed costs (assumptions, not quotes) for: {[...placeholder].join(", ")}. Get contractor quotes before deciding.
        </p>
      )}
      <AllocationBar plan={plan} onExplore={onExplore} />
      <CurrentVsOptimized plan={plan} />
      <div className="space-y-2">
        <p className="text-sm font-medium">Recommended package per hotel</p>
        <div className="table-scroll relative overflow-x-auto rounded-xl border border-glass-border">
          <table className="w-full min-w-[760px] text-sm">
            <caption className="sr-only">Recommended package per hotel (estimates)</caption>
            <thead>
              <tr className="border-b border-glass-border text-left text-xs text-muted-foreground [&_th]:whitespace-nowrap">
                <th scope="col" className="px-3 py-2.5 font-medium">Hotel</th>
                <th scope="col" className="px-3 py-2.5 font-medium">Recommended package</th>
                <th scope="col" className="px-3 py-2.5 text-right font-medium">Gross cost</th>
                <th scope="col" className="px-3 py-2.5 text-right font-medium">Incentives</th>
                <th scope="col" className="px-3 py-2.5 text-right font-medium">Net</th>
                <th scope="col" className="px-3 py-2.5 text-right font-medium">Savings / yr</th>
                <th scope="col" className="px-3 py-2.5 text-right font-medium">Payback</th>
                <th scope="col" className="px-3 py-2.5"><span className="sr-only">Open</span></th>
              </tr>
            </thead>
            <tbody>
              {plan.allocations.map((a) => {
                const f = a.evaluation?.financials;
                return (
                  <tr key={a.propertyId} className="border-b border-glass-border/60 transition-colors last:border-0 hover:bg-foreground/[0.03]" data-testid="allocation-row">
                    <td className="px-3 py-2.5 font-medium">{a.name}</td>
                    <td className="px-3 py-2.5 text-xs">{a.evaluation ? a.evaluation.upgradeIds.map((id) => upgradeDef(id).label).join(" + ") : <span className="text-muted-foreground">No package (budget better used elsewhere)</span>}</td>
                    <td className="num px-3 py-2.5 text-right">{f ? usd(f.grossCost.mid) : "—"}</td>
                    <td className="num px-3 py-2.5 text-right text-muted-foreground">{f ? usd(f.incentivesTotal) : "—"}</td>
                    <td className="num px-3 py-2.5 text-right">{f ? usd(f.netInvestment.mid) : "—"}</td>
                    <td className="num px-3 py-2.5 text-right text-savings">{f ? usd(f.annualSavings.mid) : "—"}</td>
                    <td className="num px-3 py-2.5 text-right">{f?.simplePaybackYears != null ? `${f.simplePaybackYears.toFixed(1)} yr` : "—"}</td>
                    <td className="px-3 py-2.5 text-right">
                      <button type="button" className="inline-flex items-center gap-1 whitespace-nowrap text-xs font-medium text-primary hover:underline" onClick={() => onExplore(a.propertyId)} data-testid={`open-hotel-plan-${a.propertyId}`}>
                        Open hotel plan <ArrowRight className="size-3" aria-hidden />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      <div className="space-y-2">
        <p className="text-sm font-medium">All plan totals</p>
        <TotalsGrid totals={plan.totals} />
      </div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PortfolioReportActions />
      </div>
      <OptimizerMethod plan={plan} />
    </div>
  );
}

/** The headline figures of the optimizer's plan, straight from its totals. */
function PlanKpis({ plan }: { plan: PortfolioPlan }) {
  const t = plan.totals;
  const items: { k: string; v: string; exact: string; support?: string; key?: boolean }[] = [
    { k: "Allocated investment", v: compactUsd(t.grossCost), exact: usd(t.grossCost), support: `of ${compactUsd(plan.budget)} · ${compactUsd(t.netInvestment)} net of incentives` },
    { k: "Projected annual savings", v: `${compactUsd(t.annualSavings)}/yr`, exact: `${usd(t.annualSavings)} a year`, support: `${pct(t.shareOfPortfolioCost)} of energy spend`, key: true },
    { k: "Portfolio payback", v: t.paybackYears != null ? `${t.paybackYears.toFixed(1)} yrs` : "—", exact: t.paybackYears != null ? `${t.paybackYears.toFixed(2)} years` : "No payback", support: "net investment ÷ savings" },
    { k: "Carbon reduction", v: `${tonnes(t.carbonAvoidedKg)}/yr`, exact: `${Math.round(t.carbonAvoidedKg).toLocaleString("en-US")} kg CO₂e a year` },
    { k: "10-year NPV", v: compactUsd(t.npv10), exact: usd(t.npv10), support: `${t.propertiesWithPackage ?? plan.allocations.filter((a) => a.evaluation).length} of ${plan.allocations.length} hotels funded` },
  ];
  return (
    <dl className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 lg:grid-cols-5" data-testid="portfolio-plan-kpis">
      {items.map((x) => (
        <div key={x.k} className={`min-w-0 rounded-xl border p-4 ${x.key ? "border-primary/35 bg-primary/[0.05]" : "border-glass-border bg-background/40"}`} title={x.exact}>
          <dt className="flex items-center justify-between gap-2 text-xs text-muted-foreground">{x.k}<EstimateBadge /></dt>
          <dd className={`num mt-2 text-xl font-semibold tracking-tight ${x.key ? "text-primary" : ""}`} aria-label={`${x.k}: ${x.exact}`}>{x.v}</dd>
          {x.support && <dd className="mt-1 text-xs text-muted-foreground">{x.support}</dd>}
        </div>
      ))}
    </dl>
  );
}

/** Today's annual spend and carbon next to the same with the plan funded (today minus the plan's savings and avoided carbon). */
function CurrentVsOptimized({ plan }: { plan: PortfolioPlan }) {
  const summary = useTwin(selectPortfolioSummary);
  const t = plan.totals;
  const rows = [
    { k: "Annual energy spend", now: t.baselineCost, after: t.baselineCost - t.annualSavings, show: (n: number) => compactUsd(n), exact: usd },
    {
      k: "Annual carbon emissions",
      now: summary.totals.carbonKg,
      after: summary.totals.carbonKg - t.carbonAvoidedKg,
      show: (n: number) => tonnes(n),
      exact: (n: number) => `${Math.round(n).toLocaleString("en-US")} kg CO₂e`,
    },
  ];
  return (
    <div className="space-y-3" data-testid="portfolio-current-vs-optimized">
      <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
        Current → optimized <span className="rounded-full border border-heat/30 px-2 py-px text-[11px] font-normal text-heat">Projected, if funded · not implemented</span>
      </p>
      <div className="grid gap-3 md:grid-cols-2">
        {rows.map((r) => {
          const ratio = r.now > 0 ? Math.max(0, r.after) / r.now : 0;
          return (
            <div key={r.k} className="rounded-xl border border-glass-border bg-background/40 p-4" data-testid={`cvo-${r.k.startsWith("Annual energy") ? "cost" : "carbon"}`}>
              <p className="text-xs text-muted-foreground">{r.k}</p>
              <p className="mt-1.5 flex flex-wrap items-baseline gap-x-2 text-lg font-semibold">
                <span className="num text-muted-foreground line-through decoration-foreground/30" title={`Today: ${r.exact(r.now)}`}>{r.show(r.now)}</span>
                <ArrowRight className="size-4 self-center text-muted-foreground" aria-hidden />
                <span className="num" title={`Projected: ${r.exact(r.after)}`}>{r.show(r.after)}</span>
                <span className="num text-sm font-medium text-savings">−{pct(1 - ratio)}</span>
              </p>
              <div className="mt-3 space-y-1" aria-hidden>
                <span className="block h-1.5 rounded-full bg-foreground/20" />
                <span className="block h-1.5 rounded-full bg-primary/80" style={{ width: `${ratio * 100}%` }} />
              </div>
              <p className="mt-2 text-[11px] text-muted-foreground">Top bar: today · bottom bar: with the plan funded. Modeled estimates.</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** "How does the optimizer work?": the engine's own description of the search, behind a disclosure. */
function OptimizerMethod({ plan }: { plan?: PortfolioPlan }) {
  return (
    <Collapsible>
      <CollapsibleTrigger asChild>
        <button type="button" className="group mx-auto mt-4 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground" data-testid="optimizer-method-toggle">
          How does the optimizer work? <ChevronDown className="size-3 transition-transform group-data-[state=open]:rotate-180 motion-reduce:transition-none" aria-hidden />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-2 space-y-1 text-left text-xs text-muted-foreground" data-testid="optimizer-method">
        <p>
          Picked by the portfolio optimizer, an exact search over every hotel's upgrade combinations with the energy model: deterministic, the
          same inputs always give the same plan. The budget is compared with gross installed cost, and each hotel gets at most one package. The AI
          advisor only explains results.
        </p>
        {plan && (
          <p>
            {plan.combinationsTested.toLocaleString("en-US")} combinations tested across the hotels. {plan.method} {plan.notes.join(" ")}
          </p>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}
