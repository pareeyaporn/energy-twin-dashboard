# 22 — Pitch: the 3-minute story, the evidence behind it, and the questions judges will ask

**How to use this doc.** Part A is what you **say** (about 3 minutes, for the intro and the slides). Part B is the **evidence** behind each
part of that story, in the same order. Part C maps it to the **five judging criteria**. Part D is the **Q&A** reference. Part E has the
lines to have ready and every source. The live demo itself follows `docs/07` (6–7 minutes).

**Rules.** Figures from the app are its output for **synthetic** demo data (`DEMO_FIGURES=1 npx vitest run src/test/demoScript.test.ts`
prints them; re-run before the demo): say "estimate" and "synthetic" when quoting them. Market and trend figures are marked **verified**
(read in the source document) or **search excerpt** (from a search result or a secondary page): quote verified figures freely; quote search
excerpts only as "reported", or leave them out. Never improvise a number on stage.

---

## Part A — The 3-minute pitch

**Energy Twin: Simulate Smarter. Spend Better. Save Energy.**

What if hotel owners could see the impact of energy upgrades before spending a dollar? Energy Twin turns existing hotels into AI-powered
virtual testing grounds. Operators can visualize energy flows, simulate changing conditions, and stress-test decisions across one property
or an entire portfolio. Our optimizer finds the best upgrade combinations within a budget, revealing projected savings, payback, and carbon
impact. **Stop guessing. Start simulating. Invest with confidence.**

| Time | Beat | What to say |
| --- | --- | --- |
| 0:00–0:20 | **Hook** | "What if a hotel owner could see the impact of an energy upgrade before spending a dollar? That's Energy Twin: see the savings before you spend." |
| 0:20–0:50 | **Why now** (B1) | "We started from two trends. Data centers are pushing US electricity demand to records, and the U.S. Energy Information Administration expects commercial electricity prices to rise from about 13.4 to 14.3 cents per kWh by 2027, and to about 16.6 cents by 2035. At the same time, cities like New York now fine buildings, hotels included, for their carbon." |
| 0:50–1:15 | **User, problem, market** (B2, B3) | "Hotels run 24/7, occupancy swings the bill, and most have no energy team. US hotels spend over five billion dollars a year on energy and use about 46 billion kWh, more than 1% of all the electricity sold in the country. Yet owners decide upgrades on vendor promises. Nobody shows them, for their building and their budget, what actually pays back." |
| 1:15–2:15 | **The product** (B4; show it) | "Start on the portfolio: Energy Twin tells a chain where to invest first, and it's not the biggest bill. Open the hotel: a living digital twin, every glow from the simulation. Test a conference season, then give it a $50,000 budget: it tests every combination and recommends LED lighting plus sensors, $38,940, saving about $10,300 a year, paying back in under four years, and it tells you solar would take 18 years here. One click turns it into a report for the owner." |
| 2:15–2:35 | **Why trust it** (B5) | "Every number comes from a deterministic engine built on public data from EIA, NOAA, NREL and EPA. The AI only explains, and the app rejects any answer with a number the engine didn't compute. Incentives count only when confirmed, and bad investments are called bad." |
| 2:35–2:50 | **What's next** (B6) | "We started with hotels, but the engine models any commercial building. Next: offices, retail, hospitals and schools, then a pilot on a real hotel's bills." |
| 2:50–3:00 | **Close** | "Hotels can't guess anymore. Energy Twin shows them what to fix, what it saves and what it avoids, before they spend. Simulate smarter. Spend better. Save energy." |

The figures above are synthetic demo outputs (B4) and EIA data (B1, B3). Say "estimates" once during the product beat.

---

## Part B — The evidence, in pitch order

### B1. Why now

