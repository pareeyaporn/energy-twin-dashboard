import { describe, expect, it } from 'vitest';
import { calculateBaselineEnergy } from '../baseline';
import {
  billDays,
  billRates,
  calibrateFuel,
  calibrationReport,
  coverageDays,
  fitFactors,
  fitMetrics,
  modeledParts,
  normalizeBills,
  parseMonth,
  parseUtilityBillsCsv,
  CALIBRATION_RULES,
} from '../bills';
import { ELEC_UNITS, GAS_UNITS, guessMapping, mappingComplete, parseCsvText, tableToGrid } from '../billsImport';
import { recordsToGrid, validateGrid } from '../billsValidate';
import { SAMPLE_SHIFT, sampleUtilityBills } from '../billsSample';
import { presetProfile, resolveProfile } from '../profile';
import { evaluatePackage } from '../package';
import { prepareUpgradeContext } from '../upgrades';
import { simulateEnergyScenario } from '../scenarios';
import { hotelData } from '../data';
import type { UtilityBillMonth } from '../types';

const preset = hotelData.presets.find((p) => p.id === 'demo-chicago-100')!.input;
const hotel = presetProfile('demo-chicago-100');
const plain = calculateBaselineEnergy(hotel);
const eParts = modeledParts(plain, 'elec');
const gParts = modeledParts(plain, 'gas');

/** Bills built from the model with known base and weather multipliers per fuel. */
const billsAt = (e: [number, number], g: [number, number]): UtilityBillMonth[] =>
  Array.from({ length: 12 }, (_, m) => ({
    month: m,
    elecKWh: eParts.base[m]! * e[0] + eParts.weather[m]! * e[1],
    gasTherms: gParts.base[m]! * g[0] + gParts.weather[m]! * g[1],
  }));

describe('modeled parts', () => {
  it('split each fuel into weather-independent and weather-driven parts that add up to the model', () => {
    const sum = (xs: number[]) => xs.reduce((s, x) => s + x, 0);
    expect(sum(eParts.base) + sum(eParts.weather)).toBeCloseTo(plain.annual.elecKWh, 3);
    expect(sum(gParts.base) + sum(gParts.weather)).toBeCloseTo(plain.annual.gasTherms, 3);
    expect(sum(gParts.weather) / plain.annual.gasTherms).toBeGreaterThan(0.2); // gas heating follows the weather
  });
});

