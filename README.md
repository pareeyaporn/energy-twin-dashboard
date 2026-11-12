# Energy Twin

**Simulate smarter. Spend better. Save energy.**

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
- **Budget optimizer:** tests every valid combination (512; solar sizes exclude each other) and returns three packages (maximum savings, fastest payback, balanced) within the budget
  and a comfort limit, measured against the current scenario when one is running. It uses exactly the numbers on the cards.
- **AI advisor:** plain-language answers from Claude, grounded in the computed results. The browser rejects any answer with a number that is
  not in the results and falls back to a template answer; nothing is invented.

## Demo path (6–7 minutes)
Seven acts, scripted with timings in [docs/07](docs/07_DEMO_CHECKLIST.md): the problem → meet the twin in 3D (zones, Energy view, benchmark) →
a living building (January night, July afternoon, energy flow) → test an operating decision (occupancy 60% to 85%, smart room controls) →
spend a $50,000 budget (three packages, 10-year projection, why not solar) → ask the advisor → scale to the 300-room preset and close on
before/after energy, cost and carbon. **The script follows the results**, whichever upgrades perform best (today, with the 85% scenario:
LED lighting plus occupancy sensors, $39,600, about $10,400 a year, payback 3.8 years; on the plain baseline $9,100 a year and 4.4 years).

## Status

| Area | State |
| --- | --- |
| Hotel engine (`src/engine/hotel`): baseline, scenarios, upgrades, common financial breakdown with NPV and a 10-year projection, solar, incentives, optimizer, peer benchmark, twin data and the hourly state (sun, modeled temperature, demand by end use) | Built and tested (338 tests) |
| Data (`src/data/hotel`) | **Sourced from primary documents:** EIA prices, price growth (AEO2026) and hotel end uses (CBECS 2018); EPA eGRID2023 grid factors by location and the EPA gas factor; PVWatts solar output; NOAA weather; IL-TRM hotel measures (smart controls, sensors, lighting interaction, hot water); NLR solar O&M and degradation; Chicago hotel sizes and occupancy (Choose Chicago, STR). **Still placeholders:** most installed costs, solar $/W, the solar export credit, and the monthly occupancy shape. Phase 7 is closed except costs (7.6) and solar $/W (7.7). See `docs/08`, `docs/14`, `docs/15` |
| Store (`src/store`): profile, scenarios, optimizer (scenario-aware), upgrade comparison, twin controls, advisor | Built |
| Digital twin: 2D (`src/twin`) and 3D (`src/three`, Phase 9) | Built |
| Workspace UI (Lovable, prompts LV1–LV14) | Built. **LV15** (benchmark card, calmer Invest tab, phone layout, fewer default tags) is running |
| Flow, Rooms and Equipment tab redesign (animated Sankey, room facade, equipment cards) | Planned next |
| AI advisor (edge function + browser checks + chat panel) | Live on Lovable Cloud with the Claude API (about 3 s an answer; 8 s limit, then a template answer) |
| Demo hardening (cached answers, reset, rehearsals) | Next (Phase 8): calibration first round is done |
| Home-era engine and data | Legacy, unused by the app; home UI components removed |

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
| `src/engine/` | Pure TypeScript calculations (`hotel/` is the active engine; the rest is legacy) |
| `src/data/` | Sourced JSON data |
| `src/twin/` | Clickable hotel twin (2D layers, controls, the 3D wrapper) |
| `src/three/` | 3D hotel scene (building, scenery, street, people, camera) |
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
- Home-era specs, kept as patterns: [engine](docs/02_ENGINE_SPEC.md), [data](docs/03_DATA_SPEC.md); [commercial notes](docs/09_COMMERCIAL_PIVOT.md) are superseded

## Working with Lovable

Continue development in the [Lovable editor](https://lovable.dev/projects/8b8ae6ff-81b9-40af-a0ce-6e5e7b40ba7e). Lovable syncs only the `main` branch.
Claude Code works on short feature branches and merges them into `main` with a **regular merge** (never squash or rebase), and never while a
Lovable prompt is running; otherwise Lovable saves its work to a `lovable-sync` branch that then has to be merged. If Lovable shows
"A push to your repository replaced your Lovable work", choose "Keep repository version". Never rename, move or delete this repository.
