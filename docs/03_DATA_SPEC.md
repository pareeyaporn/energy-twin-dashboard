# 03 — Data spec (`src/data/`)

All numbers the engine uses live in small JSON files. **Every value carries a `source`.**

> ⚠️ **The numbers below are PLACEHOLDERS** so the engine and UI can be built immediately.
> They are reasonable ballpark figures, not verified. Before the demo, the Engine lead replaces each one
> with a value looked up from the source named next to it, and sets `"verified": true`.
> Do not present placeholder values as sourced facts.

## Files

```
src/data/
  presetHomes.json
  rates.json
  climateZones.json
  endUseSplits.json
  componentLossShares.json
  defaults.json
  upgrades.json
  sources.json
```

---

## presetHomes.json

```json
[
  {
    "id": "maya-chicago",
    "label": "Maya's house — Chicago, IL",
    "zip": "60641", "state": "IL", "climateZone": "5A",
    "sqft": 1850, "stories": 2, "yearBuilt": 1978,
    "heatingFuel": "gas", "heatingSystem": "furnace", "coolingSystem": "central_ac",
    "monthlyElectricBill": 95, "monthlyFuelBill": 100,
    "inspectionNotes": "Furnace 18 years old. Attic insulation ~R-11, compressed. Original single-pane windows on north side. Visible gaps at rim joist."
  },
  {
    "id": "desert-phoenix",
    "label": "Desert ranch — Phoenix, AZ",
    "zip": "85032", "state": "AZ", "climateZone": "2B",
    "sqft": 1600, "stories": 1, "yearBuilt": 2001,
    "heatingFuel": "electric", "heatingSystem": "heat_pump", "coolingSystem": "heat_pump",
    "monthlyElectricBill": 171, "monthlyFuelBill": 0
  },
  {
    "id": "brownstone-boston",
    "label": "Brownstone — Boston, MA",
    "zip": "02118", "state": "MA", "climateZone": "5A",
    "sqft": 2200, "stories": 3, "yearBuilt": 1925,
    "heatingFuel": "oil", "heatingSystem": "boiler", "coolingSystem": "none",
    "monthlyElectricBill": 120, "monthlyFuelBill": 170
  }
]
```
Yearly totals: Maya $2,340 · Phoenix $2,052 · Boston $3,480.

---

## rates.json — source: EIA (state average residential prices)

```json
{
  "IL": { "elecRate": 0.18, "elecFixedMonthly": 12, "gasPerTherm": 1.20, "gasFixedMonthly": 20, "source": "EIA electricity & natural gas monthly, state averages — PLACEHOLDER", "verified": false },
  "AZ": { "elecRate": 0.15, "elecFixedMonthly": 15, "gasPerTherm": 1.60, "gasFixedMonthly": 12, "source": "EIA — PLACEHOLDER", "verified": false },
  "MA": { "elecRate": 0.30, "elecFixedMonthly": 10, "oilPerGallon": 3.80, "oilFixedMonthly": 0, "gasPerTherm": 2.00, "gasFixedMonthly": 15, "source": "EIA electricity, natural gas, heating oil weekly — PLACEHOLDER", "verified": false }
}
```
How to verify: EIA "Electric Power Monthly" table 5.6.A (residential price by state), EIA "Natural Gas Prices" (residential, by state),
EIA heating oil weekly prices (New England). Fixed charges: the utility's tariff page (ComEd, Nicor, APS, Eversource).

---

## climateZones.json — source: IECC climate zones by county (DOE / PNNL)

```json
{ "byZip3": { "606": "5A", "850": "2B", "021": "5A" }, "default": "4A", "source": "IECC 2021 climate zone map (DOE Building America) — demo ZIPs only" }
```

---

## endUseSplits.json — source: EIA RECS 2020, NREL ResStock

Shares of each fuel's annual use. PLACEHOLDERS.

```json
{
  "5A": {
    "gas":      { "elec": { "heating": 0.03, "cooling": 0.12, "waterHeating": 0.00, "other": 0.85 }, "fuel": { "heating": 0.72, "waterHeating": 0.22, "other": 0.06 } },
    "oil":      { "elec": { "heating": 0.03, "cooling": 0.05, "waterHeating": 0.00, "other": 0.92 }, "fuel": { "heating": 0.82, "waterHeating": 0.18, "other": 0.00 } },
    "electric": { "elec": { "heating": 0.38, "cooling": 0.10, "waterHeating": 0.14, "other": 0.38 }, "fuel": null }
  },
  "2B": {
    "electric": { "elec": { "heating": 0.08, "cooling": 0.38, "waterHeating": 0.12, "other": 0.42 }, "fuel": null },
    "gas":      { "elec": { "heating": 0.01, "cooling": 0.40, "waterHeating": 0.00, "other": 0.59 }, "fuel": { "heating": 0.35, "waterHeating": 0.55, "other": 0.10 } }
  },
  "source": "EIA RECS 2020 consumption & expenditures by end use (tables CE3.x/CE4.x); NREL ResStock baseline — PLACEHOLDER",
  "verified": false
}
```

---

## componentLossShares.json — share of heating/cooling load by part, by era

```json
{
  "pre1980":   { "attic": 0.30, "walls": 0.22, "windows": 0.20, "air_leaks": 0.20, "foundation": 0.08 },
  "1980_1999": { "attic": 0.25, "walls": 0.20, "windows": 0.22, "air_leaks": 0.23, "foundation": 0.10 },
  "2000plus":  { "attic": 0.22, "walls": 0.18, "windows": 0.25, "air_leaks": 0.25, "foundation": 0.10 },
  "source": "Typical building-envelope heat-loss distribution (DOE Building America guidance); calibrate against ResStock — PLACEHOLDER",
  "verified": false
}
```
Era rule: yearBuilt < 1980 → pre1980; < 2000 → 1980_1999; else 2000plus.

