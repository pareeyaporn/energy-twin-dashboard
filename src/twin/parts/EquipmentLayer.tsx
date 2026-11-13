import { useEffect, useMemo, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { AirVent, ArrowUpDown, ChefHat, Cylinder, Droplets, Fan, Flame, Gauge, Lightbulb, Plus, Refrigerator, RotateCcw, Snowflake, Sun, Tv, Undo2, WashingMachine, Wind } from "lucide-react";
import { ZONE_LABELS, typicalDayByZoneEndUse } from "@/engine/hotel";
import type { EquipmentItem } from "@/engine/hotel";
import { Button } from "@/components/ui/button";
import { useTwin } from "@/store/useTwin";
import { selectDisplayed, selectEquipment, selectOpportunities } from "@/store/hotelDerived";
import { hourLabel, monthLabel, usd } from "../format";
import { CATEGORY_GROUPS, quantityText, systemOf, systemReading } from "./equipmentSystems";
import type { ModeledStatus } from "./equipmentSystems";
import { EquipmentForm } from "./equipment/EquipmentForm";
import type { EditorMode } from "./equipment/EquipmentForm";
import { ProposedUpgrades, RemoveDialog, ReplaceDialog } from "./equipment/EquipmentActions";

const ICON: Record<string, LucideIcon> = {
  "room-hvac": AirVent,
  "lobby-hvac": Wind,
  "kitchen-hoods": Fan,
  "central-plant": Gauge,
  boilers: Flame,
  chiller: Snowflake,
  "room-lighting": Lightbulb,
  "lobby-lighting": Lightbulb,
  "corridor-lighting": Lightbulb,
  "dhw-heater": Flame,
  "dhw-storage": Cylinder,
  "dhw-recirc": Droplets,
  "room-plug": Tv,
  "kitchen-range": ChefHat,
  "kitchen-cold": Refrigerator,
  elevators: ArrowUpDown,
  laundry: WashingMachine,
};
const TEMPLATE_ICON: Record<string, LucideIcon> = { solar_pv: Sun, chiller: Snowflake, rooftop_unit: Snowflake, gas_boiler: Flame, condensing_boiler: Flame, gas_water_heater: Flame, gas_range: ChefHat, walk_in_refrigeration: Refrigerator, gas_dryer: WashingMachine, washer: WashingMachine, elevator: ArrowUpDown, lighting_area: Lightbulb, storage_tank: Cylinder, recirc_pump: Droplets };

const STATUS: Record<ModeledStatus, { label: string; dot: string }> = {
  running: { label: "Running", dot: "bg-savings" },
  low: { label: "Low load", dot: "bg-heat" },
  idle: { label: "Idle", dot: "bg-muted-foreground" },
};

const n = (v: number, d = 1) => v.toLocaleString("en-US", { maximumFractionDigits: v < 10 ? d : 0 });

/**
 * The hotel's equipment, in two views: "Current equipment" is what is installed (estimated, or corrected by the operator; corrections
 * recalculate the baseline and never count as savings) and "Proposed upgrades" are investments measured against it (docs/20).
 * The model works by zone and end use, not per appliance: an item shows its system's modeled demand, labeled as the system's.
 */
export function EquipmentLayer() {
  const items = useTwin(selectEquipment);
  const selected = useTwin((s) => s.selectedZone);
  const selectZone = useTwin((s) => s.selectZone);
  const result = useTwin((s) => selectDisplayed(s).result);
  const opportunities = useTwin(selectOpportunities);
  const month = useTwin((s) => s.timeMonth);
  const hour = useTwin((s) => s.timeHour);
  const corrections = useTwin((s) => s.hotelInput.equipment?.length ?? 0);
  const undo = useTwin((s) => s.equipmentUndo);
  const undoEquipment = useTwin((s) => s.undoEquipment);
  const resetEquipment = useTwin((s) => s.resetEquipment);
  const cleared = useTwin((s) => s.equipmentClearedPlan);
  const hydrate = useTwin((s) => s.hydrateEquipment);
  const solarKw = useTwin((s) => s.hotel.profile.equipmentLevers?.existingSolarKw ?? 0);
  useEffect(() => hydrate(), [hydrate]);
  const [view, setView] = useState<"current" | "proposed">("current");
  const [editor, setEditor] = useState<EditorMode | null>(null);
  const [removing, setRemoving] = useState<EquipmentItem | null>(null);
  const [replacing, setReplacing] = useState<EquipmentItem | null>(null);
  const day = useMemo(() => typicalDayByZoneEndUse(result, month), [result, month]);
  const list = selected ? items.filter((i) => i.zone === selected) : items;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div role="tablist" aria-label="Equipment view" className="inline-flex rounded-lg border border-glass-border p-0.5">
          {(["current", "proposed"] as const).map((v) => (
            <button key={v} type="button" role="tab" aria-selected={view === v} onClick={() => setView(v)} className={`rounded-md px-3 py-1 text-xs ${view === v ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground"}`} data-testid={`eq-view-${v}`}>
              {v === "current" ? "Current equipment" : "Proposed upgrades"}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {selected && (
            <button type="button" onClick={() => selectZone(null)} className="rounded-md border border-glass-border px-2 py-1 text-xs text-muted-foreground hover:bg-accent">
              Showing {ZONE_LABELS[selected]} · show all
            </button>
          )}
          {view === "current" && (
            <>
              {undo && (
                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={undoEquipment} data-testid="eq-undo"><Undo2 /> Undo</Button>
              )}
              {corrections > 0 && (
                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={resetEquipment} data-testid="eq-reset"><RotateCcw /> Reset to sample equipment</Button>
              )}
              <Button size="sm" className="h-7 text-xs" onClick={() => setEditor({ kind: "add" })} data-testid="eq-add"><Plus /> Add equipment</Button>
            </>
          )}
        </div>
      </div>

      {view === "current" ? (
        <>
          <p className="text-xs text-muted-foreground">
            What is installed in the hotel today. Items marked <strong className="font-medium text-foreground">estimated</strong> come from rules of thumb; correct them to match your building and the
            baseline is recalculated (a correction, not a saving). Status and demand are <strong className="font-medium text-foreground">modeled</strong> for a typical {monthLabel(month)} day at {hourLabel(hour)},
            for the whole system an item belongs to, not monitored.{solarKw > 0 ? ` Existing solar (${n(solarKw)} kW) lowers purchased electricity.` : ""}
          </p>
          {cleared && <p className="rounded-md border border-heat/30 bg-heat/10 p-2 text-xs text-heat" role="status">The hotel's baseline changed, so the investment plan was cleared. Run Find the best investments again.</p>}
          {(() => {
            // System figures once per system; opportunities once per zone and upgrade.
            const shownSystem = new Map<string, string>();
            const seenOpp = new Set<string>();
            return CATEGORY_GROUPS.map((g) => {
              const groupItems = list.filter((i) => i.category === g.id);
              if (!groupItems.length) return null;
              return (
                <section key={g.id} aria-label={g.label}>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{g.label}</h3>
                  <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {groupItems.map((i) => {
                      const sys = systemOf(i);
                      const first = !shownSystem.has(sys.key);
                      if (first) shownSystem.set(sys.key, i.label);
                      const r = sys.endUses.length ? systemReading(day, result, sys.zone, sys.endUses, hour) : null;
                      const Icon = (i.template ? TEMPLATE_ICON[i.template] : ICON[i.id]) ?? Gauge;
                      const opps = first
                        ? (opportunities[i.zone] ?? []).filter((o) => sys.upgrades.includes(o.id) && o.zoneAnnualSavings > 0 && !seenOpp.has(`${i.zone}|${o.id}`)).slice(0, 2)
                        : [];
                      for (const o of opps) seenOpp.add(`${i.zone}|${o.id}`);
                      const heatLever = i.levers.find((l) => l.lever === "heatingEfficiency" && l.kind === "thermal");
                      return (
                        <li key={`${i.zone}-${i.id}`} className="group flex flex-col rounded-xl border border-glass-border bg-glass p-3 text-sm transition-colors hover:border-primary/40" data-testid="equipment-card">
                          <div className="flex items-start gap-3">
                            <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${i.fuel === "gas" ? "bg-heat/15 text-heat" : i.fuel === "solar" ? "bg-savings/15 text-savings" : "bg-primary/15 text-primary"}`} aria-hidden>
                              <Icon className="h-4.5 w-4.5" />
                            </span>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-baseline justify-between gap-2">
                                <span className="font-medium leading-tight">{i.label}</span>
                                <span className={`shrink-0 rounded-full border px-1.5 text-[10px] ${i.estimated ? "border-glass-border text-text-muted" : "border-primary/40 text-primary"}`} data-testid="equipment-provenance">
                                  {i.estimated ? "estimated" : i.added ? "added by you" : "your data"}
                                </span>
                              </div>
                              <div className="mt-0.5 text-[11px] text-muted-foreground tabular-nums" data-testid="equipment-quantity">{quantityText(i)}</div>
                              <div className="text-[11px] text-muted-foreground">{ZONE_LABELS[i.zone]} · {i.fuel}</div>
                            </div>
                          </div>
                          <div className="mt-2 space-y-0.5 text-xs text-muted-foreground">
                            <div>Schedule: {i.schedule || "not specified"}</div>
                            <div>Efficiency: {i.efficiency}</div>
                            {i.ageYears !== undefined && <div>Age: {i.ageYears} years</div>}
                            {!i.estimated && i.userEntered.length > 0 && !i.added && <div className="text-primary">You entered: {i.userEntered.map((f) => f.replace("levers.", "")).join(", ")}</div>}
                          </div>
                          {r && first && r.modeled ? (
                            <div className="mt-2 rounded-lg border border-glass-border/70 bg-background/40 p-2 text-xs" data-testid="equipment-reading">
                              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">System-level · {sys.label}</div>
                              <div className="mt-1 flex items-center justify-between gap-2">
                                <span className="flex items-center gap-1.5">
                                  <span aria-hidden className={`h-2 w-2 rounded-full ${STATUS[r.status].dot}`} />
                                  <span>Modeled: <span className="font-medium">{STATUS[r.status].label}</span></span>
                                </span>
                                <span className="text-right tabular-nums">
                                  {r.elecKWNow > 0.05 && <span className="block">{n(r.elecKWNow)} kW electric</span>}
                                  {r.gasThermsNow > 0.005 && <span className="block">{n(r.gasThermsNow, 2)} therms/h gas ({n(r.gasKBtuHNow)} kBtu/h)</span>}
                                </span>
                              </div>
                              {heatLever && r.gasThermsNow > 0.005 && (
                                <div className="mt-0.5 text-[11px] text-muted-foreground">Useful heat about {n(r.gasKBtuHNow * heatLever.value)} kBtu/h at {Math.round(heatLever.value * 100)}% efficiency; pumps and fans not modeled separately.</div>
                              )}
                              <div className="mt-1 h-1 overflow-hidden rounded-full bg-muted" aria-hidden>
                                <div className="h-full rounded-full bg-primary/70 transition-[width] duration-300" style={{ width: `${r.kWPeak > 0 ? Math.round((r.kWNow / r.kWPeak) * 100) : 0}%` }} />
                              </div>
                              <div className="mt-1 text-[11px] text-muted-foreground">System cost: {usd(r.annualCost)} / yr · ${r.costPerHour.toFixed(2)} this hour</div>
                            </div>
                          ) : r && !first ? (
                            <div className="mt-2 text-[11px] text-muted-foreground" data-testid="equipment-shared">Part of the {sys.label.toLowerCase()} system; its modeled figures are shown on {shownSystem.get(sys.key)}.</div>
                          ) : (
                            <div className="mt-2 text-[11px] text-muted-foreground">{i.fuel === "solar" ? "Generation is netted from purchased electricity each month." : "Not modeled separately."}</div>
                          )}
                          <p className="mt-1.5 text-[11px] text-muted-foreground" data-testid="equipment-model-note">{i.modelNote}</p>
                          {opps.length > 0 && (
                            <ul className="mt-2 space-y-1" aria-label="Upgrade opportunities">
                              {opps.map((o) => (
                                <li key={o.id} className="rounded-md bg-savings/10 px-2 py-1 text-[11px]">
                                  <div className="flex items-baseline justify-between gap-2">
                                    <span>{o.label}</span>
                                    <span className="shrink-0 text-savings tabular-nums">{usd(o.zoneAnnualSavings)} / yr in this zone</span>
                                  </div>
                                  <div className="text-muted-foreground">Whole-hotel upgrade: {usd(o.totalAnnualSavings)} / yr in all{o.paybackYears !== null ? ` · ${o.paybackYears.toFixed(1)} yr payback` : ""}</div>
                                </li>
                              ))}
                            </ul>
                          )}
                          <div className="mt-auto flex gap-1 pt-2">
                            <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setEditor({ kind: "edit", item: i })} aria-label={`Edit ${i.label}`}>Edit</Button>
                            <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setReplacing(i)} aria-label={`Replace ${i.label}`}>Replace</Button>
                            <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-muted-foreground" onClick={() => setRemoving(i)} aria-label={`Remove ${i.label}`}>Remove</Button>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              );
            });
          })()}
        </>
      ) : (
        <ProposedUpgrades items={items} />
      )}
      {editor && <EquipmentForm key={editor.kind === "edit" ? editor.item.id : "add"} mode={editor} onClose={() => setEditor(null)} />}
      {removing && <RemoveDialog item={removing} onClose={() => setRemoving(null)} />}
      {replacing && <ReplaceDialog item={replacing} onClose={() => setReplacing(null)} />}
    </div>
  );
}