1. **Electricity demand and prices are rising, with data centers a major reason.**
   - *Verified:* EIA Short-Term Energy Outlook (January 2026): commercial electricity sales grow 2.4% in 2026 and 4.3% in 2027, "largely
     attributed to increasing demand from large computing facilities, that include data centers", with data center growth named in
     Virginia, Georgia and Ohio.
   - *Verified:* EIA Short-Term Energy Outlook (November 2026, Table 2): the average commercial electricity price rises from 13.37 cents per
     kWh in 2025 to 14.01 in 2026 and 14.26 in 2027; US generation reaches a record of almost 4,390 billion kWh in 2026, "driven by
     growing demand from the commercial sector".
   - *Verified (already in the app):* EIA Annual Energy Outlook 2026 (Counterfactual Baseline case): commercial electricity rises from 13.48 to
     16.62 cents per kWh between 2025 and 2035 (2.12% a year); the app uses this in every 10-year projection.
   - *Search excerpt:* DOE's December 2024 announcement of the LBNL data center report: data center load "has tripled over the past decade
     and is projected to double or triple by 2028" (the LBNL report itself could not be opened from the build session; check it before
     quoting its percentages).
   - **If asked about the prices:** EIA's prices are **nominal** (they include inflation). The short-term rise (13.37 → 14.26 cents, about
     6.7% over 2025–2027) is faster than typical inflation; the long-term path (about 2.1% a year to 2035) is roughly flat in real terms.
     Say "prices are expected to rise", with the figures, not "prices will soar".
2. **Governments are pricing carbon in buildings, and hotels are in scope.**
   - *Search excerpt:* New York City's Local Law 97 sets yearly greenhouse-gas limits for buildings over 25,000 ft², hotels included, with
     fines of $268 per tonne of CO₂e above the limit from the 2024 compliance period, and lower limits from 2030 (compliance guides; nyc.gov
     could not be opened from the build session).
   - *To verify before quoting:* building performance standards elsewhere in the US and the EU's recast Energy Performance of Buildings
     Directive (2024). Without a check, say "governments in the US and abroad are adding building carbon rules", with no numbers.
3. **So:** the question for every hotel becomes which upgrades pay back, and how much carbon they avoid, before spending. Energy Twin answers
   it, with carbon in every plan (EPA eGRID factors) and the price path built into every payback.

### B2. The user, the problem and the prompt

- **User:** the general manager and chief engineer of an existing hotel (one building); the owner, asset manager or chain executive who
  decides where capital goes (the portfolio).
- **Problem:** hotels run 24/7, occupancy swings the bill, and most have no energy team. Every vendor says their product is the answer
  (solar, smart thermostats, LEDs). Nobody shows them, for *their* building and *their* budget, which one pays back, and by how much, before
  they spend.
- **Value:** see where the money goes, test a decision before making it, get the best upgrades for a budget with costs, savings ranges,
  payback, NPV and carbon, and take a report to the owner.
- **The prompt** (Open Track: "Build something that improves how people live, work or connect"): it improves how people **work**. Hotel
  general managers, engineers and owners make six-figure energy decisions from vendor pitches and spreadsheets; Energy Twin turns that into
  minutes of evidence. It also touches how people **live**: guest comfort is a constraint in every plan, and every plan shows the carbon it
  avoids. Built in Lovable, with real public datasets and supplemental code, as the prompt allows.

### B3. The market and the evidence

**Market (verified, EIA Commercial Buildings Energy Consumption Survey, CBECS 2018):**

- **US hotels and resorts spend about $5.2 billion a year on energy** ($4.4 billion of it electricity), across about 66,000 buildings; with
  motels, inns and B&Bs, about **$6.2 billion**.
- **All US lodging: $11.5 billion a year** ($11,513 million, CBECS Table C2). A broader category: it also includes dormitories, retirement and
  nursing homes, shelters and convents. Do not quote it as "hotels".
- **Electricity (2018):**

  | | Electricity | Share of all US electricity sold | Share of all commercial-building electricity |
  | --- | --- | --- | --- |
  | All lodging (hotels, motels, dorms, nursing homes, …) | 100 billion kWh | 2.6% | 8.4% |
  | Hotels and resorts | 46 billion kWh | 1.2% | 3.9% |
  | Hotels, resorts, motels and inns | 55 billion kWh | 1.4% | 4.6% |

- **Method:** the lodging rows are EIA's published tables (C1 for energy: 598 trillion Btu of site energy, 342 trillion Btu of it
  electricity; C2 for spending). The hotel rows are computed from EIA's public microdata (`cbecs2018_final_public.csv`): the sum of each
  building's major-fuel spending (`MFEXP`) or electricity use (`ELCNS`) times EIA's survey weight (`FINALWT`) for building activity
  (`PBAPLUS`) 38 "Hotel/resort" (272 surveyed buildings) and 39 "Motel/inn/bed and breakfast" (only 32, so less precise). Check: the same
  method gives $11,521 million and 100.3 billion kWh for all lodging, against EIA's published $11,513 million and 100.2 billion kWh. US
  electricity sold in 2018: 3,859 billion kWh (EIA Electric Power Annual, Table 2.2). The 598 trillion Btu is all lodging site energy
  (electricity and gas), not electricity.
