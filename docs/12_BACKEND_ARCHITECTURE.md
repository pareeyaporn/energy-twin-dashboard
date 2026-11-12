# 12 — Backend architecture

Energy Twin has almost no traditional backend. The numbers come from a deterministic TypeScript engine that runs in the
browser. The only server-side piece in the MVP is a thin proxy for the AI advisor. This doc explains how the parts fit, what
is built today, and what we will add. Product context is in [10_HOTEL_SPEC.md](10_HOTEL_SPEC.md); tasks are in
[11_HOTEL_TASKS.md](11_HOTEL_TASKS.md).

## 1. Principles
1. **The AI never invents numbers.** Every number comes from `src/engine`. The LLM only explains numbers it was given.
2. **Compute in the browser.** Scenario changes must update instantly, so simulation and optimization run client-side. No round trip.
3. **No database for the MVP.** Data is bundled JSON with a source on every value. Saved scenarios live in the browser.
4. **Secrets stay on the server.** API keys are Lovable Cloud secrets, read only inside backend functions, never in `VITE_*` variables or code.
5. **External services are never on the critical path.** The demo works with them all down.

## 2. What exists today (verified in the repo)
- **Framework:** TanStack Start (React, TypeScript, Vite). `vite.config.ts` uses `@lovable.dev/vite-tanstack-config`,
  which builds the server with Nitro for a **Cloudflare Worker** target.
- **Server entry:** `src/server.ts` wraps TanStack's server entry with an SSR error page (`src/lib/error-capture.ts`, `src/lib/error-page.ts`).
- **No `supabase/` folder and no `@supabase/supabase-js` dependency yet.** Lovable Cloud can provide them; nothing is set up.
- **Engine** (`src/engine`, pure TypeScript, no network): home baseline, upgrades, costs, finance. The hotel engine will live in `src/engine/hotel/`.

## 3. Runtime topology

```
                        ┌─────────────────────────── Browser ───────────────────────────┐
                        │  React UI (Lovable)  ◀──▶  zustand store (src/store/useTwin)  │
                        │        │                          │                           │
                        │   Hotel twin (src/twin)           ▼                           │
                        │                        src/engine/hotel (pure functions)      │
                        │                                   │ reads                     │
                        │                        src/data/hotel/*.json (bundled)        │
                        └──────────────┬────────────────────────────────────────────────┘
                                       │ HTTPS (advisor question + precomputed context)
        ┌──────────────────────────────▼───────────────────────┐
        │  Lovable Cloud edge function: supabase/functions/advisor (Deno)   │
        │  • holds the AI key (secret)   • 6 s timeout   • thin proxy       │
        └──────────────────────────────┬───────────────────────┘
                                       │ HTTPS
                                 LLM provider (TBD)

  Hosting: TanStack Start SSR on a Cloudflare Worker, served through Lovable. Lovable syncs only the `main` branch.
```

## 4. Components and responsibilities

| Component | Where | Does | Does not |
| --- | --- | --- | --- |
| UI | `src/components`, `src/routes` (Lovable) | Forms, charts, panels | Any math or hard-coded numbers |
| Store | `src/store/useTwin.ts` | Holds profile, scenario, results; calls the engine | Business logic beyond calling the engine |
| Engine | `src/engine/hotel/` | Baseline, scenarios, upgrades, optimizer, finance, explanation drivers | React, network, AI, randomness, `Date.now()` |
| Data | `src/data/hotel/*.json` | Sourced inputs (`source`, `verified`) | Anything unsourced presented as fact |
| Twin | `src/twin/` | Clickable 2D diagram driven by store numbers | Math |
| Advisor proxy | `supabase/functions/advisor` | Forwards the question and context to the LLM with the secret key | Compute numbers, store data |
| Advisor glue | `src/engine/hotel/advisor*.ts` (client) | Builds the context, validates the answer, picks the fallback | Call the LLM directly |

The engine must stay **SSR-safe**: no `window`, no browser-only APIs, so it also runs in the Worker if we ever call it server-side.

## 5. Key flows

**Scenario simulation (client only).** The user moves a control → store updates the scenario → `simulateEnergyScenario()` →
store updates `scenarioResult` → charts and the twin re-render. No network.

**Budget optimizer (client only).** Budget and objective → `optimizeInvestmentPortfolio()` → three packages in the store.
The UI keeps a short "testing combinations…" state for the animation. Target: under 100 ms for 2^8 combinations.

**AI advisor.**
1. The client builds a **context object** from store results: baseline by zone, current scenario, the three packages, and a few
   precomputed comparisons (for example solar first vs thermostats first).
