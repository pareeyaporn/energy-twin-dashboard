# 22 — Pitch: why Energy Twin is a wow, and the questions judges will ask

For the pitch owner, the slides and Q&A. Every figure below is the app's own output for the **synthetic** demo data (November 2026,
`DEMO_FIGURES=1 npx vitest run src/test/demoScript.test.ts` prints them; re-run before the demo). Say "estimate" and "synthetic" out loud
when quoting them. Where an answer needs a fact we do not have (market size, pricing), it says so: fill it in with a sourced figure or leave it
out, never improvise a number.

---

**Energy Twin: Simulate Smarter. Spend Better. Save Energy.**

What if hotel owners could see the impact of energy upgrades before spending a dollar? Energy Twin turns existing hotels into AI-powered
virtual testing grounds. Operators can visualize energy flows, simulate changing conditions, and stress-test decisions across one property
or an entire portfolio. Our optimizer finds the best upgrade combinations within a budget, revealing projected savings, payback, and carbon
impact. **Stop guessing. Start simulating. Invest with confidence.**

---

## Part 1 — Why this is a cool project

### The one-liner

**"See the savings before you spend."** Energy Twin turns an existing hotel into a virtual testing ground: see where the energy money goes,
test decisions before you make them, and get the upgrades that pay back best for your budget, with a report you can take to the owner.

### The problem in one breath

Hotels run 24/7, occupancy swings the bill, and most owners and general managers have no energy team. Every vendor says their product is the
answer (solar, smart thermostats, LEDs). Nobody shows them, for *their* building and *their* budget, which one actually pays back, and by how
much, before they spend.

### Seven wow moments (in demo order)

1. **"Start here."** The portfolio page answers the chain executive's first question in one line: which hotel to invest in first, and why.
   It is **not** the biggest bill: Lakefront Convention Hotel spends the most ($591,679 a year), but Riverwalk Grand returns more per dollar
   (priority 100 of 100). That is a real insight, computed, not a ranking by size.
2. **A living building.** The 3D twin plays a year: snow in January, cooling on July afternoons, guests checking in and out, lit windows that
   are the rooms with guests in them. Every glow and number is the simulation (a January night needs about 80 kW of heating, a July afternoon
   102 kW of cooling), not decoration.
3. **Decisions before you make them.** Occupancy from 60% to 85% (a conference season) adds $12,869 a year, not 42% more: base loads run
   whether rooms are full or not. Smart room controls then claw back only $1,014, because at 85% few rooms are empty. That is the kind of
   counter-intuitive answer an operator needs before buying.
4. **The optimizer tests every combination.** 256 combinations of upgrades on that scenario, 10 fit the $50,000 budget and the comfort limit.
   The best: LED lighting plus occupancy sensors, $38,940 installed, saving $10,302 a year, paying back in 3.8 years, $73,209 net over 10
   years, 27 t of CO₂ a year. Solar on the full roof costs $159,500 and takes 18.5 years here, so it is **not** recommended, and the app says
   why.
5. **Honest money.** ComEd's 2025 lighting incentive would cut the net cost to $24,184 (2.3-year payback), but the 2026 rate is not
   confirmed, so it is shown **separately as illustrative** and never counted. The app refuses to make a plan look better than the evidence
   allows. Plans that do not pay back are called "not financially attractive".
6. **Your real bills, your real building.** Upload 12 months of utility bills (or edit the sample spreadsheet live) and the model calibrates to
   them, electricity and gas separately, with ASHRAE Guideline 14 fit metrics (NMBE, CV(RMSE)). Correct the equipment you actually have
   (a 95% boiler instead of the 80% assumed) and the baseline follows, never counted as a saving.
7. **A report you can take to the owner.** One click on Reports: a multi-page PDF with the recommendation, before and after, the investment,
   the 10-year cash flow, every assumption, the sources and the risks, labeled as estimates.

### Why it is different

