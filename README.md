# Energy Twin

**Energy Twin: Simulate Smarter. Spend Better. Save Energy.**

What if hotel owners could see the impact of energy upgrades before spending a dollar? Energy Twin turns existing hotels into AI-powered
virtual testing grounds. Operators can visualize energy flows, simulate changing conditions, and stress-test decisions across one property
or an entire portfolio. Our optimizer finds the best upgrade combinations within a budget, revealing projected savings, payback, and carbon
impact. **Stop guessing. Start simulating. Invest with confidence.**

Energy Twin is an AI-powered operational digital twin for **existing commercial buildings, starting with hotels**. It helps owners
and operators see where a building spends energy, test operating decisions before changing anything, and choose the energy
investments that pay back best within a budget.

Built for a 48-hour hackathon in [Lovable](https://lovable.dev), extended with Claude Code, and synced through GitHub.

All P0 and P1 features are built, plus an interactive 3D twin, and run on a synthetic 100-room Chicago hotel (a 300-room preset is also included).
Numbers are **estimates**: most inputs are now sourced from primary documents (EIA, EPA eGRID, NOAA, PVWatts, IL-TRM, CBECS, ENERGY STAR);
installed costs, solar $/W and incentive amounts are still labeled placeholders or unverified. See the status below.

## What it does
- **One workspace:** four numbered tabs (1 Hotel, 2 Scenario, 3 Invest, 4 Ask) beside the digital twin, with a cost / energy / carbon
  strip that shows before → after for whatever is being tested. Overview ("Report"), full scenario and full optimizer pages are one click away.
- **Hotel profile:** rooms, floor area, HVAC, bills, occupancy, schedules, budget. Every input is optional; defaults are labeled "default (estimate)".
- **Digital twin (3D and 2D):** six clickable zones (guest rooms, lobby and common areas, kitchen and restaurant, hallways, central HVAC, hot water).
  The **3D view** (default on desktop) shows the hotel with seasons, day and night, lit windows per room, rooms set back by smart controls,
  rooftop HVAC heating or cooling, solar panels (or a "not installed" preview), a street with people whose number follows the guests out,
  a camera that glides to the selected zone, an "Energy view" heat map and an hourly readout (modeled temperature, demand by end use, cost).
  The **2D view** adds room, equipment and energy-flow layers. Both share one clock ("Year + day" plays every hour of every month), stress tests
  and a before/after split view with upgrade markers. Without WebGL, on phones or with "reduce effects", the 2D view is used.
- **Scenario simulator:** occupancy, setpoints, smart room controls, schedules, electricity price, four stress tests, "why this changed" and comfort notes.
  Saved scenarios (per browser session).
- **Upgrade comparison:** eight upgrades, solar included, each with the same breakdown: gross cost, incentives (listed, applied only when confirmed),
  net investment, kWh and therms saved, $ saved, simple payback, 5- and 10-year net benefit and CO2 avoided, NPV at 8% (or 3%) and a
  **10-year projection** (savings each year, cumulative net benefit with a range, discounted). Solar comes at three sizes (quarter, half and full
  roof), uses location-based output with hour-by-hour self-use and export, regional $/W, degradation and O&M.
- **Peer benchmark:** the hotel's modeled site energy intensity next to the ENERGY STAR hotel median and the CBECS lodging mean (context only;
  nothing is tuned toward them).
- **Two ways to invest:** *AI recommended* (below) with "Why this plan", and *Build your own*: a catalog of every modeled upgrade by
  HVAC & Controls, Lighting, Renewable Energy and Building & Water, with quantities (rooms, % of lighting, ft², solar kW), live totals
  (gross cost, verified incentives and net investment separately), budget warnings and conflict notes; *Compare* puts the AI plan and up to
  three custom plans side by side. Custom plans use exactly the optimizer's calculation and are kept in the browser.
- **Stress tests:** eight events in Weather, Operations and Financial, each with its stated assumptions; normal year vs stress, how the
  selected plan holds up (extra costs avoided), and for persistent changes payback, NPV and whether the recommendation changes.
- **Budget optimizer:** tests every valid combination (512; solar sizes exclude each other) and returns three packages (maximum savings, fastest payback, balanced) within the budget
  and a comfort limit, measured against the current scenario when one is running. It uses exactly the numbers on the cards.
- **AI advisor:** plain-language answers from Claude, grounded in the computed results. The browser rejects any answer with a number that is
  not in the results and falls back to a template answer; nothing is invented.

