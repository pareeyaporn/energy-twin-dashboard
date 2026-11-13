# 18 — Investment results and the PDF report (`src/report/`)

The Invest step answers an owner's five questions at a glance: **how much do I invest, how much do I save, how long until it pays for itself,
what is it worth over time, and which upgrades do it**. The same figures go into a downloadable, multi-page **PDF investment report** for
owners, general managers and finance teams. Built November 2026 (Phase 14B, `docs/11`).

**Rule:** nothing in `src/report/` calculates energy, savings or money. It reads the engine's evaluation of a plan (the same evaluation the
optimizer ranked, the custom-plan builder shows and the comparison table uses) and only adds sums, shares and differences of those outputs.
One pure function builds the report data; the on-screen results, the preview and the PDF all render that one object, so their figures are
identical by construction.

## Where it appears

| Place | What | Hook |
| --- | --- | --- |
| Invest → AI recommended (workspace panel and the `/optimizer` page) | **Recommended investment plan**: summary, reading, before/after, upgrades and savings, report buttons | `<AiPlanResults />`, one line in `BudgetOptimizer.tsx` (Lovable-owned, minimal edit) after "Why this plan" |
| Invest → Build your own | The custom plan's reading, before/after, upgrade breakdown and report buttons, under the plan totals (`PlanSummary`) | `<CustomPlanResults planId />` in `src/plans/PlanBuilder.tsx` |
| Invest → Compare | A new **Selected upgrades** row in the AI-versus-custom table (the rest of the table already compared investment, savings, payback, NPV, carbon) | `src/plans/PlanCompare.tsx` |
| Portfolio → optimizer result | Report buttons for the portfolio plan | `<PortfolioReportActions />` in `src/portfolio/PortfolioOptimizer.tsx` |

Which AI package is reported: the one **applied to the twin**, else the optimizer's **objective winner**. Copying the AI plan into an editable
custom plan already existed ("Customize AI plan", `customizeFromPackage`); nothing was duplicated.

## Files

| File | Role |
| --- | --- |
| `src/report/data.ts` | Types and the pure builders: `buildHotelReport`, `buildPortfolioReport`, `interpretFinancials`, `reportFileName` |
| `src/report/fromStore.ts` | Reads the store (read-only): `aiReportFromState`, `customReportFromState`, `portfolioReportFromState`, `isSyntheticHotel` |
| `src/report/ResultsSummary.tsx` | The on-screen results (`ResultsSummary`, `AiPlanResults`, `CustomPlanResults`, `PortfolioReportActions`) |
| `src/report/ReportActions.tsx` | "Download PDF report" and "Preview report": loading state, error message, file name, the preview dialog |
| `src/report/ReportPreview.tsx` | The preview: the same data and sections drawn as light pages in the browser |
| `src/report/pdf/ReportDocument.tsx` | The PDF document (`@react-pdf/renderer`): pages, header and footer, tables and vector charts |
| `src/report/pdf/render.tsx` | `renderReportPdf(data, date) → Blob`; loaded with a dynamic import only when a report is generated |
| `src/report/__tests__/report.test.tsx`, `reportPdf.test.tsx` | Figures equal the engine's; honest readings; file name; a real PDF is generated and checked |

## On-screen results, figure by figure

All money is the mid estimate, rounded only for display; ranges are shown where the engine gives them.

### A. Executive summary (eight tiles)

| Tile | Figure | Engine source | How |
| --- | --- | --- | --- |
| Recommended investment | Net investment | `financials.netInvestment.mid` | Gross cost minus **applied** incentives; note shows `grossCost.mid` and `incentivesTotal` |
| Budget left | Budget − gross cost | `plan.budget` (AI) or `PlanEvaluation.budget` (custom); `financials.grossCost.mid` | The budget is compared with the gross cost, because incentives arrive after installation (docs/15). Red when over budget |
| Estimated annual savings | First-year savings | `financials.annualSavings` (low–mid–high) | As the engine computes it, including any solar export credit |
| Cut in energy cost | Savings ÷ the bill | `annualSavings.mid ÷ baseline.annual.cost` | The baseline is what the plan was measured against (see B) |
| Pays for itself in | Simple payback | `financials.simplePaybackYears` | Net investment ÷ first-year savings; "No payback" when it does not save |
| NPV, 5 years / 10 years | Discounted net benefit | `financials.npv5.mid`, `npv10.mid` | At the app's discount rate (`hotelDiscountRate`, 8% default; editable in the comparison) |
| Carbon avoided | t CO2e a year | `financials.carbonAvoidedKgPerYear.mid` | Share = avoided ÷ `baseline.annual.carbonKg` |

