import { describe, expect, it } from 'vitest';
import { calculateBaselineEnergy, equipmentInventory, presetProfile, simulatedMeter, typicalDayByZoneEndUse } from '@/engine/hotel';
import { systemOf, systemReading } from '../parts/equipmentSystems';

const demo = presetProfile('demo-chicago-100');
const result = calculateBaselineEnergy(demo);

describe('equipment systems', () => {
  it('maps every inventory item to a group and a modeled system', () => {
    for (const hvac of ['central_plant', 'ptac', 'pthp', 'vrf', 'rtu'] as const) {
      const items = equipmentInventory({ ...demo.profile, hvacType: hvac });
      for (const i of items) {
        const s = systemOf(i);
        expect(['hvac', 'water', 'lighting', 'other']).toContain(s.group);
        expect(s.endUses.length).toBeGreaterThan(0);
      }
    }
  });
  it('the zone-by-end-use day adds up to the meter, and readings follow the season', () => {
    for (const [m, h] of [[0, 6], [6, 15]] as const) {
      const day = typicalDayByZoneEndUse(result, m);
      const kW = Object.values(day).reduce((s, d) => s + (d.elecKW[h] ?? 0), 0);
      const usd = Object.values(day).reduce((s, d) => s + (d.costPerHour[h] ?? 0), 0);
      expect(kW).toBeCloseTo(simulatedMeter(result, m, h).kW, 6);
      expect(usd).toBeCloseTo(simulatedMeter(result, m, h).usdPerHour, 6);
    }
    const jan = systemReading(typicalDayByZoneEndUse(result, 0), result, 'central_hvac', ['heating'], 6);
    const jul = systemReading(typicalDayByZoneEndUse(result, 6), result, 'central_hvac', ['heating'], 6);
    expect(jan.kWNow).toBeGreaterThan(jul.kWNow);
    expect(jan.annualCost).toBeCloseTo(jul.annualCost, 9);
    const coolJul = systemReading(typicalDayByZoneEndUse(result, 6), result, 'central_hvac', ['cooling'], 15);
    expect(coolJul.status).toBe('running');
    expect(coolJul.kWNow).toBeLessThanOrEqual(coolJul.kWPeak + 1e-9);
  });
});
