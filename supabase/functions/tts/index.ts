// Energy Twin advisor voice: OpenAI text-to-speech for answers the browser has already number-checked (docs/23 §10).
// Secret (Lovable Cloud, never in code): OPENAI_API_KEY. Optional: OPENAI_TTS_MODEL (default gpt-4o-mini-tts), OPENAI_TTS_VOICE
// (default nova), ALLOWED_ORIGINS, TTS_RATE_PER_MINUTE.
import { handleTtsRequest } from './core.ts';

declare const Deno: {
  env: { toObject(): Record<string, string> };
  serve(handler: (req: Request) => Response | Promise<Response>): void;
};

Deno.serve((req) => handleTtsRequest(req, { env: Deno.env.toObject(), fetch }));