### B. Before vs after

Five rows, each with before, after, the absolute change and the percentage change, coloured green when the change is an improvement and amber
when it is not (for example **natural gas rises** with LED lighting, because less lamp heat means more heating: the model's interaction).

| Row | Before | After |
| --- | --- | --- |
| Electricity (kWh a year) | `baseline.annual.elecKWh` | `evaluation.outcome.annual.elecKWh` |
| Natural gas (therms a year) | `baseline.annual.gasTherms` | `outcome.annual.gasTherms` |
| Energy spending ($ a year) | `baseline.annual.cost` | `outcome.annual.cost` (equals before − `annualSavings.mid`; tested) |
| Carbon emissions (t CO2e a year) | `baseline.annual.carbonKg ÷ 1000` | `outcome.annual.carbonKg ÷ 1000` |
| Energy intensity (kBtu/ft² a year) | site kBtu ÷ floor area | the same after |

Site kBtu = kWh × 3.412 + therms × 100 (the engine's constants). **Baseline:** for an AI plan, `hotelPlanBaseline` (what the optimizer measured
against: the what-if when "optimize for this scenario" was on), else today's baseline; for a custom plan, the plan context's baseline (the same
rule, `selectUpgradeBaseline`). When it is a what-if the results say "measured against the current what-if".

### C. Upgrades and savings (expandable)

One row per upgrade in the plan (`evaluation.lineItems`), with its quantity and installed cost and its annual savings; expanding a row shows:

| Field | Source |
| --- | --- |
| Description | The catalog item (`upgradeCatalog`) |
| Quantity or capacity | Custom plans: the plan item's quantity in the catalog unit (rooms, %, ft²); AI packages: the catalog's whole scope; solar: `sizing.solarKw` kW |
| Installed cost and range | `lineItem.cost` (low, mid, high) |
| Saves a year | `lineItem.annualSavingsMid` (see D) |
| Pays for itself in | Line cost ÷ its savings, **before incentives**; flagged when longer than its life |
| Expected life | `lineItem.lifetimeYears` (the engine's lifetimes, IL-TRM based) |
| Incentives | The package's incentive lines for this upgrade: applied amounts, or "listed, not counted (unverified)" |
| Key assumptions | The upgrade's source text (`lineItem.source`), shortened |

### D. Savings contribution: the attribution rule for interacting upgrades

Upgrades interact (LED lighting lowers cooling but raises heating; insulation shrinks the load the HVAC upgrade then serves). The engine
applies a package's upgrades **one after another in a fixed order** and records each one's **marginal** saving at that point
(`PackageLineItem.annualSavingsMid`); these marginal savings **add up exactly to the package total** (`annualSavings.mid`). The report checks
this (`contributionsAdd`):

- **If they add up** (always, in this engine): a stacked bar shows each upgrade's share of the package's savings, with the note that the split
  follows the model's order and the interactions are already counted, so nothing is double-counted.
- **If they did not** (a future engine change): no split is shown; only the combined savings, with "the upgrades interact, so their individual
  effects are not additive".

Standalone savings of each upgrade (the comparison table, `compareUpgrades`) are **never** added together to make a package figure.

### E. AI plan vs custom plan

Unchanged where it already worked (`src/plans/PlanCompare.tsx`): the same engine call and the same financial assumptions for both. Added the
**Selected upgrades** row. "Customize AI plan" copies a package into an editable custom plan.

### F. What this means (plain-language reading)

Generated by `interpretFinancials(financials, baselineCost, life)` from the plan's own figures. Wording rules:

| Condition | Verdict | What it says |
| --- | --- | --- |
| No savings or no payback | **Not financially attractive** | "It does not save money in the model, so it does not pay for itself." |
| Payback longer than the equipment life (savings-weighted average of the lines' lifetimes) | **Not financially attractive** | "The payback is longer than the equipment is expected to last …" |
| 10-year NPV below zero | **Not financially attractive** | "over ten years the savings do not cover the investment" |
| Pays back, NPV ≥ 0, payback over 7 years | **Pays back, but slowly** | adds "compare it with shorter-payback options before committing capital" |
| Otherwise | **Financially attractive on these estimates** | the payback and the positive NPV |
| Low-end savings below zero (any verdict) | — | "At the low end of the estimate range it would not save money …" |

The first sentence always states the investment after incentives (and the gross cost and incentives) and the annual savings with their share
of the bill. The 7-year line for "slow" is a product decision (docs/15 §23), not a published threshold. Every plan is not presented as good:
the solar-only custom plan, for example, reads "Not financially attractive".

## The PDF report

**Download PDF report** builds a real PDF in the browser (react-pdf; selectable text, vector charts, US Letter), shows "Preparing PDF…" while
it works, then downloads it; an error message appears if generation fails, with "Try again". **Preview report** opens the same report data as
light pages in a dialog (it works on phones, where embedded PDF viewers often do not) with its own Download button; preview and PDF use the
same object, so the figures match.

**File name:** `EnergyTwin_<Name>_InvestmentReport_<YYYY-MM-DD>.pdf` from the hotel's (or organization's) name and the **user's date at the
moment of the click** (the engine has no clock). Example: `EnergyTwin_LakeshoreInn_InvestmentReport_2026-11-12.pdf`.

**Layout:** a navy header band with the Energy Twin mark and the report title on every page; a footer with "Modeled estimates · synthetic
demonstration data · not an engineering audit" (or the non-synthetic wording) and **Page N of M**; cyan accents; tables keep rows whole across
page breaks and repeat their header row; pages follow the content (a hotel report is about five pages, a portfolio report three).

**Utility data:** when the hotel has utility records (docs/19), the assumptions page adds "Utility data and baseline": source, billing period,
actual vs modeled vs calibrated use per fuel, NMBE / CV(RMSE) before and after calibration, which baseline the report used, and the limits.
Without records the section is left out.

### Hotel report (AI or custom plan)

| Page | Contents | Figures from |
| --- | --- | --- |
| 1 — Executive summary | Hotel name, report type and plan, generation date, "Modeled estimates" / "Synthetic demonstration hotel" / "Measured against a what-if" badges; the eight figures of A; the verdict and reading of F; property overview (location, rooms, floor area, year built, HVAC type, average occupancy, energy prices, plan) | A, F, the resolved profile |
| 2 — Energy performance | Current spending, electricity (kWh and $), gas (therms and $), intensity and carbon; **chart: cost by use** (`baseline.byCategory`); **chart: cost by area** (`baseline.byZone`, the key cost drivers); the before/after table (B) and **charts: energy spending, carbon, electricity and gas before vs after** | B, baseline |
| 3 — Investment analysis | Upgrades table (quantity, installed, incentive, saves a year, payback, life) with the package total; the attribution note (D); **charts: investment by upgrade and annual savings by upgrade**; what each upgrade involves (description, cost range, life, incentives); **chart: cumulative net benefit, years 0–10** (year 0 = minus the net investment; crosses $0 at payback) with the year-by-year table (savings, cumulative, discounted) | C, D, `financials.projection` |
| 4–5 — Assumptions and methodology; risks | How the model works (one paragraph); the financial assumptions (energy prices, price growth from EIA AEO, payback and NPV definitions, discount rate, no O&M or replacement, budget vs gross cost, horizon and equipment lives, occupancy, the what-if if any); **utility incentives** (counted, listed but not counted, and illustrative-only lines; see below); data sources (shortened; full notes in the app's Sources panel and docs/14); risks and limitations; the recommendation box | `financials.assumptions`, `incentives`, line sources, `baseline.sources` |

**Risks and limitations** always include: synthetic data (when it is), defaulted inputs (named), "simulated, not measured; not calibrated to
bills unless an annual bill was entered", "planning estimates with a range", incentives need pre-approval and are not guaranteed (when any
are counted), installed costs that are assumptions or bounds (when any are), the package's comfort notes, and "confirm compatibility and
scope with an energy audit or a qualified engineer". The **recommendation** repeats the verdict; for an unattractive plan it says "We do not
recommend proceeding on these figures".

### Portfolio report

| Page | Contents |
| --- | --- |
| 1–2 | Organization, hotels and city, objective, date; budget, net investment, annual savings (share of the chain's bill), payback, NPV 5 and 10, carbon, the chain's energy spend; the reading; **investment by property** table (package, net investment, savings, payback, NPV 10) with the portfolio total; **charts: investment by property and annual savings by property**; current performance and investment priority by hotel |
| 3 | Assumptions (same engine and assumptions for every hotel, the optimizer's method and notes, the summary's definitions), sources, risks |

Portfolio totals are the optimizer's `PortfolioPlan.totals` unchanged; the per-property rows are each allocation's own evaluation, and they
add up to the totals (tested).

### Incentives in the report: base case vs illustrative

- **Counted** (in every figure): incentive lines with `applied: true` (published program rates the engine applies).
- **Listed, not counted**: lines with `applied: false` (unverified programs).
- **Illustrative only, not in the base case**: `financials.illustrativeIncentives` when the engine provides it (the program-year rule: a 2025
  lighting rate is not treated as a confirmed 2026 amount). The report shows each with its amount and program year, and "if confirmed, the
  net investment would be $X instead of $Y; no other figure in this report includes them". The on-screen results show the same note in a
  dashed box. The report reads this field defensively (any array of `{label, amount, programYear?, note?}`), so it works before and after
  the field exists.

### Synthetic labeling

The report is labeled synthetic when the app says so (`selectIsSynthetic`) **or** when the hotel was started from a synthetic sample and only
edited (for example its budget). Known app issue, not changed here: editing a sample hotel's budget clears `hotelPresetId`, so the app's own
"Synthetic demo data" badge disappears although the building data are still the sample's (store, `setHotelInput`).

## State safety and performance

- Building a report only reads the store; generating the PDF changes nothing (tested: input, scenario, custom plans, plan and applied
  package are identical before and after).
- `@react-pdf/renderer` (v4, React 19 compatible) is the only new dependency. It is **lazy-loaded**: the main bundle does not include it; the
  report chunk (about 1.2 MB, 450 kB gzipped) downloads the first time a PDF is generated.
- The results recompute only when the plan, the applied package, the hotel, the baseline or the discount rate change.

## Tests

- `report.test.tsx`: an AI plan's report equals the optimizer's figures (gross, net, incentives, savings, payback, NPV 5 and 10, carbon,
  remaining budget), the cost change equals the annual savings, contributions add up to the package total, the cumulative series ends at the
  10-year net benefit, and building it changes no state; it follows the applied package and the hotel (100 to 300 rooms); a custom plan's
  report equals its evaluation; the portfolio report's rows add up to the optimizer's totals; unattractive plans are said so; illustrative
  incentives are shown and never counted; the file name; the results view renders (summary, reading, five before/after rows, upgrade
  lines, contribution, preview).
- `reportPdf.test.tsx` (node environment): a real PDF is generated for a hotel and a portfolio (starts with `%PDF-`, several pages).
- Browser (Playwright, 1440 × 900 and 390 × 844): optimizer → results → preview → download (file name and contents checked with
  `pdftotext`), custom plan download, portfolio download, Compare shows Selected upgrades, no console errors.

## Limitations

- The PDF uses the standard Helvetica font, so a few symbols are written plainly (CO2, "-" for minus).
- Charts in the PDF are drawn from the report figures; there is no chart of hourly or monthly energy (the report stays annual).
- Upgrade attribution depends on the engine's fixed order (stated in the report).
- The report does not include the stress tests (Phase 12) or the advisor's text.
