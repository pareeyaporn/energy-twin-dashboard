import type { Goal, OptimizerResult, Package } from './types';

const usd = (n: number) => `$${Math.round(Math.abs(n)).toLocaleString('en-US')}`;
const range = (r: { low: number; high: number }) => `${usd(r.low)}–${usd(r.high)}`;

const GOAL_TEXT: Record<Goal, string> = {
  max_savings: 'the biggest yearly savings',
  fastest_payback: 'the fastest payback',
  best_value: 'the best 15-year value',
};

const payback = (p: Package) =>
  p.paybackYears == null ? 'no payback' : `${p.paybackYears.toFixed(1)} years to pay back`;

/**
 * Fallback explanation: 4–6 sentences built only from the numbers in the result. No AI, no new numbers.
 * Used when the AI function fails or takes longer than 6 s, and cached for the demo.
 */
export function templateExplanation(result: OptimizerResult): string {
  const { top, baseline, goal, budget, combinationsTested, feasibleCount } = result;
  const intro = `We tested ${combinationsTested} combinations of upgrades for a budget of ${usd(budget)}; ${feasibleCount} fit, and we ranked them for ${GOAL_TEXT[goal]}.`;
  const limitation = baseline.estimated
    ? 'These are planning estimates from public data, shown as ranges, and some inputs were estimated because bills were missing; they are not a professional energy audit.'
    : 'These are planning estimates from public data, shown as ranges, not a professional energy audit.';

  const first = top[0];
  if (!first) {
    return [
      intro,
      `None of the combinations that fit the budget lowers your estimated bill of about ${usd(baseline.costs.total)} a year.`,
      'Try a larger budget or a different goal.',
      limitation,
    ].join(' ');
  }

  const sentences = [
    intro,
    `Package 1 (${first.name}) costs about ${usd(first.cost.mid)} (range ${range(first.cost)}) and should save about ${usd(first.annualSavings.mid)} a year (range ${range(first.annualSavings)}), with ${payback(first)}.`,
    `Your estimated yearly energy bill would go from about ${usd(baseline.costs.total)} to about ${usd(first.newAnnualCost)}.`,
  ];

  const others = top.slice(1).map((p, i) => {
    const dSave = p.annualSavings.mid - first.annualSavings.mid;
    const dCost = p.cost.mid - first.cost.mid;
    const save = dSave === 0 ? 'saves the same each year' : `saves ${usd(dSave)} a year ${dSave < 0 ? 'less' : 'more'}`;
    const cost = dCost === 0 ? 'costs the same' : `costs ${usd(dCost)} ${dCost < 0 ? 'less' : 'more'}`;
    return `Package ${i + 2} (${p.name}) ${save} and ${cost} than package 1`;
  });
  if (others.length) sentences.push(`What you give up by choosing another package: ${others.join('; ')}.`);

  sentences.push(limitation);
  return sentences.join(' ');
}
