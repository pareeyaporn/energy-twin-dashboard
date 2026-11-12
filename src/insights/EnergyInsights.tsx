import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { AlertTriangle, ArrowRight, Building2, ChevronDown, Gauge, Lightbulb, PiggyBank, ShieldAlert, Wrench } from "lucide-react";
import { INSIGHT_CATEGORY_LABEL } from "@/engine/hotel";
import type { EnergyInsight, InsightCategory } from "@/engine/hotel";
import { useTwin } from "@/store/useTwin";
import { selectEnergyInsights, selectIsSynthetic } from "@/store/hotelDerived";
import { openWorkspaceTab, waitFor } from "@/tour/dom";

const ICON: Record<InsightCategory, typeof Lightbulb> = {
  cost_reduction: PiggyBank,
  operational_efficiency: Gauge,
  equipment_performance: Wrench,
  energy_resilience: ShieldAlert,
  investment_opportunity: Lightbulb,
};

export function formatMetric(m: EnergyInsight["metric"]): string {
  if (m.format === "usd") return `$${Math.round(Math.abs(m.value)).toLocaleString("en-US")}`;
  if (m.format === "pct") return `${Math.round(m.value * 100)}%`;
  return `${m.value.toFixed(1)} kBtu/ft²`;
}

/** Scrolls to the first element a selector finds once it exists (after a tab switch or a page change). */
async function scrollToFirst(selectors: string[]) {
  const els = await waitFor(() => selectors.map((q) => document.querySelector(q)).filter((e): e is Element => !!e).slice(0, 1), 3000);
  els[0]?.scrollIntoView({ block: "start", behavior: useTwin.getState().reduceEffects ? "auto" : "smooth" });
}

/** Runs an insight's action: every action opens an existing feature (and only changes what the button says it does). */
export function useInsightAction() {
  const navigate = useNavigate();
  return (insight: EnergyInsight) => {
    const s = useTwin.getState();
    const a = insight.action;
    switch (a.kind) {
      case "invest":
        openWorkspaceTab("Invest");
        void s.runHotelOptimizer();
        break;
      case "equipment":
        s.setTwinLayer("equipment");
        void scrollToFirst(["#twin-panel"]);
        break;
      case "stress":
        s.applyStressTest(a.testId);
        void scrollToFirst(['section[aria-label="Hotel digital twin"] section[aria-label="Stress tests"]', 'section[aria-label="Stress tests"]']);
        break;
      case "scenario": {
        // The same what-if the insight measured: occupancy +10 points (Reset in the Scenario tab undoes it).
        const to = Math.min(1, Math.round((s.hotel.profile.occupancy + 0.1) * 100) / 100);
        openWorkspaceTab("Scenario");
        s.setScenario({ occupancy: to });
        break;
      }
      case "portfolio":
        void navigate({ to: "/portfolio" }).then(() => scrollToFirst(['section[aria-label="Property comparison"]', '[data-testid="portfolio-table"]']));
        break;
    }
  };
}

function InsightCard({ insight, onAction }: { insight: EnergyInsight; onAction: (i: EnergyInsight) => void }) {
  const [open, setOpen] = useState(false);
  const Icon = ICON[insight.category];
  return (
    <li className="rounded-lg border border-border bg-card p-3" data-testid="insight-card" data-insight={insight.id}>
      <div className="flex items-start gap-2.5">
        <span className={`mt-0.5 grid size-7 shrink-0 place-items-center rounded-md ${insight.priority === "high" ? "bg-heat/15 text-heat" : "bg-primary/10 text-primary"}`} aria-hidden>
          <Icon className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
            <span className="rounded-full border border-glass-border px-1.5 py-px text-muted-foreground">{INSIGHT_CATEGORY_LABEL[insight.category]}</span>
            <span className={`rounded-full px-1.5 py-px font-medium ${insight.priority === "high" ? "bg-heat/15 text-heat" : "bg-primary/10 text-primary"}`}>
              {insight.priority === "high" ? "High priority" : "Worth a look"}
            </span>
          </div>
          <h3 className="mt-1 text-sm font-semibold leading-snug">{insight.title}</h3>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="num shrink-0 whitespace-nowrap text-lg font-semibold text-primary" data-testid="insight-metric">{formatMetric(insight.metric)}</span>
            <span className="text-[11px] text-muted-foreground">{insight.metric.label}</span>
          </div>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{insight.body}</p>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => onAction(insight)}
              className="inline-flex items-center gap-1 rounded-md border border-primary/40 bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary hover:bg-primary/20"
              data-testid="insight-action"
            >
              {insight.action.label} <ArrowRight className="size-3" />
            </button>
            <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="inline-flex items-center gap-0.5 text-[11px] text-muted-foreground hover:text-foreground">
              How was this calculated? <ChevronDown className={`size-3 transition-transform ${open ? "rotate-180" : ""}`} />
            </button>
          </div>
          {open && <p className="mt-1.5 rounded-md bg-muted/40 p-2 text-[11px] leading-relaxed text-muted-foreground">{insight.method}</p>}
        </div>
      </div>
    </li>
  );
}

/**
 * Energy insights: 3 to 5 findings for the open hotel, each with its figure, a plain explanation and a button to the feature that
 * deals with it. Built by deterministic rules from the engine's results (src/engine/hotel/insights.ts); they follow the hotel that is open.
 */
export function EnergyInsights() {
  const insights = useTwin(selectEnergyInsights);
  const synthetic = useTwin(selectIsSynthetic);
  const name = useTwin((s) => s.hotel.profile.name);
  const act = useInsightAction();
  return (
    <section aria-label="Energy insights" className="space-y-2" data-testid="energy-insights">
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold">
          <AlertTriangle className="size-4 text-primary" aria-hidden /> Opportunities &amp; alerts
        </h2>
        <span className="rounded-full border border-primary/30 px-1.5 text-[10px] text-primary">Estimates</span>
      </div>
      {insights.length === 0 ? (
        <p className="text-xs text-muted-foreground">No finding stands out for {name} on today's modeled figures.</p>
      ) : (
        <ul className="space-y-2">
          {insights.map((i) => <InsightCard key={i.id} insight={i} onAction={act} />)}
        </ul>
      )}
      <p className="flex items-start gap-1 text-[10px] text-muted-foreground">
        <Building2 className="mt-px size-3 shrink-0" aria-hidden />
        From the model's results for {name}{synthetic ? " (synthetic demo data)" : ""}, on today's baseline. Modeled estimates; actual savings may differ.
      </p>
    </section>
  );
}
