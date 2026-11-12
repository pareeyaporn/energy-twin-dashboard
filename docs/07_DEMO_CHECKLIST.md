# 07 — Demo checklist (hotel product)

The demo follows section 12 of [10_HOTEL_SPEC.md](10_HOTEL_SPEC.md). Task numbers refer to [11_HOTEL_TASKS.md](11_HOTEL_TASKS.md).

## Freeze rules

- **Hour 36:** twin and simulator frozen (bug fixes only).
- **Hour 40:** everything frozen. Only fixes for things that break the demo path.
- **Hour 34:** record a 30–45 s screen capture of the full sequence. Put it in the slides as a backup.
- Do not sacrifice a working P0 feature for P2 polish.

## Before rehearsals

- [ ] All data placeholders replaced and `"verified": true`, or clearly labeled "estimated" or "synthetic" on screen
- [ ] The demo hotel's results sanity-checked against an ENERGY STAR Portfolio Manager benchmark; the comparison is noted for Q&A
- [ ] Dollar, kWh and carbon figures in the pitch script match what the app shows
- [ ] `npm run build` passes; no console errors on the demo path
- [ ] Published Lovable URL works in an incognito window
- [ ] Advisor answers for the demo questions are cached, and the template fallback is tested by turning the function off
- [ ] Claims check: nothing says engineering-grade accuracy, verified carbon savings, guaranteed returns or real-time monitoring

## On the demo laptop

- [ ] Plugged in, battery saver off, notifications off (Do Not Disturb)
- [ ] Browser zoom 100%, full screen, bookmarks bar hidden
- [ ] Tested on the actual external screen or projector resolution
- [ ] Phone hotspot ready if venue Wi-Fi fails (everything works offline after load except a live AI answer, which is cached)
- [ ] Backup video open in another tab

## Demo path (3 minutes) — run 5 times in a row without a failure

1. Introduce a hotel owner with rising energy costs and unclear upgrade choices (30 s)
2. Open the synthetic 100-room Chicago hotel and show zone-level energy and cost
3. Change occupancy from 60% to 85%, then enable smart room controls; show the cost strip and the "why it changed" panel
   (more guests raise the bill; the controls claw part of it back)
4. Enter a $50,000 budget (Invest tab, "Optimize for this scenario" turns on by itself), generate the three packages, compare cost, savings,
   payback, five- and ten-year net benefit and carbon; apply one and show the split before/after twin
5. Ask the advisor the question chosen after calibration (see `docs/10`, section 12) and point out that the answer uses the model's numbers
6. Close with before/after energy, cost and estimated carbon. Core message: *Energy Twin helps hotel owners test energy decisions before spending real money.*

## Q&A prep

| Question | Answer owner | Short answer |
| --- | --- | --- |
| How accurate are the savings? | Engine lead | Planning estimates from public and benchmark data, shown as ranges and labeled synthetic where they are; not an engineering audit. Compared against a benchmark; calibration to real bills is on the roadmap |
| How is this different from Eden? | Pitch lead | Eden designs new net-zero single-family homes for architects and builders. We help operators of **existing** buildings simulate operating decisions and pick investments |
| How is it different from ENERGY STAR Portfolio Manager? | Pitch lead | Portfolio Manager benchmarks past performance. We simulate what happens next and rank what to buy within a budget |
| Does the AI make up numbers? | Engine lead | No. A deterministic engine computes everything; the AI only explains, and the app rejects any answer with a number that is not in the results |
| How do you handle guest comfort? | Engine lead | Comfort is a constraint: setpoint and schedule changes that could hurt guests are flagged and the optimizer respects a comfort margin |
| What about demand charges and complex tariffs? | Engine lead | Flat all-in average rates (EIA) for now; tariffs are on the roadmap |
| Why not solar? / Are incentives included? | Engine lead | Solar is sized to the roof and priced per W; for this hotel it pays back slowly. Incentives are listed but only applied when confirmed (the federal credit's deadlines changed in 2025), so the figures are before incentives unless one is entered |
| Where do the numbers come from? | Engine lead | EIA prices, the EIA hotel end-use survey (CBECS 2018), EIA price outlook (AEO2026) and EIA grid emissions; upgrade savings from DOE, PNNL, LBNL and the Illinois technical reference manual; the rest is labeled placeholder |
| Why hotels? | Pitch lead | They run 24/7, occupancy swings energy use, and owners often have no energy team |
| What's next? | Pitch lead | Utility-bill calibration, live building data, multi-property optimization, offices, retail, hospitals and factories |