- **Caveats if asked:** 2018 dollars (prices have risen since, B1), and an estimate from a survey sample.
- **Locally:** Chicago has 147 hotels with 49,526 rooms (Choose Chicago, verified); the 5-hotel sample chain spends $1.56M a year with
  $109,905 a year of savings potential (modeled, synthetic).

**Where hotel energy goes (ENERGY STAR hotel guidance):** lighting is almost a quarter of a hotel's electricity; heating and cooling almost
40% of the electricity and more than half of the gas.

**Savings are real (published hotel cases, docs/14):** Loews Vanderbilt, Nashville, 22% ($328,250 a year) with LED and guest-room controls;
Hilton Austin 31% ($400,000) multi-measure; the Willard InterContinental, 11% of whole-building energy from lighting. (Some are search
excerpts; docs/14 labels which.) The model's results fall in the same range: all upgrades together save about 25% of the demo hotel's bill.

**What operators and the industry say (published; no interviews in 48 hours):**

- *Search excerpt (AHLA):* the American Hotel & Lodging Association reports that hotel owners say operating costs remain their biggest
  challenge, naming energy among the rising costs alongside labor, insurance and supplies.
- *Search excerpt (Lodging Magazine, September 2025, "Rethinking Guestroom Energy"):* a development executive says lenders are allowing less
  leverage, so owners need more equity, and frames energy savings as a way to raise net operating income; brands hesitate to require energy
  spending because franchisees pay for it. (Check the exact wording before quoting.)
- *Search excerpt (Buildings, 2012):* Harry Hobbs, chief engineer of the InterContinental San Francisco: a stairwell occupancy-sensor
  retrofit, $45,000 with a $17,000 rebate, expected to save $35,000 a year (about a 10-month payback). Old, but a real chief engineer making
  exactly the decision Energy Twin models.
- *Search excerpt (Wyndham Owner Trends Report, March 2026):* among 325 owners and developers, energy efficiency is one of the top uses of AI
  for those already using it (54%).
- *Counterpoint to be ready for (search excerpt, CBRE):* hotels' combined utility costs rose only 2.0% in 2024. Answer: one year is not the
  trend; EIA has commercial electricity prices rising, and carbon rules add a cost utility bills do not show.

**Say it plainly:** "We couldn't interview operators in 48 hours, so we used published evidence: EIA's own data, the industry association and
trade press. Our first pilot is to run Energy Twin on a real hotel's bills."

### B4. The product: seven moments (in demo order)

1. **"Start here."** The portfolio answers the chain executive's first question: which hotel to invest in first, and why. It is **not** the
   biggest bill: Lakefront Convention Hotel spends the most ($591,679 a year), but Riverwalk Grand returns more per dollar (priority 100 of
   100).
2. **A living building.** The 3D twin plays a year: snow in January, cooling on July afternoons, guests checking in and out. Every glow and
   number is the simulation (a January night needs about 80 kW of heating, a July afternoon 102 kW of cooling), not decoration.
3. **Decisions before you make them.** Occupancy from 60% to 85% adds $12,869 a year, not 42% more: base loads run whether rooms are full or
   not. Smart room controls then save only $1,014, because at 85% few rooms are empty.
4. **Every combination, tested.** 256 combinations on that scenario, 10 fit the $50,000 budget and the comfort limit. Best: LED lighting +
   occupancy sensors, $38,940 installed, saving $10,302 a year, paying back in 3.8 years, $73,209 net over 10 years, 27 t of CO₂ a year.
   Solar on the full roof costs $159,500 and takes 18.5 years here, so it is **not** recommended, and the app says why.
5. **Honest money.** ComEd's 2025 lighting incentive would cut the net cost to $24,184 (2.3-year payback), but the 2026 rate is not
   confirmed, so it is shown **separately as illustrative** and never counted. Plans that do not pay back are called "not financially
   attractive".
