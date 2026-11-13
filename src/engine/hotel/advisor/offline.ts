// Offline what-ifs (docs/23): with no AI configured, or when the AI is slow or fails, simple questions still run the engine. A small
// keyword parser turns "occupancy 85%", "electricity +20%", "budget $75,000", "heat wave" or "compare LED and solar" into the same
// tool calls the AI would make; the template answer and the follow-up questions are written from the results.
import { parseBudgets, parseQuestion } from './intent';
import type { ParsedQuestion } from './intent';
import type { AdvisorContext } from './context';
import type { ToolCall, ToolRun } from './tools';

export type AdvisorScope = 'hotel' | 'portfolio';

const pctAfter = (q: string, re: RegExp): number | null => {
  const m = q.match(re);
  if (!m) return null;
  const sign = /(\bdown\b|\bdrop|\bfall|\blower|\bcut|-|−)/.test(m[0]) ? -1 : 1;
  const v = Number((m[1] ?? '').replace(',', '.'));
  return Number.isFinite(v) ? sign * Math.abs(v) : null;
};

const STRESS_WORDS: [RegExp, string][] = [
  [/heat ?wave|hotter summer|hot summer/, 'heat_wave'],
  [/cold snap|colder winter|cold winter|polar vortex/, 'cold_snap'],
  [/conference|convention surge|busy season|surge/, 'conference_surge'],
  [/off.?season|low occupancy|slow season/, 'low_occupancy'],
  [/worn|hvac (efficiency )?decline|equipment ages?|older equipment/, 'hvac_decline'],
  [/cloudy|low solar/, 'low_solar'],
];

/** The tool calls a question asks for, without the AI. Empty when the question is not a what-if, a plan or a comparison. */
export function planToolCalls(question: string, scope: AdvisorScope = 'hotel', parsed: ParsedQuestion = parseQuestion(question)): ToolCall[] {
  const q = question.toLowerCase();
  const calls: ToolCall[] = [];
  let n = 0;
  const add = (name: ToolCall['name'], input: Record<string, unknown>) => calls.push({ id: `local-${++n}`, name, input });
  const budgets = parseBudgets(question);

  if (parsed.intent === 'portfolio' || scope === 'portfolio') {
    if (budgets.length && /(budget|spend|split|invest|allocat|optimi|\$)/.test(q)) add('portfolio_optimize', { budget: budgets[0] });
    else add('portfolio_overview', {});
    return calls;
  }

  // What-if settings.
  const input: Record<string, unknown> = {};
  const occ = q.match(/occupanc[a-z]*[^0-9%]{0,20}(\d{1,3}(?:\.\d+)?)\s?%/) ?? q.match(/(\d{1,3}(?:\.\d+)?)\s?%\s+occupan/);
  if (occ) input['occupancyPct'] = Number(occ[1]);
  const elec = pctAfter(q, /(?:electric[a-z]*|power)[^0-9%]{0,25}?[+\-−]?\s?(\d{1,3}(?:\.\d+)?)\s?%/);
  if (elec !== null) input['electricityPriceChangePct'] = elec;
  const gas = pctAfter(q, /gas[^0-9%]{0,25}?[+\-−]?\s?(\d{1,3}(?:\.\d+)?)\s?%/);
  if (gas !== null) input['gasPriceChangePct'] = gas;
  const heat = q.match(/heat(?:ing)?(?: setpoint)?[^0-9]{0,15}(\d{2})\s?°?\s?f/);
  if (heat) input['heatingSetpointF'] = Number(heat[1]);
  const cool = q.match(/cool(?:ing)?(?: setpoint)?[^0-9]{0,15}(\d{2})\s?°?\s?f/);
  if (cool) input['coolingSetpointF'] = Number(cool[1]);
  if (/smart (room )?controls?|smart thermostats?/.test(q) && /(turn on|switch on|with|install(ed)?|add)/.test(q) && /what if|if i|if we/.test(q)) input['smartRoomControls'] = true;
  if (Object.keys(input).length) add('run_scenario', input);

  // Stress tests (only when no explicit what-if settings already describe it).
  if (!Object.keys(input).length) {
    const hit = STRESS_WORDS.find(([re]) => re.test(q));
    if (hit) add('run_stress_test', { id: hit[1] });
  }

  // A plan for a budget.
  if (budgets.length && /(plan|spend|budget|invest|best|recommend|what should|how should|use)/.test(q)) add('find_best_plan', { budget: budgets[0] });

  // A comparison of named upgrades.
  if (parsed.upgrades.length >= 2 && /(compare|versus|\bvs\.?|\bor\b|better|instead)/.test(q)) add('compare_upgrades', { upgrades: parsed.upgrades });

  return calls;
}

