# 08 — Hotel data: status and research to-do

What is sourced, what is still a placeholder, and what to look up next, for the data in `src/data/hotel/`. Rules:
- Every value carries a `source` that names the exact table, page or study. Set `"verified": true` only when the value was read in the primary
  source (not a summary). Say "PLACEHOLDER" for estimates and say when a value is a modeling choice.
- **Never invent a number** (incentives especially). A missing value stays a labeled placeholder.
- **Change the demo story, not the numbers.** Calibration follows evidence, never the script.

The model is described in [13_HOTEL_ENGINE_SPEC.md](13_HOTEL_ENGINE_SPEC.md); tasks are in [11_HOTEL_TASKS.md](11_HOTEL_TASKS.md) (7.x, 7b.x).
**Every change with before, after and source is logged in [14_RESEARCH_LOG.md](14_RESEARCH_LOG.md).**
The home-era data files were removed, except `presetHomes.json`, `mockPackages.json` and `mockParts.json`, which the store still imports for backwards compatibility.

## Status at a glance (November 2026)

| Data | State | Source |
| --- | --- | --- |
| Electricity and gas prices (`rates.json`) | **Sourced, primary** | EIA Electric Power Monthly Table 5.6.B (IL, YTD Aug 2026); EIA natural gas prices (IL 2025) |
| Price growth (`defaults.json` → `finance`) | **Sourced, primary** | EIA AEO2026 Tables 8 and 3: electricity 2.12%, gas 4.09% a year (nominal, 2025–2035) |
| End-use split and fuel mix (`defaults.json`) | **Sourced, primary** (national lodging) | EIA CBECS 2018 Tables E1 and E5 |
| Grid and gas emission factors (`emissions.json`) | **Sourced, primary** | EPA eGRID2023 (RFCW 0.4155, U.S. 0.3497 kg CO2e/kWh); EPA GHG Emission Factors Hub 2025 (5.311 kg/therm) |
| Solar output (`weather.json` → `solar`) | **Sourced, primary** | NLR PVWatts v8.5, Chicago TMY: 1,194 / 1,240 / 1,307 kWh per kW (5°/10°/20° tilt) and the monthly split |
| Lighting–HVAC interaction (`upgrades.json` → `interaction`) | **Sourced, primary** | IL-TRM v14.0 Vol. 2, section 4.5 table, Hotel/Motel guest and common |
| Smart room controls cost, life and savings | **Sourced, primary**; savings **calibrated** | IL-TRM v14.0 4.4.8: $260 per room, 15 years; fan saving calibrated so the model lands in the TRM's Chicago-hotel range |
| Occupancy-sensor savings and life | **Sourced, primary** | IL-TRM v14.0 4.5.10: 24% (37% with high-end trim), 10 years |
| Solar O&M and degradation | **Sourced, primary** | NLR ATB 2025 ($17.63/kW-yr); Jordan et al. 2022 (0.48%/yr cooler climates; 0.5% used) |
| Federal solar credit | Facts recorded, **not applied** | IRS Notice 2025-42; IRS 48E page |
| Hotel sizes (presets) | **Checked, primary** | Choose Chicago hotel supply list (median 232 rooms) |
| LED savings range and life; EMS, insulation, condensing-boiler savings | Partly sourced (excerpts, plus TRM rules) | PNNL/GSA, Crowe 2020, NREL ComStock, IL-TRM 4.5.4 |
| Export credit for solar | Basis known, **no $ value** (so $0) | 220 ILCS 5/16-107.5(n): avoided cost of supply |
| Incentives (`incentives.json`) | **ComEd amounts applied** (LED, sensors, guest room energy management; 90% cap); HVAC equipment, EMS, gas, Illinois Shines, 48E listed only | ComEd worksheets 2025 lighting, 2026 HVAC (team-provided) |
| Installed costs | **Sourced:** smart controls, insulation, water heating (IL-TRM), solar $/W (LBNL). **Placeholders:** LED, sensors, EMS, HVAC equipment | IL-TRM v14.0; LBNL 2025 Data Update |
| Weather (`weather.json` temperatures) | **Sourced, primary** | NOAA 1991–2020 normals, Chicago O'Hare |
| Hot water per room | **Checked, primary** | IL-TRM 4.3.2 / ASHRAE: 14 gal per hotel room per day (default consistent) |
| Chicago occupancy (annual) | **Sourced, primary** | STR via Choose Chicago: CBD 69.2% in 2025 (300-room preset) |
| Comfort limits | **Product decision** | docs/15 (not ASHRAE 55 values) |
| Peer benchmarks (`defaults.json` → `peerBenchmarks`) | **Sourced, primary**; comparison only | ENERGY STAR hotel median 63.0 (Aug 2024); CBECS 2018 lodging 85.7 |
| Hourly outdoor temperature (3D readout) | **Modeled** from sourced normals | NOAA 1991–2020 O'Hare normal highs and lows; low at sunrise, high at 15:00 |
| Baseline model internals (age factor, zone allocation, driver weights, shapes, equipment, monthly occupancy shape) | **Placeholders** | monthly occupancy is not published |

