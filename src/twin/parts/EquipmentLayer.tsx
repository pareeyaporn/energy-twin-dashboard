import { useMemo } from "react";
import type { LucideIcon } from "lucide-react";
import { AirVent, ArrowUpDown, ChefHat, Cylinder, Droplets, Fan, Flame, Gauge, Lightbulb, Refrigerator, Snowflake, Tv, WashingMachine, Wind } from "lucide-react";
import { ZONE_LABELS, typicalDayByZoneEndUse } from "@/engine/hotel";
import type { EquipmentItem } from "@/engine/hotel";
import { useTwin } from "@/store/useTwin";
import { selectDisplayed, selectEquipment, selectOpportunities } from "@/store/hotelDerived";
import { hourLabel, monthLabel, usd } from "../format";
import { GROUPS, systemOf, systemReading } from "./equipmentSystems";
import type { ModeledStatus } from "./equipmentSystems";

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

const STATUS: Record<ModeledStatus, { label: string; dot: string }> = {
  running: { label: "Running", dot: "bg-savings" },
  low: { label: "Low load", dot: "bg-heat" },
  idle: { label: "Idle", dot: "bg-muted-foreground" },
};

function rating(i: EquipmentItem): string {
  const parts: string[] = [];
  if (i.ratedKW !== undefined) parts.push(`${Math.round(i.ratedKW * 10) / 10} kW`);
  if (i.ratedKBtuH !== undefined) parts.push(`${Math.round(i.ratedKBtuH).toLocaleString("en-US")} kBtu/h`);
  if (i.ratedTons !== undefined) parts.push(`${Math.round(i.ratedTons * 10) / 10} tons`);
  return parts.join(" · ");
}

const kw = (n: number) => `${n.toLocaleString("en-US", { maximumFractionDigits: n < 10 ? 1 : 0 })} kW`;

/**
 * The hotel's estimated equipment as cards, grouped by system. Each card shows the item's estimated size and schedule and the modeled
 * demand of the system it belongs to at the clock's hour (the model works by zone and end use, not per appliance). Nothing is measured.
 */
export function EquipmentLayer() {
  const items = useTwin(selectEquipment);
  const selected = useTwin((s) => s.selectedZone);
  const selectZone = useTwin((s) => s.selectZone);
  const result = useTwin((s) => selectDisplayed(s).result);
  const opportunities = useTwin(selectOpportunities);
  const month = useTwin((s) => s.timeMonth);
  const hour = useTwin((s) => s.timeHour);
  const day = useMemo(() => typicalDayByZoneEndUse(result, month), [result, month]);
  const list = selected ? items.filter((i) => i.zone === selected) : items;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          Sizes, schedules and efficiencies are estimates from rules of thumb, not a survey. Status and demand are <strong className="font-medium text-foreground">modeled</strong> for a
          typical {monthLabel(month)} day at {hourLabel(hour)}, not monitored.
        </p>
        {selected && (
          <button type="button" onClick={() => selectZone(null)} className="rounded-md border border-glass-border px-2 py-1 text-xs text-muted-foreground hover:bg-accent">
            Showing {ZONE_LABELS[selected]} · show all
          </button>
        )}
      </div>
      {(() => {
        // Show each upgrade opportunity once per zone (on the first card it applies to), so cards sharing a system don't repeat it.
        const seen = new Set<string>();
        return GROUPS.map((g) => {
        const groupItems = list.filter((i) => systemOf(i).group === g.id);
        if (!groupItems.length) return null;
        return (
          <section key={g.id} aria-label={g.label}>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{g.label}</h3>
            <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {groupItems.map((i) => {
                const sys = systemOf(i);
                const r = systemReading(day, result, sys.zone, sys.endUses, hour);
                const Icon = ICON[i.id] ?? Gauge;
                const opps = (opportunities[i.zone] ?? [])
                  .filter((o) => sys.upgrades.includes(o.id) && o.zoneAnnualSavings > 0 && !seen.has(`${i.zone}|${o.id}`))
                  .slice(0, 2);
                for (const o of opps) seen.add(`${i.zone}|${o.id}`);
                const st = STATUS[r.status];
                return (
                  <li key={`${i.zone}-${i.id}`} className="group flex flex-col rounded-xl border border-glass-border bg-glass p-3 text-sm transition-colors hover:border-primary/40">
                    <div className="flex items-start gap-3">
                      <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${i.fuel === "gas" ? "bg-heat/15 text-heat" : "bg-primary/15 text-primary"}`} aria-hidden>
                        <Icon className="h-4.5 w-4.5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="font-medium leading-tight">{i.label}</span>
                          <span className="shrink-0 text-xs text-muted-foreground tabular-nums">× {i.count.toLocaleString("en-US")}</span>
                        </div>
                        <div className="mt-0.5 text-[11px] text-muted-foreground">
                          {ZONE_LABELS[i.zone]} · {i.fuel === "gas" ? "gas" : "electric"}
                          {rating(i) ? ` · ${rating(i)}` : ""}
                        </div>
                      </div>
                    </div>
                    <div className="mt-2 space-y-0.5 text-xs text-muted-foreground">
                      <div>Schedule: {i.schedule}</div>
                      <div>Efficiency: {i.efficiency}</div>
                    </div>
                    {r.modeled ? (
                      <div className="mt-2 rounded-lg border border-glass-border/70 bg-background/40 p-2 text-xs" data-testid="equipment-reading">
                        <div className="flex items-center justify-between gap-2">
                          <span className="flex items-center gap-1.5">
                            <span aria-hidden className={`h-2 w-2 rounded-full ${st.dot}`} />
                            <span>
                              Modeled: <span className="font-medium">{st.label}</span>
                            </span>
                          </span>
                          <span className="tabular-nums">{kw(r.kWNow)} now</span>
                        </div>
                        <div className="mt-1 h-1 overflow-hidden rounded-full bg-muted" aria-hidden>
                          <div className="h-full rounded-full bg-primary/70 transition-[width] duration-300" style={{ width: `${r.kWPeak > 0 ? Math.round((r.kWNow / r.kWPeak) * 100) : 0}%` }} />
                        </div>
                        <div className="mt-1 text-[11px] text-muted-foreground">
                          System: {sys.label} · {usd(r.annualCost)} / yr · ${r.costPerHour.toFixed(2)} this hour
                        </div>
                      </div>
                    ) : (
                      <div className="mt-2 text-[11px] text-muted-foreground">Not modeled separately.</div>
                    )}
                    {opps.length > 0 && (
                      <ul className="mt-2 space-y-1" aria-label="Upgrade opportunities">
                        {opps.map((o) => (
                          <li key={o.id} className="flex items-baseline justify-between gap-2 rounded-md bg-savings/10 px-2 py-1 text-[11px]">
                            <span>{o.label}</span>
                            <span className="shrink-0 text-savings tabular-nums">
                              saves {usd(o.zoneAnnualSavings)} / yr here{o.paybackYears !== null ? ` · ${o.paybackYears.toFixed(1)} yr` : ""}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                    <span className="mt-2 self-start rounded-full border border-glass-border px-1.5 text-[10px] text-text-muted">estimate</span>
                  </li>
                );
              })}
            </ul>
          </section>
        );
        });
      })()}
    </div>
  );
}
