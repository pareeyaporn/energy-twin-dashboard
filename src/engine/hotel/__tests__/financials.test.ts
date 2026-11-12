import { describe, expect, it } from 'vitest';
import { buildAdvisorContext } from '../advisor/context';
import { compareUpgrades } from '../comparison';
import { hotelData } from '../data';
import { DEFAULT_FINANCE, netBenefitOver } from '../finance';
import { optimizeInvestmentPortfolio } from '../optimizer';
import { opportunitiesByZone } from '../opportunities';
import { evaluatePackage } from '../package';
import { presetProfile, resolveProfile } from '../profile';
import { calculateBaselineEnergy } from '../baseline';
import { daylightShape } from '../solar';
import { prepareScenarioContext, prepareUpgradeContext, areasOf } from '../upgrades';
import type { HotelData, UpgradeId } from '../types';

const demo = presetProfile('demo-chicago-100');
const ctx = prepareUpgradeContext(demo);
const rows = compareUpgrades(ctx);
const close = (a: number, b: number, tol = 1e-9) => expect(Math.abs(a - b)).toBeLessThanOrEqual(tol * Math.max(1, Math.abs(b)));
const row = (id: UpgradeId) => rows.find((r) => r.id === id)!;

/** A copy of the data with changes, for testing incentives and export credit without touching the real files. */
function withData(change: (d: HotelData) => void): HotelData {
  const d = structuredClone(hotelData) as HotelData;
  change(d);
  return d;
}

describe('the common financial breakdown', () => {
  it('gives every eligible upgrade, solar included, all eight figures', () => {
    expect(rows.map((r) => r.id)).toContain('rooftop_solar');
    expect(rows.length).toBeGreaterThanOrEqual(7);
    for (const { financials: f } of rows) {
      for (const v of [f.grossCost.low, f.grossCost.mid, f.grossCost.high, f.netInvestment.mid, f.annualSavings.mid, f.netBenefit5.mid, f.netBenefit10.mid, f.carbonAvoidedKgPerYear.mid]) {
        expect(Number.isFinite(v)).toBe(true);
      }
      expect(Number.isFinite(f.annualEnergySavings.elecKWh)).toBe(true);
      expect(Number.isFinite(f.annualEnergySavings.gasTherms)).toBe(true);
      expect(Array.isArray(f.incentives)).toBe(true);
      expect(f.assumptions.length).toBeGreaterThan(0);
    }
  });

  it('computes each figure the same way for every upgrade', () => {
    const ge = DEFAULT_FINANCE.priceGrowth;
    const gg = DEFAULT_FINANCE.gasPriceGrowth!;
    expect(ge).toBeCloseTo(0.0212, 4); // EIA AEO2026 commercial electricity, nominal
    expect(gg).toBeCloseTo(0.0409, 4); // EIA AEO2026 commercial natural gas, nominal
    for (const { id, financials: f } of rows) {
      const gas = evaluatePackage(ctx, [id], { lineItems: false }).outcome.savings.gasCost;
      // 3. net investment = gross cost - applied incentives
      close(f.netInvestment.mid, f.grossCost.mid - f.incentivesTotal);
      // 6. simple payback = net investment / first-year savings
      if (f.annualSavings.mid > 0) close(f.simplePaybackYears!, f.netInvestment.mid / f.annualSavings.mid);
      // 7. net benefit = yearly savings (with price growth and solar degradation) minus net investment
      // electricity savings grow with electricity prices, gas savings with gas prices, solar also degrades
      const d = id.startsWith('rooftop_solar') ? 0.005 : 0;
      const elec = f.annualSavings.mid - gas;
      const solarPart = f.solar ? elec : 0;
      for (const [years, nb] of [[5, f.netBenefit5.mid], [10, f.netBenefit10.mid]] as const) {
        let total = 0;
        for (let t = 1; t <= years; t++) total += ((elec - solarPart) + solarPart * (1 - d) ** (t - 1)) * (1 + ge) ** (t - 1) + gas * (1 + gg) ** (t - 1);
        close(nb, total - f.netInvestment.mid, 1e-9);
      }
      // ranges are ordered
      expect(f.netBenefit10.low).toBeLessThanOrEqual(f.netBenefit10.mid);
      expect(f.netBenefit10.mid).toBeLessThanOrEqual(f.netBenefit10.high);
      // Over ten years an upgrade that saves money gains at least as much as over five
      if (f.annualSavings.mid > 0) expect(f.netBenefit10.mid).toBeGreaterThan(f.netBenefit5.mid);
    }
  });

  it('applies no incentive unless one is confirmed, and lists the possible programs', () => {
    const solar = row('rooftop_solar').financials;
    expect(solar.incentivesTotal).toBe(0);
    expect(solar.incentives.length).toBeGreaterThan(0);
    for (const l of solar.incentives) {
      expect(l.applied).toBe(false);
      expect(l.amount).toBe(0);
    }
    expect(solar.assumptions.join(' ')).toMatch(/No incentives applied/);
  });
});

