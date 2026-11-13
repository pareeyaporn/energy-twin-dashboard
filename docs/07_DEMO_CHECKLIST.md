# 07 — Demo checklist (hotel product)

The demo follows section 12 of [10_HOTEL_SPEC.md](10_HOTEL_SPEC.md). Task numbers refer to [11_HOTEL_TASKS.md](11_HOTEL_TASKS.md).

## Freeze rules

- **Hour 36:** twin and simulator frozen (bug fixes only).
- **Hour 40:** everything frozen. Only fixes for things that break the demo path.
- **Hour 34:** record a 60–90 s screen capture of the key moments (3D, what-if, packages, advisor). Put it in the slides as a backup.
- Do not sacrifice a working P0 feature for P2 polish.

## Before rehearsals

- [x] All data placeholders replaced and `"verified": true`, or clearly labeled "estimated" or "synthetic" on screen — *done (November 2026) by labeling: the remaining placeholders cannot be replaced from published sources (docs/08); every screen that shows them was checked and labeled. Audit table in docs/08, "On-screen labels"*
- [x] The demo hotel's results sanity-checked against the ENERGY STAR hotel median (63.0) and CBECS lodging (85.7): 86.5 kBtu/ft², 37% above
      the median (cold climate, restaurant). Shown in the app as context (benchmark card, LV15); noted for Q&A
- [ ] 3D view loads on the demo laptop and projector (WebGL); "reduce effects" and the 2D switch tested as a fallback — *fallbacks checked
      (November 2026, browser sweep): no WebGL and blocked map tiles both show the drawn map with no errors; reduced motion; 1024 × 768,
      1280, 1440, 1920, iPad and iPhone 13 with no overflow; corrupt and old-format saved data; reload, back button and Reset demo. The real
      laptop and projector check is the team's*
- [x] Dollar, kWh and carbon figures in the pitch script match what the app shows (checked by `src/test/demoScript.test.ts`, November 2026)
- [x] `npm run build` passes; no console errors on the demo path — *checked November 2026: the whole 7-act path walked in a browser (1440 × 900) in 70 s with no page or console errors (only the blocked advisor host on the test machine); every figure on screen matched the script*
- [ ] Published Lovable URL works in an incognito window — *team: the lovable.app hosts are not reachable from the build machine*
- [ ] Advisor answers for the demo questions are cached (ask them once in the rehearsal on the demo laptop; saved in local storage), and the template fallback is tested by turning the function off — *fallback checked (November 2026): with the function unreachable, act 4 still showed the engine's result card and "Apply this what-if" worked. Caching the live answers needs the redeployed function on the demo laptop (team)*
- [ ] Voice in the Ask tab: on the demo laptop in Chrome, allow the microphone once, say the act-4 question, and check the spoken answer is audible on the venue speakers (or type)
- [x] Claims check (task 8.5, November 2026): nothing says engineering-grade accuracy, verified carbon savings, guaranteed returns or real-time monitoring

## On the demo laptop

- [ ] Plugged in, battery saver off, notifications off (Do Not Disturb)
- [ ] Browser zoom 100%, full screen, bookmarks bar hidden
- [ ] Tested on the actual external screen or projector resolution
- [ ] Phone hotspot ready if venue Wi-Fi fails (everything works offline after load except a live AI answer, which is cached)
- [ ] Backup video open in another tab

## If something breaks (keep this card next to the laptop)

| What you see | Do this (in seconds) | Say |
| --- | --- | --- |
| The app is in a strange state (wrong hotel, a what-if left on, a plan applied) | **Reset demo** in the top bar; it returns to the portfolio with everything cleared | "Let me reset the demo." |
| The 3D map is blank or slow | **2D** in the map toolbar, or **Use the simplified map** (the drawn map needs no tiles) | "Same data, flat view." |
| The 3D hotel twin is slow, black or missing | **2D** above the twin (it uses the same model and numbers) | "Same model in 2D." |
| The advisor spins or says it can't reach the AI | Wait 8 s: the template answer appears with the same engine result cards and buttons. Rehearsed questions answer instantly (saved in the browser) | "The numbers come from the engine either way; the AI only explains them." |
| Wi-Fi drops | Keep going: everything runs in the browser after load; only a new live AI answer needs the network (saved ones still work). Phone hotspot as a backup | — |
| The tour pops up | **Skip**; it won't open again in this browser | — |
| A number differs from the script | Say the number on screen; the script follows the engine | "These are modeled estimates." |
| The page won't load at all | Switch to the backup video tab; continue the pitch over it | "Here's a recording of the same flow." |

## Demo path (6–7 minutes) — run 5 times in a row without a failure

