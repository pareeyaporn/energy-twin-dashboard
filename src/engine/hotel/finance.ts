import { hotelData } from './data';
import type {
  FinancialAssumptions,
  FinancialBreakdown,
  FinancialMetrics,
  HotelData,
  HotelProfile,
  IncentiveLine,
  Range3,
  SolarDetails,
  UpgradeId,
  UpgradeSizing,
} from './types';

/**
 * Electricity and gas prices grow at the EIA Annual Energy Outlook 2026 nominal commercial rates (2025 to 2035); future savings are
 * discounted at a placeholder 3% a year (NPV only). Source in defaults.json `finance`.
 */
export const DEFAULT_FINANCE: Omit<FinancialAssumptions, 'horizonYears'> = {
  priceGrowth: hotelData.defaults.finance.elecPriceGrowth,
  gasPriceGrowth: hotelData.defaults.finance.gasPriceGrowth,
  discountRate: hotelData.defaults.finance.discountRate,
};

/** The two fixed comparison periods every upgrade is shown over, besides the hotel's own horizon. */
export const BENEFIT_YEARS = [5, 10] as const;

const SCENARIOS = ['low', 'mid', 'high'] as const;

export interface CostedItem {
  cost: number;
  lifetimeYears: number;
}

/**
 * What the savings stream depends on: first-year savings, the gas part of them (gas prices grow at their own rate; negative when an
 * upgrade adds gas use), the solar part (which also degrades) and the rates.
 */
export interface SavingsStream {
  firstYear: number;
  gasFirstYear?: number;
  solarFirstYear: number;
  degradationPerYear: number;
  /** Electricity price growth. */
  priceGrowth: number;
  gasPriceGrowth?: number;
}

/**
 * Savings in year t (t = 1 is the first year): electricity savings grow with electricity prices, gas savings with gas prices, and
 * the solar part of the electricity savings also falls with panel output.
 */
export function savingsInYear(s: SavingsStream, t: number): number {
  const gas = s.gasFirstYear ?? 0;
  const elec = s.firstYear - gas;
  const solar = Math.max(0, Math.min(s.solarFirstYear, elec));
  const ge = (1 + s.priceGrowth) ** (t - 1);
  const gg = (1 + (s.gasPriceGrowth ?? s.priceGrowth)) ** (t - 1);
  return ((elec - solar) + solar * (1 - s.degradationPerYear) ** (t - 1)) * ge + gas * gg;
}

/** Present value of the savings over N years at rate r, minus the net investment. */
export function npvOver(years: number, s: SavingsStream, netInvestment: number, r: number): number {
  let pv = 0;
  for (let t = 1; t <= years; t++) pv += savingsInYear(s, t) / (1 + r) ** t;
  return pv - netInvestment;
}

/** Sum of yearly savings over N years minus the net investment (nominal, no residual value). */
export function netBenefitOver(years: number, s: SavingsStream, netInvestment: number): number {
  let total = 0;
  for (let t = 1; t <= years; t++) total += savingsInYear(s, t);
  return total - netInvestment;
}

/**
 * Financial metrics at the mid scenario, from the net investment (gross cost minus applied incentives):
 *   netBenefit      = Σ_{t=1..H} savings(t) − net investment
 *   npv             = Σ_{t=1..H} savings(t) / (1+r)^t − net investment
 *   npvWithResidual = npv + Σ items cost × max(0, life − H) / life / (1+r)^H
 * savings(t) follows `savingsInYear`. The remaining budget compares the budget with the gross cost.
 */
