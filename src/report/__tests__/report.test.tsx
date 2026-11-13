import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { useTwin } from "@/store/useTwin";
import { selectCustomPlanEvaluation } from "@/store/hotelDerived";
import { buildHotelReport, interpretFinancials, reportFileName } from "../data";
import { aiReportFromState, customReportFromState, portfolioReportFromState } from "../fromStore";
import { AiPlanResults, ResultsSummary } from "../ResultsSummary";

const t = () => useTwin.getState();
async function optimize() {
  vi.useFakeTimers();
  const run = t().runHotelOptimizer();
  await vi.advanceTimersByTimeAsync(2100);
  await run;
  vi.useRealTimers();
}
const snapshot = () => JSON.stringify({ input: t().hotelInput, scenario: t().scenario, plans: t().customPlans, plan: t().hotelPlan?.packages.map((p) => p.evaluation.id), active: t().activeHotelPackageId });

describe("investment report data", () => {
  it("an AI plan's report equals the optimizer's figures, and building it changes nothing", async () => {
    t().resetDemo();
    t().setHotelBudget(50_000);
    await optimize();
    const before = snapshot();
    const d = aiReportFromState(t())!;
    const w = t().hotelPlan!.objectiveWinner!.evaluation;
    const f = w.financials;
    expect(d.kind).toBe("ai");
    expect(d.planName).toBe(w.name);
    expect(d.investment.grossCost).toBe(f.grossCost.mid);
    expect(d.investment.netInvestment).toBe(f.netInvestment.mid);
    expect(d.investment.incentivesApplied).toBe(f.incentivesTotal);
    expect(d.financial.annualSavings).toBe(f.annualSavings.mid);
    expect(d.financial.paybackYears).toBe(f.simplePaybackYears);
    expect(d.financial.npv5).toBe(f.npv5!.mid);
    expect(d.financial.npv10).toBe(f.npv10!.mid);
    expect(d.environment.carbonKgAvoided).toBe(f.carbonAvoidedKgPerYear.mid);
    expect(d.investment.remainingBudget).toBe(50_000 - f.grossCost.mid);
    // Before/after: the baseline the optimizer measured against and the package outcome; the cost change is the annual saving.
    const cost = d.comparison.find((c) => c.label === "Energy spending")!;
    expect(cost.before).toBeCloseTo(t().baseline.annual.cost, 6);
    expect(cost.before - cost.after).toBeCloseTo(f.annualSavings.mid, 4);
    // Contributions are the engine's sequential attribution: they add up to the package total (no double counting).
    expect(d.contributionsAdd).toBe(true);
    expect(d.upgrades.reduce((s, u) => s + u.annualSavings, 0)).toBeCloseTo(f.annualSavings.mid, 6);
    expect(d.financial.cumulative).toHaveLength(11);
    expect(d.financial.cumulative[10]).toBeCloseTo(f.netBenefit10.mid, 0);
    expect(d.hotel.synthetic).toBe(true);
    expect(snapshot()).toBe(before);
  });

  it("follows the applied package and the hotel", async () => {
    t().resetDemo();
    await optimize();
    const fast = t().hotelPlan!.packages.find((p) => p.role === "fastest_payback")!;
    t().applyHotelPackage(fast.evaluation.id);
    expect(aiReportFromState(t())!.planName).toBe(fast.evaluation.name);
    const small = aiReportFromState(t())!.current.cost;
    t().selectHotelPreset("demo-chicago-300");
    await optimize();
    expect(aiReportFromState(t())!.hotel.rooms).toBe(300);
    expect(aiReportFromState(t())!.current.cost).not.toBeCloseTo(small, 0);
    t().resetDemo();
  });

  it("a custom plan's report equals its evaluation (same engine and assumptions)", () => {
    t().resetDemo();
    const id = t().createCustomPlan("Lights", [{ id: "led_lighting" }, { id: "occupancy_sensors" }]);
    const ev = selectCustomPlanEvaluation(t(), id)!.evaluation!;
    const d = customReportFromState(t(), id)!;
    expect(d.kind).toBe("custom");
    expect(d.planLabel).toBe("Custom plan · Lights");
    expect(d.financial.annualSavings).toBe(ev.financials.annualSavings.mid);
    expect(d.investment.netInvestment).toBe(ev.financials.netInvestment.mid);
    expect(d.financial.npv10).toBe(ev.financials.npv10!.mid);
    expect(d.upgrades.map((u) => u.id)).toEqual(ev.lineItems.map((l) => l.id));
    t().resetDemo();
  });

  it("a portfolio report adds up the optimizer's allocations", async () => {
    t().resetDemo();
    vi.useFakeTimers();
    const run = t().runPortfolioOptimizer();
    await vi.advanceTimersByTimeAsync(3000);
    await run;
    vi.useRealTimers();
    const plan = t().portfolioPlan!;
    const d = portfolioReportFromState(t())!;
    expect(d.totals).toEqual(plan.totals);
    expect(d.allocations.reduce((s, a) => s + a.annualSavings, 0)).toBeCloseTo(plan.totals.annualSavings, 4);
    expect(d.allocations.reduce((s, a) => s + a.netInvestment, 0)).toBeCloseTo(plan.totals.netInvestment, 4);
    expect(d.organization).toBe(t().portfolio.name);
    t().resetDemo();
  });

  it("is honest when a plan does not pay", () => {
    const base = { grossCost: { low: 100_000, mid: 100_000, high: 100_000 }, incentives: [], incentivesTotal: 0, netInvestment: { low: 100_000, mid: 100_000, high: 100_000 }, annualEnergySavings: { elecKWh: 1, gasTherms: 0, siteKBtu: 1 }, annualSavings: { low: 2_000, mid: 4_000, high: 6_000 }, simplePaybackYears: 25, netBenefit5: { low: 0, mid: -80_000, high: 0 }, netBenefit10: { low: 0, mid: -58_000, high: 0 }, carbonAvoidedKgPerYear: { low: 0, mid: 0, high: 0 }, npv10: { low: 0, mid: -70_000, high: 0 }, discountRate: 0.08, solar: null, assumptions: [] };
    const v = interpretFinancials(base, 120_000, 15);
    expect(v.verdict).toBe("unattractive");
    expect(v.headline).toMatch(/Not financially attractive/);
    expect(v.sentences.join(" ")).toMatch(/longer than the equipment is expected to last/);
    expect(v.sentences.join(" ")).toMatch(/do not cover the investment/);
    const none = interpretFinancials({ ...base, simplePaybackYears: null, annualSavings: { low: -1, mid: -1, high: -1 } }, 120_000, 15);
    expect(none.verdict).toBe("unattractive");
  });

  it("shows illustrative incentives separately and never counts them", async () => {
    t().resetDemo();
    await optimize();
    const s = t();
    const w = s.hotelPlan!.objectiveWinner!;
    const f = { ...w.evaluation.financials, illustrativeIncentives: [{ label: "ComEd LED (2025 rate)", amount: 5_000, programYear: 2025, note: "not confirmed for 2026" }] };
    const d = buildHotelReport({ kind: "ai", hotel: s.hotel, baseline: s.baseline, evaluation: { ...w.evaluation, financials: f }, planLabel: "AI", budget: 50_000, discountRate: 0.08, catalog: [], synthetic: true });
    expect(d.investment.illustrative).toEqual([{ label: "ComEd LED (2025 rate)", amount: 5_000, note: "program year 2025; not confirmed for 2026" }]);
    expect(d.investment.netInvestment).toBe(w.evaluation.financials.netInvestment.mid);
    expect(d.investment.netIfIllustrative).toBe(w.evaluation.financials.netInvestment.mid - 5_000);
    expect(d.financial.paybackYears).toBe(w.evaluation.financials.simplePaybackYears);
    expect(d.risks.join(" ")).toMatch(/not in the base case/);
    render(<ResultsSummary d={d} />);
    expect(screen.getByTestId("illustrative-incentives").textContent).toMatch(/Not in the base case/);
    t().resetDemo();
  });

  it("names the file after the hotel and the user's date", () => {
    expect(reportFileName("Lakeshore Inn", new Date(2026, 10, 12))).toBe("EnergyTwin_LakeshoreInn_InvestmentReport_2026-11-12.pdf");
    expect(reportFileName("O'Hare Gateway Hotel", new Date(2026, 0, 3))).toBe("EnergyTwin_OHareGatewayHotel_InvestmentReport_2026-01-03.pdf");
  });
});

