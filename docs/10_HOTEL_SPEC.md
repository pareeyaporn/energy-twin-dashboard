# Energy Twin — Hotel Pivot and Implementation Requirements

## 1. Background and Why We're Pivoting
Energy Twin began as an AI-powered residential energy digital twin. Homeowners could enter location, size, utility bills and renovation budget to compare solar, insulation and HVAC upgrades. A prior Booth Hacks winner, Eden, already addressed net-zero-ready single-family home design, cost, incentives and optimization. To differentiate, **pivot to existing commercial buildings, starting with hotels**, and emphasize operational simulation and investment decisions rather than new-build design.

## 2. Product Vision
**Energy Twin: An AI-powered digital twin that helps commercial building owners reduce energy costs, simulate operational decisions, and maximize returns on energy investments.**

Initial segment: hotels. Possible expansion: offices, retail, hospitals and factories. Users should understand energy waste, occupancy and weather effects, operational changes, upgrade choices, comfort constraints, investment payback and carbon impact.

## 3. Original vs. New Product
| Dimension | Original | New |
|---|---|---|
| Customer | Single-family homeowners | Hotel owners and operators |
| Focus | Renovation recommendations | Operational simulation plus capital allocation |
| Inputs | Home size, location, bills, budget | Hotel rooms, floor area, occupancy, HVAC, schedules, bills, budget |
| Output | Upgrade savings and ROI | Interactive twin, scenarios, optimized investment packages |
| Positioning | Net-zero home improvements | Lower operating expenses without sacrificing comfort |

**Do not just replace residential labels with hotel labels.** Model hotel operations.

## 4. Primary User and Workflow
Users: hotel owners, general managers, facilities managers.

**Hotel profile inputs:** name; city/state/country; guest rooms; floor area; floors; construction year; HVAC type; monthly energy bill; electricity rate; occupancy; occupied hours; guest-room temperatures; common-area HVAC and lighting schedules; hot-water usage; seasonal occupancy; renovation budget; investment horizon; and objective (annual savings, payback, ROI, carbon, or balanced comfort).

Make most inputs optional with realistic, clearly labeled defaults.

## 5. Interactive Hotel Digital Twin
Represent guest rooms, lobby/common areas, kitchen/restaurant, hallways, central HVAC/mechanical systems and hot water. Each zone should show estimated energy use, costs, major equipment, operating schedule and potential improvements.

Users should be able to select zones and change inputs, with visible updates to results. Demo scenarios:
- Occupancy changes from 50% to 90%.
- Smart guest-room HVAC controls reduce energy use in vacant rooms.
- Electricity prices increase by 20%.
- Common-area HVAC schedules change, with comfort implications flagged.

Prefer a functional clickable 2D diagram or lightweight 3D view over expensive photorealistic 3D. Show energy intensity, before/after results and immediate feedback.

*Status (November 2026): both are built. The 2D twin has zone, room, equipment and flow layers; a lightweight procedural 3D view (default on
desktop) adds seasons, day and night and an hourly readout, all driven by the engine (docs/04).*

## 6. Energy Simulation Engine
Estimate consumption from floor area, occupancy, weather, HVAC efficiency, equipment hours, lighting, hot water and rates.

**Total energy = HVAC + lighting + hot water + kitchen + equipment + other loads.** Separate base, occupancy-dependent, weather-dependent and schedule-dependent loads. Guest-room consumption should respond sensibly to occupancy without assuming all hotel energy scales linearly.

Support monthly and annual estimates first; hourly/daily only if feasible. Use documented, realistic synthetic data until real data is available. Label outputs as estimates; avoid invented savings percentages or engineering-grade accuracy claims. Explain why results change.

Suggested functions: `calculateBaselineEnergy()`, `simulateOccupancyChange()`, `simulateHVACSettings()`, `simulateEnergyScenario()`, `calculateUpgradeSavings()`, `optimizeInvestmentPortfolio()`, `calculateFinancialMetrics()`.

## 7. AI Budget Optimizer
Example: **“I operate a 100-room hotel and have $50,000 for energy improvements. Which investments maximize savings over five years?”**

Evaluate smart thermostats, HVAC upgrades, LEDs, occupancy sensors, water heating, insulation, rooftop solar and energy management controls. For each show upfront cost, energy savings, dollar savings, payback, five-year net benefit, estimated emissions impact and comfort implications.

**Decided (financial breakdown).** Every upgrade, solar included, and every package shows the same figures from one calculation: gross installation
cost, applicable incentives (listed with sources, applied only when confirmed; none are invented), net upfront investment, annual energy saved (kWh,
therms), annual money saved, simple payback, five- and ten-year net benefit, and annual CO2 reduction. Solar cost follows system size and regional
pricing; output uses location-specific solar data; savings count self-consumption and export compensation, minus degradation and O&M. The optimizer
and the advisor use exactly these numbers. Method: `docs/13`, section 8.

