// The advisor's voice (docs/23 §10): turns an answer the browser has already number-checked into natural speech with OpenAI's
// text-to-speech API, and returns the audio. Free of Deno globals so it can be tested in Vitest; index.ts wires it to Deno.serve.
// Secret (Lovable Cloud, never in code): OPENAI_API_KEY. Optional: OPENAI_TTS_MODEL, OPENAI_TTS_VOICE, ALLOWED_ORIGINS, TTS_RATE_PER_MINUTE.
// The function speaks only the text it is given (no generation), so it cannot add a number the advisor did not show.

export const TTS_LIMITS = { textChars: 1500, ratePerMinute: 20, timeoutMs: 9_000 };
export const TTS_MODEL_DEFAULT = 'gpt-4o-mini-tts';
export const TTS_VOICE_DEFAULT = 'nova';
/** Delivery guidance for models that accept it (gpt-4o-mini-tts); tts-1 and tts-1-hd ignore style and get none. */
export const TTS_INSTRUCTIONS =
  'Speak like a warm, friendly energy advisor talking to a hotel owner: natural, calm and clear, at a relaxed pace. ' +
  'Read dollar amounts and percentages naturally. Do not add or change any words.';

export interface TtsDeps {
  env: Record<string, string | undefined>;
  fetch: typeof fetch;
  now?: () => number;
}

const hits = new Map<string, number[]>();
/** Forget all rate-limit history (tests). */
export const resetTtsRateLimit = () => hits.clear();
function limited(ip: string, perMinute: number, now: number): number | null {
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < 60_000);
  if (recent.length >= perMinute) {
    hits.set(ip, recent);
    return Math.max(1, Math.ceil((60_000 - (now - (recent[0] ?? now))) / 1000));
  }
  recent.push(now);
  hits.set(ip, recent);
  return null;
}

function cors(origin: string | null, env: TtsDeps['env']): { headers: Record<string, string>; allowed: boolean } {
  const list = (env['ALLOWED_ORIGINS'] ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  const base = {
    'access-control-allow-methods': 'POST, OPTIONS',
    'access-control-allow-headers': 'authorization, apikey, content-type, x-client-info',
    vary: 'origin',
  };
  if (list.length === 0) return { headers: { ...base, 'access-control-allow-origin': '*' }, allowed: true };
  if (origin && list.includes(origin)) return { headers: { ...base, 'access-control-allow-origin': origin }, allowed: true };
  return { headers: base, allowed: false };
}

/** The OpenAI request body for this text (the model and voice come from settings). */
export function speechRequestBody(text: string, env: TtsDeps['env']): Record<string, unknown> {
  const model = env['OPENAI_TTS_MODEL'] || TTS_MODEL_DEFAULT;
  const voice = env['OPENAI_TTS_VOICE'] || TTS_VOICE_DEFAULT;
  return { model, voice, input: text, response_format: 'mp3', ...(model.startsWith('gpt-') ? { instructions: TTS_INSTRUCTIONS } : {}) };
}

/**
 * POST { text } → audio/mpeg. Errors (JSON): 400 invalid input, 403 origin, 405 method, 413 too long, 429 rate limited, 502 speech
 * service failed, 503 not configured (no key), 504 timeout. Never logs the text.
 */
export async function handleTtsRequest(req: Request, deps: TtsDeps): Promise<Response> {
  const now = deps.now ?? Date.now;
  const started = now();
  const c = cors(req.headers.get('origin'), deps.env);
  const done = (status: number, body: BodyInit | null, headers: Record<string, string>) => {
    console.log(JSON.stringify({ event: 'tts', status, ms: now() - started }));
    return new Response(body, { status, headers: { ...c.headers, ...headers } });
  };
  const fail = (status: number, error: string, extra: Record<string, string> = {}) => done(status, JSON.stringify({ error }), { 'content-type': 'application/json', ...extra });

  if (!c.allowed) return fail(403, 'origin_not_allowed');
  if (req.method === 'OPTIONS') return done(204, null, {});
  if (req.method !== 'POST') return fail(405, 'method_not_allowed', { allow: 'POST, OPTIONS' });

  const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0]?.trim() || 'unknown';
  const wait = limited(ip, Number(deps.env['TTS_RATE_PER_MINUTE']) || TTS_LIMITS.ratePerMinute, now());
  if (wait !== null) return fail(429, 'rate_limited', { 'retry-after': String(wait) });

  let text: unknown;
  try {
    text = ((await req.json()) as { text?: unknown }).text;
  } catch {
    return fail(400, 'invalid_body');
  }
  if (typeof text !== 'string' || !text.trim()) return fail(400, 'invalid_text');
  if (text.length > TTS_LIMITS.textChars) return fail(413, 'too_long');
  const key = deps.env['OPENAI_API_KEY'];
  if (!key) return fail(503, 'not_configured');

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TTS_LIMITS.timeoutMs);
  try {
    const res = await deps.fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
      body: JSON.stringify(speechRequestBody(text.trim(), deps.env)),
      signal: ctrl.signal,
    });
    if (!res.ok) return fail(502, 'speech_failed');
    const audio = await res.arrayBuffer();
    return done(200, audio, { 'content-type': 'audio/mpeg', 'cache-control': 'no-store' });
  } catch (e) {
    return (e as { name?: string })?.name === 'AbortError' ? fail(504, 'timeout') : fail(502, 'speech_failed');
  } finally {
    clearTimeout(timer);
  }
}
