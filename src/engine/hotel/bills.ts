// Utility bills and calibration (13.35, docs/19). Pure functions: normalize bills, the bills' own rates, billing periods against the
// model's typical year, the bounded two-parameter fit per fuel, and ASHRAE Guideline 14 metrics.
import { DAYS_IN_MONTH, KBTU_PER_KWH, KBTU_PER_THERM } from './constants';
import type {
  BillComparison,
  CalibrationReport,
  EnergyResult,
  FitMetrics,
  FuelCalibration,
  FuelFactors,
  UtilityBillMonth,
  UtilityFuel,
} from './types';

export { parseUtilityBillsCsv, parseMonth } from './billsImport';

/** ASHRAE Guideline 14-2014 monthly calibration criteria. */
export const GUIDELINE_14_MONTHLY = { nmbePct: 5, cvrmsePct: 15, months: 12 } as const;

/**
 * Calibration rules (product decisions, docs/15 §24):
 * - FACTOR_BOUNDS: each multiplier stays within 0.5–2.0 of the modeled value. Hotel site intensities in a climate zone spread about this
 *   much around the benchmark (ComStock); a bill outside it more likely means a wrong input (floor area, systems, a missing meter).
 * - MIN_BILLS and MIN_COVERAGE_DAYS: Guideline 14 calibrates on 12 monthly values; fewer bills are compared but not used.
 * - Weather is fitted separately only when the model's weather part is at least 10% of the fuel over the billed days and varies by at
 *   least 25% (coefficient of variation of its daily rate) between bills; otherwise only the base is fitted and the weather part stays.
 * - A calibrated fuel is used only if its CV(RMSE) after the fit is at most 30% (twice the Guideline 14 limit) and the fit is not worse
 *   than the original model.
 */
export const CALIBRATION_RULES = {
  factorBounds: [0.5, 2] as [number, number],
  minBills: 12,
  minCoverageDays: 330,
  minWeatherShare: 0.1,
  minWeatherVariation: 0.25,
  maxCvrmsePct: 30,
} as const;

const pos = (x: unknown): number | undefined => (typeof x === 'number' && Number.isFinite(x) && x >= 0 ? x : undefined);
const finite = (x: unknown): number | undefined => (typeof x === 'number' && Number.isFinite(x) ? x : undefined);
const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;

/** A valid ISO date (YYYY-MM-DD) as a UTC timestamp, else null. */
export function isoDay(s: string | undefined): number | null {
  if (!s) return null;
  const m = ISO.exec(s);
  if (!m) return null;
  const t = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const d = new Date(t);
  return d.getUTCFullYear() === Number(m[1]) && d.getUTCMonth() === Number(m[2]) - 1 && d.getUTCDate() === Number(m[3]) ? t : null;
}
const DAY_MS = 86_400_000;

/**
 * The typical-year days a bill covers, as (month, days) pairs. A calendar-month bill covers its whole month. A billing period covers
 * its days from `start` (inclusive) to `end` (exclusive), each mapped to the same date of the model's typical year (29 February counts
 * as a February day). Periods longer than a year are not used.
 */
export function billDays(b: UtilityBillMonth): { month: number; days: number }[] {
  const s = isoDay(b.start);
  const e = isoDay(b.end);
  if (s === null || e === null) return Number.isInteger(b.month) && b.month >= 0 && b.month <= 11 ? [{ month: b.month, days: DAYS_IN_MONTH[b.month]! }] : [];
  const n = Math.round((e - s) / DAY_MS);
  if (n <= 0 || n > 366) return [];
  const per = new Array<number>(12).fill(0);
  for (let i = 0; i < n; i++) per[new Date(s + i * DAY_MS).getUTCMonth()]! += 1;
  return per.map((days, month) => ({ month, days })).filter((x) => x.days > 0);
}

/** The month a period mostly falls in (for display and sorting). */
export function periodMonth(start: string, end: string): number | null {
  const d = billDays({ month: 0, start, end });
  if (!d.length) return null;
  return [...d].sort((a, b) => b.days - a.days || a.month - b.month)[0]!.month;
}

/**
 * Keep usable bills: a month 0–11 or valid dates, non-negative use, finite cost (negative cost = an adjustment). Calendar-month bills
 * repeat a month only once (the last row wins); periods are kept in date order, and a period that overlaps an earlier kept one is
 * dropped (the validation step reports both, so this only guards the engine).
 */