Story: *the owner of a five-hotel Chicago chain has one budget and three vendors pitching solar, smart thermostats and LEDs. Energy Twin shows
her where the money goes, lets her test a decision with the AI, and tells her what to buy — before she spends a dollar.*
Every figure below comes from the engine (synthetic Lakefront Hotel Group; the hotel is its top priority, Riverwalk Grand, 300 rooms).
**If the engine changes, re-run the numbers (task 8.8) and update this script, never the other way round.** Compact figures on screen
(e.g. $1.56M) are the same values as the exact ones below.

| Time | Act (the wow) | Do | Say (figures as of now) |
| --- | --- | --- | --- |
| 0:00–0:45 | **1. A city-scale digital twin** | After **Reset demo** the app opens on **Your Hotel Portfolio**: the 3D Chicago map. Point at the KPI cards, then the **Top investment opportunity** card | "**5** hotels, one map. They spend **$1,561,819** a year on energy, and their best upgrades could save **$109,905** — **7.0%** of the bill. Where do you start? Not with the biggest bill: Lakefront Convention spends **$591,679** but returns less per dollar. Start with **Riverwalk Grand**: **$28,480** a year saved for **$116,820**, paid back in **4.1 years**." |
| 0:45–1:30 | **2. One budget, the whole chain** | **Optimize portfolio** (header) → **Find the best split** in the planner; hover the allocation bar | "One budget, **$500,000**, split by an exact search across every hotel's options: **$113,686** a year, payback **4.3 years**, **5 of 5** hotels funded. Every dollar on this bar is a package the engine evaluated." |
| 1:30–2:40 | **3. Fly into the building** | Map: click **Riverwalk Grand** (the camera flies in among the towers) → **Explore hotel**. In the twin: **Energy view**, click **Central HVAC**; season presets **January night**, then **July afternoon**; then **Flow** → width **Carbon** | "Its twin: **$374,741** a year, the central plant alone **$104,128**. A January night needs **242 kW** of heating; a July afternoon **307 kW** of cooling. Now switch the flow to carbon: gas is only **19%** of the bill but **31%** of the carbon — **1,301 t** a year in total. That's what carbon rules will price." |
| 2:40–3:40 | **4. Ask the AI to test a decision** | **4 Ask**: type, or tap the **mic** and say, *"What if occupancy rises to 85%?"* (turn on the speaker to hear the answer) → the engine's result card → **Apply this what-if** | "The AI doesn't guess: it asks our engine to run the what-if. A conference season at 85% takes the bill from **$374,741** to **$399,140**, **$24,399** more. One click and the twin shows it. Every number it quotes is checked against the model." |
| 3:40–5:00 | **5. What should she buy?** | **3 Invest**: budget **$150,000**, "Optimize for this scenario" on → **Find the best investments**; open the top package and its 10-year projection; **Compare all upgrades** → point at solar; **Apply** the top package → **Split** | "It tested **512** combinations; **41** fit the budget and comfort limits. Best: roof insulation, LED and occupancy sensors, **$132,578**, saving **$32,750** a year, paid back in **4.0 years**, **$224,780** net over ten years and **88 t** of CO₂ a year. Solar? **$128,030** and a **19.8 years** payback here. Applied: **$366,390** a year. And it says which costs are placeholders: get quotes." |
| 5:00–5:50 | **6. Hand it to the owner** | **Preview report** (then show the PDF pages) | "One click, a PDF for the owner and the bank: the recommendation, before and after, cash flow, and every assumption — labeled estimates, placeholder costs named." |
| 5:50–6:40 | **7. Back to the chain, and close** | **Portfolio** in the breadcrumb: the map is as she left it | "From one map to one building to one decision. Estimates, not an audit — but now she knows where to start. **Simulate smarter. Spend better. Save energy.**" |

**Why this order:** the business wow (the chain and its top opportunity) lands in the first 45 seconds; the visual wow (the 3D city, the
building, the carbon flow) carries the middle; the AI moment shows the engine and the AI working together; the decision and the report
close on money. Every act ends on a number the judge can check on screen.

**Wow moments to hit, and their backups:** the fly-in among the towers (backup: **2D**, then the drawn map); the carbon flip on the Flow
view (works without WebGL); the AI result card with Apply (works offline: the same engine tool runs from a keyword parser, see below);
the allocation bar and the split twin.

