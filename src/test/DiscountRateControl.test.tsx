import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DiscountRateControl } from "@/components/DiscountRateControl";
import { UpgradeComparison } from "@/components/FinancialLines";
import { selectUpgradeComparison } from "@/store/hotelDerived";
import { useTwin } from "@/store/useTwin";

describe("detailed comparison discount rate", () => {
  beforeEach(() => useTwin.getState().resetHotel());
  afterEach(cleanup);

  it("uses the 8% default and commits the 3% alternative", () => {
    render(<DiscountRateControl />);
    expect(useTwin.getState().hotelDiscountRate).toBe(0.08);
    fireEvent.click(screen.getByRole("button", { name: "3%" }));
    expect(useTwin.getState().hotelDiscountRate).toBe(0.03);
    expect(selectUpgradeComparison(useTwin.getState())[0]?.financials.discountRate).toBe(0.03);
    fireEvent.click(screen.getByRole("button", { name: "8%" }));
    expect(useTwin.getState().hotelDiscountRate).toBe(0.08);
  });

  it("retains three separate solar sizes and shows their supplied NPV ranges", () => {
    render(<UpgradeComparison />);
    fireEvent.click(screen.getByRole("button", { name: "Compare all upgrades" }));
    const solar = selectUpgradeComparison(useTwin.getState()).filter((r) => r.financials.solar);
    expect(solar).toHaveLength(3);
    expect(new Set(solar.map((r) => r.financials.solar?.sizeKw)).size).toBe(3);
    const table = screen.getByRole("table");
    const money = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
    for (const row of solar) {
      const tr = within(table).getByText(row.label).closest("tr");
      if (!tr || !row.financials.npv5 || !row.financials.npv10) throw new Error("Solar must supply both NPV ranges");
      expect(within(tr).getAllByText(money(row.financials.npv5.mid)).length).toBeGreaterThan(0);
      expect(within(tr).getByText(`${money(row.financials.npv10.low)} to ${money(row.financials.npv10.high)}`)).toBeInTheDocument();
    }
  });
});