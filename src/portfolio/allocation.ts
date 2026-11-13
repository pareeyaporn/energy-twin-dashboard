// The portfolio optimizer's budget split, read for display (the allocation bar). No calculation: each segment is an allocation's gross
// installed cost as the engine evaluated it (`evaluation.financials.grossCost.mid`, the cost the budget is checked against), and the
// remainder is the plan's own `totals.remainingBudget`.
import type { PortfolioPlan } from "@/engine/hotel";
import { upgradeDef } from "@/engine/hotel";

/**
 * Categorical colors for hotels (validated for adjacent segments on the navy card surface: CVD ΔE ≥ 8.4, normal vision ≥ 19.3, all ≥ 3:1).
 * Assigned by the hotel's position in the organization, never by rank, so a hotel keeps its color when the plan changes.
 */
export const HOTEL_COLORS = ["#3987e5", "#d95926", "#199e70", "#c98500", "#d55181", "#008300", "#9085e9", "#e66767"];

export interface AllocationSegment {
  propertyId: string;
  name: string;
  /** Gross installed cost of the hotel's package (what the budget is checked against). */
  amount: number;
  /** amount ÷ plan budget. */
  share: number;
  netInvestment: number;
  annualSavings: number;
  paybackYears: number | null;
  packageLabel: string;
  color: string;
}

export interface AllocationView {
  budget: number;
  segments: AllocationSegment[];
  /** Budget left unallocated (the plan's remainingBudget, never below 0 for display). */
  remainder: number;
  remainderShare: number;
  /** Hotels the optimizer gave no package. */
  unfunded: { propertyId: string; name: string }[];
}

/** The plan's allocations as bar segments, in the plan's order. `order` (the organization's property ids) fixes each hotel's color. */
export function allocationView(plan: PortfolioPlan, order: string[] = plan.allocations.map((a) => a.propertyId)): AllocationView {
  const budget = plan.budget;
  const colorOf = (id: string) => {
    const i = order.indexOf(id);
    return HOTEL_COLORS[(i < 0 ? plan.allocations.findIndex((a) => a.propertyId === id) : i) % HOTEL_COLORS.length]!;
  };
  const segments: AllocationSegment[] = [];
  const unfunded: AllocationView["unfunded"] = [];
  for (const a of plan.allocations) {
    const f = a.evaluation?.financials;
    if (!a.evaluation || !f) {
      unfunded.push({ propertyId: a.propertyId, name: a.name });
      continue;
    }
    segments.push({
      propertyId: a.propertyId,
      name: a.name,
      amount: f.grossCost.mid,
      share: budget > 0 ? f.grossCost.mid / budget : 0,
      netInvestment: f.netInvestment.mid,
      annualSavings: f.annualSavings.mid,
      paybackYears: f.simplePaybackYears ?? null,
      packageLabel: a.evaluation.upgradeIds.map((id) => upgradeDef(id).label).join(" + "),
      color: colorOf(a.propertyId),
    });
  }
  const remainder = Math.max(0, plan.totals.remainingBudget);
  return { budget, segments, remainder, remainderShare: budget > 0 ? remainder / budget : 0, unfunded };
}
