import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { calculateBaselineEnergy, presetProfile } from "@/engine/hotel";
import { useTwin } from "@/store/useTwin";
import { EQUIPMENT_STORAGE_KEY, readEquipment } from "@/store/equipmentStorage";
import { selectEquipment, selectPortfolioItems, selectPortfolioSummary } from "@/store/hotelDerived";
import { aiReportFromState } from "@/report/fromStore";
import { EquipmentLayer } from "@/twin/parts/EquipmentLayer";

beforeAll(() => {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});

const get = () => useTwin.getState();
const heatingGas = () => get().baseline.cells.filter((c) => c.endUse === "heating").reduce((s, c) => s + c.gasTherms, 0);

beforeEach(() => {
  get().resetDemo();
  window.localStorage.removeItem(EQUIPMENT_STORAGE_KEY);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("current equipment in the store", () => {
  it("a correction recalculates the baseline, is saved for that hotel only, and can be undone or reset", () => {
    const before = get().baseline.annual.cost;
    const gas = heatingGas();
    act(() => get().setEquipment([{ id: "boilers", efficiency: 0.95 }]));
    expect(heatingGas() / gas).toBeCloseTo(0.8 / 0.95, 9);
    expect(get().baseline.annual.cost).toBeLessThan(before);
    expect(get().hotelPresetId).toBe("demo-chicago-100"); // still the synthetic sample, with the operator's correction
    expect(readEquipment()["lakeshore-inn"]).toEqual([{ id: "boilers", efficiency: 0.95 }]);
    act(() => get().undoEquipment());
    expect(get().baseline.annual.cost).toBeCloseTo(before, 6);
    act(() => get().setEquipment([{ id: "chiller", efficiency: 6 }]));
    act(() => get().resetEquipment());
    expect(get().baseline.annual.cost).toBeCloseTo(before, 6);
    expect(readEquipment()["lakeshore-inn"]).toBeUndefined();
  });

  it("keeps hotels independent and reconciles the portfolio with the open hotel", () => {
    act(() => get().openProperty("riverwalk-grand"));
    const riverBefore = get().baseline.annual.cost;
    act(() => get().setEquipment([{ id: "dhw-heater", efficiency: 0.95 }]));
    const riverAfter = get().baseline.annual.cost;
    expect(riverAfter).toBeLessThan(riverBefore);
    act(() => get().openProperty("lakeshore-inn"));
    expect(get().hotelInput.equipment).toBeUndefined();
    const sum = selectPortfolioSummary(get());
    const river = sum.properties.find((p) => p.id === "riverwalk-grand")!;
    expect(river.annual.cost).toBeCloseTo(riverAfter, 6);
    // After a reload (state rebuilt from storage), the saved correction comes back with the hotel.
    act(() => get().resetHotel());
    useTwin.setState({ equipmentHydrated: false, equipmentByProperty: {} });
    act(() => get().hydrateEquipment());
    const items = selectPortfolioItems(get());
    expect(items.find((x) => x.property.id === "riverwalk-grand")!.input.equipment).toEqual([{ id: "dhw-heater", efficiency: 0.95 }]);
  });

  it("an existing plan is cleared when the baseline changes, and the optimizer then measures the corrected hotel", async () => {
    vi.useFakeTimers();
    const run = get().runHotelOptimizer();
    await vi.advanceTimersByTimeAsync(2100);
    await run;
    expect(get().hotelPlan).not.toBeNull();
    act(() => get().setEquipment([{ id: "boilers", efficiency: 0.95 }]));
    expect(get().hotelPlan).toBeNull();
    expect(get().equipmentClearedPlan).toBe(true);
    const again = get().runHotelOptimizer();
    await vi.advanceTimersByTimeAsync(2100);
    await again;
    expect(get().hotelPlan!.baselineAnnualCost).toBeCloseTo(get().baseline.annual.cost, 6);
    const plain = calculateBaselineEnergy(presetProfile("demo-chicago-100")).annual.cost;
    expect(get().hotelPlan!.baselineAnnualCost).toBeLessThan(plain);
  });

  it("smart room controls marked installed come from the hotel's own setting and remove the upgrade", () => {
    act(() => get().setEquipment([], { smartRoomControls: true }));
    expect(get().hotel.profile.smartRoomControls).toBe(true);
    act(() => get().undoEquipment());
    expect(get().hotel.profile.smartRoomControls).toBe(false);
  });

  it("the report lists the current equipment with its provenance", async () => {
    act(() => get().setEquipment([{ id: "boilers", efficiency: 0.95 }]));
    vi.useFakeTimers();
    const run = get().runHotelOptimizer();
    await vi.advanceTimersByTimeAsync(2100);
    await run;
    const d = aiReportFromState(get())!;
    expect(d.equipment!.corrected).toBe(1);
    expect(d.equipment!.lines.find((l) => l.startsWith("Gas boilers"))).toMatch(/0\.95.*operator data \(efficiency\)/);
    expect(d.equipment!.lines.find((l) => l.startsWith("Chiller"))).toMatch(/estimated/);
  });

  it("Reset demo restores the sample equipment everywhere", () => {
    act(() => get().setEquipment([{ id: "boilers", efficiency: 0.95 }]));
    act(() => get().resetDemo());
    expect(get().hotelInput.equipment).toBeUndefined();
    expect(window.localStorage.getItem(EQUIPMENT_STORAGE_KEY)).toBeNull();
  });
});

describe("Equipment tab", () => {
  it("shows quantity apart from capacity, system-level demand once per system, and the scope of upgrade savings", () => {
    render(<EquipmentLayer />);
    const tank = screen.getAllByTestId("equipment-card").find((c) => within(c).queryByText("Hot-water storage"))!;
    expect(within(tank).getByTestId("equipment-quantity")).toHaveTextContent("1 × 600 gal");
    expect(within(tank).getByTestId("equipment-shared")).toHaveTextContent(/shown on Water heaters/);
    const heaters = screen.getAllByTestId("equipment-card").find((c) => within(c).queryByText("Water heaters"))!;
    expect(within(heaters).getByTestId("equipment-reading")).toHaveTextContent(/System-level/);
    expect(within(heaters).getByTestId("equipment-reading")).toHaveTextContent(/therms\/h gas/);
    expect(within(heaters).getByTestId("equipment-reading")).not.toHaveTextContent(/kW electric.*kW electric/);
    expect(screen.getAllByText(/Whole-hotel upgrade:/).length).toBeGreaterThan(0);
  });

  it("edits a boiler's efficiency through the form (validated), and blocks an invalid value", () => {
    render(<EquipmentLayer />);
    const gas = heatingGas();
    fireEvent.click(screen.getByRole("button", { name: "Edit Gas boilers" }));
    const form = screen.getByTestId("equipment-form");
    fireEvent.change(within(form).getByTestId("eq-lever-heatingEfficiency"), { target: { value: "120" } });
    expect(within(form).getByTestId("eq-save")).toBeDisabled();
    expect(within(form).getByRole("alert")).toHaveTextContent(/between 0.5 and 0.99/);
    fireEvent.change(within(form).getByTestId("eq-lever-heatingEfficiency"), { target: { value: "95" } });
    fireEvent.click(within(form).getByTestId("eq-save"));
    expect(heatingGas() / gas).toBeCloseTo(0.8 / 0.95, 6);
    expect(get().hotelInput.equipment).toEqual([{ id: "boilers", efficiency: 0.95 }]);
    const card = screen.getAllByTestId("equipment-card").find((c) => within(c).queryByText("Gas boilers"))!;
    expect(within(card).getByTestId("equipment-provenance")).toHaveTextContent("your data");
  });

  it("will not remove the only heating system, and removes informational equipment without changing energy", () => {
    render(<EquipmentLayer />);
    fireEvent.click(screen.getByRole("button", { name: "Remove Gas boilers" }));
    expect(screen.getByTestId("equipment-remove")).toHaveTextContent(/only heating equipment/);
    expect(screen.getByTestId("eq-remove-confirm")).toBeDisabled();
    fireEvent.keyDown(screen.getByTestId("equipment-remove"), { key: "Escape" });
    const cost = get().baseline.annual.cost;
    fireEvent.click(screen.getByRole("button", { name: "Remove Elevators" }));
    fireEvent.click(screen.getByTestId("eq-remove-confirm"));
    expect(get().baseline.annual.cost).toBeCloseTo(cost, 6);
    expect(selectEquipment(get()).some((i) => i.id === "elevators")).toBe(false);
    fireEvent.click(screen.getByTestId("eq-undo"));
    expect(selectEquipment(get()).some((i) => i.id === "elevators")).toBe(true);
  });

  it("adds equipment from a template; informational additions do not add consumption", () => {
    render(<EquipmentLayer />);
    const cost = get().baseline.annual.cost;
    fireEvent.click(screen.getByTestId("eq-add"));
    const form = screen.getByTestId("equipment-form");
    fireEvent.change(within(form).getByLabelText("Category"), { target: { value: "kitchen" } });
    fireEvent.change(within(form).getByTestId("eq-template"), { target: { value: "dishwasher" } });
    fireEvent.click(within(form).getByTestId("eq-save"));
    expect(selectEquipment(get()).some((i) => i.template === "dishwasher" && i.added)).toBe(true);
    expect(get().baseline.annual.cost).toBeCloseTo(cost, 6);
  });

  it("replace shows the engine's evaluation side by side, or says it needs more information", () => {
    render(<EquipmentLayer />);
    fireEvent.click(screen.getByRole("button", { name: "Replace Water heaters" }));
    expect(screen.getByTestId("equipment-comparison")).toHaveTextContent(/Installed cost/);
    expect(screen.getByTestId("equipment-comparison")).toHaveTextContent(/Payback/);
    fireEvent.keyDown(screen.getByTestId("equipment-replace"), { key: "Escape" });
    fireEvent.click(screen.getByRole("button", { name: "Replace Elevators" }));
    expect(screen.getByTestId("equipment-needs-info")).toHaveTextContent(/Needs more information/);
  });

  it("separates current equipment from proposed upgrades", () => {
    render(<EquipmentLayer />);
    fireEvent.click(screen.getByTestId("eq-view-proposed"));
    expect(screen.getByTestId("proposed-upgrades")).toHaveTextContent(/measured against the hotel as it is today/);
    expect(screen.getAllByTestId("equipment-comparison").length).toBeGreaterThanOrEqual(3);
    expect(screen.queryByTestId("eq-add")).toBeNull();
  });
});
