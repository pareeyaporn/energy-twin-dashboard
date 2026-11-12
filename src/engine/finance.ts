import type { Assumptions } from './types';

export interface CostedItem {
  cost: number;
  lifetimeYears: number;
}

/** Years to repay `cost` from first-year savings. null when there are no savings. */
export function paybackYears(cost: number, annualSavings: number): number | null {
  return annualSavings > 0 ? cost / annualSavings : null;
}

/**
 * Net present value over the horizon (mid scenario):
 *   Σ_{t=1..H} s × (1+g)^(t−1) / (1+r)^t  − cost  + residual
 *   residual = Σ items itemCost × max(0, life − H) / life / (1+r)^H
 * s = first-year savings, g = priceGrowth, r = discountRate, H = horizonYears.
 */
export function netValue(annualSavings: number, items: readonly CostedItem[], a: Assumptions): number {
  const { priceGrowth: g, discountRate: r, horizonYears: H } = a;
  let pv = 0;
  for (let t = 1; t <= H; t++) pv += (annualSavings * (1 + g) ** (t - 1)) / (1 + r) ** t;
  const cost = items.reduce((s, i) => s + i.cost, 0);
  const residual = items.reduce(
    (s, i) => s + (i.cost * Math.max(0, i.lifetimeYears - H)) / i.lifetimeYears / (1 + r) ** H,
    0,
  );
  return pv - cost + residual;
}

export function financials(annualSavings: number, items: readonly CostedItem[], a: Assumptions) {
  const cost = items.reduce((s, i) => s + i.cost, 0);
  return { cost, paybackYears: paybackYears(cost, annualSavings), value: netValue(annualSavings, items, a) };
}
