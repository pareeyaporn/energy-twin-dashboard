import { useState } from "react";
import type { FinancialBreakdown, PackageComfort } from "@/engine/hotel";
import { useTwin } from "@/store/useTwin";
import { selectCustomPlanEvaluation, selectVisibleCustomPlans } from "@/store/hotelDerived";
import { pct, tonnes, usd, verifiedIncentives, years } from "./format";

interface Column {
  key: string;
  label: string;
  kind: "ai" | "custom";
  f: FinancialBreakdown;
  comfort: PackageComfort;
  overBudget: boolean;
}

const ROWS: { label: string; value: (c: Column) => string; better?: (a: number, b: number) => boolean; num?: (c: Column) => number }[] = [
  { label: "Gross installation cost", value: (c) => usd(c.f.grossCost.mid) },
  { label: "Utility incentives (published rates)", value: (c) => (verifiedIncentives(c.f) > 0 ? usd(verifiedIncentives(c.f)) : "$0") },
  { label: "Net investment", value: (c) => usd(c.f.netInvestment.mid) },
  { label: "Annual savings", value: (c) => usd(c.f.annualSavings.mid), num: (c) => c.f.annualSavings.mid, better: (a, b) => a > b },
  { label: "Simple payback", value: (c) => years(c.f.simplePaybackYears), num: (c) => c.f.simplePaybackYears ?? Infinity, better: (a, b) => a < b },
  { label: "NPV, 5 years", value: (c) => usd(c.f.npv5?.mid ?? 0), num: (c) => c.f.npv5?.mid ?? -Infinity, better: (a, b) => a > b },
  { label: "NPV, 10 years", value: (c) => usd(c.f.npv10?.mid ?? 0), num: (c) => c.f.npv10?.mid ?? -Infinity, better: (a, b) => a > b },
  { label: "Net benefit, 10 years", value: (c) => usd(c.f.netBenefit10.mid) },
  { label: "CO₂ avoided / yr", value: (c) => tonnes(c.f.carbonAvoidedKgPerYear.mid), num: (c) => c.f.carbonAvoidedKgPerYear.mid, better: (a, b) => a > b },
  { label: "Comfort score", value: (c) => pct(c.comfort.score), num: (c) => c.comfort.score, better: (a, b) => a > b },
  { label: "Within budget", value: (c) => (c.overBudget ? "Over budget" : "Yes") },
];

/** The AI plan and your plans side by side, all from the same engine calculation. */
export function PlanCompare({ onCustomize }: { onCustomize: (packageId: string) => void }) {
  const hotelPlan = useTwin((s) => s.hotelPlan);
  const plans = useTwin(selectVisibleCustomPlans);
  const rate = useTwin((s) => s.hotelDiscountRate);
  const budget = useTwin((s) => s.hotel.profile.budget);
  const state = useTwin();
  const aiPackages = hotelPlan ? hotelPlan.packages : [];
  // Pick AI packages by role: two roles can recommend the same combination (same id).
  const [aiRole, setAiRole] = useState<string | null>(null);
  const ai = aiPackages.find((p) => p.role === aiRole) ?? hotelPlan?.objectiveWinner ?? aiPackages[0] ?? null;
  const [picked, setPicked] = useState<string[] | null>(null);
  const chosen = picked ?? plans.slice(-2).map((p) => p.id);

  const columns: Column[] = [];
  if (ai) columns.push({ key: `ai:${ai.role}`, label: `AI · ${ai.roleLabel}`, kind: "ai", f: ai.evaluation.financials, comfort: ai.evaluation.comfort, overBudget: ai.evaluation.financials.grossCost.mid > (hotelPlan?.budget ?? budget) });
  for (const id of chosen) {
    const p = plans.find((x) => x.id === id);
    const ev = p ? selectCustomPlanEvaluation(state, p.id) : null;
    if (p && ev?.evaluation) columns.push({ key: p.id, label: p.name, kind: "custom", f: ev.evaluation.financials, comfort: ev.evaluation.comfort, overBudget: ev.evaluation.financials.grossCost.mid > ev.budget });
  }
  const best = (row: (typeof ROWS)[number]) => {
    if (!row.num || !row.better || columns.length < 2) return null;
    let b = columns[0]!;
    for (const c of columns) if (row.better(row.num(c), row.num(b))) b = c;
    return b.key;
  };

  return (
    <div className="space-y-3" data-testid="plan-compare">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        {aiPackages.length > 0 ? (
          <label className="flex items-center gap-1.5">
            <span className="text-muted-foreground">AI plan</span>
            <select value={ai?.role ?? ""} onChange={(e) => setAiRole(e.target.value)} className="h-7 rounded-md border border-glass-border bg-background px-1.5" aria-label="AI plan">
              {aiPackages.map((p) => <option key={p.role} value={p.role}>{p.roleLabel}</option>)}
            </select>
          </label>
        ) : (
          <span className="text-muted-foreground">Run "Find the best investments" to add the AI plan.</span>
        )}
        <span className="text-muted-foreground">Your plans:</span>
        {plans.length === 0 && <span className="text-muted-foreground">none yet</span>}
        {plans.map((p) => {
          const on = chosen.includes(p.id);
          return (
            <button
              key={p.id}
              type="button"
              aria-pressed={on}
              onClick={() => setPicked(on ? chosen.filter((x) => x !== p.id) : [...chosen, p.id].slice(-3))}
              className={`rounded-full border px-2 py-0.5 ${on ? "border-primary bg-primary/15 text-primary" : "border-glass-border text-muted-foreground hover:bg-accent"}`}
            >
              {p.name}
            </button>
          );
        })}
      </div>
      {columns.length === 0 ? (
        <p className="text-xs text-muted-foreground">Nothing to compare yet.</p>
      ) : (
        <div className="table-scroll overflow-x-auto">
          <table className="sticky-first-column w-full min-w-[480px] text-xs">
            <caption className="sr-only">AI plan and custom plans compared, estimates</caption>
            <thead>
              <tr className="border-b border-glass-border">
                <th className="p-2 text-left font-normal text-muted-foreground">Estimate</th>
                {columns.map((c) => <th key={c.key} className={`p-2 text-right font-medium ${c.kind === "ai" ? "text-primary" : ""}`}>{c.label}</th>)}
              </tr>
            </thead>
            <tbody>
              {ROWS.map((r) => {
                const b = best(r);
                return (
                  <tr key={r.label} className="border-b border-glass-border/50">
                    <th className="p-2 text-left font-normal text-muted-foreground">{r.label}</th>
                    {columns.map((c) => (
                      <td key={c.key} className={`p-2 text-right tabular-nums ${b === c.key ? "font-semibold text-savings" : ""} ${r.label === "Within budget" && c.overBudget ? "text-heat" : ""}`}>{r.value(c)}</td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground">
        <span>NPV at {pct(rate)}. Green marks the best value in a row. All plans use the same engine and the same assumptions. Estimates.</span>
        {ai && <button type="button" onClick={() => onCustomize(ai.evaluation.id)} className="text-primary hover:underline">Customize this AI plan →</button>}
      </div>
    </div>
  );
}
