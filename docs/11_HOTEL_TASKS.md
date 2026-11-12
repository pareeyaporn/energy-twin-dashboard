# 11 — Hotel pivot: detailed task list

Source brief: [10_HOTEL_SPEC.md](10_HOTEL_SPEC.md). Priorities follow the brief: **P0** must have, **P1** differentiator, **P2** later.
Owner tags: **[CC]** Claude Code, **[LV]** Lovable (UI prompts), **[TEAM]** research or decisions by people.

Approved decisions: new engine in `src/engine/hotel/` alongside the home engine; extend `src/store/useTwin.ts`
backwards compatibly; clickable **2D** twin with the **Tier A** feature set (below; 3D is P2); demo hotel = 100 rooms in Chicago; save the brief and mark
`docs/09` superseded; merge the P5 optimizer branch as is.

**Status (November 2026):** Phases 0–6, 7b and 9 are done; Phase 7 is open only for installed costs (7.6). Phases 10–12 (Flow, Rooms and
Equipment; custom plans; stress tests) are done. Phase 13 P0 and P1 (13.1–13.32) are done; next: Phase 8 (demo hardening, including the portfolio in the demo script) or Phase 13 P2.

Order: Phase 0 → 1 → 2 → 3 are engine and can start now. Phase 7 (data research, TEAM) runs in parallel with all of them.
Phase 4 (UI) needs the store contract from 1.10. Phase 5 needs Phases 1–2. Phase 6 needs 3.

---

## Phase 0 — Alignment and housekeeping
- [x] 0.1 [CC] Save the brief as `docs/10_HOTEL_SPEC.md`
- [x] 0.2 [CC] Mark `docs/09` superseded (later removed, November 2026; in git history)
- [x] 0.3 [CC] Merge the P5 optimizer branch (`engine/optimizer`) as is; it is unused by the hotel product
- [x] 0.4 [CC] Update `CLAUDE.md`: "What we are building" (hotels, operational twin), the demo path (brief section 12), folder table
      (add `src/engine/hotel/` and `src/twin/`), golden rule 8 stays ("the AI never invents numbers")
- [x] 0.5 [CC] Update `README.md` and `docs/00_IDEA.md`: problem, persona (hotel owner or GM), differentiation (existing buildings,
      operations plus investments, not new-build design like Eden)
- [x] 0.8b [CC] Backend architecture doc `docs/12_BACKEND_ARCHITECTURE.md` and README updated for the hotel pivot
- [x] 0.6 [CC] Rewrite `docs/05` (Claude Code prompts) and `docs/06` (Lovable prompts) for the new phases; update `docs/07` demo
      checklist and Q&A (vs Eden, vs ENERGY STAR Portfolio Manager, accuracy, why hotels)