| Others | Energy Twin |
| --- | --- |
| Benchmarking (ENERGY STAR Portfolio Manager) tells you how you did last year | Simulates what happens **next** and ranks what to buy within a budget |
| Net-zero design tools (for example Eden) design **new** homes | Works on **existing** commercial buildings, operations **and** investments |
| Vendor calculators sell one product | Compares every upgrade and combination on the same assumptions, and says when the answer is "don't" |
| Generic AI chatbots invent numbers | The engine computes every number; the AI only explains, and the app **rejects** any answer with a number not in the results |

### What makes it credible (say this; judges reward it)

- **Every number is sourced or labeled.** EIA prices, NOAA weather normals, NREL ComStock hotel energy, EPA eGRID grid emissions, NREL
  PVWatts solar, the Illinois technical reference manual for upgrade savings, ComEd's own incentive worksheets. Each figure has a "How was
  this calculated?" with its inputs labeled: published source, your input, modeled estimate, synthetic, assumption.
- **No invented precision.** Ranges (low to high) where they are defensible; no confidence scores; "estimates, not an engineering audit"
  everywhere.
- **Validated where it can be.** Smart room controls savings sit inside the Illinois rulebook's deemed range for a Chicago hotel; whole-hotel
  and lighting savings agree with published hotel case studies (docs/14).
- **Built to be checked.** 552 automated tests; a test fails if any figure in the demo script stops matching the engine.

### Built in 48 hours

Lovable for the interface, Claude Code for the engine, data, 3D twin, optimizer, reports and tests, synced through GitHub. Sourced data for four
cities, a deterministic simulation (same input, same output), an exact optimizer, a 3D digital twin, a portfolio map across four cities,
a utility-bill calibration, an editable equipment inventory, a PDF report, an AI advisor with number checking and a 19-step guided tour.

### The 20-second close

"Hotels make investment decisions on vendor promises. Energy Twin lets them see the savings before they spend: for one building or a whole
chain, with honest numbers, their own bills, and a report they can take to the owner. Simulate smarter. Spend better. Save energy."

---

## Part 2 — Questions judges will ask (and short answers)

Owner column: **P** = pitch lead, **E** = engine lead, **T** = tech lead. Keep answers under 20 seconds; offer to show it in the app.

### The product and the user

| # | Question | Owner | Answer |
| --- | --- | --- | --- |
| 1 | Who is the user? | P | Hotel general managers and chief engineers for one building; owners, asset managers and chain executives for the portfolio. The homepage is the portfolio; one click opens a hotel. |
| 2 | Why hotels first? | P | They run 24/7, occupancy swings the bill, they are numerous and similar enough to model, and most have no energy team. The engine is built for commercial buildings; hotels are the first type. |
| 3 | What does the operator actually do with it? | P | Find where the money goes, test a change (occupancy, temperatures, schedules, prices, a heat wave), pick upgrades for a budget, and download a report for the owner or the bank. |
| 4 | Isn't this just a dashboard? | P | No: a dashboard shows last month. This simulates what happens if you change something and optimizes what to buy. Show the occupancy what-if and the optimizer. |
| 5 | How is this different from ENERGY STAR Portfolio Manager? | P | Portfolio Manager benchmarks past performance. We simulate the future and rank investments within a budget; we use ENERGY STAR's hotel median only as a comparison. |
| 6 | How is it different from Eden (or other winners)? | P | Eden designs new net-zero homes for architects. We work on existing commercial buildings, their day-to-day operations and their investments. |
| 7 | Does it work for a chain? | P | Yes: the portfolio page totals every hotel, ranks them by return per dollar, and splits one budget across them (the portfolio optimizer). Show "Start here" and "Split one budget". |

### Accuracy and data