**Benchmark check (done; updated in research pass 8 to 86.5 kBtu/ft²):** the demo hotel models at 91.1 kBtu/ft² site energy, 53% electric; CBECS 2018 Table C1 lodging averages 85.7 kBtu/ft²,
57% electric (national, includes nursing homes); the ENERGY STAR national median for hotels is 63.0 kBtu/ft² (August 2024). Plausible for a Chicago
hotel with a restaurant, but on the high side; the default EUI input stays a placeholder (B5).

## To do — priority A (changes results or the recommendation)

- [x] **A1. Calibrate smart room controls — done (option a).** Guest-room fan energy is cut 17% while rooms are empty, in the shared simulation;
  the model now saves about 10,800 kWh and 209 therms ($1,715) for 100 rooms, inside the TRM range. Background: IL-TRM v14.0 4.4.8, Chicago hotel with central hot-water fan coils and gas
  heat, deems **92–147 kWh and 3.0–6.5 therms per ton** of guest-room cooling per year (with / without housekeeping setback). At 0.75–1.0 ton per room
  (assumption; the TRM gives no default) that is 6,900–14,700 kWh and 225–650 therms for 100 rooms, about **$1,200–2,700 a year**. The model gives
  **4,903 kWh and 209 therms ($883)**. The electric gap is the larger one: the TRM measure also controls the room's fan, which the model does not.
  Options: (a) add guest-room fan savings when a room is empty, sized so the model lands inside the TRM range; (b) keep the model and show the TRM
  range beside it. Either way the change goes into the shared simulation so the Scenario switch and the upgrade card agree.
- [x] **A2. Installed costs** — *mostly done (November 2026). Sourced from the IL-TRM: smart controls ($260/room), insulation ($1.40/ft², 2024 $), water heating (~$200/room), occupancy sensors ($55–125 per sensor at 250 ft² per sensor, an assumption), HVAC equipment for rooftop units ($895–1,021/ton) and PTAC/PTHP ($1,047/ton), the boiler part of a central plant ($22.95/kBtu/h); solar from LBNL. Still placeholders, because no full retrofit cost is published in reachable sources: LED retrofit (the TRM gives only incremental equipment costs, about $0.70–1.50 per watt removed, a lower bound), energy management systems (no TRM measure), the chiller part of a central plant (TRM gives incremental $/ton only), VRF.* (per ft², per room or per unit) for LED retrofit, occupancy sensors (the TRM gives $55–125 per sensor; needs a coverage — *Pass 10 (November 2026): energy management now sourced (NREL 2022, $0.79 / $2.53 / $7.60 per ft²) and the chiller part sourced (EIA 2023, $820 / $1,030 / $1,350 per ton, a lower bound); LED now sits between sourced EIA bounds (relamp vs new luminaire), its mix an assumption. VRF stays a placeholder. Done as far as published data allows.*
  area per sensor), energy management controls, HVAC equipment, water heating plus low-flow fixtures (TRM: about $12 per showerhead) and roof
  insulation. Sources: IL-TRM measure costs where they exist, ComEd and Peoples Gas program data, DOE/NREL cost studies, hotel case studies.
