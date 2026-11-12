import { describe, expect, it } from 'vitest';
import { hotelData } from '../data';
import { incentiveLines } from '../finance';
import { evaluatePackage } from '../package';
import { evaluatePlan } from '../plans';
import { presetProfile, resolveProfile } from '../profile';
import { prepareUpgradeContext } from '../upgrades';

const demo = presetProfile('demo-chicago-100');
const ctx = prepareUpgradeContext(demo);
const input = hotelData.presets.find((x) => x.id === 'demo-chicago-100')!.input;
const applied = (ids: Parameters<typeof evaluatePackage>[1], c = ctx) =>
  evaluatePackage(c, ids, { lineItems: false }).financials.incentives.filter((l) => l.applied);

describe('ComEd standard incentives (worksheets 2025 lighting, 2026 HVAC)', () => {
  it('pays LED at $0.75 per watt reduced and sensors at $0.25 per watt controlled, from the modeled lighting load', () => {
    // 100 rooms × 150 W + 16,500 ft² × 1.0 W = 31,500 W; LED mid reduction 45% → 14,175 W removed
    expect(applied(['led_lighting'])[0]!.amount).toBeCloseTo(0.75 * 31500 * 0.45, 6);
    // public areas and corridors: 30% of 55,000 ft² × 1.0 W
    expect(applied(['occupancy_sensors'])[0]!.amount).toBeCloseTo(0.25 * 16500, 6);
  });

  it('pays guest room energy management per ton, by how rooms are heated', () => {
    expect(applied(['smart_room_controls'])[0]!.amount).toBeCloseTo(75 * 100 * 0.75, 6); // gas heat, electric AC
    const ptac = prepareUpgradeContext(resolveProfile({ ...input, hvacType: 'ptac' }));
    const lines = applied(['smart_room_controls'], ptac);
    expect(lines).toHaveLength(1);
    expect(lines[0]!.amount).toBeCloseTo(100 * 100 * 0.75, 6); // electric heat
  });

  it('lists HVAC equipment and energy management incentives without applying them', () => {
    for (const id of ['hvac_upgrade', 'energy_management'] as const) {
      const f = evaluatePackage(ctx, [id], { lineItems: false }).financials;
      expect(f.incentivesTotal).toBe(0);
      expect(f.incentives.some((l) => !l.applied && /ComEd/.test(l.label))).toBe(true);
    }
  });

  it('scales with the share installed in a custom plan, and nets out of the investment', () => {
    const half = evaluatePlan(ctx, [{ id: 'smart_room_controls', quantity: 50 }]).evaluation!.financials;
    expect(half.incentivesTotal).toBeCloseTo(75 * 50 * 0.75, 6);
    expect(half.netInvestment.mid).toBeCloseTo(half.grossCost.mid - half.incentivesTotal, 6);
  });

  it('never pays more than 90% of the upgrade’s cost', () => {
    const r = incentiveLines([{ id: 'led_lighting', cost: { low: 1000, mid: 1000, high: 1000 } }], demo.profile, { solarKw: 0 });
    expect(r.total.mid).toBeCloseTo(900, 6);
  });
});
