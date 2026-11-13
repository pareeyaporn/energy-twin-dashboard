import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { renderToBuffer } from "@react-pdf/renderer";
import { advisor, optimizeInvestmentPortfolio, prepareUpgradeContext, presetProfile, upgradeCatalog } from "@/engine/hotel";
import { useTwin } from "@/store/useTwin";
import type { AdvisorMessage } from "@/store/useTwin";
import { clearSavedAdvisorAnswers } from "@/store/advisorAnswers";
import { AdvisorMessageExtras } from "@/advisor/AdvisorMessageExtras";
import { AskAbout } from "@/advisor/AskAbout";
import { Briefing, briefingContext, briefingTemplate } from "@/advisor/Briefing";
import { PortfolioChat } from "@/advisor/PortfolioChat";
import { useAdvisorUi } from "@/advisor/uiStore";
import { selectEnergyInsights } from "@/store/hotelDerived";
import { withAiSummary, reportSummaryContext } from "@/report/aiSummary";
import { buildHotelReport } from "@/report/data";
import { ReportPreview, AI_SUMMARY_LABEL } from "@/report/ReportPreview";
import { UtilityDataSection } from "@/utility/UtilityDataSection";

const openTab = vi.fn((_tab: string) => true);
vi.mock("@/tour/dom", async (orig) => ({ ...(await orig<typeof import("@/tour/dom")>()), openWorkspaceTab: (t: string) => openTab(t) }));

const get = () => useTwin.getState();
const ENDPOINT = "https://example.test/functions/v1/advisor";
function useFetch(reply: (body: Record<string, unknown>) => unknown) {
  const bodies: string[] = [];
  const fetchFn = vi.fn(async (_u: string, init: RequestInit) => {
    bodies.push(init.body as string);
    return new Response(JSON.stringify(reply(JSON.parse(init.body as string) as Record<string, unknown>)), { status: 200 });
  });
  advisor.setAdvisorConfig({ endpoint: ENDPOINT, headers: {}, fetchFn: fetchFn as unknown as typeof fetch });
  return { fetchFn, bodies };
}
const envOf = (): advisor.ToolEnv => ({ hotel: get().hotel, baseline: get().baseline, discountRate: get().hotelDiscountRate });
const messageWith = (...calls: [advisor.ToolName, Record<string, unknown>][]): AdvisorMessage => ({
  id: "m-x",
  role: "advisor",
  text: "Answer.",
  source: "fallback",
  runs: calls.map(([name, input], i) => advisor.runTool(envOf(), { id: `c${i}`, name, input })),
  followUps: ["What are the risks?"],
  scope: "hotel",
  hotelRef: get().hotel,
});

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
  get().resetDemo();
  get().clearAdvisor();
  advisor.clearAdvisorCache();
  advisor.clearAgentCache();
  clearSavedAdvisorAnswers();
  advisor.setAdvisorConfig({ endpoint: null, headers: {} });
  openTab.mockClear();
  useAdvisorUi.setState({ portfolioChatOpen: false, briefingHidden: false });
});
afterEach(() => advisor.setAdvisorConfig(null));

