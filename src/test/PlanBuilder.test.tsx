import { beforeEach, describe, expect, it } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { useTwin } from "@/store/useTwin";
import { InvestModes } from "@/plans/InvestModes";

const get = () => useTwin.getState();

describe("Invest modes and the plan builder", () => {
  beforeEach(() => {
    window.localStorage.clear();
    get().resetHotel();
    useTwin.setState({ customPlans: [], activeCustomPlanId: null, nextPlanNumber: 1, customPlansHydrated: false });
  });

  it("switches modes, builds a plan from the catalog and shows live totals", () => {
    render(<InvestModes ai={<p>AI view</p>} compact />);
    expect(screen.getByText("AI view")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: /Build your own/ }));
    for (const c of ["HVAC & Controls", "Lighting", "Renewable Energy", "Building & Water"]) expect(screen.getByRole("region", { name: c })).toBeInTheDocument();
    expect(screen.getAllByText("Not modeled yet").length).toBeGreaterThanOrEqual(3);
    expect(screen.getAllByText("Placeholder cost").length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: "Add LED lighting retrofit to plan" }));
    expect(get().customPlans).toHaveLength(1);
    const summary = screen.getByTestId("plan-summary");
    expect(within(summary).getByText(/adds \$[\d,]+ \/ yr/)).toBeInTheDocument();
    expect(within(summary).getByText("Utility incentives")).toBeInTheDocument();

    // Set LEDs to 50%: the plan is recomputed (cost halves)
    const before = get().customPlans[0]!.items[0]!;
    expect(before.quantity).toBe(100);
    const card = screen.getByTestId("catalog-led_lighting");
    fireEvent.change(within(card).getByRole("spinbutton"), { target: { value: "50" } });
    expect(get().customPlans[0]!.items[0]!.quantity).toBe(50);

    fireEvent.click(screen.getByRole("tab", { name: /Compare/ }));
    expect(screen.getByTestId("plan-compare")).toBeInTheDocument();
  });

  it("warns when the plan is over budget", () => {
    get().setHotelBudget(10000);
    render(<InvestModes ai={null} compact />);
    fireEvent.click(screen.getByRole("tab", { name: /Build your own/ }));
    fireEvent.click(screen.getByRole("button", { name: "Add High-efficiency HVAC equipment to plan" }));
    expect(screen.getByText(/over the \$10,000 budget/)).toBeInTheDocument();
  });
});
