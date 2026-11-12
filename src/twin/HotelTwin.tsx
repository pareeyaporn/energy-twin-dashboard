import { useEffect, useState } from "react";
import { useTwin } from "@/store/useTwin";
import type { CompareMode, TwinLayer } from "@/store/useTwin";
import { selectCompare, selectDisplayed, selectHotelLabel } from "@/store/hotelDerived";
import { signedUsd, usd } from "./format";
import { BuildingDiagram } from "./parts/BuildingDiagram";
import { EquipmentLayer } from "./parts/EquipmentLayer";
import { FlowLayer } from "./parts/FlowLayer";
import { InstalledUpgrades } from "./parts/GhostUpgrades";
import { RoomGrid } from "./parts/RoomGrid";
import { StressTests } from "./parts/StressTests";
import { TimeControls } from "./parts/TimeControls";
import { ZonePanel } from "./parts/ZonePanel";
import { View3D, hasWebGL } from "./parts/View3D";
import { useTwinClock } from "./useTwinClock";
import { useCountUp } from "./useCountUp";

const LAYERS: { id: TwinLayer; label: string }[] = [
  { id: "zones", label: "Zones" },
  { id: "rooms", label: "Rooms" },
  { id: "equipment", label: "Equipment" },
  { id: "flow", label: "Flow" },
];
const COMPARE: { id: CompareMode; label: string }[] = [
  { id: "before", label: "Before" },
  { id: "after", label: "After" },
  { id: "split", label: "Split" },
];
const KIND_LABEL = { baseline: "Current", scenario: "What-if", package: "With upgrades" } as const;

/**
 * The hotel's digital twin: a layered 2D view (zones, rooms, equipment, energy flow) with a time scrubber, a simulated meter,
 * before/after comparison, upgrades shown on the building, and stress tests. It reads everything from the store and does no math.
 */
export function HotelTwin() {
  useTwinClock();
  const layer = useTwin((s) => s.twinLayer);
  const setLayer = useTwin((s) => s.setTwinLayer);
  const mode = useTwin((s) => s.compareMode);
  const setMode = useTwin((s) => s.setCompareMode);
  const reduce = useTwin((s) => s.reduceEffects);
  const label = useTwin(selectHotelLabel);
  const displayed = useTwin(selectDisplayed);
  const compare = useTwin(selectCompare);
  const delta = compare.after.annual.cost - compare.before.annual.cost;
  const shownCost = useCountUp(displayed.result.annual.cost, reduce);
  const shownDelta = useCountUp(delta, reduce);
  // 3D is the default on desktop when WebGL works and effects are not reduced; decided after mount (the server renders 2D).
  const [view, setView] = useState<"2d" | "3d">("2d");
  const [canUse3D, setCanUse3D] = useState(false);
  useEffect(() => {
    const ok = hasWebGL();
    setCanUse3D(ok);
    if (ok && !reduce && window.matchMedia?.("(min-width: 1024px)").matches) setView("3d");
  }, [reduce]);

  return (
    <section aria-label="Hotel digital twin" data-reduce-effects={reduce ? "true" : "false"} className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">{label.title}</h2>
          <p className="text-xs text-muted-foreground">
            {label.city} · {label.rooms} rooms ·{" "}
            <span data-testid="simulated-badge" className="rounded-full border border-glass-border px-1.5 py-0.5">
              {label.synthetic ? "Synthetic demo data · modeled estimates" : "Modeled estimates"}
            </span>
          </p>
        </div>
        <div className="text-right">
          <div className="text-xs text-muted-foreground" data-testid="twin-kind">
            {KIND_LABEL[displayed.kind]}
            {displayed.package ? `: ${displayed.package.roleLabel}` : ""}
          </div>
          <div className="text-2xl font-semibold tabular-nums" data-testid="twin-cost" aria-label={`${usd(displayed.result.annual.cost)} per year`}>{usd(shownCost)} <span className="text-sm font-normal text-muted-foreground">/ yr</span></div>
          {Math.abs(delta) >= 1 && (
            <div className={`text-sm tabular-nums ${delta < 0 ? "text-savings" : "text-loss"}`} data-testid="twin-delta">
              {signedUsd(shownDelta)} per year vs before
            </div>
          )}
        </div>
      </header>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div role="tablist" aria-label="Twin layer" className="flex overflow-hidden rounded-lg border border-glass-border text-sm">
          {LAYERS.map((l) => (
            <button
              key={l.id}
              type="button"
              role="tab"
              id={`twin-tab-${l.id}`}
              aria-selected={layer === l.id}
              aria-controls="twin-panel"
              onClick={() => setLayer(l.id)}
              className={`px-3 py-1.5 ${layer === l.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent"}`}
            >
              {l.label}
            </button>
          ))}
        </div>
        {layer === "zones" && canUse3D && (
          <div role="group" aria-label="View" className="flex overflow-hidden rounded-lg border border-glass-border text-sm">
            {(["3d", "2d"] as const).map((v) => (
              <button
                key={v}
                type="button"
                aria-pressed={view === v}
                onClick={() => setView(v)}
                className={`px-3 py-1.5 ${view === v ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-accent"}`}
              >
                {v === "3d" ? "3D" : "2D"}
              </button>
            ))}
          </div>
        )}
        <div role="group" aria-label="Compare" className="flex overflow-hidden rounded-lg border border-glass-border text-sm">
          {COMPARE.map((c) => (
            <button
              key={c.id}
              type="button"
              aria-pressed={mode === c.id}
              onClick={() => setMode(c.id)}
              className={`px-3 py-1.5 ${mode === c.id ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-accent"}`}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      <div id="twin-panel" role="tabpanel" aria-labelledby={`twin-tab-${layer}`} className={layer === "zones" ? "grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_320px]" : ""}>
        <div className="min-w-0 rounded-xl border border-glass-border bg-stage-gradient p-3">
          {layer === "zones" && (view === "3d" && canUse3D ? <View3D fallback={<BuildingDiagram />} /> : <BuildingDiagram />)}
          {layer === "rooms" && <RoomGrid />}
          {layer === "equipment" && <EquipmentLayer />}
          {layer === "flow" && <FlowLayer />}
        </div>
        {layer === "zones" && <ZonePanel />}
      </div>

      <InstalledUpgrades />
      <TimeControls />
      <StressTests />
    </section>
  );
}
