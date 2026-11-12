# 11 — Hotel pivot: detailed task list

Source brief: [10_HOTEL_SPEC.md](10_HOTEL_SPEC.md). Priorities follow the brief: **P0** must have, **P1** differentiator, **P2** later.
Owner tags: **[CC]** Claude Code, **[LV]** Lovable (UI prompts), **[TEAM]** research or decisions by people.

Approved decisions: new engine in `src/engine/hotel/` alongside the home engine; extend `src/store/useTwin.ts`
backwards compatibly; clickable **2D** twin with the **Tier A** feature set (below; 3D is P2); demo hotel = 100 rooms in Chicago; save the brief and mark
`docs/09` superseded; merge the P5 optimizer branch as is.

Order: Phase 0 → 1 → 2 → 3 are engine and can start now. Phase 7 (data research, TEAM) runs in parallel with all of them.
Phase 4 (UI) needs the store contract from 1.10. Phase 5 needs Phases 1–2. Phase 6 needs 3.

---

## Phase 0 — Alignment and housekeeping
- [x] 0.1 [CC] Save the brief as `docs/10_HOTEL_SPEC.md`
- [x] 0.2 [CC] Mark `docs/09` superseded
- [x] 0.3 [CC] Merge the P5 optimizer branch (`engine/optimizer`) as is; it is unused by the hotel product
- [x] 0.4 [CC] Update `CLAUDE.md`: "What we are building" (hotels, operational twin), the demo path (brief section 12), folder table
      (add `src/engine/hotel/` and `src/twin/`), golden rule 8 stays ("the AI never invents numbers")
- [x] 0.5 [CC] Update `README.md` and `docs/00_IDEA.md`: problem, persona (hotel owner or GM), differentiation (existing buildings,
      operations plus investments, not new-build design like Eden)
- [x] 0.8b [CC] Backend architecture doc `docs/12_BACKEND_ARCHITECTURE.md` and README updated for the hotel pivot
- [x] 0.6 [CC] Rewrite `docs/05` (Claude Code prompts) and `docs/06` (Lovable prompts) for the new phases; update `docs/07` demo
      checklist and Q&A (vs Eden, vs ENERGY STAR Portfolio Manager, accuracy, why hotels)
- [ ] 0.7 [TEAM] Delete finished branches on GitHub (I cannot delete remote branches); turn on "Automatically delete head branches"
- [ ] 0.8 [TEAM] Allow the network domains needed for research: `epa.gov`, `noaa.gov` (and `nrel.gov`, `energystar.gov` if used)

## Phase 1 — Hotel data model and baseline simulation (P0) [CC]
- [x] 1.1 Engine spec `docs/13_HOTEL_ENGINE_SPEC.md`: units, equations, load categories, zones, assumptions, what is *not* modeled
- [x] 1.2 `src/engine/hotel/types.ts`
  - `HotelProfile`: name, city/state/country, rooms, floor area, floors, year built, operating hours (default 24/7), HVAC type
    (PTAC, VRF, central plant, RTU), monthly bill, electricity rate, average occupancy, seasonal occupancy, occupied hours per room,
    guest-room setpoints (occupied and vacant), common-area HVAC schedule, lighting schedule, hot-water use, budget, horizon, objective
  - Zones: guest rooms, lobby and common areas, kitchen and restaurant, hallways and shared, central HVAC and mechanical, hot water
  - Load categories: base, occupancy-dependent, weather-dependent, schedule-dependent
  - Every defaulted input carries `source` and `estimated: true` (use the existing `Sourced<T>` pattern)
- [x] 1.3 Defaults and data files in `src/data/hotel/` (all `verified: false` and labeled synthetic until Phase 7 fills them):
      energy intensity and end-use split for lodging, hot water per occupied room, lighting power and hours, kitchen share,
      equipment efficiency by HVAC type, monthly weather normals per demo city, seasonal occupancy curve, commercial rates by state,
      grid emission factors, schedules
