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
