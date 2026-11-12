# 09 — Pivot: from homes to commercial buildings (offices and retail)

> **Superseded.** The team chose **hotels** as the first commercial segment, with an operational digital twin.
> See [10_HOTEL_SPEC.md](10_HOTEL_SPEC.md) (the brief) and [11_HOTEL_TASKS.md](11_HOTEL_TASKS.md) (the task list).
> This file is kept for the general home-to-commercial change inventory; where it conflicts, the hotel docs win.

We are moving the product from single-family homes to **commercial buildings, starting with offices and retail**.
This is the change list. Items marked **(to confirm)** are proposals, not decisions.

## 0. Decisions first
These block everything else. Recommended defaults are in brackets.
- [ ] User and budget: small-business owner or operator, $25k budget (to confirm)
- [ ] Demand charges: flat energy rate for the demo, demand charges listed as a limitation (to confirm)
- [ ] The home version: replace it in the product, keep the engine code that is generic
- [ ] Demo persona and building: a new "Maya", for example a small office in Chicago (to confirm)
- [ ] Order: office first, retail as a second preset

## 1. Docs
- [ ] `CLAUDE.md` ("What we are building", the demo path), `README.md`, `docs/00_IDEA.md`
- [ ] `docs/02` engine spec, `docs/03` data spec, `docs/04` 3D spec
- [ ] `docs/05` and `docs/06` prompts, `docs/07` demo checklist and Q&A, `docs/08` data to-do
- [ ] Positioning: drop "new homeowners". Add the rising-electricity-rates angle (data center demand)

## 2. Data (`src/data/`), all of it replaced
- [ ] `presetHomes.json`: becomes office and retail presets (type, size, floors, hours, HVAC, bills)
- [ ] `rates.json`: commercial prices (EIA commercial electricity and gas by state), plus demand charges if modeled
- [ ] `endUseSplits.json`: from EIA CBECS by building type. End uses: space heating, cooling, ventilation,
      water heating, lighting, refrigeration (retail), computing and office equipment, other
- [ ] `componentLossShares.json`: roof instead of attic, plus walls, glazing, air leaks and slab, by building type and era
- [ ] `defaults.json`: energy use per square foot by building type and zone (CBECS), rooftop-unit efficiency, sizing rules
- [ ] `upgrades.json`: new catalog (section 3), sourced from NREL ComStock and similar
- [ ] `sources.json`: CBECS, ComStock, EIA commercial prices, incentive programs

## 3. Upgrade catalog
- [ ] LED lighting retrofit (usually the quickest payback)
- [ ] Lighting controls (occupancy and daylight sensors)
- [ ] Rooftop-unit (RTU) replacement or heat-pump RTU
- [ ] Building automation and thermostat scheduling
- [ ] Roof insulation or a cool roof
- [ ] Window film or better glazing
- [ ] Air sealing
- [ ] Stretch: solar
- [ ] Incentives: check the current status of the 179D deduction and local utility rebates before using them (not verified)

## 4. Engine (`src/engine/`)
- [ ] Types: `Home` becomes a building (type, floors, hours, HVAC and lighting). Rename parts (attic to roof, and so on)
- [ ] Baseline: end uses now include lighting; loss shares change
- [ ] Upgrade logic: lighting savings plus the interaction (less lighting heat means less cooling but more heating).
      Size the RTU from the reduced load, as the heat pump is sized today
- [ ] Costs: per square foot, per fixture and per ton cost models
- [ ] Tests: rewrite the home-specific ones, keep the generic ones
- [ ] Reused with wording changes only: optimizer, finance, upgrade ordering, explanation template

## 5. Store (`src/store/`)
- [ ] Rename `home` to building and update presets. Shared file: show the diff and get the OK before changing it

## 6. UI (Lovable-owned, via prompts)
- [ ] Home form becomes a building form: type, square footage, floors, hours of operation, HVAC, monthly bills
- [ ] Copy: "homeowner" to owner or operator, goal labels, preset cards, part names in Thermal Vision

## 7. 3D (`src/three/`)
- [ ] Replace the procedural house with a box building (flat roof with rooftop units, storefront or office glazing). Office and retail variants
- [ ] Parts and colors map to the new part names

## 8. Demo and validation
- [ ] New persona and demo building, numbers sanity-checked
- [ ] Rewiring America does not cover commercial buildings: compare against ENERGY STAR Portfolio Manager or ComStock (to confirm)
- [ ] Update the AI explanation prompt and its fallback wording

## What survives from what is already built
The pipeline (UI, store, engine, data), the optimizer (P5), the finance math, the fixed upgrade order, the explanation
template, the sources sheet, and the PR and merge workflow.