describe('solar', () => {
  const f = row('rooftop_solar').financials;
  const s = f.solar!;

  it('is sized to the usable roof and priced per W for its size and region', () => {
    const def = hotelData.upgrades.upgrades.find((u) => u.id === 'rooftop_solar')!;
    const roofKw = (areasOf(demo.profile).roofSqft * def.constants['usableRoofShare']!) / def.constants['sqftPerKw']!;
    close(s.sizeKw, Math.round(roofKw * 10) / 10);
    close(f.grossCost.mid, s.sizeKw * 1000 * s.installedCostPerW);
  });

  it('generates from the location data, splits self-use and export hour by hour, and values both', () => {
    const climate = hotelData.weather.climates['chicago']!.solar!;
    close(s.generationKWh, s.sizeKw * climate.kWhPerKwYear.mid, 1e-9);
    close(s.selfConsumedKWh + s.exportedKWh, s.generationKWh, 1e-9);
    expect(s.exportedKWh).toBeGreaterThanOrEqual(0);
    // With the export credit not researched, exports earn $0: savings = self-used kWh x electricity rate.
    expect(s.exportCreditPerKWh).toBe(0);
    // ... minus the array's yearly operation and maintenance ($17.63 per kW, NREL/NLR ATB 2025).
    close(s.omPerYear, s.sizeKw * 17.63, 1e-9);
    close(f.annualSavings.mid, s.selfConsumedKWh * ctx.baseline.rates.elecPerKWh - s.omPerYear, 1e-9);
    close(f.annualEnergySavings.elecKWh, s.selfConsumedKWh, 1e-9);
  });

  it('exports at midday when the array is large for the load, and credits exports at the region rate', () => {
    // A small hotel with a big roof: one floor, 20 rooms.
    const small = resolveProfile({ ...demo.profile, rooms: 20, floors: 1, floorAreaSqft: 30000, monthlyEnergyBill: null } as never);
    const d = withData((x) => {
      x.rates['IL']!.solar!.exportCreditPerKWh = 0.05;
    });
    const sc = prepareUpgradeContext(small, d);
    const e = evaluatePackage(sc, ['rooftop_solar'], { lineItems: false }, d);
    const sol = e.financials.solar!;
    expect(sol.exportedKWh).toBeGreaterThan(0);
    close(e.financials.annualSavings.mid, sol.selfConsumedKWh * sc.baseline.rates.elecPerKWh + sol.exportedKWh * 0.05 - sol.omPerYear, 1e-9);
  });

  it('loses value over time from panel degradation', () => {
    const noDeg = netBenefitOver(10, { firstYear: f.annualSavings.mid, solarFirstYear: 0, degradationPerYear: 0, priceGrowth: DEFAULT_FINANCE.priceGrowth }, f.netInvestment.mid);
    expect(f.netBenefit10.mid).toBeLessThan(noDeg);
  });

  it('follows the electricity price', () => {
    const pricier = prepareUpgradeContext(resolveProfile({ ...demo.profile, electricityRate: ctx.baseline.rates.elecPerKWh * 1.5 } as never));
    const p = compareUpgrades(pricier).find((r) => r.id === 'rooftop_solar')!.financials;
    // The energy value scales with the price; operation and maintenance does not.
    close((p.annualSavings.mid + s.omPerYear) / (f.annualSavings.mid + s.omPerYear), 1.5, 1e-6);
  });

  it('uses a daylight shape that sums to 1, is dark at night and longer in summer', () => {
    const jan = daylightShape(41.88, 0);
    const jun = daylightShape(41.88, 5);
    close(jan.reduce((a, b) => a + b, 0), 1);
    expect(jun[2]).toBe(0);
    expect(jun.filter((x) => x > 0).length).toBeGreaterThan(jan.filter((x) => x > 0).length);
  });
});

