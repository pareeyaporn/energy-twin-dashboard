// Excel files for utility data (docs/19 §2): the downloadable template and reading an uploaded workbook. exceljs is loaded only when
// one of these runs, so it is not part of the app's first load. Everything happens in the browser; no file leaves the device.
import type { UtilityGridRow } from "@/engine/hotel";

type ExcelJS = typeof import("exceljs");
let lib: Promise<ExcelJS> | null = null;
async function excel(): Promise<ExcelJS> {
  lib ??= import("exceljs").then((m) => ((m as unknown as { default?: ExcelJS }).default ?? m) as ExcelJS);
  return lib;
}

export const TEMPLATE_SHEET = "Monthly Utility Data";
export const TEMPLATE_HEADERS = ["Billing year", "Month", "Start date", "End date", "Electricity (kWh)", "Electricity cost ($)", "Natural gas (therms)", "Gas cost ($)"] as const;
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const NAVY = "FF0B1A33";
const CYAN = "FF22D3EE";

const INSTRUCTIONS: string[][] = [
  ["Energy Twin — utility data template"],
  [""],
  ["What to enter", "One row per bill: the billing year, the month, and the electricity and natural gas use and cost from that bill."],
  ["Required", "A month (or the start and end dates of the billing period) and at least one of: Electricity (kWh), Natural gas (therms)."],
  ["Optional", "Electricity cost ($) and Gas cost ($): the bill's total charges. They show your actual spending and, if you choose, your own average rates."],
  ["Units", "Electricity in kWh (not MWh). Natural gas in therms. If your bills use CCF, Mcf or MMBtu, upload them in a file whose column header names that unit (for example \"Gas (CCF)\"); Energy Twin converts them and asks when a unit is unclear."],
  ["Billing periods", "Bills rarely start on the 1st. For calendar-month data leave the dates empty. For real billing periods fill Start date (first day of service) and End date (the day after the last day, the next bill's start); then each bill is compared with exactly those days."],
  ["Corrections", "A negative cost (credit or adjustment) is allowed and flagged. Use cannot be negative. A month with zero use is allowed (for example no gas in summer)."],
  ["One meter per fuel", "This template holds one electricity meter and one gas meter. Add up several meters per bill before entering them (several meters with their own periods are not supported yet)."],
  ["Upload", "Save this file, then in Energy Twin open Hotel → Manage Utility Data → Upload Excel and choose it. Review the rows, fix anything highlighted, and press Apply."],
  ["Privacy", "The file is read in your browser and the data is kept in this browser only. It is not sent to Energy Twin's servers or to the AI advisor."],
  [""],
  ["The 'Example Data' sheet holds synthetic demonstration values, not a real hotel's bills."],
];

function styleHeader(ws: import("exceljs").Worksheet) {
  const row = ws.getRow(1);
  row.font = { bold: true, color: { argb: "FFFFFFFF" } };
  row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } };
  row.alignment = { vertical: "middle" };
  row.height = 20;
  ws.views = [{ state: "frozen", ySplit: 1 }];
}