- [x] 0.7 [TEAM] Delete finished branches on GitHub (I cannot delete remote branches); turn on "Automatically delete head branches" — *done (November 2026): 35 merged branches deleted; the Lovable branches and the early, superseded branches are kept*
- [x] 0.8 [TEAM] Allow the network domains needed for research: `epa.gov`, `noaa.gov` (and `nrel.gov`, `energystar.gov` if used) — done (EPA, NOAA, NLR, ENERGY STAR, EIA, IRS, ComEd, Choose Chicago reachable)

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
- [x] 5.11 Lightweight 3D with React Three Fiber — built as **Phase 9** below (3D twin, 9.1–9.27), including the header count-up (9.21).
      The 2D layers were later redesigned in Phase 10 (animated Flow Sankey, Equipment cards, Rooms façade).

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
- [x] 7.2 Lodging end uses (CBECS 2018 Tables E1, E5, national) and benchmarks (CBECS C1 85.7, ENERGY STAR hotel median 63.0 kBtu/ft²). CBECS has no lodging-by-climate table, so a climate-specific split would need NREL ComStock (docs/08, B5)
- [x] 7.3 Chicago monthly weather normals (NOAA 1991–2020, O'Hare)
- [x] 7.4 Hot water: IL-TRM 4.3.2 / ASHRAE, 14 gal per hotel room per day (the default 20 per occupied room is consistent); kitchen share from CBECS; IL-TRM hotel lighting hours (guest 777, common 4,542 h a year) recorded
- [x] 7.5 HVAC efficiency by type: gas 0.80, resistance 1.0, heat pump COP 2.3 (IL-TRM conversion), PTHP added (docs/15); condensing boiler ≥90% (IL-TRM 4.4.10)
- [x] 7.6 Upgrade savings and costs — *done as far as reachable sources allow (November 2026; docs/08 A2): sourced for smart controls, insulation, water heating, sensors, rooftop units, PTAC/PTHP, the boiler part of a central plant and solar; still placeholders (no published full retrofit cost): LED retrofit, energy management, the chiller part, VRF.* Originally: **Savings sourced or calibrated for all; costs sourced** for smart controls ($260/room) and noted for boilers ($22.95/kBtu-h), sensors ($55–125 each), showerheads ($12). **Still placeholders:** LED, sensor, EMS, HVAC (chiller part), water heating and insulation costs per ft² or per room (docs/08 A2)
- [x] 7.7 Rooftop solar: output (PVWatts), O&M, degradation sourced; three sizes; **$/W by size from LBNL 2025 Data Update (2024 national medians), editable**; export credit $0 (labeled fallback, editable) until the tariff is confirmed
- [x] 7.8 Grid emission factor for the demo region: EPA eGRID2023 RFCW (0.4155 kg CO2e/kWh); gas from the EPA Emission Factors Hub 2025
- [x] 7.9 Seasonal occupancy: annual anchor sourced (Chicago CBD 69.2% in 2025, STR via Choose Chicago; used for the 300-room preset); the monthly shape stays synthetic because only annual figures are published, as the task allows
- [x] 7.10 Comfort limits documented as a product decision (docs/15); ASHRAE 55 is a paid standard and was not consulted, so the limits are not presented as ASHRAE values
- [x] 7.11 Compare the demo hotel against an ENERGY STAR Portfolio Manager benchmark: 91.1 vs the hotel median 63.0 kBtu/ft² (and CBECS lodging 85.7); see `docs/14`
- [x] 7.12 Update `docs/08_DATA_TODO.md` to this list (rewritten as the detailed hotel research to-do, with the current placeholder values and sources to use)
- [x] 7.13 **Calibration pass, first round done** (docs/14): sourced data replaced placeholders, smart controls calibrated to the IL-TRM, benchmarks checked, demo results re-run. Remaining cost items continue under 7.6 and 7.7. Original note: Replace the placeholder savings, costs and interaction factors with
      reasonable, sourced values, then check the whole result for realism. Start with the items the demo depends on:
      smart room control savings (setback degrees, per-degree sensitivities, guest-presence curve), the HVAC share of energy, LED and occupancy-sensor savings, the lighting-to-heating/cooling
      interaction, solar cost and size, and the balanced-score weights. Check: demo hotel total against an ENERGY STAR Portfolio Manager benchmark, package savings as a share of the bill
      against published hotel case studies, and that the demo question still has an honest answer. Do not pick numbers to fit the story; change the demo question if the numbers say so.

## Phase 7b — Financial breakdown and research pass 1 (built)
- [x] 7b.1 One financial breakdown for every upgrade and package (gross cost, incentives, net investment, kWh and therms, $ saved, payback, 5- and 10-year net benefit, CO2); one savings stream; optimizer, cards, zone opportunities and advisor read the same numbers
- [x] 7b.2 Solar: location-based output, hour-by-hour self-use and export, regional $/W by size, export credit, degradation and O&M
- [x] 7b.3 Incentives listed per upgrade with sources; none applied until confirmed; user-entered amounts supported
- [x] 7b.4 [LV] LV11 and LV12: the breakdown on every upgrade card, the package cards and the comparison tables; packages first, comparison collapsed below
- [x] 7b.5 Calibrate smart room controls to the IL-TRM 4.4.8 Chicago-hotel range (guest-room fan saving while empty); now $1,715 a year for 100 rooms
- [x] 7b.6 Research pass 2: PVWatts, IL-TRM v14 (GREM, lighting controls, lighting-HVAC interaction, showerheads), eGRID, EPA gas factor, CBECS benchmark. Remaining items are in `docs/08` (A1–A5, B1–B7)
- [x] 7b.7 Small UI fixes: one "some inputs are defaults" note instead of a tag on every number; compact number row on mobile; twin split-view labels (CC) — defaults note and mobile row by LV15; split labels in the 2D twin

## Phase 9 — 3D digital twin with seasons and day–night (CC; decided November 2026)

A new visualization layer on top of the existing engine and store. **No rewrite of the simulation or the optimizer**; every number shown comes
from the engine. Decisions: 3D is the default twin view on desktop (2D on phones, without WebGL, or with "reduce effects"); hourly outdoor
temperature is modeled from NOAA monthly normal highs and lows and labeled "modeled"; solar output shows only for an applied solar package, and
clicking the rooftop-solar zone without one shows a translucent full-roof preview labeled "Not installed — potential".

### 9A. Clock and engine additions (one pull request)
- [x] 9.1 Weather data: add NOAA 1991–2020 monthly normal highs and lows (MLY-TMAX-NORMAL, MLY-TMIN-NORMAL, Chicago O'Hare) to `weather.json`,
      with the source
- [x] 9.2 Engine `outdoorTempF(profile, month, hour)`: a standard daily curve between the month's normal low (around sunrise) and high (mid
      afternoon); pure, tested, labeled modeled
- [x] 9.3 Engine `sunTimes(profile, month)` and `sunElevation(profile, month, hour)`: sunrise, sunset and sun height from the latitude and the
      mid-month declination (the same math as the solar model), so daylight, sky and solar output agree
- [x] 9.4 Engine: `typicalDayProfile` also reports each hour's energy by end use (heating, cooling, ventilation, lighting, hot water, kitchen,
      equipment, other) — additive; the hours still reconcile to the monthly totals