export function calculateFinancialMetrics(
  input: {
    annualSavings: number;
    carbonAvoidedKgPerYear: number;
    items: readonly CostedItem[];
    budget: number;
    /** Applied incentives at the mid cost (0 if none). */
    incentivesTotal?: number;
    /** Solar part of the first-year savings and its yearly degradation (0 without solar). */
    solarValuePerYear?: number;
    degradationPerYear?: number;
    /** Gas part of the first-year savings (grows with gas prices). */
    gasSavingsPerYear?: number;
  },
  a: FinancialAssumptions,
): FinancialMetrics {
  const { priceGrowth: g, discountRate: r, horizonYears: H } = a;
  const cost = input.items.reduce((s, i) => s + i.cost, 0);
  const net = Math.max(0, cost - (input.incentivesTotal ?? 0));
  const stream: SavingsStream = {
    firstYear: input.annualSavings,
    gasFirstYear: input.gasSavingsPerYear ?? 0,
    solarFirstYear: input.solarValuePerYear ?? 0,
    degradationPerYear: input.degradationPerYear ?? 0,
    priceGrowth: g,
    gasPriceGrowth: a.gasPriceGrowth ?? g,
  };
  let pv = 0;
  for (let t = 1; t <= H; t++) pv += savingsInYear(stream, t) / (1 + r) ** t;
  const residual = input.items.reduce(
    (s, i) => s + (i.cost * Math.max(0, i.lifetimeYears - H)) / i.lifetimeYears / (1 + r) ** H,
    0,
  );
  const netBenefit = netBenefitOver(H, stream, net);
  return {
    cost,
    netInvestment: net,
    annualSavings: input.annualSavings,
    paybackYears: input.annualSavings > 0 ? net / input.annualSavings : null,
    netBenefit,
    npv: pv - net,
    npvWithResidual: pv - net + residual,
    roi: net > 0 ? netBenefit / net : null,
    horizonYears: H,
    carbonAvoidedKgPerYear: input.carbonAvoidedKgPerYear,
    carbonAvoidedKgHorizon: input.carbonAvoidedKgPerYear * H,
    remainingBudget: input.budget - cost,
  };
}

/** Incentive amounts a user has confirmed and entered, in dollars per upgrade. They replace program amounts for that upgrade. */
export type IncentiveOverrides = Partial<Record<UpgradeId, number>>;

/**
 * The incentive lines for a set of upgrades. A program counts only if the data marks it applied, verified and with a value;
 * otherwise it is listed as possible but not applied, with $0. A user-entered amount for an upgrade replaces its program amounts.
 * Amounts are per scenario so percent-of-cost incentives follow the cost range.
 */
export function incentiveLines(
  items: readonly { id: UpgradeId; cost: Range3 }[],
  p: HotelProfile,
  sizing: Pick<UpgradeSizing, 'solarKw'>,
  overrides: IncentiveOverrides = {},
  data: HotelData = hotelData,
): { lines: IncentiveLine[]; total: Range3 } {
  const lines: IncentiveLine[] = [];
  const total: Range3 = { low: 0, mid: 0, high: 0 };
  for (const item of items) {
    const user = overrides[item.id];
    const userSet = typeof user === 'number' && Number.isFinite(user) && user > 0;
    for (const prog of data.incentives.incentives) {
      if (!prog.appliesTo.includes(item.id)) continue;
      const usable = !userSet && prog.applied && prog.verified && prog.value !== null;
      const amountAt = (s: (typeof SCENARIOS)[number]): number => {
        if (!usable || prog.value === null) return 0;
        const v = prog.value;
        const raw =
          prog.kind === 'percent_of_cost' ? v * item.cost[s] : prog.kind === 'per_kw' ? v * sizing.solarKw : prog.kind === 'per_room' ? v * p.rooms : v;
        return Math.min(raw, item.cost[s]);
      };
      for (const s of SCENARIOS) total[s] += amountAt(s);
      lines.push({ id: `${item.id}:${prog.id}`, label: prog.label, amount: amountAt('mid'), applied: usable, origin: 'program', note: prog.note, source: prog.source });
    }
    if (userSet) {
      for (const s of SCENARIOS) total[s] += Math.min(user, item.cost[s]);
      lines.push({
        id: `${item.id}:user`,
        label: 'Incentive you entered',
        amount: Math.min(user, item.cost.mid),
        applied: true,
        origin: 'user',
        note: 'Entered by you; Energy Twin has not checked eligibility.',
        source: 'User input',
      });
    }
  }
  return { lines, total };
}

