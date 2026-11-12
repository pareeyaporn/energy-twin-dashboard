import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { calculateBaselineEnergy } from '../baseline';
import { optimizeInvestmentPortfolio } from '../optimizer';
import { presetProfile } from '../profile';
import { simulateEnergyScenario } from '../scenarios';
import {
  ADVISOR_SUGGESTED_QUESTIONS,
  advisorConfigFromEnv,
  askAdvisor,
  buildAdvisorContext,
  clearAdvisorCache,
  collectNumbers,
  extractNumbers,
  fallbackAnswer,
  parseBudgets,
  parseQuestion,
  validateAdvisorText,
} from '../advisor';
import type { AdvisorContext, AdvisorConfig } from '../advisor';
import type { Scenario } from '../types';

const hotel = presetProfile('demo-chicago-100');
const baseline = calculateBaselineEnergy(hotel);
const plan = optimizeInvestmentPortfolio(hotel, { budget: 50000 });

function input(scenario: Scenario = {}) {
  return {
    hotel,
    baseline,
    scenario,
    scenarioResult: Object.keys(scenario).length ? simulateEnergyScenario(hotel, scenario) : null,
    plan,
    syntheticDemo: true,
  };
}
const ctxFor = (q = '', scenario: Scenario = {}) => buildAdvisorContext(input(scenario), q);
const sentences = (t: string) => t.split(/(?<=[.!?])\s+(?=[A-Z])/);

describe('parseQuestion', () => {
  it('recognizes the demo questions', () => {
    expect(parseQuestion('Why is HVAC my biggest cost?').intent).toBe('hvac_cost');
    expect(parseQuestion('How does occupancy change my energy use?').intent).toBe('occupancy');
    expect(parseQuestion('Should I start with solar or smart thermostats?').intent).toBe('compare');
    expect(parseQuestion('Why recommend smart thermostats over solar?').intent).toBe('compare');
    expect(parseQuestion('How should I use $30,000?').intent).toBe('budget');
    expect(parseQuestion('What happens in a heat wave?').intent).toBe('scenario');
    expect(parseQuestion('How much does the kitchen cost me?').intent).toBe('zone_cost');
    expect(parseQuestion('hello there').intent).toBe('general');
  });

  it('finds the upgrades and zones named, in order', () => {
    expect(parseQuestion('Should I start with solar or smart thermostats?').upgrades).toEqual(['rooftop_solar', 'smart_room_controls']);
    expect(parseQuestion('LEDs vs occupancy sensors').upgrades).toEqual(['led_lighting', 'occupancy_sensors']);
    expect(parseQuestion('are occupancy sensors worth it').upgrades).toEqual(['occupancy_sensors']);
    expect(parseQuestion('How much does hot water cost').zones).toContain('hot_water');
  });

  it('reads budgets in several forms and ignores small amounts', () => {
    expect(parseBudgets('How should I use $30,000?')).toEqual([30000]);
    expect(parseBudgets('with 30k')).toEqual([30000]);
    expect(parseBudgets('I have $50,000 or maybe $75k')).toEqual([50000, 75000]);
    expect(parseBudgets('2 million dollars')).toEqual([2_000_000]);
    expect(parseBudgets('it costs $500 a month')).toEqual([]);
    expect(parseBudgets('no money mentioned')).toEqual([]);
  });

  it('exports the suggested questions', () => {
    expect(ADVISOR_SUGGESTED_QUESTIONS).toHaveLength(4);
  });
});