export function normalizeBills(bills: readonly UtilityBillMonth[] | undefined): UtilityBillMonth[] {
  if (!Array.isArray(bills)) return [];
  const rows: UtilityBillMonth[] = [];
  for (const b of bills) {
    if (!b) continue;
    const hasPeriod = isoDay(b.start) !== null && isoDay(b.end) !== null;
    const month = hasPeriod ? periodMonth(b.start!, b.end!) : Number.isInteger(b.month) && b.month >= 0 && b.month <= 11 ? b.month : null;
    if (month === null || (hasPeriod && billDays(b).length === 0)) continue;
    const row: UtilityBillMonth = { month };
    if (hasPeriod) {
      row.start = b.start!;
      row.end = b.end!;
    }
    const e = pos(b.elecKWh);
    const g = pos(b.gasTherms);
    const ec = finite(b.elecCost);
    const gc = finite(b.gasCost);
    if (e !== undefined) row.elecKWh = e;
    if (g !== undefined) row.gasTherms = g;
    if (ec !== undefined) row.elecCost = ec;
    if (gc !== undefined) row.gasCost = gc;
    if (e === undefined && g === undefined && ec === undefined && gc === undefined) continue;
    rows.push(row);
  }
  const months = new Map<number, UtilityBillMonth>();
  const periods: UtilityBillMonth[] = [];
  for (const r of rows) (r.start ? periods.push(r) : months.set(r.month, r));
  periods.sort((a, b) => isoDay(a.start)! - isoDay(b.start)!);
  const kept: UtilityBillMonth[] = [];
  let lastEnd = -Infinity;
  for (const p of periods) {
    if (isoDay(p.start)! < lastEnd) continue;
    kept.push(p);
    lastEnd = isoDay(p.end)!;
  }
  return [...[...months.values()].sort((a, b) => a.month - b.month), ...kept];
}

/** Totals of use over the bills that report it. */
export function billTotals(bills: readonly UtilityBillMonth[]) {
  const elec = bills.filter((b) => b.elecKWh !== undefined);
  const gas = bills.filter((b) => b.gasTherms !== undefined);
  return {
    elecBills: elec.length,
    gasBills: gas.length,
    elecKWh: elec.reduce((s, b) => s + (b.elecKWh ?? 0), 0),
    gasTherms: gas.reduce((s, b) => s + (b.gasTherms ?? 0), 0),
    elecCost: bills.reduce((s, b) => s + (b.elecCost ?? 0), 0),
    gasCost: bills.reduce((s, b) => s + (b.gasCost ?? 0), 0),
  };
}

/**
 * The hotel's own average rates: total cost / total use over the bills that report both (all-in, like the EIA averages they can
 * replace). Null for a fuel without such bills or with zero use.
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

/** Days of the typical year covered by the bills of one fuel (a day billed twice counts once). */
export function coverageDays(bills: readonly UtilityBillMonth[], fuel: UtilityFuel): number {
  const covered = new Array<number>(12).fill(0);
  for (const b of bills) {
    if ((fuel === 'elec' ? b.elecKWh : b.gasTherms) === undefined) continue;
    for (const d of billDays(b)) covered[d.month] = Math.min(DAYS_IN_MONTH[d.month]!, covered[d.month]! + d.days);
  }
  return covered.reduce((s, x) => s + x, 0);
}

/** A fuel's modeled use per month, split into its weather-independent and weather-driven parts (kWh or therms). */
export function modeledParts(result: Pick<EnergyResult, 'cells'>, fuel: UtilityFuel): { base: number[]; weather: number[] } {
  const base = new Array<number>(12).fill(0);
  const weather = new Array<number>(12).fill(0);
  for (const c of result.cells) {
    if (c.siteKBtu <= 0) continue;
    const share = fuel === 'elec' ? (c.elecKWh * KBTU_PER_KWH) / c.siteKBtu : (c.gasTherms * KBTU_PER_THERM) / c.siteKBtu;
    if (share <= 0) continue;
    const unit = fuel === 'elec' ? KBTU_PER_KWH : KBTU_PER_THERM;
    base[c.month]! += ((c.loadKBtu.base + c.loadKBtu.occupancy + c.loadKBtu.schedule) * share) / unit;
    weather[c.month]! += (c.loadKBtu.weather * share) / unit;
  }
  return { base, weather };
}

/**
 * ASHRAE Guideline 14 metrics for bills y against model values ŷ, with p fitted parameters:
 *   NMBE = Σ(y − ŷ) / ((n − p) · ȳ) × 100        CV(RMSE) = √(Σ(y − ŷ)² / (n − p)) / ȳ × 100
 */
