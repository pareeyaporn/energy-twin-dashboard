// The investment priority score, explained with the engine's own figures (src/engine/hotel/portfolio.ts, `portfolioSummary`):
//   1. each hotel's candidate packages are the eligible upgrade combinations for its own systems (the single-hotel optimizer's list);
//   2. its best package is the one with the highest 10-year NPV among those within the hotel's own budget (gross cost) with NPV > 0;
//   3. its return per dollar = that package's 10-year NPV ÷ its net investment (installed cost minus confirmed incentives);
//   4. score = return per dollar ÷ the portfolio's highest return per dollar × 100, rounded (the best hotel scores 100; none found: 0).
// Energy spending is not an input: a large hotel can spend the most and still rank lower.
import type { PropertySummary } from "@/engine/hotel";
import { upgradeDef } from "@/engine/hotel";

export interface PriorityRow {
  id: string;
  name: string;
  city: string;
  score: number;
  /** The best package's upgrades, null when the hotel has no package with a positive 10-year NPV within its budget. */
  packageLabel: string | null;
  netInvestment: number | null;
  npv10: number | null;
  /** 10-year NPV per dollar of net investment. */
  returnPerDollar: number | null;
  annualCost: number;
}

export const PRIORITY_STEPS = [
  "Each hotel's candidates are the upgrade combinations that fit its own systems, as in the single-hotel optimizer.",
  "Its best package is the one with the highest 10-year net present value (NPV) within the hotel's own budget, counting only packages with a positive NPV.",
  "Return per dollar = that package's 10-year NPV ÷ its net investment (installed cost minus confirmed incentives).",
  "Score = the hotel's return per dollar ÷ the portfolio's best return per dollar × 100. The best hotel scores 100; a hotel with no such package scores 0.",
];

export const PRIORITY_NOT_USED =
  "Energy spending, floor area and intensity are not inputs: a large hotel can spend the most and still rank lower if its upgrades return less per dollar.";

export function priorityRows(rows: PropertySummary[]): PriorityRow[] {
  return rows
    .map((r) => {
      const c = r.potential;
      return {
        id: r.id,
        name: r.name,
        city: r.city,
        score: r.priorityScore,
        packageLabel: c ? c.upgradeIds.map((id) => upgradeDef(id).label).join(" + ") : null,
        netInvestment: c ? c.netInvestment : null,
        npv10: c ? c.npv10 : null,
        returnPerDollar: c && c.netInvestment > 0 ? c.npv10 / c.netInvestment : null,
        annualCost: r.annual.cost,
      };
    })
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
}

/** The hotel to look at first and why, in plain words (null when no hotel has a package worth doing). */
export function startHere(rows: PropertySummary[]): { top: PropertySummary; reason: string; contrast: string | null } | null {
  const ranked = [...rows].sort((a, b) => b.priorityScore - a.priorityScore || a.name.localeCompare(b.name));
  const top = ranked[0];
  if (!top || !top.potential || top.priorityScore <= 0) return null;
  const c = top.potential;
  const usd = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;
  const per = c.netInvestment > 0 ? c.npv10 / c.netInvestment : null;
  const reason = `Its best package returns the most per dollar invested: ${usd(c.npv10)} of 10-year net present value on ${usd(c.netInvestment)} net${per !== null ? ` (${per.toFixed(2)} per dollar)` : ""}, saving about ${usd(c.annualSavings)} a year${c.paybackYears !== null ? ` with a ${c.paybackYears.toFixed(1)}-year payback` : ""}.`;
  const spender = [...rows].sort((a, b) => b.annual.cost - a.annual.cost)[0]!;
  const contrast = spender.id !== top.id ? `${spender.name} spends the most (${usd(spender.annual.cost)} a year), but its upgrades return less per dollar, so it ranks lower.` : null;
  return { top, reason, contrast };
}