function dataSheet(wb: import("exceljs").Workbook, name: string, rows: (UtilityGridRow & { year: number })[]) {
  const ws = wb.addWorksheet(name, { properties: { tabColor: { argb: CYAN } } });
  ws.columns = TEMPLATE_HEADERS.map((h, i) => ({ header: h, key: `c${i}`, width: i < 2 ? 14 : 20 }));
  styleHeader(ws);
  rows.forEach((r) => {
    const n = (s: string) => (s.trim() === "" ? null : Number(s));
    ws.addRow([r.year, r.month === null ? "" : MONTHS[r.month], r.start || null, r.end || null, n(r.elecKWh), n(r.elecCost), n(r.gasTherms), n(r.gasCost)]);
  });
  const last = Math.max(13, rows.length + 1);
  for (let i = 2; i <= last; i++) {
    const row = ws.getRow(i);
    row.getCell(5).numFmt = "#,##0";
    row.getCell(7).numFmt = "#,##0";
    row.getCell(6).numFmt = "$#,##0.00";
    row.getCell(8).numFmt = "$#,##0.00";
    row.getCell(2).dataValidation = { type: "list", allowBlank: true, formulae: [`"${MONTHS.join(",")}"`], showErrorMessage: true, errorTitle: "Month", error: "Choose a month from the list." };
    for (const c of [5, 7]) row.getCell(c).dataValidation = { type: "decimal", operator: "greaterThanOrEqual", allowBlank: true, formulae: [0], showErrorMessage: true, errorTitle: "Use", error: "Use cannot be negative." };
    for (const c of [3, 4]) row.getCell(c).dataValidation = { type: "date", operator: "greaterThan", allowBlank: true, formulae: [new Date(Date.UTC(1990, 0, 1))], showErrorMessage: true, errorTitle: "Date", error: "Enter a date (YYYY-MM-DD)." };
    row.getCell(1).dataValidation = { type: "whole", operator: "between", allowBlank: true, formulae: [1990, 2100], showErrorMessage: true, errorTitle: "Year", error: "Enter a four-digit year." };
  }
  return ws;
}

/** The template workbook: Instructions, an empty 12-month sheet for the given year, and the synthetic example. */
export async function buildTemplate(year: number, example: UtilityGridRow[]): Promise<Blob> {
  const ExcelJS = await excel();
  const wb = new ExcelJS.Workbook();
  wb.creator = "Energy Twin";
  const ins = wb.addWorksheet("Instructions");
  ins.columns = [{ width: 22 }, { width: 110 }];
  INSTRUCTIONS.forEach((r) => ins.addRow(r));
  ins.getRow(1).font = { bold: true, size: 14, color: { argb: NAVY } };
  ins.getColumn(1).font = { bold: true };
  ins.getColumn(2).alignment = { wrapText: true, vertical: "top" };
  dataSheet(wb, TEMPLATE_SHEET, MONTHS.map((_, m) => ({ year, month: m, start: "", end: "", elecKWh: "", elecCost: "", gasTherms: "", gasCost: "" })));
  const ex = dataSheet(wb, "Example Data", example.map((r) => ({ ...r, year })));
  ex.getCell("J1").value = "SYNTHETIC demonstration data (not a real hotel's bills)";
  ex.getCell("J1").font = { bold: true, color: { argb: "FFB45309" } };
  const buf = await wb.xlsx.writeBuffer();
  return new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

const cellText = (v: unknown): string => {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "object") {
    const o = v as { result?: unknown; text?: unknown; richText?: { text: string }[] };
    if (o.result !== undefined) return cellText(o.result);
    if (Array.isArray(o.richText)) return o.richText.map((x) => x.text).join("");
    if (typeof o.text === "string") return o.text;
  }
  return String(v).trim();
};

/**
 * The sheet to import as a table of text cells: the template's data sheet when present, otherwise the first sheet that has a header
 * row. Dates become YYYY-MM-DD; formulas give their last calculated value.
 */
export async function readWorkbook(data: ArrayBuffer): Promise<{ sheet: string; rows: string[][]; sheets: string[] }> {
  const ExcelJS = await excel();
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(data);
  const sheets = wb.worksheets.map((w) => w.name);
  const ws = wb.getWorksheet(TEMPLATE_SHEET) ?? wb.worksheets.find((w) => w.name !== "Instructions" && w.rowCount > 1) ?? wb.worksheets[0];
  if (!ws) return { sheet: "", rows: [], sheets };
  const width = Math.min(30, ws.columnCount);
  const rows: string[][] = [];
  ws.eachRow({ includeEmpty: false }, (row) => {
    const cells: string[] = [];
    for (let c = 1; c <= width; c++) cells.push(cellText(row.getCell(c).value));
    rows.push(cells);
  });
  // Drop trailing columns that are empty everywhere (for example the example sheet's note).
  let keep = width;
  while (keep > 0 && rows.slice(1).every((r) => !r[keep - 1])) keep--;
  return { sheet: ws.name, rows: rows.map((r) => r.slice(0, Math.max(keep, 1))), sheets };
}
