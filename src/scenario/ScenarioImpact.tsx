import { RotateCcw } from "lucide-react";
import { STRESS_TESTS, stressPeriodText } from "@/engine/hotel";
import type { ImpactLine } from "@/engine/hotel";
import { useTwin } from "@/store/useTwin";
import { selectScenarioImpact } from "@/store/hotelDerived";

const fmt = (l: ImpactLine, v: number) =>
  l.id === "cost" ? `$${Math.round(Math.abs(v)).toLocaleString("en-US")}` : `${Math.round(Math.abs(v)).toLocaleString("en-US")}`;
const signed = (l: ImpactLine) => `${l.delta > 0 ? "+" : l.delta < 0 ? "−" : ""}${fmt(l, l.delta)}`;
const pct = (p: number | null) => (p === null ? "—" : `${p > 0 ? "+" : p < 0 ? "−" : ""}${Math.abs(p * 100).toFixed(1)}%`);
const UNIT: Record<ImpactLine["id"], string> = { elecKWh: "kWh", gasTherms: "therms", cost: "", carbonKg: "kg CO₂e" };

/**
 * What the active what-if or stress test changes: electricity, gas, cost and carbon for the reference (today's operations) and the
 * scenario, with the change and the percentage change. Figures are the engine's two simulations; nothing is computed here.
 */
export function ScenarioImpact() {
  const lines = useTwin(selectScenarioImpact);
  const stressId = useTwin((s) => s.activeStressTest);
  const scenario = useTwin((s) => s.scenario);
  const reset = useTwin((s) => s.resetScenario);
  if (!lines) return null;
  const stress = STRESS_TESTS.find((t) => t.id === stressId);
  const what = [Object.keys(scenario).length ? "your operating changes" : null, stress ? `the ${stress.label.toLowerCase()} stress test` : null].filter(Boolean).join(" and ");
  const period = stress?.duration === "temporary" ? stressPeriodText(stress) : "per year";
  return (
    <section aria-label="Simulation impact" className="rounded-lg border border-primary/30 bg-primary/5 p-3" data-testid="scenario-impact">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold">Simulation impact</h2>
          <p className="mt-0.5 text-[11px] text-muted-foreground">Today's operations vs {what || "this scenario"}, {period}. Modeled estimates.</p>
        </div>
        <button type="button" onClick={reset} className="inline-flex shrink-0 items-center gap-1 rounded-md border border-glass-border px-2 py-0.5 text-[11px] text-muted-foreground hover:bg-accent" aria-label="Reset to baseline">
          <RotateCcw className="size-3" /> Reset
        </button>
      </div>
      <div className="table-scroll mt-2 overflow-x-auto">
        <table className="w-full min-w-[300px] text-xs tabular-nums">
          <caption className="sr-only">Simulation impact, modeled estimates</caption>
          <thead>
            <tr className="text-muted-foreground">
              <th className="pb-1 text-left font-normal" />
              <th className="pb-1 text-right font-normal">Today</th>
              <th className="pb-1 text-right font-normal">Scenario</th>
              <th className="pb-1 text-right font-normal">Change</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l) => (
              <tr key={l.id} className={l.id === "cost" ? "font-medium" : undefined} data-testid={`impact-${l.id}`}>
                <td className="py-0.5 pr-2">{l.label}{UNIT[l.id] && <span className="text-[10px] text-muted-foreground"> · {UNIT[l.id]}</span>}</td>
                <td className="py-0.5 text-right">{fmt(l, l.before)}</td>
                <td className="py-0.5 text-right">{fmt(l, l.after)}</td>
                <td className={`py-0.5 text-right ${l.delta > 0 ? "text-heat" : l.delta < 0 ? "text-savings" : "text-muted-foreground"}`}>
                  {signed(l)} <span className="text-[10px] opacity-80">({pct(l.pct)})</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