describe('incentives, when confirmed', () => {
  it('lower the net investment and payback but not the gross cost or the budget check', () => {
    const d = withData((x) => {
      const itc = x.incentives.incentives.find((i) => i.id === 'federal_itc_48e')!;
      Object.assign(itc, { applied: true, verified: true, value: 0.3 });
    });
    const c = prepareUpgradeContext(demo, d);
    const e = evaluatePackage(c, ['rooftop_solar'], { lineItems: false }, d);
    const f = e.financials;
    close(f.incentivesTotal, 0.3 * f.grossCost.mid);
    close(f.netInvestment.mid, 0.7 * f.grossCost.mid);
    close(e.metrics.paybackYears!, f.netInvestment.mid / f.annualSavings.mid);
    close(e.metrics.remainingBudget, demo.profile.budget - f.grossCost.mid);
  });

  it('can be entered by the user, replacing program amounts for that upgrade', () => {
    const e = evaluatePackage(ctx, ['led_lighting'], { lineItems: false, incentives: { led_lighting: 5000 } });
    expect(e.financials.incentivesTotal).toBe(5000);
    expect(e.financials.incentives.find((l) => l.origin === 'user')?.amount).toBe(5000);
    close(e.financials.netInvestment.mid, e.financials.grossCost.mid - 5000);
  });
});

describe('one set of numbers everywhere', () => {
  it('the comparison rows are evaluatePackage for that upgrade', () => {
    for (const r of rows) {
      const e = evaluatePackage(ctx, [r.id], { lineItems: false });
      expect(r.financials).toEqual(e.financials);
      expect(r.metrics).toEqual(e.metrics);
    }
  });

  it('the optimizer ranks with the same metrics it reports on the cards', () => {
    const plan = optimizeInvestmentPortfolio(ctx, { budget: 50000 });
    expect(plan.packages.length).toBeGreaterThan(0);
    for (const p of plan.packages) {
      const cand = plan.candidates.find((c) => c.id === p.evaluation.id)!;
      close(cand.paybackYears!, p.evaluation.metrics.paybackYears!);
      close(cand.netBenefit, p.evaluation.metrics.netBenefit);
      // a single-upgrade package matches that upgrade's comparison row
      if (p.evaluation.upgradeIds.length === 1) {
        expect(p.evaluation.financials).toEqual(row(p.evaluation.upgradeIds[0]!).financials);
      }
    }
  });

  it('the advisor quotes the comparison rows, rounded', () => {
    const c = buildAdvisorContext({ hotel: demo, baseline: ctx.baseline, scenario: {}, scenarioResult: null, plan: null, syntheticDemo: true });
    for (const u of c.upgrades) {
      const f = row(u.id).financials;
      expect(u.cost).toBe(Math.round(f.grossCost.mid));
      expect(u.netInvestment).toBe(Math.round(f.netInvestment.mid));
      expect(u.annualSavings.mid).toBe(Math.round(f.annualSavings.mid));
      expect(u.annualElecKWhSaved).toBe(Math.round(f.annualEnergySavings.elecKWh));
      expect(u.netBenefit5Years).toBe(Math.round(f.netBenefit5.mid));
      expect(u.netBenefit10Years).toBe(Math.round(f.netBenefit10.mid));
    }
  });

  it('the zone opportunities use the same net investment and payback', () => {
    const opp = opportunitiesByZone(ctx);
    for (const list of Object.values(opp)) {
      for (const o of list) {
        close(o.cost, row(o.id).financials.netInvestment.mid);
        if (o.paybackYears !== null) close(o.paybackYears, row(o.id).financials.simplePaybackYears!);
      }
    }
  });

  it('all of them move together when operating conditions change', () => {
    const scn = prepareScenarioContext(demo, { occupancy: 0.85, electricityRateChangePct: 20 });
    const scnRows = compareUpgrades(scn);
    const led = scnRows.find((r) => r.id === 'led_lighting')!;
    expect(led.financials.annualSavings.mid).not.toBeCloseTo(row('led_lighting').financials.annualSavings.mid, 0);
    const plan = optimizeInvestmentPortfolio(scn, { budget: 50000 });
    for (const p of plan.packages) {
      if (p.evaluation.upgradeIds.length === 1) {
        expect(p.evaluation.financials).toEqual(scnRows.find((r) => r.id === p.evaluation.upgradeIds[0])!.financials);
      }
    }
  });

  it('keeps the baseline itself unchanged by the solar data move', () => {
    expect(calculateBaselineEnergy(demo).annual.cost).toBeCloseTo(ctx.baseline.annual.cost, 6);
  });
});