describe("investment results view", () => {
  it("shows the executive summary, the reading, before/after and the upgrade breakdown", async () => {
    t().resetDemo();
    await optimize();
    render(<AiPlanResults />);
    const d = aiReportFromState(t())!;
    expect(screen.getByTestId("ai-plan-results").textContent).toContain(`$${Math.round(d.financial.annualSavings).toLocaleString("en-US")}`);
    expect(screen.getByTestId("plan-interpretation").dataset["verdict"]).toBe(d.interpretation.verdict);
    expect(screen.getAllByTestId("before-after-row")).toHaveLength(5);
    fireEvent.click(screen.getByTestId("results-tab-upgrades"));
    expect(screen.getAllByTestId("upgrade-line")).toHaveLength(d.upgrades.length);
    expect(screen.getByTestId("savings-contribution")).toBeTruthy();
    expect(screen.getByTestId("report-download")).toBeTruthy();
    fireEvent.click(screen.getByTestId("report-preview"));
    expect(await screen.findByTestId("report-preview-body")).toBeTruthy();
    expect(screen.getAllByTestId("report-verdict").length).toBeGreaterThan(0);
    t().resetDemo();
  });

  it("renders a plan without a payback as unattractive", () => {
    t().resetDemo();
    const id = t().createCustomPlan("Solar only", [{ id: "rooftop_solar" }]);
    const d = customReportFromState(t(), id)!;
    render(<ResultsSummary d={d} />);
    expect(screen.getByTestId("plan-interpretation").dataset["verdict"]).toBe(d.interpretation.verdict);
    if ((d.financial.npv10 ?? 0) < 0) expect(d.interpretation.verdict).toBe("unattractive");
    t().resetDemo();
  });
});
