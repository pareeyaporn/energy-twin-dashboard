import type { PortfolioTotals } from "@/engine/hotel";
import { useTwin } from "@/store/useTwin";
import { selectPortfolioCustomEvaluation } from "@/store/hotelDerived";
import { usd } from "@/twin/format";

type Row = { label: string; value: (t: PortfolioTotals) => number | null; show: (n: number | null) => string; better?: "high" | "low" };

const ROWS: Row[] = [
  { label: "Investment (gross)", value: (t) => t.grossCost, show: (n) => usd(n ?? 0) },
  { label: "Incentives", value: (t) => t.incentives, show: (n) => usd(n ?? 0), better: "high" },
  { label: "Net investment", value: (t) => t.netInvestment, show: (n) => usd(n ?? 0) },
  { label: "Annual savings", value: (t) => t.annualSavings, show: (n) => usd(n ?? 0), better: "high" },
  { label: "Payback", value: (t) => t.paybackYears, show: (n) => (n == null ? "—" : `${n.toFixed(1)} years`), better: "low" },
  { label: "NPV, 5 years", value: (t) => t.npv5, show: (n) => usd(n ?? 0), better: "high" },
  { label: "NPV, 10 years", value: (t) => t.npv10, show: (n) => usd(n ?? 0), better: "high" },
  { label: "CO₂ avoided / yr", value: (t) => t.carbonAvoidedKg, show: (n) => `${Math.round((n ?? 0) / 1000).toLocaleString("en-US")} t`, better: "high" },
  { label: "Lowest comfort score", value: (t) => t.comfortScore ?? null, show: (n) => (n == null ? "—" : n.toFixed(2)), better: "high" },
  { label: "Hotels with a package", value: (t) => t.propertiesWithPackage ?? null, show: (n) => String(n ?? 0) },
  { label: "Budget left", value: (t) => t.remainingBudget, show: (n) => usd(n ?? 0) },
];

/** The AI portfolio and mine side by side, from the same totals function. */
export function PortfolioCompare() {
  const ai = useTwin((s) => s.portfolioPlan);
  const mine = useTwin(selectPortfolioCustomEvaluation);
  if (!ai) return <p className="text-xs text-muted-foreground">Run the portfolio optimizer (AI recommended) to compare it with your portfolio.</p>;
  return (
    <div className="table-scroll overflow-x-auto" data-testid="portfolio-compare">
      <table className="w-full min-w-[480px] text-xs">
        <caption className="sr-only">AI portfolio vs my portfolio (estimates)</caption>
        <thead>
          <tr className="border-b border-border text-muted-foreground">
            <th className="p-1.5 text-left font-medium">Measure</th>
            <th className="p-1.5 text-right font-medium">AI portfolio</th>
            <th className="p-1.5 text-right font-medium">My portfolio</th>
          </tr>
        </thead>
        <tbody>
          {ROWS.map((r) => {
            const a = r.value(ai.totals);
            const m = r.value(mine.totals);
            const win = (x: number | null, y: number | null) =>
              r.better && x != null && y != null && Math.abs(x - y) > 1e-6 && (r.better === "high" ? x > y : x < y);
            return (
              <tr key={r.label} className="border-b border-border/50">
                <td className="p-1.5">{r.label}</td>
                <td className={`num p-1.5 text-right ${win(a, m) ? "font-semibold text-savings" : ""}`}>{r.show(a)}</td>
                <td className={`num p-1.5 text-right ${win(m, a) ? "font-semibold text-savings" : ""}`}>{r.show(m)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="mt-1 text-[11px] text-muted-foreground">
        Same budget ({usd(ai.budget)}, compared with gross cost) and the same engine for both. Better values are highlighted.{mine.overBudget ? " My portfolio is over budget." : ""} Estimates.
      </p>
    </div>
  );
}
