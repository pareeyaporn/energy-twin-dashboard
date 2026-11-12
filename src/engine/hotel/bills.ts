// Utility bills (13.35): up to 12 months of electricity and gas use, optionally with their cost. Pure functions: parse, check,
// derive the hotel's own average rates, and measure how well the calibrated model fits the bills (ASHRAE Guideline 14).
import type { BillFit, EnergyResult, UtilityBillMonth } from './types';

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

const pos = (x: unknown): number | undefined => (typeof x === 'number' && Number.isFinite(x) && x >= 0 ? x : undefined);

/** Keep valid months (0–11, one row per month; later rows replace earlier ones) and non-negative numbers; drop empty rows. */
export function normalizeBills(bills: readonly UtilityBillMonth[] | undefined): UtilityBillMonth[] {
  if (!Array.isArray(bills)) return [];
  const byMonth = new Map<number, UtilityBillMonth>();
  for (const b of bills) {
    if (!b || !Number.isInteger(b.month) || b.month < 0 || b.month > 11) continue;
    const row: UtilityBillMonth = { month: b.month };
    const e = pos(b.elecKWh);
    const g = pos(b.gasTherms);
    const ec = pos(b.elecCost);
    const gc = pos(b.gasCost);
    if (e !== undefined) row.elecKWh = e;
    if (g !== undefined) row.gasTherms = g;
    if (ec !== undefined) row.elecCost = ec;
    if (gc !== undefined) row.gasCost = gc;
    if (Object.keys(row).length > 1) byMonth.set(b.month, row);
  }
  return [...byMonth.values()].sort((a, b) => a.month - b.month);
}

/** Months that report a fuel's use, and its total. */
export function billTotals(bills: readonly UtilityBillMonth[]) {
  const elec = bills.filter((b) => b.elecKWh !== undefined);
  const gas = bills.filter((b) => b.gasTherms !== undefined);
  return {
    elecMonths: elec.map((b) => b.month),
    gasMonths: gas.map((b) => b.month),
    elecKWh: elec.reduce((s, b) => s + (b.elecKWh ?? 0), 0),
    gasTherms: gas.reduce((s, b) => s + (b.gasTherms ?? 0), 0),
  };
}

/**
 * The hotel's own average rates: total cost ÷ total use over the months that report both (all-in, like the EIA averages they
 * replace). Null for a fuel without such months or with zero use.
 */
export function billRates(bills: readonly UtilityBillMonth[]): { elecPerKWh: number | null; gasPerTherm: number | null } {
  const e = bills.filter((b) => b.elecKWh !== undefined && b.elecCost !== undefined);
  const g = bills.filter((b) => b.gasTherms !== undefined && b.gasCost !== undefined);
  const ek = e.reduce((s, b) => s + (b.elecKWh ?? 0), 0);
  const gt = g.reduce((s, b) => s + (b.gasTherms ?? 0), 0);
  return {
    elecPerKWh: ek > 0 ? e.reduce((s, b) => s + (b.elecCost ?? 0), 0) / ek : null,
    gasPerTherm: gt > 0 ? g.reduce((s, b) => s + (b.gasCost ?? 0), 0) / gt : null,
  };
}

/** "Jan", "January", "2025-01", "01/2025", "1" → 0–11; null when it is not a month. */
export function parseMonth(s: string): number | null {
  const t = s.trim().toLowerCase();
  if (!t) return null;
  const name = MONTHS.findIndex((m) => t.startsWith(m));
  if (name >= 0) return name;
  const iso = /^(\d{4})[-/](\d{1,2})(?:[-/]\d{1,2})?$/.exec(t);
  if (iso) return monthIndex(Number(iso[2]));
  const us = /^(\d{1,2})[-/](\d{4})$/.exec(t) ?? /^(\d{1,2})[-/]\d{1,2}[-/](\d{4})$/.exec(t);
  if (us) return monthIndex(Number(us[1]));
  if (/^\d{1,2}$/.test(t)) return monthIndex(Number(t));
  return null;
}
const monthIndex = (n: number) => (n >= 1 && n <= 12 ? n - 1 : null);

const COLUMNS: { key: keyof Omit<UtilityBillMonth, 'month'> | 'month'; re: RegExp }[] = [
  { key: 'month', re: /^(month|period|billing (month|period)|date)/ },
  { key: 'elecCost', re: /(electric|elec|power).*(cost|\$|usd|amount|charge)|(cost|amount|charge).*(electric|elec)/ },
  { key: 'gasCost', re: /gas.*(cost|\$|usd|amount|charge)|(cost|amount|charge).*gas/ },
  { key: 'elecKWh', re: /kwh|(electric|elec).*(use|usage|consumption)/ },
  { key: 'gasTherms', re: /therm|gas.*(use|usage|consumption)/ },
];

const num = (s: string | undefined) => {
  if (s === undefined) return undefined;
  const t = s.replace(/[$,\s]/g, '');
  if (!t) return undefined;
  const v = Number(t);
  return Number.isFinite(v) ? v : NaN;
};

