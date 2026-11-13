// Checking utility records before they are applied (docs/19 §4). Errors block Apply; warnings are shown and allowed.
import { billDays, coverageDays, isoDay, periodMonth, CALIBRATION_RULES } from './bills';
import type { UtilityGridRow } from './billsImport';
import type { UtilityBillMonth } from './types';

export type GridField = 'month' | 'start' | 'end' | 'elecKWh' | 'elecCost' | 'gasTherms' | 'gasCost';
export type GridMode = 'monthly' | 'periods';

export interface GridIssue {
  /** Row index in the grid; null for the whole table. */
  row: number | null;
  field: GridField | null;
  level: 'error' | 'warning';
  message: string;
}

/**
 * Thresholds (product decisions, docs/15 §22). A month far from the others is flagged, not rejected: hotels close floors, and
 * billing corrections happen. Implied rates outside these ranges usually mean a unit or a column mix-up.
 */
export const VALIDATION_RULES = {
  /** A bill more than 3× or less than a third of the median of the same fuel (needs at least 6 bills). */
  outlierRatio: 3,
  outlierMinBills: 6,
  /** All-in $ per kWh and $ per therm outside these ranges is flagged. */
  elecRate: [0.03, 0.6] as [number, number],
  gasRate: [0.2, 5] as [number, number],
  /** A billing period longer than this many days is flagged (bimonthly or a catch-up bill). */
  longPeriodDays: 62,
} as const;

export interface GridCheck {
  /** Usable records (rows without errors), in the model's units. */
  records: UtilityBillMonth[];
  issues: GridIssue[];
  errors: number;
  warnings: number;
  /** No errors and at least one record with use. */
  canApply: boolean;
  coverage: { elec: { bills: number; days: number; complete: boolean }; gas: { bills: number; days: number; complete: boolean } };
}

