import type { PortfolioTotals } from "@/engine/hotel";
import { percent, usd } from "@/twin/format";

/** Portfolio totals as a compact grid (the same for the AI portfolio and mine). Estimates. */
export function TotalsGrid({ totals }: { totals: PortfolioTotals }) {
  const items: [string, string][] = [
    ["Investment (gross)", usd(totals.grossCost)],
    ["Incentives", usd(totals.incentives)],
    ["Net investment", usd(totals.netInvestment)],
    ["Budget left", usd(totals.remainingBudget)],
    ["Annual savings", `${usd(totals.annualSavings)} (${percent(totals.shareOfPortfolioCost)} of energy cost)`],
    ["Payback", totals.paybackYears != null ? `${totals.paybackYears.toFixed(1)} years` : "—"],
    ["NPV 5 / 10 years", `${usd(totals.npv5)} / ${usd(totals.npv10)}`],
    ["CO₂ avoided", `${Math.round(totals.carbonAvoidedKg / 1000).toLocaleString("en-US")} t / yr`],
  ];
  return (
    <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-glass-border bg-glass-border sm:grid-cols-4">
      {items.map(([k, v]) => (
        <div key={k} className="min-w-0 bg-card p-3">
          <dt className="text-xs text-muted-foreground">{k}</dt>
          <dd className="num mt-0.5 text-sm font-medium">{v}</dd>
        </div>
      ))}
    </dl>
  );
}
