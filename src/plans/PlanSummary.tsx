import { Info, TriangleAlert, X } from "lucide-react";
import type { PlanEvaluation } from "@/engine/hotel";
import { IllustrativeIncentive } from "./IllustrativeIncentive";
import { energySaved, pct, tonnes, unverifiedIncentives, usd, verifiedIncentives, years } from "./format";

/**
 * Totals of a custom plan, recomputed by the engine with every upgrade together (the same function as the AI packages): gross cost,
 * verified incentives and net investment separately, savings, payback, NPV, carbon and comfort, the budget, and what to watch out for.
 */
export function PlanSummary({ plan, rate, onRemove }: { plan: PlanEvaluation; rate: number; onRemove?: (id: string) => void }) {
  const e = plan.evaluation;
  const f = e?.financials;
  const used = f ? f.grossCost.mid / Math.max(1, plan.budget) : 0;
  const over = f ? f.grossCost.mid > plan.budget : false;
  const verified = f ? verifiedIncentives(f) : 0;
  const unverified = f ? unverifiedIncentives(f) : [];
  return (
    <section aria-label="Plan totals" className="space-y-3 rounded-xl border border-glass-border bg-glass p-3" data-testid="plan-summary" aria-live="polite">
      {f ? (
        <>
          <div>
            <div className="flex items-baseline justify-between gap-2 text-xs">
              <span className="text-muted-foreground">Budget</span>
              <span className={`tabular-nums ${over ? "text-heat" : ""}`}>
                {usd(f.grossCost.mid)} of {usd(plan.budget)} ({pct(used)})
              </span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
              <div className={`h-full rounded-full transition-[width] duration-300 ${over ? "bg-heat" : "bg-primary"}`} style={{ width: `${Math.min(100, used * 100)}%` }} />
            </div>
          </div>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs sm:grid-cols-4">
            <div><dt className="text-muted-foreground">Gross cost</dt><dd className="text-sm font-semibold tabular-nums">{usd(f.grossCost.mid)}</dd><dd className="text-[10px] text-muted-foreground tabular-nums">{usd(f.grossCost.low)}–{usd(f.grossCost.high)}</dd></div>
            <div><dt className="text-muted-foreground">Utility incentives</dt><dd className="text-sm font-semibold tabular-nums">{verified > 0 ? `−${usd(verified)}` : "$0"}</dd><dd className="text-[10px] text-muted-foreground">{unverified.length ? `published 2026 rates; ${unverified.length} more listed, not counted` : "published 2026 rates; pre-approval needed"}</dd></div>
            <div><dt className="text-muted-foreground">Net investment</dt><dd className="text-sm font-semibold tabular-nums">{usd(f.netInvestment.mid)}</dd></div>
            <div><dt className="text-muted-foreground">Saves / yr</dt><dd className="text-sm font-semibold tabular-nums text-savings">{usd(f.annualSavings.mid)}</dd><dd className="text-[10px] text-muted-foreground tabular-nums">{usd(f.annualSavings.low)}–{usd(f.annualSavings.high)}</dd></div>
            <div><dt className="text-muted-foreground">Simple payback</dt><dd className="text-sm font-semibold tabular-nums">{years(f.simplePaybackYears)}</dd></div>
            <div><dt className="text-muted-foreground">NPV 5 / 10 yr</dt><dd className="text-sm font-semibold tabular-nums">{usd(f.npv5?.mid ?? 0)} / {usd(f.npv10?.mid ?? 0)}</dd><dd className="text-[10px] text-muted-foreground">at {pct(rate)}</dd></div>
            <div><dt className="text-muted-foreground">CO₂ avoided / yr</dt><dd className="text-sm font-semibold tabular-nums">{tonnes(f.carbonAvoidedKgPerYear.mid)}</dd></div>
            <div><dt className="text-muted-foreground">Comfort score</dt><dd className="text-sm font-semibold tabular-nums">{pct(e.comfort.score)}</dd></div>
            <div className="col-span-2 sm:col-span-4"><dt className="text-muted-foreground">Energy saved / yr</dt><dd className="tabular-nums">{energySaved(f)}</dd></div>
          </dl>
          <IllustrativeIncentive f={f} />
          {e.lineItems.length > 0 && (
            <div className="border-t border-glass-border pt-2">
              <h4 className="mb-1 text-xs font-medium text-muted-foreground">In this plan (each upgrade's contribution, applied in the model's order)</h4>
              <ul className="space-y-1">
                {e.lineItems.map((li) => (
                  <li key={li.id} className="flex items-center justify-between gap-2 text-xs">
                    <span className="min-w-0 truncate">{li.label}</span>
                    <span className="flex shrink-0 items-center gap-2 tabular-nums">
                      <span className="text-muted-foreground">{usd(li.cost.mid)}</span>
                      <span className="text-savings">adds {usd(li.annualSavingsMid)} / yr</span>
                      {onRemove && (
                        <button type="button" onClick={() => onRemove(li.id)} aria-label={`Remove ${li.label}`} className="rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground">
                          <X className="h-3 w-3" />
                        </button>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      ) : (
        <p className="text-xs text-muted-foreground">{plan.warnings.find((w) => w.kind === "empty")?.message ?? "This plan cannot be evaluated; see the notes below."}</p>
      )}
      {plan.warnings.filter((w) => w.kind !== "empty").length > 0 && (
        <ul className="space-y-1" aria-label="Plan notes">
          {plan.warnings
            .filter((w) => w.kind !== "empty")
            .map((w, i) => (
              <li key={i} className={`flex items-start gap-1.5 text-[11px] ${w.severity === "warn" ? "text-heat" : "text-muted-foreground"}`}>
                {w.severity === "warn" ? <TriangleAlert className="mt-px h-3 w-3 shrink-0" /> : <Info className="mt-px h-3 w-3 shrink-0" />}
                <span>{w.message}</span>
              </li>
            ))}
        </ul>
      )}
      <p className="text-[10px] text-muted-foreground">
        Recomputed with all upgrades together (savings are not added up). Estimates: some installed costs are still assumptions (the LED retrofit mix, VRF equipment) and chiller costs are a lower bound; incentives count only ComEd's published 2026 rates (the 2025 lighting rate is shown separately as illustrative), are estimated from the modeled equipment and need the utility's approval.
      </p>
    </section>
  );
}
