# 02 — Engine spec (`src/engine/`)

The engine turns a home + budget into numbers: baseline costs, heat loss per part of the house (which drives the
3D visuals), and the top 3 upgrade packages. It is **pure TypeScript**: no React, no network, no AI, no randomness.

Files:
```
src/engine/
  types.ts         all shared types
  constants.ts     physical constants (energy content, defaults)
  baseline.ts      estimateBaseline(home)
  upgrades.ts      applyUpgrades(home, baseline, upgradeIds, scenario)
  costs.ts         upgradeCost(home, upgradeId, baseline, appliedSoFar)
  finance.ts       financials(...)
  optimizer.ts     optimize(home, budget, goal, assumptions)
  explain.ts       templateExplanation(result)  — fallback text without AI
  index.ts         re-exports
  __tests__/       vitest tests
```

---

## 1. Types (`types.ts`)

```ts
export type HeatingFuel = 'gas' | 'electric' | 'oil' | 'propane';
export type HeatingSystem = 'furnace' | 'boiler' | 'heat_pump' | 'baseboard';
export type CoolingSystem = 'central_ac' | 'heat_pump' | 'none';
export type ClimateZone = '2B' | '4A' | '5A' | '6A' | string; // demo uses 2B (Phoenix), 5A (Chicago, Boston)
export type Goal = 'max_savings' | 'fastest_payback' | 'best_value';
export type UpgradeId = 'attic_insulation' | 'air_sealing' | 'windows' | 'heat_pump' | 'smart_thermostat';
export type PartId = 'attic' | 'walls' | 'windows' | 'air_leaks' | 'foundation';
export type Scenario = 'low' | 'mid' | 'high'; // low = pessimistic savings, high = optimistic

export interface Home {
  id?: string;
  label?: string;
  zip: string;
  state: string;              // 2-letter, used for rates
  climateZone: ClimateZone;
  sqft: number;
  stories: 1 | 2 | 3;
  yearBuilt: number;
  heatingFuel: HeatingFuel;
  heatingSystem: HeatingSystem;
  coolingSystem: CoolingSystem;
  monthlyElectricBill?: number;   // $ average
  monthlyFuelBill?: number;       // $ average (gas / oil / propane)
  inspectionNotes?: string;
}

export interface Assumptions {
  priceGrowth: number;   // e.g. 0.02 per year
  discountRate: number;  // e.g. 0.03
  horizonYears: number;  // 15
}

export interface Sourced<T> { value: T; source: string; estimated?: boolean }

export interface PartLoss {
  part: PartId;
  share: number;          // share of heating+cooling load through this part (0–1)
  annualCost: number;     // $ / yr lost through this part
  intensity: number;      // 0–1, normalized for 3D color (1 = worst part)
}

export interface Baseline {
  elecKWh: number;
  fuelKWh: number;               // fuel energy input converted to kWh (0 if all-electric)
  elecRate: number;              // $/kWh
  fuelRatePerKWh: number;        // $/kWh of fuel energy
  heatingLoadKWh: number;        // delivered heat (kWh thermal)
  coolingLoadKWh: number;        // delivered cooling (kWh thermal)
  heatingEfficiency: number;     // AFUE or COP
  coolingCOP: number;
  costs: { heating: number; cooling: number; waterHeating: number; other: number; total: number };
  parts: PartLoss[];
  hvacEfficiencyScore: number;   // 0–1 for 3D (1 = excellent)
  sources: string[];
  estimated: boolean;            // true if bills were missing and averages were used
}

export interface UpgradeOutcome {
  upgradeIds: UpgradeId[];
  costs: Baseline['costs'];
  parts: PartLoss[];
  heatPumpTons?: number;
}

export interface Package {
  id: string;                    // e.g. "attic_insulation+air_sealing+heat_pump"
  upgradeIds: UpgradeId[];
  name: string;                  // human readable
  cost: { low: number; mid: number; high: number };
  annualSavings: { low: number; mid: number; high: number };
  newAnnualCost: number;         // mid
  paybackYears: number | null;   // null if savings <= 0
  value15: number;               // net present value over horizon (mid)
  reason: string;                // one line, rule-based
  outcome: UpgradeOutcome;       // mid scenario, for the 3D
  lineItems: { id: UpgradeId; label: string; cost: number; savings: number; lifetimeYears: number; source: string }[];
}

export interface OptimizerResult {
  combinationsTested: number;    // 32 for the demo (shown in the UI counter)
  feasibleCount: number;
  top: Package[];                // top 3, ranked by goal
  baseline: Baseline;
  goal: Goal;
  budget: number;
}
```

---

## 2. Baseline (`baseline.ts`)

