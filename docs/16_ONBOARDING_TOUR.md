# 16 — Onboarding tour (`src/tour/`)

A guided tour for first-time users: hotel operators, general managers, owners, asset managers and chain executives. It tells **one story
in 19 short steps** (about 35 s on desktop): what the chain spends, which hotel to start with and how to split one budget, then that hotel:
its building and data, what deserves attention, how it changes through the year, what could go wrong, what to invest in, what each
investment returns, how to compare plans, how to share a report and how to ask the advisor. It points only at features that are built.

**What makes it stand out:** every card carries a **live figure** computed by the engine and counted up on screen (labeled "Estimate"); the
hotel steps **follow the top-priority hotel** the ranking just named; the building **plays a year as a time-lapse**; the **10-year payoff
of each package draws itself as a chart**; the report card lists the **PDF's own sections and the plan's verdict**; the advisor card shows
an **example question and an answer built from the model's numbers**; the finish card sums up the opportunity with **Find my best
investments**.

## The steps

**Two tours (November 2026).** The welcome card offers **Quick tour · 8 steps** (the main button) and **Full tour · 18 steps**; both
start the same way and use the same steps (`tourSteps(mode)` in `src/tour/steps.ts`, `QUICK_TOUR_IDS`). The top bar's Tour button replays
from the welcome card, so either can be chosen again. One story: the portfolio homepage (`/`) first, then the hotel dashboard (`/hotel`) on
the **portfolio's top-priority hotel** (Riverwalk Grand in the sample chain). The app's state is copied when the tour starts and put back
exactly when it ends, so the user's own hotel, what-if and plans are unchanged (**Find my best investments** keeps the shown hotel, because
the user asked to act on it).

| # (full) | Quick | Step | Page and tab | Highlights | Live figure or card content (from the engine) |
| --- | --- | --- | --- | --- | --- |
| 1 | 1 | **Welcome to Energy Twin** | Portfolio | (full-screen card) | The chain's yearly energy cost; rooms and CO₂. Buttons: Quick tour, Full tour, Skip |
| 2 | | **Your whole portfolio at a glance** | Portfolio | The KPI cards | Savings potential and the investment it needs |
| 3 | 2 | **Start with the top opportunity** | Portfolio | The top-opportunity card (else the ranked table) | The top hotel's savings and score; why the biggest spender ranks lower |
| 4 | 3 | **Your chain as a living city map** | Portfolio | The 3D city map | The least and most efficient hotels (kBtu/ft²) |
| 5 | | **Split one budget across the chain** | Portfolio | Plan your portfolio investments | Savings from splitting the page's budget (portfolio optimizer, read-only); hotels funded; payback |
| 6 | 4 | **Open the hotel to start with** | Hotel (top priority), Hotel tab | The twin's header | Its yearly cost; priority, rooms, city |
| 7 | | **What deserves your attention** | Hotel tab | The briefing and Top opportunities | The first insight's figure and how many there are |
| 8 | | **See where the energy goes** | Hotel tab | The twin, Zones | The costliest zone |
| 9 | | **Watch a year go by** | Hotel tab | The building (time-lapse playing) | The costliest month and the cheapest |
| 10 | | **Follow the money, the energy and the carbon** | Hotel tab | The twin, Flow | Natural gas's share of the carbon vs its share of the bill (e.g. 19% of the bill, 31% of the carbon) |
| 11 | | **Make it your hotel** | Hotel tab | The twin, Equipment | — (equipment, details and 12 months of bills; corrections never count as savings) |
| 12 | 5 | **Test a decision before you make it** | **Scenario** tab | The scenario controls | Cost change if occupancy moves 25 points |
| 13 | | **Prepare for the unexpected** | Scenario tab (stays) | The stress tests | The costliest of the 8 shocks |
| 14 | 6 | **Find the best investments** | **Invest** tab | Budget and the run button | What the best package within the budget saves; payback; combinations tested |
| 15 | | **See each investment's 10-year payoff** | Invest tab | The packages | Best 10-year net benefit plus a chart of each package's cumulative net benefit |
| 16 | | **Build your own plan, then share it** | Invest tab | The mode tabs and report buttons (the tabs alone when both do not fit, on a phone) | The PDF's sections and the best package's verdict |
| 17 | 7 | **Ask in plain English** | **Ask** tab | The advisor | **"What if occupancy rises to 85%?"** answered by the engine's what-if tool (the one the AI calls), with an Apply button shown; nothing is sent or applied |
| 18 | 8 | **You're ready to explore!** | Hotel | (full-screen card) | Energy spend, what the best package saves, payback. Buttons: **Find my best investments**, **Start exploring** |

Changes from the 19-step tour: "Which hotel first?" now points at the top-opportunity card and comes before the map; "Make it your hotel"
(details and bills) merged into the equipment step and moved after the building views; the briefing joined "What deserves your attention";
a carbon step was added on the Flow view; the stress-test step stays on the Scenario tab (no more Hotel → Scenario → Hotel jump);
"Build your own plan and compare" merged into the report step; the advisor step shows a tool-computed what-if instead of a template answer.

Checked in a browser (November 2026, desktop 1440 × 900 and iPhone 13): both tours reach every step with its highlight (none skipped),
no page errors (the only console error is the advisor function, unreachable from the test machine).

## Behavior

- **Every page load (demo setting):** the tour starts by itself once the main view (or the portfolio page) has loaded, after a short pause,
  on every page load, for every visitor, even if it was finished or skipped before (so everyone at the booth sees it first). It starts once per
  load: moving between pages does not restart it. Finishing or skipping is still saved in local storage (`energy-twin:tour:v2`, `completed` or
  `skipped`) but no longer stops the next start. Add `?tour=off` to the link to open without it (for a presenter's run).
- **Replay:** the **Tour** button (help icon) in the top bar restarts it from step 1, on any page.
- **Controls:** Next, Back, Skip tour (or the close button), keyboard → / ← / Escape. Progress shows as dots and "5 of 19".
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
