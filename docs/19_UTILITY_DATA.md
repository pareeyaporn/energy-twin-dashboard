# 19 — Utility data and model calibration (`src/utility/`, `src/engine/hotel/bills*.ts`)

Hotel operators can give Energy Twin their own electricity and natural gas bills. The bills are checked, compared with the model,
and, when the user chooses, used to **calibrate** the hotel's simulation. Everything stays a modeled estimate; calibration makes the
estimate match the hotel's billed history, it does not turn the twin into a measurement.

Built November 2026 (task block 14E in docs/11). Product decisions: docs/15 §24.

## 1. Where it is and the workflow

- **Hotel tab → Utility data** (replaces the old "Monthly bill: estimated" row). It shows:
  - the status: **Modeled estimate** (no records), **Utility data provided** (records saved, modeled baseline still in use) or
    **Calibrated model** (the user chose the calibrated baseline and calibration succeeded);
  - the source label (see §5), the billing coverage (bills, days, year), the **billed spending** (actual, from the bills) next to the
    modeled or calibrated **projection** (never mixed);
  - **Manage Utility Data** (opens the Utility Data Manager) and **Compare & calibrate** (opens it on the review step);
  - a one-off notice when results were recomputed, and "kept in this browser only".
- **Utility Data Manager — <hotel>** (a large dialog, desktop and phone):
  1. Start from **Edit sample** (default; synthetic sample bills, §5), **Upload Excel / CSV** (§3) or **Enter manually** (12 blank months).
  2. Edit the spreadsheet (§2), with live totals and coverage, errors and warnings (§4).
  3. **Apply data** saves the records for this hotel. The hotel stays on the modeled baseline.
  4. **Compare with model → Calibrate → Review results** (§6): monthly charts and metrics, then the **baseline choice** (§7).
- Elsewhere: the twin's header shows "Calibrated to bills · billed $X in YEAR" or "Modeled (bills saved, not applied)"; the portfolio
  card and table mark hotels with **Utility data** or **Calibrated to bills** (and "(sample)" for synthetic records).

## 2. The spreadsheet editor

| Feature | Behavior |
| --- | --- |
| Columns (monthly view) | Month · Electricity (kWh) · Electricity cost ($) · Natural gas (therms) · Gas cost ($) |
| Billing year | Selector (metadata for calendar-month bills; used to propose dates when switching to periods) |
| Billing periods view | Checkbox "Billing periods (start and end dates)": adds Start date and End date columns, one row per bill, **Add bill** and a remove button per row. Months convert to periods (1st to 1st of the next month) and back |
| Editing | Click a cell; **arrow keys**, **Enter / Shift+Enter** (down / up), **Tab** move between cells; Esc leaves a cell |
| Keep use and cost in step | Checkbox (on for the sample and manual entry, off for uploaded bills). Typing a month's kWh updates its electricity cost at that month's rate (cost ÷ use, captured when the cell gets focus), and typing the cost updates the kWh; the same for therms and gas cost. With no cost yet, the hotel's price is used (EIA state average or its own rate). Pasted cells are kept as pasted. Off for uploads because real bills carry fixed fees and demand charges a single rate does not follow (`src/utility/linkedCells.ts`) |
| Paste from Excel | Pasting a block of cells (tab-separated) fills from the focused cell; "$" and thousands separators are removed |
| Undo | **Ctrl/Cmd+Z** in a cell or the Undo button (last 50 edits) |
| Highlighting | Error cells outlined red (`aria-invalid`), warning cells amber; the message is the cell's tooltip and in the issues list |
| Live summary | Annual kWh, therms, electricity $, gas $, combined $, average per bill, coverage (bills and days); a line saying whether the record is **complete** (12 bills, ≥ 330 days) per fuel |
| Buttons | Download Excel template · Reset sample · Clear · Cancel · Apply data |
| Unsaved changes | Cancel, closing, or switching the source asks "Discard unsaved changes?" first; Cancel saves nothing |
| Labels | "These are my hotel's real utility records" (only for edited sample data; otherwise it stays synthetic) and "Use my bills' average rates" |

Accessibility: the table is a `grid` with row and column headers; every cell has a label like "March Natural gas (therms)".

## 3. Files: template, upload, mapping

