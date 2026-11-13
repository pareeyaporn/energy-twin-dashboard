import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { advisor, benchmarkComparison } from "@/engine/hotel";
import { useTwin } from "@/store/useTwin";
import { selectEnergyInsights } from "@/store/hotelDerived";
import { HotelTab } from "@/components/HotelTab";
import { HotelHealthCard } from "@/components/BenchmarkCard";
import { EnergyInsights, INSIGHTS_SHOWN, insightLabel } from "@/insights/EnergyInsights";
import { Briefing, briefingConciseTemplate, briefingContext, briefingSummary, briefingTemplate } from "@/advisor/Briefing";
import { useAdvisorUi } from "@/advisor/uiStore";
import { WorkspaceTabs } from "@/app/HotelDashboard";
import { TooltipProvider } from "@/components/ui/tooltip";

// The Hotel Analysis sidebar (docs/10 "Hotel sidebar layout"): compact sections, progressive disclosure, nothing removed.

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
  useNavigate: () => () => Promise.resolve(),
}));

const get = () => useTwin.getState();

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
  useAdvisorUi.setState({ briefingHidden: false });
  get().resetDemo();
});
afterEach(() => cleanup());

describe("top opportunities", () => {
  it("shows the top 2 in the engine's order; View all shows all N, in the same order, and collapses again", () => {
    const insights = selectEnergyInsights(get());
    expect(insights.length).toBeGreaterThan(INSIGHTS_SHOWN);
    render(<EnergyInsights />);
    const ids = () => screen.getAllByTestId("insight-card").map((c) => c.getAttribute("data-insight"));
    expect(ids()).toEqual(insights.slice(0, 2).map((i) => i.id));
    const toggle = screen.getByTestId("insights-toggle");
    expect(toggle.textContent).toContain(`View all ${insights.length} insights`);
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(toggle);
    expect(ids()).toEqual(insights.map((i) => i.id));
    fireEvent.click(screen.getByTestId("insights-toggle"));
    expect(ids()).toHaveLength(2);
  });

  it("labels each card from its own fields; the method and Ask AI stay on every card", () => {
    render(<EnergyInsights />);
    fireEvent.click(screen.getByTestId("insights-toggle"));
    for (const insight of selectEnergyInsights(get())) {
      const card = screen.getAllByTestId("insight-card").find((c) => c.getAttribute("data-insight") === insight.id)!;
      const label = insightLabel(insight);
      expect(within(card).getByTestId("insight-label").textContent).toContain(label.category);
      expect(within(card).getByTestId("insight-label").textContent).toContain(label.impact);
      expect(card.textContent).not.toMatch(/High priority/);
      fireEvent.click(within(card).getByTestId("insight-how"));
      expect(within(card).getByTestId("insight-method").textContent).toContain(insight.method);
      expect(within(card).getByTestId("ask-about")).toHaveAttribute("aria-label", expect.stringContaining(insight.title));
    }
  });
});

describe("briefing", () => {
  it("is concise on load and shows the complete briefing on View full briefing", () => {
    render(<Briefing />);
    const ctx = briefingContext(get(), selectEnergyInsights(get()));
    expect(screen.queryByTestId("briefing-full")).toBeNull();
    expect(screen.getByTestId("briefing-summary").textContent).toBe(briefingConciseTemplate(ctx));
    expect(screen.getByTestId("briefing-toggle")).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(screen.getByTestId("briefing-toggle"));
    expect(screen.getByTestId("briefing-full").textContent).toBe(briefingTemplate(ctx));
  });

  it("the concise texts pass the same number check as the full briefing", () => {
    const ctx = briefingContext(get(), selectEnergyInsights(get()));
    expect(advisor.validateAdvisorText(briefingConciseTemplate(ctx), ctx).ok).toBe(true);
    expect(advisor.validateAdvisorText(briefingSummary(briefingTemplate(ctx)), ctx).ok).toBe(true);
    expect(briefingSummary("One costs $1,200. Two is 4.2 years. Three.")).toBe("One costs $1,200. Two is 4.2 years.");
  });
});