Use a deterministic calculation/optimization algorithm, not LLM-generated numbers. Enforce budget limits, upgrade interactions, dependencies and comfort constraints. Compare at least three packages: maximum savings, fastest payback and balanced financial/sustainability performance. Show total cost, annual savings, five-year net savings, payback, carbon impact and remaining budget.

## 8. AI Energy Advisor
Answer natural-language questions such as why HVAC is costly, how occupancy changes energy use, whether solar or thermostats should come first, and how to use a $30,000 budget. Ground answers in the current hotel profile and computed scenarios. The LLM should explain and orchestrate simulation functions, **never fabricate quantitative results**.

## 9. Dashboard and UX
Create a polished B2B SaaS experience with:
- **Overview:** annual consumption/cost, category breakdown, estimated emissions and opportunities.
- **Digital twin:** selectable hotel zones and equipment.
- **Scenario simulator:** occupancy, temperature, schedules, rates and before/after charts.
- **Budget optimizer:** ranked packages and financial comparisons.
- **AI advisor:** grounded explanations.

Use professional typography, clear financial metrics, intuitive charts and responsive controls.

**As built (design decisions).**
- **One workspace** on `/`: a left panel with four numbered tabs that follow the demo story (**1 Hotel · 2 Scenario · 3 Invest · 4 Ask**),
  and in the center the digital twin, always visible, under a **cost / energy / carbon strip** showing before → after and the change.
  Moving a control updates the strip and recolors the twin at once.
- **Hotel tab:** preset picker and a short profile summary; the full form opens with "Edit details".
- **Scenario tab:** the most-used controls first (occupancy, setpoints, smart room controls), the rest under "More controls";
  stress tests, "why this changed", comfort notes and saved scenarios.
- **Invest tab:** budget chips ($25k / $50k / $100k), objective, "Optimize for this scenario" (on by itself when a scenario runs), the live
  "testing combinations" counter and three compact package cards; applying one switches the twin to the split before/after view with upgrade
  markers. "Compare in detail" opens `/optimizer`. LV11 adds the full financial breakdown per upgrade.
- **Ask tab:** the advisor chat with suggested questions; each answer is labeled "Explains the computed results" or "Template answer".
- **Report** (`/overview`) and **Sources** in the top bar; a footer disclaimer on every screen.
- **Twin colors** run from the cheapest zone (blue) to the most expensive (red); every zone is labeled; keyboard and screen-reader accessible.
- **Known rough edges:** a "default (estimate)" tag on every number (to become one note), the number strip stacks tall on mobile, and the
  split line crosses the twin's labels (task 7b.7).

