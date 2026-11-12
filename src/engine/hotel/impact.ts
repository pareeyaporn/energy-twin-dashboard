// What changed between two simulations (reference vs new), and what kind of change a stress test is. Pure; no React.
import type { StressTest } from './scenarios';
import type { Totals } from './types';

export interface ImpactLine {
  id: 'elecKWh' | 'gasTherms' | 'cost' | 'carbonKg';
  label: string;
  unit: string;
  before: number;
  after: number;
  /** after − before */
  delta: number;
  /** delta / before; null when the reference is zero (a percentage would mean nothing). */
  pct: number | null;
}

const LINES: { id: ImpactLine['id']; label: string; unit: string }[] = [
  { id: 'elecKWh', label: 'Electricity', unit: 'kWh' },
  { id: 'gasTherms', label: 'Natural gas', unit: 'therms' },
  { id: 'cost', label: 'Energy cost', unit: 'USD' },
  { id: 'carbonKg', label: 'Carbon', unit: 'kg CO₂e' },
];

/** Electricity, gas, cost and carbon, before and after, with the change and the percentage change. */
export function impactSummary(before: Totals, after: Totals): ImpactLine[] {
  return LINES.map((l) => {
    const b = before[l.id];
    const a = after[l.id];
    return { ...l, before: b, after: a, delta: a - b, pct: Math.abs(b) > 1e-9 ? (a - b) / b : null };
  });
}

export type StressKind = 'temporary_event' | 'operational_scenario' | 'persistent_financial';

export const STRESS_KIND_LABEL: Record<StressKind, string> = {
  temporary_event: 'Temporary event',
  operational_scenario: 'Operational scenario',
  persistent_financial: 'Persistent financial assumption',
};

/**
 * How a stress test should be read. Weather events are temporary events; occupancy and equipment changes are operational scenarios
 * (temporary or persistent, as defined); price rises are persistent financial assumptions. Only persistent tests change payback and NPV.
 */
export function stressKind(test: Pick<StressTest, 'category' | 'duration'>): StressKind {
  if (test.category === 'financial') return 'persistent_financial';
  if (test.category === 'operations') return 'operational_scenario';
  return 'temporary_event';
}

/** The period the test's cost change covers: a temporary test's change is the total for the one event, not a yearly rate. */
export const stressPeriodText = (test: Pick<StressTest, 'duration'>) => (test.duration === 'temporary' ? 'in the year it happens (one-off, not annualized)' : 'per year, every year until it changes');