describe('buildAdvisorContext', () => {
  const ctx = ctxFor();

  it('holds the hotel, baseline, every upgrade, an occupancy example and the plan', () => {
    expect(ctx.hotel).toMatchObject({ name: 'Lakeshore Inn', rooms: 100, syntheticDemo: true });
    expect(ctx.baseline.annualCost).toBe(Math.round(baseline.annual.cost));
    expect(ctx.baseline.byCategory[0]!.label).toBe('HVAC');
    expect(ctx.baseline.byZone).toHaveLength(6);
    expect(ctx.upgrades).toHaveLength(8);
    expect(ctx.plan!.packages).toHaveLength(3);
    expect(ctx.plan!.budget).toBe(50000);
    expect(ctx.plan!.objectiveWinner).not.toBeNull();
    expect(ctx.occupancyExample.fromPct).toBe(60);
    expect(ctx.occupancyExample.toPct).toBe(85);
    expect(ctx.scenario).toBeNull();
    expect(ctx.upgradesMeasuredAgainst).toBe('baseline');
    expect(ctx.disclaimer).toMatch(/Not an engineering audit/);
  });

  it('rounds every number (no long decimals)', () => {
    for (const n of collectNumbers(ctx)) expect(Math.abs(n * 100 - Math.round(n * 100))).toBeLessThan(1e-6);
  });

  it('upgrade figures agree with the engine, and name the zones they help', () => {
    const led = ctx.upgrades.find((u) => u.id === 'led_lighting')!;
    expect(led.cost).toBe(33000);
    expect(led.zonesHelped).toContain('Guest rooms');
    expect(ctx.upgrades.find((u) => u.id === 'water_heating')!.zonesHelped).toContain('Hot water');
  });

  it('adds a plan for another budget named in the question, but not for the plan\'s own budget', () => {
    const c = ctxFor('How should I use $30,000?');
    expect(c.otherBudgets).toHaveLength(1);
    expect(c.otherBudgets[0]!.budget).toBe(30000);
    for (const p of c.otherBudgets[0]!.packages) expect(p.cost).toBeLessThanOrEqual(30000);
    expect(ctxFor('and with $50,000?').otherBudgets).toEqual([]);
  });

  it('describes an active what-if and measures upgrades against it', () => {
    const c = ctxFor('', { electricityRateChangePct: 20 });
    expect(c.scenario!.annualCostChange).toBeGreaterThan(0);
    expect(c.scenario!.description.join(' ')).toMatch(/Electricity price/);
    expect(c.scenario!.drivers.map((d) => d.label)).toContain('Energy prices');
    expect(c.upgradesMeasuredAgainst).toBe('scenario');
    const base = ctx.upgrades.find((u) => u.id === 'led_lighting')!;
    expect(c.upgrades.find((u) => u.id === 'led_lighting')!.annualSavings.mid).toBeGreaterThan(base.annualSavings.mid);
  });

  it('is small, deterministic and leaves its inputs alone', () => {
    expect(JSON.stringify(ctx).length).toBeLessThan(30000);
    const before = JSON.stringify(baseline.annual);
    expect(ctxFor('How should I use $30,000?')).toEqual(ctxFor('How should I use $30,000?'));
    expect(JSON.stringify(baseline.annual)).toBe(before);
  });

  it('omits the plan when none has been run', () => {
    expect(buildAdvisorContext({ ...input(), plan: null }).plan).toBeNull();
  });
});

