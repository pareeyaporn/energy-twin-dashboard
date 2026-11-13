import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TTS_INSTRUCTIONS, TTS_LIMITS, handleTtsRequest, resetTtsRateLimit, speechRequestBody } from "../../supabase/functions/tts/core";
import { clearSpeechCache, fetchSpeech, ttsEndpoint } from "@/advisor/ttsClient";
import { advisor } from "@/engine/hotel";

const URL_ = "https://project.supabase.co/functions/v1/tts";
const req = (body: unknown, init: RequestInit = {}) => new Request(URL_, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), ...init });
const audioOk = () => new Response(new Uint8Array([1, 2, 3]), { status: 200, headers: { "content-type": "audio/mpeg" } });

describe("tts function (OpenAI text-to-speech)", () => {
  beforeEach(() => resetTtsRateLimit());

  it("sends exactly the given text with the model, voice and warm delivery, and returns the audio", async () => {
    const fetchImpl = vi.fn(async (_url: string | URL | Request, _init?: RequestInit) => audioOk());
    const res = await handleTtsRequest(req({ text: "Your bill rises by $24,399." }), { env: { OPENAI_API_KEY: "sk-test" }, fetch: fetchImpl as unknown as typeof fetch });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("audio/mpeg");
    const call = fetchImpl.mock.calls[0];
    if (!call) throw new Error("Expected a speech request");
    const [url, init] = call;
    if (!init) throw new Error("Expected speech request options");
    expect(url).toBe("https://api.openai.com/v1/audio/speech");
    expect((init.headers as Record<string, string>)["authorization"]).toBe("Bearer sk-test");
    const body = JSON.parse(String(init.body));
    expect(body).toEqual({ model: "gpt-4o-mini-tts", voice: "nova", input: "Your bill rises by $24,399.", response_format: "mp3", instructions: TTS_INSTRUCTIONS });
  });

  it("drops style instructions for tts-1 models and honours the voice setting", () => {
    expect(speechRequestBody("Hi", { OPENAI_TTS_MODEL: "tts-1", OPENAI_TTS_VOICE: "alloy" })).toEqual({ model: "tts-1", voice: "alloy", input: "Hi", response_format: "mp3" });
  });

  it("rejects bad input, missing keys, long text, other origins and failures without leaking the key", async () => {
    const f = vi.fn(async () => audioOk()) as unknown as typeof fetch;
    expect((await handleTtsRequest(req({ text: " " }), { env: { OPENAI_API_KEY: "k" }, fetch: f })).status).toBe(400);
    expect((await handleTtsRequest(req({ text: "x".repeat(TTS_LIMITS.textChars + 1) }), { env: { OPENAI_API_KEY: "k" }, fetch: f })).status).toBe(413);
    const noKey = await handleTtsRequest(req({ text: "Hi" }), { env: {}, fetch: f });
    expect(noKey.status).toBe(503);
    const bad = await handleTtsRequest(req({ text: "Hi" }), { env: { OPENAI_API_KEY: "sk-secret" }, fetch: (async () => new Response("nope", { status: 401 })) as unknown as typeof fetch });
    expect(bad.status).toBe(502);
    expect(await bad.text()).not.toContain("sk-secret");
    const origin = await handleTtsRequest(req({ text: "Hi" }, { headers: { origin: "https://evil.example", "content-type": "application/json" } }), { env: { OPENAI_API_KEY: "k", ALLOWED_ORIGINS: "https://app.example" }, fetch: f });
    expect(origin.status).toBe(403);
    const get = await handleTtsRequest(new Request(URL_, { method: "GET" }), { env: { OPENAI_API_KEY: "k" }, fetch: f });
    expect(get.status).toBe(405);
  });

  it("rate-limits per address", async () => {
    const f = vi.fn(async () => audioOk()) as unknown as typeof fetch;
    const env = { OPENAI_API_KEY: "k", TTS_RATE_PER_MINUTE: "2" };
    const r = () => handleTtsRequest(req({ text: "Hi" }, { headers: { "x-forwarded-for": "1.2.3.4", "content-type": "application/json" } }), { env, fetch: f });
    expect((await r()).status).toBe(200);
    expect((await r()).status).toBe(200);
    expect((await r()).status).toBe(429);
  });
});

describe("browser client for the human voice", () => {
  afterEach(() => {
    advisor.setAdvisorConfig(null);
    clearSpeechCache();
  });

  it("derives the tts URL from the advisor endpoint, caches audio, and returns null on failure", async () => {
    advisor.setAdvisorConfig({ endpoint: "https://p.supabase.co/functions/v1/advisor", headers: { apikey: "pub" } });
    expect(ttsEndpoint({})).toEqual({ url: "https://p.supabase.co/functions/v1/tts", headers: { apikey: "pub" } });
    const ok = vi.fn(async () => audioOk()) as unknown as typeof fetch;
    const a = await fetchSpeech("Hello there.", { fetchImpl: ok });
    expect(a).not.toBeNull();
    expect(await fetchSpeech("Hello there.", { fetchImpl: ok })).toBe(a);
    expect((ok as unknown as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(1);
    const down = vi.fn(async () => new Response(JSON.stringify({ error: "not_configured" }), { status: 503, headers: { "content-type": "application/json" } })) as unknown as typeof fetch;
    expect(await fetchSpeech("Something else.", { fetchImpl: down })).toBeNull();
    advisor.setAdvisorConfig({ endpoint: null, headers: {} });
    expect(await fetchSpeech("Offline.")).toBeNull();
  });
});
