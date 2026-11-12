# 06 — Lovable prompts, in order (hotel product)

One prompt at a time, after the matching Claude Code step. Add **"Don't modify files in src/engine, src/data, src/twin, src/store or supabase."**
to any prompt that works near them. All numbers come from the store; components never hard-code costs, savings or labels with figures.
Task numbers refer to [11_HOTEL_TASKS.md](11_HOTEL_TASKS.md). The old home-era prompts (L1 to L9) are replaced by this file.

Style for every prompt: polished B2B SaaS look, professional typography, clear financial metrics, intuitive charts (Recharts), responsive controls.

---

## LV1 — Clean out the home copy (after H9)

```
Remove residential wording from the UI: "Maya", "home", "homeowner", "attic", "house", "furnace" and the house outline on the stage.
Rename the left panel to "Hotel profile" and the stage to "Digital twin". Keep the layout, colors and components. Don't modify
src/engine, src/data, src/twin, src/store or supabase.
```

## LV2 — Hotel profile form (task 4.2, 4.3)

```
Replace the home form with a hotel profile form in three collapsible sections: Building (name, city/state/country, guest rooms, floor
area, floors, year built, operating hours, HVAC type, monthly energy bill, electricity price), Operations (occupancy, occupied hours per room,
guest-room temperatures, common-area HVAC and lighting schedules, hot-water use, seasonal occupancy) and Financial (budget, investment horizon,
objective: annual savings, payback, ROI, carbon, or balanced). Every field is optional; show an unset field's default with a small
"default (estimate)" tag. Read and write through the store's hotel profile and preset actions. Include a preset picker for the demo hotel.
```

## LV3 — Overview tab (task 4.3)

```
Add an Overview view: annual energy use, annual cost, a breakdown by category and by zone (Recharts), estimated emissions, and the top
three opportunities. Use the store's baseline. Show a small "Estimate" badge next to each total.
```

## LV4 — Scenario simulator (task 4.4)

```
Add a Scenario simulator: sliders and toggles for occupancy, guest-room setpoint, vacant-room setback, common-area HVAC schedule and
electricity price change (%). Each change calls the store's scenario action. Show before/after metric tiles (energy, cost, carbon) with
animated numbers, a monthly before/after chart, and a "Why this changed" panel listing the store's drivers. Add a Reset button.
```

## LV5 — Budget optimizer (task 4.5)

```
Add a Budget optimizer view: budget input and objective picker, then a "Find the best investments" button that calls runOptimizer().
While store.optimizing is true show "Testing combinations…". Then show three package cards (maximum savings, fastest payback, balanced) with
cost, annual savings with range, five-year net savings, payback, carbon impact, remaining budget and comfort notes, plus a comparison table.
Add a Source chip on each line item that opens the Sources sheet.
```

## LV6 — Place the digital twin (after H10)

```
Place <HotelTwin /> from src/twin/HotelTwin in the center stage. Don't modify the component. Add a before/after toggle and a legend.
When a zone is selected, show the zone panel beside the diagram on wide screens and below it on narrow screens.
```

## LV7 — Saved scenarios (P1, task 4.6)

```
Add "Save scenario" and a list of saved scenarios using the store's saved scenarios. Selecting one restores it and updates all charts.
Allow rename and delete.
```

## LV8 — AI advisor panel (after H11, task 6.6)

```
Add an AI advisor chat panel with suggested questions ("Why is HVAC my biggest cost?", "How does occupancy change my energy use?",
"Should I start with solar or smart thermostats?", "How should I use $30,000?"). Call the store's advisor action; show a loading state and
fall back gracefully if it takes longer than 6 seconds (the store handles the fallback text). Label answers "Explains the computed results".
```

## LV9 — Polish and disclaimers (task 4.7)

```
Add a footer disclaimer: "Estimates from synthetic and public data, not an engineering audit. No guaranteed savings." Mark any input or total that
uses a default with "default (estimate)". Check empty, loading and error states, keyboard focus order and mobile layout. Fix layout shift.
```