describe("advisor result cards and actions", () => {
  it("shows the engine's results and changes the twin only when an action is clicked", () => {
    const msg = messageWith(["find_best_plan", { budget: 50_000 }], ["run_scenario", { occupancyPct: 85 }]);
    const before = { plan: get().hotelPlan, scenario: get().scenario };
    render(<AdvisorMessageExtras message={msg} />);
    expect(screen.getAllByTestId("advisor-tool-card")).toHaveLength(2);
    expect(screen.getAllByText(/Computed by the Energy Twin engine/)).toHaveLength(2);
    // Rendering changes nothing.
    expect(get().hotelPlan).toBe(before.plan);
    expect(get().scenario).toEqual(before.scenario);
    const plan = msg.runs![0]!.detail!.plan!;
    fireEvent.click(screen.getByRole("button", { name: "Apply this package to the twin" }));
    expect(get().hotelPlan).toBe(plan);
    expect(get().activeHotelPackageId).toBe(plan.objectiveWinner!.evaluation.id);
    fireEvent.click(screen.getByRole("button", { name: "Apply this what-if" }));
    expect(get().scenario.occupancy).toBe(0.85);
    expect(openTab).toHaveBeenCalledWith("Scenario");
  });

  it("refuses a plan computed for another hotel", () => {
    const msg = messageWith(["find_best_plan", { budget: 50_000 }]);
    get().setHotelInput({ ...get().hotelInput, rooms: 120 });
    render(<AdvisorMessageExtras message={msg} />);
    fireEvent.click(screen.getByRole("button", { name: "Apply this package to the twin" }));
    expect(get().hotelPlan).toBeNull();
    expect(screen.getByTestId("advisor-action-status").textContent).toMatch(/another hotel/);
  });

  it("a follow-up chip asks the advisor", async () => {
    render(<AdvisorMessageExtras message={messageWith(["run_stress_test", { id: "heat_wave" }])} />);
    fireEvent.click(screen.getByTestId("advisor-followup"));
    await waitFor(() => expect(get().advisorMessages.some((m) => m.role === "user" && m.text === "What are the risks?")).toBe(true));
  });
});

describe("AskAbout", () => {
  it("opens the Ask tab and asks the question", async () => {
    render(<AskAbout question="What if occupancy rises to 85%?" />);
    fireEvent.click(screen.getByTestId("ask-about"));
    expect(openTab).toHaveBeenCalledWith("Ask");
    await waitFor(() => expect(get().advisorMessages).toHaveLength(2));
    const a = get().advisorMessages[1]!;
    expect(a.runs?.[0]?.name).toBe("run_scenario");
  });

  it("on the portfolio page it opens the portfolio chat, where answers use the portfolio tools", async () => {
    render(<><AskAbout scope="portfolio" question="Which hotel should we invest in first, and why?" /><PortfolioChat /></>);
    fireEvent.click(screen.getByTestId("ask-about"));
    expect(useAdvisorUi.getState().portfolioChatOpen).toBe(true);
    const chat = await screen.findByTestId("portfolio-chat");
    await waitFor(() => expect(within(chat).getAllByTestId("portfolio-chat-answer")).toHaveLength(1));
    expect(get().advisorMessages[1]!.runs?.[0]?.name).toBe("portfolio_overview");
    fireEvent.click(within(chat).getByText("How would you split $250,000 across the chain?"));
    await waitFor(() => expect(within(chat).getAllByTestId("portfolio-chat-answer")).toHaveLength(2));
    expect(get().advisorMessages[3]!.runs?.[0]?.name).toBe("portfolio_optimize");
    expect(within(chat).getByRole("button", { name: "Open the portfolio plan" })).toBeTruthy();
  });
});