describe('calibration', () => {
  it('recovers known base and weather multipliers per fuel, and the calibrated baseline matches the bills', () => {
    const bills = billsAt([1.1, 0.8], [0.9, 1.3]);
    const r = calculateBaselineEnergy(resolveProfile({ ...preset, utilityBills: bills }));
    expect(r.calibration).toMatchObject({ source: 'bill', method: 'utility_bills', clamped: false });
    const f = r.calibration.fuelFactors!;
    expect(f.elec.base).toBeCloseTo(1.1, 6);
    expect(f.elec.weather).toBeCloseTo(0.8, 6);
    expect(f.gas.base).toBeCloseTo(0.9, 6);
    expect(f.gas.weather).toBeCloseTo(1.3, 6);
    const total = (k: 'elecKWh' | 'gasTherms') => bills.reduce((s, b) => s + b[k]!, 0);
    expect(r.annual.elecKWh).toBeCloseTo(total('elecKWh'), 2);
    expect(r.annual.gasTherms).toBeCloseTo(total('gasTherms'), 2);
    const rep = r.calibration.report!;
    expect(rep.elec.mode).toBe('two_parameter');
    expect(rep.elec.after!.meetsGuideline14).toBe(true);
    expect(rep.elec.before!.cvrmsePct).toBeGreaterThan(rep.elec.after!.cvrmsePct);
    expect(rep.weatherNormalNotActual).toBe(true);
    expect(r.estimated).toBe(false);
  });

  it('is not one constant: the weather part moves differently from the base, so the monthly shape changes', () => {
    const r = calculateBaselineEnergy(resolveProfile({ ...preset, utilityBills: billsAt([1, 1], [1, 1.4]) }));
    const ratio = r.months.map((m, i) => m.totals.gasTherms / plain.months[i]!.totals.gasTherms);
    expect(Math.max(...ratio) - Math.min(...ratio)).toBeGreaterThan(0.1); // winter rises more than summer
    expect(r.calibration.fuelFactors!.elec).toEqual({ base: expect.closeTo(1, 6), weather: expect.closeTo(1, 6) });
  });

  it('keeps the factors within bounds and flags it', () => {
    const r = calculateBaselineEnergy(resolveProfile({ ...preset, utilityBills: billsAt([3, 3], [1, 1]) }));
    expect(r.calibration.fuelFactors!.elec.base).toBeLessThanOrEqual(CALIBRATION_RULES.factorBounds[1]);
    expect(r.calibration.report!.elec.atBound || !r.calibration.report!.elec.usable).toBe(true);
    const f = fitFactors([10, 20], [1, 1], [1, 2], true);
    expect(f.a).toBeGreaterThanOrEqual(0.5);
    expect(f.b).toBeLessThanOrEqual(2);
    expect(f.atBound).toBe(true);
  });

  it('with fewer than 12 bills the fuel is compared but not calibrated (the modeled baseline stays)', () => {
    const r = calculateBaselineEnergy(resolveProfile({ ...preset, utilityBills: billsAt([1.3, 1.3], [1.3, 1.3]).slice(0, 6) }));
    expect(r.calibration.source).toBe('benchmark');
    expect(r.annual.cost).toBeCloseTo(plain.annual.cost, 6);
    const rep = r.calibration.report!;
    expect(rep.usable).toBe(false);
    expect(rep.elec.reason).toMatch(/12 bills/);
    expect(rep.elec.rows).toHaveLength(6);
    expect(rep.elec.before!.n).toBe(6);
  });

  it('fits only the base when the weather part barely varies (electricity-only weather share too small is handled the same way)', () => {
    const tiny = { cells: plain.cells.map((c) => ({ ...c, loadKBtu: { ...c.loadKBtu, weather: c.loadKBtu.weather * 0.01 } })) };
    const t = modeledParts(tiny, 'gas');
    const bills = Array.from({ length: 12 }, (_, m) => ({ month: m, gasTherms: t.base[m]! * 1.1 + t.weather[m]! }));
    const g = calibrateFuel(tiny, bills, 'gas');
    expect(g.mode).toBe('base_only');
    expect(g.factors.weather).toBe(1);
    expect(g.factors.base).toBeCloseTo(1.1, 6);
    expect(g.reason).toMatch(/only the weather-independent part/);
  });

  it('keeps the model when the fit stays poor', () => {
    const noisy = billsAt([1, 1], [1, 1]).map((b, m) => ({ month: m, gasTherms: m % 2 ? b.gasTherms! * 2.5 : b.gasTherms! * 0.3 }));
    const g = calibrationReport(plain, noisy).gas;
    expect(g.usable).toBe(false);
    expect(g.reason).toMatch(/fit stays poor/);
  });

  it('upgrades and scenarios are measured against the calibrated baseline (a correction is not a saving)', () => {
    const calibrated = resolveProfile({ ...preset, utilityBills: billsAt([1.2, 1.2], [0.8, 0.8]) });
    const ctx = prepareUpgradeContext(calibrated);
    expect(ctx.baseline.annual.elecKWh).toBeCloseTo(plain.annual.elecKWh * 1.2, 1);
    const led = evaluatePackage(ctx, ['led_lighting']).financials.annualSavings.mid;
    const ledPlain = evaluatePackage(prepareUpgradeContext(hotel), ['led_lighting']).financials.annualSavings.mid;
    expect(led).toBeGreaterThan(ledPlain);
    // A scenario keeps the calibration.
    const heat = simulateEnergyScenario(calibrated, { weatherOffsetF: 5 });
    expect(heat.before.annual.elecKWh).toBeCloseTo(ctx.baseline.annual.elecKWh, 3);
    expect(heat.after.calibration.fuelFactors).toEqual(ctx.baseline.calibration.fuelFactors);
  });

  it('without bills, the hotel and the demo are unchanged', () => {
    expect(calculateBaselineEnergy(resolveProfile({ ...preset })).annual.cost).toBeCloseTo(plain.annual.cost, 6);
    expect(calculateBaselineEnergy(resolveProfile({ ...preset, utilityBills: [] })).calibration.source).toBe('benchmark');
  });
});

