// Reading utility records from a table (CSV text or the cells of an Excel sheet): which column is what, in which unit, and the rows as
// editor rows. Pure; the Excel file itself is read in the browser (src/utility) and handed over as a table of strings.

/** What a column holds. */
export type UtilityField = 'month' | 'year' | 'start' | 'end' | 'elecUse' | 'elecCost' | 'gasUse' | 'gasCost' | 'ignore';
export type ElecUnit = 'kWh' | 'MWh';
export type GasUnit = 'therms' | 'CCF' | 'Mcf' | 'MMBtu' | 'Dth';

/**
 * Conversions to the model's units (kWh, therms). Gas volume uses 1,037 Btu per cubic foot, the EIA U.S. average heat content the
 * model already uses for prices (10.37 therms per Mcf; rates.json); a utility's own heat content can differ by a few percent.
 */
export const ELEC_UNITS: Record<ElecUnit, number> = { kWh: 1, MWh: 1000 };
export const GAS_UNITS: Record<GasUnit, number> = { therms: 1, CCF: 1.037, Mcf: 10.37, MMBtu: 10, Dth: 10 };

export interface ColumnMapping {
  columns: UtilityField[];
  /** Null = not known from the header; the user must choose before import (never assumed). */
  elecUnit: ElecUnit | null;
  gasUnit: GasUnit | null;
}

/** One row of the editor: text as typed (so a wrong entry can be shown and corrected), months 0–11 or null. */
export interface UtilityGridRow {
  month: number | null;
  start: string;
  end: string;
  elecKWh: string;
  elecCost: string;
  gasTherms: string;
  gasCost: string;
}

export const emptyGridRow = (month: number | null = null): UtilityGridRow => ({ month, start: '', end: '', elecKWh: '', elecCost: '', gasTherms: '', gasCost: '' });

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const monthIndex = (n: number) => (n >= 1 && n <= 12 ? n - 1 : null);

/** "Jan", "January", "2025-01", "01/2025", "1/15/2025", "1" → 0–11; null when it is not a month. */
export function parseMonth(s: string): number | null {
  const t = s.trim().toLowerCase();
  if (!t) return null;
  const name = MONTHS.findIndex((m) => t.startsWith(m));
  if (name >= 0) return name;
  const iso = /^(\d{4})[-/](\d{1,2})(?:[-/]\d{1,2})?(?:t.*)?$/.exec(t);
  if (iso) return monthIndex(Number(iso[2]));
  const us = /^(\d{1,2})[-/](\d{4})$/.exec(t) ?? /^(\d{1,2})[-/]\d{1,2}[-/](\d{4})$/.exec(t);
  if (us) return monthIndex(Number(us[1]));
  if (/^\d{1,2}$/.test(t)) return monthIndex(Number(t));
  return null;
}

/** "2025-01-15", "1/15/2025", "2025/01/15" → "2025-01-15"; anything else is returned trimmed (the validation step rejects it). */
export function normalizeDate(s: string): string {
  const t = s.trim();
  const iso = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[T ].*)?$/.exec(t);
  if (iso) return `${iso[1]}-${iso[2]!.padStart(2, '0')}-${iso[3]!.padStart(2, '0')}`;
  const us = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(t);
  if (us) return `${us[3]}-${us[1]!.padStart(2, '0')}-${us[2]!.padStart(2, '0')}`;
  return t;
}

/** Split CSV text into rows of cells (commas or semicolons, whichever the header uses; quoted cells may hold separators). */
export function parseCsvText(text: string): string[][] {
  const lines = text.replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim());
  if (!lines.length) return [];
  const head = lines[0]!;
  const sep = (head.match(/;/g)?.length ?? 0) > (head.match(/,/g)?.length ?? 0) ? ';' : head.includes('\t') && !head.includes(',') ? '\t' : ',';
  return lines.map((line) => {
    const out: string[] = [];
    let cur = '';
    let quoted = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]!;
      if (ch === '"') {
        if (quoted && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else quoted = !quoted;
      } else if (ch === sep && !quoted) {
        out.push(cur);
        cur = '';
      } else cur += ch;
    }
    out.push(cur);
    return out.map((c) => c.trim());
  });
}