**Download Excel template** builds a real `.xlsx` in the browser (exceljs, loaded on demand) named `EnergyTwin_UtilityData_Template.xlsx`:

| Sheet | Content |
| --- | --- |
| Instructions | What to enter, required fields, units, billing-period guidance (start = first day, end = the day after the last day), corrections, one meter per fuel, how to upload, privacy |
| Monthly Utility Data | Header `Billing year · Month · Start date · End date · Electricity (kWh) · Electricity cost ($) · Natural gas (therms) · Gas cost ($)`, 12 rows (January–December) for the selected year; number formats; data validation (month list, non-negative use, dates, four-digit year); frozen navy header |
| Example Data | The synthetic sample for this hotel, labeled "SYNTHETIC demonstration data" |

The template **uploads back unchanged** (tested: download → edit in Excel → upload → no questions, same values).

**Upload** accepts `.xlsx` and `.csv`. An Excel file is read from the "Monthly Utility Data" sheet when present, else the first sheet with
data (dates become YYYY-MM-DD; formulas give their value). Then:

1. **Column mapping** (`guessMapping`): each header is matched to Month, Billing year, Start date, End date, Electricity use,
   Electricity cost, Natural gas use, Gas cost, or "Not used". The user can change any of them.
2. **Units are never assumed.** A use column whose header names no unit ("Electricity", "Gas use") must get a unit from the user before
   import: electricity kWh or MWh (×1,000); gas therms, CCF (×1.037), Mcf (×10.37), MMBtu (×10) or Dth (×10). Gas volume uses 1,037 Btu
   per cubic foot, the EIA U.S. average already used for prices (rates.json); a utility's own heat content may differ by a few percent.
3. **Review in spreadsheet**: the converted rows appear in the editor, labeled "Uploaded utility data · <file>", for checking and fixing.

## 4. Validation (`validateGrid`, `src/engine/hotel/billsValidate.ts`)

Errors block **Apply**; warnings are shown and allowed.