- [x] **A3. Solar installed $/W by size — done (November 2026).** LBNL *Distributed Solar & Storage, 2025 Data Update*, p. 8: 2024 national
  median gross installed prices for non-residential PV by size ($3.70 up to 10 kW … $1.70 over 1,000 kW), transcribed by the team (the PDF host
  is not reachable from the build session). The ±15% low/high band is a placeholder. Editable per hotel (`solarCostPerW`). Still to do:
  Illinois- or Chicago-specific prices and the percentiles, if wanted.
- [x] **A4. Incentive amounts** — *mostly done (November 2026), from ComEd's own worksheets: LED $0.75 per watt reduced and occupancy sensors $0.25 per watt controlled (2025 Indoor Lighting worksheet; confirm 2026), guest room energy management $75 per ton with gas heat / $100 with electric or heat-pump heat (2026 HVAC worksheet); 90% of cost cap. Listed, not applied: HVAC equipment (rated-efficiency based), energy management (EMS worksheet not provided), Peoples Gas, Illinois Shines, federal 48E.* Originally: (only with a source; until then shown as unverified and $0). ComEd: the 2026 Standard Incentives Application — *Pass 10 (November 2026): a May 2026 secondary source states the same $0.75 per W reduced and $0.25 per W controlled; the primary 2026 worksheet is on a blocked host. Kept, with the note.*
  rules are recorded; the measure amounts are in worksheets on `azure-na-assets.contentstack.com` (allow it, or download the worksheets by hand).
  Also: ComEd business rebates for LED, controls and HVAC (`www.comed.com` is reachable); Peoples Gas
  rebates; Illinois Shines REC payments; federal Section 48E status for new solar (needs `www.irs.gov`). Enter as `value`, `applied: true`,
  `verified: true` in `incentives.json`.