## Demo path (6–7 minutes)
Seven acts, scripted with timings in [docs/07](docs/07_DEMO_CHECKLIST.md): the problem → meet the twin in 3D (zones, Energy view, benchmark) →
a living building (January night, July afternoon, energy flow) → test an operating decision (occupancy 60% to 85%, smart room controls) →
spend a $50,000 budget (three packages, 10-year projection, why not solar) → ask the advisor → scale to the 300-room preset and close on
before/after energy, cost and carbon. **The script follows the results**, whichever upgrades perform best (today, with the 85% scenario:
LED lighting plus occupancy sensors, $38,940, about $10,300 a year, payback 3.8 years; on the plain baseline $9,000 a year and 4.3 years;
ComEd's lighting incentive is a 2025 rate, so it is shown separately as illustrative rather than counted: $24,184 net and 2.3 years if renewed).

## Status

| Area | State |
| --- | --- |
| Hotel engine (`src/engine/hotel`): baseline, scenarios, upgrades, common financial breakdown with NPV and a 10-year projection, solar, incentives, optimizer, peer benchmark, twin data and the hourly state (sun, modeled temperature, demand by end use) | Built and tested (414 tests) |
| Data (`src/data/hotel`) | **Sourced from primary documents:** EIA prices, price growth (AEO2026) and hotel end uses (CBECS 2018); EPA eGRID2023 grid factors by location and the EPA gas factor; PVWatts solar output; NOAA weather; IL-TRM hotel measures (smart controls, sensors, lighting interaction, hot water); NLR solar O&M and degradation; Chicago hotel sizes and occupancy (Choose Chicago, STR). Solar $/W by size from LBNL's 2025 Data Update (2024 national medians, editable). ComEd standard incentives (LED, occupancy sensors, guest-room energy management) from the utility's worksheets. **Still placeholders or assumptions:** the LED retrofit mix (between sourced bounds), VRF equipment cost, the solar export credit ($0, editable), and the monthly occupancy shape. Phase 7 is closed except installed costs (7.6). See `docs/08`, `docs/14`, `docs/15` |
| Store (`src/store`): profile, scenarios, optimizer (scenario-aware), upgrade comparison, twin controls, advisor | Built |
| Digital twin: 2D (`src/twin`) and 3D (`src/three`, Phase 9) | Built |
| Workspace UI (Lovable, prompts LV1–LV15) | Built |
| Flow, Rooms and Equipment layers (animated Sankey, room façade, equipment cards) | Built (Phase 10) |
| Editable equipment inventory: current equipment vs proposed upgrades, add / edit / remove / replace, simulation levers (`docs/20`) | Built (Phase 14G) |
| Investment catalog and custom plans; stress tests | Built (Phases 11 and 12) |
| Hotel portfolio, the homepage (`/`; the hotel dashboard is `/hotel`): synthetic Chicago chains and a multi-city organization (New York, Miami, Denver) on a MapLibre map (city markers when zoomed out; a per-city schematic offline), "Start here" and the investment priority explained, the view kept when you visit a hotel and come back, totals, comparison table, charts, one budget split across hotels, open any hotel in the twin; my portfolio (custom plan per hotel) vs the AI portfolio; portfolio stress tests | Built (Phase 13 P0 and P1) |
| AI advisor (edge function + browser checks + chat panel) | Live on Lovable Cloud with the Claude API (about 3 s an answer; 8 s limit, then a template answer) |
| AI assistant (`docs/23`): the AI calls engine tools (what-if, best plan, compare, stress test, portfolio split) and explains the results, with result cards, action buttons and follow-ups; Ask AI buttons; a Hotel tab briefing; an AI executive summary in the report; Suggest with AI for bill columns (headers only); a portfolio chat. Every number is checked against the engine's results | Built (Phase 15); tested with mocks, the live model to be checked after redeploying the function |
| Investment results (summary, before/after, upgrade breakdown, savings contribution, plain-language reading) and the downloadable PDF investment report with preview, for AI plans, custom plans and the portfolio (`docs/18`) | Built (Phase 14B) |
| Calculation transparency: "How was this calculated?" on major figures, data labels, financial assumptions (`docs/21`) | Built |
| Onboarding tour (19 steps, one story: portfolio, map, ranking, one budget across the chain, then the top-priority hotel: data, insights, zones, time-lapse, equipment, what-ifs, stress tests, optimizer, 10-year payoff, build your own, PDF report, advisor; live figures; first visit and replay; `docs/16`) | Built |
| Add my hotel (saved in the browser, on the map, its own twin) | Built |
| Opportunities & alerts (3–5 insights from the engine with working actions), simulation impact summary, clearer stress results (kind, one-off vs yearly, carbon, %, chart) | Built (Phase 14A; rules in `docs/13` §14) |
| Organizations, brands, regions, ownership; switcher, filters, totals by group | Built (two synthetic organizations, Chicago only) |
| Utility data: Utility Data Manager (editable sample, Excel/CSV upload, template), validation, calibration to bills (ASHRAE Guideline 14 metrics), choice of baseline; `docs/19` | Built (browser storage; not weather-normalized) |
| Demo hardening (cached answers, reset, rehearsals) | Next (Phase 8): calibration first round is done |

## Tech stack
- TanStack Start (React, TypeScript, Vite), Tailwind, shadcn/ui, built to a Cloudflare Worker target
- State: `zustand`
- Charts: `recharts`
- 3D: `three`, `@react-three/fiber`, `@react-three/drei` (procedural geometry, no model files; lazy-loaded)
- Tests: `vitest`
- Backend: Lovable Cloud (Supabase) edge function for the AI advisor only; key in Lovable Cloud secrets

## Architecture

```
UI panels ──writes──▶ zustand store ◀──reads── digital twin: 2D (src/twin) and 3D (src/three)
                          │
                          ▼
              src/engine/hotel (pure functions, runs in the browser)
                          │ reads
                          ▼
              src/data/hotel/*.json (sourced, labeled synthetic until verified)

store results ──▶ supabase/functions/advisor ──▶ LLM (explanation only) ──▶ validated in the browser
```

Full detail: [docs/12_BACKEND_ARCHITECTURE.md](docs/12_BACKEND_ARCHITECTURE.md).

## Project layout

| Path | Purpose |
| --- | --- |
| `src/components/`, `src/routes/` | UI (Lovable) |
| `src/store/` | Shared state contract |
| `src/engine/hotel/` | Pure TypeScript calculations (the engine) |
| `src/data/` | Sourced JSON data |
| `src/twin/` | Clickable hotel twin (2D layers, controls, the 3D wrapper) |
| `src/three/` | 3D hotel scene (building, scenery, street, people, camera) |
| `src/plans/` | Investment modes: AI recommended, Build your own (catalog), Compare |
| `src/portfolio/` | Hotel portfolio page: city map, totals, comparison, charts, portfolio optimizer, priority explanation |
| `src/advisor/` | The AI assistant's UI: result cards, actions, follow-ups, Ask AI buttons, the portfolio chat, the briefing (`docs/23`) |
| `src/app/` | The homepage (portfolio), the hotel dashboard (`/hotel`) and the landing rules |
| `src/tour/` | First-visit onboarding tour |
| `src/insights/` | Opportunities & alerts cards (rules in `src/engine/hotel/insights.ts`) |
| `src/scenario/` | Simulation impact summary |
| `supabase/functions/` | Backend function: the AI advisor |
| `docs/` | Specs and plans |

## Development

You need Node.js and npm.

```sh
npm install
npm run dev     # local dev server
npm run build   # must pass before every commit
npx vitest run  # tests
```

## Docs
- [Idea overview](docs/00_IDEA.md), [hotel pivot brief](docs/10_HOTEL_SPEC.md) and [detailed task list](docs/11_HOTEL_TASKS.md)
- [Backend architecture](docs/12_BACKEND_ARCHITECTURE.md) and [hotel engine spec](docs/13_HOTEL_ENGINE_SPEC.md) (equations, assumptions, demo figures)
- [Data status and to-do](docs/08_DATA_TODO.md), the [research log](docs/14_RESEARCH_LOG.md) (every sourced value, before and after) and the
  [product decisions](docs/15_PRODUCT_DECISIONS.md) (choices, not facts: discount rate, optimizer rules, HVAC types, solar sizes, emissions, incentives)
- [Claude Code prompts](docs/05_CLAUDE_CODE_PROMPTS.md), [Lovable prompts](docs/06_LOVABLE_PROMPTS.md), [demo checklist](docs/07_DEMO_CHECKLIST.md)
- [Data and research to-do](docs/08_DATA_TODO.md) and [setup](docs/01_SETUP.md)
- [3D twin spec](docs/04_3D_SPEC.md) (what drives each visual)
- [Onboarding tour](docs/16_ONBOARDING_TOUR.md) (every tutorial step and how the tour behaves)
- [Portfolio map design](docs/17_PORTFOLIO_MAP_DESIGN.md) (the homepage map: palette, markers, overlaps, multi-city, list, legend, mobile)
- [Investment results and PDF report](docs/18_INVESTMENT_REPORT.md) (every figure, where it comes from, wording rules, the PDF layout)
- [Utility data and calibration](docs/19_UTILITY_DATA.md) (spreadsheet, Excel template, validation, calibration method, baseline choice)
- [Equipment inventory](docs/20_EQUIPMENT_INVENTORY.md) (audit, data model, which edits change the model, current vs proposed)
- [Calculation transparency](docs/21_CALCULATION_TRANSPARENCY.md) ("How was this calculated?", data labels, financial assumptions)

## Working with Lovable

Continue development in the [Lovable editor](https://lovable.dev/projects/8b8ae6ff-81b9-40af-a0ce-6e5e7b40ba7e). Lovable syncs only the `main` branch.
Claude Code works on short feature branches and merges them into `main` with a **regular merge** (never squash or rebase), and never while a
Lovable prompt is running; otherwise Lovable saves its work to a `lovable-sync` branch that then has to be merged. If Lovable shows
"A push to your repository replaced your Lovable work", choose "Keep repository version". Never rename, move or delete this repository.
