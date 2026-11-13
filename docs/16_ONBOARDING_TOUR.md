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

**One story (November 2026, 19 steps):** steps 1–5 on the portfolio homepage (`/`); steps 6–19 on the hotel dashboard (`/hotel`), on the
**portfolio's top-priority hotel** (the one step 4 names; Riverwalk Grand in the sample chain). The app's state is copied when the tour
starts and put back exactly when it ends, so the user's own hotel, what-if and plans are unchanged (**Find my best investments** keeps the
shown hotel, because the user asked to act on it).

| # | Step | Page and tab | Highlights | Live figure or card content (from the engine) |
| --- | --- | --- | --- | --- |
| 1 | **Welcome to Energy Twin** | Portfolio | (full-screen card) | The chain's yearly energy cost; rooms and CO₂ |
| 2 | **Your whole portfolio at a glance** | Portfolio | The KPI cards | Savings potential and the investment it needs |
| 3 | **Compare your hotels on the map** | Portfolio | The city map | The least efficient hotel (kBtu/ft²) and the most efficient |
| 4 | **Which hotel first?** | Portfolio | The ranked table | The top-priority hotel's savings; why the biggest spender ranks lower (only when its score is lower) |
| 5 | **Split one budget across the chain** | Portfolio | Portfolio investments | Savings from splitting the page's budget across the hotels (the portfolio optimizer, read-only); hotels funded; payback |
| 6 | **Open the hotel to start with** | Hotel (top priority), Hotel tab | The twin's header | Its yearly cost; its priority score, rooms and city |
| 7 | **Make it your hotel** | Hotel tab | Utility data | Energy per ft² and the gap to the ENERGY STAR median |
| 8 | **What deserves your attention** | Hotel tab | Opportunities & alerts | The first insight's figure and how many there are |
| 9 | **See where the energy goes** | Hotel tab | The twin, Zones | The costliest zone |
| 10 | **Watch a year go by** | Hotel tab | The building (time-lapse playing) | The costliest month and the cheapest |
| 11 | **The equipment you actually have** | Hotel tab | The twin, Equipment | — (corrections change the baseline, never counted as savings) |
| 12 | **Test a decision before you make it** | **Scenario** tab | The scenario controls | Cost change if occupancy moves 25 points |
| 13 | **Prepare for the unexpected** | Hotel tab | The stress tests | The costliest of the 8 shocks |
| 14 | **Find the best investments** | **Invest** tab | Budget and "Find the best investments" | What the best package within the hotel's budget saves; payback; combinations tested |
| 15 | **See each investment's 10-year payoff** | Invest tab | The packages (or the panel) | Best 10-year net benefit **plus a chart of each package's cumulative net benefit** |
| 16 | **Build your own plan and compare** | Invest tab | AI recommended / Build your own / Compare | — |
| 17 | **Share it as a report** | Invest tab | The report buttons (after a run) or the mode tabs | **The PDF's sections** (executive summary … risks and limitations) and the best package's one-line verdict |
| 18 | **Ask in plain English** | **Ask** tab | The advisor | **An example question and the answer built from the model's numbers** (the template answer: the top choice, then why solar is or is not in it); nothing is sent |
| 19 | **You're ready to explore!** | Hotel | (full-screen card) | Energy spend, what the best package saves, payback. Buttons: **Find my best investments**, **Start exploring** |

Measured in a browser (first visit to the finish card, clicking Next as each card appears): about 36 s on desktop (1440 × 900) and 25 s on
a phone (390 × 844), no console errors. The twin goes Zones → time-lapse → Equipment and keeps the Equipment view for the remaining steps (switching
back to the 3D zones view would rebuild the scene); the user's own view comes back at the end.

**Sidebar redesign (November 2026, docs/10 "Hotel sidebar layout").** The steps and their wording are unchanged. Step 7 highlights the
utility data section when it is open, otherwise the "Hotel profile & data" section (`[data-testid="profile-data"]`, collapsed by default),
then the workspace panel. Step 8 still highlights `[data-testid="energy-insights"]` (now titled "Top opportunities", showing the top 2).
The tab names the tour reads ("1Hotel" → "Hotel") are unchanged.

Step 18 is unchanged by the AI assistant (Phase 15, `docs/23`): it still shows the template answer computed in the browser and sends nothing.
The live Ask tab now also shows the engine's result cards, action buttons and follow-up questions under an answer. The Hotel tab opens with a
three-sentence briefing above Opportunities & alerts; step 8 still points at the insights.

## Behavior

- **First visit:** the tour starts by itself once the main view (or the portfolio page) has loaded, after a short pause. It shows once: finishing
  or skipping is saved in local storage (`energy-twin:tour:v2 (v1 before the 19-step tour; the new key shows it once to browsers that saw the earlier tour)`, `completed` or `skipped`), and a refresh does not start it again.
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