describe("hotel health", () => {
  it("the % equals the benchmark figures and the full comparison opens on demand", () => {
    const s = get();
    const c = benchmarkComparison(s.baseline, s.hotel.profile.floorAreaSqft);
    const star = c.peers.find((p) => p.id === "energy_star_hotel_median")!;
    render(<TooltipProvider><HotelHealthCard /></TooltipProvider>);
    expect(screen.getByTestId("health-eui")).toHaveAttribute("data-value", String(c.siteEuiKBtuPerSqft));
    expect(screen.getByTestId("health-difference")).toHaveAttribute("data-value", String(Math.round(star.difference * 100)));
    expect(screen.getByTestId("health-difference").textContent).toContain(`+${Math.round(star.difference * 100)}%`);
    expect(screen.getByText(/context, not a rating/)).toBeTruthy();
    expect(screen.queryByTestId("hotel-site-eui")).toBeNull();
    fireEvent.click(screen.getByTestId("health-toggle"));
    for (const peer of c.peers) expect(screen.getByTestId(`benchmark-peer-${peer.id}`)).toHaveAttribute("data-difference", String(peer.difference));
    expect(screen.getAllByRole("button", { name: /^Source for/ })).toHaveLength(c.peers.length);
  });
});

describe("hotel step", () => {
  const renderTab = (onSimulate = vi.fn()) => render(<TooltipProvider><HotelTab onSimulate={onSimulate} /></TooltipProvider>);

  it("the overview and the collapsed profile line follow live values", () => {
    renderTab();
    expect(screen.getByTestId("profile-data-line").textContent).toBe("Lakeshore Inn · 100 rooms · Modeled estimate");
    expect(screen.getByTestId("overview-cost")).toHaveAttribute("data-value", String(get().baseline.annual.cost));
    expect(screen.getByTestId("data-status").textContent).toBe("Synthetic estimate");
    act(() => get().setHotelInput({ rooms: 120 }));
    expect(screen.getByTestId("profile-data-line").textContent).toBe("Lakeshore Inn · 120 rooms · Modeled estimate");
    expect(screen.getByTestId("overview-facts").textContent).toContain("120 rooms");
    expect(screen.getByTestId("overview-cost")).toHaveAttribute("data-value", String(get().baseline.annual.cost));
  });

  it("Manage utility data opens the Utility Data Manager from the collapsed header", () => {
    renderTab();
    expect(screen.getByTestId("profile-data-toggle")).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByTestId("utility-section")).toBeNull();
    fireEvent.click(screen.getByTestId("manage-utility-header"));
    expect(within(screen.getByTestId("utility-manager")).getByText(/Utility Data Manager — Lakeshore Inn/)).toBeTruthy();
  });

  it("the expanded profile & data shows the summary rows and the utility data section", () => {
    renderTab();
    fireEvent.click(screen.getByTestId("profile-data-toggle"));
    expect(screen.getByLabelText("Hotel summary").textContent).toContain("Floor area");
    expect(screen.getByTestId("utility-status").textContent).toBe("Modeled estimate");
    fireEvent.click(screen.getByTestId("manage-utility"));
    expect(screen.getByTestId("utility-manager")).toBeTruthy();
  });

  it("the edit expander holds the full profile form", () => {
    renderTab();
    expect(screen.queryByText("Building")).toBeNull();
    fireEvent.click(screen.getByTestId("edit-hotel-details"));
    expect(screen.getByText("Building")).toBeTruthy();
  });

  it("keeps the tour's targets", () => {
    const { container } = renderTab();
    expect(container.querySelector('[data-testid="energy-insights"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="profile-data"]')).not.toBeNull();
  });
});

describe("step navigation", () => {
  function Harness() {
    const [tab, setTab] = useState("hotel");
    return <TooltipProvider><aside aria-label="Workspace"><WorkspaceTabs tab={tab} setTab={setTab} /></aside></TooltipProvider>;
  }

  it("Simulate this hotel switches to the Scenario step", () => {
    render(<Harness />);
    expect(screen.getByRole("tab", { name: /Hotel/ })).toHaveAttribute("aria-selected", "true");
    fireEvent.click(screen.getByTestId("simulate-hotel"));
    expect(screen.getByRole("tab", { name: /Scenario/ })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByLabelText("Scenario controls")).toBeTruthy();
  });

  it("tab names stay readable by the tour (number, then the label)", () => {
    render(<Harness />);
    expect(screen.getAllByRole("tab").map((t) => (t.textContent ?? "").replace(/^\d+/, "").trim())).toEqual(["Hotel", "Scenario", "Invest", "Ask"]);
  });
});