describe('sample bills (synthetic)', () => {
  it('are derived from the model with the documented shift, and calibration finds it', () => {
    const s = sampleUtilityBills(hotel.profile, plain);
    expect(s).toHaveLength(12);
    const r = calibrationReport(plain, s);
    expect(r.elec.usable && r.gas.usable).toBe(true);
    expect(r.elec.factors.base).toBeCloseTo(SAMPLE_SHIFT.elec.base, 1);
    expect(r.elec.factors.weather).toBeCloseTo(SAMPLE_SHIFT.elec.weather, 1);
    expect(r.gas.factors.weather).toBeCloseTo(SAMPLE_SHIFT.gas.weather, 1);
    expect(r.elec.after!.meetsGuideline14).toBe(true);
    expect(s[0]!.elecCost).toBeCloseTo(s[0]!.elecKWh! * hotel.profile.electricityRate, 1);
  });
});

describe('billing periods', () => {
  it('cover their days of the typical year (start inclusive, end exclusive), split across months', () => {
    expect(billDays({ month: 0, start: '2025-01-15', end: '2025-02-14' })).toEqual([
      { month: 0, days: 17 },
      { month: 1, days: 13 },
    ]);
    expect(billDays({ month: 1, start: '2024-02-01', end: '2024-03-01' })).toEqual([{ month: 1, days: 29 }]);
    expect(billDays({ month: 3 })).toEqual([{ month: 3, days: 30 }]);
    expect(billDays({ month: 0, start: '2025-02-01', end: '2025-01-01' })).toEqual([]);
  });

  it('a 28-day bill is compared with 28 modeled days, not a whole month', () => {
    const b = { month: 0, start: '2025-01-01', end: '2025-01-29', elecKWh: 1000 };
    const g = calibrateFuel(plain, [b], 'elec');
    const jan = plain.months[0]!.totals.elecKWh;
    expect(g.rows[0]!.modeled).toBeCloseTo((jan * 28) / 31, 3);
  });

  it('periods that line up with a year calibrate like months', () => {
    const starts = ['2025-01-03', '2025-02-03', '2025-03-04', '2025-04-02', '2025-05-02', '2025-06-03', '2025-07-02', '2025-08-01', '2025-09-03', '2025-10-02', '2025-11-03', '2025-12-02', '2026-01-03'];
    const per = starts.slice(0, 12).map((s, i) => {
      const draft = { month: 0, start: s, end: starts[i + 1]! };
      const days = billDays(draft);
      const use = days.reduce((t, d) => t + ((eParts.base[d.month]! * 1.1 + eParts.weather[d.month]! * 0.9) * d.days) / [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][d.month]!, 0);
      return { ...draft, elecKWh: use };
    });
    expect(coverageDays(per, 'elec')).toBe(365);
    const e = calibrateFuel(plain, normalizeBills(per), 'elec');
    expect(e.usable).toBe(true);
    expect(e.factors.base).toBeCloseTo(1.1, 6);
    expect(e.factors.weather).toBeCloseTo(0.9, 6);
  });

  it('normalize drops an overlapping period and a repeated month (the editor reports both)', () => {
    const n = normalizeBills([
      { month: 0, elecKWh: 1 },
      { month: 0, elecKWh: 2 },
      { month: 0, start: '2025-03-01', end: '2025-04-01', gasTherms: 5 },
      { month: 0, start: '2025-03-15', end: '2025-04-15', gasTherms: 6 },
    ]);
    expect(n).toEqual([
      { month: 0, elecKWh: 2 },
      { month: 2, start: '2025-03-01', end: '2025-04-01', gasTherms: 5 },
    ]);
  });
});

