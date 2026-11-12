import { describe, expect, it } from 'vitest';
import { calculateBaselineEnergy } from '../baseline';
import { benchmarkComparison } from '../benchmark';
import { presetProfile } from '../profile';

describe('peer benchmark comparison', () => {
  it('reports the modeled site EUI and the difference from each sourced peer, without changing the model', () => {
    const demo = presetProfile('demo-chicago-100');
    const result = calculateBaselineEnergy(demo);
    const b = benchmarkComparison(result, demo.profile.floorAreaSqft);
    expect(b.siteEuiKBtuPerSqft).toBeCloseTo(result.annual.siteKBtu / demo.profile.floorAreaSqft, 9);
    expect(b.siteEuiKBtuPerSqft).toBeGreaterThan(80);
    expect(b.siteEuiKBtuPerSqft).toBeLessThan(100);
    const star = b.peers.find((p) => p.id === 'energy_star_hotel_median')!;
    expect(star.siteEuiKBtuPerSqft).toBe(63);
    expect(star.difference).toBeCloseTo(b.siteEuiKBtuPerSqft / 63 - 1, 9);
    for (const p of b.peers) expect(p.source.length).toBeGreaterThan(20);
    expect(calculateBaselineEnergy(demo).annual.siteKBtu).toBe(result.annual.siteKBtu);
  });
});
