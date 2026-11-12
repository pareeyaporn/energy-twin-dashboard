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
  route: "/" | "/portfolio";
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
    title: "Meet your hotel's digital twin",
    body: (s) =>
      `Energy Twin shows where your energy money goes, lets you test changes before you make them, and finds the upgrades that pay back. ${
        s.hotelPresetId !== null || s.portfolio.properties.find((p) => p.id === s.activePropertyId)?.synthetic
          ? `This is ${s.hotel.profile.name}, a sample hotel with synthetic data.`
          : `This is ${s.hotel.profile.name}, built from your inputs.`
      }`,
    route: "/",
    tab: "Hotel",
    hero: true,
    insight: true,
  },
  {
    id: "profile",
    title: "Make it your hotel",
    body: "Change rooms, systems, occupancy or bills under Edit details, or add your own hotels with Add my hotel on the Portfolio page. Every number recalculates for your building.",
    route: "/",
    tab: "Hotel",
    target: () => all(workspacePanel()),
    insight: true,
  },
  {
    id: "costs",
    title: "What you spend, at a glance",
    body: "Yearly energy cost, energy use and carbon, all modeled from the building, its systems, occupancy, local weather and prices.",
    route: "/",
    tab: "Hotel",
    target: () => all(visible('[data-testid="kpi-cost"]')?.parentElement),
    insight: true,
  },
  {
    id: "twin",
    title: "See where the energy goes",
    body: "Explore the hotel by zone, room by room, system by system or as an energy flow. Colors show where the money goes.",
    route: "/",
    tab: "Hotel",
    target: () => {
      const t = twin();
      return all(t?.querySelector("header"), t?.querySelector('[aria-label="Twin layer"]')?.parentElement);
    },
    view: { twinLayer: "zones" },
    insight: true,
  },
  {
    id: "seasons",
    title: "Watch a year go by",
    body: "Snow in January, cooling on July afternoons, guests checking in and out: the building and its meter follow every hour of every month.",
    route: "/",
    tab: "Hotel",
    target: () => all(document.getElementById("twin-panel")),
    view: { twinLayer: "zones", timeMode: "seasons", timeMonth: 0, timeHour: 18, playing: true, playbackSpeed: 4 },
    insight: true,
  },
  {
    id: "flow",
    title: "Follow every dollar",
    body: "From the electricity and gas meters to the systems that use them, zone by zone, hour by hour.",
    route: "/",
    tab: "Hotel",
    target: () => all(document.getElementById("twin-panel")),
    view: { twinLayer: "flow" },
    insight: true,
  },
  {
    id: "compare",
    title: "Before and after, on the building",
    body: "Apply any investment package, then switch between Before, After and Split to see the change on the building and in every number.",
    route: "/",
    tab: "Hotel",
    target: () => {
      const t = twin();
      return all(t?.querySelector('[role="group"][aria-label="Compare"]'), t?.querySelector('[data-testid="twin-cost"]')?.parentElement);
    },
  },
  {
    id: "drivers",
    title: "Test a decision before you make it",
    body: "Change occupancy, room temperatures, schedules or energy prices and watch the cost move. Nothing changes in your real hotel.",
    route: "/",
    tab: "Scenario",
    target: () => all(visible('aside[aria-label="Workspace"] [aria-label="Scenario controls"]') ?? workspacePanel()),
    insight: true,
  },
  {
    id: "stress",
    title: "Prepare for the unexpected",
    body: "Heat waves, cold snaps, conference surges, worn equipment, price rises: see what each would add to your bill, and how a plan protects you.",
    route: "/",
    tab: "Hotel",
    target: () => all(visible('section[aria-label="Hotel digital twin"] section[aria-label="Stress tests"]')),
    insight: true,
  },
  {
    id: "optimizer",
    title: "Find the best investments",
    body: "Enter a budget and Energy Twin tests every combination of upgrades, with installed cost, utility incentives and guest comfort counted.",
    route: "/",
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
    id: "plans",
    title: "Build your own plan and compare",
    body: "Pick upgrades yourself, then put your plan next to the recommendation: upfront cost, savings, payback, 10-year value and carbon.",
    route: "/",
    tab: "Invest",
    target: () => all(visible('[role="tablist"][aria-label="Investment mode"]')),
  },
  {
    id: "advisor",
    title: "Ask in plain English",
    body: "Ask why heating costs so much or how to spend your budget. The AI explains the model's results, and every number it quotes is checked against them.",
    route: "/",
    tab: "Ask",
    target: () => all(workspacePanel()),
  },
  {
    id: "portfolio",
    title: "One view for the whole chain",
    body: "Every hotel on the map, colored by cost, efficiency or savings potential. Find the ones to fix first, split one budget across all of them, and stress-test the chain.",
    route: "/portfolio",
    target: () => all(visible('section[aria-label="City map"]')),
    insight: true,
  },
  {
    id: "finish",
    title: "You're ready to explore!",
    body: "See where your hotel spends energy, test what could change, and discover investments that lower your operating costs. Replay this tour any time from the top bar.",
    route: "/",
    hero: true,
  },
];

export const bodyOf = (step: TourStep, s: TwinState) => (typeof step.body === "function" ? step.body(s) : step.body);
