# 05 — Claude Code prompts, in order (hotel product)

Paste these into Claude Code one at a time, from the repo root. Wait for each to finish, check the result, then move on.
Every prompt ends with build + tests + commit + push so Lovable stays in sync. Task numbers refer to [11_HOTEL_TASKS.md](11_HOTEL_TASKS.md).

Before each prompt: `git pull`. Read `CLAUDE.md` first. The old home-era prompts (P0–P15) are replaced by this file; their code is still in `src/engine` as legacy.

---

## H0 — Orientation (5 min)

```
Read CLAUDE.md and docs/10_HOTEL_SPEC.md, docs/11_HOTEL_TASKS.md and docs/12_BACKEND_ARCHITECTURE.md. Inspect src/engine (home-era),
src/data, src/store/useTwin.ts and src/components. Summarize: what is reusable, what is residential-specific, and anything in the
repo that conflicts with the docs. Don't change anything yet.
```

## H1 — Engine spec (task 1.1)

```
Write docs/13_HOTEL_ENGINE_SPEC.md: units, the equations for each load category (base, occupancy-dependent, weather-dependent,
schedule-dependent) per zone, how occupancy scales non-linearly, how monthly weather factors work, how the bill calibration works,
the carbon calculation, and what is NOT modeled. Mark every assumption. Show it to me before implementing.
```

## H2 — Hotel types and data (tasks 1.2, 1.3, 1.7)

```
Create src/engine/hotel/types.ts and src/data/hotel/*.json per docs/11 (profile, zones, load categories, defaults, weather normals,
seasonal occupancy, commercial rates, emission factors, equipment efficiency, and the synthetic 100-room Chicago preset).
Every value has "source" and "verified": false, and synthetic values say so. Defaulted inputs are flagged estimated.
Build, run tests, commit "hotel: types and data", push.
```

## H3 — Baseline simulation (tasks 1.4, 1.6, 1.8)

```
Implement calculateBaselineEnergy() in src/engine/hotel following docs/13: monthly and annual kWh and therms by zone and category,
cost and carbon, bill calibration with a bounded factor. Add the "why it changed" driver structure. Write the baseline tests from
task 1.8 (zones sum to total, months sum to year, base load constant, seasonal shape, calibration, determinism).
Build and test until green. Commit "hotel: baseline", push.
```

## H4 — Scenario functions (task 1.5)

```
Implement simulateOccupancyChange(), simulateHVACSettings() and simulateEnergyScenario() (occupancy, occupied and vacant setpoints,
schedules, rate change %, weather offset). Each returns before, after, delta and the drivers explaining the change.
Tests: occupancy raises energy sublinearly, setback saves only when rooms are vacant, +20% rate raises energy cost by 20%.
Print the demo hotel's 60% to 85% occupancy result and the smart-HVAC result so we can sanity-check them. Commit "hotel: scenarios", push.
```

## H5 — Store contract proposal (task 1.10)

```
Propose, but do not apply, the changes to src/store/useTwin.ts for the hotel product: hotel profile, scenario, baseline, scenarioResult,
three packages, selectedZone, saved scenarios, advisor messages, with actions and selectors. Keep every existing field working.
Show me the diff and wait for my OK.
```

## H6 — Upgrades and savings (tasks 2.1 to 2.3, 2.6 to 2.8)

```
Create src/data/hotel/upgrades.json (8 upgrades per docs/11) and implement calculateUpgradeSavings() with the fixed order and
interactions: envelope, lighting (affects cooling and heating), controls (overlap between thermostats and the energy management
system), HVAC equipment sized from the reduced load, water heating, rooftop solar last and capped. Add dependencies, exclusions and the
comfort flags. Never add percentages from different upgrades. Tests per task 2.8. Commit "hotel: upgrades", push.
```

## H7 — Costs and financial metrics (tasks 2.4, 2.5)

```
Implement cost models (per room, per square foot, per kW, per fixture, per ton; low/mid/high) and calculateFinancialMetrics():
payback, five-year net benefit, NPV, ROI, emissions avoided, remaining budget. Reuse src/engine/finance.ts. Add tests, then commit
"hotel: costs and finance", push.
```

## H8 — Optimizer (tasks 3.1 to 3.6)

```
Implement optimizeInvestmentPortfolio() per docs/11 phase 3: enumerate 256 combinations, enforce budget, dependencies, exclusions and the
comfort constraint, and return three distinct packages (maximum savings, fastest payback, balanced). Tests per task 3.4.
Print the demo hotel's three packages for a $50,000 budget (cost, annual savings with range, five-year net, payback, carbon, remaining budget,
comfort notes) and tell me if anything looks unrealistic. Commit "hotel: optimizer", push.
```

## H9 — Store wiring (task 4.1)

```
Apply the approved store changes from H5. Backwards compatible. Extend src/test/useTwin.test.ts. Build, test, commit
"store: hotel state (touches shared file)", push.
```

## H10 — Twin component (tasks 5.1 to 5.5)

```
Create src/twin/HotelTwin.tsx: a clickable SVG diagram of the six zones reading everything from the store. Heat-map by energy intensity
or cost share, before/after toggle, zone panel with energy, cost share, equipment, schedule, assumptions and opportunities, and scenario
feedback (lit windows follow occupancy, vacant rooms dim). Respect reduceEffects; keyboard and screen-reader support. No math in the
component. Add a component test for zone selection. Commit "twin: hotel diagram", push.
```

## H11 — Advisor (tasks 6.1 to 6.7)

```
Per docs/12: build the context builder, the number validator and the deterministic fallback answers in src/engine/hotel/, and
supabase/functions/advisor/index.ts (Deno): input { question, context }, 6 s timeout, returns { text }. Ask me which AI provider and
secret name we use; never put a key in code. Tests: context builder, validator (reject numbers not in the context), fallback selection.
Commit "ai: advisor", push.
```

## H12 — Demo hardening (tasks 8.1 to 8.6)

```
Run through docs/07_DEMO_CHECKLIST.md. Make the three-minute path deterministic with the synthetic 100-room hotel, cache the advisor
answers, check for console errors and layout shift, and check every claim against the honesty rules in CLAUDE.md.
Report anything that could fail on stage.
```

---

## Useful one-liners

- "Pull, then show me what Lovable changed since my last commit."
- "Resolve this merge conflict keeping both Lovable's UI changes and my engine changes. Explain each decision."
- "Run the app and check the console for errors on the demo path."
- "Show the demo hotel's three packages again with the current data files."
- "Does any number on screen not come from the engine? List them."
