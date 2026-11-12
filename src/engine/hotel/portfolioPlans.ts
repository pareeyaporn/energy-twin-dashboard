// Hotel portfolio, Phase 13 P1: the user's own portfolio plan (one custom plan per property) and portfolio stress tests. Every
// per-property figure comes from the single-hotel functions (evaluatePlan, stressTestReport); this file only adds them up.
import { hotelData } from './data';
import { DEFAULT_FINANCE } from './finance';
import { evaluatePlan } from './plans';
import type { PlanEvaluation, PlanItem } from './plans';
import { portfolioTotals, prepareProperty } from './portfolio';
import type { PortfolioTotals } from './portfolio';
import { stressTestReport } from './stress';
import type { StressPlanInput, StressReport } from './stress';
import type { StressTest } from './scenarios';
import type { HotelData, HotelInput, PortfolioProperty } from './types';

// ---- The user's portfolio plan ----

export interface PortfolioCustomRow {
  propertyId: string;
  name: string;
  /** The custom plan chosen for this property; null when the property gets nothing. */
  planId: string | null;
  planName: string | null;
  /** The plan evaluated with the single-hotel function (warnings included); null when no plan is chosen. */
  plan: PlanEvaluation | null;
  baselineCost: number;
}

export interface PortfolioCustomEvaluation {
  budget: number;
  rows: PortfolioCustomRow[];
  totals: PortfolioTotals;
  overBudget: boolean;
  warnings: string[];
}

/**
 * The user's portfolio: one custom plan (or none) per property, each evaluated exactly as in the property's own plan builder (the whole
 * building model recomputed with the plan's upgrades together), on the property's baseline. Totals use the same function as the AI
 * portfolio, so the two compare directly. The budget is compared with gross cost.
 */
export function evaluatePortfolioCustomPlan(
  items: { property: PortfolioProperty; input?: HotelInput; plan: { id: string; name: string; items: PlanItem[] } | null }[],
  options: { budget: number; discountRate?: number },
  data: HotelData = hotelData,
): PortfolioCustomEvaluation {
  const discountRate = options.discountRate ?? DEFAULT_FINANCE.discountRate;
  const rows: PortfolioCustomRow[] = items.map(({ property, input, plan }) => {
    const prep = prepareProperty(property, input ?? property.input, data);
    const evaluation = plan ? evaluatePlan(prep.ctx, plan.items, { assumptions: { discountRate }, budget: options.budget, lineItems: false }, data) : null;
    return {
      propertyId: property.id,
      name: prep.hotel.profile.name,
      planId: plan?.id ?? null,
      planName: plan?.name ?? null,
      plan: evaluation,
      baselineCost: prep.baseline.annual.cost,
    };
  });
  const baselineCost = rows.reduce((t, r) => t + r.baselineCost, 0);
  const totals = portfolioTotals(rows.map((r) => r.plan?.evaluation ?? null), baselineCost, options.budget);
  const warnings: string[] = [];
  const overBudget = totals.grossCost > options.budget + 1e-6;
  if (overBudget)
    warnings.push(`The plans' gross cost is over the $${Math.round(options.budget).toLocaleString('en-US')} portfolio budget by $${Math.round(totals.grossCost - options.budget).toLocaleString('en-US')}.`);
  for (const r of rows) {
    if (r.plan && !r.plan.evaluation && r.plan.ids.length) warnings.push(`${r.name}: the plan has a conflict and is left out of the totals.`);
    else if (r.plan && !r.plan.ids.length) warnings.push(`${r.name}: the chosen plan is empty.`);
  }
  if (rows.every((r) => !r.plan)) warnings.push('Choose a custom plan for at least one hotel (or copy the AI portfolio).');
  return { budget: options.budget, rows, totals, overBudget, warnings };
}

// ---- Portfolio stress tests ----

export interface PortfolioStressRow {
  propertyId: string;
  name: string;
  /** False when the property is outside the test's scope (its stressed figures equal the normal ones). */
  inScope: boolean;
  /** The single-hotel stress report (null outside the scope). */
  report: StressReport | null;
  normalCost: number;
  stressedCost: number;
  /** Cost with the property's plan installed (equal to the cost without one if it has no plan). */
  withPlanNormal: number;
  withPlanStressed: number;
  planLabel: string | null;
}

