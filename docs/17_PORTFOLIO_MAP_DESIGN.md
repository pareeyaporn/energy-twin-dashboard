# 17 — Portfolio city map: design (`src/portfolio/`)

The city map on the Portfolio page is the hotel chain's command center: where every hotel is, how it compares on one metric, and the way
into each hotel's digital twin. This document describes its look and behavior. It is **display only**: every value comes from the engine
through the store (`selectPortfolioSummary`); the map changes no calculation, assumption or data. Tasks: docs/11, 13.39–13.48.

## Layout

```
┌ Metric toolbar (segmented) ───────────────────────────┐  [2D|3D] [Columns] [Show all hotels]  Use the simplified map
┌ Map (rounded 2xl, navy, soft inner vignette) ──────────────────────────────────────────┐
│ ┌ Hotel card (on select) ┐                                   ┌ Hotels · 5 (collapsible) ┐│
│ │                        │      markers on the map           │ 1 ● O'Hare …   97.9      ││
│ └────────────────────────┘                                   │ 2 ● Riverwalk  90.5      ││
│ ┌ Legend ─────────┐                                          └──────────────────────────┘│
│ └─────────────────┘                                                         [+][−] ©     │
└─────────────────────────────────────────────────────────────────────────────────────────┘
  Metric note · fallback note · "Hotels close together fan out…"
```

| Width | Map height | Hotel card | Hotel list | Legend |
| --- | --- | --- | --- | --- |
| ≥ 1024 px (desktop) | 540 px | over the map, top left (300 px) | over the map, top right (288 px), up to the map height minus 7.5 rem, scrolls | bottom left, full (240 px) |
| 640–1023 px (tablet) | 480 px | over the map, top left | below the map, full width | bottom left, full |
| < 640 px (phone) | 400 px | below the map, full width | below the card, full width | bottom left, compact (170 px: metric, gradient, low and high) |

The KPIs, filters and organization switcher above the map are unchanged; the map is the page's visual focus through its size and depth
(a 24 px soft drop shadow and a faint cyan inner ring), not through louder colors.

## Colors and tokens

- App tokens: `--primary` (cyan accents: active toolbar segment, selected list row, rank chip on the card, focus rings), `--foreground`,
  `--muted-foreground`, `--glass-border` (all borders), `--efficient` → `--heat` → `--loss` (the "use" scale), `--savings` (the
  "opportunity" scale). Metric colors come from `metricColors` in `metrics.ts` (unchanged), scaled between the lowest and highest hotel.
- Panels (card, list, legend, tooltip): navy glass `oklch(0.18 0.04 263 / 0.9–0.96)` with backdrop blur, 12–16 px radius, a restrained
  shadow `0 8–18px 24–40px −12–18px rgb(0 0 0 / 0.8–0.9)`.
- Basemap palette (`BASEMAP` in `MapLibreView.tsx`, shared by the fallback):

| Element | Color |
| --- | --- |
| Background / labels' halo | `#060e1d` |
| Land, residential | `#0a1426` |
| Parks | `#0b1a2a` |
| Water (Lake Michigan) | `#0e2c50` (water shadow `#0a1f39`) |
| Rivers and canals | `#123760` |
| Buildings | `#0d1a2e` |
| Major roads (motorway, trunk, primary) | `#21324d` |
| Minor roads, rail, paths, aeroways | `#142139` (rail, paths, service at 45% opacity) |
| Boundaries | `#1c2a43` at 60% |
| Place labels | `#5a6e8e` at 55% (country and state 35%) |
| "Lake Michigan" label | `#4d85b8` at 75%, italic, uppercase, letter-spacing 0.28 em |

## Basemap restyle rules (street map)

The style is Carto's free **dark-matter** (no key; `basemaps.cartocdn.com`, attribution shown, compact). After it loads, `restyleBasemap`
walks every layer and repaints by type and id, so the rules survive small upstream changes:

- `background` → background color.
- `fill`: `water_shadow` → water shadow; `water` → water, opacity 1; `park|nature|wood|grass` → parks; `land|residential` → land;
  `building` → buildings (outline the same, so blocks read as texture); `aeroway` → minor road color.
