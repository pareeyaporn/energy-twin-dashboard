// The onboarding tour's steps, written for hotel operators. Each step names the page and workspace tab it needs and how to find the part of
// the screen it explains. The tour only points at the interface: it never changes the hotel, the scenario or any plan.

export type WorkspaceTab = "Hotel" | "Scenario" | "Invest" | "Ask";

export interface TourStep {
  id: string;
  title: string;
  body: string;
  /** Page the step lives on. */
  route: "/" | "/portfolio";
  /** Workspace tab to show first (main page only). */
  tab?: WorkspaceTab;
  /** The elements to highlight (their combined area); none = a centered card. */
  target?: () => Element[];
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

export const TOUR_STEPS: TourStep[] = [
  {
    id: "welcome",
    title: "Welcome to Energy Twin",
    body: "A digital twin of your hotel: see where your energy money goes, test changes before you make them, and find the upgrades that pay back. You are looking at Lakeshore Inn, a 100-room sample hotel with synthetic data.",
    route: "/",
    tab: "Hotel",
  },
  {
    id: "costs",
    title: "What you spend on energy",
    body: "Your yearly energy cost, energy use and carbon at a glance. Every figure is an estimate built from the hotel's size, systems, occupancy, Chicago weather and local prices.",
    route: "/",
    tab: "Hotel",
    target: () => all(visible('[data-testid="kpi-cost"]')?.parentElement),
  },
  {
    id: "twin",
    title: "See where the energy goes",
    body: "Explore the hotel by zone, room, equipment or energy flow; colors show which areas cost the most. Press play below the building to watch a day or the seasons go by.",
    route: "/",
    tab: "Hotel",
    target: () => {
      const twin = visible('section[aria-label="Hotel digital twin"]');
      return all(twin?.querySelector("header"), twin?.querySelector('[aria-label="Twin layer"]')?.parentElement);
    },
  },
  {
    id: "drivers",
    title: "Test what drives your costs",
    body: "Change occupancy, room temperatures, schedules or energy prices and see the cost move, before you touch a single thermostat. Nothing changes in your real hotel.",
    route: "/",
    tab: "Scenario",
    target: () => all(visible('aside[aria-label="Workspace"] [aria-label="Scenario controls"]') ?? visible('aside[aria-label="Workspace"]')),
  },
  {
    id: "stress",
    title: "Prepare for the unexpected",
    body: "Try a heat wave, a cold snap, a conference surge, worn equipment or a 20% price rise, and see what it would add to your bill.",
    route: "/",
    tab: "Hotel",
    target: () => all(visible('section[aria-label="Hotel digital twin"] section[aria-label="Stress tests"]')),
  },
  {
    id: "optimizer",
    title: "Find the best investments",
    body: "Enter a budget and Energy Twin tests every combination of upgrades to find the best packages, with installed cost, utility incentives and guest comfort taken into account.",
    route: "/",
    tab: "Invest",
    target: () => {
      const panel = visible('aside[aria-label="Workspace"]');
      const budget = panel?.querySelector("#panel-hotel-budget")?.closest(".space-y-2");
      const run = Array.from(panel?.querySelectorAll("button") ?? []).find((b) => /Find the best investments|Testing combinations/.test(b.textContent ?? ""));
      return all(budget, run);
    },
  },
  {
    id: "plans",
    title: "Build your own plan and compare",
    body: "Pick upgrades yourself, then put your plan next to the recommendation: upfront cost, yearly savings, payback, 10-year value and carbon, side by side.",
    route: "/",
    tab: "Invest",
    target: () => all(visible('[role="tablist"][aria-label="Investment mode"]')),
  },
  {
    id: "portfolio",
    title: "Run several hotels? Start here",
    body: "See every hotel in the chain on a map, colored by cost, efficiency or savings potential. Find the ones to fix first, open any of them in its own twin, and split one budget across all of them.",
    route: "/portfolio",
    target: () => all(visible('section[aria-label="City map"]')),
  },
  {
    id: "portfolio-invest",
    title: "Invest where it counts most",
    body: "Energy Twin picks the package for each hotel that does the most good within one budget, and you can compare it with a plan of your own or stress-test the whole chain.",
    route: "/portfolio",
    target: () => all(visible('section[aria-label="Portfolio investments"]')),
  },
  {
    id: "finish",
    title: "You're ready to explore!",
    body: "See where your hotel spends energy, test what could change, and discover investments that can lower your operating costs. Questions? Ask the advisor in the Ask tab. You can replay this tour from the top bar.",
    route: "/",
  },
];