| # | Question | Owner | Answer |
| --- | --- | --- | --- |
| 8 | How accurate is it? | E | Planning-grade estimates from published data, shown as ranges and labeled; not an engineering audit. With 12 months of bills it calibrates to them and reports the fit with ASHRAE Guideline 14 metrics. |
| 9 | Is the data real? | E | The hotels are synthetic demonstration properties (labeled everywhere). The inputs are real and sourced: EIA prices, NOAA weather, NREL ComStock, EPA eGRID, PVWatts, the Illinois TRM, ComEd worksheets. Every figure has "How was this calculated?". |
| 10 | Have you validated it? | E | Against published hotel case studies (whole-hotel and lighting savings agree) and the Illinois rulebook's deemed savings for guest-room controls (inside its range). Field studies in milder climates report more for that measure; we report it rather than tune it (docs/14). |
| 11 | What if my building is different from your defaults? | E | Edit the profile, correct the equipment (boiler efficiency, chiller, LED share, existing solar), and upload your bills. The baseline follows; corrections are never counted as savings. |
| 12 | Why is the hotel's intensity 37% above the ENERGY STAR median? | E | Chicago's cold climate and a restaurant raise it; the median is national. It is context, not a rating. |
| 13 | Which cities do you support? | E | Chicago, New York, Miami and Denver with sourced weather, prices and grid data. Savings parameters still come from the Illinois rulebook, and incentives only apply in ComEd's territory. |
| 14 | Do you model demand charges or time-of-use tariffs? | E | Not yet: all-in average prices from EIA. Tariffs are on the roadmap. |

### The money

| # | Question | Owner | Answer |
| --- | --- | --- | --- |
| 15 | Why isn't solar recommended? | E | For this hotel the full roof costs $159,500 and pays back in about 18.5 years; the optimizer finds better uses of $50,000. It says so instead of hiding it. Show "Compare all upgrades". |
| 16 | Are incentives included? | E | Only confirmed ones for the analysis year (2026): ComEd's guest-room controls incentive counts. ComEd's 2025 lighting rate is shown separately as illustrative until the 2026 rate is confirmed. Funds are limited and never guaranteed. |
| 17 | What discount rate do you use? | E | 8% by default for commercial investments (a team choice, editable; 3% as an alternative). Energy prices grow with the EIA Annual Energy Outlook 2026. Every payback, NPV and net benefit recalculates. |
| 18 | Why is LED + sensors the best package? | E | It saves $10,302 a year for $38,940 on the 85% scenario: lighting runs 24/7 in a hotel and sensors cut corridor and lobby hours. The comparison shows every upgrade on the same assumptions. |
| 19 | Do upgrades double-count savings? | E | No. Upgrades are applied in sequence in one simulation (LED lighting adds a little heating, for example), so the package saving is the real combined effect, and the per-upgrade contributions add up to it. |
| 20 | What if a plan is a bad investment? | E | The app says "not financially attractive" when it never pays back, pays back after the equipment wears out, or has a negative 10-year NPV. We never present every plan as a good one. |

### The AI

| # | Question | Owner | Answer |
| --- | --- | --- | --- |
| 21 | Where is the AI? | T | Two places: the advisor explains the results in plain English, and the engine's optimizer does the deciding (an exact search, not a language model). The AI never produces a number. |
| 22 | Can the AI hallucinate a saving? | T | The app checks every number in the answer against the computed results and rejects the answer if one does not match, falling back to a template answer built from the model's numbers. Show the advisor. |
| 23 | Which model, and what does it cost to run? | T | Claude, called from a backend function; one short call per question, cached for repeated questions. The engine runs in the browser, so simulations and the optimizer cost nothing per use. |
| 24 | Why not let the AI do the optimization? | T | Money decisions need reproducible, auditable numbers. A deterministic engine gives the same answer every time and can be tested (552 tests); the AI is best at explaining it. |

### Technical

| # | Question | Owner | Answer |
| --- | --- | --- | --- |
| 25 | How does the simulation work? | E | Benchmark energy by climate (NREL ComStock) split by zone, end use and month, driven by occupancy, weather (NOAA normals), schedules and setpoints; upgrades rescale the affected loads. Equations in docs/13. |
| 26 | How does the optimizer work? | E | It tests every combination of eligible upgrades for the hotel (256 on the demo scenario) against the budget and a comfort limit, and ranks them by your objective. For a chain, an exact search splits one budget across hotels. |
| 27 | Is the 3D twin real data or decoration? | T | Every color, glowing window and readout comes from the simulation for that hour; scenery (trees, cars) is visual only. It falls back to 2D on weak hardware. |
| 28 | Does it work offline / on a phone? | T | The engine runs in the browser, so everything except a live AI answer works offline after loading; saved answers replay. Layouts work on phones. |
| 29 | Where is my data stored? | T | In this version, in the browser only (utility bills, equipment, plans); nothing is sent to our servers or to the AI. Accounts and a database are on the roadmap. |
| 30 | How did you build it in 48 hours? | T | Lovable for the interface, Claude Code for the engine, data, 3D twin and tests, synced through GitHub with short branches and pull requests. |