- `line`: `waterway|river|canal` → rivers; `boundary` → boundaries; roads (`road|highway|motorway|trunk|primary|secondary|tertiary|street|bridge|tunnel|rail|path|service|aeroway`)
  → major or minor road color.
- `symbol`: **hidden**: points of interest, house numbers, road names and shields, one-way arrows, transit, rail, aeroway and all water
  labels (the app draws its own Lake Michigan label offshore, south of downtown, clear of the list). Other labels (places) → muted color and halo.
- In **2D** rotation and pitch are off (a flat plan view); zoom buttons sit bottom right. In **3D** see "3D mode" below.

## Markers (`HotelMarker.tsx`, both maps)

- **Anatomy:** a 32 px rounded-square tile (10 px radius), navy fill, a 2 px border and a building icon (lucide `Building2`) in the
  hotel's metric color; a rank chip (top right, metric color, dark text: 1 = highest on the selected metric); a small white dot (bottom left)
  on the user's own hotels.
- **Glow:** `0 0 14px 2px` of the metric color at 40% (hover or selected: `22px 5px` at 60%), plus a 1 px ring at 35%, and a soft drop
  shadow. Color, border and glow fade over 450 ms when the metric changes.
- **States:** rest (scale 1) · hover or keyboard focus (scale 1.08, stronger glow, tooltip, drawn above the others) · selected (scale 1.18,
  a white ring at 85%, a slow cyan ping ring every 2.2 s, drawn above the rest; `aria-pressed`). Scale and glow transitions: 200–250 ms.
- **Tooltip** (hover or focus, not when selected): hotel name, a metric-colored dot, the metric and its value, "Click for details";
  `role="tooltip"`, linked with `aria-describedby`.
- **Position:** exactly the hotel's latitude and longitude (MapLibre markers anchored at the center; the fallback projects the same
  coordinates).

## Overlapping hotels (`spread.ts`)

Downtown hotels sit a few hundred meters apart, and two hotels added in the same area share coordinates. On every zoom, markers closer than
**34 px** on screen are grouped (union–find on pairwise distance) and fanned out on a circle around the group's center, radius
`max(0.7 × 34, 34 / (2 sin(π / n)))`, starting at the top, in a stable order. A fanned marker keeps a dashed leader line to a 3 px dot at
its true location. Offsets animate (260 ms). Every hotel stays clickable at any zoom. Distant markers are never moved.

## Interactions

| Action | Result |
| --- | --- |
| Hover or focus a marker | tooltip; the hotel's row in the list is highlighted |
| Hover or focus a list row | that marker is highlighted (tooltip) |
| Click a marker | selects it: card opens, map flies to it; clicking it again deselects |
| Click a list row | selects it and flies to it |
| Click the map itself, the card's ×, or press Escape | closes the card |
| Change the metric | colors fade (450 ms), ranks, list order and legend update; the selection stays |
| Show all hotels | fits every hotel in view (900 ms) |
| Filters or organization change | the map fits the hotels now shown (800 ms) |

- **Fly-to (street map):** `flyTo` to zoom ≥ 13, speed 1.1, curve 1.42, padded so the hotel lands between the card and the list
  (desktop: 330 px left, 310 px right; tablet: 330 px left; phone: extra 110 px at the bottom for the legend).
- **Fly-to (drawn map):** the same idea, animated in JavaScript over 750 ms (cubic in-out, zoom interpolated in log space), to 2.6 × the
  fitted scale.
- **Fit padding:** desktop 70 / 120 / 90 / 330 px (top, bottom, left, right: clear of the list and the legend); tablet 60 / 120 / 60 / 60;
  phone 50 / 120 / 30 / 30; maximum zoom 13.

## Hotel card (`PropertyCard.tsx`)

On selection: a 4 px gradient bar and an icon tile in the hotel's metric color; name, neighborhood and segment, brand and region; "#n in the
portfolio by the map's metric"; four stat tiles — **Annual energy cost, Energy intensity, Savings potential, Rooms** (the tile for the
selected metric is outlined in cyan); occupancy, annual energy and investment priority as small rows; the data label (demonstration
property · synthetic · modeled estimates, or your hotel · your inputs); the **Explore digital twin** button (opens the hotel's twin, as
before) and a close button.

## Hotel list (`PropertyList.tsx`)

