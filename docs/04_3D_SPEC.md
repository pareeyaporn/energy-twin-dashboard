# 04 — 3D hotel twin spec (`src/three/`)

> **Current (hotel, Phase 9, built).** The spec for what is built. (The home-era house spec was removed; it is in git history.)

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