| Check | Level | Rule |
| --- | --- | --- |
| Number cells | error | Not a number |
| Negative use | error | kWh or therms below 0 |
| Negative cost | warning | Read as a credit or billing adjustment |
| Zero use | warning | Allowed (closed hotel, no summer gas) |
| Missing use in a row | warning | The row is not used for the comparison |
| Month | error | Missing (monthly view), or the same month twice |
| Dates | error | Not YYYY-MM-DD / not a real date; end not after start; longer than a year |
| Long period | warning | More than 62 days (bimonthly or catch-up bill) |
| Duplicate period | error | Same start and end twice |
| Overlap | error | Two periods share days (one electricity and one gas meter: a row's period applies to both) |
| Outlier | warning | Use per day more than 3× or less than ⅓ of the median for that fuel (needs at least 6 bills) |
| Implied rate | warning | Electricity outside $0.03–$0.60 per kWh, gas outside $0.20–$5.00 per therm (unit or column mix-up) |
| Incomplete history | warning | Fewer than 12 bills or 330 days for a fuel: saved and compared, not calibrated |
| Missing columns / units | blocks import | Handled in the mapping step (§3) |

**Meters.** One electricity meter and one gas meter (the monthly editor and the template). Several meters with their own billing
periods are not supported yet: add them up per bill first (stated in the template). An advanced multi-meter import is later work.

## 5. Sample, user-entered, uploaded and calibrated

| Label | Meaning |
| --- | --- |
| **Sample data (synthetic)** | Built from this hotel's own modeled months, shifted on purpose (electricity weather-independent ×1.06 and weather ×0.88; gas ×0.94 and ×1.12) with a fixed ±2.5% month-to-month wobble; costs = use × the hotel's current rates. Year 2025. Never real data (`src/engine/hotel/billsSample.ts`) |
| **Edited sample data (synthetic)** | The sample after any edit. Stays synthetic unless the user ticks "These are my hotel's real utility records" |
| **User-entered data** | Started blank (Enter manually) |
| **Uploaded utility data** | From a file (the file name is kept) |
| **Calibrated model** | A status of the hotel, not of the data: the user chose the calibrated baseline and calibration succeeded |

Uploading or entering data does **not** calibrate the model; the baseline changes only when the user chooses it (§7).

## 6. Calibration method (`src/engine/hotel/bills.ts`)

For each fuel f (electricity, gas), the uncalibrated model's use in month m is split into a weather-independent part and a
weather-driven part, from the simulation's load kinds:

```
B_f,m = (base + occupancy + schedule load kinds) × fuel share      W_f,m = (weather load kind) × fuel share
```

**Bills against the model.** A calendar-month bill i compares with month m. A billing period covers its days from start (inclusive) to
end (exclusive); each day maps to the same date of the model's typical year and takes `1/days_in_month` of that month:

```
B_i = Σ_days B_f,m(day) / days_in_month      W_i = Σ_days W_f,m(day) / days_in_month      model_i = B_i + W_i
```

So a 28-day bill is compared with 28 modeled days, not a 31-day month.

**Fit.** Two multipliers per fuel, fitted to the bills y_i by bounded least squares:

```
minimize Σ_i ( y_i − a·B_i − b·W_i )²     with a, b in [0.5, 2.0]
```

The unconstrained solution is used when it lies inside the bounds; otherwise the best solution on the edges (one factor at its bound,
the other fitted and clamped). A factor at a bound is flagged ("check floor area, systems, missing meters").

- **a** scales the weather-independent part (base loads, occupancy-driven use, schedules); **b** scales the weather-driven part
  (heating, cooling and fan energy that follows degree days). They are physically meaningful and few, rather than one multiplier on
  everything.
- **Weather part fitted only when identifiable:** at least 10% of the fuel's modeled use over the billed days follows the weather, and
  its daily rate varies by at least 25% (coefficient of variation) between bills. Otherwise only **a** is fitted and **b** = 1 (the
  weather part stays as modeled), and the report says so.
- **Enough data:** a fuel is calibrated only with **12 bills covering at least 330 days** (ASHRAE Guideline 14 uses 12 monthly values).
  Fewer bills are compared with the model but not used.
- **Fit good enough:** the calibrated fuel is used only if its CV(RMSE) is at most **30%** (twice the Guideline 14 limit) and not worse
  than the original model's. Otherwise the modeled values are kept, with the reason.
- **Each fuel on its own:** one fuel may be calibrated while the other keeps the model.

**Applying it.** In the simulation every cell's electric and gas parts of each load kind are multiplied by that fuel's a (base,
occupancy, schedule) or b (weather). Scenarios, stress tests and upgrade evaluations re-simulate with the same factors, so a what-if or
an upgrade is measured against the calibrated hotel. Cost and carbon follow from the calibrated kWh and therms with the hotel's rates
(state averages, or the bills' average rates when the user ticks that option) and emission factors.

**Metrics** (ASHRAE Guideline 14-2014, monthly), for n bills and p fitted parameters (0 for the original model):

```
NMBE     = Σ(y_i − ŷ_i) / ((n − p) · ȳ) × 100                 (overall bias; positive = bills higher than the model)
CV(RMSE) = √( Σ(y_i − ŷ_i)² / (n − p) ) / ȳ × 100             (typical bill-by-bill miss)
```

A fuel **meets Guideline 14's monthly criteria** with 12 bills, |NMBE| ≤ 5% and CV(RMSE) ≤ 15%. The review shows, per fuel: the bills,
the original model and the calibrated model by bill (chart), totals and % differences, NMBE and CV(RMSE) before and after, the fitted
factors and mode, the coverage, the verdict and any reason. A spending chart compares billed $ with modeled $ by month.

**On the synthetic sample** (100-room demo hotel): electricity factors ×1.060 / ×0.893, gas ×0.939 / ×1.120 (the built-in shift,
recovered within the ±2.5% wobble); before calibration NMBE 2.6% / CV(RMSE) 4.2% (electricity) and 0.3% / 4.3% (gas); after
−0.0% / 1.7% and 0.0% / 0.9%, both meeting Guideline 14. Annual cost: $120,178 modeled → $122,894 calibrated (billed: $122,866).

## 7. Choosing the baseline

After applying records, the review offers **Original modeled baseline** or **Calibrated baseline** (disabled, with the reason, when
calibration is not possible). The active one is marked.

- The baseline never switches by itself: saving new records puts the hotel back on the modeled baseline until the user chooses again.
- Switching recomputes every result for the hotel: the twin, KPIs, scenarios, stress tests, upgrade comparison, custom plans, the
  optimizer (it runs on the selected baseline), the portfolio totals and the advisor's context. Investment results made on the other
  baseline are cleared, with a notice, so the AI plan is never compared against the wrong baseline.
- **Remove data** deletes the records and restores the modeled baseline. **Reset demo** clears all utility data.
- Equipment and building inputs are unchanged by calibration; the factors are separate calibration parameters (shown in the review).

## 8. Persistence and privacy

- Records are kept per hotel in this browser's local storage (`energy-twin:utility-data:v1`), keyed by the portfolio property id (the
  100-room preset and Lakeshore Inn share theirs). Each hotel's data is independent. Stored data is sanitized when read (sample data can
  never be marked real; malformed entries are dropped).
