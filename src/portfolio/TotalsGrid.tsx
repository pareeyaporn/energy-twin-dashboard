import type { PortfolioTotals } from "@/engine/hotel";
import { percent, usd } from "@/twin/format";

/** Portfolio totals as tiles (the same for the AI portfolio and mine). */
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
    <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {items.map(([k, v]) => (
        <div key={k} className="rounded-lg bg-accent/30 p-2">
          <dt className="text-[11px] text-muted-foreground">{k}</dt>
          <dd className="num text-sm font-medium">{v}</dd>
        </div>
      ))}
    </dl>
  );
}