describe('metrics', () => {
  it('follow ASHRAE Guideline 14 (NMBE and CV(RMSE) with n − p)', () => {
    const m = fitMetrics([100, 110, 90, 100], [95, 105, 95, 105], 1)!;
    // bias = 5 + 5 − 5 − 5 = 0; squares = 100; mean 100; dof 3
    expect(m.nmbePct).toBeCloseTo(0, 9);
    expect(m.cvrmsePct).toBeCloseTo((Math.sqrt(100 / 3) / 100) * 100, 9);
    expect(m.meetsGuideline14).toBe(false); // fewer than 12
    expect(fitMetrics([], [], 0)).toBeNull();
  });
});

describe('rates from bills', () => {
  const withCost = billsAt([1, 1], [1, 1]).map((b) => ({ ...b, elecCost: b.elecKWh! * 0.12, gasCost: b.gasTherms! * 0.8 }));
  it('are used only when asked and no rate is entered', () => {
    expect(resolveProfile({ ...preset, utilityBills: withCost }).profile.electricityRate).toBe(hotel.profile.electricityRate);
    const p = resolveProfile({ ...preset, utilityBills: withCost, useBillRates: true });
    expect(p.profile.electricityRate).toBeCloseTo(0.12, 9);
    expect(p.profile.gasRate).toBeCloseTo(0.8, 9);
    expect(p.notes.join(' ')).toMatch(/rate from your bills/);
    expect(resolveProfile({ ...preset, utilityBills: withCost, useBillRates: true, electricityRate: 0.2 }).profile.electricityRate).toBe(0.2);
    expect(billRates(normalizeBills([{ month: 0, elecKWh: 100 }])).elecPerKWh).toBeNull();
  });
});

describe('import', () => {
  it('maps columns by header and asks for a unit it cannot read', () => {
    const a = guessMapping(['Month', 'Electricity (kWh)', 'Electricity cost ($)', 'Natural gas (therms)', 'Gas cost ($)']);
    expect(a.mapping.columns).toEqual(['month', 'elecUse', 'elecCost', 'gasUse', 'gasCost']);
    expect(mappingComplete(a.mapping)).toBe(true);
    const b = guessMapping(['Billing month', 'Electricity', 'Gas use']);
    expect(b.mapping.elecUnit).toBeNull();
    expect(b.mapping.gasUnit).toBeNull();
    expect(mappingComplete(b.mapping)).toBe(false);
    expect(b.questions.join(' ')).toMatch(/kWh or MWh/);
    const c = guessMapping(['Start date', 'End date', 'Usage (MWh)', 'Gas (CCF)']);
    expect(c.mapping.columns).toEqual(['start', 'end', 'elecUse', 'gasUse']);
    expect([c.mapping.elecUnit, c.mapping.gasUnit]).toEqual(['MWh', 'CCF']);
  });

  it('converts units to kWh and therms', () => {
    expect(ELEC_UNITS.MWh).toBe(1000);
    expect(GAS_UNITS.Mcf).toBeCloseTo(10.37, 9);
    expect(GAS_UNITS.CCF).toBeCloseTo(1.037, 9);
    expect(GAS_UNITS.MMBtu).toBe(10);
    const t = parseCsvText('Start date,End date,Usage (MWh),Gas (Mcf)\n1/1/2025,2/1/2025,85.5,"1,000"');
    const g = tableToGrid(t.slice(1), guessMapping(t[0]!).mapping);
    expect(g.rows[0]).toMatchObject({ start: '2025-01-01', end: '2025-02-01', elecKWh: '85500', gasTherms: '10370', month: 0 });
    expect(g.year).toBe(2025);
  });

  it('reads a CSV in any column order (compatibility helper)', () => {
    const csv = ['Month,Electricity cost ($),Electricity (kWh),Gas (therms),Gas cost', 'Jan 2026,"$12,000",85000,"9,500","$8,800"', '2026-02,11500,80000,9000,8400', 'Smarch,1,1,1,1'].join('\n');
    const { bills, problems } = parseUtilityBillsCsv(csv);
    expect(bills).toEqual([
      { month: 0, elecKWh: 85000, gasTherms: 9500, elecCost: 12000, gasCost: 8800 },
      { month: 1, elecKWh: 80000, gasTherms: 9000, elecCost: 11500, gasCost: 8400 },
    ]);
    expect(problems).toHaveLength(1);
    expect(parseUtilityBillsCsv('kwh\n1').problems[0]).toMatch(/month column/);
    expect(parseUtilityBillsCsv('Month;Gas therms\nJanuary;100').bills).toEqual([{ month: 0, gasTherms: 100 }]);
  });

  it('reads months in common formats', () => {
    expect(['Jan', 'january', '2025-01', '01/2025', '1/15/2025', '1', '12', '2025-03-01T00:00:00.000Z'].map(parseMonth)).toEqual([0, 0, 0, 0, 0, 0, 11, 2]);
    expect(['13', 'x', ''].map(parseMonth)).toEqual([null, null, null]);
  });
});

