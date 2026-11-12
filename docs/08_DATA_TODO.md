# 08 — Hotel data: status and research to-do

What is sourced, what is still a placeholder, and what to look up next, for the data in `src/data/hotel/`. Rules:
- Every value carries a `source` that names the exact table, page or study. Set `"verified": true` only when the value was read in the primary
  source (not a summary). Say "PLACEHOLDER" for estimates and say when a value is a modeling choice.
- **Never invent a number** (incentives especially). A missing value stays a labeled placeholder.
- **Change the demo story, not the numbers.** Calibration follows evidence, never the script.

The model is described in [13_HOTEL_ENGINE_SPEC.md](13_HOTEL_ENGINE_SPEC.md); tasks are in [11_HOTEL_TASKS.md](11_HOTEL_TASKS.md) (7.x, 7b.x).
The home-era data files in `src/data/` belong to the legacy home engine and are not used by the hotel app.

## Status at a glance (November 2026)

| Data | State | Source |
| --- | --- | --- |
| Electricity and gas prices (`rates.json`) | **Sourced, primary** | EIA Electric Power Monthly Table 5.6.B (IL, YTD Aug 2026); EIA natural gas prices (IL 2025) |
| Price growth (`defaults.json` → `finance`) | **Sourced, primary** | EIA AEO2026 Tables 8 and 3: electricity 2.12%, gas 4.09% a year (nominal, 2025–2035) |
| End-use split and fuel mix (`defaults.json`) | **Sourced, primary** (national lodging) | EIA CBECS 2018 Tables E1 and E5 |
| Grid and gas emission factors (`emissions.json`) | **Sourced, primary** | EPA eGRID2023 (RFCW 0.4155, U.S. 0.3497 kg CO2e/kWh); EPA GHG Emission Factors Hub 2025 (5.311 kg/therm) |
| Solar output (`weather.json` → `solar`) | **Sourced, primary** | NLR PVWatts v8.5, Chicago TMY: 1,194 / 1,240 / 1,307 kWh per kW (5°/10°/20° tilt) and the monthly split |
| Lighting–HVAC interaction (`upgrades.json` → `interaction`) | **Sourced, primary** | IL-TRM v14.0 Vol. 2, section 4.5 table, Hotel/Motel guest and common |
| Smart room controls cost and life | **Sourced, primary** | IL-TRM v14.0 4.4.8: $260 per room, 15 years |
| Occupancy-sensor savings and life | **Sourced, primary** | IL-TRM v14.0 4.5.10: 24% (37% with high-end trim), 10 years |
| Solar O&M and degradation | Sourced, from search excerpts | NLR ATB 2025 ($17.63/kW-yr); Jordan et al. 2022 (0.5%/yr) |
| LED savings range and life; EMS, insulation, condensing-boiler savings | Partly sourced (excerpts, plus TRM rules) | PNNL/GSA, Crowe 2020, NREL ComStock, IL-TRM 4.5.4 |
| Export credit for solar | Basis known, **no $ value** (so $0) | 220 ILCS 5/16-107.5(n): avoided cost of supply |
| Incentives (`incentives.json`) | Programs listed, **no amounts applied** | — |
| **Installed costs** for LED, sensors, EMS, HVAC, water heating, insulation; **solar $/W** | **Placeholders** | — |
| Weather (`weather.json` temperatures) | **Placeholder** (from memory) | NOAA normals not reachable yet |
| Baseline model internals (age factor, zone allocation, driver weights, shapes, equipment, occupancy curve) | **Placeholders** | — |

**Benchmark check (done):** the demo hotel models at 91.1 kBtu/ft² site energy, 53% electric; CBECS 2018 Table C1 lodging averages 85.7 kBtu/ft²,
57% electric (national). Plausible for Chicago.

## To do — priority A (changes results or the recommendation)

- [ ] **A1. Calibrate smart room controls (decision needed, task 7b.5).** IL-TRM v14.0 4.4.8, Chicago hotel with central hot-water fan coils and gas
  heat, deems **92–147 kWh and 3.0–6.5 therms per ton** of guest-room cooling per year (with / without housekeeping setback). At 0.75–1.0 ton per room
  (assumption; the TRM gives no default) that is 6,900–14,700 kWh and 225–650 therms for 100 rooms, about **$1,200–2,700 a year**. The model gives
  **4,903 kWh and 209 therms ($883)**. The electric gap is the larger one: the TRM measure also controls the room's fan, which the model does not.
  Options: (a) add guest-room fan savings when a room is empty, sized so the model lands inside the TRM range; (b) keep the model and show the TRM
  range beside it. Either way the change goes into the shared simulation so the Scenario switch and the upgrade card agree.