"Hotels · n", "Ranked by [metric], highest first", collapsible (`aria-expanded`). Each row: rank, a glowing color dot, name, a bar
proportional to the value (relative to the highest), neighborhood, the value. The ranking (`rankBy` in `CityMap.tsx`) is highest first for
every metric (most cost or intensity = needs attention; most savings or priority = act first); ties by name. The selected row has a cyan
tint and ring (`aria-current`).

## Metric toolbar and legend

- **Toolbar:** one segmented control (`role="radiogroup"`): Energy cost ($), Energy intensity (gauge), Savings potential (piggy bank),
  Investment priority (target); short labels on phones (Cost, Intensity, Savings, Priority); the active segment is cyan on a cyan-tinted fill.
- **Legend:** "Colored by", "Estimate", the metric, its unit in words (US dollars a year · kBtu per ft² a year · score out of 100), the
  gradient with the portfolio's lowest, middle and highest values, and what a high value means ("Higher = uses more energy per ft²",
  "spends more", "bigger savings opportunity", "invest here first"). Compact on phones.

## Drawn fallback map (`MapFallback.tsx`)

Used when WebGL or the tile host is unavailable, or when the user picks "Use the simplified map". Same palette, markers, card, list, legend
and interactions. Drawn in screen pixels from the hotels' coordinates: land with a faint 48 px grid, simplified expressways and arterials,
the Chicago River branches, Lake Michigan as a gradient polygon east of a simplified shoreline (with a soft shore glow) and its label
offshore in the lower part of the view; neighborhood labels (downtown ones appear only once zoomed in, so they never crowd the markers).
It fits all hotels (at least 0.05° across) and flies like the street map. Geography is approximate; hotel positions are exact (stated
under the map).

## Reduce effects and accessibility

- **Reduce effects** (the app's setting) **or the system's reduced-motion preference** (`prefers-reduced-motion`, both since the 3D map):
  no glow, pulse or ping ring, no fades (the card appears without sliding), jumps instead of flights (also for 2D ⇄ 3D and Show all hotels),
  no marker-offset animation, the data columns change height at once. The selected hotel's beam stays, still.
- Markers and list rows are buttons: Tab order, Enter or Space to select, focus rings in cyan; each marker's label reads the hotel,
  neighborhood, metric value, rank and "Your hotel" where it applies; the tooltip is linked to the focused marker; the card is a labeled
  group; Escape closes it; the legend's gradient is decorative (values are in text); the screen-reader list of hotels with an Explore
  button per hotel remains.

## Multi-city mode (November 2026)

An organization can have hotels in several cities (the synthetic Meridian Hotels & Resorts: New York, Miami, Denver).

- **Street map.** Fit shows every hotel (a national extent). Below zoom 7 (`CITY_CLUSTER_ZOOM`), with hotels in more than one city, each city is
  one marker (`CityCluster.tsx`): a pill with the city's hotel count, its name and its figure for the map's metric (sum for energy cost and
  savings potential, floor-area-weighted intensity, best priority score), cyan border and glow. Hotel markers are hidden while clustered (the
  selected hotel stays visible); the "Lake Michigan" label is hidden too. Clicking a city marker zooms to that city's hotels.
- **City chips** above the map ("Cities: New York · 1, Miami · 2, Denver · 1") zoom to a city; the chosen chip is outlined. **Show all hotels**
  fits every hotel again.
- **Drawn map.** When the hotels are not all in Chicago, the drawn Chicago map is replaced by a schematic (`MultiCityFallback.tsx`): one panel per
  city (two columns from 640 px), navy land with a faint grid, the city name and hotel count, the city's figure for the metric, and the hotels at
  their relative positions within the city (scaled to fit; one hotel is centered). No streets or coastlines are drawn because none are sourced
  for these cities; the panels say "Schematic: one panel per city, not to scale with each other". The legend moves below the panels so it never
  covers a hotel. A city chip scrolls to its panel and outlines it.
- **Filters and totals.** A City filter appears when the organization spans several cities; "By city" is the default grouping for such
  organizations; the hotel card, tooltip and table show the city.

## Homepage and the way back (November 2026)

- The portfolio page is the homepage (`/`); the hotel dashboard is `/hotel`. The header reads "Your Hotel Portfolio" with the subtitle and the
  tagline; **Optimize portfolio** scrolls to the optimizer.
- KPI cards: energy cost, savings potential, carbon, properties first (large); the other totals in a compact strip (collapsible on phones).
- **Start here** (between the KPIs and the map) highlights the top investment priority with its reason; **Why this ranking?** opens the
  explanation (`PriorityExplainer.tsx`).
- The view is remembered in the store (`portfolioView`): metric, selected hotel, list state, table sort, the street map's camera (saved on every
  move end, restored when the map is created again) and the scroll position (restored after mount). Coming back from a hotel shows the same
  view, its card open and its table row highlighted.
