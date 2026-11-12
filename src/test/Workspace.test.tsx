import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BudgetOptimizer } from "@/components/BudgetOptimizer";
import { useTwin } from "@/store/useTwin";

vi.mock("@tanstack/react-router", () => ({ Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a> }));

describe("Invest tab", () => {
  beforeEach(() => { useTwin.getState().resetHotel(); vi.useFakeTimers(); });
  afterEach(() => { cleanup(); vi.useRealTimers(); });

  it("budget chip sets the budget to $50,000", () => {
    render(<BudgetOptimizer workspace />);
    fireEvent.click(screen.getByRole("button", { name: "$50,000" }));
    expect(useTwin.getState().hotel.profile.budget).toBe(50000);
  });

  it("Apply applies the package and switches the twin to split compare", async () => {
    const pending = useTwin.getState().runHotelOptimizer();
    await vi.advanceTimersByTimeAsync(2000);
    await pending;
    useTwin.getState().setCompareMode("after");
    render(<BudgetOptimizer workspace />);
    const pkg = useTwin.getState().hotelPlan!.packages[0]!;
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: `Apply ${pkg.roleLabel}` })); });
    expect(useTwin.getState().activeHotelPackageId).toBe(pkg.evaluation.id);
    expect(useTwin.getState().compareMode).toBe("split");
  });
});
