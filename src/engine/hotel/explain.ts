import type { PortfolioResult, RankedPackage } from './types';

const usd = (n: number) => `${n < 0 ? '-' : ''}$${Math.round(Math.abs(n)).toLocaleString('en-US')}`;
const range = (r: { low: number; high: number }) => `${usd(r.low)} to ${usd(r.high)}`;
const tonnes = (kg: number) => `${Math.round(kg / 100) / 10} tonnes`;

const OBJECTIVE_TEXT: Record<PortfolioResult['objective'], string> = {
  annual_savings: 'maximum yearly savings',
  payback: 'the fastest payback',
  roi: 'the highest return on investment',
  carbon: 'the largest carbon reduction',
  balanced: 'a balance of savings, carbon and guest comfort',
};

const payback = (p: RankedPackage) =>
  p.evaluation.metrics.paybackYears == null ? 'no payback' : `a payback of ${p.evaluation.metrics.paybackYears.toFixed(1)} years`;

/**
 * Fallback explanation of an optimizer result: 4 to 6 sentences built only from the numbers in the result. No AI and no new
 * numbers. Used when the advisor function fails or takes too long, and cached for the demo.
 */
export function explainPortfolio(result: PortfolioResult): string {
  const { packages, budget, combinationsTested, feasibleCount, baselineAnnualCost } = result;
  const intro =
    feasibleCount === 0
      ? `We tested ${combinationsTested} combinations of upgrades against a ${usd(budget)} budget and none of them fit.`
      : `We tested ${combinationsTested} combinations of upgrades against a ${usd(budget)} budget; ${feasibleCount} fit, and we ranked them by savings, payback and an overall balance.`;
  const limitation =
    'These are planning estimates from synthetic and public data, shown as ranges, not an engineering audit or a guarantee of savings.';

  const first = packages[0];
  if (!first) {
    return [intro, result.emptyReason ?? 'No package met the budget and comfort limits.', 'Try a larger budget or relax the comfort limit.', limitation].join(' ');
  }

  const sentences = [intro];
  const winner = result.objectiveWinner;
  if (winner) {
    const e = winner.evaluation;
    sentences.push(
      `For your goal of ${OBJECTIVE_TEXT[result.objective]}, the top choice is ${e.name}: about ${usd(e.cost.mid)} to install, saving about ${usd(e.annualSavings.mid)} a year (${range(e.annualSavings)}), with ${payback(winner)}, a five-year net benefit of ${usd(e.metrics.netBenefit)} and ${tonnes(e.carbonAvoidedKg.mid)} of CO2e avoided each year (estimated).`,
    );
    sentences.push(`That would leave ${usd(e.metrics.remainingBudget)} of the budget unspent, against a current energy bill of about ${usd(baselineAnnualCost)} a year.`);
  }
  const others = packages
    .filter((p) => p.evaluation.id !== winner?.evaluation.id)
    .map((p) => `${p.roleLabel.toLowerCase()}: ${p.evaluation.name} (${usd(p.evaluation.cost.mid)}, saving ${usd(p.evaluation.annualSavings.mid)} a year, ${payback(p)})`);
  if (others.length) sentences.push(`The other packages are ${others.join('; ')}.`);
  const risky = packages.filter((p) => p.budgetRisk);
  if (risky.length) sentences.push(`If costs come in at the high end, ${risky.map((p) => p.roleLabel.toLowerCase()).join(' and ')} could exceed the budget.`);
  sentences.push(limitation);
  return sentences.slice(0, 6).join(' ');
}
