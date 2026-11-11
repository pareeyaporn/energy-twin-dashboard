# CLAUDE.md — Energy Twin

Read this file at the start of every session. It is the source of truth for how we work in this repo.

## What we are building

**Energy Twin** — "See the savings before you spend."
A 3D home energy simulator for **new homeowners** (bought in the last 12 months) with a renovation budget.
They enter (or pick) a home, see in 3D where it loses energy and money ("Thermal Vision"), set a budget,
and get the **3 best upgrade packages** they can afford — with costs, savings ranges, payback, and sources.

Hackathon: 48 hours. Built in **Lovable**, extended with **Claude Code**, synced through **GitHub**.
Demo = one flawless path: Maya's preset home (Chicago, 1978, gas) → Thermal Vision → $15k budget →
Optimize → house upgrades on screen → bill counts down → plan with sources.

Full specs live in `/docs`. Read the relevant spec before working on an area:
- `docs/02_ENGINE_SPEC.md` — calculations, optimizer, tests
- `docs/03_DATA_SPEC.md` — JSON data files and sources
- `docs/04_3D_SPEC.md` — the 3D simulator (the wow)
- `docs/05_CLAUDE_CODE_PROMPTS.md` — the build order

## Golden rules

1. **Lovable syncs only the `main` branch.** Always work on `main`. Never create, switch or push other branches.
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
| `src/engine/` | Claude Code | Pure TypeScript. No React, no network, no AI |
| `src/data/` | Claude Code | JSON only. Every value carries a source |
| `src/three/` | Claude Code | React Three Fiber components. Lovable only places `<Scene />` |
| `supabase/functions/` | Claude Code | Backend functions (AI explain, APIs) |
| `docs/` | Anyone | Specs and plans |

If a task needs a change in a Lovable-owned file, make the **smallest possible** change and say so in the commit message.

## Tech stack

- React + TypeScript + Vite + Tailwind + shadcn/ui (from Lovable)
- State: `zustand` (`src/store/useTwin.ts`)
- 3D: `three`, `@react-three/fiber`, `@react-three/drei`, `@react-three/postprocessing`, `@react-spring/three`
- Charts: `recharts`
- Tests: `vitest`
- Backend: Lovable Cloud (Supabase edge functions, Deno)

**Version rule for 3D packages** — check React's major version in `package.json` first:
- React 18 → `@react-three/fiber@^8`, `@react-three/drei@^9`, `@react-three/postprocessing@^2`, `@react-spring/three@^9`
- React 19 → `@react-three/fiber@^9`, `@react-three/drei@^10`, `@react-three/postprocessing@^3`, `@react-spring/three@^10`
Never upgrade React itself.

## Architecture (data flow)

```
Lovable UI panels ──writes──▶ zustand store ◀──reads── 3D Scene (src/three)
                                   │
                                   ▼
                          src/engine (pure functions)
                                   │ reads
                                   ▼
                          src/data/*.json (sourced numbers)

store.results ──▶ supabase/functions/explain ──▶ AI text (explanation only)
```

- The 3D scene does **no math**. Colors, leak particles, labels and the bill counter all read numbers from the store,
  which the engine computed. If the numbers change, the visuals change.
- Components never hard-code costs or savings. They read from the store.

## Store contract (summary — see docs/02_ENGINE_SPEC.md for full types)

`useTwin` holds: `selectedPresetId`, `home`, `budget`, `goal`, `assumptions`, `thermalMode`, `selectedPart`,
`baseline` (engine output), `results` (top 3 packages), `activePackageId`, `appliedUpgrades`, `drawerOpen`,
`reduceEffects`, and actions `setHome`, `selectPreset`, `runOptimizer`, `applyPackage`, `toggleThermal`, `selectPart`.

Before changing the store, read the existing `src/store/useTwin.ts` (Lovable may have created it) and **extend** it
rather than replacing it.

## Commands

```bash
npm install          # after pulling if package.json changed
npm run dev          # local dev server
npm run build        # must pass before every commit
npx vitest run       # engine tests
```

## Coding conventions

- TypeScript strict. Export types from `src/engine/types.ts`.
- Engine functions are pure and deterministic: same input → same output. No `Date.now()`, no randomness.
- Money in US dollars, rounded only for display. Energy in kWh (electric) and therms (gas).
- Every number shown to users comes with a `source` and, where relevant, a `[low, high]` range.
- 3D components: keep each part in its own file in `src/three/parts/`. Use `useFrame` sparingly. Respect `reduceEffects`.
- Keep the demo path working at all times. If a feature is half-done, hide it behind a flag.

## Definition of done (for any task)

- `npm run build` passes, `npx vitest run` passes
- The demo path still works end to end with Maya's preset
- Committed and pushed to `main`, and the change is visible in Lovable's preview
