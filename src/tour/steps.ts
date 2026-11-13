// The onboarding tour's steps, written for hotel operators. Each step names the page and workspace tab it needs, how to find the part of
// the screen it explains, an optional view to show while it is on screen (time playback, a twin layer; restored afterwards), and whether
// it carries a live figure (`insights.ts`). The tour never changes the hotel, the scenario or any plan.
import type { CompareMode, TimeMode, TwinLayer, TwinState } from "@/store/useTwin";

export type WorkspaceTab = "Hotel" | "Scenario" | "Invest" | "Ask";

/** View-only settings a step may show (the hotel's data is untouched); the tour restores the user's own when it moves on. */
export interface TourView {
  timeMode: TimeMode;
  timeMonth: number;
  timeHour: number;
  playing: boolean;
  playbackSpeed: number;
  twinLayer: TwinLayer;
  compareMode: CompareMode;
}

export interface TourStep {
  id: string;
  title: string;
  body: string | ((s: TwinState) => string);
  /** Page the step lives on. */
  route: "/hotel" | "/";
  /** Workspace tab to show first (main page only). */
  tab?: WorkspaceTab;
  /** The elements to highlight (their combined area); none = a centered card. */
  target?: () => Element[];
  view?: Partial<TourView>;
  /** A large centered card (welcome and finish). */
  hero?: boolean;
  /** Shows the step's live figure from the engine. */
  insight?: boolean;
}

/** The first matching element that is actually on screen (some labels exist twice, one copy hidden). */
function visible(selector: string, root: ParentNode = document): Element | null {
  for (const el of Array.from(root.querySelectorAll(selector))) {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) return el;
  }
  return null;
}
const all = (...els: (Element | null | undefined)[]) => els.filter((e): e is Element => !!e);
const twin = () => visible('section[aria-label="Hotel digital twin"]');
const workspacePanel = () => visible('aside[aria-label="Workspace"] [role="tabpanel"]') ?? visible('aside[aria-label="Workspace"]');

export const TOUR_STEPS: TourStep[] = [
  {
    id: "welcome",
    title: "Welcome to Energy Twin",
    body: (s) =>
      `Energy Twin helps hotel operators understand energy costs and find smarter investments: see the savings before you spend. ${
        s.portfolio.synthetic ? `${s.portfolio.name} is a sample chain with synthetic data.` : `This is ${s.portfolio.name}.`
      }`,
    route: "/",
    hero: true,
    insight: true,
  },
  {
    id: "portfolio-kpis",
    title: "Your whole portfolio at a glance",
    body: "Energy spending, carbon and the savings the best upgrades could bring, across every hotel. Switch organization or filter by brand, region, ownership or city.",
    route: "/",
    target: () => all(visible('[data-testid="portfolio-kpis"]')),
    insight: true,
  },
  {
    id: "portfolio",
    title: "Compare your hotels on the map",
    body: "Color the hotels by energy cost, efficiency, savings potential or investment priority to see where to focus.",
    route: "/",
    target: () => all(visible('section[aria-label="City map"]')),
    insight: true,
  },
  {
    id: "ranking",
    title: "Which hotel first?",
    body: "Hotels ranked by investment priority: the best 10-year return per dollar invested, not simply the biggest bill. Open any hotel to analyze it.",
    route: "/",
    target: () => all(visible('[data-testid="portfolio-table"]')),
    insight: true,
  },
  {
    id: "profile",
    title: "Make it your hotel",
    body: "Each hotel opens with its profile. Edit the details, or load 12 months of utility bills to calibrate the model to your building.",
    route: "/hotel",
    tab: "Hotel",
    target: () => all(visible('[data-testid="utility-section"]') ?? workspacePanel()),
    insight: true,
  },
  {
    id: "insights",
    title: "What deserves your attention",
    body: "Energy Twin reads the results for you: the biggest cost drivers, risks and opportunities, each with a next step.",
    route: "/hotel",
    tab: "Hotel",
    target: () => all(visible('[data-testid="energy-insights"]')),
    insight: true,
  },
  {
    id: "seasons",
    title: "Watch a year go by",
    body: "Snow in January, cooling on July afternoons, guests checking in and out: the building and its meter follow every hour of every month.",
    route: "/hotel",
    tab: "Hotel",
    target: () => all(document.getElementById("twin-panel")),
    view: { twinLayer: "zones", timeMode: "seasons", timeMonth: 0, timeHour: 18, playing: true, playbackSpeed: 4 },
    insight: true,
  },
  {
    id: "drivers",
    title: "Test a decision before you make it",
    body: "Change occupancy, room temperatures, schedules or energy prices and see the cost, energy and carbon change. Nothing changes in your real hotel.",
    route: "/hotel",
    tab: "Scenario",
    target: () => all(visible('aside[aria-label="Workspace"] [aria-label="Scenario controls"]') ?? workspacePanel()),
    insight: true,
  },
  {
    id: "stress",
    title: "Prepare for the unexpected",
    body: "Heat waves, cold snaps, conference surges, worn equipment, price rises: see what each would add to your bill, and how a plan protects you.",
    route: "/hotel",
    tab: "Hotel",
    target: () => all(visible('section[aria-label="Hotel digital twin"] section[aria-label="Stress tests"]')),
    insight: true,
  },
  {
    id: "optimizer",
    title: "Find the best investments",
    body: "Enter a budget and Energy Twin tests every combination of upgrades, with installed cost, confirmed incentives and guest comfort counted.",
    route: "/hotel",
    tab: "Invest",
    target: () => {
      const panel = visible('aside[aria-label="Workspace"]');
      const budget = panel?.querySelector("#panel-hotel-budget")?.closest(".space-y-2");
      const run = Array.from(panel?.querySelectorAll("button") ?? []).find((b) => /Find the best investments|Testing combinations/.test(b.textContent ?? ""));
      return all(budget, run);
    },
    insight: true,
  },
  {
    id: "projections",
    title: "See each investment's 10-year payoff",
    body: "Every package comes with a year-by-year projection: what you pay upfront, what it saves as prices rise, when it pays back and what it is worth after 10 years.",
    route: "/hotel",
    tab: "Invest",
    target: () => all(visible('aside[aria-label="Workspace"] section[aria-label="Investment packages"]') ?? workspacePanel()),
    insight: true,
  },
  {
    id: "report",
    title: "Compare, decide, share",
    body: "Compare the AI plan with your own, read what the numbers mean, and download a PDF report for your owners or finance team. Every figure says how it was calculated.",
    route: "/hotel",
    tab: "Invest",
    target: () => all(visible('[data-testid="report-actions"]') ?? visible('[role="tablist"][aria-label="Investment mode"]') ?? workspacePanel()),
  },
  {
    id: "finish",
    title: "You're ready to explore!",
    body: "Start from the portfolio, open a hotel, test what could change and find the investments that pay back. Ask the advisor anything in the Ask tab, and replay this tour from the top bar.",
    route: "/hotel",
    hero: true,
  },
];

export const bodyOf = (step: TourStep, s: TwinState) => (typeof step.body === "function" ? step.body(s) : step.body);