### Business and next steps

| # | Question | Owner | Answer |
| --- | --- | --- | --- |
| 31 | Who pays? | P | Team decision: fill in (for example a per-property subscription for owners and chains, or a tool for energy consultants and utilities). Do not quote prices we have not set. |
| 32 | How big is the market? | P | Fill in with a sourced figure (number of US hotels and their energy spend, from a named source), or skip; never estimate on stage. |
| 33 | What's next? | P | Real buildings with real bills, tariffs and demand charges, accounts and roles, more cities with local incentives, then other building types (resorts, convention centers, offices). |
| 34 | Could a utility use this? | P | Yes: it already applies a utility's own incentive rules by program year and territory; a utility could use it to target customers and explain programs. |
| 35 | What's the biggest weakness? | E | Honest answer: savings parameters come from the Illinois rulebook for every city, some installed costs are still assumptions, and bills are compared with normal-year weather. Each is labeled in the app and listed in docs/08 and docs/13. |

### Tough or skeptical questions

| # | Question | Owner | Answer |
| --- | --- | --- | --- |
| 36 | Why should I trust your numbers over a vendor's? | E | Because we show the work: every input, source and assumption, the same assumptions for every option, and we say when the answer is "don't buy it". |
| 37 | Your smart thermostat savings look low. | E | They match Illinois' deemed savings for a Chicago hotel. Field studies elsewhere report more, mainly in milder climates and against guests leaving units at extreme settings. We report it rather than tune it. |
| 38 | Isn't a 3.8-year payback too good to be true? | E | It is an estimate for a synthetic hotel, from published lighting savings and costs; real quotes and an audit come next. With the 2025 lighting incentive it would be 2.3 years, which we deliberately do not count. |
| 39 | What happens with a building you can't model? | E | The app labels what it does not know: unsupported equipment is informational, unknown replacements say "needs more information", and building types we do not simulate are not offered. |
| 40 | What did you cut? | P | Accounts, tariffs, weather-normalized bills and more building types. We chose depth and honesty over breadth. |

---

## Part 3 — Lines to have ready

- "Every number on this screen comes from the engine. The AI explains them; it can't invent them."
- "It's not the biggest bill that should get the money first; it's the best return per dollar."
- "We'd rather tell you not to buy solar than sell you an 18-year payback."
- "This is synthetic data with real sources. Give it your bills and it calibrates to your building."
- "See the savings before you spend."

---

## Part 4 — The five judging criteria, answered

For each: the claim, the evidence we can show, where it is in the demo, and the gap to close before judging. Figures are the app's output
for synthetic data unless a source is named.

### 1. User, problem and value

- **User:** the general manager and chief engineer of an existing hotel (one building), and the owner, asset manager or chain executive who
  decides where capital goes (the portfolio).
- **Problem:** energy is a large, controllable operating cost that hotels decide on with vendor promises. They run 24/7, occupancy swings the
  bill, and most have no energy team, so they cannot tell which upgrade pays back for *their* building and budget before spending.
- **Value:** see where the money goes, test a decision before making it, and get the best upgrades for a budget with costs, savings ranges,
  payback, NPV and carbon, plus a report to take to the owner. Example: at $50,000 the app recommends LED lighting + occupancy sensors
  ($38,940, $10,302 a year, 3.8-year payback) and says no to solar (18.5 years).
- **Tied to the prompt** (Open Track: "Build something that improves how people live, work or connect"): it improves how people **work**.
  Hotel general managers, engineers and owners make six-figure energy decisions from vendor pitches and spreadsheets; Energy Twin turns that
  into minutes of evidence: test the decision, see the payback, take a report to the owner. It also touches how people **live**: guest comfort
  is a constraint in every plan, and every plan shows the carbon it avoids. Built in Lovable, with real public datasets (EIA, NOAA, NREL, EPA)
  and supplemental code, as the prompt allows.
