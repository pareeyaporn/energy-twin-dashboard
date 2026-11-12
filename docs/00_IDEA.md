# 00 — The idea

> **Energy Twin: Simulate smarter. Spend better. Save energy.**

An AI-powered operational digital twin for **existing commercial buildings, starting with hotels**.
Written from the pivot brief ([10_HOTEL_SPEC.md](10_HOTEL_SPEC.md)). Items marked **(to confirm)** are inferences for the team to check.

## The problem

Hotels run around the clock, and energy is one of their largest controllable costs. Owners and general managers rarely have an
energy engineering team. They face questions they can't test cheaply: What happens to my bill if occupancy rises? Do smart
room controls pay back? Should I spend $50,000 on solar, thermostats or LEDs first? Audits are slow and expensive, calculators give
generic lists, and electricity prices keep rising. **(to confirm: problem wording)**

## Who it's for

**Hotel owners, general managers and facilities managers** of existing properties, without an in-house energy team.

**Persona (to confirm):** Dana, general manager of a 100-room hotel in Chicago. Energy bills are climbing, and she has $50,000 to spend
but no way to tell which upgrades beat the others, or what they do to guest comfort.

## The idea

1. **Open a hotel.** Enter a profile or start from a synthetic 100-room preset. Most inputs are optional, with labeled defaults.
2. **See where the energy goes.** A clickable diagram shows six zones (guest rooms, lobby and common areas, kitchen and restaurant,
   hallways, central HVAC, hot water) with energy and cost for each.
3. **Test decisions.** Change occupancy, setpoints, schedules or electricity prices and see before/after energy, cost and carbon, with the reasons it changed.
4. **Optimize an investment.** Enter a budget such as $50,000. Get three packages (maximum savings, fastest payback, balanced) with cost, savings,
   payback, five-year net benefit, carbon and comfort notes.
5. **Ask the advisor.** "Why thermostats before solar?" is answered from the actual model results.

## Principles

- **The AI never invents numbers.** A deterministic TypeScript engine computes everything. The AI explains, and the browser rejects any answer with a number that is not in the results.
- **Estimates, with ranges and sources.** Defaults and synthetic data are labeled. We make no claim of engineering-grade accuracy, verified carbon savings or guaranteed returns.
- **Operations and investments together.** The simulation shows how the building behaves; the optimizer decides how to spend.
- **Comfort is a constraint,** not an afterthought: schedule and setpoint changes that could hurt guests are flagged.

## How it differs from existing tools

- **Eden** designs net-zero **new** single-family homes for architects and builders. We help operators of **existing** buildings model operating decisions and evaluate investments.
- **Benchmarking tools** (for example ENERGY STAR Portfolio Manager) score past performance. We simulate what happens next and rank what to buy.
- **Generic calculators** list measures. We find the best *combination* for a fixed budget, accounting for interactions between upgrades.

## Scope

**MVP (P0):** hotel profile, interactive dashboard, occupancy and HVAC simulation, upgrade cost and savings comparison, budget-constrained optimizer, before/after metrics.
**Differentiators (P1):** clickable twin, grounded AI advisor, saved scenarios, comfort constraints, five-year projections.
**Later (P2):** detailed 3D, live IoT, utility-bill calibration, hourly simulation, multi-property optimization, complex tariffs, other building types
(offices, retail, hospitals, factories).

## Success looks like

- Occupancy and HVAC changes give sensible, explainable results, and energy and financial metrics update consistently.
- The optimizer never exceeds the budget and accounts for interactions.
- The advisor explains calculated recommendations.
- The twin visibly reflects scenarios, and a viewer grasps the financial benefit within minutes.
- The demo runs reliably without complex setup.

## Current state

The hotel engine, workspace dashboard, 2D and 3D twin, budget optimizer and AI advisor are built; see the status table in the
[README](../README.md) and the task list in [11_HOTEL_TASKS.md](11_HOTEL_TASKS.md).