/** Split one CSV line (commas or semicolons; quoted fields may contain commas). */
function cells(line: string, sep: string): string[] {
  const out: string[] = [];
  let cur = '';
  let quoted = false;
  for (const ch of line) {
    if (ch === '"') quoted = !quoted;
    else if (ch === sep && !quoted) {
      out.push(cur);
      cur = '';
    } else cur += ch;
  }
  out.push(cur);
  return out.map((c) => c.trim());
}

/**
 * Read a CSV of monthly bills: a header row naming the month and at least one of electricity kWh, gas therms, electricity cost,
 * gas cost (in any order; "$" and thousands separators are fine), then one row per month. Returns the bills and plain-language
 * problems (an unknown month, a negative or unreadable number); rows with a problem are skipped.
 */
export function parseUtilityBillsCsv(text: string): { bills: UtilityBillMonth[]; problems: string[] } {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  const problems: string[] = [];
  if (lines.length < 2) return { bills: [], problems: ['The file needs a header row and at least one month.'] };
  const sep = (lines[0]!.match(/;/g)?.length ?? 0) > (lines[0]!.match(/,/g)?.length ?? 0) ? ';' : ',';
  const header = cells(lines[0]!, sep).map((h) => h.toLowerCase());
  const col: Partial<Record<(typeof COLUMNS)[number]['key'], number>> = {};
  header.forEach((h, i) => {
    const c = COLUMNS.find((x) => col[x.key] === undefined && x.re.test(h));
    if (c) col[c.key] = i;
  });
  if (col.month === undefined) return { bills: [], problems: ['No month column found (name one "Month").'] };
  if (col.elecKWh === undefined && col.gasTherms === undefined) {
    return { bills: [], problems: ['No electricity (kWh) or gas (therms) column found.'] };
  }
  const rows: UtilityBillMonth[] = [];
  lines.slice(1).forEach((line, i) => {
    const c = cells(line, sep);
    const m = parseMonth(c[col.month!] ?? '');
    if (m === null) {
      problems.push(`Row ${i + 2}: "${c[col.month!] ?? ''}" is not a month; skipped.`);
      return;
    }
    const row: UtilityBillMonth = { month: m };
    for (const key of ['elecKWh', 'gasTherms', 'elecCost', 'gasCost'] as const) {
      const at = col[key];
      if (at === undefined) continue;
      const v = num(c[at]);
      if (v === undefined) continue;
      if (Number.isNaN(v) || v < 0) {
        problems.push(`Row ${i + 2}: "${c[at]}" is not a usable number; left out.`);
        continue;
      }
      row[key] = v;
    }
    rows.push(row);
  });
  const bills = normalizeBills(rows);
  const months = new Set(rows.map((r) => r.month));
  if (months.size < rows.length) problems.push('A month appears more than once; the last row for it was used.');
  return { bills, problems };
}

/**
 * ASHRAE Guideline 14-2014 monthly calibration criteria: normalized mean bias error within ±5% and CV(RMSE) within 15%, on
 * 12 monthly values. Fewer months are measured but cannot meet the criteria.
 */
export const GUIDELINE_14_MONTHLY = { nmbePct: 5, cvrmsePct: 15, months: 12 } as const;

/** How the model's months compare with the bills, per fuel (only months the bills report). */
export function billFit(result: Pick<EnergyResult, 'months'>, bills: readonly UtilityBillMonth[]): BillFit {
  const fuel = (pick: (b: UtilityBillMonth) => number | undefined, model: (m: number) => number) => {
    const pairs = bills.filter((b) => pick(b) !== undefined).map((b) => ({ month: b.month, bill: pick(b)!, model: model(b.month) }));
    const n = pairs.length;
    if (n === 0) return null;
    const mean = pairs.reduce((s, p) => s + p.bill, 0) / n;
    if (mean <= 0) return null;
    // Guideline 14 uses n − p degrees of freedom; with p = 1 for a single scaling factor.
    const dof = Math.max(1, n - 1);
    const nmbe = (pairs.reduce((s, p) => s + (p.bill - p.model), 0) / (dof * mean)) * 100;
    const cvrmse = (Math.sqrt(pairs.reduce((s, p) => s + (p.bill - p.model) ** 2, 0) / dof) / mean) * 100;
    const meets = n >= GUIDELINE_14_MONTHLY.months && Math.abs(nmbe) <= GUIDELINE_14_MONTHLY.nmbePct && cvrmse <= GUIDELINE_14_MONTHLY.cvrmsePct;
    return { months: n, nmbePct: nmbe, cvrmsePct: cvrmse, meetsGuideline14: meets, pairs };
  };
  const month = (m: number) => result.months.find((x) => x.month === m)?.totals;
  return {
    elec: fuel((b) => b.elecKWh, (m) => month(m)?.elecKWh ?? 0),
    gas: fuel((b) => b.gasTherms, (m) => month(m)?.gasTherms ?? 0),
  };
}
