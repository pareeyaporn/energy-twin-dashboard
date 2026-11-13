# CLAUDE.md — Energy Twin

Read this file at the start of every session. It is the source of truth for how we work in this repo.

## What we are building

**Energy Twin** — "Simulate smarter. Spend better. Save energy."
An AI-powered **operational digital twin for existing commercial buildings, starting with hotels**.
Hotel owners and operators see where the building spends energy (by zone), test operating decisions
(occupancy, setpoints, schedules, electricity prices) before changing anything, and get the **3 best investment
packages** for a budget — with costs, savings ranges, payback, five-year net benefit, carbon and comfort notes.
An AI advisor explains the computed results in plain language. It never produces numbers.

History: the project began as a home energy simulator (Maya's house). We pivoted because an earlier winner, Eden, covers
net-zero **new-build** home design. We differentiate on **existing** buildings, operations plus investments. The hotel product is
built (`src/engine/hotel/`, `src/twin/`, the 3D twin in `src/three/`, the workspace UI, the advisor); the home-era engine, data and specs were removed (git history keeps them).

Hackathon: 48 hours. Built in **Lovable**, extended with **Claude Code**, synced through **GitHub**.
Demo = one flawless 6–7 minute path (script in `docs/07`): synthetic 100-room hotel (Chicago) in 3D → zone-level energy → a living
building (seasons, day–night) → occupancy 60% to 85% → smart room controls on → $50,000 budget → three packages and the 10-year projection →
ask the advisor → the 300-room preset → before/after energy, cost and carbon.
**The script follows the calibrated results**, whichever upgrades perform best; never adjust calculations to fit a story.

Full specs live in `/docs`. Read the relevant doc before working on an area:
- `docs/10_HOTEL_SPEC.md` — the product brief (what and why, MVP priorities, demo, success criteria)
- `docs/11_HOTEL_TASKS.md` — the detailed task list by phase (P0, P1, P2). **Start here for what to build next.**
- `docs/12_BACKEND_ARCHITECTURE.md` — runtime topology, the AI advisor function, guardrails
- `docs/13_HOTEL_ENGINE_SPEC.md` — equations, assumptions, the financial breakdown and the demo figures
- `docs/08_DATA_TODO.md` — data status and research still to find; `docs/14_RESEARCH_LOG.md` — every sourced value; `docs/15_PRODUCT_DECISIONS.md` — team decisions (not facts)
- `docs/16_ONBOARDING_TOUR.md` — the onboarding tour: every step, its wording and behavior
- `docs/17_PORTFOLIO_MAP_DESIGN.md` — the portfolio city map's design: colors, basemap restyle, markers, overlap handling, card, list, toolbar, legend, mobile, fallback
- `docs/18_INVESTMENT_REPORT.md` — the investment results and the PDF report: every figure, its engine source, wording and attribution rules
- `docs/21_CALCULATION_TRANSPARENCY.md` — "How was this calculated?": every explanation, data labels, financial assumptions, limits
- `docs/23_AI_ADVISOR.md` — the AI assistant: engine tools the AI may call, the protocol, action buttons, follow-ups, briefing, report summary, column mapping, guardrails, privacy
- `docs/19_UTILITY_DATA.md` — utility data: the Utility Data Manager, Excel template and upload, validation, calibration method and metrics, baseline choice, privacy, limits
- `docs/20_EQUIPMENT_INVENTORY.md` — the editable equipment inventory: audit, data model, simulation levers, current vs proposed, validation, persistence
- `docs/04_3D_SPEC.md` — the 3D hotel twin (what drives each visual); `docs/05_CLAUDE_CODE_PROMPTS.md`, `docs/06_LOVABLE_PROMPTS.md` — prompts and status
- Removed (in git history): the home-era specs `docs/02`, `docs/03` and `docs/09`, the superseded offices-and-retail plan.

## Honesty rules

- Label outputs as **estimates**. Say when inputs are defaults or synthetic.
- Never claim engineering-grade accuracy, verified carbon savings, guaranteed returns or real-time monitoring unless implemented and validated.
- Synthetic data must be labeled synthetic wherever it is shown.

## Golden rules

1. **Lovable syncs only the `main` branch.** Claude Code works on short-lived, meaningfully named feature branches (`engine/…`, `data/…`,
   `docs/…`, `twin/…`), opens a pull request and merges it into `main` with a **regular merge** (never squash or rebase, which makes Lovable
   report "replaced your work"). **Never merge while a Lovable prompt is running**; otherwise Lovable saves its work to `lovable-sync`,
   which then has to be merged. Merge only when the user asks.
2. **Never rename, move or delete the GitHub repo.** It breaks Lovable sync permanently.
3. **Always `git pull` before starting work.** Lovable commits constantly.
4. **Small commits, pushed often** (every 30–60 min). Clear messages: `engine: add optimizer`, `three: thermal material`.
5. **Run `npm run build` before every commit.** Never push a broken build — it breaks Lovable's preview for everyone.
6. **Never force-push.** On conflicts, resolve carefully and keep both sides' intent.
7. **No secrets in code.** API keys live in Lovable Cloud secrets and are read only inside `supabase/functions`.
8. **The AI never invents numbers.** All numbers come from `src/engine`. The AI only explains them.

## Folder ownership (prevents Lovable and Claude Code overwriting each other)

| Path | Owner | Notes |
| --- | --- | --- |
| `src/pages/`, `src/components/` | Lovable | Do NOT edit unless the user explicitly asks |
| `src/store/` | Shared | Agreed contract. Change only with the user's OK; keep backwards compatible |
| `src/engine/` | Claude Code | Pure TypeScript. No React, no network, no AI. The engine lives in `hotel/` |
| `src/data/` | Claude Code | JSON only. Every value carries a source; `hotel/` is the data set (three home-era files remain only because the store imports them) |
| `src/twin/` | Claude Code | The clickable 2D hotel diagram (`<HotelTwin />`). Lovable only places it |
| `src/plans/` | Claude Code | Investment modes: AI plan, Build your own (catalog), Compare. Placed by `BudgetOptimizer` (minimal hook) |
| `src/portfolio/` | Claude Code | Hotel portfolio page, the homepage: city map (MapLibre, drawn fallback, multi-city), totals, comparison, charts, portfolio optimizer, priority explanation |
| `src/insights/` | Claude Code | Opportunities & alerts cards. Rules in `src/engine/hotel/insights.ts` (docs/13 §14) |
| `src/scenario/` | Claude Code | Simulation impact summary (today vs the what-if), placed by `ScenarioSimulator` (minimal hook) |
| `src/advisor/` | Claude Code | The AI assistant's UI (docs/23): result cards, action buttons, follow-ups (`AdvisorMessageExtras`), `AskAbout`, the portfolio chat, the Hotel tab briefing. Placed by `AdvisorPanel`, `KpiStrip`, `HotelTab` (minimal hooks), `src/insights`, `src/report`, `src/portfolio` |
| `src/explain/` | Claude Code | "How was this calculated?" explanations, data labels, financial assumptions (docs/21). Placed by `KpiStrip`, `SourcesSheet` (minimal hooks) and `src/report` |
| `src/report/` | Claude Code | Investment results and the PDF report (`@react-pdf/renderer`, lazy-loaded). Placed by `BudgetOptimizer` (one line), `PlanBuilder` and the portfolio optimizer. See `docs/18` |
| `src/app/` | Claude Code | The homepage (`/`, the portfolio), the hotel dashboard (`/hotel`, moved from `src/routes/index.tsx`) and the landing rules |
| `src/tour/` | Claude Code | First-visit onboarding tour (spotlight steps, replay from the top bar). Steps and behavior in `docs/16` |
| `src/utility/` | Claude Code | Utility data: the Hotel tab section, the Utility Data Manager (spreadsheet, Excel/CSV, template), calibration review. `docs/19` |
| `src/three/` | Claude Code | The 3D hotel twin (built, Phase 9). Loaded by `src/twin/parts/View3D.tsx`; Lovable places only `<HotelTwin />` |
| `supabase/functions/` | Claude Code | Backend functions (AI advisor). Keys are read only here |
| `docs/` | Anyone | Specs and plans |

If a task needs a change in a Lovable-owned file, make the **smallest possible** change and say so in the commit message.

## Tech stack

- React + TypeScript + Vite + Tailwind + shadcn/ui (from Lovable)
- State: `zustand` (`src/store/useTwin.ts`)
- Map: `maplibre-gl` (lazy-loaded, free Carto dark basemap, no key; drawn fallback)
- 3D: `three`, `@react-three/fiber`, `@react-three/drei` (used, lazy-loaded, 2D fallback); `@react-three/postprocessing`, `@react-spring/three` installed but unused
- Charts: `recharts`
- PDF: `@react-pdf/renderer` (lazy-loaded; the investment report in `src/report/`)
- Tests: `vitest`
- Backend: Lovable Cloud (Supabase edge functions, Deno)

**Version rule for 3D packages** — check React's major version in `package.json` first:
- React 18 → `@react-three/fiber@^8`, `@react-three/drei@^9`, `@react-three/postprocessing@^2`, `@react-spring/three@^9`
- React 19 → `@react-three/fiber@^9`, `@react-three/drei@^10`, `@react-three/postprocessing@^3`, `@react-spring/three@^10`
Never upgrade React itself.

## Architecture (data flow)

```
Lovable UI panels ──writes──▶ zustand store ◀──reads── digital twin: 2D (src/twin), 3D (src/three)
                                   │
                                   ▼
                     src/engine/hotel (pure functions, in the browser)
                                   │ reads
                                   ▼
                     src/data/hotel/*.json (sourced, labeled synthetic until verified)

store results ──▶ supabase/functions/advisor ──▶ AI text (explanation only) ──▶ validated in the browser
```

- The twin (2D and 3D) does **no math**. Scenery (trees, snow, sky, traffic) is visual only; anything that looks like data comes from the store. Colors, labels and the metric tiles all read numbers from the store, which the engine computed.
  If the numbers change, the visuals change.
- Components never hard-code costs or savings. They read from the store.
- The advisor receives precomputed results; the browser rejects any answer containing a number not in them. See `docs/12`.
  It may ask the engine for more (a what-if, a plan for a budget, a stress test, the portfolio split): the browser runs those tools and the
  check then allows the context plus those results only (`docs/23`).

## Store contract (summary — the full list for UI work is the cheat sheet at the top of `docs/06`)

`useTwin` holds the hotel state: `hotelInput` / `hotel` (resolved profile with `defaulted` and `notes`), `baseline`, `scenario`,
`activeStressTest`, `scenarioResult`, `optimizeOnScenario` (follows the scenario automatically), `hotelPlan`, `optimizing`,
`optimizerCombinations`, `activeHotelPackageId`, `savedScenarios`, `hotelDiscountRate`, `customPlans` / `activeCustomPlanId` (local storage),
`planBeforeStress`, the current equipment (`equipmentByProperty`, `setEquipment`, `undoEquipment`, `resetEquipment`; docs/20), twin controls (`selectedZone`, `twinLayer`, time with modes
`seasons` / `day` / `year`, `compareMode`)
the portfolio (`portfolio`, `organizations` / `organizationId`, `portfolioFilter` (brand, region, ownership, city), `portfolioView` (map metric, selected hotel, list, table sort, camera, scroll: view state kept across a hotel visit), `activePropertyId`, `propertyStates`, `portfolioBudget`, `portfolioObjective`, `portfolioPlan`, `portfolioCustomPlanIds`, the portfolio stress test, `userHotels` from Add my hotel) and advisor messages, with actions such as `setHotelInput`, `setScenario`, `applyStressTest`, `runHotelOptimizer`,
`applyHotelPackage`, `askAdvisor`, `openProperty`, `runPortfolioOptimizer`, `saveUtilityData`, `setUtilityBaseline`, `removeUtilityData`, and the advisor's `adoptHotelPlan` / `adoptPortfolioPlan` (applied only from tool results, on click; `advisorStep` shows the tool running; docs/23). Derived values live in `src/store/hotelDerived.ts` (`selectDisplayed`, `selectCompare`,
`selectUpgradeComparison`, `selectUpgradeBaseline`, `selectHourState` for the 3D readout, `selectCatalog`, `selectCustomPlanEvaluation`,
`selectPlanExplanation`, `selectStressReport`, `selectPortfolioSummary`, `selectPortfolioCustomEvaluation`, `selectPortfolioStressReport`, `selectVisibleCustomPlans`, …). Some home-era fields remain in the store for compatibility (they read `presetHomes.json`, `mockPackages.json`, `mockParts.json`).

Before changing the store, read `src/store/useTwin.ts` and **extend** it, backwards compatibly, rather than replacing it.
Show the diff and get the user's OK first.

## Commands

```bash
npm install          # after pulling if package.json changed
npm run dev          # local dev server
npm run build        # must pass before every commit
npx vitest run       # engine tests
```

## Coding conventions

- TypeScript strict. Export types from `src/engine/hotel/types.ts`.
- Engine functions are pure and deterministic: same input → same output. No `Date.now()`, no randomness.
- Money in US dollars, rounded only for display. Energy in kWh (electric) and therms (gas).
- Every number shown to users comes with a `source` and, where relevant, a `[low, high]` range.
- Twin and 3D components: keep each zone or part in its own file. Respect `reduceEffects`. Support keyboard and screen readers.
- Keep the demo path working at all times. If a feature is half-done, hide it behind a flag.

## Definition of done (for any task)

- `npm run build` passes, `npx vitest run` passes
- The demo path still works end to end with the synthetic 100-room hotel
- Merged into `main` (regular merge, when the user asks), and the change is visible in Lovable's preview
