import { describe, expect, it } from "vitest";
import { linkedEdit, parseCell, rowRate } from "@/utility/linkedCells";
import type { UtilityGridRow } from "@/engine/hotel";

const row = (o: Partial<UtilityGridRow>): UtilityGridRow =>
  ({ month: 1, start: "", end: "", elecKWh: "", elecCost: "", gasTherms: "", gasCost: "", ...o }) as UtilityGridRow;

describe("linked use and cost", () => {
  it("parses cells with $ and commas", () => {
    expect(parseCell("$12,000.50")).toBe(12000.5);
    expect(parseCell("")).toBeNull();
    expect(parseCell("abc")).toBeNull();
  });

  it("uses the row's own rate, else the fallback", () => {
    expect(rowRate(row({ elecKWh: "1000", elecCost: "150" }), "elec", 0.14)).toBeCloseTo(0.15);
    expect(rowRate(row({ elecKWh: "1000" }), "elec", 0.14)).toBe(0.14);
    expect(rowRate(row({}), "gas", null)).toBeNull();
  });

  it("updates the paired cell both ways and leaves it on empty input", () => {
    const r = row({ elecKWh: "1000", elecCost: "150.00" });
    expect(linkedEdit(r, "elecKWh", "2000", 0.15).elecCost).toBe("300.00");
    expect(linkedEdit(r, "elecCost", "75", 0.15).elecKWh).toBe("500");
    expect(linkedEdit(r, "elecKWh", "", 0.15).elecCost).toBe("150.00");
    expect(linkedEdit(r, "elecKWh", "2000", null).elecCost).toBe("150.00");
    const g = linkedEdit(row({ gasTherms: "100", gasCost: "90" }), "gasTherms", "200", 0.9);
    expect(g.gasCost).toBe("180.00");
  });
});
