import { CATEGORIES, ZONE_IDS, ZONE_LABELS } from '../constants';
import { opportunitiesByZone } from '../opportunities';
import { optimizeInvestmentPortfolio } from '../optimizer';
import { evaluatePackage } from '../package';
import { simulateOccupancyChange } from '../scenarios';
import { contextFromBaseline, eligibleUpgrades, upgradeDef } from '../upgrades';
import type {
  Category,
  EnergyResult,
  PortfolioResult,
  RankedPackage,
  ResolvedProfile,
  Scenario,
  ScenarioResult,
  UpgradeId,
} from '../types';
import { parseBudgets } from './intent';

const r0 = (n: number) => Math.round(n);
const r1 = (n: number) => Math.round(n * 10) / 10;

const CATEGORY_LABEL: Record<Category, string> = {
  hvac: 'HVAC',
  lighting: 'Lighting',
  hotWater: 'Hot water',
  kitchen: 'Cooking and refrigeration',
  equipment: 'Plug loads and equipment',
  other: 'Other',
};

export interface AdvisorPackage {
  role: string;
  name: string;
  upgradeIds: UpgradeId[];
  cost: number;
  annualSavings: { low: number; mid: number; high: number };
  annualSavingsPctOfBill: number;
  paybackYears: number | null;
  netBenefit: number;
  carbonAvoidedTonnes: number;
  remainingBudget: number;
  comfortScore: number;
  note: string | null;
}

export interface AdvisorPlan {
  budget: number;
  combinationsTested: number;
  feasibleCount: number;
  packages: AdvisorPackage[];
  /** The package that wins for the hotel's objective (may repeat one of the packages above). */
  objectiveWinner: AdvisorPackage | null;
  emptyReason: string | null;
}

export interface AdvisorUpgrade {
  id: UpgradeId;
  label: string;
  cost: number;
  annualSavings: { low: number; mid: number; high: number };
  annualSavingsPctOfBill: number;
  paybackYears: number | null;
  netBenefit: number;
  carbonAvoidedTonnes: number;
  comfortScore: number;
  /** Labels of the zones where this upgrade lowers the cost. */
  zonesHelped: string[];
}

/** Everything the advisor may talk about. Every number is computed by the engine and rounded here; the AI adds none. */
export interface AdvisorContext {
  disclaimer: string;
  hotel: {
    name: string;
    city: string;
    rooms: number;
    floorAreaSqft: number;
    floors: number;
    yearBuilt: number;
    hvacType: string;
    occupancyPct: number;
    budget: number;
    horizonYears: number;
    objective: string;
    defaultsUsed: string[];
    syntheticDemo: boolean;
  };
  baseline: {
    annualCost: number;
    annualElecKWh: number;
    annualGasTherms: number;
    annualCarbonTonnes: number;
    costPerRoom: number;
    estimated: boolean;
    byCategory: { label: string; annualCost: number; sharePct: number }[];
    byZone: { label: string; annualCost: number; sharePct: number }[];
  };
  scenario: null | {
    description: string[];
    annualCostChange: number;
    annualCostChangePct: number;
    drivers: { label: string; annualCostChange: number }[];
    comfortWarnings: string[];
  };
  upgradesMeasuredAgainst: 'baseline' | 'scenario';
  upgrades: AdvisorUpgrade[];
  occupancyExample: {
    fromPct: number;
    toPct: number;
    annualCostChange: number;
    annualCostChangePct: number;
    annualElecKWhChange: number;
    annualGasThermsChange: number;
    biggestChanges: { label: string; annualCostChange: number }[];
  };
  plan: AdvisorPlan | null;
  /** Plans for other budgets named in the question (for example "$30,000"). */
  otherBudgets: AdvisorPlan[];
}

export interface AdvisorInput {
  hotel: ResolvedProfile;
  baseline: EnergyResult;
  /** The effective scenario (the user's settings with any stress test on top). */
  scenario: Scenario;
  scenarioResult: ScenarioResult | null;
  plan: PortfolioResult | null;
  syntheticDemo: boolean;
}

