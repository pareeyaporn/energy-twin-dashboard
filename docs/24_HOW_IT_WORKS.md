# 24 — How Energy Twin calculates, in plain language

This doc is for anyone who wants the method explained simply, not in equations: teammates, judges, a hotel owner.
The detailed versions are `docs/13` (engine equations), `docs/14` (every sourced value), `docs/20` (equipment) and `docs/21` (the in-app
"How was this calculated?" panels). All results are **estimates**; the demo hotels are **synthetic**.

## 1. The short answer

Energy Twin works **top down**, not appliance by appliance.

It does **not** list every light bulb and fridge, multiply each one's watts by its hours, and add them up. Real hotels rarely know that
level of detail, and adding up guesses for hundreds of devices gives a precise-looking but unreliable number.

Instead it starts from **what hotels like this one actually use**, measured across thousands of buildings, then adjusts for this hotel.

```
How big is the hotel?  ×  How much energy does a typical hotel use per square foot in this climate?
        = the hotel's yearly energy
        → split into uses (heating, cooling, lighting, hot water, kitchen, …) and zones (rooms, lobby, kitchen, …)
        → spread over 12 months by occupancy, weather and schedules
        → priced (cost) and converted to carbon
```

## 2. Step by step, with the demo hotel

The demo hotel is **Lakeshore Inn**, a synthetic 100-room hotel in Chicago, 55,000 ft², built 1998.

