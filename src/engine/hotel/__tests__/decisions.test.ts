import { describe, expect, it } from 'vitest';
import { calculateBaselineEnergy } from '../baseline';
import { compareUpgrades } from '../comparison';
import { hotelData } from '../data';
import { DEFAULT_FINANCE, npvOver } from '../finance';
import { normalizedWeights, optimizeInvestmentPortfolio } from '../optimizer';
import { evaluatePackage } from '../package';
import { presetProfile, resolveProfile } from '../profile';
import { prepareUpgradeContext } from '../upgrades';
import type { HvacType } from '../types';

const demo = presetProfile('demo-chicago-100');
const close = (a: number, b: number, tol = 1e-9) => expect(Math.abs(a - b)).toBeLessThanOrEqual(tol * Math.max(1, Math.abs(b)));
const heatSite = (hvacType: HvacType) =>
  calculateBaselineEnergy(resolveProfile({ ...demo.profile, hvacType, monthlyEnergyBill: null } as never)).byEndUse.heating.siteKBtu;

describe('product decision: discount rate and NPV', () => {
  it('defaults to 8% with 3% as the alternative, and NPV uses the same savings stream', () => {
    expect(DEFAULT_FINANCE.discountRate).toBe(0.08);
    expect(hotelData.defaults.finance.discountRateAlternatives).toContain(0.03);
    const e = evaluatePackage(prepareUpgradeContext(demo), ['led_lighting'], { lineItems: false });
    const f = e.financials;
    expect(f.discountRate).toBe(0.08);
    // NPV is below the undiscounted net benefit, and a lower rate raises it
    expect(f.npv10!.mid).toBeLessThan(f.netBenefit10.mid);
    const at3 = evaluatePackage(prepareUpgradeContext(demo), ['led_lighting'], { lineItems: false, assumptions: { discountRate: 0.03 } }).financials;
    expect(at3.npv10!.mid).toBeGreaterThan(f.npv10!.mid);
    // payback and net benefit do not depend on the discount rate
    expect(at3.simplePaybackYears).toBe(f.simplePaybackYears);
    expect(at3.netBenefit10).toEqual(f.netBenefit10);
    expect(npvOver(1, { firstYear: 108, solarFirstYear: 0, degradationPerYear: 0, priceGrowth: 0 }, 100, 0.08)).toBeCloseTo(0, 9);
  });
});

describe('product decision: optimizer rules', () => {
  it('has no minimum savings share by default (any package that saves money can be recommended)', () => {
    const plan = optimizeInvestmentPortfolio(prepareUpgradeContext(demo), { budget: 50000 });
    expect(plan.minSavingsShare).toBe(0);
    for (const c of plan.candidates) expect(c.annualSavings).toBeGreaterThan(0);
  });

  it('normalizes the balanced weights and lets callers change them', () => {
    const w = normalizedWeights({ financial: 2, carbon: 1, comfort: 1 });
    close(w.financial + w.carbon + w.comfort, 1);
    close(w.financial, 0.5);
    expect(normalizedWeights({ financial: 0, carbon: 0, comfort: 0 })).toEqual({ financial: 1 / 3, carbon: 1 / 3, comfort: 1 / 3 });
    const ctx = prepareUpgradeContext(demo);
    const carbonFirst = optimizeInvestmentPortfolio(ctx, { budget: 100000, balancedWeights: { financial: 0, carbon: 1, comfort: 0 } });
    const best = Math.max(...carbonFirst.candidates.map((c) => c.carbonAvoidedKg));
    const top = [...carbonFirst.candidates].sort((a, b) => b.balancedScore - a.balancedScore)[0]!;
    expect(top.carbonAvoidedKg).toBe(best);
  });
});

