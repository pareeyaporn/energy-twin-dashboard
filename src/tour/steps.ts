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
      `Energy Twin is a digital twin of your hotels: see where the energy money goes, test decisions and find the investments that pay back, before you spend. ${
        s.portfolio.synthetic ? `${s.portfolio.name} is a sample chain with synthetic data.` : `This is ${s.portfolio.name}.`
      }`,
    route: "/",
    hero: true,
    insight: true,
  },
  {
    id: "portfolio-kpis",
    title: "Your whole portfolio at a glance",
    body: "What the chain spends on energy, its carbon, and the savings its best upgrades could bring. Switch organization, or use Filters for brand, region or ownership.",
    route: "/",
    target: () => all(visible('[data-testid="portfolio-kpis"]')),
    insight: true,
  },
  {
    id: "ranking",
    title: "Start with the top opportunity",
    body: "The hotel where an upgrade dollar returns the most over 10 years, not simply the biggest bill, with its savings, investment and payback. \"Why this hotel?\" shows the ranking.",
    route: "/",
    target: () => all(visible('[data-testid="start-here"]') ?? visible('[data-testid="portfolio-table"]')),
    insight: true,
  },
  {
    id: "portfolio",
    title: "Your chain as a living city map",
    body: "Chicago in 3D with every hotel on it. Color the hotels by cost, efficiency, savings or priority; click one to fly in and open its card.",
    route: "/",
    target: () => all(visible('section[aria-label="City map"]')),
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
    id: "insights",
    title: "What deserves your attention",
    body: "A short briefing, then the top findings: the biggest cost drivers, risks and opportunities, each with one next step. \"View all\" shows the rest.",
    route: "/hotel",
    tab: "Hotel",
    focus: true,
    target: () => all(visible('[data-testid="briefing"]'), visible('[data-testid="energy-insights"]')),
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
    id: "flow",
    title: "Follow the money, the energy and the carbon",
    body: "Every flow from the grid and the gas line to each zone and use. Switch the width to Carbon: gas is cheap per unit but carbon-heavy, so heating and hot water grow.",
    route: "/hotel",
    tab: "Hotel",
    focus: true,
    target: () => all(document.getElementById("twin-panel")),
    view: { twinLayer: "flow" },
    insight: true,
  },
  {
    id: "equipment",
    title: "Make it your hotel",
    body: "Correct the equipment you actually have, the hotel's details, or load 12 months of bills under Hotel profile & data to calibrate the model. A correction is never counted as a saving.",
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
    tab: "Scenario",
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
    id: "report",
    title: "Build your own plan, then share it",
    body: "Start from the recommended plan or build your own, compare them on the same assumptions, then download a PDF for owners and finance: every figure labeled as an estimate.",
    route: "/hotel",
    tab: "Invest",
    focus: true,
    target: () => {
      const tabs = visible('[role="tablist"][aria-label="Investment mode"]');
      const t = all(tabs, visible('[data-testid="report-actions"]'));
      if (!t.length) return all(workspacePanel());
      // Both together only when they fit on screen (on a phone they are far apart): otherwise the plan tabs alone.
      const top = Math.min(...t.map((e) => e.getBoundingClientRect().top));
      const bottom = Math.max(...t.map((e) => e.getBoundingClientRect().bottom));
      return bottom - top > window.innerHeight * 0.7 && tabs ? [tabs] : t;
    },
  },
  {
    id: "advisor",
    title: "Ask in plain English",
    body: "Ask \"what if occupancy hits 85%?\" or \"what should I do with $50,000?\". The AI runs the engine for you, shows the result card, and Apply puts it on the twin. Every number is checked against the model.",
    route: "/hotel",
    tab: "Ask",
    focus: true,
    target: () => all(workspacePanel()),
  },
  {
    id: "finish",
    title: "You're ready to explore!",
    body: "Start from the portfolio, open a hotel, test what could change and find the investments that pay back. Replay the quick or the full tour any time from the top bar.",
    route: "/hotel",
    focus: true,
    hero: true,
  },
];

export const bodyOf = (step: TourStep, s: TwinState) => (typeof step.body === "function" ? step.body(s) : step.body);

/** The two tours: the quick one tells the story in 8 steps; the full one covers every feature. */
export type TourMode = "quick" | "full";
export const QUICK_TOUR_IDS = ["welcome", "ranking", "portfolio", "explore", "drivers", "optimizer", "advisor", "finish"] as const;
export function tourSteps(mode: TourMode): TourStep[] {
  return mode === "full" ? TOUR_STEPS : QUICK_TOUR_IDS.map((id) => TOUR_STEPS.find((x) => x.id === id)!);
}

