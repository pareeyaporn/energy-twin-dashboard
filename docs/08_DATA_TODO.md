# 08 — Data and project to-do (what needs to be found)

Everything here is research or a decision, not code. The values in `src/data/` are **placeholders**
(`"verified": false`). For each value you replace: set `"verified": true` and rewrite the `source` field
to name the exact table or page used. Details of each file are in [03_DATA_SPEC.md](03_DATA_SPEC.md).

## A. Engine data (research, about 4–5 h)

### `src/data/rates.json` (~20 min) — IL (Maya), AZ (Phoenix), MA (Boston)
- [ ] Residential electricity price, $/kWh, for IL, AZ, MA — EIA Electric Power Monthly, Table 5.6.A
- [ ] Fixed monthly electric charge — ComEd, APS, Eversource tariff pages
- [ ] Residential gas price for IL and MA (AZ too, for completeness) — EIA natural gas prices. EIA gives $/Mcf; divide by ~10.37 for $/therm
- [ ] Fixed monthly gas charge — utility tariffs (Maya's ZIP 606xx is Peoples Gas; Nicor serves the suburbs)
- [ ] Heating oil price, MA, $/gallon — EIA weekly heating oil prices, New England
- [ ] Optional: propane price per gallon and fixed charge (not in the data yet; propane homes fail with an error without it)

### `src/data/climateZones.json` (~5 min)
- [ ] Confirm ZIP prefixes 606 → 5A, 850 → 2B, 021 → 5A — IECC 2021 county map (DOE Building America)
- [ ] Confirm the default zone (4A)
- [ ] Optional: add more ZIP prefixes if users can enter any ZIP

### `src/data/endUseSplits.json` (~40 min) — EIA RECS 2020 (tables CE3.x / CE4.x) and NREL ResStock
- [ ] 5A gas (Maya), 5A oil (Boston), 2B electric (Phoenix) — needed for the demo
- [ ] Optional: 5A electric and 2B gas, for user-entered homes
- [ ] Electricity shares: heating, cooling, water heating, other
- [ ] Fuel shares: heating, water heating, other
- [ ] Each set of shares sums to 1

### `src/data/componentLossShares.json` (~30 min) — DOE Building America guidance, ResStock
- [ ] Shares for attic, walls, windows, air leaks, foundation for each era: before 1980, 1980–1999, 2000 and later
- [ ] Each era sums to 1 (this drives the colors in Thermal Vision)

### `src/data/defaults.json` (~30 min)
- [ ] Furnace and boiler efficiency (AFUE), before and after 2005 — AHRI / DOE minimum-efficiency history
- [ ] Heat pump seasonal COP, before and after 2010
- [ ] Central AC COP, before and after 2010
- [ ] Average household electricity use per 1,800 sq ft for zones 5A, 2B, 4A — EIA RECS
- [ ] Heat pump tons per 1,000 sq ft for zones 5A, 2B, 4A — Manual J rule of thumb or ResStock
- [ ] Confirm energy conversions: 29.31 kWh/therm, 40.6 kWh/gallon of oil, 26.8 kWh/gallon of propane

### `src/data/upgrades.json` (~2.5 h) — low / mid / high for each
- [ ] Attic insulation to R-49: reduction in attic loss, cost per sq ft of attic, lifetime
- [ ] Air sealing: reduction in air-leak loss, flat cost, lifetime
- [ ] ENERGY STAR windows: reduction in window loss, cost per window, lifetime
- [ ] Cold-climate heat pump: heating COP for 5A, 2B and a default; cooling COP; fixed cost plus cost per ton; lifetime
- [ ] Smart thermostat: reduction in heating and cooling load, flat cost, lifetime
- [ ] Calibrate: in ResStock's Data Viewer filter to zone 5A, gas heating, built before 1980, and tune the reductions so Maya's package savings land within ~15% of ResStock's
- Sources: NREL ResStock (measure packages and cost docs), ENERGY STAR, state incentive program cost data

### `src/data/sources.json` (~5 min)
- [ ] Confirm all five URLs still work (EIA, ResStock, RECS, Rewiring America, PVWatts)

## B. Validation (for Q&A)
- [ ] Run Maya through Rewiring America's Personal Electrification Planner; note how the results compare
- [ ] Check the three preset homes' bills and sizes are realistic (yearly: Maya $2,340, Phoenix $2,052, Boston $3,480)
- [ ] Make sure the dollar figures in the pitch script match what the app shows

## C. Keys and accounts (Lovable Cloud secrets only; never in code or GitHub)
- [ ] AI provider key for the explain function (P13) — team decides provider and key name
- [ ] NREL API key for PVWatts solar (P14, stretch)
- [ ] Rewiring America API key for rebates (P14, stretch)

## D. Decisions
- [ ] Propane: support it or not (needs a price if yes)
- [ ] Incentives: the engine assumes none (federal 25C/25D ended Dec 31, 2025). Add state or utility rebates later?
- [ ] Optional rule: drop the windows upgrade for homes built in 2010 or later?
- [ ] Anything not verified before the demo must be labeled "estimated" on screen

## E. Demo and pitch material (see [07_DEMO_CHECKLIST.md](07_DEMO_CHECKLIST.md))
- [ ] Backup video, 30–45 s of the full sequence, recorded around hour 34
- [ ] Cached AI explanation for Maya + $15k + best value
- [ ] Slides: roadmap and metrics
- [ ] Test on the real projector or external screen resolution
- [ ] Phone hotspot ready as a Wi-Fi fallback
- [ ] Demo path run 5 times in a row without a failure
- [ ] An owner for each Q&A answer
