# 07 — Demo checklist (hotel product)

The demo follows section 12 of [10_HOTEL_SPEC.md](10_HOTEL_SPEC.md). Task numbers refer to [11_HOTEL_TASKS.md](11_HOTEL_TASKS.md).

## Freeze rules

- **Hour 36:** twin and simulator frozen (bug fixes only).
- **Hour 40:** everything frozen. Only fixes for things that break the demo path.
- **Hour 34:** record a 60–90 s screen capture of the key moments (3D, what-if, packages, advisor). Put it in the slides as a backup.
- Do not sacrifice a working P0 feature for P2 polish.

## Before rehearsals

- [ ] All data placeholders replaced and `"verified": true`, or clearly labeled "estimated" or "synthetic" on screen
- [x] The demo hotel's results sanity-checked against the ENERGY STAR hotel median (63.0) and CBECS lodging (85.7): 86.5 kBtu/ft², 37% above
      the median (cold climate, restaurant). Shown in the app as context (benchmark card, LV15); noted for Q&A
- [ ] 3D view loads on the demo laptop and projector (WebGL); "reduce effects" and the 2D switch tested as a fallback
- [x] Dollar, kWh and carbon figures in the pitch script match what the app shows (checked by `src/test/demoScript.test.ts`, November 2026)
- [ ] `npm run build` passes; no console errors on the demo path
- [ ] Published Lovable URL works in an incognito window
- [ ] Advisor answers for the demo questions are cached (ask them once in the rehearsal on the demo laptop; saved in local storage), and the template fallback is tested by turning the function off
- [x] Claims check (task 8.5, November 2026): nothing says engineering-grade accuracy, verified carbon savings, guaranteed returns or real-time monitoring

## On the demo laptop

- [ ] Plugged in, battery saver off, notifications off (Do Not Disturb)
- [ ] Browser zoom 100%, full screen, bookmarks bar hidden
- [ ] Tested on the actual external screen or projector resolution
- [ ] Phone hotspot ready if venue Wi-Fi fails (everything works offline after load except a live AI answer, which is cached)
- [ ] Backup video open in another tab

## Demo path (6–7 minutes) — run 5 times in a row without a failure

Story: *a hotel GM is being pitched solar, smart thermostats and LEDs and doesn't know which pays. Energy Twin lets her test before she spends.*
Every figure below comes from the engine (synthetic 100-room Lakeshore Inn, Chicago, November 2026 data). **If the engine changes, re-run
the numbers (task 8.8) and update this script, never the other way round.**

