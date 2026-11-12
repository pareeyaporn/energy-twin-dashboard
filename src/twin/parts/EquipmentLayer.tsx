import { ZONE_IDS, ZONE_LABELS } from "@/engine/hotel";
import type { EquipmentItem } from "@/engine/hotel";
import { useTwin } from "@/store/useTwin";
import { selectEquipment } from "@/store/hotelDerived";

function rating(i: EquipmentItem): string {
  const parts: string[] = [];
  if (i.ratedKW !== undefined) parts.push(`${Math.round(i.ratedKW * 10) / 10} kW`);
  if (i.ratedKBtuH !== undefined) parts.push(`${Math.round(i.ratedKBtuH).toLocaleString("en-US")} kBtu/h`);
  if (i.ratedTons !== undefined) parts.push(`${Math.round(i.ratedTons * 10) / 10} tons`);
  return parts.join(", ");
}

/** Major equipment per zone with schedule and efficiency assumptions. All of it is a modeled estimate. */
export function EquipmentLayer() {
  const items = useTwin(selectEquipment);
  const selected = useTwin((s) => s.selectedZone);
  const selectZone = useTwin((s) => s.selectZone);
  const zones = selected ? [selected] : ZONE_IDS;
  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">Equipment sizes, schedules and efficiencies are estimates from rules of thumb, not a survey of the building.</p>
      {zones.map((z) => {
        const list = items.filter((i) => i.zone === z);
        return (
          <section key={z} aria-label={ZONE_LABELS[z]}>
            <h3 className="mb-1.5 flex items-center gap-2 text-sm font-semibold">
              {ZONE_LABELS[z]}
              {selected === null && (
                <button type="button" className="text-[11px] font-normal text-primary underline-offset-2 hover:underline" onClick={() => selectZone(z)}>
                  Focus
                </button>
              )}
            </h3>
            <ul className="space-y-1.5">
              {list.map((i) => (
                <li key={i.id} className="rounded-lg border border-glass-border bg-glass p-2.5 text-sm">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                    <span className="font-medium">
                      {i.label} <span className="text-muted-foreground">× {i.count.toLocaleString("en-US")}</span>
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {rating(i)} · {i.fuel === "gas" ? "gas" : "electric"}
                    </span>
                  </div>
                  <div className="mt-0.5 text-xs text-muted-foreground">Schedule: {i.schedule}</div>
                  <div className="text-xs text-muted-foreground">Efficiency: {i.efficiency}</div>
                  <span className="mt-1 inline-block rounded-full border border-glass-border px-1.5 text-[10px] text-text-muted">estimate</span>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
