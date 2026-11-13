import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { useTwin } from "@/store/useTwin";
import { DATA_CLASS, explain, financialAssumptions } from "@/explain/explanations";
import type { MetricId } from "@/explain/explanations";
import { KpiStrip } from "@/components/KpiStrip";
import { SourcesSheet } from "@/components/SourcesSheet";

const t = () => useTwin.getState();
const ALL: MetricId[] = ["annualCost", "siteEnergy", "carbon", "intensity", "annualSavings", "upgradeCost", "incentives", "payback", "npv", "netBenefit", "savingsPotential", "investmentPriority"];

describe("calculation explanations (Improvement 6)", () => {
  it("every major figure has a meaning, a method and limits", () => {
    t().resetDemo();
    for (const id of ALL) {
      const e = explain(id, t());
      expect(e.title.length, id).toBeGreaterThan(3);
      expect(e.means.length, id).toBeGreaterThan(20);
      expect(e.how.length, id).toBeGreaterThan(20);
      for (const i of e.inputs) expect(Object.keys(DATA_CLASS)).toContain(i.cls);
    }
  });

  it("quote the engine's real inputs for the open hotel and follow it", () => {
    t().resetDemo();
    const s = t();
    const cost = explain("annualCost", s);
    expect(cost.inputs.find((i) => i.label === "Electricity price")!.value).toContain(s.hotel.profile.electricityRate.toFixed(4));
    expect(cost.inputs.find((i) => i.label === "Occupancy")!.cls).toBe("synthetic");
    const carbon = explain("carbon", s);
    expect(carbon.inputs[0]!.value).toContain(s.baseline.emissionFactors.elecKgPerKWh.toFixed(3));
    expect(explain("npv", s).how).toContain("8%");
    t().setHotelDiscountRate(0.03);
    expect(explain("npv", t()).how).toContain("3%");
    t().resetDemo();
  });

  it("explain incentives with the program-year rule: 2025 lighting rates shown separately, 2026 rates counted", () => {
    t().resetDemo();
    const e = explain("incentives", t());
    expect(e.how).toMatch(/program year is 2026/);
    expect(e.inputs.find((i) => /LED/.test(i.label))!.value).toMatch(/Shown separately \(2025 rate\)/);
    expect(e.inputs.find((i) => /guest room/.test(i.label))!.value).toMatch(/Counted \(2026\)/);
  });

  it("describe the implemented priority score, not spending", () => {
    const e = explain("investmentPriority", t());
    expect(e.how).toMatch(/10-year NPV divided by its net investment/);
    expect(e.how).toMatch(/spending alone does not raise it/);
  });

  it("list the financial assumptions with their data class and no invented confidence score", () => {
    const rows = financialAssumptions(t());
    expect(rows.map((r) => r.label)).toEqual(expect.arrayContaining(["Discount rate (NPV)", "Electricity price growth", "Gas price growth", "Equipment life", "Maintenance", "Incentives"]));
    expect(JSON.stringify(rows)).not.toMatch(/confidence|accuracy/i);
  });

  it("KPI tiles open their explanation", async () => {
    t().resetDemo();
    render(<KpiStrip />);
    fireEvent.click(screen.getByTestId("how-annualCost"));
    expect((await screen.findByTestId("how-panel-annualCost")).textContent).toMatch(/Annual energy cost.*How:/s);
    fireEvent.click(screen.getByText("More detail"));
    expect(screen.getByTestId("how-panel-annualCost").textContent).toMatch(/Sources.*NOAA/s);
  });

  it("the Sources panel lists the hotel model's sources and assumptions, not the old home-product ones", () => {
    t().setSourcesOpen(true);
    render(<SourcesSheet />);
    expect(screen.getByTestId("financial-assumptions")).toBeTruthy();
    expect(screen.getByTestId("data-class-legend")).toBeTruthy();
    expect(document.body.textContent).toMatch(/NOAA Climate Normals/);
    expect(document.body.textContent).not.toMatch(/ResStock|RECS|Rewiring America/);
    t().setSourcesOpen(false);
  });
});
