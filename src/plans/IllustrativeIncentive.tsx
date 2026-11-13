import type { FinancialBreakdown } from "@/engine/hotel";
import { usd, years } from "./format";

/**
 * A verified incentive from another program year (ComEd's 2025 lighting rates): what the plan would look like if it were renewed.
 * Shown separately and labeled illustrative; the plan's own figures never include it (docs/15, the program-year rule).
 */
export function IllustrativeIncentive({ f, className = "" }: { f: FinancialBreakdown; className?: string }) {
  const i = f.illustrativeIncentives;
  if (!i) return null;
  return (
    <p className={`rounded-md border border-dashed border-glass-border px-2 py-1 text-[11px] leading-snug text-muted-foreground ${className}`} data-testid="illustrative-incentive">
      <span className="font-medium text-foreground/90">Illustrative, {i.label}:</span> {usd(i.total)} incentive, net investment {usd(i.netInvestment)},
      payback {years(i.simplePaybackYears)}. Not counted in the figures above, because that {i.programYears.join(", ")} rate is not yet confirmed for
      the analysis year.
    </p>
  );
}
