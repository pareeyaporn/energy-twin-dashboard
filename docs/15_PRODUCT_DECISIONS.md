# 15 — Product decisions

These are **choices the team made**, not externally validated facts. Each one says what was decided, how the engine applies it, and where it
can be changed. Sourced data is logged separately in [14_RESEARCH_LOG.md](14_RESEARCH_LOG.md); the method is in
[13_HOTEL_ENGINE_SPEC.md](13_HOTEL_ENGINE_SPEC.md). Decided November 2026.

## 1. Discount rate and NPV

- **Decision:** 8% a year is the default discount rate for commercial investment analysis; 3% is offered as an alternative scenario.
- **Applied:** NPV over 5 and 10 years (`financials.npv5`, `financials.npv10`, with `financials.discountRate`) discounts the same savings stream as
  the net benefit. NPV is for the detailed comparison; the main upgrade cards keep **simple payback** (net investment ÷ first-year savings), which
  does not depend on the discount rate. The optimizer's rankings (savings, payback, net benefit, ROI, carbon) also do not use it.
- **Edit:** `defaults.json` → `finance.discountRate` (default) and `discountRateAlternatives`; at run time the store's `hotelDiscountRate` /
  `setHotelDiscountRate(r)`, which re-measures the comparison cards and clears the plan so it is re-run with the new rate.

## 2. Optimizer rules

- **No minimum savings share.** The 1% of the bill threshold is removed (`OPTIMIZER_DEFAULTS.minSavingsShare = 0`), because small upgrades can still
  be financially attractive. A package must still save money (first-year savings above zero). Callers can set `minSavingsShare` if they want one.
- **Comfort constraint kept.** Packages scoring below **0.70** are excluded (`minComfortScore`). The comfort score (`comfortFor`) is:
  `score = 1 − 0.05 × (upgrades with a minor comfort impact) − 0.15 × (comfort warnings)`, clamped to 0..1.
  Minor-impact upgrades today: smart room controls (recovery time after a setback), occupancy sensors (a missed detection can leave a space dark),
  energy management controls and water heating with low-flow fixtures. Positive-impact upgrades (insulation, HVAC equipment) add a note but no
  penalty. Comfort warnings come from the operating conditions: heating or cooling setpoints outside the usual range, setpoints crossed, deep
  vacant-room setback, short common-area HVAC or lighting hours. Edit: `upgrades.json` → `comfortScore` and each upgrade's `comfort.impact`.
- **Balanced score, configurable and normalized.** `balancedScore = wF × F + wC × C + wK × K`, where
  F = net benefit over the hotel's horizon, min-max scaled to 0..1 across the feasible packages;
  C = CO2 avoided per year, min-max scaled the same way; K = the comfort score (already 0..1).
  The weights default to 0.5 / 0.3 / 0.2 and can be passed as `balancedWeights`; any non-negative numbers are scaled to sum to 1
  (`normalizedWeights`). Ties break on lower cost, then id, so results are deterministic.

## 3. HVAC system types

- **Decision:** model PTAC (electric resistance heat), PTHP (heat pump), central plant (gas boiler and chiller), plus VRF (heat pump) and rooftop
  units (gas).
- **Applied (`defaults.json` → `heatingSystems`):** the CBECS lodging heating share is treated as a gas-heated hotel at 80% seasonal efficiency;
  other systems use `0.80 ÷ their efficiency` as much site energy. Efficiencies: gas boiler or furnace 0.80, electric resistance 1.0, heat pump
  COP 2.3 (the IL-TRM conversion). The same efficiencies are used for setback recovery, and the lighting-to-heating interaction uses the IL-TRM factor
  for the heating kind (gas, resistance, heat pump). Cooling-efficiency differences between systems are **not** modeled yet.
- **Edit:** `heatingSystems` efficiencies; the profile's `hvacType`.

## 4. Additional upgrades

- **Scalable solar (done):** solar is offered at a quarter, half and all of the usable roof (`rooftop_solar_quarter`, `rooftop_solar_half`,
  `rooftop_solar`). The three exclude each other, so a package holds at most one; the optimizer only enumerates valid combinations
  (512 for seven other upgrades and four solar choices). Each size is priced from the region's $/W and keeps the same output, degradation and O&M
  per kW. A smaller array fits a limited budget; at $50,000 the 300-room hotel's balanced package includes the quarter-roof array.
- **Heat-pump HVAC and heat-pump water heaters (deferred):** no sourced cost and performance for commercial hotel-scale systems were found (the
  IL-TRM water-heater measure covers tanks up to 120 gallons, and there is no hotel heat-pump conversion measure). They will be added only with
  sourced values. The exclusion mechanism they need (one HVAC option and one water-heating option per package, no double counting) is the same one
  solar now uses.
- **No double counting:** upgrades are applied in a fixed order to the hotel's own loads (never added as percentages); overlapping measures
  (energy management with smart controls, lighting with occupancy sensors) are handled in the savings model, and mutually exclusive options use
  `excludes`.

## 5. Emissions