- [x] **A5. Solar export credit $/kWh** (*still blocked: `www.ilga.gov` refused by the session's network policy; no effect on either preset, which export 0 kWh*) for a ComEd non-residential customer (supply-only credit): ComEd tariff or Illinois Commerce Commission filing. — *Pass 10 (November 2026): method sourced (credited at the supply rate after 2024; above 100 kW, supply and transmission only); no non-residential $/kWh found, so the $0 fallback stays (editable). Closed until a supply price is published for hotels.*
  **$0 kept as a labeled conservative fallback, now editable per hotel** (`solarExportCreditPerKWh`). No effect on either preset: both use all
  their solar on site (0 kWh exported). Which rules apply to this hotel is listed in docs/14, pass 5 (to confirm; `www.ilga.gov` and
  `illinoisshines.com` are not reachable from the build session).

## To do — priority B (improves realism)

- [x] **B1. Chicago weather normals — done** (NOAA O'Hare, 1991–2020). Note: (NOAA 1991–2020, O'Hare or Midway) to replace the temperatures written from memory; needs `www.ncei.noaa.gov`.
  Cross-check found: the PVWatts typical year for downtown is 4–8 °F cooler in May to July than the placeholder (lakefront and "typical year"
  effects), so confirm with NOAA before changing.
- [x] B2. HVAC equipment — *done where the TRM allows (November 2026)*: lifetimes by system (central plant 23, RTU 15, PTAC/PTHP 8, VRF 16 years; IL-TRM 4.4.6, 4.4.10, 4.4.15, 4.4.13, 4.4.9); cooling high 26% from the TRM 4.4.6 chiller example. Mid/low cooling, heating range and cost remain placeholders.
- [x] B3. Water heating (*still open: the showers' share is not in the IL-TRM or in ComStock's results, which report water heating as one end use*; *partly: faucets are 25% of hotel hot water, 14 gal/room-day, IL-TRM 4.3.2; heater 0.80 to 0.90 Et saves 11%; showerheads 2.67 gpm baseline, 4.3.3; the showers’ share is not in the TRM*): share of a hotel's hot water used by showers and sinks (to turn the TRM showerhead and aerator flows into a % reduction), — *Pass 10 (November 2026): guest rooms ≈ 79% of service water heating (EPA CHP hotel report, 2005); a showers-only share is still not published.*
  heater efficiency gain, and gallons per occupied room per day (ASHRAE RP-1544 or the IL-TRM hot-water section).
- [x] B4. Lifetimes — *done (November 2026)*: insulation 20 (IL-TRM 4.8.1), water heating 15 (4.3.1; fixtures 10), energy management 10 (nearest TRM controls measure, 4.4.41; a judgment).
- [x] B5. Climate-specific end-use split — *done (November 2026)*: NLR ComStock 2025 Release 3, zone-5A large and small hotels (heating 21.9, cooling 10.6, ventilation 6.4, lighting 8.9, hot water 19.1, kitchen 15.0, equipment and other 18.1%); other climates keep CBECS national.
- [x] B6. Baseline internals — *partly done (November 2026)*: site EUI for Chicago 92.3 kBtu/ft² and the age factor (×1.035 / 0.947 / 1.025) from ComStock (zone 5A; Illinois hotels by vintage); hourly load shapes from ComStock zone-5A hotels. *Still unsourced:* zone allocation, central-plant share by HVAC type, driver weights (calibration choices), equipment sizing, monthly occupancy (STR publishes annual only), floor area per room. Originally: age factor by year built, zone allocation, central-plant share by HVAC type, driver weights, hourly shapes — *Pass 10 (November 2026): no published hotel breakdown by zone or plant share exists in the reachable sources; these stay documented calibration assumptions.*
  (ComStock hotel profiles), equipment sizing, Chicago seasonal occupancy (STR or Choose Chicago), floor area per room.
- [x] B7. Comfort limits and setpoint references — *closed as a product decision (November 2026)*: ASHRAE 55 is a paid standard and was not purchased; the limits are team choices (docs/15 section 7). Sourced reference kept: IL-TRM 4.4.8 and the ComEd 2026 worksheet require at least a 5 °F unoccupied setback for guest-room controls (the model's default).

## Decisions (not facts) — decided, see [15_PRODUCT_DECISIONS.md](15_PRODUCT_DECISIONS.md)

- [x] Discount rate: 8% default, 3% alternative; NPV in the detailed comparison, simple payback on the cards.
- [x] Optimizer: comfort limit 0.70 kept and documented; no minimum savings share; balanced weights configurable and normalized.
- [x] HVAC types: PTAC (resistance), PTHP (heat pump), central plant, VRF, rooftop units, each with its heating efficiency and interaction factor.
- [x] Solar at three sizes. Heat-pump HVAC and heat-pump water heaters deferred until sourced cost and performance exist.
- [x] Emissions: eGRID subregion by location (Chicago RFCW), editable per hotel.

## Validation

- [x] Demo hotel energy intensity against CBECS 2018 lodging (see above).
- [x] Against the ENERGY STAR national median for hotels (63.0 kBtu/ft² site): the demo hotel is 45% above it (see the benchmark note).
      Now computed by `benchmarkComparison` and shown in the app (LV15) as context; the model is not tuned toward it.
- [x] Package savings as a share of the bill against published hotel case studies (DOE Better Buildings, utilities). — *Pass 10 (November 2026): six published hotel cases compared in docs/14 (pass 10): whole-building and lighting results agree; guest-room controls read low in the model (reported, not tuned).*
- [x] After A1–A3, re-run the optimizer and write the demo question from what the results say — *done (research pass 9): the $50,000 pick stays LED + occupancy sensors; the suggested question is in docs/07. Note for task 8.2: the offline template answer to it does not mention solar.*

## Network hosts

Reachable now: `www.eia.gov`, `developer.nlr.gov`, `atb.nlr.gov`, `docs.nlr.gov`, `icc.illinois.gov`, `www.comed.com`, `www.energystar.gov`,
`portfoliomanager.energystar.gov`, `www.epa.gov`, `www.ncei.noaa.gov`, `www.irs.gov`, `www.choosechicago.com`. Still needed: `www.dsireusa.org`
(incentive database). LBNL (`emp.lbl.gov`) blocks automated downloads: download the Tracking the Sun file by hand. ComEd's rebate tables load with
JavaScript, so their amounts need a PDF catalog or a manual copy.
NREL is now the National Laboratory of the Rockies (NLR); `developer.nrel.gov` stopped resolving on May 29, 2026.
