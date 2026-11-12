# 13 — Hotel engine spec (`src/engine/hotel/`)

What the Phase 1 engine computes and the assumptions behind it. Code and tests live in `src/engine/hotel/`; data in `src/data/hotel/`.
All data values are **synthetic placeholders** (`verified: false`) except the EIA commercial prices in `rates.json`. Outputs are **estimates**.

## 1. Scope
**Does:** monthly and annual energy, cost and carbon by zone, end use and month; occupancy, setpoint, schedule, weather and price what-ifs with
the reasons for each change and comfort flags; hourly "typical day" profiles, room-by-room occupancy, equipment lists and energy flows for the twin.
**Does not (yet):** hourly or daily simulation of a real year, demand charges and tariff structures, real weather, equipment-level physics, the optimizer
(Phase 3), or measured data. Upgrades, costs and financial metrics are in section 8. No randomness anywhere: the same input always gives the same output.

Conventions: electricity in kWh, gas in therms, cost in US dollars (not rounded; round only for display), site energy in kBtu
(3.412 kBtu per kWh, 100 kBtu per therm), temperatures in °F, a 365-day year.

## 2. Inputs and defaults (`resolveProfile`)
Every input is optional. Missing inputs get a default from `src/data/hotel/defaults.json` and are listed in `defaulted`, so the UI can show
"default (estimate)". Out-of-range values are clamped and described in `notes`.

| Input | Default |
| --- | --- |
| rooms | 100 |
| floor area | rooms × 550 ft² |
| floors | ceil(rooms / 20), 1 to 20 |
| year built | 1998 |
| operating hours | 24 |
| HVAC type | central plant (PTAC, VRF, central plant, RTU supported) |
| occupancy (annual average) | 65%, shaped by a seasonal curve (lower in winter, peak July) |
| occupied hours per room | 14 h/day a guest is present in a booked room |
| setpoints | occupied 68 °F heat / 74 °F cool; vacant = occupied unless smart controls are on |
| common-area HVAC hours, lighting hours | operating hours, 24 |
| hot water | 20 gal per occupied room per day |
| electricity and gas price | EIA commercial price for the state (Illinois: $0.1405/kWh, $0.929/therm); U.S. average if the state is unknown |
| monthly energy bill | none (benchmarks are used and the result is flagged estimated) |
| budget, horizon, objective | $50,000, 5 years, balanced |

## 3. The model
**Benchmark annual energy.** `site kBtu = EUI × floor area × age factor × calibration factor`, with EUI 92 kBtu/ft² (placeholder), age factor 1.10
(before 1980), 1.00 (1980 to 1999) or 0.92 (2000 or later).

**End uses and fuels.** The annual energy splits by end-use share: heating 22%, cooling 9%, ventilation 7%, lighting 11%, hot water 19%,
kitchen 7%, equipment 15%, other 10% (placeholders). Fuel: cooling, ventilation, lighting, equipment and other are electric; hot water is 80% gas;
kitchen 55% gas; heating follows the HVAC type (central plant and RTU gas, PTAC and VRF electric).

**Zones.** Each end use is allocated to six zones. HVAC end uses go to the central plant by a plant share that depends on the HVAC type (15% PTAC,
30% VRF, 60% central plant, 35% RTU) and the rest to guest rooms, lobby, kitchen and hallways by fixed shares. Lighting, equipment and other use fixed
allocations; cooking and refrigeration is all kitchen; all hot water is the hot-water zone.

**Monthly spread.** For each zone and end use with annual energy `E0`:

```
monthly = E0 × ( wBase × days/365
               + wOcc × occupancy_m × days / (0.62 × 365)  [× hot-water scale for hot water]
               + wWeather × weatherIndex_m × setpointOrScheduleMultiplier
               + wSched × scheduleFactor × days/365 )
```