- Marker tooltip: name; area, city and rooms; the metric's value; energy cost, intensity, savings and priority; "Click to open · Explore hotel".
  The card's button reads **Explore hotel**.

## Page structure after the cleanup (November 2026)

Decision first, detail on demand (about 1.9 screens at 1440 × 900, was 3.3):

1. Header: title, subtitle, one line (tagline, hotels and cities, synthetic label); **Optimize portfolio** and **Add my hotel**.
2. Organization and filters.
3. KPI cards (energy cost, savings potential, carbon, properties) and the compact strip (electricity, gas, total energy, intensity, rooms,
   budget).
4. **Start here** (the top priority and why).
5. The map with the ranked list.
6. **Portfolio investments** (one budget across the chain), moved up from the bottom: it is the chain's main action.
7. **Compare the hotels**: seven columns (hotel, energy cost, intensity, savings potential, investment required, payback, priority); location,
   brand, rooms, floor area, HVAC and occupancy are on the hotel card and the hotel page.
8. **Deeper analysis** (closed by default): totals by brand, region, ownership or city; electricity vs natural gas; portfolio stress tests;
   definitions and assumptions.

Removed: the cost, intensity and savings bar charts (the same figures as the map, the list and the table) and "More building types (coming
later)" (a roadmap item, for the slides). On the hotel dashboard: Opportunities & alerts come first in the Hotel tab, the KPI tiles are slim,
and the sample-hotel picker moved below the benchmark (the demo script still uses it for the 300-room sample).

## 3D mode (November 2026; `camera3d.ts`, `buildings3d.ts`)

The street map has a **2D / 3D** toggle (a small segmented control next to Show all hotels, only when the street map is in use). 3D is the
default; the choice is a view preference kept in local storage (`energy-twin:map-mode`), not in the store. 2D is exactly the earlier flat map.

### Buildings: data source and heights

- **Source:** the basemap's own vector tiles. Carto's free dark-matter style (no key, no account; `basemaps.cartocdn.com`) now serves the
  Protomaps schema (`carto.streets/v2`); its `buildings` source layer carries OpenStreetMap footprints and, for many of them, a `height` (from the
  OSM `height` tag or the number of floors, as processed by the tile producer). Checked on 13 November 2026 on a z15 downtown Chicago tile:
  933 footprints, 380 with a height (5 to 527 m). No second building source is added. OpenFreeMap (OpenMapTiles schema) was evaluated as an
  alternative but its host is blocked from the build sandbox, and the current basemap already has heights.
- **Height used, in order** (`HEIGHT_EXPR`): `render_height` (OpenMapTiles, should the style change schema) → `height` → floors × 3 m
  (`building:levels` or `levels`) → **6 m** (`FALLBACK_HEIGHT_M`, about two floors). The base is `render_min_height` or `min_height`, else 0.
  Nothing is invented per building: a footprint without height data is a uniform low block drawn in a **dimmer navy** (`#0b1627`), so it does not
  read as a measured height. Heights are approximate (OSM), never presented as exact.
- **Zoom:** the tiles carry buildings from z11 (merged, generalized blocks with rounded heights at z11–12) and individual footprints from z13.
  The extrusions rise in between zoom 10.5 and 11.5. At the "all hotels" view of the Chicago demo (zoom about 10.5–11, set by O'Hare being
  20 km from downtown) the city reads as a tilted plan with few, low blocks; the skyline rises as you zoom in, and a hotel picked in 3D is flown
  to zoom 15, where every tower stands.
- **Styling:** `fill-extrusion` under the labels, navy by height (`#0e1c33` low → `#13243f` 60 m → `#192f52` 150 m → `#223d68` 320 m+),
  92% opacity, vertical gradient; a soft cool light from the north-west (intensity 0.32) and a faint navy sky / fog where the tilt reaches the
  horizon. The flat building fills are hidden in 3D and come back in 2D.
