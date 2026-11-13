import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  STRESS_TESTS,
  advisor,
  calculateBaselineEnergy,
  hotelPortfolio,
  optimizeInvestmentPortfolio,
  optimizePortfolioBudget,
  portfolioSummary,
  prepareUpgradeContext,
  presetProfile,
  simulateEnergyScenario,
} from '..';
import { TOOL_DEFS } from '../../../../supabase/functions/advisor/tools';

const hotel = presetProfile('demo-chicago-100');
const baseline = calculateBaselineEnergy(hotel);
const items = hotelPortfolio.properties.map((property) => ({ property }));
const env: advisor.ToolEnv = { hotel, baseline, discountRate: 0.08, portfolio: { name: hotelPortfolio.name, items, budget: 500_000, objective: 'balanced' } };
const context = advisor.buildAdvisorContext({ hotel, baseline, scenario: {}, scenarioResult: null, plan: null, syntheticDemo: true });
const call = (name: advisor.ToolName, input: Record<string, unknown> = {}, id = `t-${name}`) => advisor.runTool(env, { id, name, input });
const ENDPOINT = 'https://example.test/advisor';

function fakeFetch(replies: ((body: Record<string, unknown>) => unknown)[]) {
  const bodies: Record<string, unknown>[] = [];
  let i = 0;
  const fetchFn = vi.fn(async (_u: string, init: RequestInit) => {
    const body = JSON.parse(init.body as string) as Record<string, unknown>;
    bodies.push(body);
    const r = replies[Math.min(i++, replies.length - 1)]!(body);
    return new Response(JSON.stringify(r), { status: 200 });
  });
  return { config: { endpoint: ENDPOINT, headers: {}, fetchFn: fetchFn as unknown as typeof fetch } as advisor.AdvisorConfig, bodies, fetchFn };
}

beforeEach(() => advisor.clearAgentCache());

describe('advisor tools equal the engine', () => {
  it('run_scenario is simulateEnergyScenario on the same what-if', () => {
    const r = call('run_scenario', { occupancyPct: 85, smartRoomControls: true }).result as { before: { annualCost: number }; after: { annualCost: number }; change: { annualCost: number } };
    const direct = simulateEnergyScenario(hotel, { occupancy: 0.85, smartRoomControls: true });
    expect(r.before.annualCost).toBe(Math.round(direct.before.annual.cost));
    expect(r.after.annualCost).toBe(Math.round(direct.after.annual.cost));
    expect(r.change.annualCost).toBe(Math.round(direct.delta.cost));
  });

  it('find_best_plan is the optimizer at that budget', () => {
    const run = call('find_best_plan', { budget: 50_000 });
    const r = run.result as { bestPackage: { name: string; netInvestment: number; annualSavings: number } };
    const plan = optimizeInvestmentPortfolio(prepareUpgradeContext(hotel, undefined, baseline), { budget: 50_000, objective: hotel.profile.objective, assumptions: { discountRate: 0.08 } });
    expect(r.bestPackage.name).toBe(plan.objectiveWinner!.evaluation.name);
    expect(r.bestPackage.netInvestment).toBe(Math.round(plan.objectiveWinner!.evaluation.financials.netInvestment.mid));
    expect(r.bestPackage.annualSavings).toBe(Math.round(plan.objectiveWinner!.evaluation.financials.annualSavings.mid));
    expect(run.detail?.plan?.objectiveWinner?.evaluation.id).toBe(plan.objectiveWinner!.evaluation.id);
  });

  it('run_stress_test is the stress scenario; portfolio tools are portfolioSummary and optimizePortfolioBudget', () => {
    const t = STRESS_TESTS.find((x) => x.id === 'heat_wave')!;
    const r = call('run_stress_test', { id: 'heat_wave' }).result as { after: { annualCost: number } };
    expect(r.after.annualCost).toBe(Math.round(simulateEnergyScenario(hotel, t.scenario).after.annual.cost));
    const o = call('portfolio_overview').result as { totals: { annualCost: number; hotels: number } };
    const s = portfolioSummary(items, { discountRate: 0.08 });
    expect(o.totals.annualCost).toBe(Math.round(s.totals.cost));
    expect(o.totals.hotels).toBe(s.totals.properties);
    const p = call('portfolio_optimize', { budget: 250_000 }).result as { totals: { annualSavings: number } };
    expect(p.totals.annualSavings).toBe(Math.round(optimizePortfolioBudget(items, { budget: 250_000, objective: 'balanced', discountRate: 0.08 }).totals.annualSavings));
  });

  it('clamps inputs and returns errors as results, never throws', () => {
    expect((call('run_scenario', { occupancyPct: 400 }).input as { occupancyPct: number }).occupancyPct).toBe(100);
    expect(call('run_scenario', {}).result).toHaveProperty('error');
    expect(call('evaluate_upgrades', { upgrades: ['warp_drive'] }).result).toHaveProperty('error');
    expect(call('run_stress_test', { id: 'meteor' }).result).toHaveProperty('error');
    expect(advisor.runTool({ hotel, baseline, discountRate: 0.08 }, { id: 'x', name: 'portfolio_overview', input: {} }).result).toHaveProperty('error');
  });

  it('the function describes exactly the tools the browser can run', () => {
    expect(TOOL_DEFS.map((t) => t.name).sort()).toEqual([...advisor.TOOL_NAMES].sort());
  });
});

