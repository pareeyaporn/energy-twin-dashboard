// The advisor's tools (docs/23): the AI may ask the engine to run a what-if, find the best plan for a budget, evaluate or compare
// upgrades, run a stress test, or look at the hotel chain. The browser runs every tool with the engine (pure functions, no network)
// and sends back compact JSON; the AI then explains those numbers and the number check accepts only numbers from the context and
// from these results. Inputs are validated and clamped to the engine's own bounds; nothing here changes the app's state.
import { compareUpgrades } from '../comparison';
import { hotelData } from '../data';
import { optimizeInvestmentPortfolio } from '../optimizer';
import { evaluatePlan } from '../plans';
import type { PlanItem } from '../plans';
import { optimizePortfolioBudget, portfolioSummary } from '../portfolio';
import type { PortfolioPlan } from '../portfolio';
import { STRESS_TESTS, simulateEnergyScenario } from '../scenarios';
import type { StressTest } from '../scenarios';
import { prepareUpgradeContext, upgradeDef } from '../upgrades';
import type {
  EnergyResult,
  FinancialBreakdown,
  HotelInput,
  Objective,
  PortfolioObjective,
  PortfolioProperty,
  PortfolioResult,
  ResolvedProfile,
  Scenario,
  Totals,
  UpgradeId,
} from '../types';

export type ToolName =
  | 'run_scenario'
  | 'find_best_plan'
  | 'evaluate_upgrades'
  | 'compare_upgrades'
  | 'run_stress_test'
  | 'portfolio_overview'
  | 'portfolio_optimize';

export const TOOL_NAMES: readonly ToolName[] = [
  'run_scenario',
  'find_best_plan',
  'evaluate_upgrades',
  'compare_upgrades',
  'run_stress_test',
  'portfolio_overview',
  'portfolio_optimize',
];

export interface ToolCall {
  id: string;
  name: ToolName;
  input: Record<string, unknown>;
}

/** What the browser knows when it runs a tool: the open hotel, its baseline and settings, and the chain. */
export interface ToolEnv {
  hotel: ResolvedProfile;
  /** Today's baseline (no what-if). */
  baseline: EnergyResult;
  discountRate: number;
  portfolio?: {
    name: string;
    items: { property: PortfolioProperty; input?: HotelInput }[];
    budget: number;
    objective: PortfolioObjective;
  } | null;
}

/** A tool that ran: what was asked (after clamping), the compact engine result sent to the AI, and objects the action buttons use. */
export interface ToolRun {
  id: string;
  name: ToolName;
  input: Record<string, unknown>;
  result: Record<string, unknown>;
  /** Not sent to the AI: the engine objects behind the result (a plan to apply, a scenario to set). */
  detail?: { scenario?: Scenario; plan?: PortfolioResult; planBaseline?: EnergyResult; portfolioPlan?: PortfolioPlan; stressId?: StressTest['id']; upgradeIds?: UpgradeId[] };
}

const OBJECTIVES: readonly Objective[] = ['balanced', 'annual_savings', 'payback', 'roi', 'carbon'];
const PORTFOLIO_OBJECTIVES: readonly PortfolioObjective[] = ['balanced', 'annual_savings', 'npv10', 'payback', 'carbon'];
const UPGRADE_IDS = hotelData.upgrades.upgrades.map((u) => u.id as UpgradeId);

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v)) ? Number(v) : null);
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const usd = (n: number) => Math.round(n);
const t1 = (kg: number) => Math.round(kg / 100) / 10;
const yrs = (n: number | null) => (n === null ? null : Math.round(n * 10) / 10);
const pct1 = (x: number) => Math.round(x * 1000) / 10;

function totals(t: Totals) {
  return { annualCost: usd(t.cost), elecKWh: Math.round(t.elecKWh), gasTherms: Math.round(t.gasTherms), carbonTonnes: t1(t.carbonKg) };
}

function financials(f: FinancialBreakdown) {
  return {
    installedCost: usd(f.grossCost.mid),
    incentivesCounted: usd(f.incentivesTotal),
    netInvestment: usd(f.netInvestment.mid),
    annualSavings: usd(f.annualSavings.mid),
    annualSavingsLow: usd(f.annualSavings.low),
    annualSavingsHigh: usd(f.annualSavings.high),
    paybackYears: yrs(f.simplePaybackYears),
    netBenefit10Years: usd(f.netBenefit10.mid),
    npv10Years: usd(f.npv10?.mid ?? f.netBenefit10.mid),
    carbonAvoidedTonnesPerYear: t1(f.carbonAvoidedKgPerYear.mid),
  };
}

const upgradeLabel = (id: UpgradeId) => upgradeDef(id).label;