The four weights per end use sum to 1 (for example heating 0.10 / 0.10 / 0.80 / 0; lighting 0.35 / 0.35 / 0 / 0.30), and each driver equals 1 at the
benchmark conditions, so a hotel at 62% occupancy with default settings and normal weather returns exactly `E0`. That is how **energy responds to
occupancy without scaling linearly**: only the occupancy weight moves with it, the base weight never does. `occupancy_m` is the annual average times the seasonal
curve (day-weighted mean 1), capped at 100%.

- **Weather index:** heating uses heating degree days, cooling uses cooling degree days, ventilation uses both, each divided by its normal annual total
  (degree days from monthly mean temperatures, 65 °F balance point). A weather offset shifts the temperatures.
- **Guest-room setpoints:** the weather part of guest-room heating and cooling is multiplied by `presence × g(occupied setpoint) + (1 − presence) × g(vacant setpoint)`,
  where `presence = occupancy × occupied hours / 24` and `g(T) = 1 + 3% per °F` for heating (relative to 68 °F) and `1 + 4% per °F` for cooling (relative to 74 °F).
  Smart room controls set vacant and away rooms back 5 °F (limits 55 °F and 85 °F).
- **Common areas:** lobby and hallways HVAC weather loads fall by 60% of the hours cut (`1 − 0.6 × (1 − hours/24)`, recovery included); lighting and ventilation
  schedule loads scale with the hours.
- **Central plant:** its multiplier is the load-weighted average of the zones it serves, so a guest-room setback also lowers what the plant delivers.
- **Hot water:** the occupancy term scales with gallons per occupied room relative to 20.

**Calibration.** With a monthly bill, the benchmark is scaled by `12 × bill / modeled annual cost`, bounded to 0.4 to 2.5. Outside that range the
result is clamped and flagged estimated. Without a bill the result is flagged estimated. Scenarios reuse the same factor.

**Cost and carbon.** Cost = kWh × electricity price + therms × gas price (all-in average prices; no separate demand charges). Carbon = kWh × grid
factor + therms × 5.31 kg (illustrative grid factors; not verified carbon accounting).

## 4. Scenarios
`simulateEnergyScenario(profile, scenario)` returns before, after, delta (also by zone and category), drivers and comfort flags.
A scenario can change occupancy (annual or by month), occupied hours, setpoints, smart controls, common-area HVAC hours, lighting hours, hot water,
electricity and gas price (percent) and the weather (a single offset or one per month). `simulateOccupancyChange` and `simulateHVACSettings` are shortcuts.

**Drivers.** The scenario's parts are applied one at a time in a fixed order (occupancy, setpoints and controls, schedules, weather, prices); each step's
change becomes a driver with the biggest zone and end-use movers as text. The drivers sum exactly to the total change, but the split between drivers depends on that order.

**Comfort flags** (thresholds are placeholders): occupied setpoints outside about 67 to 77 °F, common-area HVAC under 20 hours, common-area lighting under
20 hours, a deep vacant setback, and an informational note when smart controls are on.

**Stress tests** for the twin: heat wave (July +10 °F), cold snap (January −12 °F), conference surge (+25 occupancy points in September), electricity +20%.
They are monthly-resolution approximations of a week-scale event.

## 5. Twin data
- `typicalDayProfile(result, month)`: 24 hourly points (electric kW, gas therms per hour, cost per hour, by zone) from each end use's normalized hourly shape. The 24 hours × days
  reconcile exactly to the month's totals.
- `simulatedMeter(result, month, hour)`: a reading from that profile, always marked `simulated: true`.
- `roomOccupancyPattern(profile, conditions, month, hour)`: every room is `occupied`, `away` or `vacant`. Booked rooms = round(occupancy × rooms), chosen by a golden-ratio
  low-discrepancy order so they spread over the floors; guests present follow the hourly presence curve scaled to the occupied hours per room. `setback` marks away and vacant
  rooms when smart controls are on.
- `equipmentInventory(profile)`: major equipment per zone with rule-of-thumb sizing, each flagged estimated.
- `energyFlows(result)`: grid and gas → zones → categories with cost and site energy; cost is conserved at every node.