export function fitMetrics(actual: readonly number[], model: readonly number[], p: number): FitMetrics | null {
  const n = actual.length;
  if (n === 0 || n !== model.length) return null;
  const mean = actual.reduce((s, x) => s + x, 0) / n;
  if (mean <= 0) return null;
  const dof = Math.max(1, n - p);
  let bias = 0;
  let sq = 0;
  for (let i = 0; i < n; i++) {
    const d = actual[i]! - model[i]!;
    bias += d;
    sq += d * d;
  }
  const nmbePct = (bias / (dof * mean)) * 100;
  const cvrmsePct = (Math.sqrt(sq / dof) / mean) * 100;
  return {
    n,
    p,
    nmbePct,
    cvrmsePct,
    meetsGuideline14: n >= GUIDELINE_14_MONTHLY.months && Math.abs(nmbePct) <= GUIDELINE_14_MONTHLY.nmbePct && cvrmsePct <= GUIDELINE_14_MONTHLY.cvrmsePct,
  };
}

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));
const sse = (y: number[], B: number[], W: number[], a: number, b: number) => y.reduce((s, v, i) => s + (v - a * B[i]! - b * W[i]!) ** 2, 0);

/**
 * Bounded least squares for y ≈ a·B + b·W with a, b in [lo, hi]: the unconstrained solution if it is inside the box, otherwise the
 * best of the solutions on each edge (one factor at its bound, the other fitted and clamped). With `fitWeather` false, b = 1.
 */
export function fitFactors(y: number[], B: number[], W: number[], fitWeather: boolean, bounds = CALIBRATION_RULES.factorBounds): { a: number; b: number; atBound: boolean } {
  const [lo, hi] = bounds;
  const dot = (u: number[], v: number[]) => u.reduce((s, x, i) => s + x * v[i]!, 0);
  const BB = dot(B, B);
  const WW = dot(W, W);
  const BW = dot(B, W);
  const yB = dot(y, B);
  const yW = dot(y, W);
  const oneD = (num: number, den: number) => (den > 0 ? num / den : 1);
  if (!fitWeather) {
    // y − W ≈ a·B
    const raw = oneD(yB - BW, BB);
    const a = clamp(raw, lo, hi);
    return { a, b: 1, atBound: a !== raw };
  }
  const det = BB * WW - BW * BW;
  if (det > 1e-9 * BB * WW) {
    const a = (yB * WW - yW * BW) / det;
    const b = (yW * BB - yB * BW) / det;
    if (a >= lo && a <= hi && b >= lo && b <= hi) return { a, b, atBound: false };
  }
  const candidates: { a: number; b: number }[] = [];
  for (const a of [lo, hi]) candidates.push({ a, b: clamp(oneD(yW - a * BW, WW), lo, hi) });
  for (const b of [lo, hi]) candidates.push({ a: clamp(oneD(yB - b * BW, BB), lo, hi), b });
  const best = candidates.reduce((x, c) => (sse(y, B, W, c.a, c.b) < sse(y, B, W, x.a, x.b) ? c : x));
  return { ...best, atBound: true };
}

const UNITS: Record<UtilityFuel, 'kWh' | 'therms'> = { elec: 'kWh', gas: 'therms' };
const LABEL: Record<UtilityFuel, string> = { elec: 'electricity', gas: 'natural gas' };
const pick = (b: UtilityBillMonth, fuel: UtilityFuel) => (fuel === 'elec' ? b.elecKWh : b.gasTherms);

