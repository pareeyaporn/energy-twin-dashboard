import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { BudgetInput } from "@/components/BudgetInput";
import { useTwin } from "@/store/useTwin";

describe("Budget draft commits", () => {
  beforeEach(() => {
    useTwin.getState().resetHotel();
    useTwin.getState().setHotelBudget(50_000);
    render(<BudgetInput id="test-budget" label="Budget" value={50_000} onCommit={useTwin.getState().setHotelBudget} />);
  });
  afterEach(cleanup);
  it("does not commit intermediate typing", () => {
    const input = screen.getByLabelText("Budget");
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "250" } });
    expect(useTwin.getState().hotel.profile.budget).toBe(50_000);
  });
  it("preserves $50,000 when a cleared draft loses focus", () => {
    const input = screen.getByLabelText("Budget");
    fireEvent.change(input, { target: { value: "" } });
    fireEvent.blur(input);
    expect(useTwin.getState().hotel.profile.budget).toBe(50_000);
  });
  it("commits a currency draft on blur", () => {
    const input = screen.getByLabelText("Budget");
    fireEvent.change(input, { target: { value: "$25,000" } });
    fireEvent.blur(input);
    expect(useTwin.getState().hotel.profile.budget).toBe(25_000);
  });
  it("commits $100,000 on Enter", () => {
    const input = screen.getByLabelText("Budget");
    act(() => input.focus());
    fireEvent.change(input, { target: { value: "100000" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(useTwin.getState().hotel.profile.budget).toBe(100_000);
  });
  it("rejects an invalid negative budget", () => {
    const input = screen.getByLabelText("Budget");
    fireEvent.change(input, { target: { value: "-1" } });
    fireEvent.blur(input);
    expect(useTwin.getState().hotel.profile.budget).toBe(50_000);
  });
});