const roleName = (p: RankedPackage) => p.roleLabel;

function summarizePackage(p: RankedPackage, bill: number): AdvisorPackage {
  const e = p.evaluation;
  return {
    role: roleName(p),
    name: e.name,
    upgradeIds: e.upgradeIds,
    cost: r0(e.cost.mid),
    annualSavings: { low: r0(e.annualSavings.low), mid: r0(e.annualSavings.mid), high: r0(e.annualSavings.high) },
    annualSavingsPctOfBill: bill > 0 ? r1((e.annualSavings.mid / bill) * 100) : 0,
    paybackYears: e.metrics.paybackYears === null ? null : r1(e.metrics.paybackYears),
    netBenefit: r0(e.metrics.netBenefit),
    carbonAvoidedTonnes: r1(e.carbonAvoidedKg.mid / 1000),
    remainingBudget: r0(e.metrics.remainingBudget),
    comfortScore: Math.round(e.comfort.score * 100) / 100,
    note: p.note ?? null,
  };
}

function summarizePlan(plan: PortfolioResult): AdvisorPlan {
  return {
    budget: r0(plan.budget),
    combinationsTested: plan.combinationsTested,
    feasibleCount: plan.feasibleCount,
    packages: plan.packages.map((p) => summarizePackage(p, plan.baselineAnnualCost)),
    objectiveWinner: plan.objectiveWinner ? summarizePackage(plan.objectiveWinner, plan.baselineAnnualCost) : null,
    emptyReason: plan.emptyReason,
  };
}

function describeScenario(s: Scenario): string[] {
  const out: string[] = [];
  if (s.occupancy !== undefined) out.push(`Occupancy set to ${r0(s.occupancy * 100)}%`);
  if (s.occupancyDeltaPts) out.push('Occupancy raised in some months');
  if (s.smartRoomControls) out.push('Smart room controls on');
  if (s.setpoints) out.push('Room setpoints changed');
  if (s.commonAreaHvacHours !== undefined) out.push(`Common-area HVAC runs ${s.commonAreaHvacHours} hours a day`);
  if (s.lightingHoursPerDay !== undefined) out.push(`Common-area lighting runs ${s.lightingHoursPerDay} hours a day`);
  if (s.electricityRateChangePct !== undefined) out.push(`Electricity price changed ${s.electricityRateChangePct}%`);
  if (s.gasRateChangePct !== undefined) out.push(`Gas price changed ${s.gasRateChangePct}%`);
  if (s.weatherOffsetF !== undefined) out.push('Weather changed from normal');
  return out;
}

/**
 * Build the advisor's context: the hotel, its baseline, the current what-if, every upgrade on its own, an occupancy example,
 * the current optimizer plan and plans for any other budgets in the question. Pure and deterministic.
 */