- [x] 1.4 `calculateBaselineEnergy()`: monthly and annual kWh and therms by zone × category, cost, and carbon
  - Base loads fixed (elevators, pumps, standby, corridor lighting); occupancy loads scale with occupied rooms
    but **not linearly** (a base share plus a variable share); weather loads from monthly degree-day style factors; schedule loads from hours
  - Calibrate to the entered bill when given (bounded scale factor, flagged `estimated`); otherwise use benchmarks
- [x] 1.5 `simulateOccupancyChange()`; `simulateHVACSettings()` (occupied and vacant setpoints, vacant-room setback);
      `simulateEnergyScenario()` combining occupancy, setpoints, schedules, rate change % and weather offset
- [x] 1.6 "Why did it change" drivers: a deterministic list of reasons with their kWh and $ (feeds the UI panel and the advisor)
- [x] 1.7 Demo preset: a synthetic 100-room hotel in Chicago (the optional second preset is not built)
- [x] 1.8 Tests: occupancy raises energy but sublinearly; base load unchanged by occupancy; zones sum to total; months sum to year;
      a +20% rate raises the energy cost by 20%; setback saves only when rooms are vacant; cooling peaks in summer and heating in winter;
      calibration hits the bill; determinism and purity
- [x] 1.9 `src/engine/hotel/index.ts` exports; add to `src/engine/index.ts`
- [x] 1.10 Store contract proposal (approved; see `docs/13`, Appendix A) (types only) for Phase 4, shown to you for approval before editing `src/store/`. Include the twin UI state:
      active layer, time mode (day or year), time index, playing, playback speed, before/after compare, active stress test
- [x] 1.11 Twin data functions (Tier A). Pure, deterministic (no randomness, no `Date.now()`; time is passed in by the UI):
  - `typicalDayProfile(profile, month)`: hourly electric kW and gas therm/h by zone and category for a typical day, built from the schedules,
    guest arrival and departure curves and the base loads; the profiles reconcile to the monthly totals from 1.4
  - `roomOccupancyPattern(profile, scenario, hour)`: room-by-room occupied, vacant or vacant-with-setback state for all rooms, with a
    deterministic pattern (from room index, occupancy fraction and hour); the occupied count equals round(occupancy × rooms)
  - `equipmentInventory(profile)`: major equipment per zone (for example guest-room units, central plant, water heaters, kitchen hoods, lighting)
    with rated load, schedule and efficiency, each flagged estimated
  - `energyFlows(baseline)`: nodes and links from grid and gas, through the zones, to end uses, in kWh, therms and dollars, for the flow diagram
  - `simulatedMeter(profile, month, hour)`: kW and $/h from the typical-day profile, always labeled simulated
  - Stress-test presets as scenario deltas: heat wave, cold snap, conference week (occupancy spike), +20% electricity price
- [x] 1.12 Tests for 1.11: the typical day reconciles to the monthly totals; the energy flows conserve energy and cost; the room map's occupied count
      matches the scenario; the same inputs always give the same room map; vacant-room setback shows only when rooms are vacant;
      stress tests move energy and cost in the expected direction

## Phase 2 — Upgrades, costs and financial metrics (P0) [CC]
- [x] 2.1 Upgrade catalog `src/data/hotel/upgrades.json` (8 upgrades, each with cost model, affected zone and category, savings
      parameters low/mid/high, lifetime, comfort impact, source):
      smart guest-room thermostats and occupancy controls, HVAC equipment upgrade, LED lighting, occupancy sensors (common areas and
      hallways), water-heating upgrade (for example heat-pump water heater), insulation (roof or envelope), rooftop solar,
      energy management controls
- [x] 2.2 `calculateUpgradeSavings()` with fixed order and interactions: envelope → lighting (reduces cooling load, adds heating) →
      controls (with an overlap factor between thermostats and the energy management system) → HVAC equipment sized from the reduced load →
      water heating → rooftop solar last (offsets remaining electricity, capped by roof area)
- [x] 2.3 Dependencies and exclusions (for example the energy management system builds on thermostats; two HVAC options are mutually exclusive)
- [x] 2.4 Cost models per room, per square foot, per kW, per fixture and per ton, with low, mid and high; incentives 0 by default
- [x] 2.5 `calculateFinancialMetrics()` reusing `finance.ts`: payback, five-year net benefit (horizon parameter), NPV, ROI,
      emissions avoided, remaining budget