| Step | What happens | Where the number comes from |
| --- | --- | --- |
| 1. Size | 100 rooms × 550 ft² per room = **55,000 ft²** | A default when the owner doesn't enter the floor area (`defaults.json`) |
| 2. Typical use per ft² | Chicago hotels use about **92.3 kBtu per ft² a year** (kBtu is a unit of energy covering both electricity and gas) | NREL ComStock, a national model of real US buildings (`defaults.json`, `euiSource`) |
| 3. Age | Hotels built 1980–1999 use about 5% less than the Illinois hotel average (× 0.947) | Same ComStock data |
| 4. Yearly energy | 55,000 × 92.3 × 0.947 ≈ **4.8 million kBtu** a year | Steps 1–3 (the app shows about 4.76 million after step 6) |
| 5. Split by use and zone | For example heating, hot water, lighting, cooling each take a share; then each use goes to the zones that use it (guest rooms, lobby, kitchen, hallways, hot water, central plant) | End-use shares by climate (`defaults.json`) |
| 6. Spread over the year | Each month moves with **occupancy** (more guests = more hot water and room HVAC), **weather** (Chicago degree days: cold January = more heating) and **schedules** (lobby hours, lighting hours) | NOAA climate normals (`weather.json`), the hotel's settings |
| 7. Electricity or gas | Lighting and cooling are electric; hot water is mostly gas; heating depends on the HVAC type | `defaults.json` fuel mix |
| 8. Cost | **kWh × electricity price + therms × gas price** | EIA average commercial prices for Illinois: $0.1405/kWh, $0.929/therm (`rates.json`) |
| 9. Carbon | **kWh × grid carbon factor + therms × gas carbon factor** | EPA eGRID (Chicago's grid, RFC West: 0.4155 kg CO₂e per kWh) and EPA's gas factor (5.311 kg per therm) (`emissions.json`) |

**Result for Lakeshore Inn (today, estimate):** about **698,000 kWh** of electricity and **23,800 therms** of gas a year, costing about
**$120,000** ($98,000 electricity + $22,000 gas), with about **416 tonnes CO₂e**.

Quick check you can do by hand: 698,150 kWh × $0.1405 = $98,090, and 23,776 therms × $0.929 = $22,088. Total $120,178.

## 3. How carbon is calculated (in tonnes)

Carbon is **calculated, not measured**: nothing in the hotel meters it. We take the estimated energy and multiply by kilograms of CO₂e
per unit, the same way cost multiplies by dollars per unit.

```
carbon (kg) = kWh × kg per kWh  +  therms × kg per therm
tonnes      = kg ÷ 1,000          (a metric tonne: 1,000 kg, about 2,205 lb)
```

**Lakeshore Inn (synthetic, estimate):**

| | Energy a year | × Factor | = Carbon |
| --- | --- | --- | --- |
| Electricity | 698,150 kWh | 0.4155 kg CO₂e per kWh | 290,082 kg |
| Natural gas | 23,776 therms | 5.311 kg CO₂e per therm | 126,274 kg |
| **Total** | | | **416,356 kg ≈ 416 tonnes** |

**Where the two factors come from** (`src/data/hotel/emissions.json`):
- **Electricity, 0.4155 kg per kWh:** EPA eGRID2023. EPA divides everything a grid region's power plants emitted in a year by the
  electricity they produced. Chicago is in the RFC West region (it serves ComEd). Grids differ, so the factor follows the city: California's
  grid is about 0.195, so the same kWh there counts for less than half the carbon. The U.S. average (0.3497) is used when the region is unknown.
- **Natural gas, 5.311 kg per therm:** EPA GHG Emission Factors Hub 2025. This is chemistry: burning a therm of gas always releases
  about 5.3 kg of CO₂, plus small amounts of methane and nitrous oxide.
- **CO₂e (CO₂-equivalent):** methane and nitrous oxide are converted into the amount of CO₂ that would warm the planet as much
  (IPCC AR5 factors), so everything adds up in one unit.

**Upgrades work the same way:** carbon avoided = kWh saved × 0.4155 + therms saved × 5.311.

**There is no carbon price.** Carbon stays in tonnes; the app never turns it into dollars, and it doesn't change any cost, payback or
package ranking. (Carbon fines such as New York's Local Law 97 appear in the pitch as a reason the topic matters, not in the math.)

**Limits:** an estimate, not verified carbon accounting. It uses the grid's **yearly average** (location-based), not the hour-by-hour mix,
so noon solar and midnight lighting count the same. And because the energy is an estimate until real bills are entered, so is the carbon.

**What is included, and what isn't.** Energy Twin counts the energy-related carbon: purchased electricity (Scope 2) and natural gas
burned on site (Scope 1). That is the core of hotel energy footprints, and electricity plus gas is about 96% of a typical US hotel's
energy (EIA CBECS 2018, below).

| Energy source in US hotels and resorts | Share of energy (major fuels) | Hotels using it | In Energy Twin? |
| --- | --- | --- | --- |
| Electricity | 57.1% | 100% | Yes |
| Natural gas | 39.2% | 64% | Yes |
| District steam, hot water or chilled water | 2.7% | about 5% | No |
| Fuel oil or diesel (boilers, emergency generators) | 1.0% | 7% | No |
| Propane | small (not a CBECS major fuel) | 14% | No |
| On-site solar | small | about 3% | Yes (existing solar, in the equipment list) |

Source: computed from the CBECS 2018 public microdata, hotels and resorts (`PBAPLUS` 38, 272 buildings, weighted with `FINALWT` to
65,800 US buildings): each fuel's Btu over the major-fuel total `MFBTU`; "hotels using it" from the `…USED` flags (`docs/14`, pass 13).

| Carbon source | Scope | In Energy Twin? |
| --- | --- | --- |
| Purchased electricity | 2 | Yes (EPA eGRID) |
| Natural gas burned on site | 1 | Yes (EPA factor) |
| District steam or chilled water | 2 | No |
| Fuel oil, propane, generator diesel | 1 | No |
| Refrigerant leaks (AC, chillers, kitchen refrigeration) | 1 | Optional (branch `twin/flow-carbon`): enter the refrigerant and pounds added a year in Equipment; carbon = lb × 0.454 × GWP (EPA), shown next to the energy carbon. These gases warm the planet hundreds to thousands of times more than CO₂ per kg |
| Hotel vehicles (shuttles) | 1 | No |
| Electricity lost on power lines | 2 (adjustment) | No: eGRID's output rate excludes it |
| Outsourced laundry, food, waste, water, guest travel, construction materials | 3 | No: outside a building energy tool |

The app's "How was this calculated?" panel for carbon lists the same exclusions. Next: district steam and other fuels when we model New York or rural hotels.

**To a judge:** "We cover electricity and natural gas, about 96% of a typical US hotel's energy, and the energy-related carbon, Scopes 1
and 2. Refrigerants, district steam and backup fuels are next."

**In one line:** "We convert the estimated energy to carbon with EPA's published factors for Chicago's grid and for natural gas."

## 4. Then what are all the JSON files?

They are the **inputs and their sources**, the "reference book" the calculation reads. They are not a database of the hotel's appliances,
and there is no server database: the files are bundled into the app and the math runs in your browser.

| File | In plain words |
| --- | --- |
| `defaults.json` | Typical energy per ft², age factors, how energy splits into uses and zones, default settings (occupancy 65%, 68 °F / 74 °F setpoints) |
| `rates.json` | Electricity and gas prices by state (EIA), solar installation cost and export credit |
| `emissions.json` | Carbon per kWh for each US grid region (EPA eGRID) and per therm of gas (EPA) |
| `weather.json` | Monthly temperatures, degree days and solar output for each city (NOAA, NREL PVWatts) |
| `upgrades.json` | The 10 upgrade options: how much each saves (low, mid, high) and what it costs |
| `incentives.json` | Utility rebates (ComEd, Peoples Gas), Illinois Shines and the federal solar tax credit, with their sources |
| `equipment.json` | Templates for the estimated equipment list and the few settings that feed the model (section 5) |
| `presets.json`, `properties.json`, `organizations.json` | The synthetic demo hotels and portfolio (labeled synthetic) |
| `shapes.json` | Hour-by-hour shapes for the "typical day" view and solar matching |

Every value in them carries a **source** and whether it is verified; `docs/14` lists them all. Your own data (utility bills, edited
equipment, saved plans) stays in your browser's local storage.

## 5. And what is the "equipment"?

The **Equipment** tab shows an **estimated list** of what a hotel like this probably has: boilers, a chiller, water heaters, lighting by
area, room HVAC units, kitchen and laundry gear, elevators. It is there so an owner can **recognise their building** and see which
equipment the energy goes to. It is generated from the hotel's size and HVAC type, and is labeled estimated.

**Most of it does not change the numbers.** The total still comes from the top-down calculation above. Only five things on the list feed
back into the model, because they map cleanly onto it:

| If you change… | …the model changes like this |
| --- | --- |
| Boiler or heat-pump **heating efficiency** | Heating energy goes down if your equipment is more efficient than the typical 80% |
| Chiller or AC **cooling efficiency** | Cooling electricity scales with it |
| **LED share** in rooms, lobby, corridors | That zone's lighting energy goes down |
| **Water-heater efficiency** | The gas part of hot water scales with it |
| **Existing solar** (kW) | Purchased electricity goes down by what the panels produce |

Everything else (quantities, ages, the kitchen, elevators, adding a dishwasher) is **shown, labeled "informational", and does not change
consumption**. We chose that on purpose: we would rather say "we don't model this" than invent a number for it (`docs/20`).

## 6. How the upgrades save energy

Each upgrade cuts **the part of the hotel's energy it affects**, as a percentage with a low, mid and high case, from published sources
(mostly the Illinois Technical Reference Manual) or labeled placeholders. For example, LED lighting cuts lighting energy 35–55%, and the app
also accounts for the side effect: less heat from lights means slightly less cooling and slightly more heating. Smart room controls re-run
the model with empty rooms set back 5 °F. Upgrades are applied one after another to what's left, so savings are **never double-counted**.
Then: cost minus incentives = net investment; yearly savings → payback, five-year net benefit and the 10-year projection (`docs/13` §8,
`docs/18`).

## 7. Making it this hotel's numbers: utility bills

The top-down estimate is a well-sourced starting point, not this hotel's real bill. When an owner enters or uploads **12 months of
utility bills**, the app compares the model to the bills and adjusts two multipliers per fuel (the weather part and the rest) so the model
matches the hotel. It reports the fit with the ASHRAE Guideline 14 measures (NMBE, CV(RMSE)), and the owner chooses whether to use the
calibrated version (`docs/19`).

## 8. Where the AI fits

The AI advisor **never calculates**. Every number comes from the engine above; the advisor only explains them in plain language, and the
browser rejects any answer containing a number that isn't in the results (`docs/12`).

## 9. What this method is good for, and its limits

Good for: a fast, sourced first look at where energy and money go, and fair side-by-side comparisons of decisions and upgrades, without an
energy audit or sensors.

Not: an engineering audit, an hourly simulation of a real year, demand charges or tariff details, verified carbon accounting, or
real-time monitoring. Upgrade savings are ranges, and some costs are still placeholders (labeled in the app). See `docs/21` for the limits
shown in the app.
