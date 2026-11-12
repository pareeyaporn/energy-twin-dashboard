// Stress-test report: the hotel in a normal year versus under a stress test, and how an investment plan performs under both.
// Uses the same functions as everything else (scenario contexts, evaluatePackage, the optimizer); nothing is computed separately.
import { hotelData } from './data';
import { evaluatePackage } from './package';
import { optimizeInvestmentPortfolio } from './optimizer';
import { prepareScenarioContext, prepareUpgradeContext } from './upgrades';
import type { UpgradeContext } from './upgrades';
import type { StressTest } from './scenarios';
import type { HotelData, Objective, PlanAmounts, ResolvedProfile, Scenario, Totals, UpgradeId } from './types';

export interface StressPlanInput {
  label: string;
  source: 'ai' | 'custom';
  ids: UpgradeId[];
  amounts?: PlanAmounts;
}

export interface StressPlanResult {
  label: string;
  source: 'ai' | 'custom';
  /** Yearly energy cost with the plan installed, in a normal year and under the stress test. */
  costWithPlanNormal: number;
  costWithPlanStressed: number;
  /** What the plan saves per year in each case (versus the hotel without it in the same year). */
  savingsNormal: number;
  savingsStressed: number;
  /** Extra costs the plan avoids because of the stress (savings under stress minus normal savings). */
  extraAvoided: number;
  /** How much of the stress's extra cost the plan absorbs (extra avoided / stress cost increase), when the stress raises costs. */
  shareOfIncreaseAbsorbed: number | null;
  /** Payback and NPV under the persistent change (null for temporary events, whose returns are not changed). */
  persistent: { paybackNormal: number | null; paybackStressed: number | null; npv10Normal: number; npv10Stressed: number } | null;
}

export interface StressReport {
  testId: StressTest['id'];
  duration: StressTest['duration'];
  normal: Totals;
  stressed: Totals;
  /** Stressed minus normal. */
  delta: Totals;
  plan: StressPlanResult | null;
  /** For persistent changes: the optimizer's pick for the objective, normally and under the change. */
  recommendation: { normalIds: UpgradeId[]; stressedIds: UpgradeId[]; changed: boolean; normalName: string; stressedName: string } | null;
  notes: string[];
}

const isEmpty = (s: Scenario) => Object.keys(s).length === 0;

function context(hotel: ResolvedProfile, scenario: Scenario, data: HotelData): UpgradeContext {
  return isEmpty(scenario) ? prepareUpgradeContext(hotel, data) : prepareScenarioContext(hotel, scenario, data);
}

/**
 * The stress report. `normalScenario` is the user's current what-if ({} for the baseline); `stressedScenario` is the same with the stress
 * test applied. The plan is evaluated on both with `evaluatePackage`, exactly like the optimizer.
 */
export function stressTestReport(
  hotel: ResolvedProfile,
  test: StressTest,
  normalScenario: Scenario,
  stressedScenario: Scenario,
  plan: StressPlanInput | null,
  options: { budget: number; objective: Objective; discountRate: number; /** Run the optimizer twice to see if the pick changes (slow; default true). */ recommend?: boolean },
  data: HotelData = hotelData,
): StressReport {
  const normalCtx = context(hotel, normalScenario, data);
  const stressCtx = context(hotel, stressedScenario, data);
  const normal = normalCtx.baseline.annual;
  const stressed = stressCtx.baseline.annual;
  const delta: Totals = {
    elecKWh: stressed.elecKWh - normal.elecKWh,
    gasTherms: stressed.gasTherms - normal.gasTherms,
    siteKBtu: stressed.siteKBtu - normal.siteKBtu,
    elecCost: stressed.elecCost - normal.elecCost,
    gasCost: stressed.gasCost - normal.gasCost,
    cost: stressed.cost - normal.cost,
    carbonKg: stressed.carbonKg - normal.carbonKg,
  };
  const notes: string[] = [];
  const persistent = test.duration === 'persistent';
  const assumptions = { discountRate: options.discountRate };

  let planResult: StressPlanResult | null = null;
  if (plan && plan.ids.length) {
    const opts = { budget: options.budget, assumptions, lineItems: false as const, ...(plan.amounts ? { amounts: plan.amounts } : {}) };
    const a = evaluatePackage(normalCtx, plan.ids, opts, data);
    const b = evaluatePackage(stressCtx, plan.ids, opts, data);
    const savingsNormal = a.financials.annualSavings.mid;
    const savingsStressed = b.financials.annualSavings.mid;
    const extraAvoided = savingsStressed - savingsNormal;
    planResult = {
      label: plan.label,
      source: plan.source,
      costWithPlanNormal: a.newAnnualCost,
      costWithPlanStressed: b.newAnnualCost,
      savingsNormal,
      savingsStressed,
      extraAvoided,
      shareOfIncreaseAbsorbed: delta.cost > 1 ? extraAvoided / delta.cost : null,
      persistent: persistent
        ? {
            paybackNormal: a.financials.simplePaybackYears,
            paybackStressed: b.financials.simplePaybackYears,
            npv10Normal: a.financials.npv10?.mid ?? 0,
            npv10Stressed: b.financials.npv10?.mid ?? 0,
          }
        : null,
    };
  }
  if (!persistent) notes.push('A temporary event: payback, NPV and the recommendation are not changed, because how often it recurs is not modeled.');
  if (test.id === 'low_solar' && !(plan?.ids ?? []).some((id) => id.startsWith('rooftop_solar')))
    notes.push('The hotel has no solar today, so its own costs do not change; add solar to a plan to see the effect.');

  const recommendation = persistent && options.recommend !== false ? recommendationUnder(normalCtx, stressCtx, normalScenario, stressedScenario, options, data) : null;
  return { testId: test.id, duration: test.duration, normal, stressed, delta, plan: planResult, recommendation, notes };
}

function recommendationUnder(
  normalCtx: UpgradeContext,
  stressCtx: UpgradeContext,
  normalScenario: Scenario,
  stressedScenario: Scenario,
  options: { budget: number; objective: Objective; discountRate: number },
  data: HotelData,
): StressReport['recommendation'] {
  const assumptions = { discountRate: options.discountRate };
  const run = (ctx: UpgradeContext, scenario: Scenario) =>
    optimizeInvestmentPortfolio(ctx, { budget: options.budget, objective: options.objective, assumptions, ...(isEmpty(scenario) ? {} : { scenario }) }, data).objectiveWinner;
  const n = run(normalCtx, normalScenario);
  const s = run(stressCtx, stressedScenario);
  if (!n || !s) return null;
  return { normalIds: n.evaluation.upgradeIds, stressedIds: s.evaluation.upgradeIds, changed: n.evaluation.id !== s.evaluation.id, normalName: n.evaluation.name, stressedName: s.evaluation.name };
}

/** Whether the optimizer's pick for the objective changes under a persistent change (two optimizer runs; call it off the click path). */
export function stressRecommendation(
  hotel: ResolvedProfile,
  normalScenario: Scenario,
  stressedScenario: Scenario,
  options: { budget: number; objective: Objective; discountRate: number },
  data: HotelData = hotelData,
): StressReport['recommendation'] {
  return recommendationUnder(context(hotel, normalScenario, data), context(hotel, stressedScenario, data), normalScenario, stressedScenario, options, data);
}
