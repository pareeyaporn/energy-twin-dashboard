// The tool-using advisor (docs/23, docs/12). The browser sends the question and the engine's context; the function asks the AI, which
// may ask for tools; the browser runs them with the engine and sends the results back (at most two tool rounds), then the AI writes
// the answer. The answer is number-checked against the context AND the tool results of this answer only. Anything that fails
// (no setup, a timeout, an error, a rejected answer) falls back to the offline path: the same tools from a keyword parser and a
// template answer from their results. Other modes (briefing, report summary, column mapping) use the same function without tools.
import type { AdvisorConfig, FallbackReason } from './ask';
import type { AdvisorContext } from './context';
import { fallbackAnswer } from './fallback';
import { parseQuestion } from './intent';
import { defaultFollowUps, planToolCalls, toolAnswer } from './offline';
import type { AdvisorScope } from './offline';
import { TOOL_NAMES, runTool, toolResultsForCheck } from './tools';
import type { ToolCall, ToolEnv, ToolName, ToolRun } from './tools';
import { validateAdvisorText } from './validate';

export const AGENT_LIMITS = { callTimeoutMs: 8_000, totalTimeoutMs: 20_000, maxToolRounds: 2, maxCallsPerRound: 4, maxFollowUps: 3 };

export interface AgentAnswer {
  text: string;
  source: 'ai' | 'fallback';
  reason?: FallbackReason;
  unmatched?: string[];
  runs: ToolRun[];
  followUps: string[];
}

export interface AgentOptions {
  scope?: AdvisorScope;
  /** Called when the AI asks for tools (for a "running the model…" step). */
  onStep?: (step: { round: number; tools: ToolName[] }) => void;
}

interface Round {
  calls: { id: string; name: string; input: Record<string, unknown> }[];
  results: { id: string; content: string }[];
}

function hash(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}
export const agentCacheKey = (question: string, context: AdvisorContext, scope: AdvisorScope) =>
  `v2|${scope}|${question.trim().toLowerCase().replace(/\s+/g, ' ')}|${hash(JSON.stringify(context))}`;

const cache = new Map<string, AgentAnswer>();
export const clearAgentCache = () => cache.clear();

/** Splits the AI's text into the answer and its FOLLOW_UPS line (tolerant of a JSON array or bullet lines). */
export function splitFollowUps(raw: string): { text: string; followUps: string[] } {
  const m = raw.match(/\n?\s*FOLLOW[_ -]?UPS?\s*:\s*([\s\S]*)$/i);
  if (!m) return { text: raw.trim(), followUps: [] };
  const text = raw.slice(0, m.index).trim();
  let rest = (m[1] ?? '').trim();
  let list: string[] = [];
  if (rest.startsWith('[')) {
    try {
      const v = JSON.parse(rest) as unknown;
      if (Array.isArray(v)) list = v.filter((x): x is string => typeof x === 'string');
    } catch {
      rest = rest.replace(/^\[|\]$/g, '');
    }
  }
  if (!list.length) list = rest.split(/\s*\|\s*|\n+/).map((x) => x.replace(/^[-*•\d.)\s"]+|"$/g, '').trim());
  return { text, followUps: list.filter((x) => x.length > 3 && x.length < 140) };
}

/** Follow-ups the AI suggested, kept only when every number in them is in the context or the tool results. */
export function filterFollowUps(list: readonly string[], allowed: unknown): string[] {
  return [...new Set(list.map((x) => x.trim()).filter((x) => x && validateAdvisorText(x, allowed).ok))].slice(0, AGENT_LIMITS.maxFollowUps);
}

function localAnswer(question: string, context: AdvisorContext, env: ToolEnv, scope: AdvisorScope, reason: FallbackReason, unmatched?: string[]): AgentAnswer {
  const parsed = parseQuestion(question);
  const runs = planToolCalls(question, scope, parsed).map((c) => runTool(env, c));
  const usable = runs.filter((r) => !('error' in r.result));
  const text = usable.length ? toolAnswer(usable, context) : fallbackAnswer(parsed, context);
  return { text, source: 'fallback', reason, ...(unmatched ? { unmatched } : {}), runs: usable, followUps: defaultFollowUps(parsed, usable, context) };
}