/** The common breakdown shown for every upgrade and package. */
export function financialBreakdown(input: {
  grossCost: Range3;
  incentives: { lines: IncentiveLine[]; total: Range3 };
  annualSavings: Range3;
  /** Solar part of the first-year savings in each scenario (0 without solar). */
  solarValue: Range3;
  /** Gas part of the first-year savings in each scenario. */
  gasValue: Range3;
  energy: { elecKWh: number; gasTherms: number; siteKBtu: number };
  carbonAvoidedKgPerYear: Range3;
  solar: SolarDetails | null;
  priceGrowth: number;
  gasPriceGrowth: number;
  discountRate: number;
}): FinancialBreakdown {
  const net: Range3 = {
    low: Math.max(0, input.grossCost.low - input.incentives.total.low),
    mid: Math.max(0, input.grossCost.mid - input.incentives.total.mid),
    high: Math.max(0, input.grossCost.high - input.incentives.total.high),
  };
  const d = input.solar?.degradationPerYear ?? 0;
  const stream = (s: (typeof SCENARIOS)[number]): SavingsStream => ({
    firstYear: input.annualSavings[s],
    gasFirstYear: input.gasValue[s],
    solarFirstYear: input.solarValue[s],
    degradationPerYear: d,
    priceGrowth: input.priceGrowth,
    gasPriceGrowth: input.gasPriceGrowth,
  });
  // Low pairs the low savings with the high net cost, high the reverse, so the range covers both uncertainties.
  const benefit = (years: number): Range3 => ({
    low: netBenefitOver(years, stream('low'), net.high),
    mid: netBenefitOver(years, stream('mid'), net.mid),
    high: netBenefitOver(years, stream('high'), net.low),
  });
  const r = input.discountRate;
  const npv = (years: number): Range3 => ({
    low: npvOver(years, stream('low'), net.high, r),
    mid: npvOver(years, stream('mid'), net.mid, r),
    high: npvOver(years, stream('high'), net.low, r),
  });
  const applied = input.incentives.lines.filter((l) => l.applied);
  const listed = input.incentives.lines.filter((l) => !l.applied);
  const assumptions = [
    `First-year savings use today's energy prices; electricity prices are assumed to rise ${round1(input.priceGrowth * 100)}% a year and gas ${round1(input.gasPriceGrowth * 100)}% a year (EIA Annual Energy Outlook 2026, commercial, nominal).`,
    applied.length
      ? `Incentives applied: ${applied.map((l) => l.label).join('; ')}.`
      : listed.length
        ? 'No incentives applied; possible programs are listed with each upgrade and are applied only once confirmed.'
        : 'No incentive programs are listed for this upgrade.',
    'Simple payback is the net investment divided by first-year savings.',
    `Net present value discounts future savings at ${round1(input.discountRate * 100)}% a year (a product decision; 3% is the alternative).`,
    input.solar
      ? 'Solar operation and maintenance is subtracted from the savings; inverter replacement and other upkeep are not included.'
      : 'Operation, maintenance and replacement costs are not included.',
    'The budget is compared with the gross cost, because most incentives arrive after installation.',
  ];
  if (input.solar) {
    assumptions.push(
      `Solar output falls ${round1(input.solar.degradationPerYear * 100)}% a year. ` +
        (input.solar.exportCreditPerKWh > 0
          ? `Exported energy is credited at $${input.solar.exportCreditPerKWh} per kWh.`
          : 'Exported energy is credited at $0 because the export credit has not been researched.'),
    );
  }
  return {
    grossCost: input.grossCost,
    incentives: input.incentives.lines,
    incentivesTotal: input.incentives.total.mid,
    netInvestment: net,
    annualEnergySavings: input.energy,
    annualSavings: input.annualSavings,
    simplePaybackYears: input.annualSavings.mid > 0 ? net.mid / input.annualSavings.mid : null,
    netBenefit5: benefit(BENEFIT_YEARS[0]),
    netBenefit10: benefit(BENEFIT_YEARS[1]),
    carbonAvoidedKgPerYear: input.carbonAvoidedKgPerYear,
    discountRate: r,
    npv5: npv(BENEFIT_YEARS[0]),
    npv10: npv(BENEFIT_YEARS[1]),
    solar: input.solar,
    assumptions,
  };
}

const round1 = (n: number) => Math.round(n * 10) / 10;
