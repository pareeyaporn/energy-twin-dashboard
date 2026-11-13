import { Line, LineChart, ReferenceLine, ResponsiveContainer, XAxis, YAxis } from "recharts";
import { ZONE_LABELS } from "@/engine/hotel";
import { useTwin } from "@/store/useTwin";
import { selectEquipment, selectOpportunities, selectTypicalDay, selectZoneRows } from "@/store/hotelDerived";
import { kwh, monthLabel, percent, signedUsd, therms, usd } from "../format";
import { quantityText } from "./equipmentSystems";

/** Details of the selected zone: energy, cost, equipment, schedules, efficiency assumptions, opportunities and its hourly load. */
export function ZonePanel() {
  const zone = useTwin((s) => s.selectedZone);
  const rows = useTwin(selectZoneRows);
  const equipment = useTwin(selectEquipment);
  const opportunities = useTwin(selectOpportunities);
  const day = useTwin(selectTypicalDay);
  const hour = useTwin((s) => s.timeHour);
  const month = useTwin((s) => s.timeMonth);
  const selectZone = useTwin((s) => s.selectZone);

  if (!zone) {
    return (
      <aside aria-label="Zone details" className="rounded-xl border border-dashed border-glass-border p-4 text-sm text-muted-foreground">
        Select a zone on the diagram to see its energy, equipment, schedules and opportunities.
      </aside>
    );
  }
  const row = rows.find((r) => r.zone === zone);
  const items = equipment.filter((e) => e.zone === zone);
  const opps = opportunities[zone];
  const hourly = day.map((h) => ({ hour: h.hour, kW: Math.round(h.byZone[zone].elecKW * 10) / 10 }));
  const schedules = [...new Set(items.map((i) => i.schedule))];
  const efficiencies = [...new Set(items.map((i) => i.efficiency))];

  return (
    <aside aria-label="Zone details" className="space-y-4 rounded-xl border border-glass-border bg-glass p-4">
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-base font-semibold">{ZONE_LABELS[zone]}</h3>
        <button type="button" onClick={() => selectZone(null)} className="text-xs text-muted-foreground hover:text-foreground" aria-label="Close zone details">
          Close
        </button>
      </div>

      {row && (
        <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
          <div><dt className="text-xs text-muted-foreground">Cost per year (estimate)</dt><dd className="font-semibold tabular-nums">{usd(row.totals.cost)}</dd></div>
          <div><dt className="text-xs text-muted-foreground">Share of hotel total</dt><dd className="font-semibold tabular-nums">{percent(row.costShare)}</dd></div>
          <div><dt className="text-xs text-muted-foreground">Electricity</dt><dd className="tabular-nums">{kwh(row.totals.elecKWh)}</dd></div>
          <div><dt className="text-xs text-muted-foreground">Natural gas</dt><dd className="tabular-nums">{therms(row.totals.gasTherms)}</dd></div>
          {Math.abs(row.deltaCost) >= 1 && (
            <div className="col-span-2"><dt className="text-xs text-muted-foreground">Change from before</dt><dd className={`font-semibold tabular-nums ${row.deltaCost < 0 ? "text-savings" : "text-loss"}`}>{signedUsd(row.deltaCost)} per year</dd></div>
          )}
        </dl>
      )}

      <section aria-label="Hourly load">
        <h4 className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">Typical {monthLabel(month)} day, electricity (simulated)</h4>
        <div className="h-24 w-full" aria-hidden="true">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={hourly} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
              <XAxis dataKey="hour" tick={{ fontSize: 10 }} interval={5} />
              <YAxis width={28} tick={{ fontSize: 10 }} />
              <Line type="monotone" dataKey="kW" stroke="var(--primary)" dot={false} strokeWidth={2} isAnimationActive={false} />
              <ReferenceLine x={hour} stroke="var(--heat)" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section aria-label="Equipment, schedules and efficiency">
        <h4 className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">Major equipment</h4>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">No modeled equipment for this zone.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {items.map((i) => (
              <li key={i.id}>
                {i.label} <span className="text-muted-foreground">{quantityText(i)}</span>{" "}
                <span className="text-[10px] text-text-muted">{i.estimated ? "estimated" : "your data"}</span>
              </li>
            ))}
          </ul>
        )}
        {schedules.length > 0 && (
          <p className="mt-2 text-xs text-muted-foreground"><span className="font-medium text-foreground">Operating schedule:</span> {schedules.join("; ")}</p>
        )}
        {efficiencies.length > 0 && (
          <p className="mt-1 text-xs text-muted-foreground"><span className="font-medium text-foreground">Efficiency assumptions:</span> {efficiencies.join("; ")}</p>
        )}
      </section>

      <section aria-label="Opportunities for improvement">
        <h4 className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">Opportunities for improvement</h4>
        {opps.length === 0 ? (
          <p className="text-sm text-muted-foreground">No modeled upgrade lowers this zone's cost.</p>
        ) : (
          <ul className="space-y-2">
            {opps.map((o) => (
              <li key={o.id} className="rounded-lg border border-glass-border p-2 text-sm">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-medium">{o.label}</span>
                  <span className="shrink-0 text-savings tabular-nums">saves {usd(o.zoneAnnualSavings)} / yr here</span>
                </div>
                <div className="text-xs text-muted-foreground">
                  Whole hotel: saves {usd(o.totalAnnualSavings)} a year for about {usd(o.cost)}
                  {o.paybackYears !== null ? `, payback ${o.paybackYears.toFixed(1)} years` : ""}.
                </div>
                {o.comfortImpact === "minor" && o.comfortNote && <div className="text-xs text-heat">Comfort: {o.comfortNote}</div>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </aside>
  );
}