- **In the demo:** act 1 (the problem and the $120,178 bill), "Start here", the optimizer.

### 2. Evidence and opportunity

- **Energy is a big, specific cost in hotels (sourced):** US lodging used 598 trillion Btu in 2018 (EIA CBECS 2018, Table E1). ENERGY STAR's
  hotel guidance: lighting is almost a quarter of a hotel's electricity; heating and cooling almost 40% of the electricity and more than half
  of the gas.
- **Savings are real and documented (published hotel cases, docs/14):** Loews Vanderbilt, Nashville, 22% ($328,250 a year) with LED and
  guest-room controls; Hilton Austin 31% ($400,000) multi-measure; the Willard InterContinental, 11% of whole-building energy from lighting.
  (Some are from search excerpts, not the full documents; docs/14 labels which.) The model's results fall in the same range (all upgrades
  together: about 25% of the demo hotel's bill).
- **The opportunity is concrete:** Chicago alone has 147 hotels with 49,526 rooms (Choose Chicago); the 5-hotel sample chain spends $1.56M a
  year with $109,905 a year of savings potential (modeled).
- **Why existing buildings:** earlier winners such as Eden cover new-build design; existing buildings are most of the stock and need
  operations plus investment decisions.
- **Market size (verified, Part 5):** US hotels and resorts spend about $5.2 billion a year on energy (EIA CBECS 2018), about $6.2 billion
  with motels and inns.
- **Why now (verified, Part 5):** EIA links record electricity demand to commercial growth, largely data centers, and expects commercial
  prices to keep rising; cities such as New York fine buildings, hotels included, for carbon (search excerpt).
- **User evidence:** published, not interviews (Part 5): the industry association on operating costs, trade press on financing and
  franchise economics, a chief engineer's own payback decision. Say plainly that there were no interviews in 48 hours; name a pilot as next.

### 3. Product judgment and MVP

- **Focused:** one building type (hotels), one decision (what to fix and buy with a budget), one journey: Portfolio → identify the
  opportunity → explore the hotel → simulate → invest → report.
- **Judgment calls we made (and can defend):** a deterministic engine computes every number and the AI only explains, with a number check;
  incentives count only when confirmed for the analysis year; a correction to the building is never counted as a saving; the optimizer says
  "don't" when a plan does not pay back; the portfolio page leads with the decision, the detail is collapsed.
- **Cut on purpose:** accounts, tariffs and demand charges, weather-normalized bills, other building types (listed as roadmap).
- **Working demo:** the whole path runs in the Lovable app (`main`): portfolio map → Riverwalk Grand → 3D time-lapse → occupancy what-if →
  optimizer → 10-year payoff → PDF report → advisor; a 19-step tour shows it in about 35 s. 552 automated tests, and a test checks every figure
  in the demo script.
- **Gap:** rehearse it five times on the demo laptop (task 8.3) and record the backup video; check the live advisor there.

### 4. Positioning and adoption

- **Why the user cares:** "See the savings before you spend": a GM can defend a decision to the owner with a report; an owner can compare
  options on the same assumptions; a chain can put the budget where it returns most (not where the bill is biggest).
- **Positioning:** not a benchmark (ENERGY STAR Portfolio Manager shows the past), not a vendor calculator (sells one product), not a
  new-build design tool (Eden): a decision tool for existing buildings, operations and investments, honest about uncertainty.
- **Adoption path:** start with the sample, then the user's own hotel in minutes (Add my hotel, a few fields), then 12 months of bills
  (Excel template) to calibrate; no hardware, no sensors, runs in the browser; the PDF report travels to the owner or the bank.
