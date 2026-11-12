# 14 — Research log

Every value that replaced a placeholder: what it was, what it is now, the exact source, and how it was read. "Primary" means the value was
read in the publisher's own document or data file (downloaded and parsed, or read on the page); "excerpt" means it was seen only in a search
summary of that document and still needs a primary check. Status by file and what is left: [08_DATA_TODO.md](08_DATA_TODO.md).
Method: [13_HOTEL_ENGINE_SPEC.md](13_HOTEL_ENGINE_SPEC.md), section 8.

**Status words used below.** *Primary*: read in the publisher's own document or data file. *Team-provided*: a document or figure the team
supplied (uploaded or transcribed) that the build session could not fetch itself. *Derived*: computed from sourced values (the calculation is
stated). *Calibrated*: tuned so the model lands in a sourced range. *Assumption* / *placeholder*: not sourced; labeled in the app.
*Product decision*: a team choice (docs/15), not a fact.

## Current values (as of pass 7, November 2026)

The model's inputs today, with their status. Details and before/after values are in the passes below.

### Energy prices, weather, emissions

| Input | Value in the model | Source | Status | Pass |
| --- | --- | --- | --- | --- |
| Electricity price, Illinois commercial | $0.1405 per kWh | EIA Electric Power Monthly, Table 5.6.B, YTD Aug 2026 | Primary | 1 |
| Natural gas price, Illinois commercial | $0.929 per therm | EIA Natural Gas Prices, 2025 annual ($9.63/Mcf) | Primary | 1 |
| Price growth | electricity 2.12%, gas 4.09% a year (nominal) | EIA AEO2026, Tables 8 and 3 | Primary | 1 |
| Discount rate | 8% (3% alternative) | — | Product decision | 3 |
| Weather | NOAA 1991–2020 normals, O'Hare: monthly means, highs and lows | NOAA NCEI | Primary | 2, 4 |
| Grid emissions | 27 eGRID2023 subregions; Chicago RFC West 0.4155 kg CO2e/kWh | EPA eGRID2023 | Primary | 2, 3 |
| Gas emissions | 5.311 kg CO2e per therm | EPA GHG Emission Factors Hub 2025 | Primary | 2 |

### The hotel

| Input | Value in the model | Source | Status | Pass |
| --- | --- | --- | --- | --- |
| End-use split | Chicago: ComStock zone-5A hotels; other climates CBECS 2018 lodging | NLR ComStock 2025 R3; EIA CBECS E1 | Primary | 8 (1) |
| Fuel mix | CBECS 2018 lodging | EIA CBECS Table E5 | Primary (national) | 1 |
| Hourly load shapes | ComStock zone-5A hotels, average day per end use | NLR ComStock 2025 R3 | Primary (downloaded) | 8 |
| Site energy intensity | Chicago 92.3 kBtu/ft² × age factor (1.035 before 1980, 0.947 for 1980–1999, 1.025 from 2000); other climates 92 (placeholder) | NLR ComStock 2025 R3: zone-5A hotels; Illinois hotels by vintage | Primary (downloaded) | 8 |
| Peer benchmarks | ENERGY STAR 63.0, CBECS 85.7 kBtu/ft² | ENERGY STAR (Aug 2024); CBECS Table C1 | Primary (context only) | 2, 4 |
| Hot water | 20 gal per occupied room-day; faucets 25% of it | IL-TRM v14.0 4.3.2 (14 gal per room-day) | Primary (cross-check) | 3, 6 |
| Heating efficiency by HVAC type | gas 0.80; resistance 1.0; heat pump COP 2.3 | IL-TRM conversion | Primary / assumption | 3 |
| Hotel sizes, occupancy | 100-room boutique (synthetic); 300-room at 69.2% | Choose Chicago; STR via Choose Chicago | Primary (annual); monthly shape synthetic | 2, 3 |
| Equipment sizes (lighting W, tons, kW) | rules of thumb; 0.75 ton of cooling per guest room | — | Placeholder / assumption | 7 |
| Comfort limits | team values | — | Product decision (ASHRAE 55 not consulted) | 3 |

### Upgrades: savings, cost, life