const usd = (n: number) => `${n < 0 ? '-' : ''}$${Math.abs(Math.round(n)).toLocaleString('en-US')}`;
const pct = (n: number) => `${n > 0 ? '+' : ''}${n}%`;
type Obj = Record<string, unknown>;
const o = (v: unknown): Obj => (v && typeof v === 'object' ? (v as Obj) : {});
const nn = (v: unknown): number => (typeof v === 'number' ? v : 0);

function describeSettings(s: Obj): string {
  const parts: string[] = [];
  if (s['occupancyPct'] !== undefined) parts.push(`occupancy at ${nn(s['occupancyPct'])}%`);
  if (s['electricityPriceChangePct'] !== undefined) parts.push(`electricity prices ${pct(nn(s['electricityPriceChangePct']))}`);
  if (s['gasPriceChangePct'] !== undefined) parts.push(`gas prices ${pct(nn(s['gasPriceChangePct']))}`);
  if (s['heatingSetpointF'] !== undefined) parts.push(`heating set to ${nn(s['heatingSetpointF'])} F`);
  if (s['coolingSetpointF'] !== undefined) parts.push(`cooling set to ${nn(s['coolingSetpointF'])} F`);
  if (s['weatherOffsetF'] !== undefined) parts.push(`weather ${nn(s['weatherOffsetF'])} F from normal`);
  if (s['commonAreaHvacHours'] !== undefined) parts.push(`common-area HVAC ${nn(s['commonAreaHvacHours'])} hours a day`);
  if (s['lightingHoursPerDay'] !== undefined) parts.push(`lighting ${nn(s['lightingHoursPerDay'])} hours a day`);
  if (s['smartRoomControls'] === true) parts.push('smart room controls on');
  return parts.join(', ');
}

function planSentence(p: Obj): string {
  const pay = p['paybackYears'] === null || p['paybackYears'] === undefined ? 'no payback' : `a payback of about ${nn(p['paybackYears'])} years`;
  return `${String(p['name'])}: ${usd(nn(p['netInvestment']))} after counted incentives, saving about ${usd(nn(p['annualSavings']))} a year, with ${pay} and a 10-year net present value of ${usd(nn(p['npv10Years']))}`;
}

