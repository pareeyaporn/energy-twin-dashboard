// Display formatting for the plan views. Formatting only: every number comes from the engine through the store.
import type { FinancialBreakdown } from "@/engine/hotel";

export const usd = (n: number) => `${n < 0 ? "-" : ""}$${Math.round(Math.abs(n)).toLocaleString("en-US")}`;
export const years = (n: number | null) => (n === null ? "No payback" : `${n.toFixed(1)} yr`);
export const tonnes = (kg: number) => `${(kg / 1000).toLocaleString("en-US", { maximumFractionDigits: 1 })} t`;
export const pct = (r: number) => `${Math.round(r * 100)}%`;

export function energySaved(f: FinancialBreakdown): string {
  const parts = [`${Math.round(f.annualEnergySavings.elecKWh).toLocaleString("en-US")} kWh`];
  if (Math.abs(f.annualEnergySavings.gasTherms) >= 1) parts.push(`${Math.round(f.annualEnergySavings.gasTherms).toLocaleString("en-US")} therms`);
  return parts.join(" · ");
}

/** Incentives applied (verified, with an amount) and the ones only listed (unverified, $0 in the figures). */
export const verifiedIncentives = (f: FinancialBreakdown) => f.incentives.filter((i) => i.applied).reduce((s, i) => s + i.amount, 0);
export const unverifiedIncentives = (f: FinancialBreakdown) => f.incentives.filter((i) => !i.applied);
