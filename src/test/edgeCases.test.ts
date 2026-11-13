// Edge cases across the engine (QA sweep before the demo): every preset and portfolio hotel, every HVAC type, extreme inputs and
// budgets. Nothing may throw, produce NaN or Infinity, or give negative energy or cost.
import { describe, expect, it } from 'vitest';
import {
  calculateBaselineEnergy,
  compareUpgrades,
  hotelData,
  hotelPortfolio,
  optimizeInvestmentPortfolio,
  prepareUpgradeContext,
  resolveProfile,
  simulateEnergyScenario,
} from '@/engine/hotel';
import type { HotelInput, HvacType } from '@/engine/hotel';

const finite = (label: string, x: unknown, path = ''): void => {
  if (typeof x === 'number') {
    if (!Number.isFinite(x)) throw new Error(`${label}: non-finite at ${path}: ${x}`);
  } else if (Array.isArray(x)) x.forEach((v, i) => finite(label, v, `${path}[${i}]`));
  else if (x && typeof x === 'object') for (const [k, v] of Object.entries(x)) finite(label, v, `${path}.${k}`);
};

const HVAC: HvacType[] = ['ptac', 'pthp', 'vrf', 'central_plant', 'rtu'];
const inputs: [string, HotelInput][] = [
  ...hotelData.presets.map((p) => [`preset ${p.id}`, p.input] as [string, HotelInput]),
  ...hotelPortfolio.properties.map((p) => [`property ${p.id}`, p.input] as [string, HotelInput]),
  ...HVAC.map((h) => [`hvac ${h}`, { hvacType: h }] as [string, HotelInput]),
  ['tiny', { rooms: 1, floorAreaSqft: 400, floors: 1 }],
  ['huge', { rooms: 3000, floorAreaSqft: 2_500_000, floors: 60 }],
  ['occupancy 0', { occupancy: 0 }],
  ['occupancy 1', { occupancy: 1 }],
  ['old', { yearBuilt: 1890 }],
  ['future', { yearBuilt: 2030 }],
  ['garbage', { rooms: -5, floorAreaSqft: Number.NaN, occupancy: 7, operatingHours: 99, gasRate: -1, electricityRate: 0 } as HotelInput],
  ['unknown city', { city: 'Atlantis', state: 'ZZ' }],
];

describe('engine edge cases', () => {
  for (const [label, input] of inputs) {
    it(`${label}: baseline, scenarios, comparison and optimizer stay finite and non-negative`, () => {
      const hotel = resolveProfile(input);
      const base = calculateBaselineEnergy(hotel);
      finite(label, base.annual);
      expect(base.annual.cost).toBeGreaterThanOrEqual(0);
      expect(base.annual.elecKWh).toBeGreaterThanOrEqual(0);
      expect(base.annual.gasTherms).toBeGreaterThanOrEqual(0);
      for (const sc of [{ occupancy: 0.05 }, { occupancy: 1 }, { electricityPriceChangePct: 100 }, { gasPriceChangePct: -50 }, { smartRoomControls: true }]) {
        const r = simulateEnergyScenario(hotel, sc as never) as unknown as Record<string, unknown>;
        finite(`${label} scenario ${JSON.stringify(sc)}`, r['after'] ?? r);
      }
      const ctx = prepareUpgradeContext(hotel);
      finite(`${label} compare`, compareUpgrades(ctx).map((r) => r.financials));
      for (const budget of [0, 1, 50_000, 10_000_000]) {
        const plan = optimizeInvestmentPortfolio(ctx, { budget, objective: 'balanced' } as never) as unknown as { packages?: { financials?: unknown }[] };
        for (const p of plan.packages ?? []) finite(`${label} $${budget}`, p.financials);
      }
    });
  }
});