describe('validateAdvisorText', () => {
  const ctx = { cost: 12159, pct: 8.6, payback: 3.3, tonnes: 33.1, budget: 50000, n: [2478, 140740] };

  it('extracts amounts, percents, years and abbreviations', () => {
    const t = extractNumbers('It saves $12,159 (8.6%) with a 3.3 years payback, about $12.2k or 1.2 million, 33 tonnes.');
    expect(t.map((x) => x.value)).toEqual([12159, 8.6, 3.3, 12200, 1_200_000, 33]);
    expect(t[0]!.dollar).toBe(true);
    expect(t[1]!.unit).toBe('%');
  });

  it('accepts numbers from the context, exactly or rounded the usual ways', () => {
    for (const text of [
      'You would save $12,159 a year.',
      'That is about $12,200 or $12,000 a year.',
      'Roughly $12.2k.',
      'It is 8.6% of the bill, or 9%.',
      'Payback is 3.3 years.',
      'Your budget of $50,000 and $2,478 for sensors.',
      'About 33 tonnes, 33.1 to be exact.',
      'There are 3 packages and 2 options.',
    ]) {
      expect(validateAdvisorText(text, ctx), text).toEqual({ ok: true, unmatched: [] });
    }
  });

  it('rejects numbers that are not in the context', () => {
    for (const [text, bad] of [
      ['You would save $13,000 a year.', '$13,000'],
      ['That is 42% of the bill.', '42%'],
      ['Payback is 7.7 years.', '7.7 years'],
      ['It costs $99,999.', '$99,999'],
      ['You would save $10,000 and 25 tonnes.', '$10,000'],
    ] as const) {
      const v = validateAdvisorText(text, ctx);
      expect(v.ok, text).toBe(false);
      expect(v.unmatched).toContain(bad);
    }
  });

  it('does not treat unit-less small counts as claims, but does check them with a unit', () => {
    expect(validateAdvisorText('Consider 3 options.', ctx).ok).toBe(true);
    expect(validateAdvisorText('Payback in 7 years.', ctx).ok).toBe(false);
    expect(validateAdvisorText('Savings of $7.', ctx).ok).toBe(false);
  });

  it('ignores digits in gas names and passes text with no numbers', () => {
    expect(validateAdvisorText('CO2e falls and CO2 too.', ctx).ok).toBe(true);
    expect(validateAdvisorText('No figures here.', ctx).ok).toBe(true);
  });

  it('searches nested context values', () => {
    expect(collectNumbers({ a: [1, { b: 2.5 }], c: 'x', d: null })).toEqual([1, 2.5]);
  });
});

describe('fallbackAnswer', () => {
  const QUESTIONS = [
    'Why is HVAC my biggest cost?',
    'How does occupancy change my energy use?',
    'Should I start with solar or smart thermostats?',
    'Why recommend smart thermostats over solar?',
    'How should I use $30,000?',
    'How should I use my budget?',
    'What happens in a heat wave?',
    'How much does the kitchen cost me?',
    'Tell me about my hotel',
  ];

  it('answers every demo question in three to seven sentences, with numbers the validator accepts', () => {
    for (const q of QUESTIONS) {
      const ctx = ctxFor(q);
      const text = fallbackAnswer(parseQuestion(q), ctx);
      const n = sentences(text).length;
      expect(n, q).toBeGreaterThanOrEqual(3);
      expect(n, q).toBeLessThanOrEqual(7);
      expect(validateAdvisorText(text, ctx), `${q}\n${text}`).toEqual({ ok: true, unmatched: [] });
      expect(text).toMatch(/planning estimates/);
      expect(text).toMatch(/synthetic demo/);
    }
  });

  it('compares the two upgrades with their own numbers and says which pays back faster', () => {
    const q = 'Should I start with solar or smart thermostats?';
    const ctx = ctxFor(q);
    const text = fallbackAnswer(parseQuestion(q), ctx);
    const solar = ctx.upgrades.find((u) => u.id === 'rooftop_solar')!;
    const smart = ctx.upgrades.find((u) => u.id === 'smart_room_controls')!;
    expect(text).toContain(solar.label);
    expect(text).toContain(smart.label);
    expect(text).toContain(`$${solar.cost.toLocaleString('en-US')}`);
    expect(text).toContain(`$${smart.cost.toLocaleString('en-US')}`);
    expect(text).toMatch(/pays back faster/);
    expect(text).toMatch(/does not fit/); // solar is far over a $50,000 budget
    // Labels inside a sentence start lower-case; "would cost" reads right for plural labels.
    // (checked without assuming which one wins, since the placeholder numbers will be recalibrated)
    expect(text).toMatch(/On these estimates, [a-z]/);
    expect(text).toMatch(/budget, [a-z][^.]* (fits|does not fit) and [a-z]/);
    expect(text).not.toMatch(/thermostats and occupancy sensing costs/);
  });

  it('uses the plan for the budget in the question', () => {
    const q = 'How should I use $30,000?';
    const ctx = ctxFor(q);
    const text = fallbackAnswer(parseQuestion(q), ctx);
    expect(text).toContain('$30,000');
    const plan30 = ctx.otherBudgets[0]!;
    expect(text).toContain(plan30.objectiveWinner!.name);
    expect(text).not.toContain('$50,000');
  });

  it('names HVAC as the largest category for the demo hotel', () => {
    const text = fallbackAnswer(parseQuestion('Why is HVAC my biggest cost?'), ctxFor());
    expect(text).toMatch(/your largest cost category/);
  });

  it('describes the what-if when there is one, and says there is none when there is not', () => {
    const q = 'What happens if electricity gets more expensive?';
    expect(fallbackAnswer(parseQuestion(q), ctxFor(q))).toMatch(/No what-if is active/);
    const c = ctxFor(q, { electricityRateChangePct: 20 });
    const text = fallbackAnswer(parseQuestion(q), c);
    expect(text).toMatch(/Electricity price changed 20%/);
    expect(text).toMatch(/raises your estimated yearly energy cost/);
    expect(validateAdvisorText(text, c).ok).toBe(true);
  });

  it('explains an empty plan instead of inventing one', () => {
    const empty = buildAdvisorContext({ ...input(), plan: optimizeInvestmentPortfolio(hotel, { budget: 5000 }) }, 'How should I use $5,000?');
    const text = fallbackAnswer(parseQuestion('How should I use $5,000?'), empty);
    expect(text).toMatch(/No combination fits/);
    expect(validateAdvisorText(text, empty).ok).toBe(true);
  });

  it('falls back to a general summary when the question names too little', () => {
    const q = 'smart thermostats';
    const text = fallbackAnswer(parseQuestion(q), ctxFor(q));
    expect(text).toMatch(/spends an estimated/);
  });
});

