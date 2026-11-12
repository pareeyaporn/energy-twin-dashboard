import { describe, expect, it } from 'vitest';
import { advisor, calculateBaselineEnergy, hotelPortfolio, optimizePortfolioBudget, portfolioSummary, presetProfile } from '..';

const items = hotelPortfolio.properties.map((property) => ({ property }));
const hotel = presetProfile('demo-chicago-100');
const baseline = calculateBaselineEnergy(hotel);
const base = { hotel, baseline, scenario: {}, scenarioResult: null, plan: null, syntheticDemo: true };
const portfolio = (withPlan: boolean) => ({
  organization: hotelPortfolio.name,
  summary: portfolioSummary(items),
  plan: withPlan ? optimizePortfolioBudget(items, { budget: 500_000 }) : null,
  openHotel: null,
  syntheticDemo: true,
});

describe('portfolio-aware advisor', () => {
  it('recognizes questions about the chain', () => {
    for (const q of ['Which hotel should we invest in first?', 'How should we split $500,000 across our hotels?', 'Which property uses the most energy?', 'Summarize the portfolio'])
      expect(advisor.parseQuestion(q).intent).toBe('portfolio');
    expect(advisor.parseQuestion('Why is HVAC my biggest cost?').intent).toBe('hvac_cost');
    expect(advisor.parseQuestion('How should I use $30,000?').intent).toBe('budget');
  });

  it('puts the chain in the context, ranked by priority, with the optimizer plan once it has run', () => {
    const c = advisor.buildAdvisorContext({ ...base, portfolio: portfolio(true) }, 'Which hotel first?');
    expect(c.portfolio!.hotels).toHaveLength(5);
    expect(c.portfolio!.hotels[0]!.priorityScore).toBe(100);
    expect(c.portfolio!.plan!.allocations).toHaveLength(5);
    expect(JSON.stringify(c).length).toBeLessThan(60_000);
    expect(advisor.buildAdvisorContext(base).portfolio).toBeNull();
  });

  it('answers from the portfolio figures only, and the answer passes the number check', () => {
    for (const withPlan of [false, true]) {
      const c = advisor.buildAdvisorContext({ ...base, portfolio: portfolio(withPlan) }, 'Which hotel should we invest in first?');
      const text = advisor.fallbackAnswer(advisor.parseQuestion('Which hotel should we invest in first?'), c);
      expect(text).toContain(c.portfolio!.hotels[0]!.name);
      expect(text).toMatch(/synthetic demonstration chain/);
      expect(text).toMatch(withPlan ? /portfolio optimizer spends/ : /Run the portfolio optimizer/);
      expect(advisor.validateAdvisorText(text, c).ok).toBe(true);
    }
  });

  it('falls back to the single-hotel answer when there is no portfolio in the context', () => {
    const c = advisor.buildAdvisorContext(base);
    const text = advisor.fallbackAnswer(advisor.parseQuestion('Which hotel should we invest in first?'), c);
    expect(text).toContain('Lakeshore Inn');
  });
});
