import type { FinancialAssumptions, FinancialMetrics } from './types';

export const DEFAULT_FINANCE: Omit<FinancialAssumptions, 'horizonYears'> = { priceGrowth: 0.02, discountRate: 0.03 };

export interface CostedItem {
  cost: number;
  lifetimeYears: number;
}

/**
 * Financial metrics for a package at the mid scenario.
 *   netBenefit      = Σ_{t=1..H} s × (1+g)^(t−1)  − cost             (nominal, no residual value)
 *   npv             = Σ_{t=1..H} s × (1+g)^(t−1) / (1+r)^t  − cost
 *   npvWithResidual = npv + Σ items cost × max(0, life − H) / life / (1+r)^H
 * s = first-year savings, g = price growth, r = discount rate, H = horizon.
 */
export function calculateFinancialMetrics(
  input: {
    annualSavings: number;
    carbonAvoidedKgPerYear: number;
    items: readonly CostedItem[];
    budget: number;
  },
  a: FinancialAssumptions,
): FinancialMetrics {
  const { priceGrowth: g, discountRate: r, horizonYears: H } = a;
  const cost = input.items.reduce((s, i) => s + i.cost, 0);
  let nominal = 0;
  let pv = 0;
  for (let t = 1; t <= H; t++) {
    const s = input.annualSavings * (1 + g) ** (t - 1);
    nominal += s;
    pv += s / (1 + r) ** t;
  }
  const residual = input.items.reduce(
    (s, i) => s + (i.cost * Math.max(0, i.lifetimeYears - H)) / i.lifetimeYears / (1 + r) ** H,
    0,
  );
  const netBenefit = nominal - cost;
  return {
    cost,
    annualSavings: input.annualSavings,
    paybackYears: input.annualSavings > 0 ? cost / input.annualSavings : null,
    netBenefit,
    npv: pv - cost,
    npvWithResidual: pv - cost + residual,
    roi: cost > 0 ? netBenefit / cost : null,
    horizonYears: H,
    carbonAvoidedKgPerYear: input.carbonAvoidedKgPerYear,
    carbonAvoidedKgHorizon: input.carbonAvoidedKgPerYear * H,
    remainingBudget: input.budget - cost,
  };
}