export interface PortfolioStressReport {
  testId: StressTest['id'];
  duration: StressTest['duration'];
  rows: PortfolioStressRow[];
  totals: {
    normalCost: number;
    stressedCost: number;
    /** Stressed minus normal, without plans. */
    increase: number;
    withPlansNormal: number;
    withPlansStressed: number;
    /** What the plans save in a normal year and under the stress. */
    savingsNormal: number;
    savingsStressed: number;
    /** Extra cost the plans avoid because of the stress (savings under stress minus normal savings). */
    extraAvoided: number;
    /** Share of the stress's cost increase the plans absorb (null when the stress does not raise costs). */
    shareOfIncreaseAbsorbed: number | null;
  };
  notes: string[];
}

/**
 * A stress test on one property, a selection or all of them: each in-scope property gets the single-hotel stress report on its baseline,
 * with its plan (AI package or custom plan) if it has one. Persistent changes report payback and NPV under the change per property;
 * temporary events do not change returns (as in Phase 12).
 */
export function portfolioStressReport(
  items: { property: PortfolioProperty; input?: HotelInput; plan: StressPlanInput | null }[],
  test: StressTest,
  scope: readonly string[],
  options: { discountRate?: number } = {},
  data: HotelData = hotelData,
): PortfolioStressReport {
  const discountRate = options.discountRate ?? DEFAULT_FINANCE.discountRate;
  const rows: PortfolioStressRow[] = items.map(({ property, input, plan }) => {
    const prep = prepareProperty(property, input ?? property.input, data);
    const inScope = scope.includes(property.id);
    const normalCost = prep.baseline.annual.cost;
    if (!inScope) {
      // Outside the scope the stress does not apply; the plan's savings are the normal-year ones.
      const r = plan?.ids.length ? stressTestReport(prep.hotel, test, {}, {}, plan, { budget: Infinity, objective: 'balanced', discountRate, recommend: false }, data) : null;
      const withPlan = r?.plan?.costWithPlanNormal ?? normalCost;
      return { propertyId: property.id, name: prep.hotel.profile.name, inScope, report: null, normalCost, stressedCost: normalCost, withPlanNormal: withPlan, withPlanStressed: withPlan, planLabel: plan?.label ?? null };
    }
    const report = stressTestReport(prep.hotel, test, {}, test.scenario, plan, { budget: Infinity, objective: 'balanced', discountRate, recommend: false }, data);
    return {
      propertyId: property.id,
      name: prep.hotel.profile.name,
      inScope,
      report,
      normalCost: report.normal.cost,
      stressedCost: report.stressed.cost,
      withPlanNormal: report.plan?.costWithPlanNormal ?? report.normal.cost,
      withPlanStressed: report.plan?.costWithPlanStressed ?? report.stressed.cost,
      planLabel: plan?.label ?? null,
    };
  });
  const sum = (f: (r: PortfolioStressRow) => number) => rows.reduce((t, r) => t + f(r), 0);
  const normalCost = sum((r) => r.normalCost);
  const stressedCost = sum((r) => r.stressedCost);
  const withPlansNormal = sum((r) => r.withPlanNormal);
  const withPlansStressed = sum((r) => r.withPlanStressed);
  const savingsNormal = normalCost - withPlansNormal;
  const savingsStressed = stressedCost - withPlansStressed;
  const increase = stressedCost - normalCost;
  const extraAvoided = savingsStressed - savingsNormal;
  const notes: string[] = [];
  if (test.duration === 'temporary') notes.push('A temporary event: payback, NPV and the recommendations are not changed, because how often it recurs is not modeled.');
  else notes.push('A persistent change: each hotel’s payback and NPV under the change are in its row. Open a hotel’s twin to see whether its own recommendation changes.');
  if (rows.every((r) => !r.planLabel)) notes.push('No plans selected: the figures show the hotels as they are.');
  if (scope.length === 0) notes.push('No hotels selected for the test.');
  return {
    testId: test.id,
    duration: test.duration,
    rows,
    totals: {
      normalCost,
      stressedCost,
      increase,
      withPlansNormal,
      withPlansStressed,
      savingsNormal,
      savingsStressed,
      extraAvoided,
      shareOfIncreaseAbsorbed: increase > 1 ? extraAvoided / increase : null,
    },
    notes,
  };
}