- [x] 2.6 Comfort model: per-upgrade and per-scenario flags (for example setback range, common-area schedules that cut conditioning
      while guests are present) plus a comfort margin the optimizer can constrain on
- [x] 2.7 Savings ranges (low, mid, high) for every upgrade and package
- [x] 2.8 Tests: order independence; no double counting (package savings < sum of standalone); LED lowers cooling savings overlap;
      solar capped and applied last; costs; ranges ordered; comfort flags

## Phase 3 — Budget-constrained optimizer (P0) [CC]
- [x] 3.1 `optimizeInvestmentPortfolio()`: enumerate all subsets (2^8 = 256), filter by budget, dependencies, exclusions and the comfort constraint
- [x] 3.2 Return at least three distinct packages: maximum savings, fastest payback, and balanced (a documented weighted score of
      financial return, carbon and comfort); if one package wins twice, take the next best so the three differ. Also support the
      profile's other objectives (highest ROI, maximum carbon)
- [x] 3.3 Per package: total cost, annual savings (with range), five-year net savings, payback, carbon impact, remaining budget,
      comfort notes, line items with marginal savings, a rule-based reason
- [x] 3.4 Tests: never exceeds budget; interaction-aware; deterministic; three distinct packages; each objective ranks correctly;
      a small budget returns a clear empty result; the 100-room, $50,000 case as a snapshot; fast enough to run in the browser
- [x] 3.5 Print the demo hotel's three packages and sanity-check realism (plausible percent of the bill, no upgrade that does nothing,
      no payback that is absurd); report anything unrealistic before moving on
- [x] 3.6 Template explanation for the optimizer (adapt `explain.ts`), used as the AI fallback

## Phase 4 — Store, dashboard and scenario simulator (P0) [CC store, LV UI]
- [x] 4.1 [CC] Extend `useTwin.ts` backwards compatibly (with your approval of the diff): `hotel` profile, `scenario` (occupancy,
      setpoints, schedules, rate change %), `baseline`, `scenarioResult`, three packages, `selectedZone`, saved scenarios,
      advisor messages. Add selectors and extend the store tests
- [x] 4.2 [CC] Write the Lovable prompts (revised `docs/06`): Overview, Hotel profile form (building, operations and financial sections,
      all optional, defaults shown as "default (estimate)"), Scenario simulator, Budget optimizer, AI advisor, B2B SaaS styling
- [x] 4.3 [LV] Overview (LV3): annual consumption and cost, breakdown by category, estimated emissions, top opportunities
- [x] 4.4 [LV] Scenario simulator (LV4): occupancy, guest-room setpoint, vacant-room setback toggle, common-area schedule, electricity
      price change, with before/after charts (Recharts) and metric tiles (energy, cost, carbon)
- [x] 4.5 [LV] Budget optimizer tab (LV5): budget and objective inputs, the three ranked package cards, a comparison table, remaining budget
- [x] 4.6 [LV] "Why this changed" panel from the engine drivers; saved scenarios (P1; LV4, LV7). Saved scenarios last for the browser session; local storage not added
- [x] 4.7 [LV] Banner and disclaimers (LV9): "Estimates from synthetic and public data, not an engineering audit"
- [x] 4.8 [CC] Review the Lovable output (each LV prompt reviewed), remove leftover residential copy ("Maya", "home", "attic"), check the build and the demo path

## Phase 5a — Engine support for the twin (built)
- [x] 5a.1 `opportunitiesByZone`: upgrades that help each zone, with zone savings, cost, payback and comfort impact (store: `selectOpportunities`)
- [x] 5a.2 Optimizing under a scenario: `optimizeInvestmentPortfolio(..., { scenario })`, `prepareScenarioContext`, store `optimizeOnScenario`
- [x] 5a.3 Setback recovery energy (placeholder parameters, research task in `docs/08`)