## 6. Demo hotel sanity check (synthetic 100 rooms, Chicago, 55,000 ft², central plant, 60% occupancy)

| Metric | Result |
| --- | --- |
| Energy | 866,000 kWh and 20,500 therms; EUI 91 kBtu/ft² |
| Cost | $140,700 per year ($1,407 per room; $11,700 a month) |
| Carbon | about 455 t CO2e (illustrative) |
| Share of cost by zone | central HVAC 26%, guest rooms 22%, hallways 20%, kitchen 13%, hot water 10%, lobby 9% |
| Load kinds (site energy) | base 36%, occupancy 32%, weather 26%, schedule 5% |
| Occupancy 60% to 85% | +$17,300 per year (+12.3%) |
| Smart room controls | −$1,645 per year (−1.2% of the bill, −3.8% of HVAC) |
| Common-area HVAC 18 h | −$1,507 per year (−1.1%) |
| Heat wave (July +10 °F) | +$6,300 |
| Electricity +20% | +$24,300 |

## 7. Known limitations and assumptions to confirm
- **All numbers except the prices are placeholders.** EUI, end-use shares, driver weights, allocations, setpoint sensitivities, hourly shapes, presence curve and seasonal occupancy need sourced values (docs/11, Phase 7).
- **Smart-room-control savings look conservative** (about 4% of HVAC). Industry claims for occupancy-based room controls are often much higher. The size depends on the placeholder setback, sensitivities and presence curve; calibrate before quoting it.
- Seasonal shaping caps occupancy at 100%, so an input of 100% annual still has lower winter months unless the curve is flattened.
- Heating by electric PTAC or VRF uses the same site-energy share as gas heating; the higher efficiency of heat pumps is not modeled.
- Prices are all-in averages; there are no demand charges or time-of-use rates.
- Weather is monthly means only; stress tests are monthly approximations.
- The home-era engine that used to sit next to this one in `src/engine` was removed (November 2026).

## 8. Upgrades, costs and financial metrics (Phase 2)
Eight upgrades (`src/data/hotel/upgrades.json`, all placeholders): smart guest-room thermostats and occupancy sensing, roof and envelope insulation, LED lighting,
occupancy sensors in common areas, energy management controls, high-efficiency HVAC equipment, high-efficiency water heating and low-flow fixtures, and rooftop solar.

**Savings (`calculateUpgradeSavings`).** Upgrades are applied in a fixed order, whatever order they are listed in: insulation, LED lighting, occupancy sensors,
smart room controls, energy management, HVAC equipment, water heating, solar last. Each step rescales the affected cells (by load kind where it matters), so
savings are recomputed from the hotel's own loads and **never added as percentages**. Each upgrade has low, mid and high values; the scenario picks one.
- **Smart room controls** re-run the simulation with vacant-room setpoints set back 3, 5 or 7 °F (limits 55 and 85 °F), so they act through the same mechanism as a scenario.
- **Insulation** cuts the *weather* load of heating and cooling by 6, 10 or 14%.
- **LED lighting** cuts lighting 35, 45 or 55%. **Interaction:** less lighting heat lowers cooling (0.10 kBtu per kBtu of lighting saved) and raises heating (0.20 kBtu per kBtu saved),
  spread over the existing cooling and heating energy. Occupancy sensors do the same for the lighting they save.
