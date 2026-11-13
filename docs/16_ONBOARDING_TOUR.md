# 16 — Onboarding tour (`src/tour/`)

A guided tour for first-time users: hotel operators, general managers, owners and asset managers. It tells the open hotel's own story in
13 short steps (under a minute): what it spends, how efficient it is, where the energy goes, how it changes through the year, what drives
the cost, what could go wrong, what to invest in, what each investment returns over 10 years, how to compare plans, how to ask the advisor, and how to manage several hotels. It points
only at features that are built.

**What makes it stand out:** every card carries a **live figure for the hotel that is open**, computed by the engine and counted up on screen
(labeled "Estimate"); the building **plays a year as a time-lapse** (seasons, day and night), the **energy flow animates**, the welcome and
finish cards are full-screen, the **10-year payoff of each recommended package draws itself as a chart**, and the finish card sums up the hotel's opportunity with a **Find my best investments** button.

## The steps

Portfolio first (November 2026): the tour follows the product's journey, **Portfolio → Identify the opportunity → Explore a hotel → Simulate →
Invest → Report**. Steps 1–4 are on the portfolio homepage (`/`), steps 5–13 on the hotel dashboard (`/hotel`, the hotel that is open).

| # | Step | Page and tab | Highlights | What it says | Live figure (from the engine) |
| --- | --- | --- | --- | --- | --- |
| 1 | **Welcome to Energy Twin** | Portfolio | (full-screen card) | Energy Twin helps hotel operators understand energy costs and find smarter investments: see the savings before you spend. [Chain] is a sample chain with synthetic data. | The portfolio's yearly energy cost; rooms and CO₂ |
| 2 | **Your whole portfolio at a glance** | Portfolio | The portfolio KPI cards | Energy spending, carbon and the savings the best upgrades could bring, across every hotel. Switch organization or filter by brand, region, ownership or city. | Savings potential and the investment it needs |
| 3 | **Compare your hotels on the map** | Portfolio | The city map | Color the hotels by energy cost, efficiency, savings potential or investment priority to see where to focus. | The least efficient hotel (kBtu/ft²) and the most efficient |
| 4 | **Which hotel first?** | Portfolio | The ranked hotel table | Hotels ranked by investment priority: the best 10-year return per dollar invested, not simply the biggest bill. Open any hotel to analyze it. | The top-priority hotel's savings; why the biggest spender ranks lower (only when its score is lower) |
| 5 | **Make it your hotel** | Hotel, Hotel tab | Utility data (or the profile) | Each hotel opens with its profile. Edit the details, or load 12 months of utility bills to calibrate the model to your building. | Energy per ft² and the gap to the ENERGY STAR median |
| 6 | **What deserves your attention** | Hotel, Hotel tab | Opportunities & alerts | Energy Twin reads the results for you: the biggest cost drivers, risks and opportunities, each with a next step. | The first insight's figure and how many there are |
| 7 | **Watch a year go by** | Hotel, Hotel tab | The building (time-lapse playing) | Snow in January, cooling on July afternoons, guests checking in and out: the building and its meter follow every hour of every month. | The costliest month (and the cheapest) |
| 8 | **Test a decision before you make it** | Hotel, **Scenario** tab | The scenario controls | Change occupancy, room temperatures, schedules or energy prices and see the cost, energy and carbon change. Nothing changes in your real hotel. | Cost change if occupancy moves 25 points |
| 9 | **Prepare for the unexpected** | Hotel, Hotel tab | The stress tests | Heat waves, cold snaps, conference surges, worn equipment, price rises: see what each would add to your bill, and how a plan protects you. | The costliest of the 8 shocks and what it adds |
| 10 | **Find the best investments** | Hotel, **Invest** tab | Budget and "Find the best investments" | Enter a budget and Energy Twin tests every combination of upgrades, with installed cost, confirmed incentives and guest comfort counted. | What the best package within the budget saves, its payback, combinations tested |
| 11 | **See each investment's 10-year payoff** | Hotel, Invest tab | The packages (or the Invest panel) | Every package comes with a year-by-year projection: what you pay upfront, what it saves as prices rise, when it pays back and what it is worth after 10 years. | Best 10-year net benefit, **plus a chart of each package's cumulative net benefit, year 0 to 10** |
| 12 | **Compare, decide, share** | Hotel, Invest tab | The report buttons (after a run) or AI plan / Build your own / Compare | Compare the AI plan with your own, read what the numbers mean, and download a PDF report for your owners or finance team. Every figure says how it was calculated. | — |
| 13 | **You're ready to explore!** | Hotel | (full-screen card) | Start from the portfolio, open a hotel, test what could change and find the investments that pay back. Ask the advisor anything in the Ask tab, and replay this tour from the top bar. | Summary: energy spend, what the best package saves, payback. Buttons: **Find my best investments** (opens the hotel's Invest tab and runs the optimizer), **Start exploring** |