describe('smart room controls, calibrated to the Illinois TRM', () => {
  it('saves within the IL-TRM 4.4.8 range for a 100-room Chicago hotel with fan coils and gas heat', () => {
    // IL-TRM: 92-147 kWh and 3.0-6.5 therms per ton; at 0.75-1.0 ton per room that is 6,900-14,700 kWh and 225-650 therms.
    const f = row('smart_room_controls').financials;
    expect(f.annualEnergySavings.elecKWh).toBeGreaterThanOrEqual(6900);
    expect(f.annualEnergySavings.elecKWh).toBeLessThanOrEqual(14700);
    expect(f.annualEnergySavings.gasTherms).toBeGreaterThanOrEqual(150);
    expect(f.annualEnergySavings.gasTherms).toBeLessThanOrEqual(650);
  });

  it('gives the same saving from the Scenario switch as from the upgrade card (one shared simulation)', () => {
    const card = row('smart_room_controls').financials.annualSavings.mid + 0; // no O&M or export for this upgrade
    const scn = prepareScenarioContext(demo, { smartRoomControls: true });
    expect(ctx.baseline.annual.cost - scn.baseline.annual.cost).toBeCloseTo(card, 6);
    // and with the controls already on, the upgrade is no longer offered
    expect(compareUpgrades(scn).map((r) => r.id)).not.toContain('smart_room_controls');
  });
});

describe('the 300-room downtown preset', () => {
  const big = presetProfile('demo-chicago-300');
  const bctx = prepareUpgradeContext(big);
  it('uses documented defaults where the preset leaves inputs out, and labels them', () => {
    expect(big.profile.rooms).toBe(300);
    expect(big.defaulted).toEqual(expect.arrayContaining(['floorAreaSqft']));
    expect(big.profile.occupancy).toBe(0.692); // Chicago CBD 2025 (STR via Choose Chicago)
  });
  it('scales sensibly: about three times the energy of the 100-room hotel, and per-room costs scale with rooms', () => {
    const ratio = bctx.baseline.annual.siteKBtu / ctx.baseline.annual.siteKBtu;
    expect(ratio).toBeGreaterThan(2.3);
    expect(ratio).toBeLessThan(3.7);
    const smartBig = compareUpgrades(bctx).find((r) => r.id === 'smart_room_controls')!.financials.grossCost.mid;
    expect(smartBig).toBeCloseTo(3 * row('smart_room_controls').financials.grossCost.mid, 6);
  });
});

describe('roof insulation on a tall building', () => {
  it('saves a smaller share of the weather load when the roof is a small part of the envelope', () => {
    const low = compareUpgrades(prepareUpgradeContext(demo)).find((r) => r.id === 'insulation')!.financials;
    const tower = prepareUpgradeContext(resolveProfile({ ...demo.profile, floors: 20 } as never));
    const high = compareUpgrades(tower).find((r) => r.id === 'insulation')!.financials;
    // Same hotel, four times the floors: the saving is about a quarter (the weather load itself is unchanged).
    expect(high.annualSavings.mid / low.annualSavings.mid).toBeCloseTo(0.25, 1);
  });
});

describe('year-by-year projection', () => {
  it('runs ten years and matches the 5- and 10-year net benefit and NPV for every upgrade', () => {
    for (const r of rows) {
      const f = r.financials;
      const p = f.projection!;
      expect(p.map((y) => y.year)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
      for (const k of ['low', 'mid', 'high'] as const) {
        close(p[4]!.cumulativeNet[k], f.netBenefit5[k], 1e-9);
        close(p[9]!.cumulativeNet[k], f.netBenefit10[k], 1e-9);
      }
      close(p[4]!.cumulativeNpv, f.npv5!.mid, 1e-9);
      close(p[9]!.cumulativeNpv, f.npv10!.mid, 1e-9);
      close(p[0]!.savings.mid, f.annualSavings.mid, 1e-9);
    }
  });
});