/** Calibrate one fuel to its bills (see CALIBRATION_RULES). `raw` is the uncalibrated model. */
export function calibrateFuel(raw: Pick<EnergyResult, 'cells'>, bills: readonly UtilityBillMonth[], fuel: UtilityFuel): FuelCalibration {
  const parts = modeledParts(raw, fuel);
  const rows: BillComparison[] = [];
  const B: number[] = [];
  const W: number[] = [];
  const y: number[] = [];
  const perDayW: number[] = [];
  bills.forEach((b, index) => {
    const v = pick(b, fuel);
    if (v === undefined) return;
    const days = billDays(b);
    if (!days.length) return;
    const n = days.reduce((s, d) => s + d.days, 0);
    const base = days.reduce((s, d) => s + (parts.base[d.month]! * d.days) / DAYS_IN_MONTH[d.month]!, 0);
    const weather = days.reduce((s, d) => s + (parts.weather[d.month]! * d.days) / DAYS_IN_MONTH[d.month]!, 0);
    B.push(base);
    W.push(weather);
    y.push(v);
    perDayW.push(weather / n);
    rows.push({ index, month: b.month, ...(b.start ? { start: b.start, end: b.end! } : {}), days: n, actual: v, modeled: base + weather, calibrated: base + weather });
  });
  const coverage = coverageDays(bills, fuel);
  const modeledTotal = B.reduce((s, x) => s + x, 0) + W.reduce((s, x) => s + x, 0);
  const actualTotal = y.reduce((s, x) => s + x, 0);
  const weatherShare = modeledTotal > 0 ? W.reduce((s, x) => s + x, 0) / modeledTotal : 0;
  const before = fitMetrics(y, rows.map((r) => r.modeled), 0);
  const none = (reason: string): FuelCalibration => ({
    fuel,
    unit: UNITS[fuel],
    mode: 'none',
    factors: { base: 1, weather: 1 },
    atBound: false,
    coverageDays: coverage,
    bills: rows.length,
    weatherShare,
    actualTotal,
    modeledTotal,
    calibratedTotal: modeledTotal,
    before,
    after: null,
    usable: false,
    reason,
    rows,
  });
  const R = CALIBRATION_RULES;
  if (rows.length === 0) return none(`No ${LABEL[fuel]} use in the bills.`);
  if (modeledTotal <= 0) return none(`The model has no ${LABEL[fuel]} use to calibrate.`);
  if (actualTotal <= 0) return none(`The ${LABEL[fuel]} bills are all zero; calibration needs use.`);
  if (rows.length < R.minBills || coverage < R.minCoverageDays) {
    return none(`Calibration needs 12 bills covering at least ${R.minCoverageDays} days of the year (Guideline 14); these ${LABEL[fuel]} bills are ${rows.length} covering ${coverage} days. They are compared with the model but not used.`);
  }
  const meanW = perDayW.reduce((s, x) => s + x, 0) / perDayW.length;
  const sdW = Math.sqrt(perDayW.reduce((s, x) => s + (x - meanW) ** 2, 0) / perDayW.length);
  const variation = meanW > 0 ? sdW / meanW : 0;
  const fitWeather = weatherShare >= R.minWeatherShare && variation >= R.minWeatherVariation;
  const { a, b, atBound } = fitFactors(y, B, W, fitWeather);
  for (let i = 0; i < rows.length; i++) rows[i]!.calibrated = a * B[i]! + b * W[i]!;
  const after = fitMetrics(y, rows.map((r) => r.calibrated), fitWeather ? 2 : 1);
  const factors: FuelFactors = { base: a, weather: b };
  const calibratedTotal = rows.reduce((s, r) => s + r.calibrated, 0);
  const notes: string[] = [];
  if (!fitWeather) notes.push(weatherShare < R.minWeatherShare ? `Little of the modeled ${LABEL[fuel]} follows the weather (${Math.round(weatherShare * 100)}%), so only the weather-independent part was fitted.` : `The modeled weather part changes too little between these bills to be fitted on its own, so only the weather-independent part was fitted.`);
  if (atBound) notes.push(`A factor stopped at its limit (${R.factorBounds[0]}–${R.factorBounds[1]}× the model); check the hotel's inputs (floor area, systems) and that every meter is included.`);
  const tooPoor = !after || after.cvrmsePct > R.maxCvrmsePct || (before !== null && after.cvrmsePct > before.cvrmsePct + 1e-9);
  if (tooPoor) {
    return {
      ...none(`The fit stays poor (CV(RMSE) ${after ? after.cvrmsePct.toFixed(1) : '—'}%, limit ${R.maxCvrmsePct}%), so the modeled ${LABEL[fuel]} is kept. ${notes.join(' ')}`.trim()),
      rows: rows.map((r) => ({ ...r, calibrated: r.modeled })),
    };
  }
  return {
    fuel,
    unit: UNITS[fuel],
    mode: fitWeather ? 'two_parameter' : 'base_only',
    factors,
    atBound,
    coverageDays: coverage,
    bills: rows.length,
    weatherShare,
    actualTotal,
    modeledTotal,
    calibratedTotal,
    before,
    after,
    usable: true,
    reason: notes.length ? notes.join(' ') : null,
    rows,
  };
}

/** Calibrate both fuels; the report also says why a fuel could not be calibrated. */
export function calibrationReport(raw: Pick<EnergyResult, 'cells'>, bills: readonly UtilityBillMonth[]): CalibrationReport {
  const elec = calibrateFuel(raw, bills, 'elec');
  const gas = calibrateFuel(raw, bills, 'gas');
  return { elec, gas, usable: elec.usable || gas.usable, weatherNormalNotActual: true };
}
