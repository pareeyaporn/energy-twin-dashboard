# 16 — Onboarding tour (`src/tour/`)

A guided tour for first-time users: hotel operators, general managers, owners and asset managers. It tells the open hotel's own story in
15 short steps (about a minute): what it spends, how efficient it is, where the energy goes, how it changes through the year, what drives
the cost, what could go wrong, what to invest in, what each investment returns over 10 years, how to compare plans, how to ask the advisor, and how to manage several hotels. It points
only at features that are built.

**What makes it stand out:** every card carries a **live figure for the hotel that is open**, computed by the engine and counted up on screen
(labeled "Estimate"); the building **plays a year as a time-lapse** (seasons, day and night), the **energy flow animates**, the welcome and
finish cards are full-screen, the **10-year payoff of each recommended package draws itself as a chart**, and the finish card sums up the hotel's opportunity with a **Find my best investments** button.

## The steps

| # | Step | Page and tab | Highlights | What it says | Live figure (from the engine) |
| --- | --- | --- | --- | --- | --- |
| 1 | **Meet your hotel's digital twin** | Main page, Hotel tab | (full-screen card) | Energy Twin shows where your energy money goes, lets you test changes before you make them, and finds the upgrades that pay back. This is [hotel], a sample hotel with synthetic data (or: built from your inputs). | Yearly energy cost; per room and CO₂ |
| 2 | **Make it your hotel** | Main page, Hotel tab | The hotel profile and peer comparison | Change rooms, systems, occupancy or bills under Edit details, or add your own hotels with Add my hotel on the Portfolio page. Every number recalculates for your building. | Energy per ft² and the gap to the ENERGY STAR hotel median |
| 3 | **What you spend, at a glance** | Main page, Hotel tab | Cost, energy and carbon tiles | Yearly energy cost, energy use and carbon, all modeled from the building, its systems, occupancy, local weather and prices. | Share of the bill of the largest use (for example heating, cooling and ventilation) |
| 4 | **See where the energy goes** | Main page, Hotel tab | The twin and its Zones / Rooms / Equipment / Flow views | Explore the hotel by zone, room by room, system by system or as an energy flow. Colors show where the money goes. | The costliest zone and its yearly cost |
| 5 | **Watch a year go by** | Main page, Hotel tab | The building (time-lapse playing) | Snow in January, cooling on July afternoons, guests checking in and out: the building and its meter follow every hour of every month. | The costliest month (and the cheapest) |
| 6 | **Follow every dollar** | Main page, Hotel tab | The energy-flow diagram (animated) | From the electricity and gas meters to the systems that use them, zone by zone, hour by hour. | Electricity's share of the bill; the gas cost |
| 7 | **Before and after, on the building** | Main page, Hotel tab | Before / After / Split and the cost | Apply any investment package, then switch between Before, After and Split to see the change on the building and in every number. | — |
| 8 | **Test a decision before you make it** | Main page, **Scenario** tab | The scenario controls | Change occupancy, room temperatures, schedules or energy prices and watch the cost move. Nothing changes in your real hotel. | Cost change if occupancy moves 25 points |
| 9 | **Prepare for the unexpected** | Main page, Hotel tab | The stress tests | Heat waves, cold snaps, conference surges, worn equipment, price rises: see what each would add to your bill, and how a plan protects you. | The costliest of the 8 shocks and what it adds |
| 10 | **Find the best investments** | Main page, **Invest** tab | Budget and "Find the best investments" | Enter a budget and Energy Twin tests every combination of upgrades, with installed cost, utility incentives and guest comfort counted. | What the best package within the hotel's budget saves, its payback, combinations tested |
| 11 | **See each investment's 10-year payoff** | Main page, Invest tab | The investment packages (or the Invest panel if none has been run yet) | Every package comes with a year-by-year projection: what you pay upfront after confirmed incentives, what it saves each year as prices rise, when it pays back and what it is worth after 10 years, with a low-to-high range and a discounted view. | The best 10-year net benefit among the recommended packages, its upfront cost and payback, **plus a chart drawing each package's cumulative net benefit from year 0 to year 10** (each line crosses $0 at payback) |
| 12 | **Build your own plan and compare** | Main page, Invest tab | AI recommended / Build your own / Compare | Pick upgrades yourself, then put your plan next to the recommendation: upfront cost, savings, payback, 10-year value and carbon. | — |
| 13 | **Ask in plain English** | Main page, **Ask** tab | The advisor | Ask why heating costs so much or how to spend your budget. The AI explains the model's results, and every number it quotes is checked against them. | — |
| 14 | **One view for the whole chain** | **Portfolio** page | The city map | Every hotel on the map, colored by cost, efficiency or savings potential. Find the ones to fix first, split one budget across all of them, and stress-test the chain. | The chain's savings potential; the top-priority hotel |
| 15 | **You're ready to explore!** | Main page | (full-screen card) | See where your hotel spends energy, test what could change, and discover investments that lower your operating costs. Replay this tour any time from the top bar. | Summary: energy spend, what the best package saves, payback. Buttons: **Find my best investments**, **Start exploring** |

The wording lives in `src/tour/steps.ts` and the figures in `src/tour/insights.ts`; change them there and update this table.

## Behavior

- **First visit:** the tour starts by itself once the main view (or the portfolio page) has loaded, after a short pause. It shows once: finishing
  or skipping is saved in local storage (`energy-twin:tour:v1`, `completed` or `skipped`), and a refresh does not start it again.
- **Replay:** the **Tour** button (help icon) in the top bar restarts it from step 1, on any page.
- **Controls:** Next, Back, Skip tour (or the close button), keyboard → / ← / Escape. Progress shows as dots and "5 of 15".
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