| Upgrade | Savings | Installed cost | Life | Cost status |
| --- | --- | --- | --- | --- |
| Smart room controls | setback 3/5/7 °F + fan 17% when empty (calibrated to IL-TRM 4.4.8) | $260 per room (IL-TRM 4.4.8) | 15 (IL-TRM 4.4.8) | Sourced |
| LED lighting | 27 / 45 / 60% (PNNL; judgment) | $0.60 per ft² | 12 (IL-TRM 4.5.4 rule) | Placeholder |
| Occupancy sensors | 12 / 24 / 37% (IL-TRM 4.5.10) | $0.36 per ft² of common area (IL-TRM 4.5.10 $55–125 per sensor; 250 ft² per sensor assumed) | 10 (IL-TRM 4.5.10) | Sourced (with an assumption) |
| Energy management | 4 / 7 / 10% of HVAC (Crowe 2020, excerpt) | $15,000 + $0.20 per ft² | 10 (judgment from IL-TRM 4.4.41) | Placeholder |
| HVAC equipment | heating 8 / 13 / 16% (condensing boiler math); cooling 10 / 15 / 26% (high from IL-TRM 4.4.6) | RTU $958/ton, PTAC/PTHP $1,047/ton (IL-TRM); central plant: boiler $22.95/kBtu/h (IL-TRM) + chiller $1.31/ft² (placeholder); VRF $2.00/ft² (placeholder) | central plant 23, RTU 15, PTAC/PTHP 8, VRF 16 (IL-TRM) | Sourced for RTU and PTAC/PTHP; partly for central plant |
| Water heating and low-flow | 15 / 22 / 30% (placeholder, cross-checked) | $200 per room (built from IL-TRM 4.3.1–4.3.3) | 15 (IL-TRM 4.3.1) | Sourced (derived) |
| Roof insulation | 6 / 10 / 14% of weather load (ComStock, excerpt), scaled by floors | $1.91 per ft² of roof (IL-TRM 4.8.1, 2024 $) | 20 (IL-TRM 4.8.1) | Sourced (derived) |
| Rooftop solar | PVWatts output, self-use hour by hour; O&M $17.63/kW-yr; 0.5%/yr degradation | LBNL 2024 national medians by size ($3.30 / $3.10 / $2.90 per W for the demo's three sizes) | 25 | Sourced (team-provided) |

### Incentives

| Program | Rate | Applied | Source | Status |
| --- | --- | --- | --- | --- |
| ComEd LED fixtures and retrofits | $0.75 per watt reduced | Yes | ComEd Indoor Lighting worksheet 2025 | Team-provided (2025 rate) |
| ComEd occupancy sensors | $0.25 per watt controlled | Yes | same | Team-provided (2025 rate) |
| ComEd guest room energy management | $75 per ton (gas heat) / $100 (electric or heat-pump heat) | Yes | ComEd HVAC & VSD worksheet 2026 | Team-provided |
| ComEd HVAC equipment | by rated efficiency (IPLV, IEER, SEER2) | No (listed) | same | Not modelable yet |
| ComEd energy management systems | separate EMS worksheet | No (listed) | — | Worksheet not provided |
| Peoples Gas, Illinois Shines, federal 48E | — | No (listed) | — | Unverified |
| Program cap | 90% of cost; pre-approval at $10,000 or more | Yes | ComEd 2026 Standard Incentives Application | Team-provided |
| Solar export credit | $0 per kWh (editable) | — | 220 ILCS 5/16-107.5 (to confirm) | Conservative fallback; no effect today (0 kWh exported) |

## Sources

| Source | Used for | How it was read |
| --- | --- | --- |
| EIA Electric Power Monthly; Natural Gas Prices; AEO2026; CBECS 2018 | prices, growth, end uses, benchmarks | Primary, downloaded (xlsx) |
| EPA eGRID2023; GHG Emission Factors Hub 2025 | emissions | Primary, downloaded (xlsx) |
| NOAA NCEI 1991–2020 normals (O'Hare) | weather | Primary, downloaded (CSV) |
| NLR (formerly NREL) PVWatts v8.5; ATB 2025; Jordan et al. 2022 | solar output, O&M, degradation | Primary (API, page, PDF) |
| NLR ComStock 2025 Release 3 (AMY 2018), OEDI data lake, CC-BY-4.0 | end-use split, EUI, age factor, hourly shapes (Chicago) | Primary (downloaded CSV) |
| Illinois Statewide TRM v14.0, Vol. 2 (effective Jan 1, 2026) | savings, costs, lives, interaction factors | Primary (PDF downloaded in pass 3; `icc.illinois.gov` no longer reachable, the saved copy was used in pass 6) |
| ENERGY STAR "U.S. EUI by Property Type" (Aug 2024) | benchmark | Primary |
| Choose Chicago hotel supply; STR via Choose Chicago 2025 | hotel sizes, occupancy | Primary (page, PDF) |
| IRS Notice 2025-42; IRS 48E page | federal solar credit | Primary |
| LBNL Distributed Solar & Storage, 2025 Data Update, p. 8 | solar price per W | Team-provided (transcribed; `emp.lbl.gov` not reachable) |
| ComEd 2026 Standard Incentives Application V15; Indoor Lighting worksheet 2025; HVAC & VSD worksheets 2025 and 2026 | incentives | Team-provided (uploaded PDFs) |
| 220 ILCS 5/16-107.5; Illinois Shines program documents | export credit, RECs | Not read (`www.ilga.gov` refused; `illinoisshines.com` reachable but RECs are an incentive, not applied) |
| Itron WO017 measure cost study (via IL-TRM 4.8.1); CPI-U 2012→2024 (×1.37) | insulation cost in 2024 dollars | Via TRM; CPI ratio from memory, not fetched |

## Open questions (current)

- **Installed costs still placeholders**: LED retrofit, energy management and the chiller part of a central plant (docs/08 A2): no full retrofit
  cost is published in the reachable sources.
- **2026 lighting incentive rates**: the applied LED and sensor rates are from the 2025 worksheet.
- **Export credit tariff** for a non-residential ComEd hotel (pass 5 checklist); needs `www.ilga.gov` or a ComEd tariff document.
- **Energy intensity**: the demo hotel now models 86.5 kBtu/ft² (ComStock zone-5A hotel stock), 37% above the ENERGY STAR national median;
  ComStock's fan-coil hotels with chiller and boiler (like the demo) average about 121 in Illinois, so the demo may be conservative.
- **Showers' share of hotel hot water** (docs/08 B3); **ASHRAE 55** comfort references (B7); **case-study validation** of package
  savings (needs `betterbuildingssolutioncenter.energy.gov`).

# History: research passes

## Pass 1 (November 2026)

| Item | Before | Now | Source | Read |
| --- | --- | --- | --- | --- |
| Electricity and gas price growth | 2% a year, one rate | **2.12%** electricity, **4.09%** gas a year (nominal, 2025–2035), applied separately | EIA Annual Energy Outlook 2026 (April 2026), Counterfactual Baseline, Tables 8 and 3, commercial | Primary (xlsx) |
| Hotel end-use split | heating 22, cooling 9, ventilation 7, lighting 11, hot water 19, kitchen 7, equipment 15, other 10% | 18.1 / 6.9 / 14.5 / 8.4 / 18.6 / 17.2 / 1.8 / 14.5% | EIA CBECS 2018 Table E1, Lodging (598 trillion Btu) | Primary (xlsx) |
| Fuel mix (electric share) | hot water 20%, kitchen 45%, other 100% | 15% / 40% / 82% | EIA CBECS 2018 Table E5, Lodging | Primary (xlsx) |
| Smart room controls cost and life | $1,500 + $250 per room, 12 years | $100 / **$260** / $500 per room, **15 years** | IL-TRM 4.4.8 ($260, 15 y); California 2013 CASE (range) | Excerpt, then primary in pass 2 (incentive added in pass 7) |
| LED lighting reduction and life | 35 / 45 / 55%, 15 years | 27 / 45 / 60%, 12 years | PNNL evaluation for GSA (27%); IL-TRM 4.5.4 life rule | Excerpt / judgment |
| Condensing boiler heating saving | 12% mid | 13% mid | 1 − 0.80/0.92 (GSA existing-boiler efficiency, condensing seasonal efficiency); NREL ComStock | Excerpt |
| Energy management and insulation | 4/7/10%; 6/10/14% | kept, now supported (lives updated in pass 6) | Crowe, Mills et al. 2020 (3% lodging RCx ≈ 7.6% of HVAC); NREL ComStock roof insulation (≈11% of gas heating) | Excerpt |

## Pass 2 (November 2026)

| Item | Before | Now | Source | Read |
| --- | --- | --- | --- | --- |
| Solar output, Chicago | 1,100 / 1,200 / 1,300 kWh per kW, illustrative monthly split | **1,194 / 1,240 / 1,307** kWh per kW (5° / 10° / 20° tilt) and the monthly split | NLR (formerly NREL) PVWatts v8 API, model 8.5.0, NSRDB PSM V3 TMY-2020, 41.88 N 87.63 W, open rack, azimuth 180, 14.08% losses | Primary (API) |
| Grid emission factor | 0.40 (illustrative), then 0.231 (EIA in-state generation) | **0.4155** kg CO2e/kWh (RFC West, serves ComEd); U.S. 0.3497 | EPA eGRID2023 Summary Tables, Table 1 (created March 27, 2025) | Primary (xlsx) |
| Gas emission factor | 5.31 kg per therm, unconfirmed | **5.311** kg CO2e per therm | EPA GHG Emission Factors Hub 2025, Table 1 (53.06 kg CO2, 1 g CH4, 0.1 g N2O per MMBtu; AR5 GWPs) | Primary (xlsx) |
| Lighting–HVAC interaction | 0.10 cooling saved, 0.20 heating added (per kBtu of lighting saved) | guest rooms **0.17** / common **0.09** cooling saved; heating added **0.586 / 0.498** (gas), 0.468 / 0.406 (resistance), 0.204 / 0.176 (heat pump), applied by space and heating type | IL-TRM v14.0 (effective Jan 1, 2026) Vol. 2, section 4.5 reference table, Hotel/Motel guest and common (WHFe, IFTherms, IFkWh) | Primary (PDF) |
| Occupancy sensors | 12 / 20 / 28% lighting, 12-year life | 12 / **24** / **37**%, **10-year** life | IL-TRM v14.0 4.5.10 (energy savings factor; with high-end trim; measure life) | Primary (PDF) |
| Smart room controls savings | setback only: 4,903 kWh, 209 therms ($883) for 100 rooms | **≈10,800 kWh, 209 therms ($1,715; $1,361–2,068)**: guest-room fan energy cut 17% while rooms are empty (calibrated) | IL-TRM v14.0 4.4.8: Chicago hotel, central hot-water fan coils, gas heat, 92–147 kWh and 3.0–6.5 therms per ton; at 0.75–1.0 ton per room ≈ 6,900–14,700 kWh, 225–650 therms | Primary (PDF); tons per room is an assumption |
| Solar O&M | not included, then $17.63 (excerpt) | **$17.63** per kW-yr ($14.17 system + $3.46 administration), subtracted from savings | NLR Annual Technology Baseline 2025, Commercial PV | Primary (page) |
| Solar degradation | 0.5% (Jordan and Kurtz 2013, from memory) | **0.5%** a year, kept | Jordan et al. 2022, Progress in Photovoltaics (NREL/TP 81314): fleet median 0.75%, cooler climates 0.48% a year | Primary (PDF) |
| Federal solar credit (Section 48E) | "deadlines changed" | not applied; facts recorded: ends for solar placed in service after Dec 31, 2027 unless construction began by July 4, 2026; 6% base, up to 30% with wage and apprenticeship rules, +10 points each for domestic content and energy communities | IRS Notice 2025-42 (Aug 2025); IRS Clean Electricity Investment Credit page (reviewed Jan 5, 2026) | Primary |
| Solar export credit | not researched | basis: avoided cost of supply for systems interconnected from 2025; **no $ value**, so $0 *(still $0; now editable, pass 5)* | 220 ILCS 5/16-107.5(n) | Excerpt |
| Chicago temperatures | written from memory | **25.2, 28.8, 39.0, 49.7, 60.6, 70.6, 75.4, 73.8, 66.3, 54.0, 41.3, 30.5 °F** | NOAA NCEI U.S. Climate Normals 1991–2020, Chicago O'Hare (USW00094846); 5,974 HDD, 1,003 CDD | Primary (CSV) |
| Benchmarks | none | demo hotel **91.1** kBtu/ft² site; CBECS 2018 lodging mean **85.7** (Table C1); ENERGY STAR hotel median **63.0** site / 146.7 source | EIA CBECS 2018 Table C1; ENERGY STAR "U.S. Energy Use Intensity by Property Type" (August 2024) | Primary |
| Hotel size, Chicago | not checked | Choose Chicago list: **147 hotels, 49,526 rooms**, median **232**, mean 337, middle half 173–378; 18% under 150 rooms | Choose Chicago, Chicago hotel supply | Primary (page) |

## Pass 3 (November 2026, with the product decisions)

| Item | Before | Now | Source | Read |
| --- | --- | --- | --- | --- |
| Grid factors by location | one value per state | all **27 eGRID2023 subregions** (CO2e), chosen from the city, then the state, then the U.S. | EPA eGRID2023 Summary Tables, Table 1 | Primary (xlsx) |
| ComEd business incentives | program listed | rules recorded (pre-approval at $10,000 or more, otherwise a possible $10,000 cap; up to $2 million per customer); **amounts not available** (in worksheets on another host) *(superseded in pass 7: amounts applied from the worksheets)* | ComEd 2026 Standard Incentives Application (www.comed.com) | Primary (PDF) |
| Heat-pump water heaters, heat-pump HVAC | not modeled | **still not modeled** (listed as "Not modeled yet" in the catalog): no commercial hotel-scale cost and performance found (IL-TRM's water-heater measure covers tanks up to 120 gallons) | IL-TRM v14.0 Vol. 2 | Primary (PDF) |
| Hot water per room | 20 gal per occupied room (unsourced) | kept; consistent with **14 gal per hotel room per day** | IL-TRM v14.0 4.3.2 table (from the 2007 ASHRAE Handbook, HVAC Applications, ch. 49) | Primary (PDF) |
| Condensing boiler cost and life | none | **$22.95 per kBtu/h** full installed (>90% EC), 25 years (recorded; chiller part still unsourced; *central-plant life now 23 years, pass 6*) | IL-TRM v14.0 4.4.10 | Primary (PDF) |
| Chicago hotel occupancy | defaults only | **69.2%** CBD average in 2025 (68.1% in 2024), ADR $243.10; used for the 300-room preset | STR via Choose Chicago, 2025 Hotel Performance (January 2026) | Primary (PDF) |
| Monthly occupancy shape | synthetic | **still synthetic** (only annual figures are published) | Choose Chicago | Primary (PDF) |
| Comfort limits | unlabeled defaults | documented as a **product decision**; ASHRAE 55 not consulted (paid standard) | — | — |

Product decisions taken at the same time (discount rate, optimizer rules, HVAC types, solar sizes, emissions, incentives) are in
[15_PRODUCT_DECISIONS.md](15_PRODUCT_DECISIONS.md); they are choices, not sourced facts.

## Modeling decisions made with this research

- **Smart room controls:** the fan saving (17% of guest-room fan energy while empty) is a calibration to the IL-TRM range, not a measured value;
  6–28% would land inside the range. It lives in the shared simulation, so the Scenario switch and the upgrade card agree.
- **Insulation:** the 10% weather-load reduction applies up to 5 floors and is scaled by 5 / floors above that (roof share of the envelope).
- **Presets:** the 100-room demo hotel is now described as a boutique hotel (small for Chicago); a 300-room downtown full-service preset was added,
  sized from the Choose Chicago list. Both are synthetic.
- **Emissions** assume a ComEd (northern Illinois) building.

## Open questions at pass 3 (historical; current list at the top)

- The demo hotel's 91.1 kBtu/ft² is 45% above the ENERGY STAR national hotel median (63.0) and 6% above the CBECS lodging mean (85.7, which
  includes nursing homes). A cold climate and a restaurant explain part of it; the default EUI input (92) is still a placeholder (docs/08, B5/B6).
- Installed costs for most upgrades and solar $/W are still placeholders (docs/08, A2, A3). *(Solar $/W done in pass 5; insulation and water heating costs in pass 6.)*

## Pass 4 (November 2026, with the 3D twin)

| Item | Before | Now | Source | Read |
| --- | --- | --- | --- | --- |
| Chicago normal highs and lows | monthly means only | **highs** 31.6 … 84.5 °F (Jul), **lows** 18.8 (Jan) … 66.4 °F; used for the modeled hourly temperature in the 3D readout | NOAA NCEI U.S. Climate Normals 1991–2020, Chicago O'Hare (USW00094846), monthly TMAX/TMIN normals | Primary (CSV) |
| Peer benchmarks in the data | in this log only | `defaults.peerBenchmarks`: ENERGY STAR hotel median **63.0**, CBECS 2018 lodging mean **85.7** kBtu/ft² site; used by `benchmarkComparison` for context only | As in pass 2 | Primary |

## Pass 5 (November 2026, solar prices and net metering)

| Item | Before | Now | Source | Read |
| --- | --- | --- | --- | --- |
| Solar installed price by size | one placeholder tier $2.20 / $2.80 / $3.50 per W | **2024 national medians, non-residential, before incentives:** ≤10 kW $3.70; 10–20 $3.30; 20–50 $3.10; 50–100 $2.90; 100–250 $2.50; 250–500 $2.50; 500–1,000 $2.00; >1,000 $1.70 per W (DC). Demo hotel: quarter roof 13.8 kW → $3.30, half 27.5 kW → $3.10, full 55 kW → $2.90. Low/high ±15% is a placeholder | LBNL, *Distributed Solar & Storage, 2025 Data Update* (Oct 2025), p. 8 | **Transcribed by the team** from the PDF; `emp.lbl.gov` not reachable from the build session, so not re-read by Claude Code |
| Solar export credit | $0 (not researched) | **$0, labeled conservative fallback, editable** | 220 ILCS 5/16-107.5; Illinois Shines program documents (team-provided links) | Not reachable from the build session (`www.ilga.gov`, `illinoisshines.com`) |

**Net metering for the synthetic hotel: what to confirm before applying a credit.** Do not assume residential or small-commercial rules apply.
1. Eligibility under 220 ILCS 5/16-107.5: the statute's system-size limit for an "eligible customer", and whether a non-residential hotel
   with a ~14–55 kW array qualifies (the arrays are small relative to the hotel's ~780 MWh a year).
2. The credit basis for systems interconnected from 2025 (supply-only crediting rather than full retail), and how it applies to the hotel's
   ComEd delivery class.
3. Whether the hotel buys supply from ComEd or a retail electric supplier, and whether it is on hourly pricing; the credit value depends on it.
4. Illinois Shines REC payments are an **incentive**, not an export credit; they belong in `incentives.json` once amounts are verified.
**Effect today: none.** Both presets use all their solar on site (0 kWh exported), so the export credit does not change any result; it would
matter only for larger arrays or lower daytime loads.

**Effect of the new prices** (100-room hotel): full-roof solar $159,500 (was $154,000), payback 18.5 years (was 17.9); quarter roof $45,540,
21.1 years; half roof $85,250, 19.8 years. Optimizer picks are unchanged at $50,000 (LED + occupancy sensors); at $150,000 the
maximum-savings package adds a quarter-roof array; at $250,000 the full roof. 300-room hotel: unchanged at $150,000 (LED + energy management).

## Pass 6 (November 2026, IL-TRM v14.0 Vol. 2 measure lives and costs)

Read from the saved copy of the IL-TRM v14.0 Vol. 2 PDF (downloaded in pass 3; `icc.illinois.gov` is no longer reachable from the build session).

| Item | Before | Now | Source |
| --- | --- | --- | --- |
| Roof insulation cost | $3.50/ft² placeholder | low $1.40, mid **$1.91**, high $3.50 per ft² of roof | TRM 4.8.1: $1.40/ft² R-30 ($0.59 material + $0.81 labor; Itron WO017, 2010–12). Mid = ×1.37 CPI-U 2012→2024 (ratio from memory, not fetched) |
| Roof insulation life | 30 years placeholder | **20 years** | TRM 4.8.1 (DEER 2008) |
| Water heating cost | $220/room placeholder | mid **$200/room** | TRM 4.3.1 ($6,021 installed, >75 kBtu/h gas storage at 0.90 Et), 4.3.3 ($12 showerhead), 4.3.2 ($8 aerator); three heaters for the demo hotel is an assumption |
| Water heating life | 15 placeholder | **15 years** (fixtures 10) | TRM 4.3.1, 4.3.2, 4.3.3 |
| HVAC equipment life | 20 years for all | **central plant 23, RTU 15, PTAC/PTHP 8, VRF 16** | TRM 4.4.6 (chiller 23; boiler 25, 4.4.10), 4.4.15, 4.4.13, 4.4.9 |
| HVAC cooling reduction, high | 22% | **26%** | TRM 4.4.6 example: 0.405 vs 0.550 kW/ton IPLV |
| Energy management life | 12 placeholder | **10 years (judgment)** | No EMS measure in the TRM; nearest: Advanced Rooftop Controls 10 (4.4.41), AMI commissioning ~7 (4.9.25) |
| Hotel hot water use | 20 gal/occupied room-day (checked) | unchanged; faucets 25% of it | TRM 4.3.2 table: hotel 14 gal/room-day, 25% faucets |

**Effect:** insulation now costs $21,010 for the demo hotel and pays back in 11.5 years (was $38,500, 21.0); water heating $20,000, 7.0 years
(was $22,000, 7.7). The $50,000 recommendation is unchanged (LED + occupancy sensors). At $150,000 the maximum-savings package now adds
insulation and smart controls instead of a quarter-roof solar array.

**Still blocked** *(at pass 6; the ComEd worksheets were provided in pass 7)*: ComEd incentive worksheets (A2/A4: the worksheets page is a JavaScript app with no file links), 220 ILCS 5/16-107.5
(`www.ilga.gov` refused by the session's network policy) and DOE Better Buildings case studies (`betterbuildingssolutioncenter.energy.gov`
refused). `illinoisshines.com` is reachable; its REC payments are incentives, not export credit, and are not applied.

## Pass 7 (November 2026, ComEd incentive worksheets provided by the team)

Documents (uploaded by the team): ComEd 2026 Standard Incentives Application V15; ComEd Indoor Lighting Incentives Worksheet 2025 (updated
Nov 5, 2025); ComEd HVAC and VSD Incentives Worksheet 2025 (updated Nov 4, 2024) and 2026 (updated May 4, 2026).

| Incentive | Rate | Basis in the model | Applied |
| --- | --- | --- | --- |
| LED fixtures and retrofits | **$0.75 per watt reduced** (2025 worksheet) | connected lighting (150 W/room + 1.0 W/ft² public and corridors, placeholders) × LED reduction × share installed | Yes |
| Occupancy sensors | **$0.25 per watt controlled** (2025 worksheet) | public-area and corridor lighting × share covered | Yes |
| Guest room energy management, gas heat + electric AC | **$75 per cooling ton** (2026) | rooms × 0.75 ton (assumption) × share of rooms | Yes (central plant, RTU hotels) |
| Guest room energy management, electric or heat-pump heat | **$100 per cooling ton** (2026) | same | Yes (PTAC, PTHP, VRF hotels) |
| Chillers, rooftop units, PTAC/PTHP | $10 (water-cooled) / $7 (air-cooled) per ton per 0.01 kW/ton IPLV below qualifying; RTU $20/ton per IEER/SEER2 point; PTAC/PTHP $30/ton | needs rated efficiency, not modeled | No (listed) |
| Energy management systems | in the separate EMS worksheet (not provided) | — | No (listed) |

Program rules: pre-approval for requests of $10,000 or more (otherwise ComEd may cap at $10,000); total incentive at most 90% of the incremental
measure cost or project cost, whichever is less (modeled as 90% of the upgrade's cost); up to $2 million per customer; funds limited.

**Effect (100-room hotel):** LED $10,631 (net $22,369, payback 2.9 years, was 4.2); occupancy sensors $4,125 (net $2,475, 1.1 years, was 3.0); smart
room controls $5,625 (net $20,375, 11.9 years, was 15.2). The recommendations do not change: at $50,000 LED + sensors ($24,844 net; 2.4 years under
the demo's 85%-occupancy scenario, 2.7 on the baseline). 300-room hotel at $150,000: LED + energy management, $115,106 net, 3.4 years.

## Pass 8 (November 2026, NLR ComStock for Chicago hotels)

Source: NLR (formerly NREL) ComStock 2025 Release 3 (AMY 2018), OEDI data lake (`oedi-data-lake.s3.amazonaws.com`), CC-BY-4.0. Files read:
`timeseries_aggregates/by_ashrae_iecc_climate_zone_2006/upgrade=0/.../5A/up0-5a-largehotel.csv` and `up0-5a-smallhotel.csv` (baseline, 15-minute,
577 and 91 million ft² represented) and `metadata_and_annual_results_aggregates/by_state/full/csv/state=IL/IL_upgrade0_agg.csv.gz`
(264 hotel samples with weights).

| Item | Before | Now | Read |
| --- | --- | --- | --- |
| Site EUI, Chicago | 92 (placeholder) | **92.3** kBtu/ft² (zone-5A hotels; large 93.5, small 84.7; Illinois hotels 93.6) | Primary |
| Age factor | 1.10 / 1.00 / 0.92 (placeholder) | **1.035 / 0.947 / 1.025** (before 1980 / 1980–1999 / 2000+; Illinois hotels by vintage: 96.9 / 88.6 / 95.9 kBtu/ft²) | Primary; confounded with HVAC type |
| End-use split, Chicago | CBECS national (heating 18.1, cooling 6.9, ventilation 14.5, lighting 8.4, hot water 18.6, kitchen 17.2, equipment 1.8, other 14.5%) | **21.9 / 10.6 / 6.4 / 8.9 / 19.1 / 15.0 / 2.0 / 16.1%** | Primary; kitchen = gas interior equipment, equipment+other = electric interior equipment + refrigeration split in the CBECS ratio |
| Hourly load shapes | synthetic placeholders | **ComStock average day per end use** (e.g. cooling peaks 13:00 at 1.5× average; hot water peaks 20:00; lighting 23:00) | Primary; time zone per ComStock docs (not re-checked) |
| Guest presence by hour | synthetic | unchanged (not in ComStock) | — |
| CBECS age check | — | CBECS 2018 Table C1, all buildings: no consistent EUI trend by year constructed (62–80 kBtu/ft²) | Primary |

Cross-checks (not applied): Illinois hotel EUI by HVAC system: PTAC with electric coil 77, PTHP 79, PTAC with gas boiler 90, fan coils with chiller
and boiler 121 kBtu/ft²; 63% of hotel floor area is gas-heated.

**Effect:** the 100-room demo baseline is now $120,178 a year (was $131,666), 86.5 kBtu/ft² (was 91.1); central HVAC $34,152, guest rooms $21,587.
Occupancy 60% → 85% adds $12,869; smart controls then save $1,014. January 9 pm heating 80 kW (was 64), July 3 pm cooling 102 kW (was 85).
The $50,000 recommendation is unchanged (LED + sensors: $24,844 net, $10,302 a year, 2.4 years under the 85% scenario). Insulation pays back faster
(8.5 years; heating and cooling are a larger share), energy management slower (10.2; less ventilation). 300-room hotel at $150,000: maximum savings
unchanged (LED + energy management, $32,521 a year, 3.5 years); balanced now adds insulation.

Also fixed: the advisor context now carries the what-if's own numbers (for example the 20% in "Electricity price changed 20%"), so a template answer
that repeats them passes the number check.

## Pass 9 (November 2026, IL-TRM measure costs for sensors and HVAC equipment)

From the saved IL-TRM v14.0 Vol. 2 PDF.

| Item | Before | Now | Source |
| --- | --- | --- | --- |
| Occupancy sensor cost | $0.25 / $0.40 / $0.65 per ft² (placeholder) | **$0.22 / $0.36 / $0.50** per ft² of common area | TRM 4.5.10: $55 wall-switch, $67 fixture-mounted, $125 remote or wall-mounted per sensor; **250 ft² per sensor is an assumption** |
| HVAC equipment cost | $2.00 per ft² for every system (placeholder) | rooftop units **$895 / $958 / $1,021 per ton** (base / CEE Tier 1 / Tier 2); PTAC and PTHP **$1,047 per ton** (−15% / +25% placeholder spread); central plant **boiler $22.95/kBtu/h** (low $12.94) + chiller **$1.31/ft² placeholder**; VRF $2.00/ft² placeholder | TRM 4.4.15 (full install cost, <135 kBtu/h), 4.4.13 (early replacement, full cost), 4.4.10; TRM 4.4.6 gives only incremental chiller costs ($23–830/ton) |
| LED retrofit cost | placeholder | unchanged; **lower bound recorded**: TRM 4.5.4 time-of-sale incremental costs about $0.70–1.50 per watt removed (2012 DOE prices, no labor) vs the model's ~$2.33 per watt | TRM 4.5.4 |
| Energy management cost | placeholder | unchanged; the TRM has no EMS measure | — |

Bug fixed: the PTAC/PTHP hotels' common-area rooftop units showed a capacity 1,000 times too large in the Equipment view (display only).

**Effect:** LED + occupancy sensors at $50,000 costs $38,940 (was $39,600), $24,184 net, payback 2.3 years under the 85% scenario (2.7 on the baseline);
sensors alone pay back in under a year. Central-plant HVAC is unchanged in total ($109,918) but now split into a sourced and a placeholder part.
No recommendation changes.

## Pass 10 (November 2026, installed costs, net metering, hot water, validation)

Found with web search on reachable hosts (EIA, NREL's publications host, EPA, ENERGY STAR, Illinois Shines); `www.ilga.gov`, `www.icc.illinois.gov`,
ComEd, PNNL, `energy.gov` and DOE Better Buildings stayed blocked. Values below were checked in the downloaded documents unless marked "search
excerpt" (weaker: from a search result, not the document).

| Item | Before | Now | Source |
| --- | --- | --- | --- |
| Energy management cost | $15,000 + $0.20 per ft² (placeholder; below even a front-end upgrade) | **$0.79 / $2.53 / $7.60 per ft²** (front end only / upgrade existing system / complete system averages) | NREL, *Commercial Building Sensors and Controls Systems: Barriers, Drivers, and Costs*, NREL/TP-5500-82117 (August 2022), Table 5 "Total Project Cost per Square Foot Data Summary" (front end $0.69–0.95, upgrade existing $0.49–7.86, complete $5.20–14.23) |
| Chiller part of a central plant | $1.31 per ft² (placeholder) | **$820 / $1,030 / $1,350 per ton** total installed (2022$), a lower bound for a replacement | EIA, *Updated Buildings Sector Appliance and Equipment Costs and Efficiencies* (Guidehouse and Leidos, March 2023), commercial air-cooled screw chillers, typical: $820/ton at 300 tons, $1,250 at 100 tons, $86 per kBtu/h; high efficiency 100 tons $1,350. Excludes demolition, rigging and chilled-water work |
| LED retrofit cost | $0.40 / $0.60 / $0.90 per ft² (placeholder) | unchanged, now **between sourced bounds**: relamping $22.22 per 2-lamp fixture (63.1 → 27.4 W) ≈ $0.35 per W of existing lighting; new luminaire $338.08 per fixture (→ 44.0 W) ≈ $5.36 per W. The mid ≈ $1.05 per W ≈ 14% of fixtures replaced (an assumption) | EIA 2023 (as above), Appendix C, commercial 4-ft linear 2-lamp systems, 2022 typical |
| ComEd 2026 LED incentive | $0.75 per W reduced (2025 worksheet) | unchanged; a May 2026 secondary page states the same $0.75 per W reduced and $0.25 per W controlled; the 2026 worksheet's host is blocked | secondary page (search excerpt); primary still to confirm |
| Solar export credit | $0 (fallback) | **method sourced, value not**: systems interconnected after December 31, 2024 are credited "at your electricity supply rate" (Illinois Shines); customers above 100 kW receive supply and transmission only net metering credits (ComEd Rider POGNM, ICC docket 22-0036, search excerpt). No non-residential supply price was found, so the $0 fallback stays (editable). No effect on either preset, which export nothing | illinoisshines.com (fetched); ICC 22-0036 (search excerpt) |
| Hot water by use | showers' share unknown | **guest rooms ≈ 79% of service water heating** in a 228-room full-service hotel (guest hot water 2,978 MMBtu a year against laundry and kitchen 788; pool and spa excluded). A showers-only share is still not published | EPA CHP Partnership hotel report (December 2005), Table 18 |
| Energy by zone and plant share | assumptions | still assumptions: no published hotel breakdown by zone. Context only: lighting is "almost a quarter of all electricity"; heating and cooling "almost 40 percent of the electricity and more than half of the natural gas" | ENERGY STAR Building Upgrade Manual / hotel guidance |

**Effect:** the 100-room demo and the portfolio at $500,000 are unchanged. Energy management alone now costs about $139,000 for the 100-room hotel
(payback about 54 years) and drops out of the packages. 300-room preset at $150,000: maximum savings is now insulation + LED + occupancy sensors
($132,578 gross, $88,309 net, $30,323 a year, 2.9 years) instead of LED + energy management ($147,000, $32,521 a year, 3.5 years). Central-plant
HVAC replacement for the 100-room hotel is about $179,000 (was $110,000).

### Validation against published hotel results

| Case (year) | Measures | Reported | Model (100-room demo hotel) | Read |
| --- | --- | --- | --- | --- |
| Willard InterContinental, Washington DC (ENERGY STAR, fetched) | CFL lighting | 11% of whole-building energy, more than $100,000 a year | LED + occupancy sensors 7.5% of the bill; 52% of lighting cost | Consistent (an incandescent baseline saves more than the model's mixed fluorescent stock) |
| Loews Vanderbilt, Nashville (search excerpt) | LED in public areas + central guest-room fan-coil control | 22%, $328,250 | All upgrades together, no budget limit: 25% of the bill | Consistent for multi-measure programs |
| Hilton Columbus Downtown (search excerpt) | guest-room LED downlights and more | 32% (against an ASHRAE 90.1-2007 code baseline, not pre-retrofit) | 25% (all upgrades) | Not directly comparable (code baseline) |
| Hilton Austin (search excerpt) | multi-measure | 31%, $400,000 | 25% (all upgrades) | Same order |
| DOE/PNNL guest-room occupancy-based controls (2012, search excerpt) | guest-room energy management | 10–30% potential; 18.4% average HVAC savings in one summary | Smart room controls 3.9% of the whole hotel's HVAC cost; about 6% of guest-room HVAC cost (the comparable basis) | **Inside the Illinois range; field studies run higher.** On the local yardstick, IL-TRM v14.0 4.4.8 (Chicago hotel, central fan coils, gas heat: 92–147 kWh and 3.0–6.5 therms per ton), the model's mid case is 136 kWh and 3.7 therms per ton. The field studies run higher because they measure in-room units only (not the whole hotel's HVAC), are mostly mild or cooling-dominated climates with in-room units, start from guests leaving units at extreme settings (the model's guests keep 68 / 74 °F), often use deeper setbacks than the 5 °F minimum, and several are vendor or utility case studies. Reviewed November 2026; not tuned |
| PG&E, Westin St. Francis (2010, search excerpt) | guest-room energy management | 25.4% of HVAC energy | about 6% of guest-room HVAC cost (3.9% of all HVAC) | Same as above (San Francisco: mild climate) |

No Chicago hotel case was found. Whole-building and lighting results agree with the model's range. Guest-room controls sit inside the Illinois
TRM's deemed savings for a Chicago hotel and below field studies from other climates and baselines (reasons above), so the recommendations
are conservative for that measure.

## Pass 11 (November 2026, multi-city data: New York, Miami, Denver)

For multi-city portfolios (task 13.35). Every value fetched from the primary source and read in the downloaded file; nothing from search excerpts.
Chicago values are unchanged (re-running the same queries reproduced them: O'Hare normals and degree days exactly, ComStock zone 5A 92.3 kBtu/ft²
and the same split; PVWatts today gives 1,246.6 kWh/kW at 10° for the Loop, 0.5% above the stored 1,240.2, kept).

| Item | New York, NY | Miami, FL | Denver, CO | Source |
| --- | --- | --- | --- | --- |
| Weather station | Central Park (USW00094728), NOAA's station for the city; JFK airport (USW00094789) has 4,872 HDD / 1,017 CDD | Miami International Airport (USW00012839) | Denver International Airport (USW00003017) | NOAA NCEI U.S. Climate Normals 1991-2020, `normals-monthly` and `normals-annualseasonal` CSV files, www.ncei.noaa.gov |
| Monthly mean °F (Jan–Dec) | 33.7, 35.9, 42.8, 53.7, 63.2, 72, 77.5, 76.1, 69.2, 57.9, 48, 39.1 | 68.6, 70.7, 73.1, 76.7, 80.1, 82.8, 84.1, 84.2, 83, 80.1, 74.8, 71.2 | 31.7, 32.7, 41.6, 47.8, 57.4, 68.2, 75.1, 72.9, 64.8, 51.1, 39.4, 31.2 | MLY-TAVG-NORMAL |
| Monthly normal high °F | 39.5, 42.2, 49.9, 61.8, 71.4, 79.7, 84.9, 83.3, 76.2, 64.5, 54, 44.3 | 76.2, 78.2, 80.6, 83.6, 86.7, 89.3, 90.6, 90.7, 89, 85.9, 81.3, 78.2 | 44.6, 45.7, 55.7, 61.7, 71.2, 83.4, 89.9, 87.5, 79.6, 65.3, 52.9, 44 | MLY-TMAX-NORMAL |
| Monthly normal low °F | 27.9, 29.5, 35.8, 45.5, 55, 64.4, 70.1, 68.9, 62.3, 51.4, 42, 33.8 | 61, 63.2, 65.6, 69.8, 73.4, 76.3, 77.5, 77.7, 76.9, 74.2, 68.3, 64.3 | 18.7, 19.7, 27.5, 33.9, 43.6, 53, 60.2, 58.3, 50, 37, 26, 18.4 | MLY-TMIN-NORMAL |
| Annual degree days (base 65 °F) | 4,553 heating, 1,222 cooling | 104 heating, 4,656 cooling | 5,862 heating, 850 cooling | ANN-HTDD-NORMAL, ANN-CLDD-NORMAL (Chicago O'Hare 5,974 / 1,003 for comparison) |
| Solar, kWh per kW a year (5° / 10° / 20° tilt) | 1,186.9 / 1,232.4 / 1,294.0 | 1,487.2 / 1,520.6 / 1,552.8 | 1,449.8 / 1,511.2 / 1,598.3 | NLR PVWatts v8 API (model 8.5.0), NSRDB PSM V3 GOES TMY-2020, downtown coordinates (40.75 N 73.99 W; 25.77 N 80.19 W; 39.74 N 104.99 W), 1 kW DC, standard module, open rack, azimuth 180, 14.08% losses, same as Chicago; monthly split from the 10° run |
| Commercial electricity | 22.93 ¢/kWh | 11.78 ¢/kWh | 13.37 ¢/kWh | EIA Electric Power Monthly Table 5.6.B, commercial, August 2026 year to date (Illinois 14.05, the stored value, as a check) |
| Commercial natural gas | 11.47 $/Mcf → $1.106/therm | 12.19 $/Mcf → $1.176/therm | 9.09 $/Mcf → $0.877/therm | EIA Natural Gas Prices, average commercial price by state, 2025 annual (Illinois 9.63, the stored value); ÷ 10.37 therms/Mcf, the same U.S. heat content used for Illinois (EIA gives no per-state factor on that page) |
| eGRID subregion | NYCW (ZIP 10019, 10036) | FRCC (33131, 33139) | RMPA (80202) | EPA Power Profiler ZIP Code Tool v14.3 with eGRID2023_rev2 data, Zip-subregion sheet (60601 Chicago Loop → RFCW as a check). No state default set: each state spans several subregions |
| Site EUI, hotel stock | 89.3 kBtu/ft² (zone 4A; large 90.7, small 79.6; 910.5 million ft²) | 84.8 (zone 1A; 85.2 / 78.2; 209.8 million ft²) | 88.4 (zone 5B; 90.8 / 78.8; 181.7 million ft²) | NLR ComStock 2025 Release 3 (AMY 2018), OEDI data lake, `timeseries_aggregates/by_ashrae_iecc_climate_zone_2006/upgrade=0/…/up0-<zone>-largehotel.csv` and `-smallhotel.csv`, area-weighted, same method as Chicago (pass 8) |
| End-use split (heating / cooling / ventilation / lighting / hot water / kitchen / equipment / other, %) | 14.3 / 14.3 / 8.1 / 9.1 / 20.7 / 15.0 / 2.1 / 16.5 | 1.6 / 29.3 / 9.4 / 8.9 / 18.8 / 13.2 / 2.1 / 16.6 | 17.6 / 12.1 / 7.0 / 9.8 / 20.3 / 14.0 / 2.1 / 17.1 | Same files and grouping as Chicago (kitchen = gas interior equipment; electric equipment + refrigeration split 1.8 : 14.5 as CBECS) |

Climate zones: New York City is IECC 4A, Miami-Dade 1A, Denver 5B (the ComStock files are labeled by the 2006 zone map). Solar pricing in the new states
uses the national LBNL medians (the default region), with $0 export credit until each state's tariff is checked.

**Not transferred (limits):** the hourly load shapes (`shapes.json`) are ComStock zone 5A (Chicago) and are used for every city; the seasonal
occupancy default is Chicago's (STR via Choose Chicago); the age factor is relative to Illinois hotels; upgrade savings parameters and the smart
room controls calibration come from the Illinois TRM (Chicago). **Incentives:** ComEd, Peoples Gas and Illinois Shines programs now carry
`"states": ["IL"]` and are not listed or applied outside Illinois (they were applied to any hotel before; no effect on the Chicago hotels). No New
York, Florida or Colorado utility incentive has been researched, so hotels there show none.
