import { describe, expect, it } from 'vitest';
import { calculateBaselineEnergy, energyFlows, energyFlowsAt, presetProfile, simulatedMeter } from '@/engine/hotel';
import { flowBands, pathKeys, sankeyLayout } from '../parts/sankey';

const result = calculateBaselineEnergy(presetProfile('demo-chicago-100'));
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

describe('flow graph with fuel split', () => {
  it('splits every link into electricity and gas parts that add up, and keeps annual totals', () => {
    const g = energyFlows(result);
    for (const l of g.links) {
      expect(l.elecCostUsd + l.gasCostUsd).toBeCloseTo(l.costUsd, 6);
      expect(l.elecKBtu + l.gasKBtu).toBeCloseTo(l.siteKBtu, 6);
    }
    const fromSources = sum(g.links.filter((l) => l.source === 'grid' || l.source === 'gas').map((l) => l.costUsd));
    expect(fromSources).toBeCloseTo(result.annual.cost, 4);
    expect(g.period).toBe('year');
  });

  it('gives hourly flows that add up to the simulated meter for that hour', () => {
    for (const [m, h] of [[0, 21], [6, 15], [3, 9]] as const) {
      const g = energyFlowsAt(result, m, h);
      const meter = simulatedMeter(result, m, h);
      const src = g.links.filter((l) => l.source === 'grid' || l.source === 'gas');
      expect(sum(src.map((l) => l.elecKWh))).toBeCloseTo(meter.kW, 6);
      expect(sum(src.map((l) => l.gasTherms))).toBeCloseTo(meter.thermsPerHour, 6);
      expect(sum(src.map((l) => l.costUsd))).toBeCloseTo(meter.usdPerHour, 6);
      expect(g.period).toBe('hour');
    }
  });
});

describe('carbon flows', () => {
  it('splits carbon by fuel, adds up to the annual carbon, and weighs gas more than its cost share', () => {
    const g = energyFlows(result);
    for (const l of g.links) expect(l.elecCarbonKg + l.gasCarbonKg).toBeCloseTo(l.carbonKg, 6);
    const src = g.links.filter((l) => l.source === 'grid' || l.source === 'gas');
    expect(sum(src.map((l) => l.carbonKg))).toBeCloseTo(result.annual.carbonKg, 3);
    const gasShare = (k: 'carbonKg' | 'costUsd') => sum(src.filter((l) => l.source === 'gas').map((l) => l[k])) / sum(src.map((l) => l[k]));
    expect(gasShare('carbonKg')).toBeGreaterThan(gasShare('costUsd'));
  });
});

describe('Sankey layout', () => {
  const g = energyFlows(result);
  for (const metric of ['cost', 'energy', 'carbon'] as const) {
    it(`conserves flow at every zone and fits the box (${metric})`, () => {
      const bands = flowBands(g, metric);
      const L = sankeyLayout(g, bands);
      for (const n of L.nodes.filter((x) => x.kind === 'zone')) {
        const inW = sum(L.bands.filter((b) => b.target === n.id).map((b) => b.w));
        const outW = sum(L.bands.filter((b) => b.source === n.id).map((b) => b.w));
        expect(inW).toBeCloseTo(outW, 6);
        expect(inW).toBeCloseTo(n.h, 6);
      }
      for (const n of L.nodes) {
        expect(n.y).toBeGreaterThanOrEqual(-1e-6);
        expect(n.y + n.h).toBeLessThanOrEqual(L.height + 1e-6);
      }
      expect(L.total).toBeCloseTo(sum(bands.filter((b) => b.source === 'grid' || b.source === 'gas').map((b) => b.value)), 6);
    });
  }
  it('highlights the whole path of a band, by fuel', () => {
    const bands = flowBands(g, 'cost');
    const keys = pathKeys(bands, 'grid>zone:central_hvac:elec');
    expect(keys.has('grid>zone:central_hvac:elec')).toBe(true);
    expect([...keys].some((k) => k.startsWith('zone:central_hvac>') && k.endsWith(':elec'))).toBe(true);
    expect([...keys].some((k) => k.endsWith(':gas'))).toBe(false);
    const back = pathKeys(bands, 'zone:hot_water>category:hotWater:gas');
    expect(back.has('gas>zone:hot_water:gas')).toBe(true);
    expect(pathKeys(bands, null).size).toBe(0);
  });
});