`estimateBaseline(home: Home, data = defaultData): Baseline`

1. **Rates** from `rates.json` by `home.state`: `elecRate` ($/kWh), `elecFixedMonthly`, fuel price per unit, `fuelFixedMonthly`.
2. **Electricity kWh** = `max(0, monthlyElectricBill − elecFixedMonthly) × 12 / elecRate`.
   If the bill is missing → use `defaults.json` average kWh for the climate zone × (sqft / 1,800). Mark `estimated: true`.
3. **Fuel energy (kWh)** = `max(0, monthlyFuelBill − fuelFixedMonthly) × 12 / pricePerUnit × kWhPerUnit`.
   kWhPerUnit: gas therm = 29.31, heating-oil gallon = 40.6, propane gallon = 26.8.
4. **End-use split** from `endUseSplits.json[climateZone][heatingFuel]`:
   - electricity: `heating`, `cooling`, `waterHeating`, `other` shares
   - fuel: `heating`, `waterHeating`, `other` shares
5. **Heating input** (kWh) = fuel heating share × fuelKWh (fuel homes) or elec heating share × elecKWh (electric homes).
6. **Equipment efficiency** from `defaults.json` by system and era (yearBuilt):
   - furnace/boiler AFUE (e.g. 0.80 for an older unit), baseboard 1.0, heat pump seasonal COP (e.g. 2.3 older).
   - central AC COP (e.g. 2.9 ≈ SEER 10 for older units).
7. **Delivered loads**: `heatingLoadKWh = heatingInput × heatingEfficiency`; `coolingLoadKWh = coolingElecKWh × coolingCOP`.
8. **Costs** ($/yr): heating, cooling, waterHeating, other, total — each = its energy × its rate. The total must equal
   the user's bills minus fixed charges (within rounding) when bills are given.
9. **Parts**: from `componentLossShares.json` by era (`pre1980`, `1980_1999`, `2000plus`): shares for attic, walls,
   windows, air_leaks, foundation (sum = 1). `annualCost = (heating + cooling cost) × share`.
   `intensity = annualCost / max(annualCost of all parts)`.
10. **hvacEfficiencyScore**: map efficiency to 0–1 (AFUE 0.78 → 0.2, 0.95 → 0.9; COP 2.3 → 0.5, 3.5 → 1).

---

## 3. Upgrades (`upgrades.ts`) — the order matters (no double counting)

`applyUpgrades(home, baseline, upgradeIds, scenario = 'mid', data): UpgradeOutcome`

Apply in this fixed order regardless of input order:

