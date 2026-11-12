import { useMemo } from "react";
import { Copy, Pencil } from "lucide-react";
import { useTwin } from "@/store/useTwin";
import { selectPortfolioCustomEvaluation, selectPortfolioPlanChoice } from "@/store/hotelDerived";
import { Button } from "@/components/ui/button";
import { usd } from "@/twin/format";
import { TotalsGrid } from "./TotalsGrid";

/** "My portfolio": one custom plan (or none) per hotel, evaluated exactly as in each hotel's plan builder, with portfolio totals. */
export function PortfolioCustomPlan({ onEdit }: { onEdit: (propertyId: string, planId: string | null) => void }) {
  const properties = useTwin((s) => s.portfolio.properties);
  const plans = useTwin((s) => s.customPlans);
  const choice = useTwin(selectPortfolioPlanChoice);
  const evaluation = useTwin(selectPortfolioCustomEvaluation);
  const setChoice = useTwin((s) => s.setPortfolioCustomPlan);
  const aiPlan = useTwin((s) => s.portfolioPlan);
  const customizeAi = useTwin((s) => s.customizeAiPortfolio);
  const options = useMemo(
    () => Object.fromEntries(properties.map((p) => [p.id, plans.filter((x) => !x.propertyId || x.propertyId === p.id)])),
    [properties, plans],
  );

  return (
    <div className="space-y-3" data-testid="my-portfolio">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">Pick a custom plan for each hotel. Build or edit plans in a hotel's twin (Invest, Build your own); the numbers here are the same.</p>
        <Button size="sm" variant="secondary" disabled={!aiPlan} onClick={() => customizeAi()} data-testid="customize-ai-portfolio" title={aiPlan ? undefined : "Run the portfolio optimizer first"}>
          <Copy /> Customize AI plan
        </Button>
      </div>
      <div className="table-scroll overflow-x-auto">
        <table className="w-full min-w-[760px] text-xs">
          <caption className="sr-only">My portfolio plan (estimates)</caption>
          <thead>
            <tr className="border-b border-border text-left text-muted-foreground">
              <th className="p-1.5 font-medium">Hotel</th>
              <th className="p-1.5 font-medium">Plan</th>
              <th className="p-1.5 text-right font-medium">Gross cost</th>
              <th className="p-1.5 text-right font-medium">Net</th>
              <th className="p-1.5 text-right font-medium">Savings / yr</th>
              <th className="p-1.5 text-right font-medium">Payback</th>
              <th className="p-1.5"><span className="sr-only">Edit</span></th>
            </tr>
          </thead>
          <tbody>
            {evaluation.rows.map((r) => {
              const f = r.plan?.evaluation?.financials;
              const chosen = choice[r.propertyId] ?? null;
              const warn = r.plan?.warnings.find((w) => w.severity === "warn" && w.kind !== "budget");
              return (
                <tr key={r.propertyId} className="border-b border-border/50 align-top" data-testid="my-portfolio-row">
                  <td className="p-1.5 font-medium">{r.name}</td>
                  <td className="p-1.5">
                    <select
                      aria-label={`Plan for ${r.name}`}
                      value={chosen?.id ?? ""}
                      onChange={(e) => setChoice(r.propertyId, e.target.value || null)}
                      className="max-w-56 rounded-md border border-input bg-background px-1.5 py-0.5"
                    >
                      <option value="">No plan</option>
                      {(options[r.propertyId] ?? []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                    {r.plan?.evaluation && <div className="mt-0.5 text-[11px] text-muted-foreground">{r.plan.evaluation.name}</div>}
                    {warn && <div className="mt-0.5 text-[11px] text-heat">{warn.message}</div>}
                  </td>
                  <td className="num p-1.5 text-right">{f ? usd(f.grossCost.mid) : "—"}</td>
                  <td className="num p-1.5 text-right">{f ? usd(f.netInvestment.mid) : "—"}</td>
                  <td className="num p-1.5 text-right text-savings">{f ? usd(f.annualSavings.mid) : "—"}</td>
                  <td className="num p-1.5 text-right">{f?.simplePaybackYears != null ? `${f.simplePaybackYears.toFixed(1)} yr` : "—"}</td>
                  <td className="p-1.5 text-right">
                    <button type="button" className="inline-flex items-center gap-1 whitespace-nowrap text-primary hover:underline" onClick={() => onEdit(r.propertyId, chosen?.id ?? null)}>
                      <Pencil className="size-3" /> {chosen ? "Edit in twin" : "Build in twin"}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <TotalsGrid totals={evaluation.totals} />
      <p className={`text-xs ${evaluation.overBudget ? "text-heat" : "text-muted-foreground"}`} data-testid="my-portfolio-budget">
        Budget used {usd(evaluation.totals.grossCost)} of {usd(evaluation.budget)} (gross cost, before incentives) · {evaluation.overBudget ? `over by ${usd(-evaluation.totals.remainingBudget)}` : `${usd(evaluation.totals.remainingBudget)} left`}
      </p>
      {evaluation.warnings.filter((w) => !/over the/.test(w)).map((w) => <p key={w} className="text-[11px] text-muted-foreground">{w}</p>)}
    </div>
  );
}
