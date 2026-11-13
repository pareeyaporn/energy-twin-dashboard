import type { PropertySummary } from "@/engine/hotel";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { usd } from "@/twin/format";
import { PRIORITY_NOT_USED, PRIORITY_STEPS, priorityRows } from "./priority";

/** "Why this ranking?": the investment priority score worked out for every hotel shown, from the engine's own figures. */
export function PriorityExplainer({ rows, open, onOpenChange, focusId }: { rows: PropertySummary[]; open: boolean; onOpenChange: (o: boolean) => void; focusId?: string | null }) {
  const list = priorityRows(rows);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-3xl" data-testid="priority-explainer">
        <DialogHeader>
          <DialogTitle>How investment priority is ranked</DialogTitle>
          <DialogDescription>Which hotel gives the most return for each dollar invested. Modeled estimates for the hotels shown.</DialogDescription>
        </DialogHeader>
        <ol className="list-decimal space-y-1 pl-5 text-xs">
          {PRIORITY_STEPS.map((s) => <li key={s}>{s}</li>)}
        </ol>
        <p className="text-xs text-muted-foreground">{PRIORITY_NOT_USED}</p>
        <div className="table-scroll overflow-x-auto rounded-xl border border-glass-border">
          <table className="w-full min-w-[640px] text-xs">
            <caption className="sr-only">Investment priority by hotel (modeled estimates)</caption>
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                <th className="p-2 text-left font-medium">Hotel</th>
                <th className="p-2 text-left font-medium">Best package</th>
                <th className="p-2 text-right font-medium">Net investment</th>
                <th className="p-2 text-right font-medium">10-year NPV</th>
                <th className="p-2 text-right font-medium">Per dollar</th>
                <th className="p-2 text-right font-medium">Score</th>
                <th className="p-2 text-right font-medium">Energy cost / yr</th>
              </tr>
            </thead>
            <tbody>
              {list.map((r) => (
                <tr key={r.id} className={`border-b border-border/50 ${r.id === focusId ? "bg-primary/10" : ""}`} data-testid="priority-row">
                  <td className="p-2 font-medium">{r.name}<span className="block text-[10px] font-normal text-muted-foreground">{r.city}</span></td>
                  <td className="p-2">{r.packageLabel ?? <span className="text-muted-foreground">None with a positive NPV within its budget</span>}</td>
                  <td className="num p-2 text-right">{r.netInvestment !== null ? usd(r.netInvestment) : "—"}</td>
                  <td className="num p-2 text-right">{r.npv10 !== null ? usd(r.npv10) : "—"}</td>
                  <td className="num p-2 text-right">{r.returnPerDollar !== null ? r.returnPerDollar.toFixed(2) : "—"}</td>
                  <td className="num p-2 text-right font-semibold text-primary">{r.score}</td>
                  <td className="num p-2 text-right text-muted-foreground">{usd(r.annualCost)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Energy cost is shown for comparison only; it is not part of the score. Scores are relative to the hotels shown (filters change them). NPV at the
          app's discount rate over 10 years, with savings growing at the EIA price outlook; incentives are counted only when confirmed for 2026.
        </p>
      </DialogContent>
    </Dialog>
  );
}