describe('number check with tool results', () => {
  it('accepts numbers from a tool result and rejects invented ones', () => {
    const run = call('find_best_plan', { budget: 50_000 });
    const best = (run.result as { bestPackage: { annualSavings: number } }).bestPackage;
    const allowed = { context, tools: advisor.toolResultsForCheck([run]) };
    const quoted = `It saves about $${best.annualSavings.toLocaleString('en-US')} a year.`;
    expect(advisor.validateAdvisorText(quoted, context).ok).toBe(false);
    expect(advisor.validateAdvisorText(quoted, allowed).ok).toBe(true);
    expect(advisor.validateAdvisorText('It saves about $987,654 a year.', allowed).ok).toBe(false);
  });
});

describe('the tool loop', () => {
  it('runs the tools the AI asks for, sends the results back, and validates the answer against them', async () => {
    let savings = 0;
    const { config, bodies } = fakeFetch([
      () => ({ toolCalls: [{ id: 'c1', name: 'find_best_plan', input: { budget: 50_000 } }] }),
      (b) => {
        const rounds = b['rounds'] as { results: { id: string; content: string }[] }[];
        savings = (JSON.parse(rounds[0]!.results[0]!.content) as { bestPackage: { annualSavings: number } }).bestPackage.annualSavings;
        return { text: `The best package saves about $${savings.toLocaleString('en-US')} a year.\nFOLLOW_UPS: What about $987,654? | What are the risks? | Which upgrade pays back fastest?` };
      },
    ]);
    const steps: string[][] = [];
    const a = await advisor.askAdvisorAgent('What should I do with $50,000?', context, env, config, { onStep: (s) => steps.push(s.tools) });
    expect(a.source).toBe('ai');
    expect(a.text).toContain(savings.toLocaleString('en-US'));
    expect(a.runs.map((r) => r.name)).toEqual(['find_best_plan']);
    expect(steps).toEqual([['find_best_plan']]);
    expect(bodies[0]).toMatchObject({ mode: 'answer', rounds: [] });
    expect((bodies[1]!['rounds'] as unknown[]).length).toBe(1);
    // The follow-up with an invented number is dropped.
    expect(a.followUps).not.toContain('What about $987,654?');
    expect(a.followUps).toContain('What are the risks?');
    expect(advisor.actionsForRuns(a.runs).map((x) => x.kind)).toEqual(['apply_package', 'make_plan', 'preview_report']);
  });

  it('falls back to the offline tools when the AI invents a number, and stops after two tool rounds', async () => {
    const { config } = fakeFetch([() => ({ toolCalls: [{ id: 'c1', name: 'run_scenario', input: { occupancyPct: 85 } }] }), () => ({ text: 'It would cost $1,234,567.' })]);
    const a = await advisor.askAdvisorAgent('What if occupancy rises to 85%?', context, env, config);
    expect(a).toMatchObject({ source: 'fallback', reason: 'rejected' });
    expect(a.runs[0]!.name).toBe('run_scenario');
    const loop = fakeFetch([(b) => ({ toolCalls: [{ id: `c${(b['rounds'] as unknown[]).length}`, name: 'run_stress_test', input: { id: 'heat_wave' } }] })]);
    const b = await advisor.askAdvisorAgent('Heat wave?', context, env, loop.config);
    expect(loop.fetchFn).toHaveBeenCalledTimes(3);
    expect(b.source).toBe('fallback');
  });

  it('offline: the parser calls the same tools and writes a template answer from their results', async () => {
    const a = await advisor.askAdvisorAgent('What if occupancy rises to 85%?', context, env, { endpoint: null, headers: {} });
    expect(a).toMatchObject({ source: 'fallback', reason: 'not_configured' });
    expect(a.runs.map((r) => r.name)).toEqual(['run_scenario']);
    const after = (a.runs[0]!.result as { after: { annualCost: number } }).after.annualCost;
    expect(a.text).toContain(after.toLocaleString('en-US'));
    expect(advisor.validateAdvisorText(a.text, { context, tools: advisor.toolResultsForCheck(a.runs) }).ok).toBe(true);
    expect(a.followUps.length).toBeGreaterThan(0);
    const p = await advisor.askAdvisorAgent('How would you split $250,000 across the chain?', context, env, { endpoint: null, headers: {} }, { scope: 'portfolio' });
    expect(p.runs.map((r) => r.name)).toEqual(['portfolio_optimize']);
    expect(advisor.actionsForRuns(p.runs).map((x) => x.kind)).toEqual(['open_portfolio_plan']);
  });
});