6. **Your bills, your building.** Upload 12 months of bills (or edit the sample spreadsheet live) and the model calibrates to them,
   electricity and gas separately, with ASHRAE Guideline 14 fit metrics. Correct the equipment you have (a 95% boiler instead of the 80%
   assumed) and the baseline follows, never counted as a saving.
7. **A report for the owner.** One click on Reports: a multi-page PDF with the recommendation, before and after, the investment, the 10-year
   cash flow, every assumption, the sources and the risks, labeled as estimates.

**For the 3-minute pitch, use moments 1, 2, 4 and 7;** keep 3, 5 and 6 for the demo and Q&A.

**Why it is different:**

| Others | Energy Twin |
| --- | --- |
| Benchmarking (ENERGY STAR Portfolio Manager) tells you how you did last year | Simulates what happens **next** and ranks what to buy within a budget |
| Net-zero design tools (for example Eden) design **new** homes | Works on **existing** commercial buildings, operations **and** investments |
| Vendor calculators sell one product | Compares every upgrade and combination on the same assumptions, and says when the answer is "don't" |
| Generic AI chatbots invent numbers | The engine computes every number; the AI only explains, and the app **rejects** any answer with a number not in the results |

**Built in 48 hours:** Lovable for the interface, Claude Code for the engine, data, 3D twin, optimizer, reports and tests, synced through
GitHub: sourced data for four cities, a deterministic simulation (same input, same output), an exact optimizer, a 3D digital twin, a
portfolio map, a utility-bill calibration, an editable equipment inventory, a PDF report, an AI advisor with number checking and a 19-step
guided tour.

### B5. Why trust it

- **Every number is sourced or labeled:** EIA prices, NOAA weather normals, NREL ComStock hotel energy, EPA eGRID grid emissions, NREL
  PVWatts solar, the Illinois technical reference manual for upgrade savings, ComEd's own incentive worksheets. Each figure has "How was this
  calculated?", with its inputs labeled: published source, your input, modeled estimate, synthetic, assumption.
- **No invented precision:** ranges (low to high) where defensible; no confidence scores; "estimates, not an engineering audit" everywhere.
- **Validated where possible:** smart room controls savings sit inside the Illinois rulebook's deemed range for a Chicago hotel; whole-hotel
  and lighting savings agree with published hotel cases (B3, docs/14).
- **Built to be checked:** 552 automated tests; a test fails if any figure in the demo script stops matching the engine.

### B6. Roadmap: beyond hotels

**The idea:** simulate any B2B building before money is spent. Hotels came first because they run 24/7, occupancy swings the bill, and their
owners make large investments with little energy expertise.

**What carries over unchanged:** the optimizer, the financial model (payback, NPV, net benefit, price growth), the incentive rules (program
year, territory), carbon from grid factors, utility-bill calibration, the equipment inventory, the portfolio map and optimizer, the PDF
report, the AI advisor and its number check. **Each new type needs:** its zones, its drivers, its upgrades and its benchmark data.