/** Upgrade ids the AI may name, by id or by a readable alias ("led", "solar"). */
export function resolveUpgradeId(v: unknown): UpgradeId | null {
  if (typeof v !== 'string') return null;
  const s = v.trim().toLowerCase().replace(/[\s-]+/g, '_');
  if ((UPGRADE_IDS as string[]).includes(s)) return s as UpgradeId;
  const alias: Record<string, UpgradeId> = {
    led: 'led_lighting', lighting: 'led_lighting', solar: 'rooftop_solar', rooftop_solar_full: 'rooftop_solar', thermostats: 'smart_room_controls',
    smart_thermostats: 'smart_room_controls', room_controls: 'smart_room_controls', sensors: 'occupancy_sensors', ems: 'energy_management',
    hvac: 'hvac_upgrade', water: 'water_heating', hot_water: 'water_heating', insulate: 'insulation', envelope: 'insulation',
  };
  return alias[s] ?? null;
}

// ---- The tools ----

/** run_scenario: the hotel under a what-if, against today's baseline. */
function runScenario(env: ToolEnv, input: Record<string, unknown>): ToolRun['result'] & { _scenario: Scenario; _clamped: Record<string, unknown> } {
  const sc: Scenario = {};
  const used: Record<string, unknown> = {};
  const occ = num(input['occupancyPct']);
  if (occ !== null) {
    const v = clamp(occ, 5, 100);
    sc.occupancy = v / 100;
    used['occupancyPct'] = v;
  }
  const el = num(input['electricityPriceChangePct']);
  if (el !== null) used['electricityPriceChangePct'] = sc.electricityRateChangePct = clamp(el, -50, 200);
  const gas = num(input['gasPriceChangePct']);
  if (gas !== null) used['gasPriceChangePct'] = sc.gasRateChangePct = clamp(gas, -50, 200);
  const heat = num(input['heatingSetpointF']);
  const cool = num(input['coolingSetpointF']);
  if (heat !== null || cool !== null) {
    sc.setpoints = {};
    if (heat !== null) used['heatingSetpointF'] = sc.setpoints.occupiedHeatF = clamp(heat, 60, 78);
    if (cool !== null) used['coolingSetpointF'] = sc.setpoints.occupiedCoolF = clamp(cool, 68, 82);
  }
  const wx = num(input['weatherOffsetF']);
  if (wx !== null) used['weatherOffsetF'] = sc.weatherOffsetF = clamp(wx, -15, 15);
  const hvacH = num(input['commonAreaHvacHours']);
  if (hvacH !== null) used['commonAreaHvacHours'] = sc.commonAreaHvacHours = clamp(hvacH, 0, 24);
  const lightH = num(input['lightingHoursPerDay']);
  if (lightH !== null) used['lightingHoursPerDay'] = sc.lightingHoursPerDay = clamp(lightH, 0, 24);
  if (typeof input['smartRoomControls'] === 'boolean') used['smartRoomControls'] = sc.smartRoomControls = input['smartRoomControls'];
  if (Object.keys(used).length === 0) throw new Error('No what-if settings were given.');
  const r = simulateEnergyScenario(env.hotel, sc);
  const before = totals(r.before.annual);
  const after = totals(r.after.annual);
  return {
    _scenario: sc,
    _clamped: used,
    settings: used,
    before,
    after,
    change: {
      annualCost: usd(r.delta.cost),
      annualCostPct: before.annualCost > 0 ? pct1(r.delta.cost / r.before.annual.cost) : 0,
      carbonTonnes: t1(r.delta.carbonKg),
    },
    drivers: r.drivers.slice(0, 3).map((d) => ({ driver: d.label, annualCostChange: usd(d.deltaCost) })),
    comfortWarnings: r.flags.filter((f) => f.severity === 'warn').map((f) => f.message),
  };
}

/** find_best_plan: the optimizer at a budget (read-only; nothing is stored until the user clicks Apply). */
function findBestPlan(env: ToolEnv, input: Record<string, unknown>) {
  const budget = clamp(num(input['budget']) ?? env.hotel.profile.budget, 0, 10_000_000);
  const objective = OBJECTIVES.includes(input['objective'] as Objective) ? (input['objective'] as Objective) : env.hotel.profile.objective;
  const ctx = prepareUpgradeContext(env.hotel, undefined, env.baseline);
  const plan = optimizeInvestmentPortfolio(ctx, { budget, objective, assumptions: { discountRate: env.discountRate } });
  const winner = plan.objectiveWinner;
  return {
    _plan: plan,
    _baseline: ctx.baseline,
    _clamped: { budget, objective },
    budget,
    objective,
    combinationsTested: plan.combinationsTested,
    packagesThatFit: plan.feasibleCount,
    bestPackage: winner ? { role: winner.roleLabel, name: winner.evaluation.name, upgradeIds: winner.evaluation.upgradeIds, ...financials(winner.evaluation.financials) } : null,
    otherPackages: plan.packages
      .filter((p) => p.evaluation.id !== winner?.evaluation.id)
      .map((p) => ({ role: p.roleLabel, name: p.evaluation.name, ...financials(p.evaluation.financials) })),
    emptyReason: winner ? null : plan.emptyReason,
  };
}