- **Decision:** use the verified, location-specific EPA eGRID factor; for the Chicago demo, the RFC West (RFCW) subregion that serves ComEd.
- **Applied (`emissions.json`):** all 27 eGRID2023 subregions (CO2e). The subregion comes from the profile's `gridSubregion` if set, else the city
  (`cityToSubregion`), else a state default (`stateDefaultSubregion`; Illinois → RFCW, though Ameren territory is SRMW), else the U.S. rate.
  It is listed in `hotel.defaulted` when not set by the user.
- **Edit:** the profile input `gridSubregion` (any eGRID acronym), or the mappings in `emissions.json`.

## 6. Incentives

- **Decision:** prioritize a credible simulation over rebate coverage. An incentive is used only when its amount and eligibility are verified.
- **Applied (`incentives.json`):** modular programs with an amount rule (percent of cost, per kW, per room or fixed). Each stays `status:
  'unverified'`, shown as "not applied", and contributes $0 until `applied` and `verified` are both true. Users can enter a confirmed amount per
  upgrade. ComEd: the 2026 Standard Incentives Application rules are recorded; the measure amounts are in worksheets not read yet. Federal §48E:
  facts recorded from IRS Notice 2025-42, not applied (eligibility depends on dates and labor requirements).

## 7. Comfort limits

- **Decision:** warnings when occupied rooms are heated below 67 °F or cooled above 77 °F, common-area HVAC runs under 20 hours, the vacant setback
  goes below 58 °F or above 82 °F, or heating is set above cooling; vacant setpoints never go below 55 °F or above 85 °F.
- These are team choices for flagging, **not values from ASHRAE Standard 55** (a paid standard that was not consulted). Review them against it before
  claiming compliance. Edit: `defaults.json` → `comfort` and `vacantLimits`.

## 8. Calibration choices made earlier (also decisions)

- Smart room controls: guest-room fan saving of 17% while rooms are empty, calibrated to the IL-TRM range (`defaults.smartControlFan`).
- Insulation: reduction scaled by 5 ÷ floors above 5 floors.
- Budget compared with the **gross** cost (most incentives arrive after installation).
- Demo hotels are synthetic; the 100-room hotel is a boutique-size property, the 300-room preset a typical downtown size.

## 9. The 3D twin and projections (November 2026)

- **3D is the default view on desktop** when WebGL works and effects are not reduced; phones, no WebGL and "reduce effects" use 2D.
- **Realistic look by default**, with an "Energy view" toggle for the cost heat map; the selected zone always shows its cost color.
- **Hourly outdoor temperature is modeled**, not measured: a two-part cosine through the NOAA normal low at sunrise and high at 15:00,
  labeled "modeled". Every hour shown is a typical day of that month.
- **People on the street** are counted from guests booked but out at the hour (up to 12 on the street, 4 at the door); their walking and the
  traffic are illustrative. Scenery (trees, snow, sky) follows the calendar and is not data.
- **Solar without an array**: no panels; selecting the roof shows a translucent full-roof preview labeled "Not installed — potential".
- **Projection horizon: 10 years**, the same savings stream as the 5- and 10-year net benefit and NPV (so they always agree).
- **Peer benchmark is context, not calibration**: the model is not adjusted toward ENERGY STAR or CBECS values.

## 10. Custom investment plans (November 2026)

- **Partial quantities are linear in scope**: half the rooms with smart controls save half and cost half (rooms are modeled alike);
  the same for the share of lighting, common area and roof. A simplification, not a measured result.
- **LEDs are entered as a share of the hotel's lighting**, not fixtures: the model has no fixture inventory.
- **Energy management, HVAC equipment and water heating are on or off** for the whole hotel; partial versions are not modeled.
- **Upgrades not modeled** (heat-pump HVAC, heat-pump water heaters, battery storage, window film) are listed as "Not modeled yet",
  with no figures, and cannot be selected.
- **Plans are kept in the browser's local storage**; only choices are stored, every figure is recomputed by the engine.

## 11. Solar prices and export credit (November 2026)

- **Solar price per W follows the LBNL 2024 national medians by system size**, before incentives, labeled as national benchmarks, not
  Chicago quotes. The ±15% range around each median is a team placeholder. Users can override the price per W for their hotel.
- **Export credit stays $0** until the hotel's tariff is confirmed (docs/14, pass 5); users can enter a value. It does not affect the
  presets, which export nothing.

## 12. Stress tests (November 2026)

- **Magnitudes are illustrative what-ifs, not forecasts**: heat wave +10 °F in July; cold snap −12 °F in January; low solar −15% for a year
  (PVWatts year-to-year variation is smaller in most years); conference surge +25 points in September; off-season −20 points in
  January–March; HVAC decline +10% heating and cooling energy; electricity and gas +20%.
- **Temporary events** (weather, occupancy, a cloudy year) show their effect in the year they happen. They do not change payback, NPV or the
  recommendation, because how often they recur is not modeled, and they do not switch the optimizer to the stressed hotel.
