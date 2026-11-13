// The human voice for spoken answers (docs/23 §10): asks the `tts` function (OpenAI text-to-speech) for audio of a number-checked
// answer. Returns null on any failure so the caller can fall back to the browser's own voice. Audio is cached per text for the page,
// so a rehearsed answer replays instantly.
import { advisor } from "@/engine/hotel";

export const TTS_CLIENT_TIMEOUT_MS = 7_000;

/** The tts function's URL: VITE_TTS_URL, else the advisor's endpoint with /advisor → /tts; null when no backend is configured. */
export function ttsEndpoint(env: Record<string, string | undefined> = import.meta.env as unknown as Record<string, string | undefined>): { url: string; headers: Record<string, string> } | null {
  const cfg = advisor.getAdvisorConfig();
  const direct = env["VITE_TTS_URL"];
  if (direct) return { url: direct, headers: cfg.headers ?? {} };
  if (!cfg.endpoint) return null;
  const url = cfg.endpoint.replace(/\/advisor\/?$/, "/tts");
  return url === cfg.endpoint ? null : { url, headers: cfg.headers ?? {} };
}

const cache = new Map<string, Blob>();
export const clearSpeechCache = () => cache.clear();

/** MP3 audio for `text`, or null (no backend, not configured, slow, failed). */
export async function fetchSpeech(text: string, opts: { signal?: AbortSignal; fetchImpl?: typeof fetch } = {}): Promise<Blob | null> {
  const hit = cache.get(text);
  if (hit) return hit;
  const ep = ttsEndpoint();
  if (!ep) return null;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TTS_CLIENT_TIMEOUT_MS);
  const onAbort = () => ctrl.abort();
  opts.signal?.addEventListener("abort", onAbort);
  try {
    const res = await (opts.fetchImpl ?? fetch)(ep.url, {
      method: "POST",
      headers: { "content-type": "application/json", ...ep.headers },
      body: JSON.stringify({ text }),
      signal: ctrl.signal,
    });
    if (!res.ok || !(res.headers.get("content-type") ?? "").includes("audio")) return null;
    const blob = await res.blob();
    if (blob.size === 0) return null;
    cache.set(text, blob);
    return blob;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
    opts.signal?.removeEventListener("abort", onAbort);
  }
}