describe('modes without tools', () => {
  it('briefing and report summary use the template / nothing when the AI is off or invents a number', async () => {
    const ctx = { annual: { energyCost: 140740 } };
    expect(await advisor.askAdvisorText('briefing', ctx, 'Template.', { endpoint: null, headers: {} })).toEqual({ text: 'Template.', source: 'fallback' });
    const bad = fakeFetch([() => ({ text: 'You spend $999,999.' })]);
    expect((await advisor.askAdvisorText('briefing', ctx, 'Template.', bad.config)).source).toBe('fallback');
    const good = fakeFetch([() => ({ text: 'You spend about $140,740 a year on energy (estimate).' })]);
    expect(await advisor.askAdvisorText('report_summary', ctx, '', good.config)).toEqual({ text: 'You spend about $140,740 a year on energy (estimate).', source: 'ai' });
    expect(good.bodies[0]).toMatchObject({ mode: 'report_summary' });
  });

  it('column mapping sends only headers, keeps known headers and fields, else null', async () => {
    const { config, bodies } = fakeFetch([() => ({ text: '{"mapping": {"Bill month": "month", "kWh used": "elecUse", "Invented": "month", "Therms": "rocket"}}' })]);
    const m = await advisor.suggestColumnMapping(['Bill month', 'kWh used', 'Therms'], ['month', 'elecUse', 'gasUse', 'ignore'], ['kWh'], config);
    expect(m).toEqual({ 'Bill month': 'month', 'kWh used': 'elecUse' });
    expect(bodies[0]).toMatchObject({ mode: 'map_columns', context: { headers: ['Bill month', 'kWh used', 'Therms'] } });
    expect(await advisor.suggestColumnMapping(['A'], ['month'], [], { endpoint: null, headers: {} })).toBeNull();
  });
});
