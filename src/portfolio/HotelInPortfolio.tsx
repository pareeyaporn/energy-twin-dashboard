import { Link } from "@tanstack/react-router";
import { Building2 } from "lucide-react";
import { upgradeDef } from "@/engine/hotel";
import { useTwin } from "@/store/useTwin";
import { selectActiveProperty, selectPortfolioSummary } from "@/store/hotelDerived";
import { usd } from "@/twin/format";
import { OPTIMIZER_ANCHOR } from "./anchors";

const pct = (a: number, b: number) => (b > 0 ? `${Math.round((a / b) * 100)}%` : "—");

/**
 * "This hotel in the portfolio": shown in a portfolio hotel's Invest tab. Its savings potential and priority within the portfolio, and,
 * once the portfolio optimizer has run, what the shared budget gives this hotel and its share of the portfolio's savings. Same engine
 * figures as the portfolio page (the summary and the portfolio plan), so the two views agree.
 */
export function HotelInPortfolio() {
  const property = useTwin(selectActiveProperty);
  const summary = useTwin(selectPortfolioSummary);
  const plan = useTwin((s) => s.portfolioPlan);
  const org = useTwin((s) => s.portfolio);
  const setView = useTwin((s) => s.setPortfolioView);
  if (!property) return null;
  const row = summary.properties.find((r) => r.id === property.id);
  const t = summary.totals;
  const ranked = [...summary.properties].sort((a, b) => b.priorityScore - a.priorityScore || a.name.localeCompare(b.name));
  const rank = row ? ranked.findIndex((r) => r.id === row.id) + 1 : 0;
  const alloc = plan?.allocations.find((a) => a.propertyId === property.id) ?? null;
  const f = alloc?.evaluation?.financials;
  return (
    <section aria-label="This hotel in the portfolio" className="mx-5 space-y-2 rounded-xl border border-glass-border p-3 text-xs" data-testid="hotel-in-portfolio">
      <h3 className="flex items-center gap-1.5 text-sm font-semibold"><Building2 className="size-4 text-primary" aria-hidden />This hotel in {org.name}</h3>
      {!row ? (
        <p className="text-muted-foreground">Hidden by the portfolio's current filters, so it is not part of the portfolio totals shown there.</p>
      ) : (
        <dl className="grid grid-cols-2 gap-x-3 gap-y-1">
          <dt className="text-muted-foreground">Investment priority</dt>
          <dd className="num text-right">{row.priorityScore} / 100 · #{rank} of {summary.properties.length}</dd>
          <dt className="text-muted-foreground">Savings potential</dt>
          <dd className="num text-right">{row.potential ? `${usd(row.potential.annualSavings)} / yr (${pct(row.potential.annualSavings, t.savingsPotential)} of the portfolio's)` : "None found"}</dd>
          <dt className="text-muted-foreground">Energy cost</dt>
          <dd className="num text-right">{usd(row.annual.cost)} / yr ({pct(row.annual.cost, t.cost)} of the portfolio's)</dd>
        </dl>
      )}
      {plan ? (
        alloc && f ? (
          <p data-testid="hotel-in-portfolio-plan">
            In the portfolio plan ({usd(plan.budget)} shared budget): <span className="font-medium">{alloc.evaluation!.upgradeIds.map((id) => upgradeDef(id).label).join(" + ")}</span>,{" "}
            {usd(f.netInvestment.mid)} net, saving {usd(f.annualSavings.mid)} a year: {pct(f.annualSavings.mid, plan.totals.annualSavings)} of the portfolio plan's savings.
          </p>
        ) : (
          <p className="text-muted-foreground" data-testid="hotel-in-portfolio-plan">The portfolio plan ({usd(plan.budget)}) gives this hotel no package: the budget does more elsewhere.</p>
        )
      ) : (
        <p className="text-muted-foreground">Run the portfolio optimizer to see what one shared budget would give this hotel.</p>
      )}
      <Link to="/" onClick={() => setView({ selectedId: property.id, anchor: OPTIMIZER_ANCHOR })} className="inline-block text-primary hover:underline" data-testid="open-portfolio-plan">
        {plan ? "Open the portfolio plan" : "Go to the portfolio optimizer"}
      </Link>
      <p className="text-[10px] text-muted-foreground">Modeled estimates; the portfolio uses each hotel's own budget for its savings potential and one shared budget for the plan.</p>
    </section>
  );
}
