// Energy Twin advisor: a thin proxy to the Claude API. It receives { question, context } from the browser, asks the model to
// explain the numbers in the context, and returns { text }. The browser checks the answer for invented numbers.
//
// Secrets (Lovable Cloud, never in code): ANTHROPIC_API_KEY.
// Optional settings: ADVISOR_MODEL (default claude-opus-5-5), ALLOWED_ORIGINS (comma-separated; unset allows any origin),
// ADVISOR_RATE_PER_MINUTE, ADVISOR_TIMEOUT_MS, ADVISOR_REFUSAL_FALLBACK ("off" turns the server-side refusal fallback off).
import Anthropic from 'npm:@anthropic-ai/sdk';
import { handleAdvisorRequest, type CompleteResult } from './core.ts';

declare const Deno: {
  env: { toObject(): Record<string, string> };
  serve(handler: (req: Request) => Response | Promise<Response>): void;
};

Deno.serve((req) =>
  handleAdvisorRequest(req, {
    env: Deno.env.toObject(),
    complete: async ({ system, user, model, signal }): Promise<CompleteResult> => {
      const env = Deno.env.toObject();
      // No retries: a retry would blow the 6-second budget the browser allows before it shows the template answer.
      const client = new Anthropic({ apiKey: env['ANTHROPIC_API_KEY'], maxRetries: 0 });
      // Thinking is always on for this model; low effort keeps a short explanation fast.
      const params = {
        model,
        max_tokens: 1024,
        system,
        messages: [{ role: 'user', content: user }],
        output_config: { effort: 'low' },
      };
      // Refusal fallback is on by default so a policy decline is retried on another model inside the same call.
      // deno-lint-ignore no-explicit-any
      const res: any =
        env['ADVISOR_REFUSAL_FALLBACK'] === 'off'
          // deno-lint-ignore no-explicit-any
          ? await client.messages.create(params as any, { signal })
          // deno-lint-ignore no-explicit-any
          : await client.beta.messages.create({ ...params, betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' } as any, { signal });
      if (res.stop_reason === 'refusal') return { refused: true };
      const text = (res.content as { type: string; text?: string }[])
        .filter((b) => b.type === 'text')
        .map((b) => b.text ?? '')
        .join('\n');
      return { text };
    },
  }),
);