describe("briefing", () => {
  it("shows the template without the AI, and can be hidden for the session", () => {
    render(<Briefing />);
    const b = screen.getByTestId("briefing");
    expect(b.dataset["source"]).toBe("fallback");
    expect(b.textContent).toContain(get().hotel.profile.name);
    expect(b.textContent).not.toMatch(/AI summary/);
    fireEvent.click(screen.getByTestId("briefing-hide"));
    expect(screen.queryByTestId("briefing")).toBeNull();
    expect(window.sessionStorage.getItem("energy-twin:briefing-hidden")).toBe("1");
  });

  it("the template passes the number check; an AI briefing replaces it only if it passes too", async () => {
    const ctx = briefingContext(get(), selectEnergyInsights(get()));
    expect(advisor.validateAdvisorText(briefingTemplate(ctx), ctx).ok).toBe(true);
    const cost = ctx.annual.energyCost.toLocaleString("en-US");
    useFetch(() => ({ text: `The hotel spends an estimated $${cost} a year on energy. HVAC is the biggest issue. Next, test smart room controls.` }));
    render(<Briefing />);
    await waitFor(() => expect(screen.getByTestId("briefing").dataset["source"]).toBe("ai"), { timeout: 4000 });
    fireEvent.click(screen.getByTestId("briefing-toggle"));
    expect(screen.getByText(/AI summary of the model's results/)).toBeTruthy();
  });
});

describe("report executive summary", () => {
  const hotel = presetProfile("demo-chicago-100");
  const ctx = prepareUpgradeContext(hotel);
  const pkg = optimizeInvestmentPortfolio(ctx, {}).objectiveWinner!;
  const data = buildHotelReport({ kind: "ai", hotel, baseline: ctx.baseline, evaluation: pkg.evaluation, planLabel: "AI", budget: 50_000, discountRate: 0.08, catalog: upgradeCatalog(ctx).items, synthetic: true });

  it("adds nothing without the AI or when the AI invents a number", async () => {
    expect(await withAiSummary(data)).toBe(data);
    useFetch(() => ({ text: "This plan returns $9,999,999." }));
    expect((await withAiSummary(data)).aiSummary).toBeUndefined();
  });

  it("adds a validated summary, labeled in the preview, and the PDF still renders", async () => {
    const savings = Math.round(data.financial.annualSavings).toLocaleString("en-US");
    const { bodies } = useFetch(() => ({ text: `We recommend this package: it saves an estimated $${savings} a year.` }));
    const out = await withAiSummary(data);
    expect(out.aiSummary).toContain(savings);
    expect(JSON.parse(bodies[0]!)).toMatchObject({ mode: "report_summary" });
    expect(reportSummaryContext(data)).not.toHaveProperty("report.utility");
    render(<ReportPreview data={out} />);
    expect(screen.getByTestId("report-ai-summary").textContent).toContain(AI_SUMMARY_LABEL);
    const { ReportDocument } = await import("@/report/pdf/ReportDocument");
    const buf = await renderToBuffer(<ReportDocument data={out} generated="November 13, 2026" />);
    expect(buf.subarray(0, 5).toString()).toBe("%PDF-");
  }, 60_000);
});

describe("Suggest with AI (column mapping)", () => {
  it("sends only the headers, never bill values, and applies only after confirmation", async () => {
    const { bodies } = useFetch(() => ({ text: '{"mapping": {"Period": "month", "Power (kWh)": "elecUse", "Fuel": "gasUse"}}' }));
    render(<UtilityDataSection />);
    fireEvent.click(screen.getByTestId("manage-utility"));
    const csv = "Period,Power (kWh),Fuel\nJan 2025,48213,3127\nFeb 2025,45120,2988\n";
    const file = new File([csv], "bills.csv", { type: "text/csv" });
    Object.defineProperty(file, "text", { value: async () => csv });
    fireEvent.change(screen.getByTestId("utility-file"), { target: { files: [file] } });
    await screen.findByTestId("column-mapping");
    const before = (screen.getByTestId("map-2") as HTMLSelectElement).value;
    fireEvent.click(screen.getByTestId("ai-mapping-suggest"));
    expect(screen.getByTestId("ai-mapping-privacy").textContent).toMatch(/only the column headers/);
    await screen.findByTestId("ai-mapping-ready");
    expect(bodies).toHaveLength(1);
    const sent = bodies[0]!;
    expect(JSON.parse(sent)).toMatchObject({ mode: "map_columns", context: { headers: ["Period", "Power (kWh)", "Fuel"] } });
    for (const v of ["48213", "3127", "45120", "2988", "Jan 2025"]) expect(sent).not.toContain(v);
    // Nothing changes until the user applies it.
    expect((screen.getByTestId("map-2") as HTMLSelectElement).value).toBe(before);
    fireEvent.click(screen.getByTestId("ai-mapping-apply"));
    expect((screen.getByTestId("map-2") as HTMLSelectElement).value).toBe("gasUse");
  });
});
