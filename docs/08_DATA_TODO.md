# 08 — Hotel data research to-do

What must be looked up to replace the placeholders in `src/data/hotel/`. For every value you replace, set `"verified": true` and rewrite the `source`
field to name the exact table, page or study. If a value is a modeling choice and not a fact, say so in `source`. The calibration pass that uses this
research is task 7.13 in [11_HOTEL_TASKS.md](11_HOTEL_TASKS.md); the model is described in [13_HOTEL_ENGINE_SPEC.md](13_HOTEL_ENGINE_SPEC.md).

> The home-era data list that used to be here is obsolete (the home data files in `src/data/` remain only for the legacy home engine).

## Where things stand

| File | Status |
| --- | --- |
| `rates.json` | **Researched** (EIA commercial prices for Illinois and the U.S.). Still to confirm the demand-charge caveat below |
| `emissions.json` | Gas factor recalled from the EPA hub but not re-checked; **grid factor is illustrative** |
| `weather.json` | Chicago monthly temperatures **from memory**, unverified |
| `defaults.json`, `shapes.json`, `equipment.json` | **Placeholders**, not researched |
| `upgrades.json` | **Placeholders**: every cost, savings value, lifetime, interaction factor and solar parameter is my estimate |
| `presets.json` | Synthetic demo hotel; sanity-check only |

Priority **A** = changes the demo story or the optimizer's ranking. Do these first.

## Network domains to allow (Environment, Network access)
`epa.gov`, `noaa.gov`, `nrel.gov`, `energystar.gov` (EIA is already allowed; `energy.gov` and `openei.org` help for case studies and tariffs).

## 1. Upgrades (`upgrades.json`) — priority A
For each upgrade find **low, mid and high** values. Sources: NREL ComStock, DOE Better Buildings hotel case studies, ENERGY STAR hotel guidance, utility program filings, vendor quotes.

- [ ] **A. Smart guest-room thermostats and occupancy sensing:** savings as a share of guest-room HVAC energy (setback degrees, ramp and recovery); installed cost per room and fixed cost; lifetime. *Currently: setback 3/5/7 °F, $250 per room + $1,500.*
- [ ] **A. LED lighting retrofit:** lighting energy reduction by hotel type (many hotels are partly LED already); cost per ft² or per fixture; lifetime. *Currently: 35/45/55%, $0.60 per ft².*
- [ ] **A. Occupancy sensors in common areas and hallways:** lighting and ventilation reduction; cost per ft² or per sensor. *Currently: 12/20/28% lighting, 2/5/8% ventilation, $0.40 per ft² of common area.*
- [ ] **A. Rooftop solar:** installed cost per kW (commercial, Midwest), annual yield per kW for Chicago (PVWatts), usable roof share and ft² per kW, and whether to model smaller arrays. *Currently: $2,800 per kW, 1,200 kWh per kW per year, 50% roof, 100 ft² per kW, sized to 10% of electricity.*
- [ ] Energy management controls: HVAC savings and cost. *Currently: 4/7/10%, $15,000 + $0.20 per ft².*
- [ ] High-efficiency HVAC equipment: heating and cooling reduction and cost per ft² or ton (and whether a heat-pump option should be added). *Currently: heating 8/12/16%, cooling 10/15/22%, $2.00 per ft².*
- [ ] Water heating and low-flow fixtures: energy reduction and cost per room. *Currently: 15/22/30%, $220 per room.*
- [ ] Insulation (roof and envelope): share of weather load removed and cost per ft² of roof. *Currently: 6/10/14%, $3.50 per ft².*
- [ ] Equipment lifetimes for all eight (used in the residual value).
- [ ] **A. Lighting-to-HVAC interaction:** cooling saved and heating added per unit of lighting energy saved. *Currently: 0.10 and 0.20 kBtu per kBtu.*
- [ ] Solar monthly production shape for Chicago. *Currently: an illustrative curve.*
- [ ] Incentives (optional): federal, Illinois and ComEd programs that apply to commercial upgrades. The engine assumes none.