| Building type | What is different | Data available | Difficulty |
| --- | --- | --- | --- |
| Offices | Weekday schedules, plug loads, lighting | NREL ComStock (small, medium, large offices) and EIA CBECS | Easiest next step |
| Retail and malls | Opening hours, foot traffic, refrigeration, large lighting loads | ComStock (standalone retail, strip malls) and CBECS (enclosed malls are their own category) | Easy to medium |
| Hospitals and clinics | 24/7, high fresh-air requirements, medical equipment, reliability before savings | ComStock (hospital, outpatient) and CBECS | Medium |
| Schools | Term calendars, daytime occupancy | ComStock (primary, secondary schools) and CBECS | Easy to medium |
| Museums and convention centers | Strict humidity and temperature control, gallery or event lighting, event schedules | CBECS ("public assembly"); no ComStock model, so more assumptions | Medium to hard |
| Senior living and nursing homes | Closest to hotels: rooms, 24/7, hot water, kitchens, laundry; residents stay, so occupancy is steadier and comfort limits are stricter | CBECS counts nursing and assisted living within lodging; no ComStock model, so the zones come from the hotel model | Easy: the nearest neighbour |
| Dormitories | Rooms and showers like a hotel, but on a term calendar (summer nearly empty) | CBECS (lodging: dormitories); no ComStock model | Easy |
| Resorts, casinos and convention hotels | Hotels plus pools, spas, gaming floors and event halls with their own schedules | ComStock large hotel plus extra zones; CBECS | Medium |
| Restaurant and retail chains | Many small, similar sites: kitchens and refrigeration, opening hours; the portfolio map and optimizer fit them directly | ComStock (full-service and quick-service restaurants, standalone retail, strip malls) and CBECS (food service, food sales) | Easy to medium |
| Grocery stores | Refrigeration runs all day and dominates; heat from cases changes heating and cooling | CBECS (food sales); ComStock covers retail but not grocery refrigeration in detail | Medium |
| Warehouses and cold storage | Simple buildings with big lighting and (for cold storage) refrigeration loads; LED and controls pay back fast | ComStock (warehouse) and CBECS (refrigerated warehouses as their own type) | Easy (warehouses) to medium (cold storage) |
| Apartment buildings (multifamily) | Residential use per unit, often split bills between owner and tenants | NREL ResStock (the residential counterpart of ComStock) | Medium: residential data, new tenant-owner split |
| Government buildings and campuses | Mixed types on one site (offices, labs, dorms, sports), public budgets and carbon targets | ComStock and CBECS by type; a campus is a portfolio of types | Medium: the portfolio view is the starting point |
| Factories | Process energy (motors, compressed air, furnaces, process heat) dominates; production schedules drive it | Not in ComStock or CBECS; EIA's Manufacturing Energy Consumption Survey and process-specific models | Hardest: a different product line |
| Data centers | Almost all energy is servers and cooling, set by computing load, not people or weather | Not in ComStock or CBECS in usable detail | Not this product: a different engine, and the reason prices rise (B1) |

