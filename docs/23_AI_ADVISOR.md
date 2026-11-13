# 23 — The AI assistant (tool-using advisor, briefing, report summary, column mapping)

Built November 2026 (Phase 15 in `docs/11`). The rule from CLAUDE.md is unchanged: **the AI never produces a number**. What changed is that
the AI may now ask the engine to *compute* the numbers it needs, a what-if, a plan for a budget, a stress test, the portfolio split. The
engine runs in the browser, and the AI explains its results. Every number in an AI text must appear in the context the browser sent or in the
results of the tools that ran for that answer; anything else is discarded and the template answer is shown.

Backend contract and limits: `docs/12` §6–§7. This document covers the product: what each feature does, where it is, the protocol from the
browser's side, the guardrails, privacy, the tests and the limits.

## 1. Where the AI is

| # | Feature | Where | AI mode | Falls back to |
| --- | --- | --- | --- | --- |
| 1 | **Tool-using advisor**: the AI calls engine tools, and the answer shows a card per result | Ask tab (`AdvisorPanel`), portfolio chat | `answer` | The same tools chosen by a keyword parser, and a template answer from their results |
| 2 | **Action buttons** under an answer ("Apply this what-if", "Apply this package to the twin", "Make this my plan", "Preview report", "Open this stress test", "Open the portfolio plan") | Under the answer | none (derived from the tool runs) | Same buttons (the offline path runs the same tools) |
| 3 | **Follow-up questions** (two or three chips) | Under the answer | written by the AI on a `FOLLOW_UPS:` line | Deterministic follow-ups from the question and the tools |
| 4 | **Ask AI** buttons (`<AskAbout question />`) | KPI cost (icon), each insight card, "Recommended investment plan", the portfolio's "Start here" | `answer` | As 1 |
| 5 | **Briefing**: three sentences at the top of the Hotel tab, labeled "AI summary of the model's results" | Hotel tab | `briefing` | A template from the same figures, labeled "Summary of the model's results" |
| 6 | **Executive summary** in the report preview and PDF, labeled "Summary written by AI from the figures in this report" | Report preview and PDF | `report_summary` | Nothing extra appears |
| 7 | **Suggest with AI** for utility spreadsheet columns ("Sends only the column headers, never your bill values") | Utility Data Manager, mapping step | `map_columns` | The automatic mapping (`guessMapping`) stays |
| 8 | **Chain questions**: "Ask about the portfolio" dialog with the portfolio tools and suggested chain questions | Portfolio page header | `answer`, scope `portfolio` | As 1 |

Code: the engine side is in `src/engine/hotel/advisor/` (`tools.ts`, `agent.ts`, `offline.ts`). The UI is in `src/advisor/`
(`AdvisorMessageExtras`, `AskAbout`, `PortfolioChat`, `Briefing`, `actions.ts`, `uiStore.ts`). The report summary is in `src/report/aiSummary.ts`
and the mapping button in `src/utility/AiMappingSuggest.tsx`. The function's tool descriptions are in `supabase/functions/advisor/tools.ts`.

## 2. The tools

The browser runs every tool with the pure engine (`runTool(env, call)`). Inputs are validated and clamped to the engine's own bounds; errors come
back as `{ error }` results (the AI is told what went wrong, nothing is invented). Results are compact JSON, rounded the way the app displays them.
Nothing a tool does changes the app's state.

| Tool | Input | Engine call | Result (main fields) |
| --- | --- | --- | --- |
| `run_scenario` | occupancyPct, electricity / gas price change %, heating / cooling setpoint °F, weatherOffsetF, common-area HVAC hours, lighting hours, smartRoomControls | `simulateEnergyScenario(hotel, scenario)` | before / after (annual cost, kWh, therms, t CO₂e), change (cost, %, carbon), top 3 drivers, comfort warnings |
| `find_best_plan` | budget, objective | `optimizeInvestmentPortfolio(prepareUpgradeContext(…), { budget, objective, discountRate })` | combinations tested, packages that fit, best package (cost, counted incentives, net investment, savings with range, payback, 10-year net benefit, NPV, carbon), other packages |
| `evaluate_upgrades` | upgrades (id, optional quantity) | `evaluatePlan` | the same financial fields, the new annual cost, warnings |
| `compare_upgrades` | upgrade ids (empty = all) | `compareUpgrades` | per upgrade: the financial fields and whether it fits the budget |
| `run_stress_test` | id (8 tests) | `STRESS_TESTS` + `simulateEnergyScenario` | label, one-off or every year, before / after, change |
| `portfolio_overview` | none | `portfolioSummary` | totals (hotels, rooms, cost, carbon, savings potential, investment), hotels ranked by priority |
| `portfolio_optimize` | budget, objective | `optimizePortfolioBudget` | totals (installed, net, savings, payback, NPV, carbon), the package per hotel |

Each run also keeps a `detail` (the scenario, the plan object, the portfolio plan), which never leaves the browser. The action buttons are built
from it (`actionsForRuns`), so a button applies exactly what the engine computed, never anything the AI wrote.

## 3. The protocol (browser side)

