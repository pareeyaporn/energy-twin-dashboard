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
net-zero **new-build** home design. We differentiate on **existing** buildings, operations plus investments. The home engine
(P3–P5) is still in the repo and is being replaced by `src/engine/hotel/`.

Hackathon: 48 hours. Built in **Lovable**, extended with **Claude Code**, synced through **GitHub**.
Demo = one flawless 3-minute path: synthetic 100-room hotel (Chicago) → zone-level energy → occupancy 60% to 85% →
smart HVAC controls on → $50,000 budget → three packages → ask the advisor why thermostats over solar →
before/after energy, cost and carbon.

Full specs live in `/docs`. Read the relevant doc before working on an area:
- `docs/10_HOTEL_SPEC.md` — the product brief (what and why, MVP priorities, demo, success criteria)
- `docs/11_HOTEL_TASKS.md` — the detailed task list by phase (P0, P1, P2). **Start here for what to build next.**
- `docs/12_BACKEND_ARCHITECTURE.md` — runtime topology, the AI advisor function, guardrails
- `docs/13_HOTEL_ENGINE_SPEC.md` — equations and assumptions (to be written, task 1.1)
- `docs/08_DATA_TODO.md` — data and research still to find
- Home-era docs, still useful as patterns until rewritten: `docs/02_ENGINE_SPEC.md`, `docs/03_DATA_SPEC.md`,
  `docs/04_3D_SPEC.md`, `docs/05_CLAUDE_CODE_PROMPTS.md`, `docs/06_LOVABLE_PROMPTS.md`; `docs/09` is superseded.

## Honesty rules

- Label outputs as **estimates**. Say when inputs are defaults or synthetic.
- Never claim engineering-grade accuracy, verified carbon savings, guaranteed returns or real-time monitoring unless implemented and validated.
- Synthetic data must be labeled synthetic wherever it is shown.

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
| `src/engine/` | Claude Code | Pure TypeScript. No React, no network, no AI. `hotel/` is the active engine; the home files are legacy |
| `src/data/` | Claude Code | JSON only. Every value carries a source; `hotel/` is the active set |
| `src/twin/` | Claude Code | The clickable 2D hotel diagram (`<HotelTwin />`). Lovable only places it |
| `src/three/` | Claude Code | Optional lightweight 3D (P2). Lovable only places `<Scene />` |
| `supabase/functions/` | Claude Code | Backend functions (AI advisor). Keys are read only here |
| `docs/` | Anyone | Specs and plans |

If a task needs a change in a Lovable-owned file, make the **smallest possible** change and say so in the commit message.

## Tech stack

- React + TypeScript + Vite + Tailwind + shadcn/ui (from Lovable)
- State: `zustand` (`src/store/useTwin.ts`)
- 3D (optional, P2): `three`, `@react-three/fiber`, `@react-three/drei`, `@react-three/postprocessing`, `@react-spring/three` (installed; the P0/P1 twin is 2D SVG)
- Charts: `recharts`
- Tests: `vitest`
- Backend: Lovable Cloud (Supabase edge functions, Deno)

**Version rule for 3D packages** — check React's major version in `package.json` first:
- React 18 → `@react-three/fiber@^8`, `@react-three/drei@^9`, `@react-three/postprocessing@^2`, `@react-spring/three@^9`
- React 19 → `@react-three/fiber@^9`, `@react-three/drei@^10`, `@react-three/postprocessing@^3`, `@react-spring/three@^10`
Never upgrade React itself.

## Architecture (data flow)

```
Lovable UI panels ──writes──▶ zustand store ◀──reads── 2D digital twin (src/twin)
                                   │
                                   ▼
                     src/engine/hotel (pure functions, in the browser)
                                   │ reads
                                   ▼
                     src/data/hotel/*.json (sourced, labeled synthetic until verified)

store results ──▶ supabase/functions/advisor ──▶ AI text (explanation only) ──▶ validated in the browser
```

- The twin does **no math**. Colors, labels and the metric tiles all read numbers from the store, which the engine computed.
  If the numbers change, the visuals change.
- Components never hard-code costs or savings. They read from the store.
- The advisor receives precomputed results; the browser rejects any answer containing a number not in them. See `docs/12`.

## Store contract (summary — see docs/11, task 1.10, for the hotel contract)

Today `useTwin` holds the home-era state: `selectedPresetId`, `home`, `budget`, `goal`, `assumptions`, `thermalMode`,
`selectedPart`, `results`, `activePackageId`, `drawerOpen`, `reduceEffects`, and actions such as `selectPreset`, `runOptimize`.
The hotel product adds `hotel` (profile), `scenario`, `baseline`, `scenarioResult`, three packages, `selectedZone`,
saved scenarios and advisor messages.

Before changing the store, read the existing `src/store/useTwin.ts` (Lovable created it) and **extend** it, backwards
compatibly, rather than replacing it. Show the diff and get the user's OK first.

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
- Twin and 3D components: keep each zone or part in its own file. Respect `reduceEffects`. Support keyboard and screen readers.
- Keep the demo path working at all times. If a feature is half-done, hide it behind a flag.

## Definition of done (for any task)

- `npm run build` passes, `npx vitest run` passes
- The demo path still works end to end with the synthetic 100-room hotel
- Committed and pushed to `main`, and the change is visible in Lovable's preview