- **Channels to name (team decision):** for example hotel management companies and franchise groups, energy consultants who audit hotels,
  and utilities that run efficiency programs (the app already applies a utility's own incentive rules by program year and territory).
- **Gap:** pick one primary channel and say why.

### 5. Measurement and viability

- **How we would know it works (product measures):**
  - *Activation:* share of new users who add their own hotel and run the optimizer in the first session.
  - *Decision value:* share of hotels that export a report; share of reports that lead to an approved project.
  - *Accuracy loop:* after an upgrade, compare the next 12 months of bills with the prediction. The calibration already measures fit with
    ASHRAE Guideline 14 metrics (NMBE, CV(RMSE)); the same metrics measure predicted versus realized savings.
  - *Outcome:* realized savings and avoided carbon across hotels that installed recommended upgrades.
- **Why it can be sustainable:** the engine runs in the browser (simulations and the optimizer cost nothing per use); the AI is one short,
  cached call per question; the data are public sources refreshed yearly (EIA, NOAA, eGRID, the Illinois TRM, utility worksheets).
- **Business model (team decision, do not improvise prices):** candidates are a per-property subscription for owners and chains, a
  professional tool for energy consultants, or a utility-program license.
- **Path forward:** real hotels with real bills (pilot with 1–3 properties), tariffs and demand charges, accounts and roles, more cities with
  local incentives, then resorts, convention centers and offices.
- **Gaps:** choose the business model and one pilot target to name.

---

## Part 5 — Why we built it, the market, and what operators say

Every figure is marked **verified** (read in the source document) or **search excerpt** (from a search result or a secondary page, not
the original). Quote verified figures freely; quote search excerpts only with "reported" or leave them out.

### Why we decided to build this

1. **Electricity is getting more expensive, and data centers are a big reason.**
   - *Verified:* EIA's Short-Term Energy Outlook (January 2026): commercial electricity sales grow 2.4% in 2026 and 4.3% in 2027, "largely
     attributed to increasing demand from large computing facilities, that include data centers", with data center growth named in
     Virginia, Georgia and Ohio.
   - *Verified:* EIA's Short-Term Energy Outlook (November 2026, Table 2): the average commercial electricity price rises from 13.37 cents per
     kWh in 2025 to 14.01 in 2026 and 14.26 in 2027; US generation reaches a record of almost 4,390 billion kWh in 2026, "driven by
     growing demand from the commercial sector".
   - *Verified (already in the app):* EIA's Annual Energy Outlook 2026 projects commercial electricity rising from 13.48 to 16.62 cents per
     kWh between 2025 and 2035 (2.12% a year); the app uses this for every 10-year projection.
   - *Search excerpt:* DOE's December 2024 announcement of the LBNL data center report: data center load "has tripled over the past decade
     and is projected to double or triple by 2028". (The LBNL report itself could not be opened from the build session; check it before
     quoting its percentages.)
2. **Governments are pricing carbon in buildings, and hotels are in scope.**
   - *Search excerpt:* New York City's Local Law 97 sets yearly greenhouse-gas limits for buildings over 25,000 ft², hotels included, with
     fines of $268 per tonne of CO₂e above the limit from the 2024 compliance period, and lower limits from 2030 (compliance guides; nyc.gov
     could not be opened from the build session).
   - *To verify before quoting:* building performance standards elsewhere in the US and the EU's recast Energy Performance of Buildings
     Directive (2024). We have not checked their figures; say "governments in the US and abroad are adding building carbon rules" without
     numbers unless someone checks them.
3. **So the question for every hotel becomes: which upgrades pay back, and how much carbon they avoid, before we spend.** That is what
   Energy Twin answers, with carbon in every plan (from EPA eGRID grid factors) and the price path built into every payback.

**How to say it (20 seconds):** "We started from two trends. Data centers are pushing electricity demand to records, and EIA expects
commercial prices to keep climbing. At the same time, cities like New York now fine buildings, hotels included, for their carbon. Hotels
can't guess anymore. Energy Twin shows them what to fix, what it saves and what it avoids, before they spend."

### The market figure (verified, with one calculation)

- **US hotels and resorts spend about $5.2 billion a year on energy** (2018; $4.4 billion of it electricity), across about 66,000 buildings.
  Add motels, inns and B&Bs and it is about **$6.2 billion**.