```
browser ── POST { question, context, mode: "answer", scope, rounds: [] } ──▶ function ──▶ AI
        ◀── { toolCalls: [{ id, name, input }] } ─────────────────────────────
runs the tools with the engine (at most 4 per round)
        ── POST { …, rounds: [{ calls, results: [{ id, content: JSON }] }] } ──▶
        ◀── { toolCalls } again (second round) or { text } ──────────────────
after 2 rounds the function sets tool_choice "none": the AI must answer in text
```

- **Limits** (`AGENT_LIMITS`): 8 s per call, 20 s per answer, 2 tool rounds, 4 calls a round, 3 follow-ups. While tools run, the chat shows
  "Running the model: find best plan…".
- **Check:** the text (without its `FOLLOW_UPS:` line) is checked with `validateAdvisorText(text, { context, tools })`, where `tools` holds the
  results of this answer only. A failure discards the whole answer (reason `rejected`) and the offline path answers.
- **Follow-ups:** each one is number-checked the same way. Those that fail are dropped, and deterministic ones fill the gap.
- **Saved answers** (task 8.2): local storage keeps the text, the tool *calls* and the follow-ups. On replay the tools run again (deterministic)
  and the text is checked again against the fresh results, so a stale answer can never show numbers that are not on screen.
- **Offline / fallback:** with no endpoint, a timeout, an error, a refusal or a rejected answer, `planToolCalls` picks tools from the question.
  It understands occupancy %, price changes, setpoints, smart controls, stress words, a budget with plan words, two upgrades with comparison
  words, and the portfolio, with or without a budget. `toolAnswer` writes the answer from the results, and the cards and buttons are the same.
  With no tool to run, the earlier template answers (`fallbackAnswer`) are used.

## 4. Modes without tools

- **Briefing** (`Briefing.tsx`): the context is the hotel's name, city, rooms and synthetic flag, the annual cost, kWh, therms and carbon, and
  up to four insight cards (title, text, their figures as numbers, next step). The template shows at once. Once the browser is idle, the AI
  text is requested; it replaces the template only if it passes the check. It is cached per context, so it is asked once per hotel and its
  settings. A close button hides it for the browser session (`sessionStorage`); "Show the AI briefing" brings it back.
- **Report summary** (`src/report/aiSummary.ts`): before the preview or the PDF, `withAiSummary` sends the report's own figures. It leaves out
  the utility bills and long text. Shares are also given as percentages and kilograms as tonnes, the units the report prints (unit conversions
  only). It waits at most 8 s. If the text passes, the summary sits above the verdict with its label; otherwise the report is unchanged.
