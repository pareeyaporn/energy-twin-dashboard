# 06 — Lovable prompts, in order (hotel product)

One prompt at a time, after the matching Claude Code step. Add **"Don't modify files in src/engine, src/data, src/twin, src/store or supabase."**
to any prompt that works near them. All numbers come from the store; components never hard-code costs, savings or labels with figures.
Task numbers refer to [11_HOTEL_TASKS.md](11_HOTEL_TASKS.md). The old home-era prompts (L1 to L9) are replaced by this file.

Style for every prompt: polished B2B SaaS look, professional typography, clear financial metrics, intuitive charts (Recharts), responsive controls.

**Order and status.** Run one at a time and tell Claude Code when each is done (nothing is merged into `main` while a prompt runs).

| Prompt | Status |
| --- | --- |
| LV1 clean home copy, LV2 profile form, LV3 overview, LV4 scenario simulator, LV5 optimizer, LV6 twin, LV7 saved scenarios, LV8 advisor | Done and reviewed |
| LV10 one workspace (ran before LV9) | Done and reviewed |
| LV9 polish | Done |
| LV11 upgrade comparison and the financial breakdown | Done |
| LV12 layout fix (packages first, collapsed comparison, shared assumptions, short Source buttons, remaining budget and comfort back) | Done |
| LV13 NPV with an 8% / 3% switch, grid subregion field | Done |
| LV14 year-by-year projection chart | Done |
| LV15 polish: benchmark card, calmer Invest tab, phone layout, fewer default tags | Done |
| (none queued) — the Scenario screen's stress buttons now list all eight tests automatically from `STRESS_TESTS` | — |

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
| Financial breakdown (same for every upgrade and package) | `evaluation.financials`: `grossCost`, `incentives` (lines with `label`, `amount`, `applied`, `note`, `source`), `incentivesTotal`, `netInvestment`, `annualEnergySavings` (`elecKWh`, `gasTherms`), `annualSavings`, `simplePaybackYears`, `netBenefit5`, `netBenefit10`, `carbonAvoidedKgPerYear` (ranges are `low`/`mid`/`high`), `solar` (`sizeKw`, `generationKWh`, `selfConsumedKWh`, `exportedKWh`, `installedCostPerW`, `exportCreditPerKWh`, `degradationPerYear`) or null, `assumptions` (strings) |
| NPV and discount rate | `financials.npv5`, `financials.npv10` (ranges), `financials.discountRate`; `hotelDiscountRate` (default 0.08), `setHotelDiscountRate(r)`; alternative rates in `hotelData.defaults.finance.discountRateAlternatives` ([0.03]) |
| Grid emissions | `hotel.profile.gridSubregion` (eGRID acronym, for example RFCW); set with `setHotelInput({ gridSubregion })`; names in `hotelData.emissions.subregions` |
| Upgrade comparison (every upgrade on its own) | `selectUpgradeComparison(s)` → rows `{ id, label, description, financials, metrics, comfort, lifetimeYears, source }`, measured the same way as the optimizer |
| Optimize against the current what-if (for example electricity +20%) | `optimizeOnScenario` (turns on by itself when a scenario or stress test starts and off when it is cleared), `setOptimizeOnScenario(b)`; the plan records `hotelPlan.scenario`, and `hotelPlanBaseline` is what it was measured against |
| AI advisor | `advisorMessages` (`{ id, role: 'user' \| 'advisor', text, source?: 'ai' \| 'fallback', reason? }`), `advisorBusy`, `askAdvisor(question)`, `clearAdvisor()`; suggested questions: `advisor.ADVISOR_SUGGESTED_QUESTIONS` from `@/engine/hotel` |
| Saved scenarios | `savedScenarios`, `saveScenario(name?)`, `loadScenario(id)`, `renameScenario(id, name)`, `deleteScenario(id)` |
| Hotel portfolio (Phase 13; the page is `/portfolio`, built by Claude Code in `src/portfolio/`) | `portfolio` (the synthetic chain), `activePropertyId`, `openProperty(id)` (loads a hotel into every single-hotel screen, saving the open one), `portfolioBudget`, `setPortfolioBudget(n)`, `portfolioObjective`, `setPortfolioObjective(o)`, `portfolioPlan`, `portfolioOptimizing`, `runPortfolioOptimizer()`; derived: `selectPortfolioSummary(s)`, `selectActiveProperty(s)`, `selectVisibleCustomPlans(s)` |
| Reset | `resetHotel()` (also resets the portfolio) |