## 2. Baseline energy model (`defaults.json`) — priority A
- [ ] **A. Energy use intensity** (kBtu per ft² per year) for hotels in a cold climate; compare with ENERGY STAR Portfolio Manager's hotel median and EIA CBECS lodging. *Currently: 92.*
- [ ] **A. End-use shares of site energy** for lodging (heating, cooling, ventilation, lighting, hot water, kitchen, equipment, other): CBECS lodging end uses. *Currently: 22 / 9 / 7 / 11 / 19 / 7 / 15 / 10%.*
- [ ] Fuel mix: share of hot water and cooking on gas versus electricity; heating fuel by HVAC type (CBECS).
- [ ] Age factor by year built (CBECS or ENERGY STAR). *Currently: 1.10 before 1980, 1.00 to 1999, 0.92 after.*
- [ ] Zone allocation of each end use (guest rooms, lobby, kitchen, hallways, central plant, hot water) and the central-plant share by HVAC type: DOE or ComStock hotel prototype models. *Currently fixed guesses.*
- [ ] Driver weights (base, occupancy, weather, schedule) for each end use: calibrate so a month-by-month profile looks like a real hotel's (ComStock hotel hourly profiles, utility interval data if available). *Currently rule-of-thumb weights.*
- [ ] **A. Smart-room-control inputs:** per-degree heating and cooling sensitivity to setpoint, and the share of time a booked room has a guest present. *Currently 3% and 4% per °F; 14 hours per day.*
- [ ] Setpoint references and comfort limits (ASHRAE 55): reference 68/74 °F, occupied limits 67 to 77 °F, vacant limits 55 and 85 °F, common-area hours floor. *Currently placeholders.*
- [ ] Benchmark occupancy behind the EUI, default occupancy, seasonal occupancy curve for Chicago hotels (STR, Choose Chicago or similar). *Currently 62%, 65%, a synthetic curve.*
- [ ] Hot water per occupied room per day (ASHRAE or ENERGY STAR). *Currently 20 gallons.*
- [ ] Floor area per room and rooms per floor typical of a 100-room hotel. *Currently 550 ft² per room.*

## 3. Weather, rates, carbon
- [ ] `weather.json`: Chicago monthly mean temperatures (NOAA 1991 to 2020 normals, O'Hare) and the heating and cooling balance point. Optional: more cities.
- [ ] `rates.json`: **confirm what the EIA "commercial" average includes.** It is an all-in price that already spreads fixed and demand charges, which is how the engine uses it. For ComEd, check whether a separate demand charge or time-of-use rate matters for a hotel this size (the demo says demand charges are out of scope).
- [ ] `emissions.json`: EPA eGRID emission rate for the Chicago grid subregion (RFCW) in kg CO2e per kWh; re-check the 5.31 kg CO2 per therm for natural gas on the EPA emission factors hub.

## 4. Twin and display data
- [ ] `shapes.json`: hourly load shape for each end use and the guest-presence curve (ComStock or DOE hotel hourly profiles, or published occupancy studies). *Currently illustrative.*
- [ ] `equipment.json`: rated loads and sizing rules (PTAC or fan-coil kW, boiler and chiller sizing per ft², elevator and laundry loads, water-heater size per room). *Currently rules of thumb, shown to users as estimates.*

## 5. Decisions the team makes (not facts; record the reasoning)
- [ ] Financial defaults: price growth (2%), discount rate (3%), horizon (5 years). EIA's Annual Energy Outlook can inform the price growth.
- [ ] Optimizer rules: minimum comfort score (0.70), minimum savings share (1% of the bill), balanced-score weights (0.5 financial, 0.3 carbon, 0.2 comfort).
- [ ] Whether to add a smaller solar array and a heat-pump option so there are real alternatives to compare.

## 6. Validation
- [ ] Compare the demo hotel's total energy and cost with an ENERGY STAR Portfolio Manager benchmark and note the result for Q&A.
- [ ] Compare each package's savings, as a share of the bill, with published hotel case studies (DOE Better Buildings, utilities).
- [ ] Re-run the optimizer after calibration and check that the demo story (task 8.1) is still honest. If the numbers say thermostats do not beat solar or LEDs, change the demo question, not the numbers.
- [ ] Check the preset hotel's size, rooms and bills against a real 100-room property.
