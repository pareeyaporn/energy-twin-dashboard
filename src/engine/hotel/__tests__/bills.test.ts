import { describe, expect, it } from 'vitest';
import { calculateBaselineEnergy } from '../baseline';
import { billFit, billRates, normalizeBills, parseMonth, parseUtilityBillsCsv } from '../bills';
import { presetProfile, resolveProfile } from '../profile';
import { evaluatePackage } from '../package';
import { prepareUpgradeContext } from '../upgrades';
import { hotelData } from '../data';
import type { UtilityBillMonth } from '../types';

const preset = hotelData.presets.find((p) => p.id === 'demo-chicago-100')!.input;
const plain = calculateBaselineEnergy(presetProfile('demo-chicago-100'));

/** Bills shaped like the model's own months, at a different level per fuel (as a real hotel's would be). */
const billsAt = (kE: number, kG: number, withCost = false): UtilityBillMonth[] =>
  plain.months.map((m) => ({
    month: m.month,
    elecKWh: m.totals.elecKWh * kE,
    gasTherms: m.totals.gasTherms * kG,
    ...(withCost ? { elecCost: m.totals.elecKWh * kE * 0.12, gasCost: m.totals.gasTherms * kG * 0.8 } : {}),
  }));

describe('utility bills', () => {
  it('calibrate electricity and gas separately to the billed totals', () => {
    const r = calculateBaselineEnergy(resolveProfile({ ...preset, utilityBills: billsAt(1.2, 0.8) }));
    expect(r.calibration).toMatchObject({ source: 'bill', method: 'monthly_bills', clamped: false });
    expect(r.calibration.elecFactor).toBeCloseTo(1.2, 9);
    expect(r.calibration.gasFactor).toBeCloseTo(0.8, 9);
    expect(r.annual.elecKWh).toBeCloseTo(plain.annual.elecKWh * 1.2, 3);
    expect(r.annual.gasTherms).toBeCloseTo(plain.annual.gasTherms * 0.8, 3);
    // Same monthly shape as the model, so the fit meets ASHRAE Guideline 14's monthly criteria.
    expect(r.calibration.fit!.elec!.meetsGuideline14).toBe(true);
    expect(r.calibration.fit!.elec!.cvrmsePct).toBeLessThan(0.001);
    expect(r.estimated).toBe(false);
  });

  it('use the bills’ average rates unless a rate is entered, and say so', () => {
    const p = resolveProfile({ ...preset, utilityBills: billsAt(1, 1, true) });
    expect(p.profile.electricityRate).toBeCloseTo(0.12, 9);
    expect(p.profile.gasRate).toBeCloseTo(0.8, 9);
    expect(p.notes.join(' ')).toMatch(/rate from your bills/);
    const own = resolveProfile({ ...preset, electricityRate: 0.2, utilityBills: billsAt(1, 1, true) });
    expect(own.profile.electricityRate).toBe(0.2);
    expect(billRates(normalizeBills([{ month: 0, elecKWh: 100 }])).elecPerKWh).toBeNull();
  });

  it('keep the benchmark for a fuel the bills leave out, and clamp an implausible factor', () => {
    const elecOnly = calculateBaselineEnergy(resolveProfile({ ...preset, utilityBills: billsAt(1.1, 1).map(({ gasTherms: _g, ...b }) => b) }));
    expect(elecOnly.calibration.gasFactor).toBe(1);
    expect(elecOnly.annual.gasTherms).toBeCloseTo(plain.annual.gasTherms, 3);
    const wild = calculateBaselineEnergy(resolveProfile({ ...preset, utilityBills: billsAt(10, 1) }));
    expect(wild.calibration.elecFactor).toBe(2.5);
    expect(wild.calibration.clamped).toBe(true);
    expect(wild.estimated).toBe(true);
  });

  it('a few months calibrate on those months only and cannot meet the 12-month criteria', () => {
    const r = calculateBaselineEnergy(resolveProfile({ ...preset, utilityBills: billsAt(1.3, 1.3).filter((b) => b.month < 3) }));
    expect(r.calibration.elecFactor).toBeCloseTo(1.3, 9);
    expect(r.calibration.fit!.elec!.months).toBe(3);
    expect(r.calibration.fit!.elec!.meetsGuideline14).toBe(false);
  });

  it('a flat bill against a seasonal model fails the CV(RMSE) criterion (the fit is measured, not assumed)', () => {
    const total = plain.annual.gasTherms;
    const flat = plain.months.map((m) => ({ month: m.month, gasTherms: total / 12 }));
    const r = calculateBaselineEnergy(resolveProfile({ ...preset, utilityBills: flat }));
    expect(r.annual.gasTherms).toBeCloseTo(total, 3);
    expect(r.calibration.fit!.gas!.cvrmsePct).toBeGreaterThan(15);
    expect(r.calibration.fit!.gas!.meetsGuideline14).toBe(false);
    expect(billFit(r, normalizeBills(flat)).gas!.months).toBe(12);
  });

  it('upgrades are measured against the calibrated baseline (a correction is not a saving)', () => {
    const calibrated = resolveProfile({ ...preset, utilityBills: billsAt(1.2, 0.8) });
    const ctx = prepareUpgradeContext(calibrated);
    expect(ctx.baseline.annual.elecKWh).toBeCloseTo(plain.annual.elecKWh * 1.2, 3);
    const led = evaluatePackage(ctx, ['led_lighting']).financials.annualSavings.mid;
    const ledPlain = evaluatePackage(prepareUpgradeContext(presetProfile('demo-chicago-100')), ['led_lighting']).financials.annualSavings.mid;
    expect(led).toBeGreaterThan(ledPlain); // more electricity billed, more for LED to save
  });

  it('read a CSV in any column order, with $ and thousands separators, and report bad rows', () => {
    const csv = ['Month,Electricity cost ($),Electricity (kWh),Gas (therms),Gas cost', 'Jan 2026,"$12,000",85000,"9,500","$8,800"', '2026-02,11500,80000,9000,8400', 'Smarch,1,1,1,1', 'Mar,abc,70000,-5,'].join('\n');
    const { bills, problems } = parseUtilityBillsCsv(csv);
    expect(bills).toEqual([
      { month: 0, elecKWh: 85000, gasTherms: 9500, elecCost: 12000, gasCost: 8800 },
      { month: 1, elecKWh: 80000, gasTherms: 9000, elecCost: 11500, gasCost: 8400 },
      { month: 2, elecKWh: 70000 },
    ]);
    expect(problems).toHaveLength(3);
    expect(parseUtilityBillsCsv('kwh\n1').problems[0]).toMatch(/month column/);
    expect(parseUtilityBillsCsv('Month;Gas therms\nJanuary;100').bills).toEqual([{ month: 0, gasTherms: 100 }]);
  });

  it('read months in common formats', () => {
    expect(['Jan', 'january', '2025-01', '01/2025', '1/15/2025', '1', '12'].map(parseMonth)).toEqual([0, 0, 0, 0, 0, 0, 11]);
    expect(['13', 'x', ''].map(parseMonth)).toEqual([null, null, null]);
  });

  it('without bills, the hotel and the demo are unchanged', () => {
    expect(calculateBaselineEnergy(resolveProfile({ ...preset })).annual.cost).toBeCloseTo(plain.annual.cost, 6);
    expect(calculateBaselineEnergy(resolveProfile({ ...preset, utilityBills: [] })).calibration.source).toBe('benchmark');
  });
});