Money fields are US dollars (round only for display); energy is kWh and therms; carbon is kg CO2 (the grid factor is CO2 only).

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
mermaid imports so their bundles are not shipped. In the top bar, remove the Scenario and Investments links (the workspace tabs cover
them; the full pages stay reachable from "Compare in detail" and the Scenario tab). Don't modify src/engine, src/data, src/twin, src/store
or supabase.
```

## LV11 — Upgrade comparison and the financial breakdown (run after LV9)

```
Add an upgrade comparison to the Invest tab (above the budget) and to the /optimizer page: one card per row of
selectUpgradeComparison(s), solar included, every card showing the same eight lines from row.financials in this order:
1 Gross installation cost (grossCost.mid, with low to high), 2 Incentives (incentivesTotal; if none is applied say "None applied" and
list the not-applied incentives[].label with their note in a tooltip), 3 Net upfront investment (netInvestment.mid), 4 Annual energy
savings (annualEnergySavings.elecKWh in kWh, and gasTherms in therms when not zero; a negative value means it adds that energy),
5 Annual savings ($, annualSavings.mid with low to high), 6 Simple payback (simplePaybackYears, "No payback" when null),
7 Net benefit over 5 years and over 10 years (netBenefit5.mid and netBenefit10.mid, with low to high; negative in amber),
8 CO2 reduction per year (carbonAvoidedKgPerYear.mid in tonnes, label it "CO2, estimate"). For solar also show size (kW), yearly
generation, used on site and exported (kWh), and $/W. Under each card show financials.assumptions as small muted text and a Source
chip with row.source. Add a compact table view toggle with the same columns, sortable. Use the same eight lines in the package cards
and the comparison table of the budget optimizer (evaluation.financials), replacing the older metrics there so every view shows the
same numbers. Never compute or round money in the component beyond display formatting. Label everything "Estimate".
Don't modify src/engine, src/data, src/twin, src/store or supabase.
```

## LV12 — Layout fix after LV11 (done)

```
Fix the layout of the upgrade comparison and the package cards. In the Invest tab and on /optimizer, put the budget, objective,
"Optimize for this scenario", the Find button and the package cards first; move "Compare upgrades" below the packages, collapsed by
default ("Compare all upgrades"), and open it in the Table view. Show the assumptions once, under the comparison, from the first row's
financials.assumptions, and on the solar card show only the assumptions that mention solar. Make each Source chip a short "Source"
button that opens the Sources sheet, with the full source text in a tooltip instead of on the button. In each package card, after the
eight lines, add back "Remaining budget" (evaluation.metrics.remainingBudget) and "Comfort score" (evaluation.comfort.score as a
percentage), and add both rows to the Compare investments table. Keep all values from the store; display formatting only.
Don't modify src/engine, src/data, src/twin, src/store or supabase.
```

## LV13 — NPV and the discount rate; grid subregion (after the product decisions)

```
In the Compare all upgrades table and the Compare investments table, add two columns/rows "NPV, 5 years" and "NPV, 10 years" from
financials.npv5.mid and financials.npv10.mid (with low to high), labeled "at {financials.discountRate as %}". Above both tables add a small
"Discount rate" switch with 8% and 3% (values from hotelData.defaults.finance.discountRate and discountRateAlternatives) that calls
setHotelDiscountRate; show "8% is the default for commercial investment analysis; 3% is an alternative scenario (a product decision)".
Keep simple payback, not NPV, on the main upgrade and package cards. In the hotel profile form's Building section add an optional
"Grid region (eGRID)" select listing hotelData.emissions.subregions (acronym and name), bound to hotel.profile.gridSubregion through
setHotelInput({ gridSubregion }), with the "default (estimate)" tag when it is in hotel.defaulted. Solar now appears at three sizes in the
comparison (quarter, half and full roof); keep them as separate rows. Display formatting only.
Don't modify src/engine, src/data, src/twin, src/store or supabase.
```


## LV14 — Year-by-year financial projection (after the 3D twin PR is merged)

```
Add a "10-year projection" to each package card and to the solar and other rows of Compare all upgrades. In each package card, under
the eight financial lines, add a small "Show 10-year projection" toggle. When opened, show a Recharts chart from
evaluation.financials.projection (years 1 to 10): bars for each year's savings (savings.mid) and a line for cumulative net benefit
(cumulativeNet.mid), with a shaded band from cumulativeNet.low to cumulativeNet.high and a dashed zero line, so the point where the line
crosses zero is the payback. Add a second, dashed line "Discounted (NPV)" from cumulativeNpv, labeled "at {financials.discountRate as %}".
Below the chart show a compact table with Year, Savings, Cumulative net benefit (low to high) and Discounted, and a note: "Savings grow
with EIA price forecasts; solar output falls 0.5% a year; year 5 and year 10 equal the net benefit shown above. Estimate."
In the Compare investments table add a "Projection" row with a small sparkline of cumulativeNet.mid for each package, and open the full
chart in a dialog on click. In Compare all upgrades (table view), add the same sparkline column from row.financials.projection.
Use the store values only; display formatting only; negative values in amber, positive in the savings color.
Don't modify src/engine, src/data, src/twin, src/three, src/store or supabase.
```

## LV15 — Polish: peer benchmark, calmer Invest tab, phone layout, fewer default tags (after the camera/realism PR is merged)

```
1. Peer benchmark. In the Hotel step under the profile summary, and in the overview KPI area, add a small "How this hotel compares"
card. Get the values with useMemo from benchmarkComparison(baseline, hotel.profile.floorAreaSqft) imported from "@/engine/hotel"
(state.baseline and state.hotel from useTwin). Show the hotel's siteEuiKBtuPerSqft ("kBtu per ft² a year, modeled") and one row per
peers[] entry: label, its siteEuiKBtuPerSqft, and the difference as "+45% vs" or "-8% vs" (difference as a percentage), plus a thin
horizontal bar chart of the three values. Show the note text in small muted type and each peer's source in a tooltip (Source button).
Label it "Estimate". Do not color it as good or bad; it is context.

2. Fewer "default (estimate)" tags. Where several fields in one card are defaulted, show one line at the top of the card instead:
"Some values are defaults (estimates) — marked with •", and mark the defaulted fields with a small dot with a tooltip "Default
(estimate)". Keep the "Estimate" badges on results.

3. Calmer Invest tab. Collapse each package card to: name, net investment, $ saved per year, payback, 10-year net benefit, CO2, and a
"Show all figures" toggle that opens the full eight lines, remaining budget, comfort and the projection toggle. Keep the winner badge.
Keep Compare investments and Compare all upgrades as they are, collapsed by default.

4. Projection note. In Projection.tsx only say "solar output falls 0.5% a year" when f.solar is not null; otherwise drop that clause.

5. Phone layout (under 640 px): stack the KPI strip in a two-column grid with smaller numbers, make the step tabs horizontally
scrollable, make the twin full width with its controls wrapping, make tables horizontally scrollable with the first column sticky, and
make package cards full width. Check that no text overflows at 375 px.

Display formatting only. Don't modify src/engine, src/data, src/twin, src/three, src/store or supabase.
```