describe('validation', () => {
  const grid = recordsToGrid(sampleUtilityBills(hotel.profile, plain), 'monthly');

  it('a complete sample year has no errors and can be applied', () => {
    const v = validateGrid(grid, 'monthly');
    expect(v.errors).toBe(0);
    expect(v.canApply).toBe(true);
    expect(v.records).toHaveLength(12);
    expect(v.coverage.elec).toEqual({ bills: 12, days: 365, complete: true });
  });

  it('blocks text in a number cell, negative use and a repeated month; warns on negative cost, zero use and outliers', () => {
    const g = grid.map((r) => ({ ...r }));
    g[0]!.elecKWh = 'abc';
    g[1]!.gasTherms = '-5';
    g[2]!.month = 3;
    g[4]!.elecCost = '-120';
    g[6]!.gasTherms = '0';
    g[8]!.elecKWh = String(Number(g[8]!.elecKWh) * 10);
    const v = validateGrid(g, 'monthly');
    const msgs = v.issues.map((x) => `${x.level}:${x.message}`).join('\n');
    expect(msgs).toMatch(/error:January: "abc" is not a number/);
    expect(msgs).toMatch(/error:February: use cannot be negative/);
    expect(msgs).toMatch(/error:April appears twice/);
    expect(msgs).toMatch(/warning:May: a negative cost/);
    expect(msgs).toMatch(/warning:July: zero gas use/);
    expect(msgs).toMatch(/warning:September: electricity use per day is more than 3×/);
    expect(v.canApply).toBe(false);
  });

  it('checks billing periods: invalid dates, end before start, duplicates and overlaps; incomplete history is a warning', () => {
    const row = (start: string, end: string, kwh = '1000') => ({ month: null, start, end, elecKWh: kwh, elecCost: '', gasTherms: '', gasCost: '' });
    const v = validateGrid([row('2025-01-01', '2025-02-01'), row('2025-01-01', '2025-02-01'), row('2025-01-20', '2025-02-20'), row('2025-13-01', '2025-14-01'), row('2025-05-10', '2025-05-01')], 'periods');
    const msgs = v.issues.map((x) => x.message).join('\n');
    expect(msgs).toMatch(/same billing period \(a duplicate\)/);
    expect(msgs).toMatch(/overlap/);
    expect(msgs).toMatch(/not a valid date/);
    expect(msgs).toMatch(/end date must be after/);
    const ok = validateGrid([row('2025-01-01', '2025-02-01')], 'periods');
    expect(ok.errors).toBe(0);
    expect(ok.issues.some((x) => x.level === 'warning' && /full year/.test(x.message))).toBe(true);
    expect(ok.canApply).toBe(true);
  });

  it('flags an implausible rate (a unit or column mix-up)', () => {
    const g = grid.map((r) => ({ ...r }));
    g[0]!.elecCost = String(Number(g[0]!.elecKWh) * 2);
    expect(validateGrid(g, 'monthly').issues.some((x) => /per kWh, outside/.test(x.message))).toBe(true);
  });
});
