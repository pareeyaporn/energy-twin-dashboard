import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { FinancialLines } from "@/components/FinancialLines";
import type { FinancialBreakdown } from "@/engine/hotel/types";

const r = (low: number, mid: number, high: number) => ({ low, mid, high });
const f: FinancialBreakdown = {
  grossCost: r(9000, 10000, 12000), incentives: [{ id: "x", label: "State rebate", amount: 500, applied: false, origin: "program", note: "Not confirmed", source: "s" } as never],
  incentivesTotal: 0, netInvestment: r(9000, 10000, 12000), annualEnergySavings: { elecKWh: 5000, gasTherms: -20, siteKBtu: 0 },
  annualSavings: r(100, 200, 300), simplePaybackYears: null, netBenefit5: r(-9500, -9000, -8000), netBenefit10: r(-9000, -8000, -7000),
  carbonAvoidedKgPerYear: r(1000, 2500, 3000), solar: null, assumptions: [],
};

describe("FinancialLines", () => {
  it("shows the eight lines with engine values", () => {
    render(<FinancialLines f={f} />);
    expect(screen.getAllByText("$10,000", { selector: "dd" })).toHaveLength(2);
    expect(screen.getByText("None applied")).toBeTruthy();
    expect(screen.getByText("State rebate")).toBeTruthy();
    expect(screen.getByText("5,000 kWh · adds 20 therms")).toBeTruthy();
    expect(screen.getByText("No payback")).toBeTruthy();
    expect(screen.getByText("-$9,000").className).toContain("text-heat");
    expect(screen.getByText("2.5 t")).toBeTruthy();
  });
});