async function post(config: AdvisorConfig, body: unknown, deadline: number): Promise<Response> {
  const doFetch = config.fetchFn ?? fetch;
  const controller = new AbortController();
  const ms = Math.max(1, Math.min(config.timeoutMs ?? AGENT_LIMITS.callTimeoutMs, deadline - Date.now()));
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await doFetch(config.endpoint!, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...config.headers },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Ask the tool-using advisor. Saved answers (local storage, task 8.2) keep the text, the tool calls and the follow-ups; on replay the
 * tools run again (deterministic) and the text is checked again against the fresh results.
 */
export async function askAdvisorAgent(question: string, context: AdvisorContext, env: ToolEnv, config: AdvisorConfig, options: AgentOptions = {}): Promise<AgentAnswer> {
  const scope = options.scope ?? 'hotel';
  const key = agentCacheKey(question, context, scope);
  const hit = cache.get(key);
  if (hit) return hit;
  const stored = config.store?.read(key);
  if (stored) {
    try {
      const v = JSON.parse(stored) as { text: string; calls: ToolCall[]; followUps: string[] };
      const runs = (v.calls ?? []).map((c) => runTool(env, c));
      const allowed = { context, tools: toolResultsForCheck(runs) };
      if (typeof v.text === 'string' && validateAdvisorText(v.text, allowed).ok) {
        const answer: AgentAnswer = { text: v.text, source: 'ai', runs, followUps: filterFollowUps(v.followUps ?? [], allowed) };
        cache.set(key, answer);
        return answer;
      }
    } catch {
      /* an older saved answer or a damaged entry: ask again */
    }
  }
  if (!config.endpoint) return localAnswer(question, context, env, scope, 'not_configured');

  const deadline = Date.now() + AGENT_LIMITS.totalTimeoutMs;
  const rounds: Round[] = [];
  const runs: ToolRun[] = [];
  try {
    for (let i = 0; i <= AGENT_LIMITS.maxToolRounds; i++) {
      const res = await post(config, { question, context, mode: 'answer', scope, rounds }, deadline);
      if (!res.ok) {
        let code = '';
        try {
          code = ((await res.json()) as { error?: string }).error ?? '';
        } catch {
          /* no body */
        }
        return localAnswer(question, context, env, scope, res.status === 503 && code === 'not_configured' ? 'not_configured' : code === 'refused' ? 'refused' : 'error');
      }
      const body = (await res.json()) as { text?: unknown; toolCalls?: unknown; followUps?: unknown };
      const calls = Array.isArray(body.toolCalls) ? (body.toolCalls as ToolCall[]).filter((c) => c && typeof c.id === 'string' && TOOL_NAMES.includes(c.name)) : [];
      if (calls.length && i < AGENT_LIMITS.maxToolRounds) {
        const batch = calls.slice(0, AGENT_LIMITS.maxCallsPerRound);
        options.onStep?.({ round: i + 1, tools: batch.map((c) => c.name) });
        const done = batch.map((c) => runTool(env, { id: c.id, name: c.name, input: c.input ?? {} }));
        runs.push(...done);
        rounds.push({ calls: batch.map((c) => ({ id: c.id, name: c.name, input: c.input ?? {} })), results: done.map((r) => ({ id: r.id, content: JSON.stringify(r.result) })) });
        continue;
      }
      const raw = typeof body.text === 'string' ? body.text.trim() : '';
      if (!raw) return localAnswer(question, context, env, scope, 'error');
      const { text, followUps } = splitFollowUps(raw);
      const extra = Array.isArray(body.followUps) ? body.followUps.filter((x): x is string => typeof x === 'string') : [];
      const allowed = { context, tools: toolResultsForCheck(runs) };
      const check = validateAdvisorText(text, allowed);
      if (!check.ok) return localAnswer(question, context, env, scope, 'rejected', check.unmatched);
      const usable = runs.filter((r) => !('error' in r.result));
      let fu = filterFollowUps([...followUps, ...extra], allowed);
      if (fu.length < 2) fu = [...new Set([...fu, ...defaultFollowUps(parseQuestion(question), usable, context)])].slice(0, AGENT_LIMITS.maxFollowUps);
      const answer: AgentAnswer = { text, source: 'ai', runs: usable, followUps: fu };
      cache.set(key, answer);
      try {
        config.store?.write(key, JSON.stringify({ text, calls: usable.map((r) => ({ id: r.id, name: r.name, input: r.input })), followUps: fu }));
      } catch {
        /* storage full or blocked */
      }
      return answer;
    }
    return localAnswer(question, context, env, scope, 'error');
  } catch {
    if (Date.now() >= deadline) return localAnswer(question, context, env, scope, 'timeout');
    const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
    return localAnswer(question, context, env, scope, offline ? 'offline' : 'timeout');
  }
}

// ---- Modes without tools: briefing, report summary, column mapping ----

export type TextMode = 'briefing' | 'report_summary';

const textCache = new Map<string, { text: string; source: 'ai' | 'fallback' }>();

/**
 * One short text from the AI for a mode (briefing, report summary), number-checked against the context it was given; the template
 * text is used when the AI is not set up, slow (8 s), fails or invents a number.
 */
export async function askAdvisorText(mode: TextMode, context: Record<string, unknown>, template: string, config: AdvisorConfig): Promise<{ text: string; source: 'ai' | 'fallback' }> {
  const key = `${mode}|${hash(JSON.stringify(context))}`;
  const hit = textCache.get(key);
  if (hit) return hit;
  const fb = { text: template, source: 'fallback' as const };
  if (!config.endpoint) return fb;
  try {
    const res = await post(config, { question: mode === 'briefing' ? 'Brief me on this hotel.' : 'Summarize this investment report.', context, mode }, Date.now() + AGENT_LIMITS.callTimeoutMs);
    if (!res.ok) return fb;
    const body = (await res.json()) as { text?: unknown };
    const text = typeof body.text === 'string' ? splitFollowUps(body.text.trim()).text : '';
    if (!text || !validateAdvisorText(text, context).ok) return fb;
    const out = { text, source: 'ai' as const };
    textCache.set(key, out);
    return out;
  } catch {
    return fb;
  }
}

/** The utility-data fields an uploaded column can map to (the same names as the Utility Data Manager's mapping step). */
export type MappingField = string;

/**
 * Suggest how spreadsheet columns map to utility-data fields. Sends ONLY the column headers and the unit hints (never a bill value);
 * the answer must be JSON naming known fields for known headers, otherwise it is ignored. The user confirms every suggestion.
 */
export async function suggestColumnMapping(
  headers: readonly string[],
  fields: readonly MappingField[],
  unitHints: readonly string[],
  config: AdvisorConfig,
): Promise<Record<string, MappingField> | null> {
  if (!config.endpoint || headers.length === 0) return null;
  try {
    const res = await post(config, { question: 'Map these columns.', context: { headers: [...headers], fields: [...fields], unitHints: [...unitHints] }, mode: 'map_columns' }, Date.now() + AGENT_LIMITS.callTimeoutMs);
    if (!res.ok) return null;
    const body = (await res.json()) as { text?: unknown };
    const raw = typeof body.text === 'string' ? body.text : '';
    const json = raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1);
    const v = JSON.parse(json) as { mapping?: Record<string, unknown> };
    const out: Record<string, MappingField> = {};
    for (const [h, f] of Object.entries(v.mapping ?? {})) if (headers.includes(h) && typeof f === 'string' && fields.includes(f)) out[h] = f;
    return Object.keys(out).length ? out : null;
  } catch {
    return null;
  }
}