| Time | Act | Do | Say (figures as of now) |
| --- | --- | --- | --- |
| 0:00–0:40 | **1. The problem** | Title slide, then the app (after **Reset demo**): it opens on **Your Hotel Portfolio** (the chain on the map); click **Lakeshore Inn** on the map, then **Explore hotel** | "Hotels run 24/7, occupancy swings the bill, and most owners have no energy team. Here's a chain on one map; let's open one hotel. This hotel spends **$120,178** a year on energy. Every vendor says their product is the answer." |
| 0:40–1:40 | **2. Meet the twin** | Let the 3D fly-in play; turn on **Energy view**; click **Central HVAC** (camera glides), then **Guest rooms** | "A digital twin of an existing hotel, synthetic but built from public data. The plant is the biggest cost at **$34,152**, then guest rooms **$21,587** and hallways **$21,130**." Benchmark card: "**86.5 kBtu/ft²**, **37% above the ENERGY STAR hotel median of 63**: there is room to save." |
| 1:40–2:40 | **3. A living building** | Season presets **January night** (21:00), then **July afternoon** (15:00); point at the hourly readout and the street; **Flow** tab with the animated Sankey | "Same clock for the whole hotel. A January night: **80 kW** of heating, the roof unit glows red, lit windows are guests in their rooms. July afternoon: **102 kW** of cooling. The people outside are guests who are out right now, from the model." |
| 2:40–3:40 | **4. Test an operating decision** | Scenario: occupancy **60% → 85%**; open "why it changed"; turn on **smart room controls** | "A conference season: the bill rises **$12,869** to **$133,047**. Smart room controls claw back **$1,014**: less than you'd think, because at 85% few rooms are empty. That's the kind of thing you want to know before buying." |
| 3:40–5:10 | **5. Spend the budget** | Invest: **$50,000**, "optimize for this scenario" (on by itself); **Find the best investments**; show the three packages; open the **10-year projection** on the top one; open **Compare all upgrades** and point at solar; **Apply** the top package and show the split twin | "It tested every combination, **256**, and **10** fit the budget and comfort limit. Best: **LED lighting + occupancy sensors**: **$38,940** installed (**$0** in counted incentives, so **$38,940** net), saving **$10,302** a year, payback **3.8 years**, **$73,209** over ten years, **27 t** of CO2 a year. ComEd's lighting incentive is shown separately: its 2026 rate isn't confirmed yet, so we don't count it. If ComEd renews the 2025 rate, that's **$14,756** back, **$24,184** net and **2.3 years**. Fastest: sensors alone, **2.5 years**. Solar on the full roof costs **$159,500** (LBNL national median, $2.90/W) and takes about **18.5 years** here, so it isn't recommended — and we only count incentives the utility has published for this year." After **Apply**: "the twin now shows the hotel after the upgrade: **$121,731** a year at 85% occupancy." |
| 5:10–6:00 | **6. Ask the advisor** | Ask: *"Why not solar, and what should I do with $50,000?"* (saved from the rehearsal, task 8.2) | "The answer is written by Claude but every number comes from the model; the app rejects any answer with a number that isn't in the results." |
| 6:00–6:40 | **7. Scale and honesty** | Switch to the **300-room** preset (baseline **$374,741**), budget **$150,000**, **Find the best investments**; then close on the before/after strip (energy, cost, carbon) | "A 300-room downtown hotel: **insulation + LED + occupancy sensors**, **$132,578** (**$132,578** net, or **$88,309** if ComEd renews its 2025 lighting rates), **$30,323** a year, **4.4 years**. Estimates, with sources and ranges; not an audit and not live monitoring. *Simulate smarter. Spend better. Save energy.*" |
| 6:40–7:00 | Buffer, or the chain | Optional if time allows: **Portfolio** in the top bar (or the breadcrumb): the map comes back as you left it; point at **Start here** | "Our **5** Chicago hotels spend **$1,561,819** a year; their best packages would save **$109,905**. Start with **Riverwalk Grand (100 of 100)**." Otherwise hand over to Q&A |

**Before every run:** press **Reset demo** (top bar); it returns to the portfolio homepage. The onboarding tour starts by itself only on a browser's first visit: run it (or skip it) once on
the demo laptop beforehand so it does not open mid-demo. **Figures:** `src/test/demoScript.test.ts` walks this path through the app's store and
fails if any bold figure above no longer matches the engine; print the current ones with
`DEMO_FIGURES=1 npx vitest run src/test/demoScript.test.ts` (task 8.8).

**Advisor answers (task 8.2):** a live answer that passes the number check is saved in the browser (local storage,
`energy-twin:advisor-answers:v1`), keyed by the question and every result it may use. Ask the act-6 question once during the rehearsal on the
demo laptop, in the same state as the demo (after acts 1–5): from then on it returns the same text instantly, even offline or after a reload;
Reset demo keeps it. Each saved answer is re-checked against the results before it is shown, and if the state differs (for example another
budget) the advisor asks again. If the live advisor cannot be reached, the template answer covers the plan and why solar is left out.

**3-minute cut** (if the slot has a hard limit): drop act 3 (a living building) and act 7 (scale and honesty), and tighten the rest:
act 1 (0:00–0:25), act 2 (0:25–1:00, keep Energy view and one zone click), act 4 (1:00–1:40), act 5 (1:40–2:30, packages and the solar line;
skip the projection), act 6 (2:30–2:55), then the one-line close "Estimates, not an audit. Simulate smarter. Spend better. Save energy." (2:55–3:00).

**Fallbacks:** no WebGL or a slow laptop → 2D button (the script works in 2D; skip act 3's 3D moments). Advisor slow or offline → the saved
answer (task 8.2) appears at once, or the template answer within 8 s. Wrong state → the **Reset demo** button (task 8.7).

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