const NUM = /^-?\d+(\.\d+)?$/;

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
}

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** Check the editor's rows and turn them into records. */
export function validateGrid(rows: readonly UtilityGridRow[], mode: GridMode): GridCheck {
  const issues: GridIssue[] = [];
  const add = (row: number | null, field: GridField | null, level: GridIssue['level'], message: string) => issues.push({ row, field, level, message });
  const records: (UtilityBillMonth & { row: number })[] = [];
  const name = (i: number) => {
    const r = rows[i]!;
    return mode === 'monthly' && r.month !== null ? MONTH_NAMES[r.month]! : `Row ${i + 1}`;
  };

  rows.forEach((r, i) => {
    const before = issues.filter((x) => x.level === 'error').length;
    const values: Partial<Record<'elecKWh' | 'elecCost' | 'gasTherms' | 'gasCost', number>> = {};
    for (const f of ['elecKWh', 'elecCost', 'gasTherms', 'gasCost'] as const) {
      const t = r[f].trim();
      if (!t) continue;
      if (!NUM.test(t)) {
        add(i, f, 'error', `${name(i)}: "${t}" is not a number.`);
        continue;
      }
      const v = Number(t);
      if (v < 0 && (f === 'elecKWh' || f === 'gasTherms')) add(i, f, 'error', `${name(i)}: use cannot be negative.`);
      else if (v < 0) add(i, f, 'warning', `${name(i)}: a negative cost is read as a billing credit or adjustment.`);
      values[f] = v;
    }
    const hasUse = values.elecKWh !== undefined || values.gasTherms !== undefined;
    const hasAny = hasUse || values.elecCost !== undefined || values.gasCost !== undefined;
    if (!hasAny && !r.start && !r.end) return; // an empty row
    if (!hasUse) add(i, null, 'warning', `${name(i)}: no electricity or gas use; the row is not used for the comparison.`);
    if (values.elecKWh === 0) add(i, 'elecKWh', 'warning', `${name(i)}: zero electricity use (fine if the hotel was closed or the meter was off).`);
    if (values.gasTherms === 0) add(i, 'gasTherms', 'warning', `${name(i)}: zero gas use (fine in a summer month with no gas heating or hot water).`);

    let month: number | null = r.month;
    let start: string | undefined;
    let end: string | undefined;
    if (mode === 'monthly') {
      if (month === null) add(i, 'month', 'error', `${name(i)}: choose a month.`);
    } else {
      const s = isoDay(r.start);
      const e = isoDay(r.end);
      if (s === null) add(i, 'start', 'error', `${name(i)}: the start date "${r.start || '(empty)'}" is not a valid date (YYYY-MM-DD).`);
      if (e === null) add(i, 'end', 'error', `${name(i)}: the end date "${r.end || '(empty)'}" is not a valid date (YYYY-MM-DD).`);
      if (s !== null && e !== null) {
        if (e <= s) add(i, 'end', 'error', `${name(i)}: the end date must be after the start date.`);
        else {
          const days = Math.round((e - s) / 86_400_000);
          if (days > 366) add(i, 'end', 'error', `${name(i)}: a billing period cannot be longer than a year.`);
          else if (days > VALIDATION_RULES.longPeriodDays) add(i, 'end', 'warning', `${name(i)}: a ${days}-day billing period (bimonthly or a catch-up bill?).`);
          start = r.start;
          end = r.end;
          month = periodMonth(r.start, r.end);
        }
      }
    }
    if (issues.filter((x) => x.level === 'error').length > before || month === null) return;
    const rec: UtilityBillMonth & { row: number } = { row: i, month, ...(start ? { start, end: end! } : {}) };
    Object.assign(rec, values);
    records.push(rec);

    const rate = (cost: number | undefined, use: number | undefined, [lo, hi]: [number, number], label: string, unit: string, field: GridField) => {
      if (cost === undefined || use === undefined || use <= 0 || cost <= 0) return;
      const r0 = cost / use;
      if (r0 < lo || r0 > hi) add(i, field, 'warning', `${name(i)}: ${label} costs $${r0.toFixed(3)} per ${unit}, outside the usual $${lo}–$${hi}; check the unit and the columns.`);
    };
    rate(values.elecCost, values.elecKWh, VALIDATION_RULES.elecRate, 'electricity', 'kWh', 'elecCost');
    rate(values.gasCost, values.gasTherms, VALIDATION_RULES.gasRate, 'gas', 'therm', 'gasCost');
  });

  // Duplicates and overlaps (one electricity and one gas meter: a row's period applies to both).
  if (mode === 'monthly') {
    const seen = new Map<number, number>();
    for (const rec of records) {
      const first = seen.get(rec.month);
      if (first !== undefined) add(rec.row, 'month', 'error', `${MONTH_NAMES[rec.month]} appears twice (rows ${first + 1} and ${rec.row + 1}); keep one row per month or use billing periods.`);
      else seen.set(rec.month, rec.row);
    }
  } else {
    const sorted = [...records].sort((a, b) => isoDay(a.start)! - isoDay(b.start)!);
    for (let k = 1; k < sorted.length; k++) {
      const a = sorted[k - 1]!;
      const b = sorted[k]!;
      if (a.start === b.start && a.end === b.end) add(b.row, 'start', 'error', `Rows ${a.row + 1} and ${b.row + 1} are the same billing period (a duplicate).`);
      else if (isoDay(b.start)! < isoDay(a.end)!) add(b.row, 'start', 'error', `Rows ${a.row + 1} and ${b.row + 1} overlap (${b.start} starts before ${a.end}); the same meter cannot be billed twice for a day.`);
    }
  }

  // Outliers per fuel.
  for (const [f, label] of [['elecKWh', 'electricity'], ['gasTherms', 'gas']] as const) {
    const vals = records.filter((r) => r[f] !== undefined && r[f]! > 0).map((r) => ({ row: r.row, perDay: r[f]! / Math.max(1, billDays(r).reduce((s, d) => s + d.days, 0)) }));
    if (vals.length < VALIDATION_RULES.outlierMinBills) continue;
    const med = median(vals.map((v) => v.perDay));
    for (const v of vals) {
      if (v.perDay > med * VALIDATION_RULES.outlierRatio) add(v.row, f, 'warning', `${name(v.row)}: ${label} use per day is more than ${VALIDATION_RULES.outlierRatio}× the median; check for a typo or a catch-up bill.`);
      else if (v.perDay < med / VALIDATION_RULES.outlierRatio) add(v.row, f, 'warning', `${name(v.row)}: ${label} use per day is less than a third of the median; check for a typo or an estimated read.`);
    }
  }

  const errorRows = new Set(issues.filter((x) => x.level === 'error' && x.row !== null).map((x) => x.row));
  const usable = records.filter((r) => !errorRows.has(r.row)).map(({ row: _row, ...r }) => r);
  const cov = (fuel: 'elec' | 'gas') => {
    const bills = usable.filter((r) => (fuel === 'elec' ? r.elecKWh : r.gasTherms) !== undefined).length;
    const days = coverageDays(usable, fuel);
    return { bills, days, complete: bills >= CALIBRATION_RULES.minBills && days >= CALIBRATION_RULES.minCoverageDays };
  };
  const coverage = { elec: cov('elec'), gas: cov('gas') };
  for (const [fuel, label] of [['elec', 'Electricity'], ['gas', 'Gas']] as const) {
    const c = coverage[fuel];
    if (c.bills > 0 && !c.complete) add(null, null, 'warning', `${label}: ${c.bills} bill${c.bills === 1 ? '' : 's'} covering ${c.days} days. A full year (12 bills, at least ${CALIBRATION_RULES.minCoverageDays} days) is needed to calibrate; fewer are compared only.`);
  }
  const errors = issues.filter((x) => x.level === 'error').length;
  return {
    records: usable,
    issues,
    errors,
    warnings: issues.length - errors,
    canApply: errors === 0 && usable.some((r) => r.elecKWh !== undefined || r.gasTherms !== undefined),
    coverage,
  };
}

/** Records back to editor rows (for reopening applied data). */
export function recordsToGrid(records: readonly UtilityBillMonth[], mode: GridMode): UtilityGridRow[] {
  const s = (v: number | undefined) => (v === undefined ? '' : String(Math.round(v * 1000) / 1000));
  const row = (r: UtilityBillMonth | undefined, month: number | null): UtilityGridRow => ({
    month,
    start: r?.start ?? '',
    end: r?.end ?? '',
    elecKWh: s(r?.elecKWh),
    elecCost: s(r?.elecCost),
    gasTherms: s(r?.gasTherms),
    gasCost: s(r?.gasCost),
  });
  if (mode === 'periods') return records.map((r) => row(r, r.month));
  return Array.from({ length: 12 }, (_, m) => row(records.find((r) => !r.start && r.month === m), m));
}
