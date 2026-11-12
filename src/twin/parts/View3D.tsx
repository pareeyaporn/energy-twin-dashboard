import { Component, Suspense, lazy, useRef, useState } from "react";
import type { ReactNode } from "react";
import { RotateCcw } from "lucide-react";
import { ZONE_IDS, ZONE_LABELS } from "@/engine/hotel";
import { useTwin } from "@/store/useTwin";
import { selectHourState } from "@/store/hotelDerived";
import { SEASON_PRESETS } from "@/three/environment";
import type { HotelSceneHandle } from "@/three/HotelScene";
import { hourLabel, monthLabel, usd } from "../format";

const HotelScene = lazy(() => import("@/three/HotelScene"));

/** True when the browser can create a WebGL context. */
export function hasWebGL(): boolean {
  if (typeof window === "undefined" || typeof document === "undefined") return false;
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") ?? c.getContext("webgl"));
  } catch {
    return false;
  }
}

class SceneBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  override render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

/** The modeled state of the hotel at the clock's month and hour, read from the store (the engine computed it). */
export function HourReadout() {
  const h = useTwin(selectHourState);
  const kw = (n: number) => `${n.toFixed(n < 10 ? 1 : 0)} kW`;
  const rows: [string, string][] = [
    ["Heating", kw(h.demandKW.heating)],
    ["Cooling", kw(h.demandKW.cooling)],
    ["Ventilation", kw(h.demandKW.ventilation)],
    ["Lighting", kw(h.demandKW.lighting)],
    ["Hot water", kw(h.demandKW.hotWater)],
  ];
  return (
    <div data-testid="hour-readout" className="pointer-events-none absolute left-3 top-3 w-56 rounded-lg border border-glass-border bg-background/85 p-2.5 text-xs shadow backdrop-blur">
      <div className="font-semibold">
        {monthLabel(h.month)} · {hourLabel(h.hour)} {h.isDay ? "☀" : "☾"}
      </div>
      <div className="text-muted-foreground">
        Outdoor {Math.round(h.outdoorTempF)}°F <span className="opacity-70">(modeled from NOAA normals)</span>
      </div>
      <div className="mt-1 text-muted-foreground">
        Rooms: {h.rooms.present} occupied · {h.rooms.booked - h.rooms.present} out · {h.rooms.total - h.rooms.booked} vacant
      </div>
      {h.rooms.setback > 0 && (
        <div className="flex items-center gap-1.5 text-muted-foreground" data-testid="setback-legend">
          <span aria-hidden className="inline-block h-1 w-3 rounded-sm bg-[#5b85f0]" /> {h.rooms.setback} rooms set back by smart controls
        </div>
      )}
      <dl className="mt-1.5 grid grid-cols-[1fr_auto] gap-x-2 tabular-nums">
        {rows.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-muted-foreground">{k}</dt>
            <dd className="text-right">{v}</dd>
          </div>
        ))}
        <dt className="text-muted-foreground">Solar</dt>
        <dd className="text-right">{h.solar.installed ? kw(h.solar.kW) : "0 — none installed"}</dd>
        <dt className="font-medium">Total demand</dt>
        <dd className="text-right font-medium">{kw(h.demandKW.total)}</dd>
        <dt className="font-medium">Cost this hour</dt>
        <dd className="text-right font-medium">{usd(h.costPerHour)}</dd>
      </dl>
      <div className="mt-1 text-[10px] text-muted-foreground">Modeled estimate for a typical day of the month</div>
    </div>
  );
}

/** The 3D twin with its overlay controls. Falls back to `fallback` (the 2D diagram) if WebGL is unavailable or the scene fails. */
export function View3D({ fallback }: { fallback: ReactNode }) {
  const scene = useRef<HotelSceneHandle>(null);
  const [exploded, setExploded] = useState(false);
  const [solarSelected, setSolarSelected] = useState(false);
  const setTime = useTwin((s) => s.setTime);
  const solar = useTwin((s) => selectHourState(s).solar);
  const selectedZone = useTwin((s) => s.selectedZone);
  const selectZone = useTwin((s) => s.selectZone);
  return (
    <SceneBoundary fallback={fallback}>
      <div data-testid="twin-3d" className="relative h-[460px] overflow-hidden rounded-lg">
        <Suspense fallback={<div className="grid h-full place-items-center text-sm text-muted-foreground">Loading 3D hotel…</div>}>
          <HotelScene ref={scene} exploded={exploded} solarSelected={solarSelected} onSelectSolar={setSolarSelected} />
        </Suspense>
        <HourReadout />
        {solarSelected && (
          <div data-testid="solar-info" className="absolute bottom-14 left-3 max-w-xs rounded-lg border border-glass-border bg-background/90 p-2.5 text-xs shadow">
            <div className="font-semibold">Rooftop solar</div>
            {solar.installed ? (
              <p>
                {solar.sizeKw.toFixed(0)} kW array in this package, producing {solar.kW.toFixed(1)} kW at this hour (modeled, PVWatts typical year).
              </p>
            ) : (
              <p>
                Not installed — potential. A full-roof array of about {solar.previewSizeKw.toFixed(0)} kW would produce {solar.previewKW.toFixed(1)} kW at
                this hour (modeled). Choose a package with solar to install it.
              </p>
            )}
          </div>
        )}
        <div className="absolute bottom-3 left-3 right-3 flex flex-wrap items-center gap-1.5 text-xs">
          {SEASON_PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setTime({ month: p.month, hour: p.hour, mode: "seasons" })}
              className="rounded-md border border-glass-border bg-background/85 px-2 py-1 hover:bg-accent"
            >
              {p.label}
            </button>
          ))}
          <span className="ml-auto flex gap-1.5">
            <button
              type="button"
              aria-pressed={exploded}
              onClick={() => setExploded(!exploded)}
              className={`rounded-md border border-glass-border px-2 py-1 ${exploded ? "bg-primary text-primary-foreground" : "bg-background/85 hover:bg-accent"}`}
            >
              Explode floors
            </button>
            <button
              type="button"
              onClick={() => scene.current?.resetCamera()}
              aria-label="Reset camera"
              className="flex items-center gap-1 rounded-md border border-glass-border bg-background/85 px-2 py-1 hover:bg-accent"
            >
              <RotateCcw className="h-3 w-3" /> Reset view
            </button>
          </span>
        </div>
      </div>
      <p className="sr-only" id="twin-3d-help">
        Interactive 3D model of the hotel. Click a part of the building, or use the zone buttons below, to see its energy use; the zone
        details appear beside the model. Drag to rotate, scroll to zoom.
      </p>
      <div role="group" aria-label="Select a zone" aria-describedby="twin-3d-help" className="mt-2 flex flex-wrap gap-1 text-xs">
        {ZONE_IDS.map((z) => (
          <button
            key={z}
            type="button"
            aria-pressed={selectedZone === z}
            onClick={() => {
              setSolarSelected(false);
              selectZone(selectedZone === z ? null : z);
            }}
            className={`rounded-md border border-glass-border px-2 py-0.5 ${selectedZone === z ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent"}`}
          >
            {ZONE_LABELS[z]}
          </button>
        ))}
        <button
          type="button"
          aria-pressed={solarSelected}
          onClick={() => {
            selectZone(null);
            setSolarSelected(!solarSelected);
          }}
          className={`rounded-md border border-glass-border px-2 py-0.5 ${solarSelected ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent"}`}
        >
          Rooftop solar
        </button>
      </div>
    </SceneBoundary>
  );
}