- **Attribution:** "3D buildings: OSM heights, approximate" next to © OpenStreetMap contributors © CARTO (compact, behind the ⓘ button), and the
  note under the map: "3D buildings: OpenStreetMap footprints and heights from the basemap's tiles (approximate; buildings without height data
  are drawn low, in a dimmer navy)".

### Camera

- **Default 3D view:** pitch 55°, bearing −25° (looking north-north-west: downtown in front, the lake on the right, O'Hare further back) when the
  hotels are in one city; north up when they span more than 2° (several cities). Every hotel is framed with the same padding as the flat fit
  (`fitPadding`). MapLibre's `fitBounds` ignores pitch, so `fitPitchedCamera` solves the tilted fit on MapLibre's perspective model (512 px
  tiles, 36.87° field of view), iterating zoom and center, then checks every hotel lands inside the padded view (tests and the browser check
  confirm). Maximum zoom 15 for a fit.
- **Gestures (3D only):** right-drag or Ctrl-drag to rotate and tilt, two fingers on touch, Shift + arrows on the keyboard; the zoom control
  gains a compass that also shows the tilt (click it to face north). Maximum pitch 70°. In 2D rotation stays off.
- **Show all hotels:** flies (900 ms) back to the default 3D framing (2D: the flat fit). With a hotel's card open (≥ 640 px) the fit also keeps
  clear of the card (left padding 330 px), in both modes.
- **Selecting a hotel** (marker or list): highlights it, flies to zoom ≥ 15 in 3D (≥ 13 in 2D), padded clear of the card and list, keeping the
  user's heading and at least 40° of tilt; jumps with reduced motion.
- **2D ⇄ 3D:** to 3D, the default framing (or, with a hotel open, the tilt and heading around it); to 2D, eases to pitch 0, north up.
- **Return from a hotel:** the store keeps the center and zoom (`portfolioView.camera`, unchanged); the tilt and heading are remembered in memory
  for the same visit (`rememberAngles`), used only while the store still has a camera (Reset demo or a filter change brings the default view).

### Markers in 3D

Markers are HTML, aligned to the viewport (`pitchAlignment` and `rotationAlignment` "viewport"), so they stay upright, readable and clickable
at any tilt and heading. The fan-out (`spread.ts`) is recomputed on every move (zoom, rotation and tilt change screen distances).

- **Rest:** a soft radial halo in the metric color that breathes slowly (3.6 s; a compositor-only opacity and scale animation).
- **Selected:** a brighter, faster halo (2.4 s), the existing expanding ring, and in 3D a thin **light beam** rising about 96 px from the
  marker in the metric color, shimmering gently.
- Metric changes fade the color as before (450 ms); the card fades and slides in (300 ms).

### Data columns (optional, off by default)

**Columns** (3D only) draws one square column per hotel at its **true** location, colored like its marker, height **strictly proportional** to
the map's metric for that hotel (`columnHeights`: the highest hotel gets the full height, zero stays on the ground; values from the store). The
common scale follows the zoom (the tallest column is about 140 px high on screen, quantized to half zoom levels) so the columns stay legible;
the ratios between hotels never change. They ease (500 ms) between metrics. The legend adds "Columns: height proportional to the value, from
0; tallest = [the highest value]", and the note says they are not building heights.

### Fallback chain

1. WebGL and the tiles: 3D street map (or 2D if chosen).
2. The style loads but has no building layer, or the extrusion layer cannot be added: the flat street map; the 3D segment is disabled with a
   note ("3D buildings are not available from the basemap right now").
3. No WebGL, the style or tiles fail within 8 s, or the WebGL context is lost: the drawn map (`MapFallback.tsx` / `MultiCityFallback.tsx`),
   unchanged. "Use the simplified map" still switches to it by hand.

### Performance

Five HTML markers and one extrusion layer from tiles the basemap already loads (no extra network requests). In the sandbox's software WebGL
(SwiftShader) the median frame during a fly-to was 16.7 ms with occasional long frames while new tiles were processed; hardware GPUs do much
better. The column tween updates five features per frame for 0.5 s.

## Page structure after the redesign (November 2026, docs/11 14H)

The story: understand the portfolio → discover opportunities → explore hotels → optimize investments. Same features and figures; sections
are spaced evenly (48–64 px), headings larger, cyan only for primary actions, selection, key financial highlights and focus.

1. **Overview.** Tagline, "Your Hotel Portfolio", the subtitle "See where energy costs are highest, discover savings opportunities, and invest
   smarter.", a context line (organization · hotels · city, the cities or "N cities") and the synthetic label as a small pill. Actions: Ask AI
   (ghost, the portfolio chat), Add hotel (outline), **Optimize portfolio** (primary, scrolls to the optimizer). Organization (and City for a
   multi-city organization) stay visible; Brand, Region and Ownership sit in "Filters (n)" (a popover, a collapsible on phones) with chips (×)
   and Reset filters; "Showing X of Y hotels" on the right. Four KPI cards (`PortfolioKpis.tsx`): annual energy spend, potential annual savings
   (slightly highlighted, with savings ÷ spend and a thin bar), annual carbon emissions, properties; compact values (`format.ts`), the exact value
   in the title and the accessible label. The secondary totals follow as one strip with separators.
2. **Top investment opportunity** (`StartHere.tsx`): the ranking's first hotel (`startHere`), its best package's annual savings, net investment
   and simple payback, one sentence; Explore this hotel, Why this hotel? (the reason, the contrast and the package, then the full ranking), Ask AI.
3. **Explore your hotels**: a page heading and subtitle above `<CityMap/>` (unchanged by the redesign; its 3D mode is described above, docs/11 14I).
4. **Plan your portfolio investments** (`PortfolioOptimizer.tsx`, section label "Portfolio investments" for the tour): one toolbar (budget,
   presets, objective, run), tabs Recommended plan / My plan / Compare plans. Results: plan KPIs from the plan's totals; the allocation bar
   (`AllocationBar.tsx`, `allocation.ts`), one segment per funded hotel at its package's **gross** installed cost (what the budget is checked
   against) plus the unused remainder, colors by the hotel's position in the organization (validated categorical palette), hover or focus
   tooltip, click opens the hotel's plan, a legend with every value; current → optimized spend and carbon, labeled "Projected, if funded · not
   implemented"; the package table; all totals; report actions; "How does the optimizer work?". Empty state before a run.