function evaluateUpgrades(env: ToolEnv, input: Record<string, unknown>) {
  const list = Array.isArray(input['upgrades']) ? input['upgrades'] : [];
  const items: PlanItem[] = [];
  for (const u of list) {
    const id = resolveUpgradeId(typeof u === 'object' && u ? (u as { id?: unknown }).id : u);
    if (!id || items.some((x) => x.id === id)) continue;
    const q = typeof u === 'object' && u ? num((u as { quantity?: unknown }).quantity) : null;
    items.push(q !== null ? { id, quantity: q } : { id });
  }
  if (items.length === 0) throw new Error('No known upgrades were named.');
  const ctx = prepareUpgradeContext(env.hotel, undefined, env.baseline);
  const ev = evaluatePlan(ctx, items, { assumptions: { discountRate: env.discountRate } });
  if (!ev.evaluation) throw new Error('These upgrades do not apply to this hotel.');
  return {
    _ids: ev.ids,
    _clamped: { upgrades: ev.items.map((i) => ({ id: i.id, quantity: i.quantity })) },
    upgrades: ev.ids.map(upgradeLabel),
    ...financials(ev.evaluation.financials),
    newAnnualCost: usd(ev.evaluation.newAnnualCost),
    warnings: ev.warnings.map((w) => w.message),
  };
}

function compareUpgradesTool(env: ToolEnv, input: Record<string, unknown>) {
  const wanted = (Array.isArray(input['upgrades']) ? input['upgrades'] : []).map(resolveUpgradeId).filter((x): x is UpgradeId => !!x);
  const ctx = prepareUpgradeContext(env.hotel, undefined, env.baseline);
  const rows = compareUpgrades(ctx, { assumptions: { discountRate: env.discountRate } });
  const pick = wanted.length ? rows.filter((r) => wanted.includes(r.id) || (wanted.includes('rooftop_solar') && r.id.startsWith('rooftop_solar'))) : rows;
  return {
    _clamped: { upgrades: pick.map((r) => r.id) },
    budget: env.hotel.profile.budget,
    upgrades: pick.map((r) => ({ id: r.id, name: r.label, fitsBudget: r.financials.grossCost.mid <= env.hotel.profile.budget, ...financials(r.financials) })),
  };
}

function runStressTest(env: ToolEnv, input: Record<string, unknown>) {
  const t = STRESS_TESTS.find((x) => x.id === input['id']);
  if (!t) throw new Error(`Unknown stress test; use one of ${STRESS_TESTS.map((x) => x.id).join(', ')}.`);
  const r = simulateEnergyScenario(env.hotel, t.scenario);
  const before = totals(r.before.annual);
  const after = totals(r.after.annual);
  return {
    _stress: t.id,
    _clamped: { id: t.id },
    test: t.label,
    description: t.description,
    kind: t.duration === 'temporary' ? 'temporary event (one-off cost, not every year)' : 'persistent (every year)',
    before,
    after,
    change: { annualCost: usd(r.delta.cost), annualCostPct: before.annualCost > 0 ? pct1(r.delta.cost / r.before.annual.cost) : 0 },
  };
}

function portfolioOverview(env: ToolEnv) {
  const p = env.portfolio;
  if (!p || p.items.length === 0) throw new Error('No hotel portfolio is open.');
  const s = portfolioSummary(p.items, { discountRate: env.discountRate });
  return {
    organization: p.name,
    totals: { hotels: s.totals.properties, rooms: s.totals.rooms, annualCost: usd(s.totals.cost), carbonTonnes: t1(s.totals.carbonKg), savingsPotential: usd(s.totals.savingsPotential), investmentRequired: usd(s.totals.investmentRequired) },
    hotels: [...s.properties]
      .sort((a, b) => b.priorityScore - a.priorityScore)
      .map((h) => ({ name: h.name, city: h.city, annualCost: usd(h.annual.cost), energyIntensity: Math.round(h.siteEui * 10) / 10, savingsPotential: usd(h.potential?.annualSavings ?? 0), priorityScore: h.priorityScore })),
  };
}

