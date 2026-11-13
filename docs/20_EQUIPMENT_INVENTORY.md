# 20 — Equipment inventory (Phase 14G, November 2026)

Hotel operators can make the twin's equipment match their building: **add, edit, remove and replace** equipment in the Equipment tab.
The design keeps two things apart:

- **Current equipment**: what is installed today. Correcting it is a **correction of the baseline**: the model is recalculated and the
  hotel's energy, cost and carbon change, but **nothing is counted as savings**.
- **Proposed upgrades**: investments measured against the current equipment by the same engine as the optimizer and custom plans
  (`evaluatePackage`). Nothing changes until the operator adds the upgrade to a plan and applies it.

Code: `src/engine/hotel/equipment.ts` (inventory, validation, levers), `src/engine/hotel/baseline.ts` (levers in the simulation),
`src/engine/hotel/upgrades.ts` and `costs.ts` (no double counting, entered capacity), `src/store/useTwin.ts` and
`src/store/equipmentStorage.ts` (per-hotel storage), `src/twin/parts/EquipmentLayer.tsx` and `src/twin/parts/equipment/*` (UI),
`src/report/data.ts` (report section). Data: `src/data/hotel/equipment.json` (`levers`, `templates`).

## 1. Audit of the earlier Equipment tab (and what was fixed)

| # | Finding | Cause | Fix |
| --- | --- | --- | --- |
| A | "100 fan-coil units, 0.2 kW, 27 kW now": 100 × 0.2 kW is 20 kW of fan nameplate, yet 27 kW was shown as the fan coils' demand | The card showed the **guest-room zone's whole HVAC system** (heating, cooling and fans; gas converted to kW) | The reading is labeled **"System-level · Guest rooms HVAC"**; the card shows `100 × 0.2 kW (20 kW total)` as nameplate. The fan coils carry no lever on a central plant (informational) |
| B | Gas boilers showed "kW" | Gas use was converted at 29.3 kW per therm/h and labeled as electric-looking kW | Readings show **electricity in kW and gas input in therms/h and kBtu/h separately**; for a gas heating item also **useful heat ≈ gas input × efficiency** (entered or estimated). Pumps and fans of the plant are not modeled separately, and the card says so |
| C | "Storage tanks (gallons) × 600" | `count` held the gallons (rooms × 6 gal) | Quantity and capacity are separate fields: **`1 × 600 gal`**. Every item now has `count` (units) and `capacity` (per unit, with its unit) |
| D | Water heater, tank and pumps showed identical demand and cost | All three map to the same modeled system (hot-water zone, hot-water end use) | System figures appear **once per system** (on the first card); the others say "Part of the hot water system; its modeled figures are shown on Water heaters". No summary adds them up |
| E | Upgrade savings on a card could exceed that card's cost | The figure was the upgrade's saving **in the zone**, and the upgrade is whole-hotel | Each line says **"$X / yr in this zone"** and **"Whole-hotel upgrade: $Y / yr in all"**. Not capped (an upgrade can lower several systems) |
| F1 | Boilers and chiller shared one efficiency text ("Boiler AFUE about 0.80, chiller COP about 4.5") | One string for the plant | Separate `boilerEfficiency` and `chillerEfficiency` (still assumptions) |
| F2 | Public-area air handling: 0.0015 kW per ft² hard-coded | Unsourced constant in code | Moved to `equipment.json` (`publicAirHandlingKWPerSqft`), labeled an assumption on the card; informational |
| F3 | One water heater of 600 kBtu/h, while the water-heating cost assumes three heaters | Inconsistent rule of thumb | Units of 200 kBtu/h (`heaterUnitKBtuH`): **3 × 200 kBtu/h** for the demo hotel, matching the cost assumption |
| F4 | Boilers: "× 2" next to the total plant capacity | Ambiguous per-unit vs total | `2 × 825 kBtu/h (1,650 kBtu/h total)` |
| F5 | Every item claimed `estimated: true` forever | Type was a literal | `estimated` is false once the operator entered a field; `userEntered` lists which |

Not changed (checked): fuels (gas ranges, dryers, boilers, water heaters gas; the rest electric); laundry is in the hallways zone under
"other" end use, kitchen refrigeration under "equipment" in the kitchen zone, elevators in hallways (all consistent with the zone
allocation in `defaults.json`). Sizes remain rule-of-thumb **placeholders** (`equipment.json` source).

## 2. Data model (one model)

`HotelInput.equipment?: EquipmentOverride[]`, a list of corrections to the estimated inventory:

| Field | Meaning |
| --- | --- |
| `id` | The estimated item it corrects (`boilers`, `chiller`, `room-lighting`, …) or a new id (`added-1`) |
| `template` | For added equipment: one of the 19 templates (`equipment.json` `templates`) |
| `removed` | The item is not installed |
| `label`, `quantity`, `capacity` (per unit, in the item's unit), `zone` (added items only), `schedule`, `ageYears`, `notes` | Entered values |
| `efficiency` | The item's modeled efficiency in its kind (below); `levers` holds several when an item has two (a heat pump's heating COP and cooling COP) |

The engine resolves it (`resolveProfile` → `validateEquipment` → `equipmentLevers`) into `profile.equipment` (valid corrections) and
`profile.equipmentLevers`. `currentEquipment(profile)` gives the cards: the estimate with corrections applied, each with `estimated`,
`userEntered`, `levers`, `roles` and a `modelNote` saying whether and how it changes the model. Invalid fields are dropped with a note on
the profile; the editor shows the same messages before saving.

**Efficiency kinds and bounds** (`equipment.json` `levers.bounds`, validation limits, product decision):

| Kind | Typed as | Bounds |
| --- | --- | --- |
| `thermal` (boilers, furnaces, water heaters) | % | 50–99% |
| `heatPumpCop` | COP | 1.5–5.0 |
| `chillerCop` | COP | 2.0–8.0 |
| `dxCop` (rooftop, PTAC, VRF cooling) | COP | 2.0–5.0 |
| `ledShare` (lighting) | % of fixtures LED | 0–100% |

Quantity: whole number 0–10,000 (1+ for added); capacity above 0; age 0–100 years; name ≤ 80, schedule ≤ 120, notes ≤ 500 characters.

## 3. Levers: what changes the simulation (and nothing else does)

Only parameters that map onto the engine's existing structure are connected. Reference values are those the cards already showed.

| Lever | Set by | Equation in the baseline | Reference |
| --- | --- | --- | --- |
| Heating efficiency `e_h` | Boilers (central plant), rooftop units' gas heat (RTU), PTHP room units or VRF outdoor units (heat-pump COP) | heating site energy × `0.80 / e_h` (replaces the system's reference in the existing `0.80 / efficiency` rule) | `defaults.heatingSystems` (gas 0.80, heat pump 2.3, resistance 1.0, not editable) |
| Cooling COP `c` | Chiller (central plant), rooftop units, VRF outdoor units, PTAC/PTHP room units | cooling electricity × `c_ref / c` | chiller 4.5; packaged DX EER 10 = COP 2.93; VRF 3.0 (placeholders) |
| LED share `s` by zone | Guest-room, lobby and corridor lighting cards | the zone's lighting × `(1 − s × m)`, m = the LED retrofit's mid reduction (45%) | 0 (the benchmark stock the LED measure is written for) |
| Water-heater efficiency `e_w` | Water heaters | the **gas part** of hot water × `0.80 / e_w` (the electric part, pumps and electric heaters, is unchanged) | 0.80 |
| Existing solar kW `P` | Added "Rooftop solar (existing)" | each month, purchased electricity minus `min(P × PVWatts mid yield × month share, the month's electricity)`, spread over the month's electric cells in proportion; no export credit | none |

Several items on one lever (two boilers of different efficiency) combine as a **capacity-weighted average** (`count × capacity`).
A lever is set only when the operator changed something feeding it (an entered efficiency, or added or removed equipment of that kind);
otherwise the baseline is exactly the estimated one (tested).

**Through existing hotel settings, not copies:** the lobby and corridor lighting schedule edits the hotel's `lightingHoursPerDay`; the
public-area air handling schedule edits `commonAreaHvacHours`; "smart guest-room controls already installed" on the room HVAC card edits
`smartRoomControls`. One value, used everywhere. (HVAC system type stays in the hotel profile.)