- [x] 9.5 Engine `solarHourKW(...)`: hourly generation of the applied array (size × location yield × month share × daylight shape) and the
      same for a full-roof preview; zero at night
- [x] 9.6 Store selector `selectHourState`: one object for the current month and hour — outdoor temperature, sunrise/sunset, day or night,
      occupancy (booked, present), demand by end use, electricity kW, gas therms/h, cost per hour, solar (installed kW or "none", preview kW) —
      memoized; read-only
- [x] 9.7 One synchronized clock: a new playback mode **"Year + day"** in which each month plays one compressed 24-hour day (about 4 s a
      month at 1×, a year in about 48 s); the existing "Typical day" and "Year" modes stay
- [x] 9.8 Tests for all of the above (temperature at its normal high and low, sunrise later in winter, zero solar at night, end uses summing
      to the hour's total, the clock advancing hour then month)

### 9B. The 3D hotel (one pull request)
- [x] 9.9 `src/three/` scene, lazy-loaded (its code downloads only when 3D is shown), client-only (no server rendering), WebGL detection with
      a fallback to the 2D view and a note
- [x] 9.10 Procedural building from the profile (`layout.ts`): podium with lobby and restaurant, guest floors with one window per room, a
      hallway core, rooftop HVAC unit with a turning fan, hot-water room, ground; windows drawn as one batch
- [x] 9.11 Energy colors from the store: zones colored by cost on the same blue → amber → red scale as 2D; the HVAC unit tinted red when
      heating and blue when cooling, in proportion to that hour's demand
- [x] 9.12 Windows from `selectRooms`: lit when a guest is in, dim when booked and out, dark when vacant; set-back rooms marked
- [x] 9.13 Interaction: orbit (rotate), zoom, click to select guest rooms, lobby, restaurant, hallways, HVAC, hot water or rooftop solar; the
      selection highlights and the existing zone panel shows energy, cost, drivers and opportunities; keyboard alternative via the zone list
- [x] 9.14 Exploded-floors (cutaway) toggle that separates the floors to show the interior
- [x] 9.15 Solar: solid panels at the applied package's size (quarter, half or full roof); otherwise the translucent "Not installed —
      potential" preview when the solar zone is selected
- [x] 9.16 2D / 3D switch in the twin; 3D default on desktop

### 9C. Seasons, day–night and controls (one pull request)
- [x] 9.17 Sky and light from 9.3: daytime sun with soft shadows, warm sunrise and sunset light, dark sky with moonlight at night
- [x] 9.18 Seasons from the month: winter snow on the ground and roof, bare trees and light snowfall; spring and summer green trees; fall orange
      foliage (procedural trees drawn as one batch; snowfall as one particle system)
- [x] 9.19 Live readout beside the scene from `selectHourState`: date and time, outdoor temperature (modeled), occupancy, heating, cooling and
      lighting demand, solar output, cost per hour
- [x] 9.20 Controls: play/pause, month picker, time-of-day slider, speed, camera reset, and season presets ("January night", "April morning",
      "July afternoon", "October evening")
- [x] 9.21 Count-up animation for the twin's header numbers
- [x] 9.22 Performance and accessibility: no auto-rotate, particles or count-up with "reduce effects"; one shadow-casting light; smooth on a
      typical laptop; responsive layout; screen-reader summary of the scene
- [x] 9.23 Verify with screenshots (January night, July afternoon), update `docs/04` (3D spec) and `docs/13`, and record anything visual-only
- [x] 9.24 Camera glide to the selected zone and a short opening fly-in (`cameraViews`), home view and fog scaled for tall hotels
- [x] 9.25 Realistic look by default (materials, facade detail, physical sky, street, cars, streetlights) with an "Energy view" toggle
- [x] 9.26 People: pedestrians on the sidewalk and at the entrance, counted from guests out at the hour (engine), frozen with reduce effects
- [x] 9.27 Peer benchmark in the engine (`benchmarkComparison`, ENERGY STAR and CBECS, sourced); card by LV15
      (scenery) as such

## Phase 10 — Flow, Rooms and Equipment tabs redesign (CC; built November 2026)
- [x] 10.1 Engine (additive): electricity/gas split on every flow link; `energyFlowsAt(result, month, hour)` with the meter's formula, so hourly flows add up to the meter
- [x] 10.2 Flow: own SVG Sankey (same columns): width by Cost or Energy, Annual or This hour; particles along each link (cyan electricity, amber gas); hover highlights the path; click shows energy, cost and share; widths ease on before/after; speed follows playback; "illustrative" label in annual mode; static with reduced motion
- [x] 10.3 Equipment: cards grouped by HVAC, water heating, lighting and other: icon, quantity, capacity, efficiency, schedule, modeled status at the hour, system energy and cost, related opportunities; "modeled, not monitored"
- [x] 10.4 Rooms: floor-by-floor facade with windows lit by state and daylight, set-back sills, transitions; click a room for state, HVAC mode, setpoints and the guest-room average kW (per zone, labeled); same numbering as the 3D windows
- [x] 10.5 Tests (hourly flows sum to the meter, Sankey layout, room and equipment mapping), screenshots, docs

## Phase 11 — Investment catalog and custom plans (CC; built November 2026)
- [x] 11.1 Engine: optional coverage per upgrade and a solar size in kW on the optimizer's own path (`evaluatePackage(..., { amounts })`); omitted = the whole hotel, as before (tested equal)
- [x] 11.2 Data: catalog category and `costStatus` per upgrade (only smart room controls' cost is sourced); not-yet-modeled upgrades listed as experimental, with no figures
- [x] 11.3 `upgradeCatalog`, `evaluatePlan` (plan checks: budget, conflicts, unavailable, clamped quantities, overlaps), `planFromPackage`, `explainPlan`
- [x] 11.4 Store: `customPlans` with create, duplicate, rename, delete, add, remove, quantity and "Customize AI plan"; kept in local storage; selectors for the catalog, plan evaluation and why-this-plan
- [x] 11.5 UI (`src/plans`): AI recommended (with "Why this plan" and "Customize AI plan"), Build your own (catalog by HVAC & Controls, Lighting, Renewable Energy, Building & Water; quantity controls; live totals with gross, verified incentives and net separately; budget bar; notes), Compare (AI plan vs up to three custom plans)
- [x] 11.6 Tests: a plan copied from any package equals the package; quantities scale cost and savings; combinations recomputed, not summed; store and UI tests

## Phase 12 — Stress tests (CC; built November 2026)
- [x] 12.1 Eight tests in Weather (heat wave, cold snap, low solar production), Operations (conference surge, low occupancy, HVAC efficiency decline) and Financial (electricity +20%, natural gas +20%); each states what changes, by how much and for how long
- [x] 12.2 Engine: `hvacEnergyChangePct` and `solarOutputChangePct` scenario inputs (new "HVAC equipment condition" driver); `stressTestReport` (normal vs stress, the plan under both with `evaluatePackage`, extra costs avoided, payback and NPV for persistent changes) and `stressRecommendation`
- [x] 12.3 Temporary vs persistent: temporary events do not switch the optimizer or change returns; persistent changes re-measure, keep the user's plan (`planBeforeStress`) for the comparison, and show whether the optimizer's pick changes
- [x] 12.4 Panel in the twin: categories, assumptions table, normal vs stress, plan picker (selected, any AI package, any custom plan), reset to baseline; tests

## Phase 13 — City map and hotel portfolio (CC; decided November 2026)

Goal: from one hotel to a **portfolio of hotels** in one place: see them on a Chicago map, compare them, open any one in the existing
digital twin, and decide where a shared investment budget does the most good. The single-hotel experience is reused, not rebuilt.
Decisions (user): extend the store (additive); MapLibre with free tiles and an offline fallback; Claude Code adds the route and nav link;
build P0 and the portfolio optimizer first.

**P0 at a glance** (must have; built first, together with the portfolio optimizer 13.8–13.12):
- 13.1–13.4 five synthetic Chicago properties (`properties.json`), types, labels, documented assumptions
- 13.5–13.7 portfolio aggregation in the engine (totals, savings potential, investment required, priority score) and its tests
- 13.13–13.17 store: active property, `openProperty`, save and restore per property, custom plans per property, selectors, tests
- 13.18–13.21 MapLibre city map with markers, hover cards, color-by metric, legend, offline fallback, accessibility (redesigned in 13.39–13.48, docs/17)
- 13.22–13.28 `/portfolio` page and top-bar link, KPI strip, comparison table, charts, breadcrumb, optimizer panel, tests

P1 later: 13.29–13.32 (custom portfolio plan, AI vs custom, portfolio stress tests). P2: 13.33–13.36 (onboarding, venue types, organizations).

### 13A — Properties and data (P0)
- [x] 13.1 **P0** [CC] `src/data/hotel/properties.json`: one demonstration organization ("Energy Twin Hotels, demonstration portfolio") with five
      synthetic Chicago hotels, each labeled "Demonstration property": Downtown (Loop), Airport (Rosemont, near O'Hare), Lakeside
      (Streeterville), Convention (near McCormick Place), Boutique (River North). Each has its own id, name, neighborhood, latitude and
      longitude, type tag, and full hotel input (rooms, floor area, floors, year built, HVAC type, occupancy, seasonal occupancy, budget).
      Distinct configurations, never a scaled copy; every value is either a documented assumption or a default the profile flags. — *done: built as "Lakefront Hotel Group" (synthetic chain): Lakeshore Inn (Streeterville), Riverwalk Grand (Loop), O'Hare Gateway Hotel (Rosemont), Lakefront Convention Hotel (McCormick Place), Wells Street Hotel (River North)*
- [x] 13.2 **P0** [CC] Two of the five reuse the existing presets' inputs (Boutique = the 100-room demo hotel, Downtown = the 300-room preset), so the
      single-hotel demo numbers stay the same when opened from the portfolio — *done: Lakeshore Inn = the 100-room preset, Riverwalk Grand = the 300-room preset (tested equal)*
- [x] 13.3 **P0** [CC] Types: `PortfolioProperty`, `PortfolioOrganization`; a `buildingType` field ('hotel' now; resort, casino, convention center,
      entertainment venue listed as future, not simulated)
- [x] 13.4 **P0** [CC] Document the property assumptions (docs/13, docs/15); synthetic labels everywhere they are shown

### 13B — Engine: aggregation (P0)
- [x] 13.5 **P0** [CC] `portfolioSummary(properties)`: per property, the existing baseline (`calculateBaselineEnergy`), energy intensity
      (`benchmarkComparison`), and its savings potential and investment from the existing optimizer; portfolio totals (properties, rooms,
      kWh, therms, site energy, cost, CO₂, savings potential). Pure, cached per property
- [x] 13.6 **P0** [CC] Definitions (product decisions, docs/15): **savings potential** = the annual savings of the property's best package with a
      positive 10-year NPV, at the portfolio's per-property cap; **investment required** = that package's net investment; **investment
      priority score** = 10-year NPV per dollar invested, scaled 0–100 across the portfolio — *done: savings potential uses each property's own budget; docs/15 §16*
- [x] 13.7 **P0** [CC] Tests: totals equal the sum of the properties; each property's numbers equal the single-hotel engine's for the same input

### 13C — Engine: portfolio optimizer (P1, built first with P0)
- [x] 13.8 **P1, built with P0** [CC] Candidates per property: every valid upgrade combination (same enumeration, budget, comfort and exclusion rules as the
      single-hotel optimizer), evaluated with the same financial breakdown (gross cost, verified incentives, net investment, savings,
      NPV, CO₂); savings interactions computed inside each hotel, never summed across upgrades
- [x] 13.9 **P1, built with P0** [CC] Allocation: one package (or none) per property under the shared budget: a multiple-choice knapsack solved by dynamic programming
      at $1,000 budget steps, exact for additive objectives (annual savings, 10-year NPV, carbon, balanced score); fastest payback (a ratio)
      solved exactly by iterating the same dynamic program (Dinkelbach); method stated in the results — *done: fastest payback gives every property a package when the budget allows (docs/15 §16)*
- [x] 13.10 **P1, built with P0** [CC] Inputs: total budget (default $500,000), objective (annual savings, 10-year NPV, payback, carbon, balanced), discount rate and
      horizon from the existing settings; the budget is compared with gross cost, as in the single-hotel optimizer (docs/15)
- [x] 13.11 **P1, built with P0** [CC] Results: per property the recommended package, investment, incentives, annual savings; totals: investment, remaining budget,
      annual savings, 5- and 10-year NPV, simple payback, carbon reduction, % of portfolio energy cost; "open this hotel's package"
- [x] 13.12 **P1, built with P0** [CC] Tests: the allocation never exceeds the budget; it matches a brute-force search on a small case; each property's figures equal
      `evaluatePackage` for that package; the $50,000 single-hotel answer is unchanged

### 13D — Store (P0, additive)
- [x] 13.13 **P0** [CC] `portfolio` (organization and properties), `activePropertyId`, `propertyInputs` (each property's current input),
      `portfolioBudget`, `portfolioObjective`, `portfolioPlan`, `portfolioOptimizing`; actions `openProperty(id)`, `runPortfolioOptimizer()`,
      `setPortfolioBudget`, `setPortfolioObjective` — *done: built as `propertyStates` (saved snapshot per property) rather than `propertyInputs`; `selectPortfolioItems` gives each property's current input*
- [x] 13.14 **P0** [CC] `openProperty` loads that property's input into the existing single-hotel state (as the preset switcher does) and saves the
      previous property's input, what-if, stress test and plan, so returning restores them; the existing screens keep working unchanged
- [x] 13.15 **P0** [CC] Custom plans gain an optional `propertyId`; the plan builder shows the active property's plans (existing plans stay visible)
- [x] 13.16 **P0** [CC] Selectors: `selectPortfolioSummary`, `selectPortfolioRows`, `selectActiveProperty`, memoized per property input
- [x] 13.17 **P0** [CC] Tests: switching properties and back restores state; the demo hotel's figures are identical before and after a round trip

### 13E — City map (P0)
- [x] 13.18 **P0** [CC] `maplibre-gl` (lazy-loaded) with a free dark basemap (no API key); attribution shown; an offline SVG fallback of Chicago
      (lakefront, river, major roads) if the tiles cannot load
- [x] 13.19 **P0** [CC] Glowing markers for each property, keyboard focusable; hover or click opens a card: name, rooms, occupancy, annual energy,
      annual cost, energy intensity, savings potential, priority score, "Demonstration property", **Explore digital twin**
- [x] 13.20 **P0** [CC] Color by: energy cost, energy intensity, savings potential, investment priority; legend; a note that larger hotels naturally
      spend more, so cost is not efficiency
- [x] 13.21 **P0** [CC] Respect reduce effects (no pulsing); screen-reader list of the properties as an alternative to the map

### 13F — Portfolio dashboard and navigation (P0)
- [x] 13.22 **P0** [CC, minimal LV edit] Route `/portfolio` (new file, small) and a "Portfolio" link in the top bar (Lovable-owned, minimal edit)
- [x] 13.23 **P0** [CC] KPI strip: properties, rooms, electricity, natural gas, energy cost, CO₂, savings potential, investment budget
- [x] 13.24 **P0** [CC] Comparison table: property, location, rooms, floor area, occupancy, energy cost, energy intensity, potential savings,
      investment required, payback, priority; sortable
- [x] 13.25 **P0** [CC] Charts: energy cost by property, energy intensity (site kBtu/ft², electricity and gas converted to one unit), savings potential,
      electricity vs natural gas
- [x] 13.26 **P0** [CC] Breadcrumb in the twin when a property is open: Portfolio → Chicago → hotel name; "Back to portfolio"
- [x] 13.27 **P0** [CC] Portfolio optimizer panel (13C results) with budget and objective
- [x] 13.28 **P0** [CC] Tests: page renders, sort works, "Explore digital twin" opens the property

### 13G — Custom portfolio plan and comparison (P1)
- [x] 13.29 **P1** [CC] Build a portfolio plan from each property's custom plan; totals across properties; budget used and remaining — *done: "My portfolio" tab: one custom plan (or none) per hotel, default the hotel's latest plan; totals, budget used and left, over-budget warning; "Edit in twin"*
- [x] 13.30 **P1** [CC] "Customize AI plan" copies each property's recommended package into that property's custom plan — *done: one new custom plan per hotel, tagged with the hotel; totals equal the AI portfolio (tested)*
- [x] 13.31 **P1** [CC] AI portfolio vs my portfolio: investment, savings, payback, NPV, carbon, comfort — *done: "Compare" tab, from the same totals function, better values highlighted, plus lowest comfort score and hotels with a package*

### 13H — Portfolio stress tests (P1)
- [x] 13.32 **P1** [CC] Apply a stress test to one property, a selection or all; per property and total: normal vs stressed cost, with the
      recommended plan, cost avoided; temporary vs persistent rules as in Phase 12 — *done: any of the 8 tests on one, some or all hotels, with the AI portfolio, my portfolio or no plans; persistent tests show payback under the change per hotel; the per-hotel recommendation check stays in each twin (two optimizer runs per hotel)*

### 13J — Add my hotel (built November 2026)
- [x] 13.37 **P1** [CC] "Add my hotel" on the Portfolio page: a short form (name, Chicago area, rooms, heating and cooling, optional floors,
      floor area, year built, occupancy, monthly bill, budget; blanks use documented defaults). The hotel is saved in this browser, appears on
      the map and in the comparison (tagged "Your hotel", not synthetic), opens in its own twin, and edits under Edit details are saved; it can
      be removed. Reset demo removes added hotels. Chicago weather only (the model has no other climate).

- [x] 13.38 **P1** [CC] Organizations, brands, regions and ownership types: a second synthetic organization (Northshore Hospitality, four
      Chicago hotels); every hotel has a brand, region (Downtown, North Side, South Side, Airports) and ownership type (owned, managed,
      franchised, leased); an organization switcher and filters on the Portfolio page (map, table, totals, charts, optimizer and stress tests
      follow the filter); totals by brand, region or ownership; Add my hotel asks for brand and ownership and joins the selected organization

### 13K — City map redesign: a hotel-chain command center (built November 2026; design in docs/17)
Display only: no calculation, assumption or data changes. Each task is one point of the design brief.
- [x] 13.39 **P1** [CC] Map styling: dark navy theme, muted roads, quiet labels, a clearly blue Lake Michigan, less noise — *done: Carto
      dark-matter repainted after load by layer rules (`restyleBasemap`): navy land, blue lake, muted roads, POI, road-name and water labels
      hidden, own "Lake Michigan" label; the drawn fallback uses the same palette*
- [x] 13.40 **P1** [CC] Hotel markers: building tiles with a subtle glow, clean borders, hover and selection effects; metric colors and exact
      coordinates kept — *done: `HotelMarker` (32 px tile, metric-colored border and icon, rank chip, glow, scale on hover and selection, ping
      ring when selected, a dot marks the user's own hotels)*
- [x] 13.41 **P1** [CC] Hotel card on click: name, rooms, annual energy cost, energy intensity, savings potential, Explore digital twin — *done:
      four stat tiles (the selected metric's outlined), rank, occupancy, annual energy, priority, the data label; hover now shows a tooltip*
- [x] 13.42 **P1** [CC] Property list: collapsible, ranked by the map's metric; hover highlights the marker, click focuses the map — *done:
      `PropertyList` (rank, color dot, value bar, neighborhood, value); click selects and flies to the hotel*
- [x] 13.43 **P1** [CC] Metric controls as one segmented toolbar (energy cost, energy intensity, savings potential, investment priority) —
      *done: icons, short labels on phones*
- [x] 13.44 **P1** [CC] Legend: metric, value range, units, color gradient — *done: unit in words, lowest / middle / highest values, what a
      high value means; compact on phones*
- [x] 13.45 **P1** [CC] Interactions: smooth selection, fly-to, hover tooltips, every overlapping downtown hotel selectable — *done: fly-to
      padded clear of the card and list, Show all hotels, refit on filter changes, click the map or Escape to close; close markers fan out
      (`spread.ts`, 34 px rule) with a leader line to the true location*
- [x] 13.46 **P1** [CC] Visual hierarchy: the map as the focal point, consistent spacing, rounded corners, restrained shadows, subtle cyan —
      *done: 540 px map with a soft shadow and faint cyan ring, navy glass panels, cyan only for the active and selected states*
- [x] 13.47 **P1** [CC] Responsive desktop and mobile — *done: list over the map on desktop and below it on smaller screens; card over the map
      from 640 px and below it on phones; checked at 1440 × 900 and 390 × 844, street map and drawn map*
- [x] 13.48 **P1** [CC] Preserve functionality: organization switcher, brand / region / ownership filters, portfolio calculations, hotel
      selection, map metrics, navigation — *done: unchanged store and engine; tests updated (hover → tooltip, click → card) and added (ranking,
      list hover and selection, Escape, collapse, spreading)*
- [ ] 13.49 **P2** [CC] Later: marker clustering with counts if a portfolio grows past about 30 hotels (the fan-out suits small groups);
      a pan-and-zoom gesture on the drawn fallback map (today it fits and flies only); keyboard arrow navigation between markers

### 13I — Later (P2)
- [x] 13.33 **P2** [CC] Onboarding tour (new: the app has none yet): welcome, portfolio, map, a hotel's twin, simulations, investments, portfolio
      optimizer, AI vs custom; skip and reopen — *done (November 2026): a guided tour (now 15 steps with live figures, a time-lapse, the energy flow and a 10-year projection chart) for hotel operators in `src/tour/`, first visit and replay from the top bar; steps and behavior in docs/16*
- [x] 13.34 **P2** [CC] Future building types shown as "coming later" cards (resorts, casinos, convention centers, entertainment venues): they need
      their own energy drivers (pools, spas, gaming floors, event spaces) and are not simulated with the hotel model — *done: "More building types (coming later)" cards on the portfolio page, from `properties.json`*
- [ ] 13.35 **P2** [CC] Multiple organizations and brands, regions, ownership types, role-based access; multi-city portfolios; real utility data — *partly done (November 2026): several organizations, brands, regions and ownership types, with an organization switcher, filters and totals by group (below, 13.38). Still later: multi-city portfolios (needs sourced weather, prices and grid data per city), real utility data (bill upload and calibration), role-based access (accounts and a database)*
- [x] 13.36 **P2** [CC] Transitions when switching hotels and metrics; demo script update after the figures are validated (docs/07) — *transitions done (marker colors fade between metrics; the twin's figures count up when a hotel opens); the demo script is the storyline owner's (docs/07)*

Known limits: all five hotels share Chicago weather (O'Hare normals); property types differ through size, age, HVAC and occupancy only (the
model has no ballroom, pool or 24/7 food-service drivers); heat-pump water heaters are not modeled, so the optimizer cannot pick them.

## Phase 8 — Demo hardening (all)
- [x] 8.1 Make the **6–7 minute** path in `docs/07` deterministic (was three minutes, brief section 12): synthetic 100-room hotel, zone view, occupancy 60% to 85%, smart room controls on,
      $50,000 budget, an advisor question **chosen after calibration from what the results actually show**, closing before/after with carbon — *done (November 2026): docs/07 brought up to date (10 packages fit at $50,000 on the scenario, not 14; the 300-room package and baseline; the act-6 question "Why not solar, and what should I do with $50,000?"; an optional portfolio line), with Reset demo and the tour noted before each run. The storyline owner may still reword it; keep the bold figures*
- [x] 8.2 Cache the advisor answers for the demo; no console errors; no layout shift — *done (November 2026): validated AI answers are saved in local storage (`src/store/advisorAnswers.ts`, key `energy-twin:advisor-answers:v1`) and replayed at once, re-checked against the results; Reset demo keeps them. The template answer to the act-6 question now also explains why solar is left out. Remaining for the team: ask the act-6 question once in the rehearsal on the demo laptop (8.3)*
- [ ] 8.3 Rehearse five times in a row without a failure; record the backup video (30–45 s); test the real projector resolution
- [ ] 8.4 [TEAM] Slides: tagline "Simulate smarter. Spend better. Save energy.", the three pillars, roadmap (P2 items), and Q&A owners
- [x] 8.5 Claims check: nothing says engineering-grade accuracy, verified carbon savings, guaranteed returns or real-time monitoring — *done (November 2026): every screen checked; "Verified incentives" became "Utility incentives (published rates)", the stale "most costs are placeholders" note now names the remaining placeholders, "AI recommended" says the optimizer picks and the advisor only explains, and the "Synthetic demo data" badge now shows for every portfolio hotel (minimal edits in Overview, ScenarioSimulator, BudgetOptimizer, AdvisorPanel)*
- [x] 8.7 "Reset demo" control: restores the 100-room preset, baseline, July 3 PM, 3D home view and clears the advisor — *done: "Reset demo" in the top bar (`resetDemo()`) restores the starting state (100-room preset, no what-if or stress test, no plans, twin controls at their start: July, 12:00), the 3D home view, the portfolio, and clears the advisor and the custom plans saved in this browser; the time is the app's start time rather than 3 PM, so the storyline can set it*
- [x] 8.8 Re-run the demo figures from the engine before each rehearsal and update the script in `docs/07` — *done (November 2026): `src/test/demoScript.test.ts` walks the demo path through the store and fails when a bold figure in docs/07 no longer matches; `DEMO_FIGURES=1 npx vitest run src/test/demoScript.test.ts` prints them*
- [x] 8.6 Remove or hide leftover home-only code paths from the demo (home UI removed in LV9; home engine, data, unused home components and specs removed November 2026, verified with an import graph); decide whether to delete the home engine and data after the demo

## Definition of done (per task)
`npm run build` and `npx vitest run` pass; the demo path still works; committed and pushed; numbers come only from the engine.
