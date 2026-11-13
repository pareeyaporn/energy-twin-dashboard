// Where the app opens. New visitors (and Reset demo) land on the portfolio; a returning user lands where they last were (the portfolio
// or the hotel dashboard), once per page load. An organization with a single hotel goes straight to that hotel.
import type { WorkspaceTab } from "@/tour/steps";
import { openWorkspaceTab, waitFor } from "@/tour/dom";

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
 * The top bar's Reports: the hotel's Invest tab, scrolled to the report buttons (Preview / Download PDF) when a plan exists; otherwise the
 * Invest tab itself, where "Find the best investments" makes one. Navigation only: nothing is computed or changed.
 */
export async function openReports(): Promise<void> {
  if (!(await openTabWhenReady("Invest"))) return;
  const actions = await waitFor(() => Array.from(document.querySelectorAll('aside[aria-label="Workspace"] [data-testid="report-actions"]')), 1500);
  actions[0]?.scrollIntoView({ block: "center", behavior: "smooth" });
}
