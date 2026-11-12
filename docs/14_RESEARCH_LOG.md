# 14 — Research log

Every value that replaced a placeholder: what it was, what it is now, the exact source, and how it was read. "Primary" means the value was
read in the publisher's own document or data file (downloaded and parsed, or read on the page); "excerpt" means it was seen only in a search
summary of that document and still needs a primary check. Status by file and what is left: [08_DATA_TODO.md](08_DATA_TODO.md).
Method: [13_HOTEL_ENGINE_SPEC.md](13_HOTEL_ENGINE_SPEC.md), section 8.

## Pass 1 (November 2026)

| Item | Before | Now | Source | Read |
| --- | --- | --- | --- | --- |
| Electricity and gas price growth | 2% a year, one rate | **2.12%** electricity, **4.09%** gas a year (nominal, 2025–2035), applied separately | EIA Annual Energy Outlook 2026 (April 2026), Counterfactual Baseline, Tables 8 and 3, commercial | Primary (xlsx) |
| Hotel end-use split | heating 22, cooling 9, ventilation 7, lighting 11, hot water 19, kitchen 7, equipment 15, other 10% | 18.1 / 6.9 / 14.5 / 8.4 / 18.6 / 17.2 / 1.8 / 14.5% | EIA CBECS 2018 Table E1, Lodging (598 trillion Btu) | Primary (xlsx) |
| Fuel mix (electric share) | hot water 20%, kitchen 45%, other 100% | 15% / 40% / 82% | EIA CBECS 2018 Table E5, Lodging | Primary (xlsx) |
| Smart room controls cost and life | $1,500 + $250 per room, 12 years | $100 / **$260** / $500 per room, **15 years** | IL-TRM 4.4.8 ($260, 15 y); California 2013 CASE (range) | Excerpt, then primary in pass 2 |
| LED lighting reduction and life | 35 / 45 / 55%, 15 years | 27 / 45 / 60%, 12 years | PNNL evaluation for GSA (27%); IL-TRM 4.5.4 life rule | Excerpt / judgment |
| Condensing boiler heating saving | 12% mid | 13% mid | 1 − 0.80/0.92 (GSA existing-boiler efficiency, condensing seasonal efficiency); NREL ComStock | Excerpt |
| Energy management and insulation | 4/7/10%; 6/10/14% | kept, now supported | Crowe, Mills et al. 2020 (3% lodging RCx ≈ 7.6% of HVAC); NREL ComStock roof insulation (≈11% of gas heating) | Excerpt |

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
| Solar export credit | not researched | basis: avoided cost of supply for systems interconnected from 2025; **no $ value**, so $0 | 220 ILCS 5/16-107.5(n) | Excerpt |
| Chicago temperatures | written from memory | **25.2, 28.8, 39.0, 49.7, 60.6, 70.6, 75.4, 73.8, 66.3, 54.0, 41.3, 30.5 °F** | NOAA NCEI U.S. Climate Normals 1991–2020, Chicago O'Hare (USW00094846); 5,974 HDD, 1,003 CDD | Primary (CSV) |
| Benchmarks | none | demo hotel **91.1** kBtu/ft² site; CBECS 2018 lodging mean **85.7** (Table C1); ENERGY STAR hotel median **63.0** site / 146.7 source | EIA CBECS 2018 Table C1; ENERGY STAR "U.S. Energy Use Intensity by Property Type" (August 2024) | Primary |
| Hotel size, Chicago | not checked | Choose Chicago list: **147 hotels, 49,526 rooms**, median **232**, mean 337, middle half 173–378; 18% under 150 rooms | Choose Chicago, Chicago hotel supply | Primary (page) |

## Pass 3 (November 2026, with the product decisions)

| Item | Before | Now | Source | Read |
| --- | --- | --- | --- | --- |
| Grid factors by location | one value per state | all **27 eGRID2023 subregions** (CO2e), chosen from the city, then the state, then the U.S. | EPA eGRID2023 Summary Tables, Table 1 | Primary (xlsx) |
| ComEd business incentives | program listed | rules recorded (pre-approval at $10,000 or more, otherwise a possible $10,000 cap; up to $2 million per customer); **amounts not available** (in worksheets on another host) | ComEd 2026 Standard Incentives Application (www.comed.com) | Primary (PDF) |
| Heat-pump water heaters, heat-pump HVAC | not modeled | **still not modeled**: no commercial hotel-scale cost and performance found (IL-TRM's water-heater measure covers tanks up to 120 gallons) | IL-TRM v14.0 Vol. 2 | Primary (PDF) |

| Hot water per room | 20 gal per occupied room (unsourced) | kept; consistent with **14 gal per hotel room per day** | IL-TRM v14.0 4.3.2 table (from the 2007 ASHRAE Handbook, HVAC Applications, ch. 49) | Primary (PDF) |
| Condensing boiler cost and life | none | **$22.95 per kBtu/h** full installed (>90% EC), 25 years (recorded; chiller part still unsourced) | IL-TRM v14.0 4.4.10 | Primary (PDF) |
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

## Open questions from this research

- The demo hotel's 91.1 kBtu/ft² is 45% above the ENERGY STAR national hotel median (63.0) and 6% above the CBECS lodging mean (85.7, which
  includes nursing homes). A cold climate and a restaurant explain part of it; the default EUI input (92) is still a placeholder (docs/08, B5/B6).
- Installed costs for most upgrades and solar $/W are still placeholders (docs/08, A2, A3).

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

**Still blocked:** ComEd incentive worksheets (A2/A4: the worksheets page is a JavaScript app with no file links), 220 ILCS 5/16-107.5
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