describe('product decision: HVAC system types', () => {
  it('uses less site energy for heating with electric resistance and much less with a heat pump than with gas at 80%', () => {
    const gas = heatSite('central_plant');
    close(heatSite('ptac') / gas, 0.8 / 1.0, 0.03);
    close(heatSite('pthp') / gas, 0.8 / 2.3, 0.03);
  });

  it('heats PTAC and PTHP hotels with electricity and applies the matching lighting interaction', () => {
    for (const hvacType of ['ptac', 'pthp'] as const) {
      const b = calculateBaselineEnergy(resolveProfile({ ...demo.profile, hvacType } as never));
      expect(b.byEndUse.heating.gasTherms).toBe(0);
    }
    const added = (hvacType: HvacType) => {
      const ctx = prepareUpgradeContext(resolveProfile({ ...demo.profile, hvacType } as never));
      const before = ctx.baseline.byEndUse.heating.siteKBtu;
      return evaluatePackage(ctx, ['led_lighting'], { lineItems: false }).outcome.cells.filter((c) => c.endUse === 'heating').reduce((s, c) => s + c.siteKBtu, 0) - before;
    };
    // more heat added per kBtu of lighting saved with resistance (0.468) than with a heat pump (0.204)
    expect(added('ptac')).toBeGreaterThan(added('pthp'));
  });
});

describe('product decision: location-specific grid emissions', () => {
  it('uses the eGRID subregion for the city, lets the user set another, and falls back to the U.S. rate', () => {
    expect(demo.profile.gridSubregion).toBe('RFCW');
    expect(calculateBaselineEnergy(demo).emissionFactors.elecKgPerKWh).toBe(0.4155);
    const srmw = resolveProfile({ ...demo.profile, gridSubregion: 'SRMW' } as never);
    expect(calculateBaselineEnergy(srmw).emissionFactors.elecKgPerKWh).toBe(hotelData.emissions.subregions['SRMW']!.kgCO2ePerKWh);
    const bogus = resolveProfile({ ...demo.profile, gridSubregion: 'XXXX' } as never);
    expect(bogus.profile.gridSubregion).toBe('RFCW');
    expect(bogus.notes.join(' ')).toMatch(/not in the eGRID table/);
    const { gridSubregion: _ignored, ...rest } = demo.profile;
    const elsewhere = resolveProfile({ ...rest, city: 'Somewhere', state: 'ZZ' } as never);
    expect(elsewhere.profile.gridSubregion).toBe('US');
    expect(calculateBaselineEnergy(elsewhere).emissionFactors.elecKgPerKWh).toBe(hotelData.emissions.usKgCO2ePerKWh);
  });

  it('includes all 27 eGRID2023 subregions', () => {
    expect(Object.keys(hotelData.emissions.subregions)).toHaveLength(27);
  });
});

describe('comparison still covers every upgrade for each HVAC type', () => {
  it('evaluates without errors for each type', () => {
    for (const hvacType of ['ptac', 'pthp', 'vrf', 'central_plant', 'rtu'] as const) {
      const rows = compareUpgrades(prepareUpgradeContext(resolveProfile({ ...demo.profile, hvacType } as never)));
      expect(rows.length).toBeGreaterThan(5);
    }
  });
});

describe('product decision: scalable solar', () => {
  it('offers a quarter, half and full array, priced and sized in proportion, never two at once', () => {
    const ctx = prepareUpgradeContext(demo);
    const rows = compareUpgrades(ctx);
    const kw = (id: string) => rows.find((r) => r.id === id)!.financials.solar!.sizeKw;
    expect(Math.abs(kw('rooftop_solar_half') - kw('rooftop_solar') / 2)).toBeLessThanOrEqual(0.1); // sizes round to 0.1 kW
    expect(Math.abs(kw('rooftop_solar_quarter') - kw('rooftop_solar') / 4)).toBeLessThanOrEqual(0.1);
    const plan = optimizeInvestmentPortfolio(ctx, { budget: 50000 });
    // the full array ($154,000) cannot fit $50,000, but a quarter array can be evaluated
    expect(plan.candidates.some((c) => c.upgradeIds.includes('rooftop_solar_quarter'))).toBe(true);
    expect(plan.candidates.some((c) => c.upgradeIds.includes('rooftop_solar'))).toBe(false);
  });
});
