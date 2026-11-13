import { beforeEach, describe, expect, it } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { useTwin } from "@/store/useTwin";
import { UtilityDataSection } from "@/utility/UtilityDataSection";
import { UTILITY_STORAGE_KEY } from "@/store/utilityData";

const get = () => useTwin.getState();
const sumText = (k: string) => screen.getByTestId(`sum-${k}`).textContent;

beforeEach(() => {
  window.localStorage.clear();
  get().resetDemo();
});

describe("Utility Data Manager", () => {
  it("shows the modeled-estimate status and opens on the editable sample", () => {
    render(<UtilityDataSection />);
    expect(screen.getByTestId("utility-status").textContent).toBe("Modeled estimate");
    fireEvent.click(screen.getByTestId("manage-utility"));
    const dlg = screen.getByTestId("utility-manager");
    expect(within(dlg).getByText(/Utility Data Manager — Lakeshore Inn/)).toBeTruthy();
    expect(screen.getByTestId("draft-provenance").textContent).toMatch(/Sample data \(synthetic\)/);
    expect(screen.getAllByTestId("utility-row")).toHaveLength(12);
    expect(screen.getByTestId("coverage-note").textContent).toMatch(/Complete/);
  });

  it("edits update the totals at once; Cancel discards (after confirming); nothing is saved", () => {
    render(<UtilityDataSection />);
    fireEvent.click(screen.getByTestId("manage-utility"));
    const before = sumText("Electricity");
    const cell = screen.getByTestId("cell-0-elecKWh") as HTMLInputElement;
    fireEvent.change(cell, { target: { value: String(Number(cell.value) + 10000) } });
    expect(sumText("Electricity")).not.toBe(before);
    expect(screen.getByTestId("draft-provenance").textContent).toMatch(/Edited sample data \(synthetic\)/);
    fireEvent.click(screen.getByTestId("utility-cancel"));
    expect(screen.getByRole("alertdialog")).toBeTruthy();
    fireEvent.click(screen.getByTestId("confirm-discard"));
    expect(window.localStorage.getItem(UTILITY_STORAGE_KEY) ?? "").not.toContain("lakeshore-inn");
    expect(get().utilityData).toEqual({});
  });

  it("blocks Apply on an error and highlights the cell; undo restores it", () => {
    render(<UtilityDataSection />);
    fireEvent.click(screen.getByTestId("manage-utility"));
    const cell = screen.getByTestId("cell-2-gasTherms") as HTMLInputElement;
    const old = cell.value;
    fireEvent.change(cell, { target: { value: "-50" } });
    expect(cell.getAttribute("aria-invalid")).toBe("true");
    expect((screen.getByTestId("utility-apply") as HTMLButtonElement).disabled).toBe(true);
    fireEvent.keyDown(cell, { key: "z", ctrlKey: true });
    expect((screen.getByTestId("cell-2-gasTherms") as HTMLInputElement).value).toBe(old);
    expect((screen.getByTestId("utility-apply") as HTMLButtonElement).disabled).toBe(false);
  });

  it("pastes a block copied from Excel", () => {
    render(<UtilityDataSection />);
    fireEvent.click(screen.getByTestId("manage-utility"));
    const cell = screen.getByTestId("cell-0-elecKWh");
    fireEvent.paste(cell, { clipboardData: { getData: () => "1,000\t$200\n2000\t300\n" } });
    expect((screen.getByTestId("cell-0-elecKWh") as HTMLInputElement).value).toBe("1000");
    expect((screen.getByTestId("cell-0-elecCost") as HTMLInputElement).value).toBe("200");
    expect((screen.getByTestId("cell-1-elecKWh") as HTMLInputElement).value).toBe("2000");
  });

  it("Apply saves, shows the comparison, and the calibrated baseline is applied only when chosen", () => {
    render(<UtilityDataSection />);
    fireEvent.click(screen.getByTestId("manage-utility"));
    const modeled = get().baseline.annual.cost;
    fireEvent.click(screen.getByTestId("utility-apply"));
    expect(get().utilityData["lakeshore-inn"]!.records).toHaveLength(12);
    expect(get().baseline.annual.cost).toBe(modeled); // saving does not switch
    expect(screen.getByTestId("calibration-review")).toBeTruthy();
    expect(screen.getByTestId("calibration-elec").textContent).toMatch(/Guideline 14/);
    expect(screen.getByTestId("baseline-modeled").getAttribute("aria-checked")).toBe("true");
    fireEvent.click(screen.getByTestId("baseline-calibrated"));
    expect(screen.getByTestId("baseline-calibrated").getAttribute("aria-checked")).toBe("true");
    expect(get().baseline.calibration.method).toBe("utility_bills");
    expect(get().baseline.annual.cost).not.toBeCloseTo(modeled, 0);
    expect(screen.getByTestId("utility-status").textContent).toBe("Calibrated model");
  });

  it("manual entry starts blank and is labeled user-entered; incomplete data can be saved but not calibrated", () => {
    render(<UtilityDataSection />);
    fireEvent.click(screen.getByTestId("manage-utility"));
    fireEvent.click(screen.getByTestId("source-manual"));
    expect(screen.getByTestId("draft-provenance").textContent).toMatch(/User-entered data/);
    fireEvent.change(screen.getByTestId("cell-0-elecKWh"), { target: { value: "90000" } });
    expect(screen.getByTestId("coverage-note").textContent).toMatch(/Incomplete/);
    fireEvent.click(screen.getByTestId("utility-apply"));
    expect((screen.getByTestId("baseline-calibrated") as HTMLButtonElement).disabled).toBe(true);
  });

  it("billing periods: the dates view converts months to periods and back", () => {
    render(<UtilityDataSection />);
    fireEvent.click(screen.getByTestId("manage-utility"));
    fireEvent.click(screen.getByTestId("toggle-periods"));
    expect((screen.getByTestId("cell-0-start") as HTMLInputElement).value).toBe("2025-01-01");
    expect((screen.getByTestId("cell-11-end") as HTMLInputElement).value).toBe("2026-01-01");
    fireEvent.click(screen.getByTestId("add-row"));
    expect(screen.getAllByTestId("utility-row")).toHaveLength(13);
  });
  it("keeps use and cost in step when linked, and not when the toggle is off", () => {
    render(<UtilityDataSection />);
    fireEvent.click(screen.getByTestId("manage-utility"));
    const kwh = screen.getByTestId("cell-0-elecKWh") as HTMLInputElement;
    const cost = () => Number((screen.getByTestId("cell-0-elecCost") as HTMLInputElement).value);
    const k0 = Number(kwh.value);
    const c0 = cost();
    expect((screen.getByTestId("toggle-linked") as HTMLInputElement).checked).toBe(true);
    fireEvent.focus(kwh);
    fireEvent.change(kwh, { target: { value: String(k0 * 2) } });
    expect(cost()).toBeCloseTo(c0 * 2, 0);
    fireEvent.click(screen.getByTestId("toggle-linked"));
    const c1 = cost();
    fireEvent.focus(kwh);
    fireEvent.change(kwh, { target: { value: String(k0) } });
    expect(cost()).toBe(c1);
  });
});
