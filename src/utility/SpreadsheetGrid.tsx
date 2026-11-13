import { useRef } from "react";
import { Trash2 } from "lucide-react";
import type { GridField, GridIssue, GridMode, UtilityGridRow } from "@/engine/hotel";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

type EditField = Exclude<GridField, "month">;
const VALUE_COLUMNS: { field: EditField; label: string; unit: string }[] = [
  { field: "elecKWh", label: "Electricity", unit: "kWh" },
  { field: "elecCost", label: "Electricity cost", unit: "$" },
  { field: "gasTherms", label: "Natural gas", unit: "therms" },
  { field: "gasCost", label: "Gas cost", unit: "$" },
];
const DATE_COLUMNS: { field: EditField; label: string; unit: string }[] = [
  { field: "start", label: "Start date", unit: "YYYY-MM-DD" },
  { field: "end", label: "End date", unit: "day after last" },
];

export interface SpreadsheetGridProps {
  rows: UtilityGridRow[];
  mode: GridMode;
  issues: GridIssue[];
  onChange: (rows: UtilityGridRow[]) => void;
  onUndo: () => void;
  onRemoveRow?: (index: number) => void;
}

/**
 * A small spreadsheet: click a cell to edit; arrow keys, Enter and Tab move between cells; pasting cells copied from Excel fills the
 * block from the focused cell; Ctrl/Cmd+Z undoes. Cells with an error are outlined red, warnings amber.
 */
export function SpreadsheetGrid({ rows, mode, issues, onChange, onUndo, onRemoveRow }: SpreadsheetGridProps) {
  const ref = useRef<HTMLTableElement>(null);
  const columns = mode === "periods" ? [...DATE_COLUMNS, ...VALUE_COLUMNS] : VALUE_COLUMNS;
  const issueAt = (r: number, f: GridField) => {
    const here = issues.filter((x) => x.row === r && (x.field === f || (x.field === null && f !== "start" && f !== "end")));
    return here.some((x) => x.level === "error" && x.field === f) ? "error" : here.some((x) => x.field === f) ? "warning" : null;
  };
  const messageAt = (r: number, f: GridField) => issues.filter((x) => x.row === r && x.field === f).map((x) => x.message).join(" ");

  const focus = (r: number, c: number) => {
    const el = ref.current?.querySelector<HTMLInputElement>(`[data-cell="${r}-${c}"]`);
    if (el) {
      el.focus();
      el.select();
    }
  };
  const set = (r: number, f: EditField, v: string) => onChange(rows.map((row, i) => (i === r ? { ...row, [f]: v } : row)));

  const onKey = (e: React.KeyboardEvent<HTMLInputElement>, r: number, c: number) => {
    const el = e.currentTarget;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
      e.preventDefault();
      onUndo();
      return;
    }
    const atStart = el.selectionStart === 0 && el.selectionEnd === 0;
    const atEnd = el.selectionStart === el.value.length;
    const whole = el.selectionStart === 0 && el.selectionEnd === el.value.length;
    if (e.key === "ArrowDown" || (e.key === "Enter" && !e.shiftKey)) {
      e.preventDefault();
      focus(Math.min(rows.length - 1, r + 1), c);
    } else if (e.key === "ArrowUp" || (e.key === "Enter" && e.shiftKey)) {
      e.preventDefault();
      focus(Math.max(0, r - 1), c);
    } else if (e.key === "ArrowLeft" && (atStart || whole) && c > 0) {
      e.preventDefault();
      focus(r, c - 1);
    } else if (e.key === "ArrowRight" && (atEnd || whole) && c < columns.length - 1) {
      e.preventDefault();
      focus(r, c + 1);
    } else if (e.key === "Escape") el.blur();
  };

  const onPaste = (e: React.ClipboardEvent<HTMLInputElement>, r: number, c: number) => {
    const text = e.clipboardData.getData("text/plain");
    if (!/[\t\n]/.test(text.trim())) return; // a single value: normal paste
    e.preventDefault();
    const block = text.replace(/\r/g, "").replace(/\n$/, "").split("\n").map((line) => line.split("\t"));
    const next = rows.map((row) => ({ ...row }));
    block.forEach((cells, dr) => {
      const target = next[r + dr];
      if (!target) return;
      cells.forEach((v, dc) => {
        const col = columns[c + dc];
        if (col) target[col.field] = col.field === "start" || col.field === "end" ? v.trim() : v.replace(/[$,\s]/g, "");
      });
    });
    onChange(next);
  };

  return (
    <div className="table-scroll max-h-[46vh] overflow-auto rounded-lg border border-glass-border" data-testid="utility-grid">
      <table ref={ref} role="grid" aria-label="Utility records" className="w-full min-w-[640px] border-collapse text-sm">
        <thead className="sticky top-0 z-10 bg-card">
          <tr role="row" className="border-b border-border text-left text-xs text-muted-foreground">
            <th role="columnheader" className="w-32 px-3 py-2 font-medium">{mode === "periods" ? "Bill" : "Month"}</th>
            {columns.map((col) => (
              <th key={col.field} role="columnheader" className="px-2 py-2 text-right font-medium">
                {col.label}
                <span className="block text-[10px] font-normal opacity-80">{col.unit}</span>
              </th>
            ))}
            {mode === "periods" && <th role="columnheader" className="w-10"><span className="sr-only">Remove</span></th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, r) => (
            <tr key={r} role="row" className="border-b border-border/40" data-testid="utility-row">
              <th role="rowheader" scope="row" className={`px-3 py-1 text-left text-xs font-medium ${issueAt(r, "month") === "error" ? "text-destructive" : ""}`}>
                {mode === "periods" ? `Bill ${r + 1}` : row.month !== null ? MONTHS[row.month] : "—"}
              </th>
              {columns.map((col, c) => {
                const state = issueAt(r, col.field);
                const msg = messageAt(r, col.field);
                return (
                  <td key={col.field} role="gridcell" className="p-0.5">
                    <input
                      data-cell={`${r}-${c}`}
                      data-testid={`cell-${r}-${col.field}`}
                      value={row[col.field]}
                      inputMode={col.field === "start" || col.field === "end" ? "text" : "decimal"}
                      aria-label={`${mode === "periods" ? `Bill ${r + 1}` : row.month !== null ? MONTHS[row.month] : `Row ${r + 1}`} ${col.label}${col.unit ? ` (${col.unit})` : ""}`}
                      aria-invalid={state === "error"}
                      title={msg || undefined}
                      onChange={(e) => set(r, col.field, e.target.value)}
                      onKeyDown={(e) => onKey(e, r, c)}
                      onPaste={(e) => onPaste(e, r, c)}
                      onFocus={(e) => e.currentTarget.select()}
                      className={`num w-full rounded border bg-background/60 px-2 py-1 text-right tabular-nums outline-none focus:border-primary focus:ring-1 focus:ring-primary ${
                        state === "error" ? "border-destructive bg-destructive/10" : state === "warning" ? "border-amber-500/70 bg-amber-500/10" : "border-transparent hover:border-border"
                      } ${col.field === "start" || col.field === "end" ? "text-left" : ""}`}
                    />
                  </td>
                );
              })}
              {mode === "periods" && (
                <td className="p-0.5 text-center">
                  <button type="button" onClick={() => onRemoveRow?.(r)} className="rounded p-1 text-muted-foreground hover:bg-destructive/15 hover:text-destructive" aria-label={`Remove bill ${r + 1}`}>
                    <Trash2 className="size-3.5" />
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
