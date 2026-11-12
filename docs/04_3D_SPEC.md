# 04 — 3D hotel twin spec (`src/three/`)

> **Current (hotel, Phase 9, built).** The sections after "Home era" below describe the old house simulator and are kept only as
> patterns. This section is the spec for what is built.

## What it is

An interactive 3D model of the hotel, shown as the default view of the twin's Zones layer on desktop (3D/2D switch beside the layer
tabs). It is a visualization layer only: every energy number and color comes from the store, which calls the engine. The scenery
(trees, snow, sky) follows the calendar and the sun's position.

**Files.** `layout.ts` (geometry from rooms and floors, pure), `colors.ts` (sRGB versions of the app's cost scale),
`environment.ts` (season, scenery, sky and light from the sun, presets, pure), `HotelScene.tsx` (the canvas), and in `src/twin`:
`parts/View3D.tsx` (lazy loading, WebGL fallback, overlays, controls), `useCountUp.ts` (header numbers).

## What drives what

| Visual | Source |
| --- | --- |
| Zone colors (guest floors, lobby, restaurant, core, plant, hot-water room) | each zone's yearly cost, min–max scaled, blue → amber → red (same as 2D) |
| Rooftop HVAC tint, fan speed | heating vs cooling demand at the clock's hour (`selectHourState().demandKW`) |
| Windows, one per room | `selectRooms`: lit (guest in), dim (booked, guest out), dark (vacant); glass tint by daylight |
| Blue sill under a window | the room is set back by smart controls (`RoomPoint.setback`); count in the readout |
| Solar panels | applied package's solar size (quarter, half, full roof); none otherwise. Selecting the roof without solar shows a translucent full-roof preview, "Not installed — potential", with the modeled output of a full-roof array |
| Sun position, sky color, stars, moonlight | `sunElevationDeg`, `sunAzimuthDeg` from the engine (latitude and month) |
| Season (snow, bare / green / orange trees, snowfall) | the month (meteorological seasons) |
| Readout: date and time, outdoor °F, rooms, kW by end use, solar, cost this hour | `selectHourState` (outdoor temperature modeled from NOAA normal highs and lows) |

## Look: realistic by default, energy view on demand

The default look is realistic: stone guest floors, a dark glass podium with shopfronts that glow at night, a metal rooftop plant
(glowing red when heating dominates the hour, blue when cooling does), window frames, slab bands, a parapet, an entrance canopy,
a physical sky by day (scattering from the engine's sun position), a street with sidewalks, cars and streetlights (light pools and
headlights at night). The selected zone always shows its cost color. **Energy view** fades every zone to the cost scale.

**People.** Low-poly pedestrians walk the sidewalk and the entrance path. Their number follows the engine: guests booked but out at
this hour (`pedestrianCounts(guestsOut, rooms)`, up to 12 on the street and 4 at the door), so the street is busy by day and quiet at
night. Their movement and the traffic are illustrative, not modeled. Both freeze with "reduce effects".

**Camera.** A short fly-in from a wide view when the scene opens; selecting a zone (in the scene or with the zone buttons) glides to a
close view of it (`cameraViews(layout)`), and clearing the selection or "Reset view" glides home. The home view and the fog scale with
the building, so a 20-floor tower fits. Instant with "reduce effects".

## Controls

Orbit (drag), zoom (scroll), click a zone (selects it; the existing zone panel shows energy, cost, drivers and opportunities), keyboard
zone buttons under the scene, "Explode floors", "Reset view", season presets (January night, April morning, July afternoon, October
evening), and the twin's time controls ("Year + day" plays every hour of every month: a year in about 48 s at 1x).

## Performance and accessibility

- Lazy-loaded and client-only; WebGL detection plus an error boundary fall back to the 2D diagram. 2D on narrow screens and with
  "reduce effects".
- Windows and set-back sills are single instanced meshes; one shadow-casting light; geometry is procedural (no model files).
- "Reduce effects": no snowfall, stars, fan spin, shadows or camera damping; pixel ratio 1. The header count-up runs only when the
  system allows motion (`prefers-reduced-motion`) and effects are not reduced.
- Screen readers: a description of the scene, zone buttons with `aria-pressed`, and the header cost's full value as its label.

## Not claimed

The scene is an illustration of modeled estimates for a typical day of each month, not real-time monitoring or a measured building.

---

# Home era (superseded)


The 3D house is a **live picture of the energy model**. Every glow, leak, coin and color comes from engine
numbers in the store. Judges should see it and say "whoa" — then learn it's real data.

## Art direction

- **Diorama:** a stylized low-poly house on a floating slab of lawn + soil (like a premium architecture model),
  hovering over a dark navy void. Soft clay materials, rounded edges (drei `RoundedBox`), warm studio light.
- **Cutaway:** front wall and the front slope of the roof are sliced open (or semi-transparent on hover-out) so the
  attic, furnace and thermostat inside are visible.
- **Palette:**
  - Walls `#EDEAE4`, roof `#3A4252`, trim `#FFFFFF`, door `#7A5230`, wood floor `#B98A5E`, lawn `#5E8C4A`, soil `#4A3426`
  - Thermal ramp: `#4D8DFF` (efficient) → `#F5A524` → `#F2545B` (losing heat)
  - Accent / UI glow: `#3DD9EB`
- **Background:** radial gradient `#12213D` → `#0B1426`, subtle fog, faint grid floor fading out.
- **Motion:** springs and eases only. The house floats gently (drei `Float`, speed 1, intensity 0.3).
  Camera moves always glide (drei `CameraControls` `setLookAt(..., true)`).

## The 7 wow moments

1. **Assembly** — on preset load, parts drop in one by one with a springy bounce (slab → floor → walls → roof →
   windows → door → chimney → HVAC), 60 ms stagger. Changing sqft / stories / yearBuilt morphs the house live
   (footprint scales, extra story stacks on, older homes get a chimney and darker roof).
2. **Thermal Vision** — toggle `thermalMode`: materials cross-fade (600 ms) from clay to the thermal ramp.
   Each part's color = `rampColor(part.intensity)`. Emissive intensity = `0.2 + 1.2 × intensity`, so hot parts
   bloom. The background darkens slightly; a cold blue rim light appears.
3. **Money leaks** — at each leak anchor (roof edges, window frames, door gaps, rim joist), an emitter streams
   glowing particles outward and upward. Particle count ∝ that part's `annualCost` (`count = clamp(cost / 8, 6, 120)`).
   Particles are small amber-to-red sprites; every ~1.5 s one becomes a tiny "$" glyph (drei `Text` or sprite).
   A floating `Html` label over each part: **"Attic −$610/yr"**.
4. **X-ray hover** — hovering a part lifts it 0.05 units, adds a cyan outline (drei `Outlines`), dims other parts to
   60%, and shows a glass card (`Html`) with: heat loss $/yr, condition, recommended upgrade, cost range,
   savings range, source chip. Clicking sets `selectedPart` and the camera glides to frame that part.
5. **Optimizer run** — while `optimizing` is true (~2 s): camera does a slow 180° orbit; ghost previews of upgrades
   flicker on/off on the house in sync with the UI counter "Testing 1…32 combinations"; a scanning light sweeps
   over the house top to bottom. On finish, camera settles on a 3/4 hero angle.
6. **Upgrades install on screen** (when `appliedUpgrades` changes), choreographed in this order:
   - **Attic insulation:** pink batts fill the attic floor from one end to the other (scale-X 0 → 1, 900 ms).
   - **Air sealing:** a glowing cyan line traces around every window and the door (dash offset animation),
     then the leak emitters there shut off with a soft "pop".
   - **Windows:** old panes slide out, new ones slide in with a light glint sweeping across the glass.
   - **Heat pump:** the old furnace sinks through the floor; an outdoor heat pump unit drops in beside the house
     with a bounce and its fan starts spinning. Its size scales with `outcome.heatPumpTons`.
   - **Smart thermostat:** the wall thermostat lights up cyan with a small pulse ring.
   Each affected part's thermal color cools red → blue as its intensity drops (800 ms).
7. **The bill drop** — the big counter on the stage rolls down from baseline to the package's `newAnnualCost`
   while the last particles fade. A soft chime (optional, off by default, toggle in the toolbar).

**Extras (only after all 7 work):** season toggle (winter: snow + heat escaping; summer: sun rays + heat entering),
day/night with warm lit windows, before/after drag-wipe, solar panels tiling onto the roof.

## Component tree

```
src/three/
  Scene.tsx              <Canvas> + lights + environment + postprocessing + CameraRig + <House/>
  CameraRig.tsx          drei CameraControls; reacts to selectedPart / optimizing / applyPackage
  Environment.tsx        background gradient, fog, grid, ContactShadows
  Effects.tsx            Bloom, Vignette, ToneMapping (disabled when reduceEffects)
  House.tsx              composes parts; reads store; assembly animation
  parts/
    Slab.tsx  Floor.tsx  Walls.tsx  Roof.tsx  Attic.tsx  Windows.tsx (instanced)
    Door.tsx  Chimney.tsx  Furnace.tsx  HeatPump.tsx  Thermostat.tsx
  thermal/
    useThermalMaterial.ts   shared material per part: clay ↔ thermal blend
    rampColor.ts            intensity (0–1) → THREE.Color
  fx/
    LeakEmitter.tsx         particles for one leak anchor
    LeakLabel.tsx           Html label "Part −$X/yr"
    ScanSweep.tsx           optimizer scanning light
    SealTrace.tsx           air-sealing line animation
    Glint.tsx               window glint
  ui/
    PartCard.tsx            Html glass card on hover/select
  anchors.ts               leak anchor positions per part (derived from house dimensions)
  dimensions.ts            house size from home (sqft, stories) → width, depth, height
  Fallback2D.tsx           SVG house using the same store (if WebGL unavailable)
```

`Scene` is the only thing Lovable places on the page: `<Scene />` inside the center stage div, filling it.
Overlays (counter, toolbar, legend) stay in Lovable's HTML on top of the canvas.

## How each part reads the store

```ts
const parts = useTwin(s => s.displayedParts);       // PartLoss[]
const thermal = useTwin(s => s.thermalMode);
const applied = useTwin(s => s.appliedUpgrades);
const p = parts.find(x => x.part === 'attic');
// color target = thermal ? rampColor(p.intensity) : CLAY_COLOR  → spring to it
```
Parts never compute energy. Map: `attic`→Attic+Roof, `walls`→Walls, `windows`→Windows, `air_leaks`→Door + rim
(leak emitters at gaps), `foundation`→Slab edge. HVAC efficiency glow uses `baseline.hvacEfficiencyScore`.

## Dimensions

- footprint area = sqft / stories; width = sqrt(area × 1.4), depth = area / width (scaled 1 unit ≈ 10 ft)
- story height 1.0 unit; roof pitch 35°
- windows: 2 per side per story (front/back), 1 per side (left/right); door front center

## Tech notes

- `<Canvas dpr={[1, 2]} shadows camera={{ position: [6, 4.5, 7], fov: 35 }} gl={{ antialias: true }}>`
- Lighting: `Environment preset="city"` (low intensity) + one warm key `directionalLight` with soft shadows +
  cool rim light that fades in during Thermal Vision.
- Materials: `meshStandardMaterial` (roughness 0.85, metalness 0) for clay; thermal blend by lerping `color` and
  `emissive` via `@react-spring/three` `animated.meshStandardMaterial`.
- Particles: one `instancedMesh` per emitter (small planes facing camera) or drei `Sparkles` for a quick start;
  upgrade to custom instanced sprites if time allows.
- Postprocessing: `Bloom` (intensity 0.9, luminanceThreshold 0.6, mipmapBlur), `Vignette` (darkness 0.5).
- Budget: < 50k triangles, < 150 draw calls, 60 fps on the demo laptop. Instancing for windows and particles.
- `reduceEffects` → no Bloom, particle counts ÷ 3, no shadows.
- `Fallback2D` renders if WebGL context creation fails (check with a try on mount).

## Build order with checkpoints

| Hours | Milestone | Checkpoint |
| --- | --- | --- |
| 2–6 | Scene, lights, background, slab, camera | Looks premium when empty |
| 6–10 | Procedural house + cutaway, hover outline, click select | Clicking a part opens its card |
| 10–16 | Thermal Vision from store (mock numbers OK), bloom | Screenshot-worthy |
| 16–22 | Leak emitters + labels from real engine numbers | Particles match $ lost |
| 22–30 | Upgrade animations, optimizer orbit + scan, bill drop | Full wow sequence runs |
| 30–36 | Polish, reduceEffects, Fallback2D, record backup video (hour 34) | Smooth on demo laptop |
| 36+ | **Freeze** — bug fixes only | |

## Demo camera script (for the presenter)

1. Load Maya → assembly (3 s) → hero 3/4 angle
2. Thermal Vision on → slow 20° orbit → hover attic (card shows −$610/yr)
3. Optimize → 180° orbit + scan (2 s) → settle
4. Click package #1 → install sequence (≈5 s) → bill counter drops
5. Toggle Thermal Vision off/on once to show the before/after colors