- **Column mapping** (`AiMappingSuggest.tsx`): sends `{ headers, fields, unitHints }` only: the header row, the nine field names and the unit
  names. The reply must be JSON naming known headers and fields; anything else is ignored. The suggestion lists each change ("Fuel: Not used
  → Natural gas use") and applies only on "Apply suggestion".

## 5. Guardrails

1. **Numbers:** every AI text (answer, follow-ups, briefing, report summary) passes `validateAdvisorText` against exactly what was sent or
   computed for it, or it is not shown.
2. **Actions:** built from tool runs, never from text; they change state only on click. A plan applies only to the hotel it was computed
   for (`adoptHotelPlan` checks the hotel object and that no optimizer run is in progress); otherwise the button says "computed for another
   hotel; ask again".
3. **Tool inputs** are validated and clamped (occupancy 5–100 %, setpoints within the form's bounds, budgets 0–$10M per hotel, $100M per chain).
   Unknown tool names are dropped in the browser and rejected by the function (400 `invalid_rounds`).
4. **Prompt injection:** the question, the context and the tool results are data inside tags, angle brackets neutralized. Tool results come
   from the browser's own engine, not from the model.
5. **Labels:** answers say "Explains the computed results" or "Template answer"; cards say "Computed by the Energy Twin engine · modeled
   estimate"; the briefing and the report summary carry their AI labels only when the AI wrote them.

## 6. Privacy

- Utility bills never leave the browser for the AI. The mapping sends headers only (a test asserts no bill value is in the request), and the
  report summary drops the utility section.
- The advisor context is the engine's results for the open hotel (and the portfolio's summary in portfolio questions), as before.
- The function logs latency and status only (docs/12 §13).

## 7. Store changes (additive)

`AdvisorMessage` gains `runs`, `followUps`, `scope` and `hotelRef`. New state: `advisorStep`. New actions: `adoptHotelPlan(plan, baseline,
packageId, forHotel)` and `adoptPortfolioPlan(plan)`. `askAdvisor(question, { scope })` keeps its old signature, since the option is optional.
`resetDemo` also clears the advisor's in-memory cache. The chat dialog and the briefing's hidden flag live in `src/advisor/uiStore.ts`, not in
the app store.

## 8. Tests

- `src/engine/hotel/__tests__/advisorTools.test.ts`:
  - each tool equals the direct engine call;
  - inputs are clamped and errors returned;
  - the function's tool names equal the engine's;
  - the validator accepts tool numbers and rejects invented ones;
  - the loop with a fake fetch (tool round, results sent back, follow-up with an invented number dropped, actions);
  - fallback when a number is invented, and the two-round cap;
  - offline parser → tools → template answer, for the hotel and the portfolio;
  - briefing and report-summary fallbacks;
  - the column mapping keeps known headers and fields only.
- `src/test/aiAssistant.test.tsx`:
  - cards render and actions change state only on click;
  - a plan for another hotel is refused;
  - follow-up chips ask;
  - AskAbout opens the Ask tab and asks;
  - the portfolio chat answers with the portfolio tools;
  - the briefing template, the hide toggle, and an AI briefing replacing the template;
  - the report summary is absent on fallback and labeled when present, and the PDF still renders;
  - Suggest with AI sends headers only and applies only after confirmation.
- `src/test/advisorFunction.test.ts`:
  - tool calls are returned in answer mode;
  - rounds are passed back as tool_use and tool_result messages, with tool_choice "none" on the last round;
  - malformed rounds, unknown modes and tool use outside answer mode are rejected.
- **Browser check** (Playwright, desktop 1440 × 900 and iPhone 13), with the function both unreachable (fallback) and mocked:
  - the briefing, the Ask answers with cards and actions, and Apply (the KPI changes);
  - the report preview with the summary;
  - the mapping suggestion (request body without bill values);
  - the portfolio chat and "Open the portfolio plan".

  No page errors.

**Not tested here:** the live model. This environment cannot reach the deployed function. Before the demo, ask the live advisor each Phase 15
question once (tasks 15.10–15.11). Rehearsed answers are then saved and replay instantly.

## 9. Limits

- Tools cover the open hotel and the portfolio summary. "What would $50,000 buy at the second hotel?" needs opening that hotel first. A
  per-hotel `find_best_plan` for any portfolio hotel is a P2 task.
- The number check is lexical. It proves every number came from the engine, not that the sentence around it is right; the cards show the real
  figures next to the text.
- The offline parser understands a fixed set of phrasings; anything else gets the earlier template answers.
- The briefing is cached per hotel context in memory; a reload asks again (once).
- Observed during the browser check, not caused by this feature: on a phone, the portfolio page's map "Explore digital twin" marker buttons sit
  outside the viewport and widen the page (scroll width about 705 px on a 390 px screen).

## For the pitch Q&A (copied into docs/22, Part D #22–25c)

**Where is the AI?** In six places, all explaining or setting up the engine's numbers:
- the advisor chat, on the Ask tab and the portfolio page;
- "Ask AI" buttons next to key figures;
- a three-sentence briefing on each hotel;
- an executive summary in the PDF report;
- a helper that maps spreadsheet columns when you upload bills.

The calculations, from the energy model to the optimizer and the financials, are deterministic code, not AI.

**Can it hallucinate a number?** It can try, and the browser throws the answer away. Before anything is shown, every number in an AI text is
checked against the figures the engine produced for that answer: the hotel's results plus the results of any tool it ran. One unknown number
and the whole answer is replaced by a template answer built from the same results. The same check covers the follow-up questions, the briefing
and the report summary.

**What does "tool use" mean here?** When a question needs a new calculation ("what if occupancy hits 85%?", "what does $50,000 buy?"), the AI
asks our engine to run it. It does not estimate. The engine runs in the browser and the AI receives the result. The answer shows the engine's
result card, so you can see the exact figures, and buttons apply that result to the twin with one click. The AI never computes; it chooses
which calculation to run and explains it.

**Why not let the AI optimize the investments?** The optimizer is exhaustive: it tests every combination of upgrades within the budget, often
hundreds, with the same costs, incentives, interactions and discount rate every time. The same inputs give the same answer, which owners and
lenders can audit. A language model would be slower, could miss combinations, could not guarantee the arithmetic, and could answer differently
twice. We use the AI where it is strong: understanding the question, picking the right calculation and explaining the trade-offs in plain
language.

**What does it cost to run?** One question is one to three short model calls (a tool round adds one), with a 1,024-token answer cap and low
effort. That is a few cents at most per question. The briefing is asked once per hotel view, and the report summary once per report. The
answers to the rehearsed questions are saved in the browser. A monthly spending limit is set in the Anthropic console. Without a key, or when
the model is slow (8 seconds), the app keeps working on template answers.

**What do you send to the AI? What about our bills?** The engine's results for the hotel you are looking at, never raw utility bills. When you
upload a bill spreadsheet, "Suggest with AI" sends only the column headers ("Billing month", "kWh") so the AI can say which column is which;
the values stay in your browser, and you confirm every suggestion. The report summary leaves the utility section out.

**What if the AI is down?** Nothing breaks. Every AI feature has a deterministic fallback:
- the advisor runs the same engine tools from a keyword parser and writes a template answer, with the same cards and buttons;
- the briefing shows a template;
- the report has no summary paragraph;
- the column mapping keeps the automatic guess.

**Can the AI change my plan without me?** No. Buttons appear only for results the engine computed, and nothing changes until you click one.
A plan computed for one hotel cannot be applied to another.
