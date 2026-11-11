# 05 — Claude Code prompts, in order

Paste these into Claude Code one at a time, from the repo root. Wait for each to finish, check the result,
then move on. Every prompt ends with build + commit + push so Lovable stays in sync.

Before each prompt: `git pull`.

---

## P0 — Orientation (5 min)

```
Read CLAUDE.md and everything in docs/. Then inspect the repo: package.json (React version, existing deps),
src/ structure, and any existing store in src/store. Summarize:
1) React major version and which @react-three versions we must use,
2) what Lovable already built (components, store shape, mock data),
3) any conflicts between the existing code and docs/02_ENGINE_SPEC.md's store contract.
Don't change anything yet.
```

## P1 — Install packages (10 min)

```
Install the 3D and test packages using the version rule in CLAUDE.md for our React version:
three, @react-three/fiber, @react-three/drei, @react-three/postprocessing, @react-spring/three, zustand (if missing),
and vitest as a dev dependency with an "test": "vitest run" script. Do not upgrade React.
Run npm run build. If it passes, commit "chore: add 3D and test deps" and push to main.
```

## P2 — Data files (20 min)

```
Create src/data/ files exactly as described in docs/03_DATA_SPEC.md: presetHomes.json, rates.json, climateZones.json,
endUseSplits.json, componentLossShares.json, defaults.json, upgrades.json, sources.json.
Keep "verified": false and the PLACEHOLDER notes. If Lovable already created src/data/presetHomes.json or mock files,
merge rather than overwrite, keeping our preset ids.
Build, commit "data: add placeholder data files", push.
```

## P3 — Engine types + baseline (45 min)

```
Implement src/engine/types.ts, constants.ts and baseline.ts following docs/02_ENGINE_SPEC.md sections 1–2.
Load data from src/data via typed imports. Write tests 1, 7 (for baseline only) and 11 from section 8 in
src/engine/__tests__/engine.test.ts. Run npm test and npm run build. Fix until green.
Commit "engine: types and baseline", push.
```

## P4 — Upgrades, costs, finance (60 min)

```
Implement upgrades.ts, costs.ts and finance.ts per docs/02_ENGINE_SPEC.md sections 3–5.
Critical: apply envelope first, then heat pump sizing from the reduced load, then thermostat. Never add percentages.
Add tests 5, 6, 7, 8, 9. Run tests and build until green.
Commit "engine: upgrades, costs, finance", push.
```

## P5 — Optimizer + fallback explanation (45 min)

```
Implement optimizer.ts and explain.ts per sections 6–7, and index.ts re-exports.
Add tests 2, 3, 4, 10. Print Maya's top 3 for budget 15000 and goal best_value in the test output
(names, cost mid, savings low/mid/high, payback, value15, heatPumpTons) so we can sanity-check.
Run tests and build. Commit "engine: optimizer", push.
Then show me Maya's top 3 and tell me if anything looks unrealistic.
```

## P6 — Wire the store (45 min)

```
Extend src/store/useTwin.ts to match docs/02_ENGINE_SPEC.md section 9. Keep existing fields/actions Lovable uses
working (rename nothing they depend on — add aliases if needed). On selectPreset or setHome, recompute baseline
and reset results. runOptimizer computes immediately but keeps optimizing=true for 2000 ms.
applyPackage(id) sets activePackageId, appliedUpgrades, displayedParts and displayedAnnualCost.
Then find every place in src/components that shows mock costs/savings/packages and make the smallest change so they
read from the store instead (tell me each file you touched). Build, commit "store: wire engine", push.
```

## P7 — 3D scene shell (60 min)

```
Following docs/04_3D_SPEC.md, create src/three/Scene.tsx, Environment.tsx, Effects.tsx, CameraRig.tsx and parts/Slab.tsx.
Dark navy radial background, fog, faint grid, floating lawn+soil slab with ContactShadows, warm key light, Bloom +
Vignette (off when reduceEffects). Canvas fills its parent. Export Scene as default.
Then replace the center stage placeholder component with <Scene /> while keeping all HTML overlays on top
(smallest possible edit to the Lovable component; tell me which file). Build, commit "three: scene shell", push.
```

## P8 — Procedural house (90 min)

