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
  /** Opens the portfolio's top-priority hotel first (the story's hotel); the user's own state comes back at the end of the tour. */
  focus?: boolean;
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
  // ---- The portfolio: where is the money going, and where to start? ----
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
    body: "Hotels ranked by investment priority: the best 10-year return per dollar invested, not simply the biggest bill.",
    route: "/",
    target: () => all(visible('[data-testid="portfolio-table"]')),
    insight: true,
  },
  {
    id: "portfolio-optimizer",
    title: "Split one budget across the chain",
    body: "Give the portfolio optimizer one budget and it picks the best package for each hotel, so every dollar goes where it returns the most.",
    route: "/",
    target: () => all(visible('section[aria-label="Portfolio investments"]')),
    insight: true,
  },
  // ---- One hotel: the story follows the top-priority hotel ----
  {
    id: "explore",
    title: "Open the hotel to start with",
    body: (s) => `This is ${s.hotel.profile.name}, the top priority. Its digital twin shows the building, its energy and its costs, and the breadcrumb takes you back to the portfolio.`,
    route: "/hotel",
    tab: "Hotel",
    focus: true,
    target: () => {
      const t = twin();
      return all(t?.querySelector("header") ?? t);
    },
    view: { twinLayer: "zones" },
    insight: true,
  },
  {
    id: "profile",
    title: "Make it your hotel",
    body: "Correct the hotel's details, or load 12 months of utility bills to calibrate the model to the building's real use.",
    route: "/hotel",
    tab: "Hotel",
    focus: true,
    target: () => all(visible('[data-testid="utility-section"]') ?? visible('[data-testid="profile-data"]') ?? workspacePanel()),
    insight: true,
  },
  {
    id: "insights",
    title: "What deserves your attention",
    body: "Energy Twin reads the results for you: the biggest cost drivers, risks and opportunities, each with a next step.",
    route: "/hotel",
    tab: "Hotel",
    focus: true,
    target: () => all(visible('[data-testid="energy-insights"]')),
    insight: true,
  },
  {
    id: "twin",
    title: "See where the energy goes",
    body: "Each zone of the building is colored by what it costs. Explore it room by room, system by system, or as an energy flow.",
    route: "/hotel",
    tab: "Hotel",
    focus: true,
    target: () => {
      const t = twin();
      return all(t?.querySelector('[aria-label="Twin layer"]')?.parentElement, document.getElementById("twin-panel"));
    },
    view: { twinLayer: "zones" },
    insight: true,
  },
  {
    id: "seasons",
    title: "Watch a year go by",
    body: "Snow in January, cooling on July afternoons, guests checking in and out: the building and its meter follow every hour of every month.",
    route: "/hotel",
    tab: "Hotel",
    focus: true,
    target: () => all(document.getElementById("twin-panel")),
    view: { twinLayer: "zones", timeMode: "seasons", timeMonth: 0, timeHour: 18, playing: true, playbackSpeed: 4 },
    insight: true,
  },
  {
    id: "equipment",
    title: "The equipment you actually have",
    body: "Boilers, chillers, lighting, water heaters: correct what is installed and the baseline follows. A correction is never counted as a saving.",
    route: "/hotel",
    tab: "Hotel",
    focus: true,
    target: () => all(document.getElementById("twin-panel")),
    view: { twinLayer: "equipment" },
  },
  {
    id: "drivers",
    title: "Test a decision before you make it",
    body: "Change occupancy, room temperatures, schedules or energy prices and see the cost, energy and carbon change. Nothing changes in your real hotel.",
    route: "/hotel",
    tab: "Scenario",
    focus: true,
    target: () => all(visible('aside[aria-label="Workspace"] [aria-label="Scenario controls"]') ?? workspacePanel()),
    insight: true,
  },
  {
    id: "stress",
    title: "Prepare for the unexpected",
    body: "Heat waves, cold snaps, conference surges, worn equipment, price rises: see what each would add to your bill, and how a plan protects you.",
    route: "/hotel",
    tab: "Hotel",
    focus: true,
    target: () => all(visible('section[aria-label="Hotel digital twin"] section[aria-label="Stress tests"]')),
    insight: true,
  },
  // ---- Invest, decide, share ----
  {
    id: "optimizer",
    title: "Find the best investments",
    body: "Enter a budget and Energy Twin tests every combination of upgrades, with installed cost, confirmed incentives and guest comfort counted.",
    route: "/hotel",
    tab: "Invest",
    focus: true,
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
    focus: true,
    target: () => all(visible('aside[aria-label="Workspace"] section[aria-label="Investment packages"]') ?? workspacePanel()),
    insight: true,
  },
  {
    id: "plans",
    title: "Build your own plan and compare",
    body: "Pick upgrades yourself, or start from the AI plan and change it. Compare them side by side: upfront cost, savings, payback, NPV and carbon, on the same assumptions.",
    route: "/hotel",
    tab: "Invest",
    focus: true,
    target: () => all(visible('[role="tablist"][aria-label="Investment mode"]')),
  },
  {
    id: "report",
    title: "Share it as a report",
    body: "Download a PDF for owners or the finance team: the recommendation, before and after, the investment, the cash flow and every assumption, labeled as estimates.",
    route: "/hotel",
    tab: "Invest",
    focus: true,
    target: () => all(visible('[data-testid="report-actions"]') ?? visible('[role="tablist"][aria-label="Investment mode"]') ?? workspacePanel()),
  },
  {
    id: "advisor",
    title: "Ask in plain English",
    body: "Ask why a cost is high or how to spend a budget. The AI explains the model's results, and every number it quotes is checked against them.",
    route: "/hotel",
    tab: "Ask",
    focus: true,
    target: () => all(workspacePanel()),
  },
  {
    id: "finish",
    title: "You're ready to explore!",
    body: "Start from the portfolio, open a hotel, test what could change and find the investments that pay back. Replay this tour any time from the top bar.",
    route: "/hotel",
    focus: true,
    hero: true,
  },
];

export const bodyOf = (step: TourStep, s: TwinState) => (typeof step.body === "function" ? step.body(s) : step.body);
