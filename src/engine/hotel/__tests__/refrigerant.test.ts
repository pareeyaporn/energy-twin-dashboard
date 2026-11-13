import { describe, expect, it } from 'vitest';
import { calculateBaselineEnergy, energyFlows, energyFlowsAt, hotelData, presetProfile, refrigerantEmissions, resolveProfile, validateEquipment } from '..';

const demo = presetProfile('demo-chicago-100');
const withLeaks = (equipment: unknown[]) => resolveProfile({ ...hotelData.presets.find((p) => p.id === 'demo-chicago-100')!.input, equipment: equipment as never });

describe('refrigerant leaks', () => {
  it('is empty and changes nothing when nothing is entered', () => {
    expect(refrigerantEmissions(demo.profile).carbonKg).toBe(0);
    expect(energyFlows(calculateBaselineEnergy(demo)).nodes.some((n) => n.id === 'refrigerant')).toBe(false);
  });

  it('counts pounds × 0.4536 × GWP, records R-22 without counting it, and leaves energy unchanged', () => {
    const h = withLeaks([
      { id: 'chiller', refrigerant: { type: 'R-134a', lbsPerYear: 50 } },
      { id: 'kitchen-cold', refrigerant: { type: 'R-404A', lbsPerYear: 10 } },
    ]);
    const r = refrigerantEmissions(h.profile);
    expect(r.leaks).toHaveLength(2);
    expect(r.carbonKg).toBeCloseTo(50 * 0.45359237 * 1300 + 10 * 0.45359237 * 3943, 6);
    expect(r.leaks.find((l) => l.id === 'kitchen-cold')!.category).toBe('kitchen');
    expect(calculateBaselineEnergy(h).annual.carbonKg).toBeCloseTo(calculateBaselineEnergy(demo).annual.carbonKg, 6);
    const r22 = refrigerantEmissions(withLeaks([{ id: 'chiller', refrigerant: { type: 'R-22', lbsPerYear: 40 } }]).profile);
    expect(r22.leaks[0]!.counted).toBe(false);
    expect(r22.carbonKg).toBe(0);
  });

  it('rejects refrigerant on equipment without it, unknown types and bad amounts', () => {
    const { problems, overrides } = validateEquipment(
      [
        { id: 'dhw-heater', refrigerant: { type: 'R-410A', lbsPerYear: 5 } },
        { id: 'chiller', refrigerant: { type: 'R-999', lbsPerYear: 5 } },
        { id: 'kitchen-cold', refrigerant: { type: 'R-404A', lbsPerYear: -1 } },
      ],
      demo.profile,
    );
    expect(problems.filter((p) => p.field === 'refrigerant')).toHaveLength(3);
    expect(overrides.every((o) => o.refrigerant === undefined)).toBe(true);
  });

  it('adds a carbon-only source to the flows, conserved through zones, and spreads it evenly by hour', () => {
    const h = withLeaks([{ id: 'chiller', refrigerant: { type: 'R-410A', lbsPerYear: 30 } }]);
    const res = calculateBaselineEnergy(h);
    const leaks = refrigerantEmissions(h.profile).leaks;
    const g = energyFlows(res, leaks);
    const src = g.links.filter((l) => l.source === 'refrigerant');
    const kg = 30 * 0.45359237 * 1924;
    expect(src.reduce((a, l) => a + l.refrigerantCarbonKg, 0)).toBeCloseTo(kg, 6);
    expect(src.every((l) => l.costUsd === 0 && l.siteKBtu === 0)).toBe(true);
    const toCategories = g.links.filter((l) => l.target.startsWith('category:')).reduce((a, l) => a + l.refrigerantCarbonKg, 0);
    expect(toCategories).toBeCloseTo(kg, 6);
    const hr = energyFlowsAt(res, 6, 15, hotelData, leaks).links.filter((l) => l.source === 'refrigerant');
    expect(hr.reduce((a, l) => a + l.refrigerantCarbonKg, 0)).toBeCloseTo(kg / 8760, 6);
  });
});