- **Occupancy sensors** cut common-area and hallway lighting 12, 20 or 28% and their ventilation 2, 5 or 8%.
- **Energy management** cuts HVAC in the plant, lobby and hallways 4, 7 or 10%. It reaches guest rooms (half the percentage) only when smart room controls are absent; with them the two **overlap** and guest rooms get nothing extra.
- **HVAC equipment** cuts heating 8, 12 or 16% and cooling 10, 15 or 22%. It is **sized from the reduced load**: the size factor is the share of baseline heating and cooling weather load left before this step (0.6 to 1).
- **Water heating** cuts hot-water energy 15, 22 or 30%.
- **Solar** (`solar.ts`) is sized to the usable roof (50% of one floor's footprint at 100 ft² per kW), never above what would cover the hotel's yearly electricity use.
  Output comes from the **climate's** solar data (`weather.json`: kWh per kW per year, low/mid/high, and the monthly split). For each month a typical day is built:
  generation follows a half-sine between sunrise and sunset (day length from the latitude and the sun's declination), the hotel's load follows its hourly end-use shapes
  after the other upgrades, and each hour the hotel uses `min(generation, load)`; the rest is **exported** and credited at the **region's export credit** (`rates.json`;
  `null` = not researched, so $0). Savings = self-used kWh × electricity rate + exported kWh × export credit. Panel output falls 0.5% a year (Jordan and Kurtz 2013, to verify).
  The typical-day shape ignores day-to-day weather, so the export share is an estimate. Operation and maintenance and inverter replacement are not included.

**Dependencies and exclusions.** The data can name `requires` and `excludes` per upgrade; the engine rejects invalid sets. None are set today (energy management and smart controls overlap rather than depend on each other).
Smart room controls are ineligible if the hotel already has them.

**Costs (`upgradeCost`, `packageCost`).** Cost = fixed + per room + per floor area + per roof area + per common-area floor area + per kW, each as low, mid and high. HVAC equipment scales its floor-area part by the size factor.
Solar adds the **region's installed cost per W** for its size (`rates.json`, size tiers). Equipment size and cost come from the mid scenario so they do not change
with the savings scenario. This is the **gross** cost; incentives are subtracted in the breakdown below, and the **budget is checked against the gross cost** because most
incentives arrive after installation.

**One savings stream for every figure (`finance.ts`).** Savings in year *t* = (non-solar savings + solar savings × (1 − 0.5%)^(t−1)) × (1 + 2%)^(t−1), where the
2% price growth (and the 3% discount rate used only for NPV) are placeholders. Every metric below uses this stream and the **net investment** = gross cost − applied incentives.

**Financial metrics (`calculateFinancialMetrics`, `packageMetrics`)** at mid and the profile's horizon (default 5 years): payback = net investment / first-year savings;
net benefit = Σ yearly savings − net investment (nominal, no residual value); NPV = the same, discounted; NPV with residual adds the remaining life of long-lived equipment;
ROI = net benefit / net investment; carbon avoided; remaining budget = budget − gross cost. The optimizer ranks with `packageMetrics`, the same function `evaluatePackage` reports.

**The common breakdown (`financialBreakdown`, on every `PackageEvaluation` as `financials`).** For every upgrade and package, solar included:
1. gross installation cost (low, mid, high); 2. incentives, each listed with its source and marked applied or not; 3. net upfront investment; 4. annual energy saved
(kWh electricity and therms gas, so an upgrade that adds heating shows negative therms); 5. annual money saved (low, mid, high; including any export credit);
6. simple payback; 7. five- and ten-year net financial benefit (low pairs low savings with high cost, high the reverse); 8. CO2 avoided per year; plus solar details
(size, generation, self-used, exported, $/W, export credit, degradation) and plain-language assumptions.

**Incentives (`incentives.json`, `incentiveLines`).** Programs are listed per upgrade (federal Section 48E credit and Illinois Shines for solar, ComEd and Peoples Gas
efficiency programs for the rest). **None is applied** until the data marks it applied and verified with a value: no amounts are invented. A user can enter a confirmed amount
per upgrade (`incentives` option), which replaces program amounts for that upgrade.

**Upgrade comparison (`compareUpgrades`, store `selectUpgradeComparison`).** Every eligible upgrade evaluated alone with `evaluatePackage`, against the same situation the
optimizer uses (the what-if when "optimize for this scenario" is on, else the baseline). The advisor's upgrade figures and the zone opportunities come from the same rows,
so the cards, the optimizer and the advisor cannot disagree. Tests in `__tests__/financials.test.ts` check this.

**Product decisions (docs/15).** NPV at 8% (3% alternative) is part of the breakdown (`npv5`, `npv10`); the optimizer has no minimum savings
share and normalizes configurable balanced weights; heating site energy depends on the system (gas 0.80, resistance 1.0, heat pump COP 2.3);
solar comes in three mutually exclusive sizes; the grid factor follows the eGRID subregion of the location.

**Comfort (`comfortFor`).** Score starts at 1; each upgrade with a minor comfort impact costs 0.05 and each warning flag 0.15. Notes list the impacts and any condition flags
(smart controls add the recovery-time note). The optimizer will be able to require a minimum score.

**`evaluatePackage`** returns the cost range, annual savings (low, mid, high), new annual cost, carbon avoided, metrics, comfort, sizing and per-item marginal savings (which sum to the package savings and depend on the fixed order).

### Demo hotel, single upgrades (mid; research pass 2, no incentives applied)

Baseline: about $131,700 a year, 782,000 kWh, 23,400 therms, 449 t CO2 (eGRID RFCW), 91.1 kBtu/ft² site (CBECS 2018 lodging: 85.7).
Price growth EIA AEO2026 (electricity 2.12%, gas 4.09% a year). Solar: PVWatts Chicago, net of $17.63/kW-yr O&M. Lighting interaction: IL-TRM hotel factors.

| Upgrade | Net cost | kWh / yr | therms / yr | $ / yr | Payback | 5-year net | 10-year net | t CO2 / yr |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Occupancy sensors | $6,600 | 17,396 | −251 | $2,211 | 3.0 y | $4,884 | $17,497 | 5.9 |
| LED lighting | $33,000 | 62,186 | −1,008 | $7,800 | 4.2 y | $7,495 | $51,903 | 20.5 |
| Water heating and low-flow | $22,000 | 8,897 | 1,720 | $2,848 | 7.7 y | −$6,808 | $11,030 | 12.8 |
| Energy management | $26,000 | 18,680 | 539 | $3,126 | 8.3 y | −$9,591 | $8,936 | 10.6 |
| Rooftop solar (55 kW, 68,211 kWh, all used on site) | $154,000 | 68,211 | 0 | $8,614 | 17.9 y | −$109,521 | −$61,346 | 28.3 |
| Insulation | $38,500 | 8,186 | 733 | $1,831 | 21.0 y | −$28,807 | −$17,630 | 7.3 |
| Smart room controls (fan saving calibrated to IL-TRM) | $26,000 | 10,820 | 209 | $1,715 | 15.2 y | −$17,015 | −$6,918 | 5.6 |
| HVAC equipment | $110,000 | 15,275 | 1,187 | $3,249 | 33.9 y | −$92,822 | −$73,079 | 12.6 |

At $50,000 the optimizer picks LED lighting plus occupancy sensors ($39,600, $9,098 a year, 4.4 years).

**Smart room controls calibration.** IL-TRM v14.0 4.4.8 (Chicago hotel, central hot-water fan coils, gas heat) implies about 6,900–14,700 kWh and
225–650 therms a year for 100 rooms at 0.75–1.0 ton per room. The setback alone gave 4,903 kWh; with smart controls the simulation now also cuts
guest-room fan energy 17% while rooms are empty (`defaults.smartControlFan`), giving about 10,800 kWh and 209 therms. **Insulation** scales its
weather-load reduction by 5 / floors above 5 floors. **Second preset:** `demo-chicago-300` (300 rooms, 20 floors, defaults for floor area and
occupancy, then 69.2% occupancy from STR via Choose Chicago); at $150,000 the optimizer picks LED lighting plus energy management ($147,000,
$34,163 a year, 4.3 years; baseline about $410,400 a year). Log: `docs/14`.

### Limits of this version
- **Smart room controls pay back slowly (21 years)** because their modeled savings are small (see section 7) and setback recovery is counted. That is a calibration question, not a product conclusion.
- **Solar costs more than a $50,000 budget** at the modeled size, so it only appears with a larger budget. A smaller array option is not modeled.
- **No HVAC alternatives** (for example a heat pump) and no heat-pump water heater, so there are no mutually exclusive options yet.
- All savings, costs, lifetimes and interaction factors are placeholders until Phase 7.

**Year-by-year projection.** `financials.projection` lists years 1 to 10 with each year's savings (low, mid, high), cumulative net benefit
(savings to date minus net investment; low pairs low savings with high cost, high the reverse) and the mid case discounted at the
discount rate. It uses the same savings stream as the net benefit and NPV, so year 5 and year 10 equal `netBenefit5`/`netBenefit10` and
`npv5`/`npv10` (tested). Shown by prompt LV14.

**Peer benchmark.** `benchmarkComparison(result, floorAreaSqft)` returns the modeled site EUI and its difference from published
peers in `defaults.peerBenchmarks` (ENERGY STAR hotel median 63.0 and CBECS 2018 lodging mean 85.7 kBtu/ft², both national, all
climates). Comparison only: nothing in the model is adjusted toward them. The demo hotel (91.1) sits 45% above the ENERGY STAR
median, partly explained by Chicago's climate and the restaurant; this is shown, not tuned away. Shown by prompt LV15.

## 9. Budget optimizer (Phase 3)
`optimizeInvestmentPortfolio(profile, options)` tests every subset of the eligible upgrades (2^n, so 256 for the demo hotel, the empty set counted but never returned).
It keeps a package only if it is valid (requirements and exclusions), costs no more than the budget at the **mid** estimate, has a comfort score of at least 0.70, and saves at least 1% of the current bill.
All numbers come from `evaluatePackage` logic, so interactions between upgrades are included. Evaluating all 256 combinations plus the three winners takes roughly 0.1 seconds.

**Three distinct packages.** Maximum savings (highest annual savings), fastest payback (lowest payback, ties broken by higher savings), and balanced. They are assigned in that order; if one
package would win two roles, the later role takes its next best and the package carries a note ("runner-up"). Ties are broken by lower cost and then by id, so results are deterministic.

**Balanced score** = 0.5 × five-year net benefit + 0.3 × carbon avoided + 0.2 × comfort score, where net benefit and carbon are min-max normalized across the candidates (placeholder weights in `OPTIMIZER_DEFAULTS`).

**The profile's objective** (annual savings, payback, ROI, carbon, balanced) selects `objectiveWinner`, which may repeat one of the three packages. The UI should highlight it. Highest ROI and maximum carbon are available this way without adding more cards.

**Per package:** cost range, annual savings range, new annual cost, five-year net benefit, payback, ROI, carbon avoided, remaining budget, comfort score and notes, per-item marginal savings, and a one-line rule-based reason.
`budgetRisk` is true when the high-end cost estimate would exceed the budget.

**When nothing fits** the result is empty with `emptyReason` and `cheapestUseful` (the cheapest single upgrade that saves money). `explainPortfolio(result)` writes 4 to 6 sentences from the result's numbers only (the advisor's fallback).