**Refrigerant (carbon only, never energy):** cooling equipment (chillers, rooftop units, room units, VRF) and the kitchen's cold
storage can record a refrigerant and the **pounds added in a year** from service records. Carbon = pounds × 0.45359 × the refrigerant's
100-year GWP (EPA GHG Emission Factors Hub 2025, Tables 11–12: R-410A 1,924, R-407C 1,624, R-134a 1,300, R-32 677, R-404A 3,943,
R-507A 3,985); EPA's simplified material balance treats what was added as what leaked. R-22 (HCFC-22) is recorded but not counted
(ozone-depleting, outside EPA's GHG inventory scope). Nothing is assumed when blank. The leaks appear in the Flow tab's **Carbon** view as a
third source and in the carbon "How was this calculated?" panel, **reported next to the energy carbon, not inside it**; they change no
energy, cost, savings or package ranking (`src/engine/hotel/refrigerant.ts`, `holdsRefrigerant`, tests in `__tests__/refrigerant.test.ts`).

**Informational (shown, labeled, never change consumption):** quantities, nameplate capacities (except below), ages, notes, schedules
without a modeled setting, kitchen, laundry, elevators, plug loads, storage, pumps, fan coils, and added equipment without a lever
(adding a dishwasher does not add consumption). A heat-pump water heater can be recorded but is **not modeled**: it changes the fuel, which
the simulation does not do yet; the card says so.

**Capacity that does matter:** entered quantity × capacity of the central plant's boilers (kBtu/h) and chillers (tons) replaces the
estimate in `coolingTons` and `boilerKBtuH`, the basis of the HVAC replacement cost. Removing them sets that basis to 0.

## 4. Current vs proposed: no double counting

| Situation | Rule |
| --- | --- |
| A correction | New baseline; the optimizer, custom plans, comparison, stress tests and portfolio all measure against it. An existing plan is cleared (the store says so: "The hotel's baseline changed, so the investment plan was cleared"). Never shown as savings |
| LED already installed (share s) | The LED retrofit converts only the rest: a zone's lighting goes from `(1 − s m)` to `(1 − s m − (1 − s) r)` of the reference, a reduction of `(1 − s) r / (1 − s m)` of what it uses now. All three lighting zones 100% LED: the retrofit is not offered |
| Efficient boiler or chiller entered | The HVAC upgrade's reduction r has a target, `reference / (1 − r)` (0.80 / 0.87 = 0.92, the condensing boiler of its source). With entered e the reduction left is `(1 − e / target) / r` times r: 0 at or above the target, at most 3 × r for poor equipment, capped at 90% |
| Efficient water heaters entered | The water-heating measure is about half efficiency (0.80 → 0.90: 11% of its 22% mid) and half low-flow fixtures; only the efficiency part scales with the gap to 0.90 |
| Smart room controls installed | The existing flag: set back in the baseline, the upgrade not offered |
| Existing solar | Lowers purchased electricity; additional rooftop solar is limited to the roof left (`usable roof kW − existing kW`) |
| Replace | Maps to an existing upgrade: heating or cooling equipment → `hvac_upgrade` (it covers both together; the dialog says so), lighting → `led_lighting`, water heaters → `water_heating`, solar → `rooftop_solar`. Shown side by side: current spec vs proposed, installed cost and range, net after confirmed incentives, energy, cost, CO₂, payback and 10-year NPV from `evaluatePackage`. Anything else: **"Needs more information"** (no sourced cost or measure; nothing invented). "Add to my plan" adds it to the active custom plan, so the optimizer and Build your own plan remain the one place investments are managed |

## 5. Validation and safety

- The last item providing **heating, cooling or hot water** cannot be removed: the editor disables Remove and explains ("This is the
  hotel's only heating equipment. Add or replace it first, or change the HVAC type in the hotel profile"). Stored data that tries it is
  kept with the item installed and a note. Once a replacement is added (for example a condensing boiler), the old one can be removed.
- Existing solar larger than the usable roof: warning.
- Every number is checked against its bounds by the engine (the editor and stored data use the same `validateEquipment`).
- **Undo** (one step: the list and any setting the change touched) and **Reset to sample equipment** (clears the hotel's corrections).
  **Reset demo** clears all corrections.

## 6. Persistence and independence

Corrections are saved **per property** in local storage (`energy-twin:equipment:v1`, `{ version: 1, byProperty }`), keyed by the
portfolio property id (the sample hotel opened from the preset menu uses its portfolio property, for example `lakeshore-inn`). Opening a
hotel brings its saved corrections; the portfolio's unopened hotels carry theirs (`withEquipment`), so portfolio totals equal each hotel's
own view (tested). Changing one hotel never changes another. Browser-only; nothing is sent anywhere. A sample hotel stays labeled
synthetic, with the operator's corrections. Limitation: schedule and smart-controls settings edited from a card follow the hotel's
other profile settings (saved for "Add my hotel" hotels; for the sample hotels kept for the visit only).

## 7. Where it shows

Equipment tab (Current equipment / Proposed upgrades), zone panel (quantity, capacity, estimated or your data), all KPIs, carbon, the
energy flow and the 3D twin's figures (they read the recalculated results; no 3D equipment is drawn from the inventory), the optimizer and
plans (eligibility and savings), portfolio totals, and the investment report and PDF ("Current equipment": each item with quantity,
capacity, efficiency and whether it is estimated or operator data).

## 8. Limitations

- Sizes and the reference efficiencies are rule-of-thumb placeholders; cooling reference COPs matter only when an operator enters a value.
- Levers act on whole end uses (all heating, all cooling): an entered efficiency is the hotel's seasonal average, not per unit.
- Existing solar is netted monthly (no hourly self-consumption, no export credit), so for a large array the purchased-electricity
  reduction is an upper bound; upgrade electricity savings are measured on the netted electricity (conservative).
- Heat-pump water heaters, fuel switching, and per-appliance demand are not modeled.
- Undo is one step.
