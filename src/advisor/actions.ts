import { advisor } from "@/engine/hotel";
import { useTwin } from "@/store/useTwin";
import type { AdvisorMessage } from "@/store/useTwin";
import { openWorkspaceTab } from "@/tour/dom";
import { openReports } from "@/app/landing";
import { OPTIMIZER_ANCHOR } from "@/portfolio/anchors";

/**
 * The advisor's action buttons (docs/23). Each one comes from a tool the engine ran for this answer (`actionsForRuns`), never from the
 * AI's text, and changes the app only when the user clicks it. Returns a short status line for screen readers.
 */
export function actionsFor(message: AdvisorMessage): advisor.AdvisorAction[] {
  return message.runs?.length ? advisor.actionsForRuns(message.runs) : [];
}

export interface ActionContext {
  /** Go to the portfolio page (the router's navigate); absent outside the router. */
  goHome?: (() => void) | undefined;
  reduce?: boolean;
}

const scrollTo = (selector: string, reduce?: boolean) =>
  setTimeout(() => document.querySelector(selector)?.scrollIntoView({ block: "start", behavior: reduce ? "auto" : "smooth" }), 120);

export function runAdvisorAction(action: advisor.AdvisorAction, message: AdvisorMessage, ctx: ActionContext = {}): string {
  const run = message.runs?.find((r) => r.id === action.runId);
  const s = useTwin.getState();
  if (!run?.detail) return "That result is no longer available.";
  const sameHotel = !message.hotelRef || message.hotelRef === s.hotel;
  switch (action.kind) {
    case "apply_scenario": {
      if (!sameHotel || !run.detail.scenario) return "This what-if was computed for another hotel; ask again.";
      s.resetScenario();
      useTwin.getState().setScenario(run.detail.scenario);
      openWorkspaceTab("Scenario");
      return "What-if applied to the twin.";
    }
    case "apply_package":
    case "make_plan":
    case "preview_report": {
      const plan = run.detail.plan;
      const winner = plan?.objectiveWinner;
      if (!plan || !winner || !run.detail.planBaseline || !message.hotelRef) return "No package to apply.";
      if (!s.adoptHotelPlan(plan, run.detail.planBaseline, winner.evaluation.id, message.hotelRef)) return "This plan was computed for another hotel or settings; ask again.";
      if (action.kind === "make_plan") {
        useTwin.getState().customizeFromPackage(winner.evaluation.id);
        openWorkspaceTab("Invest");
        return "Copied into Build your own plan.";
      }
      if (action.kind === "preview_report") {
        void openReports();
        return "Opening the report preview.";
      }
      return "Package applied to the twin.";
    }
    case "open_stress": {
      if (!sameHotel || !run.detail.stressId) return "This stress test was run for another hotel; ask again.";
      s.applyStressTest(run.detail.stressId);
      openWorkspaceTab("Scenario");
      scrollTo('section[aria-label="Stress tests"]', ctx.reduce);
      return "Stress test applied.";
    }
    case "open_portfolio_plan": {
      if (!run.detail.portfolioPlan) return "No portfolio plan to open.";
      s.adoptPortfolioPlan(run.detail.portfolioPlan);
      const here = document.querySelector(`[data-anchor="${OPTIMIZER_ANCHOR}"]`);
      if (here) {
        scrollTo(`[data-anchor="${OPTIMIZER_ANCHOR}"]`, ctx.reduce);
      } else {
        s.setPortfolioView({ anchor: OPTIMIZER_ANCHOR });
        ctx.goHome?.();
      }
      return "Portfolio plan opened.";
    }
  }
}
