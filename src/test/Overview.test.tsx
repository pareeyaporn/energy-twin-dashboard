import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Overview } from "@/components/Overview";
import { selectDisplayed } from "@/store/hotelDerived";
import { useTwin } from "@/store/useTwin";

vi.mock("@/components/ui/chart", () => ({
  ChartContainer: () => null,
  ChartTooltip: () => null,
  ChartTooltipContent: () => null,
}));

const money = (value: number) => value.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const number = (value: number) => value.toLocaleString("en-US", { maximumFractionDigits: 0 });

describe("Overview displayed result wiring", () => {
  beforeEach(() => useTwin.getState().resetHotel());
  afterEach(cleanup);

  it("reads the baseline annual energy, cost and emissions from the displayed selector", () => {
    render(<Overview />);
    const { annual } = selectDisplayed(useTwin.getState()).result;
    expect(screen.getByTestId("annual-energy").textContent).toContain(number(annual.siteKBtu));
    expect(screen.getByTestId("annual-cost").textContent).toContain(money(annual.cost));
    expect(screen.getByTestId("annual-emissions").textContent).toContain(number(annual.carbonKg));
  });

  it("updates annual cost when the hotel electricity rate changes", () => {
    render(<Overview />);
    const previous = screen.getByTestId("annual-cost").textContent;
    act(() => useTwin.getState().setHotelInput({ electricityRate: 0.3 }));
    const current = selectDisplayed(useTwin.getState()).result.annual.cost;
    expect(screen.getByTestId("annual-cost").textContent).toContain(money(current));
    expect(screen.getByTestId("annual-cost").textContent).not.toBe(previous);
  });
});