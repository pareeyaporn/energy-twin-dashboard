import { AskAbout } from "@/advisor/AskAbout";
import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ArrowRight, BarChart3, Building2, Gauge, Info, Lightbulb, PiggyBank, ShieldAlert, Wrench } from "lucide-react";
import { INSIGHT_CATEGORY_LABEL } from "@/engine/hotel";
import type { EnergyInsight, InsightCategory } from "@/engine/hotel";
import { useTwin } from "@/store/useTwin";
import { selectEnergyInsights, selectIsSynthetic } from "@/store/hotelDerived";
import { openWorkspaceTab, waitFor } from "@/tour/dom";
import { ShowMore, SidebarHeading, reveal } from "@/app/sidebar";

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

/**
 * How a card is labeled (mapping documented in docs/11, task H-SB). Display only: built from fields every insight already has (its id,
 * category and the engine's `priority`, a size threshold relative to the bill); nothing is ranked or reordered. The intensity card
 * compares the hotel with a benchmark, so it reads "Benchmark observation" rather than its engine category.
 */
export function insightLabel(i: EnergyInsight): { category: string; impact: string; warning: boolean } {
  const high = i.priority === "high";
  const category = i.id === "intensity" ? "Benchmark observation" : INSIGHT_CATEGORY_LABEL[i.category];
  switch (i.id) {
    case "investment":
      return { category, impact: high ? "Large saving" : "Saving", warning: false };
    case "cost_driver":
      return { category, impact: high ? "Major cost driver" : "Cost driver", warning: false };
    case "intensity":
      return { category, impact: high ? "Well above benchmark" : "Above benchmark", warning: false };
    case "occupancy":
      return { category, impact: high ? "High sensitivity" : "Moderate sensitivity", warning: false };
    default:
      // price, weather, equipment: exposure to a stress; only a large one is a genuine warning (amber).
      return { category, impact: high ? "Significant exposure" : "Exposure to watch", warning: high };
  }
}

const sentences = (text: string) => text.trim().split(/(?<=[.!?])\s+(?=[A-Z0-9$])/).filter(Boolean);

function InsightCard({ insight, onAction }: { insight: EnergyInsight; onAction: (i: EnergyInsight) => void }) {
  const [open, setOpen] = useState(false);
  const Icon = insight.id === "intensity" ? BarChart3 : ICON[insight.category];
  const label = insightLabel(insight);
  const [lead, ...rest] = sentences(insight.body);
  const methodId = `insight-method-${insight.id}`;
  return (
    <li className="rounded-xl border border-border/70 bg-card/60 p-3 transition-colors hover:border-primary/30 motion-reduce:transition-none" data-testid="insight-card" data-insight={insight.id}>
      <div className="flex items-start gap-2.5">
        <span className={`mt-0.5 grid size-7 shrink-0 place-items-center rounded-md ${label.warning ? "bg-heat/15 text-heat" : "bg-primary/10 text-primary"}`} aria-hidden>
          <Icon className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-1">
            <p className="flex min-w-0 flex-wrap items-center gap-x-1.5 pt-0.5 text-[10px] leading-tight" data-testid="insight-label">
              <span className="text-muted-foreground">{label.category}</span>
              <span aria-hidden className="text-muted-foreground/50">·</span>
              <span className={`font-medium ${label.warning ? "text-heat" : "text-primary"}`}>{label.impact}</span>
            </p>
            <span className="-mr-1.5 -mt-1.5 flex shrink-0 items-center">
              <button
                type="button"
                onClick={() => setOpen((o) => !o)}
                aria-expanded={open}
                aria-controls={methodId}
                aria-label="How was this calculated?"
                title="How was this calculated?"
                className="grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                data-testid="insight-how"
              >
                <Info className="size-3.5" aria-hidden />
              </button>
              <AskAbout question={`Explain this finding and what to do about it: ${insight.title}`} label="" className="size-7 justify-center px-0" />
            </span>
          </div>
          <h3 className="mt-0.5 text-[13px] font-semibold leading-snug">{insight.title}</h3>
          <div className="mt-0.5 flex items-baseline gap-1.5">
            <span className="num shrink-0 whitespace-nowrap text-lg font-semibold text-primary" data-testid="insight-metric">{formatMetric(insight.metric)}</span>
            <span className="text-[11px] leading-snug text-muted-foreground">{insight.metric.label}</span>
          </div>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{lead}</p>
          {open && (
            <div id={methodId} className={`mt-1.5 space-y-1.5 rounded-md bg-muted/40 p-2 text-[11px] leading-relaxed text-muted-foreground ${reveal}`} data-testid="insight-method">
              {rest.length > 0 && <p className="text-foreground/80">{rest.join(" ")}</p>}
              <p><span className="font-medium text-foreground">How was this calculated? </span>{insight.method}</p>
            </div>
          )}
          <button
            type="button"
            onClick={() => onAction(insight)}
            className="mt-2 inline-flex min-h-8 items-center gap-1 rounded-md border border-primary/40 bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary hover:bg-primary/20"
            data-testid="insight-action"
          >
            {insight.action.label} <ArrowRight className="size-3" />
          </button>
        </div>
      </div>
    </li>
  );
}

/** How many insights the Hotel step shows before "View all". */
export const INSIGHTS_SHOWN = 2;

/**
 * Energy insights: 3 to 5 findings for the open hotel, each with its figure, a plain explanation and a button to the feature that
 * deals with it. Built by deterministic rules from the engine's results (src/engine/hotel/insights.ts); they follow the hotel that is open.
 * The first two, in the engine's order, show by default; "View all N insights" opens the rest (and closes again).
 */
export function EnergyInsights() {
  const insights = useTwin(selectEnergyInsights);
  const synthetic = useTwin(selectIsSynthetic);
  const name = useTwin((s) => s.hotel.profile.name);
  const act = useInsightAction();
  const [all, setAll] = useState(false);
  const shown = all ? insights : insights.slice(0, INSIGHTS_SHOWN);
  const more = insights.length - INSIGHTS_SHOWN;
  return (
    <section aria-label="Energy insights" className="space-y-2" data-testid="energy-insights">
      <SidebarHeading
        icon={<Lightbulb className="size-4 text-primary" aria-hidden />}
        title="Top opportunities"
        right={<span className="shrink-0 text-[10px] text-muted-foreground">{insights.length} {insights.length === 1 ? "finding" : "findings"} · estimates</span>}
      />
      {insights.length === 0 ? (
        <p className="text-xs text-muted-foreground">No finding stands out for {name} on today's modeled figures.</p>
      ) : (
        <ul className="space-y-2" id="insights-list">
          {shown.map((i) => <InsightCard key={i.id} insight={i} onAction={act} />)}
        </ul>
      )}
      <div className="flex flex-wrap items-center justify-between gap-x-3">
        {more > 0 && (
          <ShowMore open={all} onClick={() => setAll((o) => !o)} more={`View all ${insights.length} insights`} less={`Show top ${INSIGHTS_SHOWN}`} controls="insights-list" testId="insights-toggle" />
        )}
        <p className="flex items-start gap-1 text-[10px] text-muted-foreground">
          <Building2 className="mt-px size-3 shrink-0" aria-hidden />
          Today's baseline{synthetic ? " · synthetic" : ""} · savings may differ
        </p>
      </div>
    </section>
  );
}
