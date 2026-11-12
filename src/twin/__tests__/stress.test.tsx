import { beforeEach, describe, expect, it } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { useTwin } from "@/store/useTwin";
import { StressTests } from "../parts/StressTests";

const get = () => useTwin.getState();

describe("stress test panel", () => {
  beforeEach(() => {
    window.localStorage.clear();
    get().resetHotel();
    useTwin.setState({ customPlans: [], activeCustomPlanId: null });
  });

  it("groups eight tests in three categories and shows assumptions, the comparison and a reset", async () => {
    render(<StressTests />);
    for (const c of ["Weather", "Operations", "Financial"]) expect(screen.getByRole("group", { name: c })).toBeInTheDocument();
    expect(within(screen.getByRole("region", { name: "Stress tests" })).getAllByRole("button")).toHaveLength(8);
    fireEvent.click(screen.getByRole("button", { name: "Natural gas +20%" }));
    expect(screen.getByText("Persistent change")).toBeInTheDocument();
    expect(screen.getByRole("table", { name: "Assumptions changed" })).toHaveTextContent(/Natural gas price.*\+20%.*Every year/);
    expect(screen.getByTestId("stress-compare")).toHaveTextContent(/Energy cost \/ yr/);
    expect(await screen.findByTestId("stress-recommendation", {}, { timeout: 5000 })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Reset to baseline" }));
    expect(get().activeStressTest).toBeNull();
  });

  it("tests a custom plan and labels temporary events", () => {
    get().createCustomPlan("Lights", [{ id: "led_lighting" }]);
    render(<StressTests />);
    fireEvent.click(screen.getByRole("button", { name: "Heat wave" }));
    expect(screen.getByText("Temporary event")).toBeInTheDocument();
    expect(screen.getByTestId("stress-plan")).toHaveTextContent("Lights");
    expect(screen.getByTestId("stress-avoided")).toHaveTextContent(/in the year it happens/);
    expect(screen.queryByTestId("stress-recommendation")).toBeNull();
    expect(screen.getByText(/temporary event: payback, NPV and the recommendation are not changed/i)).toBeInTheDocument();
  });
});