### Demo hotel, objective "balanced" (mid estimates; synthetic placeholders)

| Budget | Maximum savings | Fastest payback | Balanced |
| --- | --- | --- | --- |
| $50,000 | LED + occupancy sensors: $39,600, saves $12,159 a year (8.6% of the bill), payback 3.3 years, five-year net $23,676 | Occupancy sensors alone: $6,600, saves $2,478, payback 2.7 years | LED alone (runner-up): $33,000, saves $10,757, payback 3.1 years |
| $100,000 | LED + sensors + energy management + water heating: $87,600, saves $17,925 (12.7%), payback 4.9 years | Occupancy sensors alone | LED + sensors + water heating: $61,600, saves $15,398 (10.9%), payback 4.0 years, five-year net $18,532 |
| $250,000 | Adds rooftop solar: $241,600, saves $27,198 (19.3%), payback 8.9 years, five-year net −$100,059 | Occupancy sensors alone | Same as $100,000 |

At $5,000 nothing fits; the cheapest useful upgrade is occupancy sensors at about $6,600.

### Observations and limits
- At $50,000 the true balanced winner is the same package as maximum savings, so the "balanced" card shows the runner-up; the highlighted objective winner is LED + sensors.
- **Smart room controls never appear in a recommendation** at these numbers (16-year payback). Solar appears only with a very large budget and a negative five-year net benefit. Both depend on placeholder inputs.
- Fastest payback is always a small package (occupancy sensors), because payback ignores size. The 1% savings floor stops anything smaller than that winning.
- The comfort constraint (0.70) has not rejected anything yet, since no package loses more than 0.20.