**Hotel sidebar layout (November 2026, task 14J).** The Hotel Analysis sidebar (`/hotel`, 380 px beside the twin, width unchanged) is an
action-oriented control center: a first-time user should understand the hotel, see its biggest opportunity and start a simulation in
15–20 s. Nothing was removed; less is shown at first (the Hotel step's initial height went from 2,162 px to 1,076 px at 1440 × 900).
- **Step navigation** (1 Hotel → 2 Scenario → 3 Invest → 4 Ask): numbered steps, the active one in cyan, earlier ones with a cyan outline,
  a thin progress line under the bar. Outside the scroll area on desktop; sticky at the top on tablet and phone (the page scrolls there).
  Each step's purpose is its tooltip. `src/app/HotelDashboard.tsx` (`WorkspaceTabs`).
- **Hotel step, most important first:** (A) **Hotel overview**: name, city · rooms · floor area, annual energy cost today (compact, e.g.
  $120.2K, exact value in the tooltip), energy intensity (kBtu/ft²/yr), both with "How was this calculated?", a data-status label
  (`src/utility/dataStatus.ts`: synthetic estimate, user-entered · modeled, bills provided, calibrated to bills; from `selectUtilityStatus`
  and `selectIsSynthetic`), the preset picker and **Edit** (the full profile form). (B) **Briefing**: concise on load (the template's lead,
  the top finding's title and the next step; an AI briefing shows its first two sentences, which pass the same number check); **View full
  briefing** shows the complete text, its label and method. (C) **Top opportunities**: the top 2 insights in the engine's order, **View
  all N insights** for the rest; each card has a category and impact label (mapping in docs/11 §14J), one figure, one sentence, its action,
  an ⓘ (the rest of the text and the method) and an Ask AI icon. (D) **Hotel health**: energy intensity, "+X% vs ENERGY STAR hotel median"
  (from `benchmarkComparison`), the data status and the caveat "context, not a rating"; **View benchmarks & sources** opens the full
  comparison. (E) **Hotel profile & data**: one live line ("Lakeshore Inn · 100 rooms · Modeled estimate") and **Manage utility data** in the
  header (opens the Utility Data Manager even when closed); open, it shows the profile summary and the utility data section. (F) **Simulate
  this hotel →** opens the Scenario step.
- **Scenario / Invest / Ask:** same capabilities; Scenario puts the impact summary and key controls (occupancy, smart room controls,
  setpoints) in one card, advanced controls under "More controls", "Scenario in detail" at the bottom; Invest is unchanged apart from
  spacing; Ask states its context in one line ("About Lakeshore Inn · Synthetic demo data · explains the model's results") and does not
  repeat the briefing.
- **Look:** one card style (`src/app/sidebar.tsx`), cyan for main actions, key figures and selection, amber only for genuine warnings
  (large stress exposures) and synthetic labels; expanders fade in briefly; animations are off with reduce effects and
  `prefers-reduced-motion`.

## 10. Technical Architecture
Preserve the existing app stack where possible (e.g. React, TypeScript, Tailwind). Recharts is suitable for charts; React Three Fiber is optional if lightweight 3D is achievable. Prefer a deterministic TypeScript engine for instant frontend simulations. If Python simulation code already exists, evaluate reuse before rewriting.

Use an LLM only for interpretation, conversational queries and summaries. Start with a synthetic hotel dataset. Later integrations could include weather, electricity tariffs, benchmarks, equipment databases, utility bill uploads and building-management systems. Do not make external integrations critical to the demo.

## 11. MVP Priorities — 48 Hours
**P0 — Must have:** hotel profile; interactive energy dashboard; occupancy/HVAC simulation; upgrade cost/savings comparison; budget-constrained optimizer; before/after energy and financial metrics.

**P1 — Strong differentiators:** clickable digital twin; grounded AI advisor; saved scenarios; guest comfort constraints; five-year financial projections.

**P2 — Later:** detailed 3D (*a lightweight 3D twin is built*); live IoT; utility-bill calibration; advanced hourly simulations; multi-property optimization; complex tariffs; other building types.

Do not sacrifice working P0 features for P2 polish.

## 12. Three-Minute Hackathon Demo
1. Introduce a hotel owner with rising energy costs and uncertain upgrade choices.
2. Open a synthetic 100-room hotel and show zone-level energy consumption.
3. Change occupancy from 60% to 85%, then enable smart HVAC controls; show the calculated differences.
4. Enter a $50,000 budget and generate upgrade packages, returns and savings.
5. Ask the AI advisor a question that the results answer honestly, explained using actual model outputs. (The original placeholder question,
   "Why recommend smart thermostats over solar?", is not supported by the current estimates; the question is chosen after calibration.)
6. End with before/after energy, cost and estimated carbon impact.

**Core message:** Energy Twin helps hotel owners test energy decisions before spending real money.

## 13. Success Criteria
- Occupancy and HVAC changes produce sensible, explainable results.
- Energy and financial metrics update consistently.
- Optimizer never exceeds budget and accounts for interactions.
- AI explains calculated recommendations.
- Digital twin visually reflects scenarios.
- Users grasp the financial benefit within minutes.
- Demo runs reliably without complex setup.

Do not claim engineering-grade precision, verified carbon savings, guaranteed returns or real-time monitoring unless implemented and validated.

## 14. Instructions for Claude Code
**First inspect the existing codebase. Do not immediately rewrite it.** Inventory reusable components, simulation logic, data models and UI; identify residential-specific code; propose a phased plan, smallest viable changes, assumptions and risks. Ask for approval before major changes.

Implement in this order:
1. Hotel data model and baseline energy simulation.
2. Interactive dashboard and scenario controls.
3. Upgrade cost/savings calculations.
4. Budget optimization.
5. Digital twin visualization.
6. AI advisor and demo polish.

Keep the code modular, test the numerical logic and avoid unnecessary infrastructure.

## 15. Final Positioning
**Name:** Energy Twin  
**Tagline:** Simulate smarter. Spend better. Save energy.

**Pitch:** Energy Twin is an AI-powered operational digital twin that helps hotel owners simulate energy usage, identify inefficiencies, and optimize energy investments before spending a dollar.

**Differentiation:** Unlike tools that design new efficient buildings, Energy Twin helps operators of **existing** buildings model operational decisions and financially evaluate changes.

Its three pillars are **interactive operational simulation**, **budget-constrained investment optimization**, and **AI-powered decision support**. The simulation and optimizer are the technical foundation; the digital twin makes the product understandable and engaging.

**Claude: begin by reviewing the current codebase and proposing exact changes. Preserve working functionality, and present the implementation plan before making major changes.**