export function buildAdvisorContext(input: AdvisorInput, question = ''): AdvisorContext {
  const { hotel, baseline, scenarioResult, plan } = input;
  const p = hotel.profile;
  const bill = baseline.annual.cost;
  const measured = scenarioResult?.after ?? baseline;
  const ctx = contextFromBaseline(hotel, measured);

  const opp = opportunitiesByZone(ctx);
  const upgrades: AdvisorUpgrade[] = eligibleUpgrades(ctx.profile, measured.annual.elecKWh).map((id) => {
    const e = evaluatePackage(ctx, [id], { lineItems: false });
    return {
      id,
      label: upgradeDef(id).label,
      cost: r0(e.cost.mid),
      annualSavings: { low: r0(e.annualSavings.low), mid: r0(e.annualSavings.mid), high: r0(e.annualSavings.high) },
      annualSavingsPctOfBill: measured.annual.cost > 0 ? r1((e.annualSavings.mid / measured.annual.cost) * 100) : 0,
      paybackYears: e.metrics.paybackYears === null ? null : r1(e.metrics.paybackYears),
      netBenefit: r0(e.metrics.netBenefit),
      carbonAvoidedTonnes: r1(e.carbonAvoidedKg.mid / 1000),
      comfortScore: Math.round(e.comfort.score * 100) / 100,
      zonesHelped: ZONE_IDS.filter((z) => opp[z].some((o) => o.id === id)).map((z) => ZONE_LABELS[z]),
    };
  });

  const from = p.occupancy;
  const to = from <= 0.7 ? Math.min(1, from + 0.25) : Math.max(0, from - 0.25);
  const occ = simulateOccupancyChange(hotel, to, from);
  const topChanges = ZONE_IDS.map((z) => ({ label: ZONE_LABELS[z], annualCostChange: r0(occ.deltaByZone[z].cost) }))
    .sort((a, b) => Math.abs(b.annualCostChange) - Math.abs(a.annualCostChange))
    .slice(0, 3);

  const planBudgets = new Set<number>(plan ? [r0(plan.budget)] : []);
  const otherBudgets = parseBudgets(question)
    .filter((b) => !planBudgets.has(b))
    .slice(0, 2)
    .map((budget) => summarizePlan(optimizeInvestmentPortfolio(ctx, { budget })));

  return {
    disclaimer:
      'Planning estimates from synthetic and public data, shown as ranges. Not an engineering audit, and no savings are guaranteed.',
    hotel: {
      name: p.name,
      city: `${p.city}, ${p.state}`,
      rooms: p.rooms,
      floorAreaSqft: r0(p.floorAreaSqft),
      floors: p.floors,
      yearBuilt: p.yearBuilt,
      hvacType: p.hvacType.replace('_', ' '),
      occupancyPct: r0(p.occupancy * 100),
      budget: r0(p.budget),
      horizonYears: p.horizonYears,
      objective: p.objective,
      defaultsUsed: hotel.defaulted,
      syntheticDemo: input.syntheticDemo,
    },
    baseline: {
      annualCost: r0(bill),
      annualElecKWh: r0(baseline.annual.elecKWh),
      annualGasTherms: r0(baseline.annual.gasTherms),
      annualCarbonTonnes: r1(baseline.annual.carbonKg / 1000),
      costPerRoom: r0(bill / p.rooms),
      estimated: baseline.estimated,
      byCategory: CATEGORIES.map((c) => ({
        label: CATEGORY_LABEL[c],
        annualCost: r0(baseline.byCategory[c].cost),
        sharePct: bill > 0 ? r1((baseline.byCategory[c].cost / bill) * 100) : 0,
      })).sort((a, b) => b.annualCost - a.annualCost),
      byZone: ZONE_IDS.map((z) => ({
        label: ZONE_LABELS[z],
        annualCost: r0(baseline.byZone[z].cost),
        sharePct: bill > 0 ? r1((baseline.byZone[z].cost / bill) * 100) : 0,
      })).sort((a, b) => b.annualCost - a.annualCost),
    },
    scenario: scenarioResult
      ? {
          description: describeScenario(input.scenario),
          annualCostChange: r0(scenarioResult.delta.cost),
          annualCostChangePct: bill > 0 ? r1((scenarioResult.delta.cost / bill) * 100) : 0,
          drivers: scenarioResult.drivers.map((d) => ({ label: d.label, annualCostChange: r0(d.deltaCost) })),
          comfortWarnings: scenarioResult.flags.filter((f) => f.severity === 'warn').map((f) => f.message),
        }
      : null,
    upgradesMeasuredAgainst: scenarioResult ? 'scenario' : 'baseline',
    upgrades,
    occupancyExample: {
      fromPct: r0(from * 100),
      toPct: r0(to * 100),
      annualCostChange: r0(occ.delta.cost),
      annualCostChangePct: bill > 0 ? r1((occ.delta.cost / bill) * 100) : 0,
      annualElecKWhChange: r0(occ.delta.elecKWh),
      annualGasThermsChange: r0(occ.delta.gasTherms),
      biggestChanges: topChanges,
    },
    plan: plan ? summarizePlan(plan) : null,
    otherBudgets,
  };
}