describe('askAdvisor', () => {
  const ctx: AdvisorContext = ctxFor('Why recommend smart thermostats over solar?');
  const q = 'Why recommend smart thermostats over solar?';
  const goodText = `Smart thermostats cost about $${ctx.upgrades.find((u) => u.id === 'smart_room_controls')!.cost.toLocaleString('en-US')} and fit your budget, while solar does not. These are estimates.`;

  const ok = (text: string) => new Response(JSON.stringify({ text }), { status: 200 });
  const err = (status: number, error: string) => new Response(JSON.stringify({ error }), { status });
  const config = (fetchFn: typeof fetch, extra: Partial<AdvisorConfig> = {}): AdvisorConfig => ({
    endpoint: 'https://example.test/functions/v1/advisor',
    headers: { authorization: 'Bearer public-key' },
    fetchFn,
    ...extra,
  });

  beforeEach(() => clearAdvisorCache());
  afterEach(() => vi.useRealTimers());

  it('returns the model answer when it passes the number check, and sends the question and context', async () => {
    const fetchFn = vi.fn(async () => ok(goodText));
    const a = await askAdvisor(q, ctx, config(fetchFn as unknown as typeof fetch));
    expect(a).toEqual({ text: goodText, source: 'ai' });
    expect(fetchFn).toHaveBeenCalledTimes(1);
    const [url, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://example.test/functions/v1/advisor');
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>)['authorization']).toBe('Bearer public-key');
    expect(JSON.parse(init.body as string)).toEqual({ question: q, context: JSON.parse(JSON.stringify(ctx)) });
  });

  it('caches AI answers per question and context', async () => {
    const fetchFn = vi.fn(async () => ok(goodText));
    const cfg = config(fetchFn as unknown as typeof fetch);
    await askAdvisor(q, ctx, cfg);
    const again = await askAdvisor(`  ${q.toUpperCase()}  `, ctx, cfg);
    expect(again.source).toBe('ai');
    expect(fetchFn).toHaveBeenCalledTimes(1);
    await askAdvisor(q, ctxFor(q, { occupancy: 0.9 }), cfg); // different context: asks again
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it('rejects an answer with an invented number and shows the template answer instead', async () => {
    const fetchFn = vi.fn(async () => ok('Thermostats would save you $88,888 a year, so buy them first.'));
    const a = await askAdvisor(q, ctx, config(fetchFn as unknown as typeof fetch));
    expect(a.source).toBe('fallback');
    expect(a.reason).toBe('rejected');
    expect(a.unmatched).toContain('$88,888');
    expect(a.text).not.toContain('88,888');
    expect(validateAdvisorText(a.text, ctx).ok).toBe(true);
  });

  it('uses the template answer without calling anything when the advisor is not set up', async () => {
    const fetchFn = vi.fn();
    const a = await askAdvisor(q, ctx, { endpoint: null, headers: {}, fetchFn: fetchFn as unknown as typeof fetch });
    expect(a).toMatchObject({ source: 'fallback', reason: 'not_configured' });
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('falls back on every failure and says why', async () => {
    const cases: [string, () => Promise<Response>, string][] = [
      ['key missing', async () => err(503, 'not_configured'), 'not_configured'],
      ['model refused', async () => err(502, 'refused'), 'refused'],
      ['server error', async () => err(500, 'boom'), 'error'],
      ['rate limited', async () => err(429, 'rate_limited'), 'error'],
      ['bad json', async () => new Response('<html>', { status: 200 }), 'error'],
      ['empty text', async () => ok('   '), 'error'],
      ['network down', async () => Promise.reject(new TypeError('failed to fetch')), 'error'],
    ];
    for (const [label, fn, reason] of cases) {
      const a = await askAdvisor(q, ctx, config(fn as unknown as typeof fetch));
      expect(a.source, label).toBe('fallback');
      expect(a.reason, label).toBe(reason);
      expect(a.text.length, label).toBeGreaterThan(50);
    }
  });

  it('reports offline when the browser is offline', async () => {
    const spy = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    const a = await askAdvisor(q, ctx, config((async () => Promise.reject(new TypeError('x'))) as unknown as typeof fetch));
    expect(a.reason).toBe('offline');
    spy.mockRestore();
  });

  it('gives up after six seconds and shows the template answer', async () => {
    vi.useFakeTimers();
    const fetchFn = vi.fn(
      (_url: string, init: RequestInit) =>
        new Promise<Response>((_res, rej) => {
          init.signal!.addEventListener('abort', () => rej(Object.assign(new Error('aborted'), { name: 'AbortError' })));
        }),
    );
    const p = askAdvisor(q, ctx, config(fetchFn as unknown as typeof fetch));
    await vi.advanceTimersByTimeAsync(5999);
    let settled = false;
    void p.then(() => (settled = true));
    await Promise.resolve();
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    const a = await p;
    expect(a).toMatchObject({ source: 'fallback', reason: 'timeout' });
  });

  it('does not cache failures, so a later try can succeed', async () => {
    let n = 0;
    const fetchFn = vi.fn(async () => (n++ === 0 ? err(500, 'boom') : ok(goodText)));
    const cfg = config(fetchFn as unknown as typeof fetch);
    expect((await askAdvisor(q, ctx, cfg)).source).toBe('fallback');
    expect((await askAdvisor(q, ctx, cfg)).source).toBe('ai');
  });
});

describe('advisorConfigFromEnv', () => {
  it('uses VITE_ADVISOR_URL first, then the Lovable Cloud project URL, else nothing', () => {
    expect(advisorConfigFromEnv({})).toEqual({ endpoint: null, headers: {} });
    expect(advisorConfigFromEnv({ VITE_ADVISOR_URL: 'https://a.test/x' }).endpoint).toBe('https://a.test/x');
    const c = advisorConfigFromEnv({ VITE_SUPABASE_URL: 'https://p.supabase.co/', VITE_SUPABASE_PUBLISHABLE_KEY: 'pk' });
    expect(c.endpoint).toBe('https://p.supabase.co/functions/v1/advisor');
    expect(c.headers).toEqual({ apikey: 'pk', authorization: 'Bearer pk' });
    expect(advisorConfigFromEnv({ VITE_SUPABASE_URL: 'https://p.supabase.co', VITE_ADVISOR_URL: 'https://a.test/x' }).endpoint).toBe('https://a.test/x');
  });
});