```
Build the procedural house per docs/04_3D_SPEC.md: dimensions.ts, House.tsx and parts Floor, Walls (front wall
cutaway), Roof (front slope cutaway), Attic, Windows (instanced), Door, Chimney (only yearBuilt < 1950 or > 2 stories),
Furnace, Thermostat. Rounded clay look, palette from the spec. Assembly animation with springy staggered drop-in
when the preset changes. Hover: lift + cyan Outlines + dim others. Click: selectPart and camera glides to frame it.
Build, commit "three: procedural house", push.
```

## P9 — Thermal Vision (60 min)

```
Implement thermal/rampColor.ts and thermal/useThermalMaterial.ts. Each part blends clay ↔ thermal color from
store displayedParts intensity, with emissive scaled for bloom, cross-fading 600 ms when thermalMode toggles.
Add a cool rim light that fades in during Thermal Vision. Add ui/PartCard.tsx (Html glass card) on hover/select
showing heat loss $/yr, recommended upgrade, cost range, savings range and source — all from the store/engine.
Build, commit "three: thermal vision", push.
```

## P10 — Money leaks (60 min)

```
Implement anchors.ts, fx/LeakEmitter.tsx and fx/LeakLabel.tsx. Emitters at roof edges, window frames, door gaps and
rim joist; particle count = clamp(annualCost/8, 6, 120) from displayedParts; particles drift outward/upward and fade,
amber→red, occasional "$" glyph. Html labels "Attic −$610/yr" using real numbers. Only visible in thermalMode.
Respect reduceEffects (÷3 particles). Build, commit "three: money leaks", push.
```

## P11 — Optimizer + upgrade animations + bill drop (2–3 h)

```
Implement the optimizer run and install choreography from docs/04_3D_SPEC.md wow moments 5–7:
- while optimizing: 180° camera orbit, fx/ScanSweep.tsx, ghost upgrade flicker
- on appliedUpgrades change, in order: attic batts fill (scale-X), fx/SealTrace.tsx around windows/door then their
  emitters stop, windows swap with fx/Glint.tsx, furnace sinks and parts/HeatPump.tsx drops in (size from
  outcome.heatPumpTons, spinning fan), thermostat lights up with a pulse ring
- affected parts cool red→blue over 800 ms
Expose a store field installing:boolean so the UI can delay the bill counter until the sequence ends.
Build, commit "three: upgrade choreography", push.
```

## P12 — Robustness (45 min)

```
Add Fallback2D.tsx (SVG house reading the same store) used if WebGL fails, a performance guard that sets
reduceEffects=true if FPS < 40 for 3 seconds, and make sure nothing crashes if baseline/results are null.
Check triangle count and draw calls (log renderer.info once) and report them. Build, commit "three: robustness", push.
```

## P13 — AI explanation backend function (45 min)

```
Create supabase/functions/explain/index.ts (Deno). Input: { home, goal, budget, top } from the engine. It calls the
AI provider configured in Lovable Cloud using a secret (ask me which provider/key name we use), with this instruction:
"Explain in 4–6 plain sentences for a non-expert why package 1 is recommended and what is given up with packages 2
and 3. Use only the numbers provided. Never introduce a new number. Mention one limitation of the estimate."
Return { text }. Timeout 6 s. In the frontend, call it after runOptimizer; on failure or timeout use
templateExplanation(). Cache the result per preset+budget+goal in memory. Build, commit "ai: explain function", push.
```

## P14 — Stretch: rebates + solar (only if P0–P13 are done by hour 30)

```
Add supabase/functions/incentives (Rewiring America API, key from secrets) and supabase/functions/solar (NREL PVWatts v8,
key from secrets). Cache responses for the 3 presets in src/data/cache/*.json and fall back to them on any error.
Rebates reduce package cost in the optimizer; solar becomes an optional 6th upgrade behind a feature flag.
Build, commit, push.
```

## P15 — Demo hardening (hour 34+)

```
Run through docs/07_DEMO_CHECKLIST.md. Make Maya's preset + $15k + best_value fully deterministic, preload/cached
explanation, no console errors, no layout shift. Report anything that could fail on stage.
```

---

## Useful one-liners

- "Pull, then show me what Lovable changed since my last commit."
- "Resolve this merge conflict keeping both Lovable's UI changes and my engine changes. Explain each decision."
- "Run the app and check the console for errors on the demo path."
- "Show Maya's top 3 again with the current data files."
- "This animation stutters — profile it and fix the cheapest cause."
