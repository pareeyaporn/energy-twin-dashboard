# 07 — Demo checklist

## Freeze rules

- **Hour 36:** 3D frozen (bug fixes only).
- **Hour 40:** everything frozen. Only fixes for things that break the demo path.
- **Hour 34:** record a 30–45 s screen capture of the full wow sequence. Put it in the slides as a backup.

## Before rehearsals

- [ ] All data placeholders replaced and `"verified": true` (or clearly labeled "estimated" on screen)
- [ ] Maya's results sanity-checked against Rewiring America's planner; note the comparison for Q&A
- [ ] Dollar figures in the pitch script match what the app actually shows
- [ ] `npm run build` passes; no console errors on the demo path
- [ ] Published Lovable URL works in an incognito window
- [ ] Explanation for Maya + $15k + best value is cached

## On the demo laptop

- [ ] Plugged in, battery saver off, notifications off (Do Not Disturb)
- [ ] Browser zoom 100%, full screen, bookmarks bar hidden
- [ ] Tested on the actual external screen / projector resolution
- [ ] 60 fps in Thermal Vision with leaks on; if not, turn on "Reduce effects" and re-check
- [ ] Phone hotspot ready if venue Wi-Fi fails (app should work offline after load except AI — cached)
- [ ] Backup video open in another tab
- [ ] 2D fallback tested (disable WebGL once to confirm it renders)

## Demo path (3 minutes) — run 5 times in a row without a failure

1. Pick Maya's preset → house assembles
2. Thermal Vision on → hover attic → card shows its $/yr loss
3. Budget $15,000, goal "Best 15-year value" → Find my best upgrades → 32 combinations
4. Package 1 auto-applies → install sequence → bill counter drops
5. Open plan drawer → explanation + sources
6. Switch to slides: roadmap + metrics

## Q&A prep

| Question | Answer owner | Short answer |
| --- | --- | --- |
| How accurate are the savings? | Engine lead | Public data (ResStock, EIA), shown as ranges; compared with Rewiring America; planning estimate, not an audit |
| How is this different from Rewiring America? | Pitch lead | Best combination for a fixed budget, built for new buyers, visual explanation of where money leaks |
| Why would partners pay if you're neutral? | Pitch lead | Ranking ignores who pays; agents/lenders want engaged buyers; contractors want ready-to-buy leads |
| What if prices fall? | Engine lead | Price-growth slider; insulation still pays back at 0% growth |
| What's next? | Pitch lead | Rebate API, bill upload, then landlords and schools |