## 10. Twin support: zone opportunities, optimizing under a scenario, setback recovery
**Zone opportunities (`opportunitiesByZone`).** For each zone, the upgrades that would lower that zone's energy cost, biggest first. Each upgrade is evaluated on its own against the context's baseline and the zone figure is the *net* change in that zone
(LEDs add some heating, solar also trims the hot-water zone's electric share). Each entry carries the whole upgrade's cost, payback and comfort impact. The store's `selectOpportunities` measures against the current scenario when there is one.

**Optimizing under a scenario.** `optimizeInvestmentPortfolio(profile, { scenario })` builds its baseline from the what-if (for example electricity +20%), so savings, payback and ranking are all relative to that situation, and records the scenario in the result.
`prepareScenarioContext` and `contextFromBaseline` build the context. If the scenario already turns smart room controls on, that upgrade is no longer offered. In the store, `optimizeOnScenario` switches this on; a plan made on a scenario is dropped when the scenario changes,
and the before and after views for an applied package compare against the situation the plan was measured against.

**Setback recovery.** A set-back guest room needs energy to return to the occupied setpoint. For every booked room, `returns per day × days` events each cost `setback depth × 0.15 kBtu per °F`, spread over heating or cooling months by degree days and divided by the equipment efficiency
(0.8 for gas heat, 2.3 for electric heat, COP 3 for cooling). The number of returns scales with how much time guests are away (14 occupied hours is the reference) and is zero when guests are always in their rooms. It is added to guest-room heating and cooling as occupancy-driven load,
so it applies to scenarios and to the smart-controls upgrade alike, and it is zero whenever there is no setback, so the baseline is unchanged. At the placeholder values it takes about a quarter off the smart controls' modeled saving ($407 of $1,645 a year, leaving $1,237). The parameters are placeholders; if research shows the published per-degree savings are already net of recovery, set `kBtuPerRoomPerF` to 0.

## 11. The twin UI (`src/twin`)
`<HotelTwin />` is a layered 2D view that reads everything from the store and does no math. Zones: a building cross-section with six clickable zones colored by yearly cost (blue lower, red higher), with before, after and split views. Rooms: every room by floor
(guest in room, booked and guest out, vacant, set back). Equipment: the estimated equipment list per zone with schedule and efficiency. Flow: a Sankey of grid and gas to zones to uses, plus a text table for screen readers.
A time scrubber plays a typical day or the year, a simulated meter shows modeled kW, therms and dollars per hour, installed upgrades are drawn on the building, and four stress-test buttons lay events over the hotel.
The zone panel shows energy, cost share, change from before, an hourly electricity chart, equipment, schedules, efficiency assumptions and the zone's improvement opportunities. Files: `HotelTwin.tsx`, `useTwinClock.ts`, `format.ts` and one file per part in `parts/`.
Lovable only places `<HotelTwin />` (prompt LV6). Everything labeled simulated or estimated stays labeled.

**Flow, Rooms and Equipment layers (Phase 10).** Flow: an own SVG Sankey over `energyFlows` (annual) or `energyFlowsAt(result, month, hour)`
(one hour of a typical day, the meter's formula, so the hour's flows add up to the meter); every link carries its electricity and gas parts,
drawn as cyan and amber bands; width is cost or site energy. The moving dots are illustrative, not measured flow. Equipment: the estimated
inventory as cards grouped by HVAC, water heating, lighting and other; each item shows the modeled demand of its system
(`typicalDayByZoneEndUse`, zone × end use by hour) because the model has no per-appliance energy; status is running above 60% of the
day's peak, idle below 15%. Rooms: a façade of the engine's room pattern (`roomOccupancyPattern`), with setpoints from the displayed
conditions and the guest-room zone's average kW per room (labeled as an average).

**3D view (Phase 9).** The Zones layer has a 3D view (`src/three`, spec in `docs/04`), default on desktop with WebGL. It adds an hourly
state of the hotel, `selectHourState(state)`, from engine functions only: `daylight(lat, month)` (sunrise and sunset from declination),
`sunElevationDeg` and `sunAzimuthDeg`, `outdoorTempF(profile, month, hour)` (modeled: a two-part cosine through the NOAA 1991–2020 normal
low at sunrise and normal high at 15:00, labeled "modeled"), demand by end use from `typicalDayProfile(...).byEndUse` (gas converted at
29.3071 kW per therm per hour), cost per hour, rooms (total, booked, present, set back) and solar (`solarHourKW`: the month's PVWatts output
spread over daylight hours, so the hours add up to the monthly output the engine uses). Scenery (season, snow, trees, sky colors) is visual
only and comes from the month and the sun's height.

## 12. The AI advisor (`src/engine/hotel/advisor`, `supabase/functions/advisor`)
The AI explains; it never calculates. The browser builds a **context** from the store (the hotel, baseline by category and zone, the current what-if and why it changed, every eligible upgrade on its own with cost, savings range, payback, five-year net benefit, carbon, comfort and the zones it helps,
an occupancy example, the optimizer's plan, and a plan for any other budget named in the question) with every number rounded. It sends the question and context to the function, then **checks the answer**: each number must match one in the context (exactly, or rounded the usual way to the decimals written or to two or three significant figures; whole numbers up to 12 with no unit are allowed as counts).
An answer with any other number is discarded.
The template answer (`fallbackAnswer`) is used when the function is not set up, is slow (6 seconds), fails, refuses or is rejected. It is built only from the context, covers the demo questions (why HVAC costs most, how occupancy changes energy, X versus Y, how to use a budget, a what-if, a zone's cost, a general summary), and passes the same number check in tests.
Question intent is keyword-based and deterministic. The context holds about 20 KB. Details of the function are in `docs/12`, section 6.

---

## Appendix A — Store contract (task 1.10): approved and built

Approved and implemented in `src/store/useTwin.ts` (hotel fields added next to the home-era ones, nothing removed) with helpers and selectors in `src/store/hotelDerived.ts`.
The Lovable prompts in `docs/06` carry the full API cheat sheet. How the built version differs from the proposal:
- `baseline` is always present (computed when the store loads, deterministic so the server and browser agree), not `| null`.
- `scenarioResult` is null when there is nothing to simulate. The effective scenario is the user's scenario with the active stress test laid over it; the stress test wins where both set a field, and the user's own settings are never changed by it.
- Added with their phases: `hotelPlan` (the optimizer result), `activeHotelPackageId`, `setHotelBudget`, `setHotelObjective`, `runHotelOptimizer` (computes at once, holds `optimizing` for 2 seconds, drops a result that went stale), `applyHotelPackage`, saved scenarios (in memory; ids `scn-1`, `scn-2`, ...), `resetHotel`, and `hotelPresets`.
- `setHotelInput(patch, clearKeys?)` and `setScenario(patch, clearKeys?)` take a list of keys to clear back to their defaults.
- Selectors (memoized): `selectDisplayed`, `selectCompare`, `selectZoneRows`, `selectTypicalDay`, `selectRooms`, `selectFlows`, `selectEquipment`, `selectMeter`, `selectHotelLabel`, `selectHotelCost`, `selectHotelBaselineCost`, `selectActiveHotelPackage`.
- The playback clock stays in the UI (it calls `setTime`), so the store has no timers except the optimizer's 2-second animation hold.
- Saved scenarios are not stored in `localStorage` yet (avoids server-render mismatches); they last for the session.
- The advisor messages arrive with Phase 6.