**Before every run:** press **Reset demo** (top bar); it returns to the portfolio homepage. The onboarding tour (quick 8 steps or full 18) starts by itself only on a browser's first visit, and once more on browsers that saw the earlier
tour: run it (or skip it) once on the demo laptop beforehand so it does not open mid-demo. **Figures:** `src/test/demoScript.test.ts` walks this path through the app's store and
fails if any bold figure above no longer matches the engine; print the current ones with
`DEMO_FIGURES=1 npx vitest run src/test/demoScript.test.ts` (task 8.8).

**Advisor answers (task 8.2):** a live answer that passes the number check is saved in the browser (local storage,
`energy-twin:advisor-answers:v1`), keyed by the question and every result it may use. Ask the act-4 question once during the rehearsal on the
demo laptop, in the same state as the demo (after acts 1–3): from then on it returns the same text instantly, even offline or after a reload;
Reset demo keeps it. Each saved answer is re-checked against the results before it is shown, and if the state differs (for example another
budget) the advisor asks again. If the live advisor cannot be reached, the template answer covers the plan and why solar is left out.

**3-minute cut** (if the slot has a hard limit): act 1 (0:00–0:35, KPIs and the top opportunity), act 3 shortened (0:35–1:20: fly in,
Explore, the carbon flip only), act 4 (1:20–2:00, the AI what-if and Apply), act 5 (2:00–2:50: find the best investments, the top package,
one line on solar), then the close "Estimates, not an audit. Simulate smarter. Spend better. Save energy." (2:50–3:00).

