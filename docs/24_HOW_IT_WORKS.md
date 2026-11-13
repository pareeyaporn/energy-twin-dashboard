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

## 3. "Carbon price": there isn't one

Carbon is measured in **tonnes**, not dollars. We multiply energy by an emission factor (step 9). The app **does not** put a dollar price
on carbon anywhere, and carbon doesn't change any cost, payback or package ranking. (Carbon fines such as New York's Local Law 97 are
mentioned in the pitch as a reason the topic matters, not used in the math.)

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