const RULES: { field: UtilityField; re: RegExp }[] = [
  { field: 'start', re: /\b(start|from|begin|service from|read from)\b/ },
  { field: 'end', re: /\b(end|to|through|thru|service to|read to)\b/ },
  { field: 'year', re: /^(billing )?year$/ },
  { field: 'month', re: /\b(month|period|billing month)\b|^date$/ },
  { field: 'elecCost', re: /(electric|elec|power).*(cost|\$|usd|amount|charge|spend)|(cost|amount|charge).*(electric|elec)/ },
  { field: 'gasCost', re: /gas.*(cost|\$|usd|amount|charge|spend)|(cost|amount|charge).*gas/ },
  { field: 'elecUse', re: /\b(kwh|mwh)\b|(electric|elec|power)/ },
  { field: 'gasUse', re: /therm|\bccf\b|\bmcf\b|mmbtu|\bdth\b|gas/ },
];

function unitFrom(header: string, fuel: 'elec' | 'gas'): ElecUnit | GasUnit | null {
  const h = header.toLowerCase();
  if (fuel === 'elec') return /\bmwh\b/.test(h) ? 'MWh' : /\bkwh\b/.test(h) ? 'kWh' : null;
  if (/mmbtu/.test(h)) return 'MMBtu';
  if (/\bdth\b|dekatherm/.test(h)) return 'Dth';
  if (/\bmcf\b/.test(h)) return 'Mcf';
  if (/\bccf\b/.test(h)) return 'CCF';
  if (/therm/.test(h)) return 'therms';
  return null;
}

/**
 * Guess what each header names. A use column whose header gives no unit is mapped but its unit is left null, so the user picks it;
 * the same for any header nothing matched ("ignore"). `questions` says what needs a decision.
 */
export function guessMapping(header: readonly string[]): { mapping: ColumnMapping; questions: string[] } {
  const taken = new Set<UtilityField>();
  const columns: UtilityField[] = header.map((raw) => {
    const h = raw.trim().toLowerCase();
    const rule = RULES.find((r) => !taken.has(r.field) && r.re.test(h));
    if (!rule) return 'ignore';
    taken.add(rule.field);
    return rule.field;
  });
  const elecAt = columns.indexOf('elecUse');
  const gasAt = columns.indexOf('gasUse');
  const elecUnit = elecAt >= 0 ? (unitFrom(header[elecAt]!, 'elec') as ElecUnit | null) : 'kWh';
  const gasUnit = gasAt >= 0 ? (unitFrom(header[gasAt]!, 'gas') as GasUnit | null) : 'therms';
  const questions: string[] = [];
  if (!columns.includes('month') && !(columns.includes('start') && columns.includes('end'))) questions.push('Which column holds the month (or the billing start and end dates)?');
  if (elecAt < 0 && gasAt < 0) questions.push('Which column holds electricity or gas use?');
  if (elecAt >= 0 && elecUnit === null) questions.push(`In which unit is "${header[elecAt]}" (kWh or MWh)?`);
  if (gasAt >= 0 && gasUnit === null) questions.push(`In which unit is "${header[gasAt]}" (therms, CCF, Mcf, MMBtu or Dth)?`);
  const unmatched = header.filter((h, i) => columns[i] === 'ignore' && h.trim());
  if (unmatched.length) questions.push(`Not used unless you map them: ${unmatched.map((h) => `"${h}"`).join(', ')}.`);
  return { mapping: { columns, elecUnit, gasUnit }, questions };
}

/** Ready to import: a month or both dates, at least one use column, and a unit for every use column. */
export function mappingComplete(m: ColumnMapping): boolean {
  const has = (f: UtilityField) => m.columns.includes(f);
  return (has('month') || (has('start') && has('end'))) && (has('elecUse') || has('gasUse')) && (!has('elecUse') || m.elecUnit !== null) && (!has('gasUse') || m.gasUnit !== null);
}

const num = (s: string | undefined) => (s ?? '').replace(/[$,\s]/g, '').replace(/^\((.*)\)$/, '-$1');

/** Convert a use cell to the model's unit (text kept as typed when it is not a number, so the editor can flag it). */
function convert(s: string | undefined, factor: number): string {
  const t = num(s);
  if (!t) return '';
  const v = Number(t);
  if (!Number.isFinite(v)) return (s ?? '').trim();
  return factor === 1 ? t : String(Math.round(v * factor * 1000) / 1000);
}

