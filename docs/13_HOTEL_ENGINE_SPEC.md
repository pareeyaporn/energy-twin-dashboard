# 13 — Hotel engine spec (`src/engine/hotel/`)

What the Phase 1 engine computes and the assumptions behind it. Code and tests live in `src/engine/hotel/`; data in `src/data/hotel/`.
All data values are **synthetic placeholders** (`verified: false`) except the EIA commercial prices in `rates.json`. Outputs are **estimates**.

## 1. Scope
**Does:** monthly and annual energy, cost and carbon by zone, end use and month; occupancy, setpoint, schedule, weather and price what-ifs with
the reasons for each change and comfort flags; hourly "typical day" profiles, room-by-room occupancy, equipment lists and energy flows for the twin.
**Does not (yet):** hourly or daily simulation of a real year, demand charges and tariff structures, real weather, equipment-level physics, upgrades
(Phase 2), the optimizer (Phase 3), or measured data. No randomness anywhere: the same input always gives the same output.

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

---

## Appendix A — Store contract proposal (task 1.10, awaiting your OK; nothing in `src/store/` has been changed)

Additive and backwards compatible: every existing field and action keeps working until the Lovable components are migrated (prompt LV1).

**New state**
```ts
// hotel model
hotelInput: HotelInput;              // what the user entered
presetId: string | null;
hotel: ResolvedProfile;              // resolved (profile, defaulted, notes), recomputed when hotelInput changes
scenario: Scenario;                  // current what-if ({} = none)
baseline: EnergyResult | null;       // calculateBaselineEnergy(hotel), recomputed when the hotel changes
scenarioResult: ScenarioResult | null; // simulateEnergyScenario(hotel, scenario), recomputed when either changes
activeStressTest: StressTest['id'] | null;

// twin UI
selectedZone: ZoneId | null;
twinLayer: 'zones' | 'rooms' | 'equipment' | 'flow';
timeMode: 'day' | 'year';
timeMonth: number;                   // 0..11
timeHour: number;                    // 0..23
playing: boolean;
playbackSpeed: number;               // 1, 2, 4
compareMode: 'before' | 'after' | 'split';
```
Added later with their phases: three investment packages, saved scenarios, advisor messages.

**New actions:** `setHotelInput(patch)`, `selectHotelPreset(id)`, `setScenario(patch)`, `resetScenario()`, `applyStressTest(id | null)`, `selectZone(z | null)`,
`setTwinLayer(l)`, `setTime({ mode?, month?, hour? })`, `setPlaying(b)`, `setPlaybackSpeed(n)`, `setCompareMode(m)`.
The playback clock lives in the UI (it advances `timeHour` or `timeMonth` through `setTime`), so the engine and store stay free of timers.

**New selectors (derived with `useMemo` or plain functions, not stored):** `selectDisplayed` (the scenario result when a scenario is active, else the baseline), `selectZoneRows`,
`selectTypicalDay(month)`, `selectRooms(month, hour)`, `selectFlows`, `selectEquipment`, `selectMeter`.

**Existing fields kept as they are:** `budget`, `goal` (mapped to the hotel objective later), `results`, `activePackageId`, `drawerOpen`, `reduceEffects`, `thermalMode`, `selectedPart`, `home`.
Home-only selectors stay until the home components are removed. Tests: extend `src/test/useTwin.test.ts` for the new actions.
