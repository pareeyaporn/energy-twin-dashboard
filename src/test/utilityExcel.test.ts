// @vitest-environment node
import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { buildTemplate, readWorkbook, TEMPLATE_HEADERS, TEMPLATE_SHEET } from "@/utility/excel";
import { calculateBaselineEnergy, guessMapping, mappingComplete, presetProfile, recordsToGrid, sampleUtilityBills, tableToGrid, validateGrid } from "@/engine/hotel";

const hotel = presetProfile("demo-chicago-100");
const sample = recordsToGrid(sampleUtilityBills(hotel.profile, calculateBaselineEnergy(hotel)), "monthly");

describe("Excel template", () => {
  it("has the three sheets, the template headers and the synthetic example", async () => {
    const blob = await buildTemplate(2025, sample);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(await blob.arrayBuffer());
    expect(wb.worksheets.map((w) => w.name)).toEqual(["Instructions", TEMPLATE_SHEET, "Example Data"]);
    const ws = wb.getWorksheet(TEMPLATE_SHEET)!;
    expect((ws.getRow(1).values as unknown[]).slice(1)).toEqual([...TEMPLATE_HEADERS]);
    expect(ws.getCell("B2").value).toBe("January");
    expect(ws.getCell("E2").numFmt).toBe("#,##0");
    expect(ws.getCell("B2").dataValidation?.type).toBe("list");
    expect(String(wb.getWorksheet("Example Data")!.getCell("J1").value)).toMatch(/SYNTHETIC/);
  });

  it("round-trips: fill the template in Excel, upload it, and the values come back unchanged with no questions", async () => {
    const blob = await buildTemplate(2025, sample);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(await blob.arrayBuffer());
    const ws = wb.getWorksheet(TEMPLATE_SHEET)!;
    sample.forEach((r, i) => {
      const row = ws.getRow(i + 2);
      row.getCell(5).value = Number(r.elecKWh);
      row.getCell(6).value = Number(r.elecCost);
      row.getCell(7).value = Number(r.gasTherms);
      row.getCell(8).value = Number(r.gasCost);
    });
    ws.getRow(3).getCell(5).value = 123456; // an edit "in Excel"
    const edited = await wb.xlsx.writeBuffer();
    const read = await readWorkbook(edited as ArrayBuffer);
    expect(read.sheet).toBe(TEMPLATE_SHEET);
    const g = guessMapping(read.rows[0]!);
    expect(mappingComplete(g.mapping)).toBe(true);
    expect(g.questions).toEqual([]);
    const grid = tableToGrid(read.rows.slice(1), g.mapping);
    expect(grid.year).toBe(2025);
    expect(grid.rows).toHaveLength(12);
    expect(grid.rows[1]!.elecKWh).toBe("123456");
    expect(grid.rows[0]).toMatchObject({ month: 0, elecKWh: sample[0]!.elecKWh, gasTherms: sample[0]!.gasTherms, elecCost: sample[0]!.elecCost });
    const v = validateGrid(grid.rows, "monthly");
    expect(v.errors).toBe(0);
    expect(v.records).toHaveLength(12);
  });

  it("reads billing dates written as Excel dates", async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Bills");
    ws.addRow(["Start date", "End date", "Electricity (kWh)"]);
    ws.addRow([new Date(Date.UTC(2025, 0, 6)), new Date(Date.UTC(2025, 1, 5)), 90000]);
    const read = await readWorkbook((await wb.xlsx.writeBuffer()) as ArrayBuffer);
    const g = tableToGrid(read.rows.slice(1), guessMapping(read.rows[0]!).mapping);
    expect(g.rows[0]).toMatchObject({ start: "2025-01-06", end: "2025-02-05", elecKWh: "90000", month: 0 });
    expect(validateGrid(g.rows, "periods").errors).toBe(0);
  });
});