**Fallbacks:** no WebGL or a slow laptop → 2D button (the script works in 2D; skip act 3's 3D moments). Advisor slow or offline → the saved
answer (task 8.2) appears at once, or the template answer within 8 s. Wrong state → the **Reset demo** button (task 8.7).

## Advisor questions to ask (tested)

Use these in rehearsal and when a judge asks "can I try it?". Each question below was run through the engine tools on the synthetic
Lakeshore Inn (100 rooms, Chicago) and the Lakefront Hotel Group portfolio in November 2026; the figures are what the engine computed
then. **The script follows the engine:** if a figure changes, re-run and update this table, never the other way round.

What was tested: the tool selection and the template answer (the offline path, `planToolCalls` → `runTool` → `toolAnswer`, branch
`ai/advisor-agent`). **Not yet tested with the live model** (this environment cannot reach the function). Once the advisor function is
redeployed (docs/23, tasks 15.10–15.11), ask each question once on the demo laptop so the answer is saved (task 8.2).

Where to ask: hotel questions in the **Ask** tab of the hotel; portfolio questions in **Ask about the portfolio** on the portfolio page.

### 1. What-ifs (operations)

| Ask | Tool the engine runs | Answer (engine figures) |
| --- | --- | --- |
| *"What if occupancy rises to 85%?"* | `run_scenario` occupancy 85% | $120,178 → $133,047 a year (+$12,869, +10.7%); driver: occupancy and guest activity. Button: **Apply this what-if** |
| *"What if electricity prices go up 20%?"* | `run_scenario` electricity +20% | $120,178 → $139,796 (+$19,618, +16.3%) |
| *"What if we turn on smart room controls?"* | `run_scenario` smart controls on | $120,178 → $118,488 (−$1,690, −1.4%) |
| *"What if we set the cooling setpoint to 76°F?"* | `run_scenario` cooling 76 °F | $120,178 → $119,348 (−$830, −0.7%) |

### 2. Investment plans (budget)

| Ask | Tool | Answer |
| --- | --- | --- |
| *"What should I do with $50,000?"* | `find_best_plan` $50,000 | 512 combinations tested, 14 fit; best: LED lighting + common-area occupancy sensors, $38,940 after counted incentives, about $9,022 a year, payback about 4.3 years, 10-year NPV $26,200. Buttons: **Apply this package**, **Make this my plan**, **Preview report** |
| *"What is the best plan for $25,000?"* | `find_best_plan` $25,000 | 3 fit; best: occupancy sensors, $5,940, about $2,113 a year, payback about 2.8 years |

### 3. Comparing upgrades

| Ask | Tool | Answer |
| --- | --- | --- |
| *"Compare LED lighting and solar"* | `compare_upgrades` | LED: $33,000, about $7,826 a year, payback about 4.2 years, NPV $23,494. Solar (quarter roof): $45,540, about $2,161 a year, payback about 21 years, NPV −$30,097 (half roof also shown) |
| *"Is LED lighting better than smart room controls?"* | `compare_upgrades` | LED as above; smart controls: $20,375, about $1,690 a year, payback about 12.1 years, NPV −$7,896 |

### 4. Stress tests (risk)

| Ask | Tool | Answer |
| --- | --- | --- |
| *"What happens in a heat wave?"* | `run_stress_test` heat wave | July 10 °F hotter: $120,178 → $126,767 (+$6,589, +5.5%), one-off. Button: **Open this stress test** |
| *"How does a conference surge affect our bill?"* | `run_stress_test` conference surge | September occupancy +25 points: +$1,058 (+0.9%), one-off |
| *"What happens in the off-season?"* | `run_stress_test` low occupancy | January–March occupancy −20 points: −$2,538 (−2.1%) |
| *"What if we have a cold snap?"* | `run_stress_test` cold snap | January 12 °F colder: +$649 (+0.5%) |

### 5. The portfolio (chain questions)

| Ask | Tool | Answer |
| --- | --- | --- |
| *"Which hotel should we invest in first, and why?"* | `portfolio_overview` | 5 hotels, about $1,561,819 a year on energy, about $109,905 a year of savings potential; Riverwalk Grand first (100 of 100), about $28,480 a year |
| *"How would you split $250,000 across the chain?"* | `portfolio_optimize` $250,000 | About $64,900 a year for $248,326 after counted incentives, payback about 3.8 years; funds Lakeshore Inn, Riverwalk Grand and O'Hare Gateway. Button: **Open the portfolio plan** |
| *"Which hotels get nothing if we split $100,000?"* | `portfolio_optimize` $100,000 | About $31,831 a year for $98,506, payback about 3.1 years; funds three hotels (the offline answer lists who is funded, not who is left out; the live AI should name the others) |

### 6. Why questions (explanations; best with the live AI)

| Ask | What happens |
| --- | --- |
| *"Why not solar, and what should I do with $50,000?"* | Runs `find_best_plan`; the answer explains why solar pays back slowly here (good for Q&A) |
| *"Why is HVAC my biggest cost?"* | No tool needed: the AI explains the zone and end-use figures already on screen. Offline: template answer |
| *"What are the risks?"* | The AI may run stress tests; offline: template answer |

**Avoid in the demo** (found in testing):
- Asking for an objective in words ("…with the **fastest payback**"): the offline parser keeps the budget but not the objective, so it ranks
  balanced. Set the objective in the Invest tab instead, or check the live AI's answer in rehearsal.
- A plan for another hotel from the hotel's Ask tab ("what would $50,000 buy at Riverwalk Grand?"): open that hotel first (P2 in docs/23).
- Expecting big savings from smart room controls or setpoints alone: the engine computes about 1–1.5% here; the larger savings are
  LED and sensors. Let the numbers lead.

## Q&A prep

| Question | Answer owner | Short answer |
| --- | --- | --- |
| How accurate are the savings? | Engine lead | Planning estimates from public and benchmark data, shown as ranges and labeled synthetic where they are; not an engineering audit. Compared against a benchmark; an operator can load 12 months of bills (Hotel tab → Manage Utility Data) and calibrate the model to them, with ASHRAE Guideline 14 fit metrics (docs/19) |
| How is this different from Eden? | Pitch lead | Eden designs new net-zero single-family homes for architects and builders. We help operators of **existing** buildings simulate operating decisions and pick investments |
| How is it different from ENERGY STAR Portfolio Manager? | Pitch lead | Portfolio Manager benchmarks past performance. We simulate what happens next and rank what to buy within a budget |
| Does the AI make up numbers? | Engine lead | No. A deterministic engine computes everything; the AI only explains, and the app rejects any answer with a number that is not in the results |
| How do you handle guest comfort? | Engine lead | Comfort is a constraint: setpoint and schedule changes that could hurt guests are flagged and the optimizer respects a comfort margin |
| What about demand charges and complex tariffs? | Engine lead | Flat all-in average rates (EIA) for now; tariffs are on the roadmap |
| Why not solar? / Are incentives included? | Engine lead | Solar is sized to the roof and priced per W; for this hotel it pays back slowly. Only incentives with a confirmed rate for this year are counted: ComEd's 2026 guest-room controls rate is; its lighting rate is still the 2025 one, so it is shown separately as "if ComEd renews the 2025 rate". The federal solar credit and gas rebates are listed, not counted |
| Where do the numbers come from? | Engine lead | EIA prices, the EIA hotel end-use survey (CBECS 2018), EIA price outlook (AEO2026), EPA eGRID2023 grid emissions by region, NOAA weather normals, NREL PVWatts solar output, the Illinois technical reference manual for upgrade savings; installed costs and solar $/W are still labeled placeholders |
| Why hotels? | Pitch lead | They run 24/7, occupancy swings energy use, and owners often have no energy team |
| What's next? | Pitch lead | Utility-bill calibration, live building data, multi-property optimization, offices, retail, hospitals and factories |