**Order, and why:** hotels → **senior living and dorms** (the same model: rooms, hot water, kitchens, laundry) → **restaurant and retail
chains** (many similar sites, so the portfolio view sells itself; ComStock has the data) → **warehouses and cold storage** (simple buildings,
quick LED and controls paybacks) → **offices, schools and hospitals** (the best data, but more competition and, for hospitals, reliability
before savings) → public assembly (museums, convention centers) → factories (a different product line). Data centers are not on this path:
they are a different engine. **Go-to-market lens:** cities that fine buildings for carbon (for example New York's Local Law 97) are where any
of these types needs the tool first. (The app's data already lists resorts, casinos, convention centers and entertainment venues as future
types: `futureBuildingTypes` in `src/data/hotel/properties.json`.) **Product next steps alongside:** a pilot on a real hotel's bills, tariffs and demand charges, accounts and
roles, more cities with local incentives.

---

## Part C — The five judging criteria

Each points to the evidence above. Score as written today: about 7.5 / 10; closing the gaps marked **Gap** moves it to about 8.5–9.

| # | Criterion | Our answer | Evidence | Gap |
| --- | --- | --- | --- | --- |
| 1 | **User, problem & value** | GMs, engineers and owners deciding six-figure energy investments; we turn vendor pitches into minutes of evidence. Improves how people **work** (and **live**: comfort, carbon). | B2; B4 moments 1, 4, 7 | Say the prompt fit in the first 30 seconds (Part A, hook and problem beats). |
| 2 | **Evidence & opportunity** | A $5.2 billion a year energy spend in US hotels, 1.2% of US electricity, rising prices driven partly by data centers, carbon rules arriving. | B1, B3 | No direct interviews: say so and name a pilot. |
| 3 | **Product judgment & MVP** | One building type, one decision, one journey; a deterministic engine with the AI only explaining; incentives only when confirmed; corrections never counted as savings; "don't" when a plan does not pay. Cut on purpose: accounts, tariffs, weather-normalized bills, other building types. | B4, B5; the working Lovable demo (docs/07); the 19-step tour | Rehearse five times on the demo laptop (task 8.3); check the live advisor there. |
| 4 | **Positioning & adoption** | Not a benchmark, not a vendor calculator, not a new-build tool: a decision tool for existing buildings. Starts with the sample, then the user's hotel in minutes, then bills; no hardware; the PDF travels to the owner or the bank. | B4 ("Why it is different") | Pick one primary channel (for example energy consultants who audit hotels, hotel management companies, or utilities running efficiency programs) and say why. |
| 5 | **Measurement & viability** | Activation (adds own hotel and runs the optimizer), decision value (reports exported, projects approved), the accuracy loop (predicted vs realized savings with the same Guideline 14 metrics the calibration uses), outcomes (realized savings, avoided carbon). Low running cost: the engine runs in the browser; one short, cached AI call per question; public data refreshed yearly. | B5, B6 | Choose the business model (per-property subscription, consultant tool or utility license) and one pilot target. Do not improvise prices. |

---

## Part D — Questions judges will ask (reference)

Owner: **P** = pitch lead, **E** = engine lead, **T** = tech lead. Keep answers under 20 seconds; offer to show it in the app.

### The product and the user

| # | Question | Owner | Answer |
| --- | --- | --- | --- |
| 1 | Who is the user? | P | Hotel general managers and chief engineers for one building; owners, asset managers and chain executives for the portfolio. The homepage is the portfolio; one click opens a hotel. |
| 2 | Why hotels first, and why now? | P | They run 24/7, occupancy swings the bill, most have no energy team, and together US hotels spend about $5.2 billion a year on energy (EIA). Now, because EIA links record electricity demand to data centers and expects commercial prices to rise, and cities like New York fine buildings for carbon. Hotels are the first type; the engine models any commercial building. |
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
| 10 | Have you validated it? | E | Against published hotel cases (whole-hotel and lighting savings agree) and the Illinois rulebook's deemed savings for guest-room controls (inside its range). Field studies in milder climates report more for that measure; we report it rather than tune it (docs/14). |
| 11 | What if my building is different from your defaults? | E | Edit the profile, correct the equipment (boiler efficiency, chiller, LED share, existing solar), and upload your bills. The baseline follows; corrections are never counted as savings. |
| 12 | Why is the hotel's intensity 37% above the ENERGY STAR median? | E | Chicago's cold climate and a restaurant raise it; the median is national. It is context, not a rating. |
| 13 | Which cities do you support? | E | Chicago, New York, Miami and Denver with sourced weather, prices and grid data. Savings parameters still come from the Illinois rulebook, and incentives only apply in ComEd's territory. |
| 14 | Do you model demand charges or time-of-use tariffs? | E | Not yet: all-in average prices from EIA. Tariffs are on the roadmap. |

### The money

| # | Question | Owner | Answer |
| --- | --- | --- | --- |
| 15 | Why isn't solar recommended? | E | For this hotel the full roof costs $159,500 and pays back in about 18.5 years; the optimizer finds better uses of $50,000. It says so instead of hiding it. Show "Compare all upgrades". |
| 16 | Are incentives included? | E | Only confirmed ones for the analysis year (2026): ComEd's guest-room controls incentive counts. ComEd's 2025 lighting rate is shown separately as illustrative until the 2026 rate is confirmed. Funds are limited and never guaranteed. |
| 17 | What discount rate do you use? | E | 8% by default for commercial investments (a team choice, editable; 3% as an alternative). Energy prices grow with EIA's Annual Energy Outlook 2026. Every payback, NPV and net benefit recalculates. |
| 18 | Why is LED + sensors the best package? | E | It saves $10,302 a year for $38,940 on the 85% scenario: lighting runs 24/7 in a hotel and sensors cut corridor and lobby hours. The comparison shows every upgrade on the same assumptions. |
| 19 | Do upgrades double-count savings? | E | No. Upgrades are applied in sequence in one simulation (LED lighting adds a little heating, for example), so the package saving is the real combined effect, and the per-upgrade contributions add up to it. |
| 20 | What if a plan is a bad investment? | E | The app says "not financially attractive" when it never pays back, pays back after the equipment wears out, or has a negative 10-year NPV. We never present every plan as a good one. |
| 21 | Aren't electricity prices just inflation? | E | Partly: EIA's prices are nominal. The rise to 2027 (about 6.7% in two years) is faster than typical inflation; the long-term path is roughly flat in real terms. The app uses EIA's own price path, not an assumption of ours. |

### The AI

| # | Question | Owner | Answer |
| --- | --- | --- | --- |
| 22 | Where is the AI? | T | In the advisor chat (hotel Ask tab and the portfolio page), the "Ask AI" buttons, a three-sentence briefing per hotel, the PDF report's executive summary and the bill-column helper. All of it explains or sets up the engine's numbers; the energy model, the optimizer and the financials are deterministic code (docs/23). |
| 23 | Can the AI hallucinate a saving? | T | It can try, and the browser throws the answer away: every number in an AI text is checked against the figures the engine produced for that answer. One unknown number and a template answer built from the same results replaces it. The same check covers follow-ups, the briefing and the report summary. Show the advisor. |
| 24 | What does "tool use" mean here? | T | When a question needs a new calculation ("what if occupancy hits 85%?", "what does $50,000 buy?"), the AI asks our engine to run it; the engine runs in the browser and the AI explains the result. The answer shows the engine's result card, and buttons apply it to the twin only when you click. |
| 25 | Why not let the AI do the optimization? | T | The optimizer tests every combination within the budget with the same costs, incentives, interactions and discount rate every time, so owners and lenders can audit it. A language model could miss combinations, could not guarantee the arithmetic and could answer differently twice. The AI does what it is good at: understanding the question, picking the calculation, explaining the trade-offs. |
| 25a | Which model, and what does it cost to run? | T | Claude, called from a backend function: one to three short calls per question (a tool round adds one), a capped answer length, a monthly spending limit. A few cents at most per question; the simulations and the optimizer run in the browser and cost nothing per use. |
| 25b | What do you send to the AI? Our bills? | T | The engine's results for the hotel on screen, never raw bills. The column helper sends only the spreadsheet's headers, and you confirm each suggestion; the report summary leaves the utility section out. |
| 25c | What if the AI is down? | T | Nothing breaks: the same engine tools run from a keyword parser with a template answer, the briefing shows a template, the report has no summary paragraph, the column mapping keeps its automatic guess. |

### Technical

| # | Question | Owner | Answer |
| --- | --- | --- | --- |
| 26 | How does the simulation work? | E | Benchmark energy by climate (NREL ComStock) split by zone, end use and month, driven by occupancy, weather (NOAA normals), schedules and setpoints; upgrades rescale the affected loads. Equations in docs/13. |
| 27 | How does the optimizer work? | E | It tests every combination of eligible upgrades for the hotel (256 on the demo scenario) against the budget and a comfort limit, and ranks them by your objective. For a chain, an exact search splits one budget across hotels. |
| 28 | Is the 3D twin real data or decoration? | T | Every color, glowing window and readout comes from the simulation for that hour; scenery (trees, cars) is visual only. It falls back to 2D on weak hardware. |
| 29 | Does it work offline / on a phone? | T | The engine runs in the browser, so everything except a live AI answer works offline after loading; saved answers replay. Layouts work on phones. |
| 30 | Where is my data stored? | T | In this version, in the browser only (utility bills, equipment, plans); nothing is sent to our servers or to the AI. Accounts and a database are on the roadmap. |
| 31 | How did you build it in 48 hours? | T | Lovable for the interface, Claude Code for the engine, data, 3D twin and tests, synced through GitHub with short branches and pull requests. |

### Business and next steps

| # | Question | Owner | Answer |
| --- | --- | --- | --- |
| 32 | Who pays? | P | Team decision: fill in (for example a per-property subscription for owners and chains, or a tool for energy consultants and utilities). Do not quote prices we have not set. |
| 33 | How big is the market? | P | US hotels and resorts spend about $5.2 billion a year on energy and use about 46 billion kWh, 1.2% of all US electricity sold (EIA CBECS 2018 and Electric Power Annual); with motels and inns about $6.2 billion. |
| 34 | What's next? | P | A pilot on a real hotel's bills; tariffs and demand charges; accounts and roles; more cities with local incentives; then senior living and dorms, restaurant and retail chains, warehouses, and offices, schools and hospitals (B6). |
| 35 | Can this work for other buildings: hospitals, malls, museums, factories? | P | Yes; hotels are the first type, not the limit. The engine models a building as zones, end uses and drivers, and its national data (NREL ComStock, EIA CBECS) already covers offices, retail, schools, hospitals, clinics, restaurants and warehouses. Factories come last: their energy is mostly industrial processes, which needs different data (EIA's manufacturing survey) and models. |
| 36 | Which buildings are next, and why those? | P | Senior living and dorms first: they work like hotels (rooms, hot water, kitchens, laundry), so most of the model carries over. Then restaurant and retail chains, because many similar sites fit the portfolio optimizer, and warehouses, where LED and controls pay back fast. Offices, schools and hospitals have the best data but more competitors. Data centers are a different product. |
| 37 | Could a utility use this? | P | Yes: it already applies a utility's own incentive rules by program year and territory; a utility could use it to target customers and explain programs. |
| 38 | What's the biggest weakness? | E | Honest answer: savings parameters come from the Illinois rulebook for every city, some installed costs are still assumptions, and bills are compared with normal-year weather. Each is labeled in the app and listed in docs/08 and docs/13. |

### Tough or skeptical questions

| # | Question | Owner | Answer |
| --- | --- | --- | --- |
| 39 | Why should I trust your numbers over a vendor's? | E | Because we show the work: every input, source and assumption, the same assumptions for every option, and we say when the answer is "don't buy it". |
| 40 | Your smart thermostat savings look low. | E | They match Illinois' deemed savings for a Chicago hotel. Field studies elsewhere report more, mainly in milder climates and against guests leaving units at extreme settings. We report it rather than tune it. |
| 41 | Isn't a 3.8-year payback too good to be true? | E | It is an estimate for a synthetic hotel, from published lighting savings and costs; real quotes and an audit come next. With the 2025 lighting incentive it would be 2.3 years, which we deliberately do not count. |
| 42 | What happens with a building you can't model? | E | The app labels what it does not know: unsupported equipment is informational, unknown replacements say "needs more information", and building types we do not simulate are not offered. |
| 43 | Did you talk to hotel operators? | P | Not in 48 hours; we used published evidence (EIA data, the industry association, trade press, a chief engineer's own retrofit). The first step after the hackathon is a pilot on a real hotel's bills. |
| 44 | What did you cut? | P | Accounts, tariffs, weather-normalized bills and more building types. We chose depth and honesty over breadth. |

---

## Part E — Lines to have ready, and sources

**Lines:**

- "See the savings before you spend."
- "Every number on this screen comes from the engine. The AI explains them; it can't invent them."
- "It's not the biggest bill that should get the money first; it's the best return per dollar."
- "We'd rather tell you not to buy solar than sell you an 18-year payback."
- "This is synthetic data with real sources. Give it your bills and it calibrates to your building."
- "Hotels are our first building type, not our limit."
- "Factories are a different problem: most of their energy goes into production, not the building."

**Verified documents:** [EIA STEO November 2026](https://www.eia.gov/outlooks/steo/pdf/steo_full.pdf);
[EIA STEO January 2026](https://www.eia.gov/outlooks/steo/archives/jan26.pdf);
[EIA CBECS 2018 Table C1](https://www.eia.gov/consumption/commercial/data/2018/ce/xls/c1.xlsx);
[EIA CBECS 2018 Table C2](https://www.eia.gov/consumption/commercial/data/2018/ce/xls/c2.xlsx);
[EIA CBECS 2018 microdata](https://www.eia.gov/consumption/commercial/data/2018/index.php?view=microdata);
[EIA Electric Power Annual Table 2.2](https://www.eia.gov/electricity/annual/xls/epa_02_02.xlsx). The app's own sources are in docs/14.

**Search excerpts (check before quoting):** [AHLA: rising costs and staffing challenges](https://www.ahla.com/news/rising-cost-staffing-challenges-persist-hotels-travel-demand-expected-hold-steady);
[Lodging Magazine: Rethinking Guestroom Energy](https://lodgingmagazine.mydigitalpublication.com/articles/rethinking-guestroom-energy);
[Buildings: Hotel Efficiency Optimization](https://buildings.com/feature/article/10189814/hotel-efficiency-optimization);
[Wyndham Owner Trends Report](https://corporate.wyndhamhotels.com/news-releases/hotel-owners-at-an-ai-crossroads-as-confidence-and-growth-plans-hold-firm-wyndham-owner-trends-report-finds/);
[CBRE: operating costs 2025](https://www.cbre.com/insights/articles/all-eyes-on-operating-costs-in-2025-lessons-learned-in-2024);
[DOE: data center electricity demand report](https://www.energy.gov/articles/doe-releases-new-report-evaluating-increase-electricity-demand-data-centers);
[LBNL 2024 data center report](https://eta.lbl.gov/publications/2024-lbnl-data-center-energy-usage-report);
[NYC Buildings: Local Law 97](https://www.nyc.gov/assets/buildings/pdf/presentations/2023bsls/ll97.pdf).