- **Persistent changes** (HVAC decline, price rises) are re-evaluated every year: payback and NPV are shown under them, the optimizer
  switches to them as before, the user's plan from before the test is kept for the comparison, and the panel says whether the pick changes.
- **The plan tested** is the AI package applied to the twin, otherwise the active custom plan, otherwise the AI's pick; the user can choose.

## 13. ComEd incentives (November 2026)

- **Applied only from the utility's own worksheets**, at the published rate, capped at 90% of the upgrade's cost. The lighting rates are from the
  2025 worksheet (the latest provided) and are applied with that label; confirm the 2026 rates before a real project.
- **Watts and tons are estimated** from the hotel's modeled equipment (placeholders) and a 0.75 ton-per-room assumption, so incentive amounts are
  estimates, like the savings. Pre-approval and eligibility are the hotel's to confirm.
- **The budget is still compared with the gross cost** (incentives arrive after installation); payback, net benefit and NPV use the net investment.

## 14. ComStock climate data (November 2026)

- **Chicago uses ComStock's zone-5A hotel stock** for its end-use split, energy intensity and hourly shapes; other climates keep CBECS national
  values. ComStock is a calibrated simulation of the building stock, not a survey; CBECS is a survey but national.
- **The age factor is a stock average by vintage** (it also reflects which HVAC systems hotels of each era have), not an effect of age alone.
- **Guest presence by hour stays synthetic**, and the unsourced internals (zone allocation, plant share, driver weights) are calibration choices.

## 15. Cost assumptions (November 2026)

- **One occupancy sensor per 250 ft² of common area** converts the IL-TRM's per-sensor costs to a cost per ft² (an assumption).
- **PTAC/PTHP replacement uses the TRM's early-replacement full cost** ($1,047 per ton): the upgrade replaces working units.
- **Where only incremental costs are published** (LED fixtures, chillers), the model keeps a full-retrofit placeholder and records the TRM value as a
  lower bound, rather than understating the cost.

## 16. Hotel portfolio (November 2026)

- **A synthetic chain of five Chicago hotels** ("Lakefront Hotel Group", `src/data/hotel/properties.json`), labeled "Demonstration property"
  wherever shown. Their segments differ by size, age, HVAC type, occupancy and guest hours; the occupancy and guest-hour values for the three new
  properties are assumptions (docs/13 §13). Two reuse the presets, so the single-hotel demo figures are unchanged.
- **Savings potential** = the annual savings of the property's best package by 10-year NPV, among packages within the **property's own budget**
  with a positive 10-year NPV. **Investment required** = that package's net investment. **Priority score** = 10-year NPV per dollar of net investment,
  scaled 0–100 so the best property scores 100 (relative to this portfolio only).
- **One package per property** in the portfolio optimizer, chosen from the same combinations as the single-hotel optimizer; **the budget is
  compared with gross cost** (as for one hotel); costs are rounded up to $1,000 steps so the plan never exceeds the budget.
- **Fastest payback gives every property a package when the budget allows**, then minimizes the chain's payback (otherwise the exact answer is one
  small package at one hotel). If the budget cannot cover every property, it minimizes payback over any selection.
- **Balanced** = 10-year NPV and carbon, each scaled by the best package in the portfolio and weighted 0.5 / 0.3 (renormalized from the
  single-hotel weights); comfort is the same limit every package must pass, not a score, because it does not add up across hotels.
- **The portfolio uses each property's baseline** (no what-if or stress test); edits made to a property's profile in its twin flow into the portfolio.
- **Opening a property saves the previous one** (input, what-if, stress test, plan, saved scenarios, advisor messages) and restores it on return.
  Custom plans are tagged with the property they were made for; plans made before the portfolio existed show for every hotel.
- **Map colors:** energy cost and intensity use the twin's heat-map scale (blue → amber → red); savings potential and priority use one green hue
  (dim → bright). The cost view carries a note that larger hotels naturally spend more.
- **My portfolio** uses one custom plan per hotel: the one chosen, else the hotel's latest plan; plans are measured on the hotel's baseline (like the
  AI portfolio), so a plan can show different figures here than in a twin where "optimize for this scenario" is on. Both portfolios use one totals
  function, so they compare like for like; comfort is shown as the lowest score among the chosen plans.
- **Portfolio stress tests** apply the single-hotel test to the chosen hotels only; the others keep their normal-year cost. Plans are the AI
  portfolio (none until the optimizer has run), my portfolio, or none. The check whether a hotel's recommendation changes under a persistent
  change stays in each hotel's twin, because it needs two optimizer runs per hotel.

## 17. Demo hardening wording (November 2026)

- **Incentives are "utility incentives at published rates"**, not "verified": the amounts follow ComEd's published worksheets, are estimated from
  the modeled equipment, and need the utility's approval for a real project.
- **"AI recommended" means the optimizer's pick.** Both investment views say so: the optimizer tests every combination with the energy model,
  and the AI advisor only explains results.
- **Every portfolio hotel is labeled synthetic** on every screen, not only the two presets.
- **"Reset demo" clears everything in the browser** (including saved custom plans) but keeps the reduce-effects preference.