function portfolioOptimize(env: ToolEnv, input: Record<string, unknown>) {
  const p = env.portfolio;
  if (!p || p.items.length === 0) throw new Error('No hotel portfolio is open.');
  const budget = clamp(num(input['budget']) ?? p.budget, 0, 100_000_000);
  const objective = PORTFOLIO_OBJECTIVES.includes(input['objective'] as PortfolioObjective) ? (input['objective'] as PortfolioObjective) : p.objective;
  const plan = optimizePortfolioBudget(p.items, { budget, objective, discountRate: env.discountRate });
  const t = plan.totals;
  return {
    _portfolioPlan: plan,
    _clamped: { budget, objective },
    budget,
    objective,
    totals: { installedCost: usd(t.grossCost), netInvestment: usd(t.netInvestment), annualSavings: usd(t.annualSavings), paybackYears: yrs(t.paybackYears), npv10Years: usd(t.npv10), carbonAvoidedTonnesPerYear: t1(t.carbonAvoidedKg) },
    hotels: plan.allocations.map((a) => ({
      hotel: a.name,
      package: a.evaluation?.name ?? 'nothing (no package improves the objective within the budget)',
      netInvestment: a.evaluation ? usd(a.evaluation.financials.netInvestment.mid) : 0,
      annualSavings: a.evaluation ? usd(a.evaluation.financials.annualSavings.mid) : 0,
    })),
  };
}

/** Run one tool with the engine. Errors come back as `{ error }` results (the AI is told what went wrong; nothing is invented). */
export function runTool(env: ToolEnv, call: ToolCall): ToolRun {
  const input = call.input && typeof call.input === 'object' ? call.input : {};
  try {
    let raw: Record<string, unknown>;
    const detail: NonNullable<ToolRun['detail']> = {};
    switch (call.name) {
      case 'run_scenario': {
        const r = runScenario(env, input);
        detail.scenario = r._scenario;
        raw = r;
        break;
      }
      case 'find_best_plan': {
        const r = findBestPlan(env, input);
        detail.plan = r._plan;
        detail.planBaseline = r._baseline;
        raw = r;
        break;
      }
      case 'evaluate_upgrades': {
        const r = evaluateUpgrades(env, input);
        detail.upgradeIds = r._ids;
        raw = r;
        break;
      }
      case 'compare_upgrades':
        raw = compareUpgradesTool(env, input);
        break;
      case 'run_stress_test': {
        const r = runStressTest(env, input);
        detail.stressId = r._stress;
        raw = r;
        break;
      }
      case 'portfolio_overview':
        raw = portfolioOverview(env);
        break;
      case 'portfolio_optimize': {
        const r = portfolioOptimize(env, input);
        detail.portfolioPlan = r._portfolioPlan;
        raw = r;
        break;
      }
      default:
        return { id: call.id, name: call.name, input, result: { error: `Unknown tool ${String(call.name)}.` } };
    }
    const clamped = (raw['_clamped'] as Record<string, unknown> | undefined) ?? input;
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(raw)) if (!k.startsWith('_')) result[k] = v;
    return { id: call.id, name: call.name, input: clamped, result, detail };
  } catch (e) {
    return { id: call.id, name: call.name, input, result: { error: e instanceof Error ? e.message : 'The tool failed.' } };
  }
}

/** The results the number check may use: the tool results of this answer only. */
export const toolResultsForCheck = (runs: readonly ToolRun[]) => runs.map((r) => ({ name: r.name, input: r.input, result: r.result }));

// ---- Action buttons: derived from the tools that ran, never from the AI's text ----

export type AdvisorAction =
  | { kind: 'apply_scenario'; label: string; runId: string }
  | { kind: 'apply_package'; label: string; runId: string }
  | { kind: 'make_plan'; label: string; runId: string }
  | { kind: 'preview_report'; label: string; runId: string }
  | { kind: 'open_stress'; label: string; runId: string }
  | { kind: 'open_portfolio_plan'; label: string; runId: string };

export function actionsForRuns(runs: readonly ToolRun[]): AdvisorAction[] {
  const out: AdvisorAction[] = [];
  for (const r of runs) {
    if ('error' in r.result) continue;
    if (r.name === 'run_scenario' && r.detail?.scenario) out.push({ kind: 'apply_scenario', label: 'Apply this what-if', runId: r.id });
    if (r.name === 'find_best_plan' && r.detail?.plan?.objectiveWinner) {
      out.push({ kind: 'apply_package', label: 'Apply this package to the twin', runId: r.id });
      out.push({ kind: 'make_plan', label: 'Make this my plan', runId: r.id });
      out.push({ kind: 'preview_report', label: 'Preview report', runId: r.id });
    }
    if (r.name === 'run_stress_test' && r.detail?.stressId) out.push({ kind: 'open_stress', label: 'Open this stress test', runId: r.id });
    if (r.name === 'portfolio_optimize' && r.detail?.portfolioPlan) out.push({ kind: 'open_portfolio_plan', label: 'Open the portfolio plan', runId: r.id });
  }
  return out;
}
