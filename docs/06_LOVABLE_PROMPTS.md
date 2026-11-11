# 06 — Lovable prompts, in order

The shell prompt (layout, panels, mock data) is done first. These are the follow-ups. One prompt at a time.
Add **"Don't modify files in src/engine, src/data or src/three."** to any prompt that works near them.

---

## L1 — After the engine is wired (after Claude Code P6)

```
The store in src/store/useTwin.ts now has real numbers from the engine. Make sure every cost, saving, payback and
value shown in the Home panel, the stage counter, the package cards and the plan drawer reads from the store
(displayedAnnualCost, baseline, results, activePackageId). Remove any remaining hard-coded mock numbers from components.
Don't modify files in src/engine, src/data or src/three.
```

## L2 — Optimize button flow

```
When "Find my best upgrades" is clicked: call runOptimizer() from the store. While store.optimizing is true, show
"Testing N of {combinationsTested} combinations…" with N counting up over 2 seconds, and disable the button.
When it finishes, reveal the 3 package cards with a staggered fade-up. Auto-select package 1 after 600 ms
by calling applyPackage(results[0].id).
```

## L3 — Bill counter

```
The "Yearly energy cost" counter on the stage shows store.displayedAnnualCost with an animated count up/down
(1.2 s, ease-out). While store.installing is true, hold the old value; animate when installing becomes false.
Under it, when a package is active, show a mint "−$X / yr" pill using the package's annualSavings.mid.
```

## L4 — Ranges and sources everywhere

```
Wherever savings are shown, display the range as "$780–$1,050 / yr" using annualSavings.low and .high, with the mid
value emphasized. Add a small "Source" chip next to each upgrade line item that opens the Sources sheet scrolled to
the matching source. Add the disclaimer "Planning estimate from public data, not a professional energy audit."
in the plan drawer footer.
```

## L5 — Plan drawer charts

```
In the plan drawer: (1) grouped bar chart (Recharts) of Heating, Cooling, Water heating, Other — "Now" from
store.baseline.costs vs "With plan" from the active package outcome.costs; (2) line chart of cumulative net savings
over 15 years starting at −cost, with a vertical marker at the payback year. Use the theme colors (blue for "With plan",
muted for "Now", mint for savings line).
```

## L6 — AI explanation card

```
The "Why this plan" card shows the explanation text from the explain backend function (store or hook provided in
src/lib or src/store — ask if unclear). Show a shimmering skeleton while loading. Label: "Written by AI from the
calculated numbers" with a sparkle icon. If it fails, the template text is used automatically — no error UI.
```

## L7 — Toolbar wiring

```
Wire the stage toolbar: Rotate (toggle auto-rotate in store), Reset view, Cutaway toggle, Season toggle (can be
disabled with a "soon" tooltip), and "Reduce effects" in the menu calling setReduceEffects. The Thermal Vision switch
in the top bar calls toggleThermal(); when on, show the blue→red legend bottom-left of the stage.
```

## L8 — Polish pass

```
Polish pass for a live demo on a 1440×900 and a 1920×1080 screen: no scrollbars, no layout shift when numbers change,
consistent 8px spacing, all numbers use tabular figures, hover states on all cards, focus rings in cyan.
Make the selected preset card and the active package card clearly highlighted. Don't modify src/engine, src/data or src/three.
```

## L9 — Share

```
"Copy summary" copies a plain-text plan: home, budget, goal, chosen package, cost, savings range, payback, 15-year
value, upgrades with costs, and the sources list. "Share link" encodes presetId, budget, goal and activePackageId in
the URL query so opening it restores the same view.
```
