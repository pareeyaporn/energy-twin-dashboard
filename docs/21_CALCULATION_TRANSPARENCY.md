# 21 — Calculation transparency (`src/explain/`)

Improvement 6: every major figure says what it means, how it is calculated, which inputs it uses and where each input comes from. The
explanations are written from the engine's real inputs for the open hotel (`explain(metric, state)` in `src/explain/explanations.ts`); they
describe the implementation in `src/engine/hotel` (docs/13). **If the engine changes, update the matching entry.** Tests in
`src/test/explain.test.tsx` check the quoted values against the engine.

## Where it appears

| Place | Figures with "How was this calculated?" (ⓘ) |
| --- | --- |
| KPI strip (twin header) | Annual energy cost, annual energy use, carbon |
| Recommended investment plan (`src/report/ResultsSummary.tsx`) | Recommended investment (installed cost), estimated annual savings, payback, NPV (5 and 10 years), carbon avoided |
| Energy insight cards (`src/insights/`) | Each card's own "How was this calculated?" (docs/13 §14) |
| Sources panel (top bar → Sources) | Financial assumptions list, data labels, the model's main sources |
| Portfolio homepage KPIs | Annual energy cost, savings potential, carbon, energy intensity (portfolio-level: the sums over the hotels shown); investment priority has its own "Why this ranking?" explainer |

The ⓘ opens a short panel: what it means, how (one or two sentences), the main inputs with a data label. "More detail" adds the technical
formula, the sources and the limits. Every panel ends with the estimate statement below.

## Data labels (6C)

| Label | Meaning | Examples |
| --- | --- | --- |
| Published source | A rate, coefficient or program rule from an identifiable source | EIA prices, NOAA normals, eGRID factors, AEO price growth, IL-TRM measure lives, ComEd 2026 rates |
| Your input | Entered by the operator | Rooms, floor area, occupancy, rates you typed, utility bills |
| Modeled estimate | Calculated by the engine | Annual cost, energy, carbon, savings, payback, NPV |
| Synthetic demo data | Illustrative properties for the hackathon | The five Lakefront Hotel Group hotels and the presets |
| Assumption | Used where no reliable published value was found | 8% discount rate, analysis year, some installed costs, defaulted inputs |

A hotel input is "Your input" when you set it, "Synthetic demo data" when it is set by a demo hotel, and "Assumption" when the engine used a
default. Rates are "Published source" when they are the EIA state averages and "Your input" when typed or derived from your bills.

## Explanations (what each says)

| Figure | How (as implemented) | Main inputs | Main limits |
| --- | --- | --- | --- |
| Annual energy cost | Simulated kWh × electricity price + therms × gas price, by zone, end use and month | Building, location (NOAA), occupancy, calibration, prices | All-in average prices (no demand charges); typical weather year |
| Annual energy use | Same simulation, electricity at 3.412 kBtu/kWh and gas at 100 kBtu/therm | Building, location | Site energy, not source energy; modeled unless calibrated |
| Carbon | kWh × eGRID subregion factor + therms × 5.311 kg CO₂e | Grid subregion, gas factor (EPA GHG Hub 2025) | Annual average factors, not marginal; not verified savings |
| Energy intensity | Site kBtu ÷ floor area | Floor area | Context only against national medians |
| Annual savings | Cost before minus cost after the upgrades, applied in order so interactions count once | Prices, savings rates (low/mid/high) | Range shown; not guaranteed |
| Installed cost | Each upgrade's unit cost × quantity, low/mid/high | Published unit costs where found | Not quotes; some costs are assumptions |
| Incentives | Counted only when verified and the program year is the analysis year (2026); other years shown as illustrative | Programs available in the hotel's state | Funds limited; pre-approval; never guaranteed |
| Payback | Net investment ÷ first-year savings | — | No time value of money; compare with equipment life |
| NPV | Σ savings_t / (1 + r)^t − net investment, savings growing with AEO prices | Discount rate (8%, editable), price growth | No residual value; maintenance for solar only |
| Net benefit | Same savings stream, undiscounted, minus net investment | Price growth | Undiscounted |
| Savings potential | Per hotel, the package with the highest positive 10-year NPV within its budget; first-year savings; portfolio = sum | Each hotel's budget | Not the technical maximum |
| Investment priority | Best package's 10-year NPV ÷ net investment, scaled 0–100 against the portfolio's best | Each hotel's best package | High spending alone does not raise it |

## Financial assumptions (6E)

The Sources panel lists them with their labels (`financialAssumptions(state)`): discount rate (8%, editable in the Invest tab; 3% alternative),
electricity and gas prices, price growth (electricity 2.12%, gas 4.09% a year, EIA AEO 2026), horizons (5 and 10 years), analysis year
(2026), equipment life (per upgrade, from each upgrade's source), installed costs (published where found, otherwise assumptions),
maintenance (solar operation and maintenance $17.63 per kW a year, NREL ATB 2025; others not modeled) and incentives (verified 2026 rates
only). The discount rate is the only one editable in the app; changing it recalculates every payback, NPV and net benefit, the optimizer and
the report.

## Incentive transparency (6D)

Already implemented in the engine (docs/15 §21) and reflected in the explanations: program year on every program, only verified current-year
rates in the base case, 2025 ComEd lighting rates shown separately as illustrative, programs limited to their territory (Illinois), and the
ComEd rules (pre-approval at $10,000, 90% cap, limited funds) quoted in the notes.

## Confidence and limitations (6F)

No confidence score or accuracy figure is shown. Where a defensible range exists (savings low/mid/high, installed cost low/mid/high) it is
shown; everything else carries the statement: *"Results are modeled estimates based on the selected building profile and assumptions.
Actual savings may differ."*

## Sources panel change

The Sources panel listed the home-era references (NREL ResStock, EIA RECS, Rewiring America). It now lists the hotel model's sources (EIA
prices and AEO, NREL ComStock, NOAA normals, EPA eGRID, NREL PVWatts, Illinois TRM, ComEd worksheets, LBNL solar prices), with the plan's own
line-item sources above them (minimal edit in Lovable's `SourcesSheet.tsx`). Links to comstock.nrel.gov, pvwatts.nrel.gov, ilsag.info and
emp.lbl.gov could not be opened from the build sandbox (blocked or bot-protected); check them on the demo laptop.
