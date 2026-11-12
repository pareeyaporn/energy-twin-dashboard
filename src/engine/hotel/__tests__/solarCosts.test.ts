import { describe, expect, it } from 'vitest';
import { evaluatePackage } from '../package';
import { hotelData } from '../data';
import { presetProfile, resolveProfile } from '../profile';
import { exportCreditPerKWh, solarCostPerW } from '../solar';
import { prepareUpgradeContext } from '../upgrades';

const demo = presetProfile('demo-chicago-100');
const p = demo.profile;
const input = hotelData.presets.find((x) => x.id === 'demo-chicago-100')!.input;

describe('solar installed price (LBNL 2024 national medians by size, non-residential)', () => {
  it('uses the size tier', () => {
    const cases: [number, number][] = [[5, 3.7], [10, 3.7], [13.8, 3.3], [27.5, 3.1], [55, 2.9], [150, 2.5], [400, 2.5], [800, 2.0], [1500, 1.7]];
    for (const [kw, mid] of cases) expect(solarCostPerW(kw, p).mid).toBe(mid);
    const t = solarCostPerW(55, p);
    expect(t.low).toBeLessThan(t.mid);
    expect(t.high).toBeGreaterThan(t.mid);
  });

  it('matches the three optimizer sizes for the demo hotel', () => {
    const ctx = prepareUpgradeContext(demo);
    const kw = (id: 'rooftop_solar_quarter' | 'rooftop_solar_half' | 'rooftop_solar') => evaluatePackage(ctx, [id], { lineItems: false }).financials.solar!;
    expect(kw('rooftop_solar_quarter').installedCostPerW).toBe(3.3);
    expect(kw('rooftop_solar_half').installedCostPerW).toBe(3.1);
    expect(kw('rooftop_solar').installedCostPerW).toBe(2.9);
  });

  it('can be overridden per hotel, keeping the tier spread, and rejects implausible values', () => {
    const custom = resolveProfile({ ...input, solarCostPerW: 2.4 }).profile;
    const t = solarCostPerW(55, custom);
    expect(t.mid).toBe(2.4);
    expect(t.low / t.mid).toBeCloseTo(0.85, 2); // tier low is stored to the cent
    const bad = resolveProfile({ ...input, solarCostPerW: 50 });
    expect(bad.profile.solarCostPerW).toBeUndefined();
    expect(bad.notes.some((n) => /Solar price per W/.test(n))).toBe(true);
  });
});

describe('solar export credit', () => {
  it('defaults to $0 (conservative fallback) and is configurable', () => {
    expect(exportCreditPerKWh(p)).toBe(0);
    const custom = resolveProfile({ ...input, solarExportCreditPerKWh: 0.05 }).profile;
    expect(exportCreditPerKWh(custom)).toBe(0.05);
    expect(resolveProfile({ ...input, solarExportCreditPerKWh: -1 }).profile.solarExportCreditPerKWh).toBeUndefined();
  });

  it('does not change the demo hotel’s results, because it uses all its solar on site', () => {
    const base = evaluatePackage(prepareUpgradeContext(demo), ['rooftop_solar'], { lineItems: false });
    expect(base.financials.solar!.exportedKWh).toBe(0);
    const credited = evaluatePackage(prepareUpgradeContext(resolveProfile({ ...input, solarExportCreditPerKWh: 0.05 })), ['rooftop_solar'], { lineItems: false });
    expect(credited.financials.annualSavings.mid).toBeCloseTo(base.financials.annualSavings.mid, 6);
  });
});
