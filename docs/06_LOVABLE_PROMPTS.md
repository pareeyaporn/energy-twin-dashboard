# 06 — Lovable prompts, in order (hotel product)

One prompt at a time, after the matching Claude Code step. Add **"Don't modify files in src/engine, src/data, src/twin, src/store or supabase."**
to any prompt that works near them. All numbers come from the store; components never hard-code costs, savings or labels with figures.
Task numbers refer to [11_HOTEL_TASKS.md](11_HOTEL_TASKS.md). The old home-era prompts (L1 to L9) are replaced by this file.

Style for every prompt: polished B2B SaaS look, professional typography, clear financial metrics, intuitive charts (Recharts), responsive controls.

## Store API cheat sheet (already built; read it, do not change it)

Import state and actions from `@/store/useTwin` (`useTwin`) and derived values from `@/store/hotelDerived`. Types and the `STRESS_TESTS` list (labels and descriptions) come from `@/engine/hotel`, read only.
Call selectors like `useTwin(selectDisplayed)`; they are memoized and safe to use on every render.

| What | Name |
| --- | --- |
| Hotel profile entered by the user / with defaults filled in | `hotelInput` / `hotel.profile`; `hotel.defaulted` lists fields that are defaults (show "default (estimate)"), `hotel.notes` explains clamped values |
| Demo presets | `hotelPresets` (`{ id, label, synthetic }`), `hotelPresetId`, `selectHotelPreset(id)` |
| Edit the profile | `setHotelInput(patch, clearKeys?)`, `setHotelBudget(n)`, `setHotelObjective('annual_savings' \| 'payback' \| 'roi' \| 'carbon' \| 'balanced')` |
| Current baseline | `baseline` (`annual`, `byZone`, `byCategory`, `byEndUse`, `months`, `estimated`, `sources`) |
| What-if | `scenario`, `setScenario(patch, clearKeys?)`, `resetScenario()`, `applyStressTest('heat_wave' \| 'cold_snap' \| 'conference_surge' \| 'price_up_20' \| null)`, `activeStressTest` |
| What-if result | `scenarioResult` (null when none): `before`, `after`, `delta`, `deltaByZone`, `deltaByCategory`, `drivers` (why it changed), `flags` (comfort notes) |
| What the screen should show | `selectDisplayed(s)` → `{ kind: 'baseline' \| 'scenario' \| 'package', result }`; `selectCompare(s)` → `{ before, after, kind }`; `selectHotelCost`, `selectHotelBaselineCost`, `selectHotelLabel` |
| Zones, equipment, flows, time | `selectZoneRows`, `selectEquipment`, `selectFlows`, `selectTypicalDay`, `selectRooms`, `selectMeter`; `selectedZone`/`selectZone`, `twinLayer`/`setTwinLayer`, `timeMode`/`timeMonth`/`timeHour`/`setTime`, `playing`/`setPlaying`, `playbackSpeed`/`setPlaybackSpeed`, `compareMode`/`setCompareMode` |
| Budget optimizer | `runHotelOptimizer()`, `optimizing`, `optimizerCombinations` (set when a run starts), `hotelPlan` (`packages`, `objectiveWinner`, `combinationsTested`, `feasibleCount`, `emptyReason`, `cheapestUseful`), `applyHotelPackage(id \| null)`, `activeHotelPackageId` |
| Package fields | `evaluation.cost` and `evaluation.annualSavings` (`low`/`mid`/`high`), `evaluation.metrics` (`paybackYears`, `netBenefit`, `roi`, `remainingBudget`, `carbonAvoidedKgPerYear`), `evaluation.comfort`, `evaluation.lineItems`, plus `role`, `roleLabel`, `reason`, `note`, `budgetRisk` |
| Optimize against the current what-if (for example electricity +20%) | `optimizeOnScenario`, `setOptimizeOnScenario(b)`; the plan records `hotelPlan.scenario`, and `hotelPlanBaseline` is what it was measured against |
| AI advisor | `advisorMessages` (`{ id, role: 'user' \| 'advisor', text, source?: 'ai' \| 'fallback', reason? }`), `advisorBusy`, `askAdvisor(question)`, `clearAdvisor()`; suggested questions: `advisor.ADVISOR_SUGGESTED_QUESTIONS` from `@/engine/hotel` |
| Saved scenarios | `savedScenarios`, `saveScenario(name?)`, `loadScenario(id)`, `renameScenario(id, name)`, `deleteScenario(id)` |
| Reset | `resetHotel()` |