- [ ] **A2. Installed costs** (per ft², per room or per unit) for LED retrofit, occupancy sensors (the TRM gives $55–125 per sensor; needs a coverage
  area per sensor), energy management controls, HVAC equipment, water heating plus low-flow fixtures (TRM: about $12 per showerhead) and roof
  insulation. Sources: IL-TRM measure costs where they exist, ComEd and Peoples Gas program data, DOE/NREL cost studies, hotel case studies.
- [ ] **A3. Solar installed $/W by size** for small commercial (≤100 kW) systems in Illinois: LBNL *Tracking the Sun* / *Distributed Solar and
  Storage* data file. `emp.lbl.gov` blocks automated downloads, so **download it by hand and upload it** to the session.
- [ ] **A4. Incentive amounts** (only with a source): ComEd business rebates for LED, controls and HVAC (`www.comed.com` is reachable); Peoples Gas
  rebates; Illinois Shines REC payments; federal Section 48E status for new solar (needs `www.irs.gov`). Enter as `value`, `applied: true`,
  `verified: true` in `incentives.json`.
- [ ] **A5. Solar export credit $/kWh** for a ComEd non-residential customer (supply-only credit): ComEd tariff or Illinois Commerce Commission filing.
  Low impact for the demo hotel, which exports nothing.

## To do — priority B (improves realism)

- [ ] **B1. Chicago weather normals** (NOAA 1991–2020, O'Hare or Midway) to replace the temperatures written from memory; needs `www.ncei.noaa.gov`.
  Cross-check found: the PVWatts typical year for downtown is 4–8 °F cooler in May to July than the placeholder (lakefront and "typical year"
  effects), so confirm with NOAA before changing.
- [ ] B2. HVAC equipment: cooling reduction (chiller or RTU replacement) and lifetime; condensing boiler range (IL-TRM boiler measures, NREL ComStock).
- [ ] B3. Water heating: share of a hotel's hot water used by showers and sinks (to turn the TRM showerhead and aerator flows into a % reduction),
  heater efficiency gain, and gallons per occupied room per day (ASHRAE RP-1544 or the IL-TRM hot-water section).
- [ ] B4. Lifetimes still placeholders: energy management controls, insulation, water heating.
- [ ] B5. Climate-specific end-use split (CBECS has no lodging-by-climate table; NREL ComStock hotel results by climate zone).
- [ ] B6. Baseline internals: age factor by year built, zone allocation, central-plant share by HVAC type, driver weights, hourly shapes
  (ComStock hotel profiles), equipment sizing, Chicago seasonal occupancy (STR or Choose Chicago), floor area per room.
- [ ] B7. Comfort limits and setpoint references (ASHRAE 55).

## Decisions (not facts; record the reasoning)

- [ ] Discount rate for NPV (3% placeholder; NPV is not shown on the cards).
- [ ] Optimizer rules: minimum comfort score 0.70, minimum savings 1% of the bill, balanced weights 0.5 / 0.3 / 0.2.
- [ ] PTAC heating treated as electric resistance (a PTHP hotel would use the heat-pump interaction factor).
- [ ] Whether to add a smaller solar array, a heat-pump option and a heat-pump water heater as alternatives.
- [ ] Illinois emission factor assumes a ComEd (northern Illinois, RFCW) building; Ameren territory would use SRMW.

## Validation

- [x] Demo hotel energy intensity against CBECS 2018 lodging (see above).
- [ ] Against the ENERGY STAR national median for hotels (needs `portfoliomanager.energystar.gov`).
- [ ] Package savings as a share of the bill against published hotel case studies (DOE Better Buildings, utilities).
- [ ] After A1–A3, re-run the optimizer and write the demo question from what the results say (task 8.1).

## Network hosts

Reachable now: `www.eia.gov`, `developer.nlr.gov` (PVWatts), `icc.illinois.gov` (IL-TRM), `www.comed.com`, `www.energystar.gov`, `www.epa.gov`.
Still needed (exact names; `irs.gov` does not cover `www.irs.gov`): `www.ncei.noaa.gov`, `portfoliomanager.energystar.gov`, `www.irs.gov`,
`www.dsireusa.org`, `atb.nlr.gov` and `docs.nlr.gov` (to confirm O&M and degradation in the primary texts). LBNL: manual download.
NREL is now the National Laboratory of the Rockies (NLR); `developer.nrel.gov` stopped resolving on May 29, 2026.