1. **Envelope** (attic_insulation, air_sealing, windows). Each has a `partReduction` in `upgrades.json`
   (e.g. attic_insulation reduces the **attic** part's loss by 55% [low 45%, high 65%]).
   New load factor = `Σ over parts ( share_p × (1 − reduction_p) )`.
   `heatingLoad' = heatingLoad × factor`, `coolingLoad' = coolingLoad × (0.5 + 0.5 × factor)`
   (cooling is less envelope-driven; this keeps it conservative).
   Recompute `parts[]` with the reduced shares — this is what the 3D animates (red → blue).
2. **Heat pump**: replaces heating and cooling equipment.
   - New heating COP from `upgrades.json` by climate zone (cold-climate unit, e.g. 2.7 in 5A; scenario low/high ±0.3).
   - New cooling COP (e.g. 4.4).
   - Heating energy becomes electric: `heatingElecKWh = heatingLoad' / COP`. Fuel heating goes to 0.
     Water heating and other fuel uses are **unchanged** (fuel bill doesn't fully disappear).
   - **Sizing**: `tons = baseTons(sqft, climateZone) × (heatingLoad' / heatingLoad)` rounded up to 0.5 ton, min 1.5.
     This is what makes "insulate first → smaller, cheaper heat pump" fall out of the math. Store `heatPumpTons`.
3. **Smart thermostat**: reduces the remaining delivered heating and cooling load by 8% [low 5%, high 10%].

Return new costs (same categories as baseline) and new parts.

**Not allowed:** adding savings percentages from different upgrades together. Always recompute from loads.

---

## 4. Costs (`costs.ts`)

`upgradeCost(home, id, outcomeSoFar): { low, mid, high }` using `upgrades.json` cost models:
- attic_insulation: `$/sqft × atticArea`, atticArea = sqft / stories
- air_sealing: flat range
- windows: `$/window × windowCount`, windowCount = round(sqft / 110)
- heat_pump: `fixed + $/ton × heatPumpTons` (so the cost depends on the envelope upgrades applied before it)
- smart_thermostat: flat range

Package cost = sum of line items. Incentives are 0 by default (federal 25C/25D ended Dec 31, 2025); a later step
may subtract rebates from the Rewiring America API.

---

## 5. Finance (`finance.ts`)

```
annualSavings_1 = baseline.costs.total − outcome.costs.total
paybackYears    = cost / annualSavings_1                  (null if savings ≤ 0)
value15 = Σ_{t=1..H} annualSavings_1 × (1+g)^(t−1) / (1+r)^t  − cost  + residual
residual = Σ over line items: itemCost × max(0, life − H) / life / (1+r)^H
```
g = priceGrowth, r = discountRate, H = horizonYears (15). Lifetimes from `upgrades.json`
(e.g. insulation 30, air sealing 15, windows 30, heat pump 15, thermostat 10).

Savings ranges: run `applyUpgrades` with `low`, `mid`, `high` scenarios. Rank on `mid`.

---

## 6. Optimizer (`optimizer.ts`)

`optimize(home, budget, goal, assumptions, data): OptimizerResult`

1. `baseline = estimateBaseline(home)`
2. Candidate upgrades = all 5, minus ineligible:
   - drop `heat_pump` if `heatingSystem === 'heat_pump'`
   - (optional) drop `windows` if `yearBuilt >= 2010`
3. Enumerate every subset (2^n, n ≤ 5 → ≤ 32), **including the empty set** in the count but never returning it.
4. For each subset: outcome (mid), cost (mid), drop if `cost.mid > budget`.
5. Compute savings range, payback, value15.
6. Rank:
   - `max_savings`: highest `annualSavings.mid`
   - `fastest_payback`: lowest `paybackYears` (null last), tie → higher savings
   - `best_value`: highest `value15`, tie → lower cost
7. Return top 3 + `combinationsTested` (2^n) + `feasibleCount`.
8. `reason` (rule-based, no AI), first matching rule:
   - includes heat_pump + any envelope upgrade, and tons < tons without envelope → "Insulating first lets you buy a smaller heat pump."
   - no heat_pump and cheapest of top 3 → "Low-cost fixes with the quickest payback."
   - includes heat_pump only → "Biggest equipment upgrade, but the house still leaks heat."
   - default → "Best balance of cost and savings for your goal."

Performance: must run in < 50 ms in the browser. (32 combos × 3 scenarios is trivial.)

---

## 7. Fallback explanation (`explain.ts`)

`templateExplanation(result: OptimizerResult): string` — 4–6 sentences built only from result numbers.
Used when the AI function fails or takes > 6 s, and cached for the demo.

---

## 8. Tests (`__tests__/engine.test.ts`) — must all pass

1. Maya's preset: baseline total within 2% of her bills minus fixed charges.
2. Maya's preset with budget 15,000 and `best_value` returns the same top 3 every run (snapshot of ids).
3. No returned package has `cost.mid > budget`.
4. `combinationsTested === 32` for Maya (gas furnace → heat pump eligible).
5. Heat pump tons with attic_insulation + air_sealing < tons with heat_pump alone.
6. Heat pump savings when applied after envelope ≤ heat pump savings alone (no double counting).
7. `applyUpgrades([])` returns baseline costs exactly.
8. `value15` is lower with discountRate 0.05 than 0.03.
9. Savings ranges are ordered: low ≤ mid ≤ high.
10. Phoenix preset (already heat pump) never includes `heat_pump` in results.
11. Part intensities are in [0, 1] and at least one equals 1.

---

## 9. Store wiring (`src/store/useTwin.ts`)

Extend (don't replace) the store Lovable created. It must expose:

```ts
selectedPresetId: string;
home: Home;
budget: number;                 // default 15000
goal: Goal;                     // default 'best_value'
assumptions: Assumptions;       // { priceGrowth: 0.02, discountRate: 0.03, horizonYears: 15 }
baseline: Baseline | null;      // recomputed whenever home changes
results: Package[];             // top 3
combinationsTested: number;
activePackageId: string | null;
appliedUpgrades: UpgradeId[];   // drives the 3D upgrade animations
displayedParts: PartLoss[];     // baseline.parts or active package outcome.parts
displayedAnnualCost: number;    // baseline total or package newAnnualCost
thermalMode: boolean;
selectedPart: PartId | null;
optimizing: boolean;            // true for ~2 s while the UI shows "Testing 32 combinations…"
drawerOpen: boolean;
reduceEffects: boolean;

selectPreset(id), setHome(partial), setBudget(n), setGoal(g), setAssumptions(partial),
runOptimizer(), applyPackage(id | null), toggleThermal(), selectPart(id | null), setReduceEffects(b)
```

`runOptimizer` computes instantly but keeps `optimizing: true` for ~2 s so the 3D can play the optimizer animation.
