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
- The home-era engine in `src/engine` is untouched and still exported next to this one (`hotel` namespace) to avoid name clashes.

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
- **Solar** is sized as the smaller of the usable roof (50% of one floor's footprint at 100 ft² per kW) and 10% of electricity use. Each month it offsets at most what the hotel uses (no export credit), using a monthly production shape and 1,100, 1,200 or 1,300 kWh per kW per year.

**Dependencies and exclusions.** The data can name `requires` and `excludes` per upgrade; the engine rejects invalid sets. None are set today (energy management and smart controls overlap rather than depend on each other).
Smart room controls are ineligible if the hotel already has them.

**Costs (`upgradeCost`, `packageCost`).** Cost = fixed + per room + per floor area + per roof area + per common-area floor area + per kW, each as low, mid and high. HVAC equipment scales its floor-area part by the size factor.
Equipment size and cost come from the mid scenario so they do not change with the savings scenario. Incentives are 0.

**Financial metrics (`calculateFinancialMetrics`)** at mid, with 2% price growth, a 3% discount rate and the profile's horizon (default 5 years):
payback = cost / first-year savings (none if savings are not positive); five-year **net benefit** = Σ yearly savings with price growth − cost (nominal, no residual value);
NPV = the same, discounted; NPV with residual adds the remaining life of long-lived equipment; ROI = net benefit / cost; carbon avoided per year and over the horizon; remaining budget.

**Comfort (`comfortFor`).** Score starts at 1; each upgrade with a minor comfort impact costs 0.05 and each warning flag 0.15. Notes list the impacts and any condition flags
(smart controls add the recovery-time note). The optimizer will be able to require a minimum score.

**`evaluatePackage`** returns the cost range, annual savings (low, mid, high), new annual cost, carbon avoided, metrics, comfort, sizing and per-item marginal savings (which sum to the package savings and depend on the fixed order).

### Demo hotel, single upgrades (mid; synthetic placeholders)

| Upgrade | Cost | Saves per year (low to high) | Payback |
| --- | --- | --- | --- |
| Occupancy sensors | $6,600 | $2,478 ($1,469 to $3,486) | 2.7 years |
| LED lighting | $33,000 | $10,757 ($8,367 to $13,148) | 3.1 years |
| Water heating and low-flow | $22,000 | $3,239 | 6.8 years |
| Energy management | $26,000 | $2,570 | 10.1 years |
| Smart room controls | $26,500 | $1,645 ($987 to $2,303) | 16.1 years |
| Insulation | $38,500 | $2,328 | 16.5 years |
| Rooftop solar (55 kW) | $154,000 | $9,273 | 16.6 years |
| HVAC equipment | $110,000 | $4,036 | 27.3 years |

LED lighting plus occupancy sensors costs $39,600, saves $12,159 a year (payback 3.3 years, five-year net benefit about $23,700). The full package costs $396,000 and saves $33,700.
All 256 combinations evaluate in about 0.25 seconds.

### Limits of this version
- **Smart room controls pay back slowly (16 years)** because their modeled savings are small (see section 7). That is a calibration question, not a product conclusion.
- **Solar costs more than a $50,000 budget** at the modeled size, so it only appears with a larger budget. A smaller array option is not modeled.
- **No HVAC alternatives** (for example a heat pump) and no heat-pump water heater, so there are no mutually exclusive options yet.
- All savings, costs, lifetimes and interaction factors are placeholders until Phase 7.

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
