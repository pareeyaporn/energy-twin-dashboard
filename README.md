# Energy Twin

**Simulate smarter. Spend better. Save energy.**

Energy Twin is an AI-powered operational digital twin for **existing commercial buildings, starting with hotels**. It helps owners
and operators see where a building spends energy, test operating decisions before changing anything, and choose the energy
investments that pay back best within a budget.

Built for a 48-hour hackathon in [Lovable](https://lovable.dev), extended with Claude Code, and synced through GitHub.

> **We are mid-pivot.** The project began as a home energy simulator and is moving to hotels. The home engine is still in the repo;
> the hotel product is specified and planned but not built yet. See the status table below.

## What it does (target)
- **Hotel profile:** rooms, floor area, HVAC, bills, occupancy, schedules, budget. Most inputs are optional, with labeled defaults.
- **Interactive twin:** a clickable diagram of six zones (guest rooms, lobby and common areas, kitchen, hallways, central HVAC,
  hot water) showing energy and cost.
- **Scenario simulator:** change occupancy, setpoints, schedules or electricity prices and see before/after energy, cost and carbon.
- **Budget optimizer:** for a budget such as $50,000, three ranked packages (maximum savings, fastest payback, balanced) with cost,
  savings, payback, five-year net benefit, carbon and comfort notes.
- **AI advisor:** plain-language answers grounded in the computed results. The AI never invents numbers.

## Demo path (3 minutes)
Synthetic 100-room hotel → zone-level energy → occupancy 60% to 85% → smart HVAC controls on → $50,000 budget → three packages →
ask the advisor "Why recommend smart thermostats over solar?" → before/after energy, cost and carbon.

## Status

| Area | State |
| --- | --- |
| UI shell (Lovable): panels, package cards, plan drawer, sources sheet | Built, still home-themed |
| Home engine (`src/engine`): baseline, upgrades, costs, finance | Built and merged (will be replaced by the hotel engine) |
| Home optimizer and explanation (P5) | Built on the branch `engine/optimizer`, not merged |
| Home data (`src/data`): EIA rates, RECS 2020 end-use splits | Partly sourced; the rest are placeholders |
| Hotel engine (`src/engine/hotel`) | Planned |
| Dashboard and scenario simulator | Planned |
| 2D digital twin (`src/twin`) | Planned |
| AI advisor (`supabase/functions/advisor`) | Planned |

## Tech stack
- TanStack Start (React, TypeScript, Vite), Tailwind, shadcn/ui, built to a Cloudflare Worker target
- State: `zustand`
- Charts: `recharts`
- Tests: `vitest`
- Backend: Lovable Cloud edge function for the AI advisor only (not set up yet)

## Architecture

```
UI panels ──writes──▶ zustand store ◀──reads── 2D digital twin (src/twin)
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
| `src/engine/` | Pure TypeScript calculations (`hotel/` is the new engine) |
| `src/data/` | Sourced JSON data |
| `src/twin/` | Clickable hotel diagram (planned) |
| `supabase/functions/` | Backend functions (planned: advisor) |
| `docs/` | Specs and plans |

## Development

You need Node.js and npm.

```sh
npm install
npm run dev     # local dev server
npm run build   # must pass before every commit
npm test        # vitest
```

## Docs
- [Hotel pivot brief](docs/10_HOTEL_SPEC.md) and [detailed task list](docs/11_HOTEL_TASKS.md)
- [Backend architecture](docs/12_BACKEND_ARCHITECTURE.md)
- [Data and research to-do](docs/08_DATA_TODO.md)
- [Idea overview](docs/00_IDEA.md), [setup](docs/01_SETUP.md), [demo checklist](docs/07_DEMO_CHECKLIST.md) (still describe the home version until updated)
- Home-era specs: [engine](docs/02_ENGINE_SPEC.md), [data](docs/03_DATA_SPEC.md), [3D](docs/04_3D_SPEC.md),
  [Claude Code prompts](docs/05_CLAUDE_CODE_PROMPTS.md), [Lovable prompts](docs/06_LOVABLE_PROMPTS.md), [commercial notes](docs/09_COMMERCIAL_PIVOT.md) (superseded)

## Working with Lovable

Continue development in the [Lovable editor](https://lovable.dev/projects/8b8ae6ff-81b9-40af-a0ce-6e5e7b40ba7e). Lovable syncs only the `main` branch,
so changes pushed to `main` sync back. Never rename, move or delete this repository, because that breaks Lovable sync.