## Phase 5 — Interactive digital twin, 2D, Tier A (P1) [CC component, LV places it]
Needs Phases 1–2. In scope (**Tier A**): room grid, zone heat-map, equipment layer, time scrubber, simulated live meter, energy flow diagram,
ghost upgrades, stress-test events. Out of scope for now: fault injection and anomaly detection, an operational playbook optimizer,
a bill-calibration view, a 12-month forecast band, 3D, and live IoT.
- [x] 5.1 New folder `src/twin/` (Claude Code owned; add it to the CLAUDE.md folder table). `<HotelTwin />` is a layered SVG diagram; it reads everything
      from the store and does no math; Lovable only places it
- [x] 5.2 Layer switcher: **Zones** (heat-map by energy intensity or cost share), **Rooms**, **Equipment** and **Flow**, plus a before/after toggle and animated numbers
- [x] 5.3 Room grid: all rooms by floor, showing occupied, vacant and vacant-with-setback; follows the occupancy scenario and the time scrubber
- [x] 5.4 Equipment layer and zone panel on click: energy, cost share, equipment list with load, schedule and efficiency, and improvement opportunities
      (all from the engine)
- [x] 5.5 Time scrubber: play, pause and scrub a typical day (24 hours) and the year (12 months), with speed control; colors, room states and numbers follow time
- [x] 5.6 Simulated live meter: a ticking kW and cost readout driven by the time scrubber, always labeled "simulated"
- [x] 5.7 Energy flow diagram: Sankey from grid and gas through the zones to end uses, with cost on each flow (Recharts)
- [x] 5.8 Ghost upgrades: applying a package shows it on the twin (solar on the roof, LED glow, thermostat icons) with a before/after split view
- [x] 5.9 Stress-test buttons (heat wave, cold snap, conference week, +20% price): trigger a scenario and show the twin reacting
- [x] 5.10 Respect `reduceEffects`; keyboard and screen-reader support; component tests for layer switching, zone selection and the time scrubber through the store
- [ ] 5.11 P2, only if time: lightweight 3D with React Three Fiber
      (Built: layered diagram, time scrubber, meter, flow, ghost upgrades, stress tests. Not built: count-up animation of the header numbers; colors fade but numbers do not animate.)

## Phase 6 — AI advisor (P1) [CC]
- [x] 6.1 Design note (see [12_BACKEND_ARCHITECTURE.md](12_BACKEND_ARCHITECTURE.md)): the model receives a precomputed context (baseline by zone, current scenario, three packages, and a few precomputed
      comparisons such as solar-first vs thermostats-first); it explains, it never calculates. Tool-calling is a later upgrade
- [x] 6.2 `supabase/functions/advisor/index.ts` (Deno): input question plus context, 6 s timeout, returns `{ text }`
- [x] 6.3 Guardrail (runs in the browser, shared engine code): every number in the answer must appear in the context; if not, discard it and use the fallback
- [x] 6.4 Fallback: deterministic template answers for the demo questions (why HVAC is costly, how occupancy changes energy, solar or
      thermostats first, how to use a $30,000 budget), cached for the demo
- [x] 6.5 [TEAM] Add the secret `ANTHROPIC_API_KEY` in Lovable Cloud (done; answers in about 3 s). **Still to do:** set `ALLOWED_ORIGINS` and a spending limit. See `docs/12`, section 6
- [x] 6.6 [LV] Chat panel (LV8) with suggested questions, a loading state and the timeout fallback
- [x] 6.7 Tests: context builder, number-validator, fallback selection