- Browser-only: another browser or device does not see them; clearing site data removes them. The UI says so.
- Files are read in the browser. Nothing is uploaded to Energy Twin's servers or to the AI advisor: the advisor's context only gains
  `baseline.source` ("modeled estimate" or "calibrated to utility bills") and the calibrated results, never the records (docs/12).

## 9. Limitations

- **No historical weather normalization.** Bills are compared with a normal-weather year (NOAA 1991–2020 normals), not the weather of
  the billing year. An unusually hot or cold year is absorbed into the factors (mostly **b**). Normalizing to actual weather needs daily
  historical weather for the billing periods (not implemented).
- **No hourly accuracy claim.** Monthly bills say nothing about individual hours; the hourly twin remains a simulation.
- Billing periods map onto a typical year (the year of the dates is not modeled); a leap day counts as a February day.
- One electricity and one gas meter; demand charges and tariff structure are not modeled (all-in average rates).
- Bounds, thresholds and the CV(RMSE) acceptance limit are product decisions (docs/15 §24), not standards (except the Guideline 14
  criteria, which are reported, not required).
- Calibrated results remain estimates; they are not an investment-grade audit or a measurement and verification baseline.

## 10. Code map and tests

| Part | File |
| --- | --- |
| Calibration, periods, metrics | `src/engine/hotel/bills.ts` (`calibrationReport`, `calibrateFuel`, `fitFactors`, `fitMetrics`, `billDays`, `CALIBRATION_RULES`) |
| Import and units | `src/engine/hotel/billsImport.ts` (`parseCsvText`, `guessMapping`, `tableToGrid`, `ELEC_UNITS`, `GAS_UNITS`) |
| Validation | `src/engine/hotel/billsValidate.ts` (`validateGrid`, `VALIDATION_RULES`, `recordsToGrid`) |
| Sample | `src/engine/hotel/billsSample.ts` |
| Baseline integration | `src/engine/hotel/baseline.ts` (`calibrateToBills`, per-kind fuel factors in `simulate`) |
| Store | `src/store/utilityData.ts`, `useTwin` (`utilityData`, `saveUtilityData`, `removeUtilityData`, `setUtilityBaseline`, `hydrateUtilityData`), `hotelDerived` (`selectUtilityKey`, `selectUtilityAnalysis`, `selectUtilityStatus`) |
| UI | `src/utility/` (`UtilityDataSection`, `UtilityDataManager`, `SpreadsheetGrid`, `CalibrationReview`, `UtilityBadge`, `excel.ts`) |
| Tests | `src/engine/hotel/__tests__/bills.test.ts` (calibration recovers known factors, bounds, insufficient data, poor fit, periods, metrics, units, validation), `src/test/utilityStore.test.ts`, `src/test/UtilityDataManager.test.tsx`, `src/test/utilityExcel.test.ts` (xlsx round trip) |

**In the investment report:** when the hotel has records, the report (preview and PDF) adds "Utility data and baseline": the source (sample
data is labeled synthetic unless marked as real), the billing period, actual vs modeled vs calibrated use per fuel, NMBE and CV(RMSE) before
and after, the baseline the report's figures used (calibrated only when the user chose it), and the limits (normal-year weather, no hourly
accuracy). Built by `utilityForReport` (`src/report/fromStore.ts`) from `selectUtilityAnalysis`.