- **All US lodging buildings: $11.5 billion a year** ($11,513 million, EIA's published table). This is a broader category: it also includes
  dormitories, retirement and nursing homes, shelters and convents.
- **Source and method:** EIA, Commercial Buildings Energy Consumption Survey 2018. The lodging total is EIA's published Table C2
  ("Total energy expenditures by major fuel"). The hotel figure is computed from EIA's public microdata (`cbecs2018_final_public.csv`):
  the sum of major-fuel expenditures (`MFEXP`) times EIA's survey weight (`FINALWT`) for buildings whose activity (`PBAPLUS`) is
  38 "Hotel/resort" ($5,170 million, 272 surveyed buildings) and 39 "Motel/inn/bed and breakfast" ($1,019 million, only 32 surveyed buildings,
  so less precise). Check: the same method gives $11,521 million for all lodging, against EIA's published $11,513 million.
- **Caveats to say if asked:** 2018 dollars (commercial electricity prices have risen since; see the EIA figures above), and an estimate from a
  survey sample.
- **How to say it:** "US hotels spend over five billion dollars a year on energy, by EIA's own survey."

### What operators and the industry say (no calls needed)

- *Search excerpt (AHLA):* the American Hotel & Lodging Association reports that hotel owners say operating costs remain their biggest
  challenge, naming energy among the rising costs alongside labor, insurance and supplies.
- *Search excerpt (Lodging Magazine, September 2025, "Rethinking Guestroom Energy"):* a development executive says lenders are allowing
  less leverage, so owners need more equity, and frames energy savings as a way to raise net operating income; the article notes brands
  hesitate to require energy spending because franchisees pay for it. (The magazine's site could not be opened from the build session; check
  the exact wording before quoting.)
- *Search excerpt (Buildings, 2012):* Harry Hobbs, chief engineer of the InterContinental San Francisco, on a stairwell occupancy-sensor
  retrofit: $45,000, with a $17,000 rebate, expected to save $35,000 a year (about a 10-month payback). Old, but a real chief engineer
  making exactly the decision Energy Twin models.
- *Search excerpt (Wyndham Owner Trends Report, March 2026):* among 325 owners and developers, energy efficiency is one of the top uses of AI
  for those already using it (54%).
- *Counterpoint to be ready for (search excerpt, CBRE):* hotels' combined utility costs rose only 2.0% in 2024. Answer: one year of utility
  costs is not the trend; EIA's outlook has commercial electricity prices rising, and carbon rules add a cost that utility bills do not show.

**Honest framing on stage:** "We could not interview operators in 48 hours, so we used published evidence: EIA's own data, the industry
association and trade press." Then the next step: "Our first pilot is to run Energy Twin on a real hotel's bills."

**Sources (search results, for the team to check):** [AHLA: rising costs and staffing challenges](https://www.ahla.com/news/rising-cost-staffing-challenges-persist-hotels-travel-demand-expected-hold-steady);
[Lodging Magazine: Rethinking Guestroom Energy](https://lodgingmagazine.mydigitalpublication.com/articles/rethinking-guestroom-energy);
[Buildings: Hotel Efficiency Optimization](https://buildings.com/feature/article/10189814/hotel-efficiency-optimization);
[Wyndham Owner Trends Report](https://corporate.wyndhamhotels.com/news-releases/hotel-owners-at-an-ai-crossroads-as-confidence-and-growth-plans-hold-firm-wyndham-owner-trends-report-finds/);
[CBRE: operating costs 2025](https://www.cbre.com/insights/articles/all-eyes-on-operating-costs-in-2025-lessons-learned-in-2024);
[DOE: data center electricity demand report](https://www.energy.gov/articles/doe-releases-new-report-evaluating-increase-electricity-demand-data-centers);
[LBNL 2024 data center report](https://eta.lbl.gov/publications/2024-lbnl-data-center-energy-usage-report);
[NYC Buildings: Local Law 97](https://www.nyc.gov/assets/buildings/pdf/presentations/2023bsls/ll97.pdf).
**Verified documents:** [EIA STEO November 2026](https://www.eia.gov/outlooks/steo/pdf/steo_full.pdf); [EIA STEO January 2026](https://www.eia.gov/outlooks/steo/archives/jan26.pdf);
[EIA CBECS 2018 Table C2](https://www.eia.gov/consumption/commercial/data/2018/ce/xls/c2.xlsx); [EIA CBECS 2018 microdata](https://www.eia.gov/consumption/commercial/data/2018/index.php?view=microdata).