Money fields are US dollars (round only for display); energy is kWh and therms; carbon is kg CO2e.

---

## LV1 — Clean out the home copy (after H9)

```
Remove residential wording from the UI: "Maya", "home", "homeowner", "attic", "house", "furnace" and the house outline on the stage.
Rename the left panel to "Hotel profile" and the stage to "Digital twin". Keep the layout, colors and components. Don't modify
src/engine, src/data, src/twin, src/store or supabase.
```

## LV2 — Hotel profile form (tasks 4.2, 4.3)

```
Replace the home form with a hotel profile form in three collapsible sections: Building (name, city/state/country, guest rooms, floor area,
floors, year built, operating hours, HVAC type, monthly energy bill, electricity price), Operations (occupancy, occupied hours per room,
guest-room temperatures, common-area HVAC and lighting hours, hot-water use) and Financial (budget, investment horizon, objective: annual
savings, payback, ROI, carbon, or balanced). Show a preset picker from useTwin().hotelPresets using selectHotelPreset, and label synthetic ones
"Synthetic demo". Read values from hotel.profile and write them with setHotelInput(patch, clearKeys); to reset one field to its default pass its
name in clearKeys. Every field is optional: show a small "default (estimate)" tag when the field's name is in hotel.defaulted, and show any
hotel.notes as helper text. Don't modify src/engine, src/data, src/twin, src/store or supabase.
```

## LV3 — Overview tab (task 4.3)

```
Add an Overview view: annual energy use, annual cost, a breakdown by category and by zone (Recharts), estimated emissions, and the top
opportunities. Use selectDisplayed (result.annual, result.byCategory, result.byZone) and selectZoneRows. Show an "Estimate" badge next to each
total, and "Synthetic demo data" when hotelPresetId is set. Don't modify src/engine, src/data, src/twin, src/store or supabase.
```

## LV4 — Scenario simulator (task 4.4)

```
Add a Scenario simulator: sliders and toggles for occupancy (0 to 100%), guest-room occupied heating and cooling setpoints, a "Smart room controls"
toggle, common-area HVAC hours, lighting hours, and electricity price change (%). Each change calls setScenario with the new value (use
clearKeys to remove a field). Add four stress-test buttons that call applyStressTest (heat_wave, cold_snap, conference_surge, price_up_20; click
again to clear) using STRESS_TESTS from @/engine/hotel for the labels and descriptions (read only), and a Reset button calling resetScenario. Show before/after metric tiles (energy,
cost, carbon) from selectCompare with animated numbers, a monthly before/after chart, a list of scenarioResult.drivers ("Why this changed",
label, dollar change and detail text), and scenarioResult.flags as comfort notes (warn in amber, info in muted). Add an "Optimize for this
scenario" switch bound to optimizeOnScenario / setOptimizeOnScenario, shown on the simulator and next to the optimizer's Find button; when a plan
was made on a scenario (hotelPlan.scenario is set), label the optimizer results "Measured against the current scenario". In the optimizer's
"Testing combinations…" counter, count up to optimizerCombinations (available as soon as the run starts) instead of a percentage.
Don't modify src/engine, src/data, src/twin, src/store or supabase.
```

## LV5 — Budget optimizer (task 4.5)

```
Add a Budget optimizer view: a budget input (setHotelBudget), an objective picker (setHotelObjective) and a "Find the best investments" button
that calls runHotelOptimizer(). While optimizing is true show "Testing combinations…" counting up to optimizerCombinations over 2
seconds. When hotelPlan appears, show hotelPlan.packages as three cards (role label, name, cost, annual savings with the low-to-high range,
five-year net benefit, payback, carbon avoided, remaining budget, comfort score and notes, the reason line, and a warning when budgetRisk is
true). Highlight the card matching hotelPlan.objectiveWinner and show note text when present. Clicking a card (or auto-selecting the winner
after 600 ms) calls applyHotelPackage(evaluation.id). If hotelPlan.packages is empty, show hotelPlan.emptyReason and cheapestUseful. Add a
comparison table of the three packages and a Source chip on each line item (evaluation.lineItems[].source) that opens the Sources sheet.
Don't modify src/engine, src/data, src/twin, src/store or supabase.
```

## LV6 — Place the digital twin (after H10)