5. **Compare properties** (`PortfolioTable.tsx`): the seven columns with unit hints, an inline savings-potential bar, a priority bar, a "Top"
   marker on the top opportunity, the last visited hotel highlighted; a note that savings potential is each hotel's own best package, not what
   the budget funds. Scrolls inside its frame on phones.
6. **Advanced analytics** (closed): groups, electricity vs gas, stress tests, definitions.

Tour targets are unchanged (`portfolio-kpis`, `section[aria-label="City map"]`, `portfolio-table`, `section[aria-label="Portfolio investments"]`).

## Files

Added for multi-city and the workflow: `cities.ts` (grouping), `CityCluster.tsx`, `MultiCityFallback.tsx`, `priority.ts`, `PriorityExplainer.tsx`, `StartHere.tsx`, `HotelInPortfolio.tsx`, `anchors.ts`; `src/app/` (homepage, hotel dashboard, landing rules).


`CityMap.tsx` (state, layout, toolbar, ranking) · `MapLibreView.tsx` (street map, restyle, React markers through portals, fly and fit) ·
`MapFallback.tsx` (drawn map) · `HotelMarker.tsx` · `spread.ts` · `PropertyCard.tsx` · `PropertyList.tsx` · `MapLegend.tsx` ·
`camera3d.ts` (tilted fit, projection model, columns' scale, 2D/3D preference) · `buildings3d.ts` (extrusions, light, columns layer) ·
`mapTypes.ts` (shared props, paddings) · `metrics.ts` (metric labels, units and meanings; formatting and color only). Tests:
`src/test/PortfolioPage.test.tsx` (tooltip and card, ranking per metric, list hover and selection, Escape, collapse, the spreading rule),
`src/test/portfolioMap3d.test.tsx` (tilted fit of all hotels at three sizes, projection round trip, card-aware padding, heading rule, column
proportionality and scale, height fallback order, mode preference, remembered angles, reduced-motion markers, legend, drawn fallback).