/** The template answer for tool results (every number comes from the results). */
export function toolAnswer(runs: readonly ToolRun[], context: AdvisorContext): string {
  const s: string[] = [];
  for (const r of runs) {
    const x = r.result;
    if ('error' in x) {
      s.push(`Sorry, I couldn't run that one: ${String(x['error'])}`);
      continue;
    }
    if (r.name === 'run_scenario') {
      const b = o(x['before']);
      const a = o(x['after']);
      const c = o(x['change']);
      s.push(`Good question. With ${describeSettings(o(x['settings']))}, your estimated yearly energy cost would go from ${usd(nn(b['annualCost']))} to ${usd(nn(a['annualCost']))} (${nn(c['annualCost']) >= 0 ? '+' : '-'}${usd(Math.abs(nn(c['annualCost'])))}, ${pct(nn(c['annualCostPct']))}).`);
      const d = (x['drivers'] as Obj[] | undefined)?.[0];
      if (d) s.push(`Most of that comes from ${String(d['driver']).toLowerCase()} (${usd(nn(d['annualCostChange']))}).`);
    } else if (r.name === 'find_best_plan') {
      const best = x['bestPackage'] as Obj | null;
      if (!best) s.push(`Honestly, with ${usd(nn(x['budget']))} nothing fits yet: ${String(x['emptyReason'] ?? 'nothing meets the budget and comfort limits')}.`);
      else {
        s.push(`With ${usd(nn(x['budget']))} to spend, I had the model test ${nn(x['combinationsTested'])} combinations, and ${nn(x['packagesThatFit'])} of them fit.`);
        s.push(`My top pick is ${planSentence(best)}.`);
      }
    } else if (r.name === 'evaluate_upgrades') {
      s.push(`${(x['upgrades'] as string[]).join(' + ')}: ${usd(nn(x['netInvestment']))} after counted incentives, saving about ${usd(nn(x['annualSavings']))} a year${x['paybackYears'] === null ? ', with no payback' : `, paying back in about ${nn(x['paybackYears'])} years`}.`);
    } else if (r.name === 'compare_upgrades') {
      for (const u of (x['upgrades'] as Obj[]).slice(0, 3)) s.push(`${planSentence(u)}${u['fitsBudget'] ? '' : ` (does not fit the ${usd(nn(x['budget']))} budget)`}.`);
    } else if (r.name === 'run_stress_test') {
      const b = o(x['before']);
      const a = o(x['after']);
      const c = o(x['change']);
      s.push(`Here's what a ${String(x['test']).toLowerCase()} would do. ${String(x['description'])} The estimated cost goes from ${usd(nn(b['annualCost']))} to ${usd(nn(a['annualCost']))} (${usd(nn(c['annualCost']))}, ${pct(nn(c['annualCostPct']))}); it is a ${String(x['kind'])}.`);
    } else if (r.name === 'portfolio_overview') {
      const t = o(x['totals']);
      const top = (x['hotels'] as Obj[])[0];
      s.push(`Across the chain, ${String(x['organization'])}'s ${nn(t['hotels'])} hotels spend an estimated ${usd(nn(t['annualCost']))} a year on energy, with about ${usd(nn(t['savingsPotential']))} a year of savings potential.`);
      if (top) s.push(`I'd start with ${String(top['name'])}: it's the top priority (${nn(top['priorityScore'])} of 100), saving about ${usd(nn(top['savingsPotential']))} a year.`);
    } else if (r.name === 'portfolio_optimize') {
      const t = o(x['totals']);
      s.push(`If you split ${usd(nn(x['budget']))} across the hotels, you'd save about ${usd(nn(t['annualSavings']))} a year for ${usd(nn(t['netInvestment']))} after counted incentives${t['paybackYears'] === null ? '' : `, paying back in about ${nn(t['paybackYears'])} years`}.`);
      const funded = (x['hotels'] as Obj[]).filter((h) => nn(h['netInvestment']) > 0).slice(0, 3);
      if (funded.length) s.push(`It funds ${funded.map((h) => `${String(h['hotel'])} (${String(h['package'])})`).join('; ')}.`);
    }
  }
  s.push(context.hotel.syntheticDemo ? 'Keep in mind these are planning estimates for a synthetic demo hotel, not an engineering audit.' : 'Keep in mind these are planning estimates, not an engineering audit or a guarantee of savings.');
  return s.join(' ');
}

/** Follow-up questions written from the intent and the results (no AI). */
export function defaultFollowUps(parsed: ParsedQuestion, runs: readonly ToolRun[], context: AdvisorContext): string[] {
  const out: string[] = [];
  const names = new Set(runs.map((r) => r.name));
  if (names.has('run_scenario')) out.push('Which upgrades protect me most in this what-if?', 'What drives the change?');
  if (names.has('find_best_plan')) out.push('Why this package and not solar?', 'What would a smaller budget buy?');
  if (names.has('run_stress_test')) out.push('How much would the best plan cut this cost?');
  if (names.has('compare_upgrades')) out.push('Which of these fits my budget best?');
  if (names.has('portfolio_overview') || names.has('portfolio_optimize')) out.push('Why is the top hotel first?', 'What if we split the budget across the chain?');
  if (!out.length) {
    if (parsed.intent !== 'hvac_cost') out.push('Why is HVAC my biggest cost?');
    out.push(`What should I do with my ${context.hotel.budget > 0 ? 'budget' : 'money'}?`, 'What if occupancy goes up to 85%?');
  }
  return [...new Set(out)].slice(0, 3);
}
