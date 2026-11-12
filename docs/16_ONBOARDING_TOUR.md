# 16 — Onboarding tour (`src/tour/`)

A guided tour for first-time users: hotel operators, general managers, owners and asset managers. It tells a business story in ten short
steps (about 40 seconds): what the hotel spends, where the energy goes, what drives the cost, what could go wrong, what to invest in, how to
compare plans, and how to manage several hotels. It points only at features that are built.

## The steps

| # | Step | Page and tab | Highlights | What it says |
| --- | --- | --- | --- | --- |
| 1 | **Welcome to Energy Twin** | Main page, Hotel tab | (centered card) | A digital twin of your hotel: see where your energy money goes, test changes before you make them, and find the upgrades that pay back. You are looking at Lakeshore Inn, a 100-room sample hotel with synthetic data. |
| 2 | **What you spend on energy** | Main page, Hotel tab | The cost, energy and carbon tiles | Your yearly energy cost, energy use and carbon at a glance. Every figure is an estimate built from the hotel's size, systems, occupancy, Chicago weather and local prices. |
| 3 | **See where the energy goes** | Main page, Hotel tab | The twin's header and its Zones / Rooms / Equipment / Flow views | Explore the hotel by zone, room, equipment or energy flow; colors show which areas cost the most. Press play below the building to watch a day or the seasons go by. |
| 4 | **Test what drives your costs** | Main page, **Scenario** tab | The scenario controls | Change occupancy, room temperatures, schedules or energy prices and see the cost move, before you touch a single thermostat. Nothing changes in your real hotel. |
| 5 | **Prepare for the unexpected** | Main page, Hotel tab | The twin's stress tests | Try a heat wave, a cold snap, a conference surge, worn equipment or a 20% price rise, and see what it would add to your bill. |
| 6 | **Find the best investments** | Main page, **Invest** tab | The budget and "Find the best investments" | Enter a budget and Energy Twin tests every combination of upgrades to find the best packages, with installed cost, utility incentives and guest comfort taken into account. |
| 7 | **Build your own plan and compare** | Main page, Invest tab | AI recommended / Build your own / Compare | Pick upgrades yourself, then put your plan next to the recommendation: upfront cost, yearly savings, payback, 10-year value and carbon, side by side. |
| 8 | **Run several hotels? Start here** | **Portfolio** page | The city map | See every hotel in the chain on a map, colored by cost, efficiency or savings potential. Find the ones to fix first, open any of them in its own twin, and split one budget across all of them. |
| 9 | **Invest where it counts most** | Portfolio page | Portfolio investments | Energy Twin picks the package for each hotel that does the most good within one budget, and you can compare it with a plan of your own or stress-test the whole chain. |
| 10 | **You're ready to explore!** | Main page | (centered card) | See where your hotel spends energy, test what could change, and discover investments that can lower your operating costs. Questions? Ask the advisor in the Ask tab. You can replay this tour from the top bar. **Start exploring** |

The wording lives in `src/tour/steps.ts`; change it there and update this table.

## Behavior

- **First visit:** the tour starts by itself once the main view (or the portfolio page) has loaded, after a short pause. It shows once: finishing
  or skipping is saved in local storage (`energy-twin:tour:v1`, value `completed` or `skipped`), and a refresh does not start it again.
- **Replay:** the **Tour** button (help icon) in the top bar restarts it from step 1, on any page.
- **Controls:** Next, Back, Skip tour (or the close button), and **Start exploring** on the last step. Keyboard: → next, ← back, Escape skips.
  Progress shows as dots and "3 of 10".
- **Navigation:** the tour opens the page and workspace tab each step needs, scrolls the highlighted part into view, and when it ends returns
  to the page and tab the user started from.
- **Missing parts:** if a highlighted part is not on screen (or a page does not open), that step is skipped in the direction of travel; the
  tour never stalls.
- **Protects the demo:** it only points at the interface. It changes no hotel setting, scenario, stress test or plan, runs no simulation, and
  blocks clicks on the app while it is open, so nothing can change by accident. (Tested: the hotel input, scenario, plans and twin view are
  identical before and after the tour.)
- **Placement:** the card goes on the side of the highlighted area with the most room and never covers it; on a phone, when no side fits, it
  docks at the top or bottom and the spotlight is trimmed to what stays visible. The card appears once the area has stopped moving.
- **Look:** dark navy dimming, a cyan ring and glow around the highlighted area, rounded card in the app's colors; transitions are short and
  turned off with reduce effects.
- **Accessibility:** the card is a modal dialog with a title and description, focus moves to its main button on each step, and the progress is
  announced.

## Implementation notes

- Custom-built rather than a library (React Joyride, Driver.js): the steps must switch the workspace tabs (local state in a Lovable-owned page)
  and move between routes, and the tour has to survive a page change. Its state is a small store of its own (`useTour`), not the app's store.
- Mounted from the top bar (`<TourButton />`, a one-line edit in Lovable's `TopBar`), so every page with the top bar has it.
- Workspace tabs are opened the way a click would (`openWorkspaceTab`); the twin's own layer, view and investment-mode tabs are only highlighted.
- Tests: `src/test/tour.test.tsx` (placement never covers the highlight, first visit, replay, Next/Back/Skip/Escape/Finish, skipping missing
  parts, the portfolio navigation, unchanged state). Checked end to end in a browser at 1440 × 900 and 390 × 844.