---

## defaults.json — equipment efficiency and fallbacks

```json
{
  "efficiency": {
    "furnace":   { "pre2005": 0.78, "2005plus": 0.90 },
    "boiler":    { "pre2005": 0.80, "2005plus": 0.86 },
    "baseboard": { "any": 1.0 },
    "heat_pump": { "pre2010": 2.3, "2010plus": 2.8 },
    "central_ac_cop": { "pre2010": 2.9, "2010plus": 3.8 }
  },
  "equipmentAgeAssumption": "Use yearBuilt unless inspection notes give equipment age",
  "avgElecKWhPer1800sqft": { "5A": 9500, "2B": 13500, "4A": 10500 },
  "kWhPerUnit": { "therm": 29.31, "oil_gallon": 40.6, "propane_gallon": 26.8 },
  "baseTonsPer1000sqft": { "5A": 1.6, "2B": 1.5, "4A": 1.4 },
  "source": "AHRI/DOE minimum efficiency history; EIA RECS averages — PLACEHOLDER",
  "verified": false
}
```

---

## upgrades.json — the catalog (5 upgrades)

```json
[
  {
    "id": "attic_insulation", "label": "Attic insulation to R-49", "affects": ["attic"],
    "partReduction": { "attic": { "low": 0.45, "mid": 0.55, "high": 0.65 } },
    "costModel": { "type": "per_sqft_attic", "low": 1.5, "mid": 2.0, "high": 2.8 },
    "lifetimeYears": 30,
    "source": "NREL ResStock End-Use Savings Shapes (attic insulation measure); cost: ResStock measure docs — PLACEHOLDER", "verified": false
  },
  {
    "id": "air_sealing", "label": "Professional air sealing", "affects": ["air_leaks"],
    "partReduction": { "air_leaks": { "low": 0.30, "mid": 0.40, "high": 0.50 } },
    "costModel": { "type": "flat", "low": 800, "mid": 1200, "high": 1800 },
    "lifetimeYears": 15,
    "source": "NREL ResStock (air leakage reduction measure) — PLACEHOLDER", "verified": false
  },
  {
    "id": "windows", "label": "ENERGY STAR double-pane windows", "affects": ["windows"],
    "partReduction": { "windows": { "low": 0.30, "mid": 0.40, "high": 0.50 } },
    "costModel": { "type": "per_window", "low": 600, "mid": 850, "high": 1200 },
    "lifetimeYears": 30,
    "source": "NREL ResStock (window replacement measure); ENERGY STAR — PLACEHOLDER", "verified": false
  },
  {
    "id": "heat_pump", "label": "Cold-climate heat pump", "affects": ["hvac"],
    "heatingCOP": { "5A": { "low": 2.4, "mid": 2.7, "high": 3.0 }, "2B": { "low": 3.0, "mid": 3.3, "high": 3.6 }, "default": { "low": 2.5, "mid": 2.8, "high": 3.1 } },
    "coolingCOP": { "low": 4.0, "mid": 4.4, "high": 4.8 },
    "costModel": { "type": "fixed_plus_per_ton", "fixed": { "low": 3000, "mid": 4000, "high": 5000 }, "perTon": { "low": 2200, "mid": 2600, "high": 3200 } },
    "lifetimeYears": 15,
    "source": "NREL ResStock (ccASHP measure package); cost: state incentive program data — PLACEHOLDER", "verified": false
  },
  {
    "id": "smart_thermostat", "label": "Smart thermostat", "affects": ["hvac"],
    "loadReduction": { "low": 0.05, "mid": 0.08, "high": 0.10 },
    "costModel": { "type": "flat", "low": 150, "mid": 250, "high": 350 },
    "lifetimeYears": 10,
    "source": "ENERGY STAR connected thermostat criteria; NREL ResStock (thermostat setback) — PLACEHOLDER", "verified": false
  }
]
```

---

## sources.json — shown in the Sources sheet

```json
[
  { "id": "eia", "name": "U.S. Energy Information Administration (EIA)", "what": "Electricity, gas and heating oil prices by state", "url": "https://www.eia.gov/" },
  { "id": "resstock", "name": "NREL ResStock", "what": "How U.S. homes use energy and what upgrades save", "url": "https://resstock.nrel.gov/datasets" },
  { "id": "recs", "name": "EIA Residential Energy Consumption Survey (RECS)", "what": "Energy use by end use, region and home type", "url": "https://www.eia.gov/consumption/residential/" },
  { "id": "rewiring", "name": "Rewiring America API", "what": "Rebates and incentives by ZIP", "url": "https://docs.rewiringamerica.org/" },
  { "id": "pvwatts", "name": "NREL PVWatts", "what": "Solar production estimates", "url": "https://developer.nrel.gov/docs/solar/pvwatts/" }
]
```

---

## How to verify the placeholders (Engine lead, hours 2–8)

1. **Rates:** look up IL, AZ, MA on EIA. Update `rates.json`. ~20 min.
2. **End-use splits:** EIA RECS 2020 tables by census division and main heating fuel. ~40 min.
3. **Upgrade savings:** ResStock Data Viewer → filter climate zone 5A, gas heating, vintage <1980 → compare
   baseline vs. measure packages (envelope, heat pump). Back out per-part reductions so Maya's results match
   ResStock's package savings within ~15%. ~2 hours.
4. **Costs:** ResStock measure cost documentation or state program cost data. ~30 min.
5. Set `"verified": true` and update `source` with the exact table/page used.
6. Sanity check: run Maya through Rewiring America's Personal Electrification Planner and compare.
