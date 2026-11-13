// Where the app opens. New visitors (and Reset demo) land on the portfolio; a returning user lands where they last were (the portfolio
// or the hotel dashboard), once per page load. An organization with a single hotel goes straight to that hotel.
import type { WorkspaceTab } from "@/tour/steps";
import { openWorkspaceTab, waitFor } from "@/tour/dom";
import { useTwin } from "@/store/useTwin";

export const LAST_VIEW_KEY = "energy-twin:last-view:v1";
export type AppView = "portfolio" | "hotel";

export function rememberView(view: AppView): void {
  try {
    window.localStorage.setItem(LAST_VIEW_KEY, view);
  } catch {
    /* storage blocked: nothing to remember */
  }
}

export function lastView(): AppView | null {
  try {
    const v = window.localStorage.getItem(LAST_VIEW_KEY);
    return v === "portfolio" || v === "hotel" ? v : null;
  } catch {
    return null;
  }
}

export function forgetView(): void {
  try {
    window.localStorage.removeItem(LAST_VIEW_KEY);
  } catch {
    /* ignore */
  }
}

let landingDone = false;
/** True only the first time the home page asks in this page load (later visits to `/` are the user's own choice). */
export function firstLanding(): boolean {
  if (landingDone) return false;
  landingDone = true;
  return true;
}
/** For tests. */
export const resetLanding = () => {
  landingDone = false;
};

/** After navigating to the hotel dashboard, open one of its workspace tabs (for example Invest) once the tabs are on screen. */
export async function openTabWhenReady(tab: WorkspaceTab): Promise<boolean> {
  const tabs = await waitFor(() => Array.from(document.querySelectorAll('aside[aria-label="Workspace"] [role="tab"]')), 3000);
  return tabs.length > 0 && openWorkspaceTab(tab);
}

/**
 * The top bar's Reports: the hotel's Invest tab and the report preview. With no plan yet, it first runs the optimizer for the open hotel
 * (the same "Find the best investments" action, at the hotel's budget and objective, on the scenario when "Optimize for this scenario" is
 * on), because a report is always about a plan. Then it opens the preview; Download PDF is in the preview. An existing plan is never
 * replaced.
 */
export async function openReports(): Promise<void> {
  if (!(await openTabWhenReady("Invest"))) return;
  const s = useTwin.getState();
  if (!s.hotelPlan && !s.optimizing) await s.runHotelOptimizer();
  else if (s.optimizing) {
    // A run already started: wait for it (at most 10 s) rather than start another.
    for (let i = 0; i < 100 && useTwin.getState().optimizing; i++) await new Promise((r) => setTimeout(r, 100));
  }
  const preview = await waitFor(() => Array.from(document.querySelectorAll('aside[aria-label="Workspace"] [data-testid="report-preview"]')).filter((b) => !(b as HTMLButtonElement).disabled), 5000);
  const button = preview[0] as HTMLButtonElement | undefined;
  if (!button) return;
  button.scrollIntoView({ block: "center", behavior: "smooth" });
  button.click();
}
