import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { HotelProfileForm } from "@/components/HotelProfileForm";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useTwin } from "@/store/useTwin";

function edit(label: string, value: string) {
  const field = screen.getByLabelText(label, { selector: "input" });
  fireEvent.change(field, { target: { value } });
  fireEvent.blur(field);
}

describe("hotel profile input wiring", () => {
  beforeEach(() => {
    useTwin.getState().resetHotel();
    render(<TooltipProvider><HotelProfileForm /></TooltipProvider>);
  });
  afterEach(cleanup);

  it("writes guest-room inputs without changing legacy inputs", () => {
    const legacy = useTwin.getState().home;
    edit("Guest rooms", "150");
    expect(useTwin.getState().hotelInput.rooms).toBe(150);
    expect(useTwin.getState().home).toBe(legacy);
  });

  it("commits an optional eGRID subregion and resets it to a default", () => {
    fireEvent.click(screen.getByRole("combobox", { name: "Grid region (eGRID)" }));
    fireEvent.click(screen.getByRole("option", { name: "CAMX — WECC California" }));
    expect(useTwin.getState().hotelInput.gridSubregion).toBe("CAMX");
    expect(useTwin.getState().hotel.profile.gridSubregion).toBe("CAMX");
    expect(useTwin.getState().hotel.defaulted).not.toContain("gridSubregion");
    fireEvent.click(screen.getByRole("button", { name: "Reset Grid region (eGRID) to default" }));
    expect(useTwin.getState().hotelInput.gridSubregion).toBeUndefined();
    expect(useTwin.getState().hotel.defaulted).toContain("gridSubregion");
  });

  it("clearing an optional field restores its default", () => {
    edit("Guest rooms", "150");
    edit("Guest rooms", "");
    expect(useTwin.getState().hotelInput.rooms).toBeUndefined();
    expect(useTwin.getState().hotel.defaulted).toContain("rooms");
  });

  it("converts occupancy percentage to the store fraction", () => {
    fireEvent.click(screen.getByRole("button", { name: "Operations" }));
    edit("Occupancy (%)", "85");
    expect(useTwin.getState().hotelInput.occupancy).toBe(0.85);
  });

  it("resets one temperature without clearing another", () => {
    fireEvent.click(screen.getByRole("button", { name: "Operations" }));
    edit("Occupied heating (°F)", "69");
    edit("Occupied cooling (°F)", "76");
    fireEvent.click(screen.getByRole("button", { name: "Reset Occupied heating (°F) to default" }));
    expect(useTwin.getState().hotelInput.setpoints?.occupiedHeatF).toBeUndefined();
    expect(useTwin.getState().hotelInput.setpoints?.occupiedCoolF).toBe(76);
    expect(useTwin.getState().hotel.defaulted).toContain("setpoints.occupiedHeatF");
  });

  it("writes budget and investment horizon to the hotel profile", () => {
    fireEvent.click(screen.getByRole("button", { name: "Financial" }));
    edit("Budget ($)", "50000");
    edit("Investment horizon (years)", "10");
    expect(useTwin.getState().hotelInput.budget).toBe(50000);
    expect(useTwin.getState().hotelInput.horizonYears).toBe(10);
  });
});