/**
 * The table's data rows as editor rows, in the model's units. Rows that are entirely empty are skipped; a row that names a year other
 * than the most common one is kept (the validation step warns). Returns the most common billing year when there is a year column or
 * dates.
 */
export function tableToGrid(rows: readonly (readonly string[])[], mapping: ColumnMapping): { rows: UtilityGridRow[]; year: number | null } {
  const at = (f: UtilityField) => mapping.columns.indexOf(f);
  const ef = ELEC_UNITS[mapping.elecUnit ?? 'kWh'];
  const gf = GAS_UNITS[mapping.gasUnit ?? 'therms'];
  const out: UtilityGridRow[] = [];
  const years = new Map<number, number>();
  for (const r of rows) {
    if (!r.some((c) => c && c.trim())) continue;
    const get = (f: UtilityField) => (at(f) >= 0 ? (r[at(f)] ?? '').trim() : '');
    const start = get('start') ? normalizeDate(get('start')) : '';
    const end = get('end') ? normalizeDate(get('end')) : '';
    const monthText = get('month');
    const fromDate = /^\d{4}-\d{2}-\d{2}$/.test(start) ? Number(start.slice(5, 7)) - 1 : null;
    const month = monthText ? parseMonth(monthText) : fromDate;
    const y = Number(get('year')) || (/^(\d{4})/.exec(start)?.[1] ? Number(start.slice(0, 4)) : /^(\d{4})-\d{1,2}/.exec(monthText) ? Number(monthText.slice(0, 4)) : NaN);
    if (Number.isInteger(y) && y > 1900) years.set(y, (years.get(y) ?? 0) + 1);
    out.push({
      month,
      start,
      end,
      elecKWh: convert(get('elecUse'), ef),
      elecCost: num(get('elecCost')),
      gasTherms: convert(get('gasUse'), gf),
      gasCost: num(get('gasCost')),
    });
    // Keep the month text when it could not be read, so the user sees what was there.
    if (month === null && monthText) out[out.length - 1]!.start = out[out.length - 1]!.start || monthText;
  }
  const year = [...years.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0]?.[0] ?? null;
  return { rows: out, year };
}

/**
 * Compatibility helper: read a CSV of monthly bills straight into bills (the header must name units, or the default kWh / therms
 * apply only when the header says so). Problems are plain-language; rows with a problem are skipped. The app uses the mapping and
 * validation steps instead (src/utility).
 */
export function parseUtilityBillsCsv(text: string): { bills: import('./types').UtilityBillMonth[]; problems: string[] } {
  const table = parseCsvText(text);
  if (table.length < 2) return { bills: [], problems: ['The file needs a header row and at least one month.'] };
  const { mapping, questions } = guessMapping(table[0]!);
  if (!mapping.columns.includes('month') && !(mapping.columns.includes('start') && mapping.columns.includes('end'))) return { bills: [], problems: ['No month column found (name one "Month").'] };
  if (!mapping.columns.includes('elecUse') && !mapping.columns.includes('gasUse')) return { bills: [], problems: ['No electricity (kWh) or gas (therms) column found.'] };
  const problems = questions.filter((q) => q.startsWith('In which unit'));
  if (problems.length) return { bills: [], problems };
  const grid = tableToGrid(table.slice(1), mapping);
  const bills: import('./types').UtilityBillMonth[] = [];
  grid.rows.forEach((r, i) => {
    if (r.month === null) {
      problems.push(`Row ${i + 2}: "${r.start}" is not a month; skipped.`);
      return;
    }
    const b: import('./types').UtilityBillMonth = { month: r.month };
    for (const k of ['elecKWh', 'gasTherms', 'elecCost', 'gasCost'] as const) {
      if (!r[k]) continue;
      const v = Number(r[k]);
      if (!Number.isFinite(v) || (v < 0 && (k === 'elecKWh' || k === 'gasTherms'))) {
        problems.push(`Row ${i + 2}: "${r[k]}" is not a usable number; left out.`);
        continue;
      }
      b[k] = v;
    }
    bills.push(b);
  });
  const months = new Set(bills.map((b) => b.month));
  if (months.size < bills.length) problems.push('A month appears more than once; the last row for it was used.');
  const byMonth = new Map(bills.map((b) => [b.month, b]));
  return { bills: [...byMonth.values()].sort((a, b) => a.month - b.month), problems };
}
