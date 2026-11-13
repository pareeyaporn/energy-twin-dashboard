// Energy Twin advisor: a thin proxy to the Claude API. It receives { question, context, mode?, rounds? } from the browser and returns
// { text } or, in answer mode, { toolCalls } that the browser runs with the engine and sends back (docs/12, docs/23). The browser
// checks every text for invented numbers.
//
// Secrets (Lovable Cloud, never in code): ANTHROPIC_API_KEY.
// Optional settings: ADVISOR_MODEL (default in core.ts), ALLOWED_ORIGINS (comma-separated; unset allows any origin),
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
    complete: async ({ system, messages, tools, toolChoice, model, signal }): Promise<CompleteResult> => {
      const env = Deno.env.toObject();
      // No retries: a retry would blow the 8-second budget the browser allows per call before it uses the template answer.
      const client = new Anthropic({ apiKey: env['ANTHROPIC_API_KEY'], maxRetries: 0 });
      // Thinking is always on for this model; low effort keeps a short explanation fast.
      const params = {
        model,
        max_tokens: 1024,
        system,
        messages,
        ...(tools ? { tools, tool_choice: { type: toolChoice ?? 'auto' } } : {}),
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
      const blocks = res.content as { type: string; text?: string; id?: string; name?: string; input?: Record<string, unknown> }[];
      const toolCalls = blocks
        .filter((b) => b.type === 'tool_use' && b.id && b.name)
        .map((b) => ({ id: b.id as string, name: b.name as string, input: b.input ?? {} }));
      if (toolCalls.length) return { toolCalls };
      const text = blocks.filter((b) => b.type === 'text').map((b) => b.text ?? '').join('\n');
      return { text };
    },
  }),
);
