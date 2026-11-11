# 00 — The idea

> **Energy Twin: see the savings before you spend.**

Written from `CLAUDE.md`, the specs in `docs/`, and the demo checklist. Items marked **(to confirm)** are
inferences for the team to check, not decisions already made.

## The problem

New homeowners have a renovation budget and no way to tell which upgrades are worth it.
Energy audits are slow and cost money. Online calculators return a generic list of measures. Neither says which
*combination* of upgrades gives the best result for a fixed budget. Savings claims are hard to trust, and the
reasons a house leaks money are invisible. **(to confirm: problem wording)**

## Who it's for

**New homeowners**: bought in the last 12 months, with a renovation budget. Buyers are deciding where the
first dollars go, and they haven't yet settled into a house they'd rather not touch.

**Persona: Maya.** Chicago, 1978 house, 1,850 sq ft, gas furnace, about $2,340/yr in energy bills, $15k to spend.
She is also the preset home in the demo.

## The idea

1. **Pick or enter a home.** Presets are Maya (Chicago), a Phoenix ranch and a Boston brownstone. Or enter your own details.
2. **See where it leaks (Thermal Vision).** A 3D house shows heat loss by part: attic, walls, windows, air leaks, foundation. Each part shows its dollars-per-year loss.
3. **Set a budget and a goal.** The goals are max savings, fastest payback, or best value over 15 years.
4. **Optimize.** The engine tests combinations of upgrades and returns the **top 3 packages you can afford**.
5. **Watch it happen.** The chosen package's upgrades appear on the house and the bill counts down.
6. **Get a plan.** Each package has costs, savings *ranges*, payback and sources, plus a plain-language explanation.

## Principles

- **Savings come as ranges, with sources.** Every number shows a `[low, high]` range and where it came from (EIA, NREL ResStock, DOE). This is a planning estimate, not an audit.
- **The AI never invents numbers.** All numbers come from the deterministic engine (`src/engine`). The AI only explains them.
- **The visuals are the numbers.** The 3D scene does no math. If the numbers change, the picture changes.
- **Neutral ranking.** The ranking ignores who profits from an upgrade.

## How it differs from existing tools

Compared with the Rewiring America planner (our main reference point):
- It finds the **best combination for a fixed budget**, not a list of measures.
- It is built for **new buyers**.
- It **shows visually** where the money leaks.

## Scope

**In (hackathon, 48 h):** one flawless demo path (Maya → Thermal Vision → $15k → Optimize → upgrades on
screen → bill drops → plan with sources). Five upgrades: attic insulation, air sealing, windows, heat pump, smart thermostat.
Three preset homes. Engine, data files, 3D scene, AI explanation.

**Out for now (to confirm):** real rebate and incentive lookups, bill upload, renters and landlords, schools,
accounts and saved plans.

**Roadmap (from the Q&A prep):** rebate API → bill upload → landlords and schools.

## Business angle (to confirm)

From the Q&A prep. The product stays neutral because ranking ignores who pays. Partners could include agents and
lenders, who want engaged buyers, and contractors, who want ready-to-buy leads.

## Success looks like

- The demo path runs 5 times in a row without a failure.
- Dollar figures in the pitch match what the app shows.
- Maya's results are sanity-checked against Rewiring America.
- Every shown number has a source, or is clearly labeled "estimated".

## Current state

The UI shell and mock data are built. The engine, 3D scene and AI explanation are not. See the status table in
the [README](../README.md). Specs: [engine](02_ENGINE_SPEC.md), [data](03_DATA_SPEC.md), [3D](04_3D_SPEC.md),
[demo checklist](07_DEMO_CHECKLIST.md).