```
Place <HotelTwin /> from src/twin/HotelTwin in the center stage. Don't modify the component. The component has its own layer switcher
(Zones, Rooms, Equipment, Flow), time scrubber, simulated meter and stress-test buttons; give it as much room as possible. Add a legend and a
"Simulated data" label. When a zone is selected, show the zone panel beside the diagram on wide screens and below it on narrow screens.
```

## LV7 — Saved scenarios (P1, task 4.6)

```
Add "Save scenario" and a list of saved scenarios using savedScenarios, saveScenario, loadScenario, renameScenario and deleteScenario.
Selecting one restores it and updates all charts. Allow rename and delete.
```

## LV8 — AI advisor panel (after H11, task 6.6)

```
Add an AI advisor chat panel. Show useTwin().advisorMessages as a conversation (user messages right, advisor messages left). Under the input,
show the four suggested questions from advisor.ADVISOR_SUGGESTED_QUESTIONS (import { advisor } from "@/engine/hotel") as clickable chips. Sending
calls askAdvisor(question); while advisorBusy is true show a "Thinking…" bubble and disable the input. Under each advisor message show a small
label: "Explains the computed results" when source is "ai", and "Template answer" when source is "fallback" (the app switches to the template
automatically if the AI is slow, unavailable or states a number it was not given; do not show errors). Add a "Clear" button calling
clearAdvisor(). Keep the answer text exactly as given. Don't modify src/engine, src/data, src/twin, src/store or supabase.
```

## LV10 — One workspace (run before LV9)

```
Make the dashboard (/) one workspace and keep the current visual style. Desktop: a 380px left panel with four numbered tabs
"1 Hotel", "2 Scenario", "3 Invest", "4 Ask"; the center keeps Stage (the digital twin) always visible, with a KPI strip above it
showing annual cost, energy and carbon from selectCompare (before → after and the change, each with an "Estimate" badge; show only
the current value when before and after are equal). Remove the right panel and PlanDrawer; remove the top-bar Advisor button (it is
now a tab) and rename the Overview link "Report".
Tab 1 Hotel: the preset picker and a summary of hotel.profile (name, city, rooms, floor area, HVAC type, monthly bill or "estimated")
with an "Edit details" button that expands HotelProfileForm.
Tab 2 Scenario: the ScenarioSimulator controls with occupancy, the two setpoints and smart room controls first and the rest under
"More controls"; then stress tests, "Why this changed", comfort notes and saved scenarios. Leave out its tiles and monthly chart here
(the KPI strip and twin show the change); keep the full /scenario page.
Tab 3 Invest: budget input with quick chips $25,000 / $50,000 / $100,000 (setHotelBudget), objective, "Optimize for this scenario",
the Find button with the live counter, and the three packages as compact cards (role, name, investment, annual savings, payback,
Apply). Applying a package calls applyHotelPackage and setCompareMode("split"). A "Compare in detail" link opens /optimizer.
Tab 4 Ask: AdvisorPanel, filling the panel height.
Mobile: twin and KPI strip on top, the same four tabs below. Reuse the existing components; do not duplicate their logic.
Don't modify src/engine, src/data, src/twin, src/store or supabase.
```

## LV9 — Polish and disclaimers (task 4.7)

```
Add a footer disclaimer: "Estimates from synthetic and public data, not an engineering audit. No guaranteed savings." Mark any input or total that
uses a default with "default (estimate)". Check empty, loading and error states, keyboard focus order and mobile layout. Fix layout shift.
Remove home-era leftovers from the top bar: the "Thermal Vision" switch (nothing reads thermalMode any more), the "1 Hotel profile · 2 Explore
· 3 Optimize" step bar (it uses the old home step and never advances), and the "Share plan" button (the link does not carry the hotel, scenario
or package). Delete components nothing imports any more: HomeForm, CostSummary, PresetCard and StageOverlays. In the budget input, keep the
typed text while editing and commit on blur or Enter, so clearing the field does not set the budget to $0. Also remove the bottom "Your Plan"
drawer (PlanDrawer reads the old home package and never shows hotel packages). Show the budget as $50,000 rather than 50000. In the optimizer
cards keep the Source chip on each line item but move the long source text into the Sources sheet. When the objective winner's card has a
different role label (for example the objective is Balanced and the winner is "Maximum savings"), label it "Best for your objective
(Balanced)". In the advisor's MessageResponse, pass no streamdown plugins (answers are a few plain sentences) and drop the cjk, code, math and
mermaid imports so their bundles are not shipped. Don't modify src/engine, src/data, src/twin, src/store or supabase.
```