2. The client sends `{ question, context }` to the edge function.
3. The function calls the LLM with the system instruction below and returns `{ text }`.
4. The client **validates** the text (section 7). If it fails, times out (6 s) or errors, the client shows the deterministic
   template answer instead.
5. The answer is cached in memory per question and context.

## 6. Advisor function contract

`POST /functions/v1/advisor`

```jsonc
// request
{ "question": "Why recommend smart thermostats over solar?",
  "context": { /* hotel profile summary, baseline, scenario, packages, comparisons — all numbers precomputed */ } }
// response 200
{ "text": "…" }
// errors: 400 invalid input, 413 context too large, 429 rate limited, 504 upstream timeout
```

- **System instruction (draft):** "Explain in plain language for a hotel owner. Use only the numbers in the context. Never introduce
  a new number. If the context cannot answer the question, say so. Mention one limitation of the estimate."
- **Input limits:** question length and context size capped. Free text from the user (for example inspection notes) is treated as data, never as instructions.
- **Secrets:** the provider key is read from the function's environment. Provider and secret name are still to be decided.
- **CORS:** restricted to the app's origin.
- **Logging:** log latency and status only. Never log the hotel profile or the question text.

## 7. Guardrails against invented numbers
- **Validator (client):** extract every number from the answer (strip `$`, commas, `%`, units) and require each to appear in the context
  (allowing display rounding). Years, counts like "three packages" and ordinals are allow-listed. Any failure discards the answer.
- **Fallback:** deterministic template answers for the demo questions (why HVAC is costly, how occupancy changes energy, solar or thermostats first,
  how to use a $30,000 budget), built from the same context.
- **Output labeling:** AI text is shown as an explanation of the computed results, next to the numbers.

## 8. Data layer
- **Bundled JSON** in `src/data/hotel/`, imported at build time. Every value has `source` and `verified`; synthetic values say so.
- **Saved scenarios (P1):** zustand plus `localStorage`. No accounts.
- **Share links (optional):** encode profile id, scenario and package in URL parameters.
- **Later:** Supabase tables for hotels and scenarios with row-level security, only if accounts or multi-property support are added (P2).

## 9. Security
- No keys in code, in `VITE_*` variables, or in the repository. Secrets only in Lovable Cloud.
- The browser never talks to the LLM provider directly.
- Validate and size-limit all function inputs; rate-limit the advisor to protect the key.
- The hotel profile is not personal data, but treat names and notes as user input: escape on render, never execute.

## 10. Performance budget
- Scenario update under 50 ms; optimizer under 100 ms (both asserted in tests).
- Memoize the baseline; recompute only the changed scenario.
- If the engine ever blocks the UI, move it into a Web Worker. Not needed for the MVP.

## 11. Build, deploy, environments
- `npm run build` must pass before every commit. Lovable syncs `main` and rebuilds the preview.
- Backend functions are authored in `supabase/functions/` and deployed through Lovable Cloud. They are not part of the Vite build.
- One environment for the hackathon. Secrets are set in Lovable Cloud.

## 12. Failure modes

| Failure | Behavior |
| --- | --- |
| Advisor function down, slow (over 6 s), or key missing | Template answer; no error shown to the audience |
| Validator rejects the AI text | Template answer |
| Network offline | Everything except the live AI answer works; cached advisor answers still show |
| WebGL missing | Not an issue: the twin is 2D SVG |
| Missing input | Defaults are used and labeled "default (estimate)" |
| Optimizer finds nothing within budget | Clear empty-state message, with the cheapest useful upgrade suggested |

## 13. Observability
- `src/lib/error-capture.ts` already captures SSR errors; keep the demo path free of console errors.
- Log advisor latency and outcome (success, timeout, rejected, fallback) in the console during rehearsals.

## 14. Testing
- Vitest for the engine, the context builder and the validator (including adversarial strings like "about 40 percent" that are not in the context).
- A function contract test with a mocked LLM (valid, slow, invalid, over-sized inputs).
- A manual end-to-end run of the three-minute demo path five times in a row.

## 15. Future integrations (not on the critical path)
Each has a seam so the demo never depends on it: weather API (replaces monthly normals), tariff databases (replaces flat rates),
EPA eGRID (emission factors), utility bill upload and calibration, building-management or IoT feeds, accounts and multi-property.

## 16. Open decisions
- [ ] AI provider and secret name (team)
- [ ] **Where the advisor runs.** Recommended: a Supabase edge function, as `CLAUDE.md` specifies, with the client building the context and validating.
      Alternative: a TanStack Start server function on the Worker, which could share engine code with the validator. Confirm before building.
- [ ] Whether saved scenarios need to persist beyond the browser
- [ ] Rate limit values and the context size cap
