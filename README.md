# Energy Twin

**See the savings before you spend.**

Energy Twin is a 3D home energy simulator for new homeowners (bought in the last 12 months) with a renovation budget. You enter or pick a home, see in 3D where it loses energy and money ("Thermal Vision"), set a budget, and get the 3 best upgrade packages you can afford. Each package comes with costs, savings ranges, payback and sources.

Built for a 48-hour hackathon in [Lovable](https://lovable.dev), extended with Claude Code, and synced through GitHub.

Full idea overview: [docs/00_IDEA.md](docs/00_IDEA.md).

## Demo path

Maya's preset home (Chicago, 1978, gas) → Thermal Vision → $15k budget → Optimize → upgrades appear on the house → the bill counts down → plan with sources.

## Status

| Area | State |
| --- | --- |
| UI shell (three-panel layout, forms, package cards, plan drawer, sources sheet) | Done (Lovable) |
| Zustand store (`src/store/useTwin.ts`) | Done; optimizer is mocked |
| Data (`src/data/`) | Mock data only (presets, packages, parts) |
| Engine (`src/engine/`) | Not built yet |
| 3D scene and Thermal Vision (`src/three/`) | Not built yet |
| AI explanation (`supabase/functions/`) | Not built yet |

## Tech stack

- React, TypeScript, Vite (TanStack Start), Tailwind, shadcn/ui
- State: `zustand`
- 3D (planned): `three`, `@react-three/fiber`, `@react-three/drei`
- Charts: `recharts`
- Tests: `vitest`
- Backend (planned): Lovable Cloud (Supabase edge functions)

## Architecture

```
UI panels ──writes──▶ zustand store ◀──reads── 3D scene (src/three)
                          │
                          ▼
                 src/engine (pure functions)
                          │ reads
                          ▼
                 src/data/*.json (sourced numbers)
```

- The 3D scene does no math. It reads engine-computed numbers from the store.
- All numbers come from `src/engine`. The AI only explains them and never invents numbers.

## Project layout

| Path | Purpose |
| --- | --- |
| `src/components/`, `src/routes/` | UI (Lovable) |
| `src/store/` | Shared state contract |
| `src/engine/` | Pure TypeScript calculations and optimizer |
| `src/data/` | Sourced JSON data |
| `src/three/` | React Three Fiber scene |
| `supabase/functions/` | Backend functions |
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

- [Setup](docs/01_SETUP.md)
- [Engine spec](docs/02_ENGINE_SPEC.md)
- [Data spec](docs/03_DATA_SPEC.md)
- [3D spec](docs/04_3D_SPEC.md)
- [Claude Code prompts](docs/05_CLAUDE_CODE_PROMPTS.md)
- [Lovable prompts](docs/06_LOVABLE_PROMPTS.md)
- [Demo checklist](docs/07_DEMO_CHECKLIST.md)

## Working with Lovable

Continue development in the [Lovable editor](https://lovable.dev/projects/8b8ae6ff-81b9-40af-a0ce-6e5e7b40ba7e). Lovable syncs only the `main` branch, so push to `main` and your changes sync back. Never rename, move or delete this repository, because that breaks Lovable sync.