Removed from the earlier 15-step version (their features are still in the app): "What you spend, at a glance" (the KPI strip; its figures now
have "How was this calculated?"), "See where the energy goes" (the twin layers), "Follow every dollar" (the energy-flow view, heavy on
software rendering), "Before and after", "Build your own plan and compare" (folded into step 12) and "Ask in plain English" (named in step 13).
Timing measured in a browser: about 33 s on desktop and 18 s on a phone clicking Next after each card appears.

## Behavior

- **First visit:** the tour starts by itself once the main view (or the portfolio page) has loaded, after a short pause. It shows once: finishing
  or skipping is saved in local storage (`energy-twin:tour:v1`, `completed` or `skipped`), and a refresh does not start it again.
- **Replay:** the **Tour** button (help icon) in the top bar restarts it from step 1, on any page.
- **Controls:** Next, Back, Skip tour (or the close button), keyboard → / ← / Escape. Progress shows as dots and "5 of 13".
- **Navigation:** the tour opens the page and workspace tab each step needs, scrolls the highlighted part into view, and when it ends returns
  to the page and tab the user started from.
- **Live figures:** computed when a step opens, for the hotel that is open (the sample, a portfolio hotel, or the user's own), on today's
  baseline. They are read-only engine calls (the optimizer at the hotel's budget, which also gives the 10-year projections, the stress tests, an occupancy change); nothing is stored and
  no plan is created. Cached per hotel, so they are computed once.
- **View changes, restored:** the time-lapse (seasons playback) and the energy-flow layer are view settings only, not hotel data. The tour
  remembers the user's time, playback and layer when it starts and puts them back when it ends. (Once the flow layer is shown it stays until the
  end, so the 3D scene is not rebuilt mid-tour.)
- **Protects the demo:** it changes no hotel setting, scenario, stress test or plan, and blocks clicks on the app while it is open. Tested: the
  hotel input, scenario, plans, time and layer are identical before and after the tour.
- **Find my best investments** (finish card): ends the tour, opens the Invest tab and runs the optimizer, because the user asked for it.
- **Missing parts:** if a highlighted part is not on screen (or a page does not open), that step is skipped in the direction of travel.
- **Placement:** the card goes on the side of the highlighted area with the most room and never covers it; on a phone it docks at the top or
  bottom and the highlight is trimmed to what stays visible. The card appears once the area has stopped moving.
- **Look:** dark navy dimming, a cyan ring with a soft pulse around the highlighted area, rounded cards in the app's colors, a radial glow
  behind the full-screen cards. Animations are short and turned off with reduce effects (figures then appear at once).
- **Accessibility:** the card is a modal dialog with a title and description; focus moves to its main button on each step; figures have a
  text alternative; progress is announced.

## Implementation notes

- Custom-built rather than a library (React Joyride, Driver.js): the steps switch the workspace tabs (local state in a Lovable-owned page),
  move between routes and play twin views, and the tour has to survive a page change. Its state is its own small store (`useTour`).
- Mounted from the top bar (`<TourButton />`, a one-line edit in Lovable's `TopBar`).
- The overlay dims with four plain panels around the highlight and re-measures on scroll, resize and every 150 ms (not every frame), so the
  animations underneath stay smooth.
- Tests: `src/test/tour.test.tsx` (placement never covers the highlight across screen sizes, live figures equal the engine's, the time-lapse
  and flow play and are restored, first visit, replay, Next/Back/Skip/Escape/Finish, the optimizer button, skipping missing parts, the
  portfolio navigation, unchanged state). Checked end to end in a browser at 1440 × 900 and 390 × 844.
- Known: the energy-flow view's moving dots are heavy for software rendering (a browser without a graphics card); on normal hardware they run
  smoothly.

## Routes after the portfolio became the homepage (November 2026)

The hotel steps now point at `/hotel` (the hotel dashboard) and the portfolio step at `/` (the homepage); the first-visit start works on `/`,
`/portfolio` and `/hotel`. The tour therefore starts on the portfolio for a new visitor and moves to the hotel for the hotel steps. The step
content is unchanged here and will be reworked for the portfolio-first journey separately.


## Changes (November 2026, portfolio-first)

- The tour starts on the portfolio homepage and opens the hotel for steps 5–13; "Find my best investments" now opens the hotel's Invest tab
  (`/hotel`), not the homepage.
- First-visit start fixed: the "already tried" mark is set only when the tour really starts, so React's development double run or a remount
  while the page settles no longer prevents the first-visit tour.
- New live figures (`src/tour/insights.ts`): `welcome` (portfolio cost), `portfolio-kpis` (savings potential), `portfolio` (efficiency spread),
  `ranking` (top priority and why the biggest spender is not first, only when its score is lower), `insights` (the first insight).