## Phase 7 — Data research (TEAM, runs in parallel)
Replace synthetic values in `src/data/hotel/` with sourced ones; set `verified: true` and name the exact table.
- [x] 7.1 Commercial electricity and gas prices for the demo state (EIA commercial price tables); price growth from EIA AEO2026
- [ ] 7.2 Lodging energy use and end uses by climate (EIA CBECS), plus an energy intensity benchmark (ENERGY STAR). **Partly:** national lodging end-use split and fuel mix from CBECS 2018 Tables E1 and E5; climate split and EUI benchmark still to do
- [ ] 7.3 Chicago monthly weather normals (NOAA)
- [ ] 7.4 Hot water per occupied room, lighting power and hours, kitchen share (ASHRAE or ENERGY STAR guidance)
- [ ] 7.5 HVAC efficiency by type (PTAC, VRF, central plant, RTU)
- [ ] 7.6 Upgrade savings and costs for all eight upgrades (NREL ComStock, ENERGY STAR hotel guidance, DOE Better Buildings case studies). **Pass 1 done** from search excerpts (see `docs/08`); most costs still placeholders; confirm in the IL-TRM once `icc.illinois.gov` is allowed
- [ ] 7.7 Rooftop solar cost per kW and production (PVWatts, now at `developer.nlr.gov`). **Partly:** O&M and degradation sourced; $/W, output and export credit still to do
- [ ] 7.8 Grid emission factor for the demo region (EPA eGRID). **Partly:** EIA Illinois generation rate (510 lbs CO2/MWh) in use; eGRID subregion still to check
- [ ] 7.9 Seasonal occupancy pattern (a synthetic curve is acceptable, but cite the basis)
- [ ] 7.10 Comfort guidance for setpoints (ASHRAE 55)
- [ ] 7.11 Compare the demo hotel against an ENERGY STAR Portfolio Manager benchmark and note the result for Q&A
- [x] 7.12 Update `docs/08_DATA_TODO.md` to this list (rewritten as the detailed hotel research to-do, with the current placeholder values and sources to use)
- [ ] 7.13 **Calibration pass, after everything is built (decided: do not tune numbers before then).** Replace the placeholder savings, costs and interaction factors with
      reasonable, sourced values, then check the whole result for realism. Start with the items the demo depends on:
      smart room control savings (setback degrees, per-degree sensitivities, guest-presence curve), the HVAC share of energy, LED and occupancy-sensor savings, the lighting-to-heating/cooling
      interaction, solar cost and size, and the balanced-score weights. Check: demo hotel total against an ENERGY STAR Portfolio Manager benchmark, package savings as a share of the bill
      against published hotel case studies, and that the demo question still has an honest answer. Do not pick numbers to fit the story; change the demo question if the numbers say so.

## Phase 7b — Financial breakdown and research pass 1 (built)
- [x] 7b.1 One financial breakdown for every upgrade and package (gross cost, incentives, net investment, kWh and therms, $ saved, payback, 5- and 10-year net benefit, CO2); one savings stream; optimizer, cards, zone opportunities and advisor read the same numbers
- [x] 7b.2 Solar: location-based output, hour-by-hour self-use and export, regional $/W by size, export credit, degradation and O&M
- [x] 7b.3 Incentives listed per upgrade with sources; none applied until confirmed; user-entered amounts supported
- [ ] 7b.4 [LV] LV11: show the breakdown on every upgrade card and in the comparison table
- [ ] 7b.5 Calibrate smart room controls: the model saves about 3% of guest-room HVAC vs 10.8–26.5% measured (DOE/PNNL); check against the IL-TRM per-room figures
- [ ] 7b.6 Research pass 2 once the hosts are allowed (`docs/08`): PVWatts for Chicago, solar $/W (LBNL file), IL-TRM measures, ENERGY STAR benchmark, eGRID
- [ ] 7b.7 Small UI fixes: one "some inputs are defaults" note instead of a tag on every number; compact number row on mobile; twin split-view labels (CC)

## Phase 8 — Demo hardening (all)
- [ ] 8.1 Make the three-minute path deterministic (brief section 12): synthetic 100-room hotel, zone view, occupancy 60% to 85%, smart room controls on,
      $50,000 budget, an advisor question **chosen after calibration from what the results actually show**, closing before/after with carbon
- [ ] 8.2 Cache the advisor answers for the demo; no console errors; no layout shift
- [ ] 8.3 Rehearse five times in a row without a failure; record the backup video (30–45 s); test the real projector resolution
- [ ] 8.4 [TEAM] Slides: tagline "Simulate smarter. Spend better. Save energy.", the three pillars, roadmap (P2 items), and Q&A owners
- [ ] 8.5 Claims check: nothing says engineering-grade accuracy, verified carbon savings, guaranteed returns or real-time monitoring
- [ ] 8.6 Remove or hide leftover home-only code paths from the demo (home UI removed in LV9); decide whether to delete the home engine and data after the demo

## Definition of done (per task)
`npm run build` and `npx vitest run` pass; the demo path still works; committed and pushed; numbers come only from the engine.
