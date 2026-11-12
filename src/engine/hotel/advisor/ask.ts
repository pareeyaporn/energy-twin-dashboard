import type { AdvisorContext } from './context';
import { fallbackAnswer } from './fallback';
import { parseQuestion } from './intent';
import { validateAdvisorText } from './validate';

export type AdvisorSource = 'ai' | 'fallback';
export type FallbackReason = 'not_configured' | 'timeout' | 'error' | 'rejected' | 'offline' | 'refused';

export interface AdvisorAnswer {
  text: string;
  source: AdvisorSource;
  reason?: FallbackReason;
  /** Numbers in a rejected AI answer that were not in the context. */
  unmatched?: string[];
}

export interface AdvisorConfig {
  /** URL of the advisor function; null when it is not set up (the template answer is used). */
  endpoint: string | null;
  headers: Record<string, string>;
  fetchFn?: typeof fetch;
  timeoutMs?: number;
}

const cache = new Map<string, AdvisorAnswer>();
export const clearAdvisorCache = () => cache.clear();

function hash(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

/**
 * Ask the advisor. The browser sends the question and the engine's context to the function, then checks the answer: any number
 * that is not in the context makes it unusable. On a missing setup, a timeout (8 s by default), an error or a rejected answer, the
 * deterministic template answer is returned instead, so the demo never shows an error. AI answers are cached per question and context.
 */
export async function askAdvisor(question: string, context: AdvisorContext, config: AdvisorConfig): Promise<AdvisorAnswer> {
  const parsed = parseQuestion(question);
  const template = () => fallbackAnswer(parsed, context);
  const fallback = (reason: FallbackReason, unmatched?: string[]): AdvisorAnswer => ({
    text: template(),
    source: 'fallback',
    reason,
    ...(unmatched ? { unmatched } : {}),
  });

  const key = `${question.trim().toLowerCase()}|${hash(JSON.stringify(context))}`;
  const hit = cache.get(key);
  if (hit) return hit;

  if (!config.endpoint) return fallback('not_configured');
  const doFetch = config.fetchFn ?? fetch;
  const timeoutMs = config.timeoutMs ?? 8000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await doFetch(config.endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...config.headers },
      body: JSON.stringify({ question, context }),
      signal: controller.signal,
    });
    if (!res.ok) {
      let code = '';
      try {
        code = ((await res.json()) as { error?: string }).error ?? '';
      } catch {
        /* no body */
      }
      return fallback(res.status === 503 && code === 'not_configured' ? 'not_configured' : code === 'refused' ? 'refused' : 'error');
    }
    const body = (await res.json()) as { text?: unknown };
    const text = typeof body.text === 'string' ? body.text.trim() : '';
    if (!text) return fallback('error');
    const check = validateAdvisorText(text, context);
    if (!check.ok) return fallback('rejected', check.unmatched);
    const answer: AdvisorAnswer = { text, source: 'ai' };
    cache.set(key, answer);
    return answer;
  } catch (e) {
    if (controller.signal.aborted) return fallback('timeout');
    const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
    return fallback(offline ? 'offline' : 'error');
  } finally {
    clearTimeout(timer);
  }
}
