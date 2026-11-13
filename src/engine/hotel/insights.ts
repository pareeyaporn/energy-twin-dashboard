// Energy insights: a short, prioritized list of what deserves the operator's attention, built only from the engine's own outputs
// (the baseline, the single-upgrade comparison, scenario runs and the benchmark). Pure and deterministic: no React, no network.
// Every threshold below is a product decision (docs/15 §22), not a sourced value; an insight whose data is missing is left out.
import { benchmarkComparison } from './benchmark';
import { hotelData } from './data';
import { STRESS_TESTS, simulateEnergyScenario, simulateOccupancyChange } from './scenarios';
import type { UpgradeComparisonRow } from './comparison';
import type { Category, EnergyResult, HotelData, ResolvedProfile } from './types';

export type InsightCategory = 'cost_reduction' | 'operational_efficiency' | 'equipment_performance' | 'energy_resilience' | 'investment_opportunity';
export type InsightAction =
  | { kind: 'invest'; label: string }
  | { kind: 'scenario'; label: string }
  | { kind: 'stress'; label: string; testId: (typeof STRESS_TESTS)[number]['id'] }
  | { kind: 'portfolio'; label: string }
  | { kind: 'equipment'; label: string };

export interface EnergyInsight {
  id: 'cost_driver' | 'intensity' | 'occupancy' | 'weather' | 'price' | 'equipment' | 'investment';
  title: string;
  /** One or two plain sentences; every number in them comes from the engine. */
  body: string;
  metric: { value: number; format: 'usd' | 'pct' | 'kbtu'; label: string };
  category: InsightCategory;
  priority: 'high' | 'medium';
  action: InsightAction;
  /** How the figure was calculated (shown on demand). */
  method: string;
}

export const INSIGHT_CATEGORY_LABEL: Record<InsightCategory, string> = {
  cost_reduction: 'Cost reduction',
  operational_efficiency: 'Operational efficiency',
  equipment_performance: 'Equipment performance',
  energy_resilience: 'Energy resilience',
  investment_opportunity: 'Investment opportunity',
};

/**
 * Thresholds (product decisions, docs/15 §22). Priority: a dollar finding is "high" when it is at least `highShare` of the bill (5%); the
 * cost driver is "high" at a third of the bill or more; intensity is "high" at 25% or more above the reference.
 */
export const INSIGHT_THRESHOLDS = {
  /** A use is a "major cost driver" when it is at least a quarter of the modeled bill. */
  costDriverShare: 0.25,
  /** Energy intensity is flagged when it is at least 10% above the ENERGY STAR hotel median or the median of the other hotels in the portfolio. */
  intensityAbove: 0.1,
  /** Occupancy test: +10 points (a busy season); flagged when the bill moves at least 2%. */
  occupancyStepPts: 0.1,
  occupancyShare: 0.02,
  /** A one-month weather event is flagged when it adds at least 1% to the year's bill. */
  weatherShare: 0.01,
  /** A 20% price rise is flagged when it adds at least 3% to the bill. */
  priceShare: 0.03,
  /** 10% worn HVAC equipment is flagged when it adds at least 1% to the bill. */
  equipmentShare: 0.01,
  /** At most this many insights are shown, and at most one per category. */
  max: 5,
  highShare: 0.05,
  costDriverHigh: 1 / 3,
  intensityHigh: 0.25,
} as const;

const CATEGORY_TEXT: Record<Category, string> = {
  hvac: 'heating, cooling and ventilation',
  lighting: 'lighting',
  hotWater: 'hot water',
  kitchen: 'the kitchen',
  equipment: 'plug loads and equipment',
  other: 'other uses (elevators, laundry, pools and miscellaneous)',
};

const usd = (n: number) => `$${Math.round(Math.abs(n)).toLocaleString('en-US')}`;
const pct = (share: number) => `${Math.round(share * 100)}%`;

export interface InsightInput {
  hotel: ResolvedProfile;
  /** The hotel's baseline (no what-if). */
  baseline: EnergyResult;
  /** Every eligible upgrade on its own, measured against `baseline` (compareUpgrades). */
  comparison: UpgradeComparisonRow[];
  /** Site energy intensity (kBtu/ft²) of the other hotels in the portfolio, for comparison; empty when there are none. */
  peers?: { name: string; siteEui: number }[];
  portfolioName?: string;
}

function median(xs: number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
}

const level = (value: number, high: number): EnergyInsight['priority'] => (value >= high ? 'high' : 'medium');

/**
 * The insights for one hotel, most actionable first: an investment opportunity, the biggest cost driver, energy intensity, price
 * exposure, equipment condition, weather and occupancy. At most `INSIGHT_THRESHOLDS.max`.
 */
export function energyInsights(input: InsightInput, data: HotelData = hotelData): EnergyInsight[] {
  const { hotel, baseline, comparison } = input;
  const p = hotel.profile;
  const T = INSIGHT_THRESHOLDS;
  const bill = baseline.annual.cost;
  if (!(bill > 0)) return [];
  const out: EnergyInsight[] = [];

  // 1. Investment opportunity: single upgrades that fit the budget, pay back within their life and gain over 10 years.
  const good = comparison.filter(
    (r) =>
      r.financials.grossCost.mid <= p.budget &&
      r.financials.simplePaybackYears !== null &&
      r.financials.simplePaybackYears <= r.lifetimeYears &&
      r.financials.netBenefit10.mid > 0,
  );
  const best = [...good].sort((a, b) => b.financials.netBenefit10.mid - a.financials.netBenefit10.mid)[0];
  if (best) {
    const f = best.financials;
    out.push({
      id: 'investment',
      title: good.length > 1 ? `${good.length} upgrades fit your budget and pay back` : 'An upgrade fits your budget and pays back',
      body: `${best.label} would save about ${usd(f.annualSavings.mid)} a year for ${usd(f.netInvestment.mid)}${f.incentivesTotal > 0 ? ' after counted incentives' : ''}, paying back in about ${f.simplePaybackYears!.toFixed(1)} years. The optimizer can combine upgrades within your ${usd(p.budget)} budget.`,
      metric: { value: f.annualSavings.mid, format: 'usd', label: 'a year saved by the best single upgrade' },
      category: 'investment_opportunity',
      priority: level(f.annualSavings.mid / bill, T.highShare),
      action: { kind: 'invest', label: 'Find the best investments' },
      method: `Each eligible upgrade evaluated on its own against today's baseline (the same calculation as Compare all upgrades). Counted when its installed cost fits the ${usd(p.budget)} budget, it pays back within its expected life and its 10-year net benefit is positive. Estimates.`,
    });
  }

  // 2. The biggest cost driver.
  const cats = (Object.entries(baseline.byCategory) as [Category, { cost: number }][]).sort((a, b) => b[1].cost - a[1].cost);
  const top = cats[0];
  if (top && top[1].cost / bill >= T.costDriverShare) {
    const share = top[1].cost / bill;
    const hvac = top[0] === 'hvac';
    out.push({
      id: 'cost_driver',
      title: hvac ? 'HVAC is your biggest energy cost' : `${CATEGORY_TEXT[top[0]].charAt(0).toUpperCase()}${CATEGORY_TEXT[top[0]].slice(1)} is your biggest energy cost`,
      body: `${CATEGORY_TEXT[top[0]].charAt(0).toUpperCase()}${CATEGORY_TEXT[top[0]].slice(1)} account${top[0] === 'hvac' || top[0] === 'other' ? '' : 's'} for ${pct(share)} of the modeled energy bill, about ${usd(top[1].cost)} a year. ${hvac ? 'See which systems use it, and whether controls or equipment upgrades could reduce it.' : 'See which upgrades reduce it.'}`,
      metric: { value: share, format: 'pct', label: `of the bill: ${CATEGORY_TEXT[top[0]]}` },
      category: 'cost_reduction',
      priority: level(share, T.costDriverHigh),
      action: hvac ? { kind: 'equipment', label: 'See the HVAC equipment' } : { kind: 'invest', label: 'Explore upgrades' },
      method: `The modeled yearly cost by end use (CBECS 2018 lodging shares, scaled to this hotel's size, systems, occupancy, weather and prices). Shown when the largest use is at least ${pct(T.costDriverShare)} of the bill.`,
    });
  }

  // 3. Energy intensity against the ENERGY STAR median and the portfolio.
  const bench = benchmarkComparison(baseline, p.floorAreaSqft, data);
  const star = bench.peers.find((x) => x.id.startsWith('energy_star'));
  const peers = (input.peers ?? []).filter((x) => x.siteEui > 0);
  const peerMedian = median(peers.map((x) => x.siteEui));
  const eui = bench.siteEuiKBtuPerSqft;
  const vsPeers = peerMedian ? (eui - peerMedian) / peerMedian : null;
  const vsStar = star ? star.difference : null;
  if (eui > 0 && ((vsPeers !== null && vsPeers >= T.intensityAbove) || (vsStar !== null && vsStar >= T.intensityAbove))) {
    const usePeers = vsPeers !== null && vsPeers >= T.intensityAbove;
    const gap = usePeers ? vsPeers! : vsStar!;
    out.push({
      id: 'intensity',
      title: 'Uses more energy per square foot than its peers',
      body: usePeers
        ? `At ${eui.toFixed(1)} kBtu per ft² a year, this hotel uses ${pct(gap)} more energy per square foot than the median of the other ${peers.length} hotels${input.portfolioName ? ` in ${input.portfolioName}` : ''}${vsStar !== null && vsStar > 0 ? ` and ${pct(vsStar)} more than the ENERGY STAR hotel median` : ''}.`
        : `At ${eui.toFixed(1)} kBtu per ft² a year, this hotel uses ${pct(gap)} more energy per square foot than the ENERGY STAR hotel median (${star!.siteEuiKBtuPerSqft.toFixed(1)}). Cold climates and restaurants raise intensity, so compare with similar hotels.`,
      metric: { value: eui, format: 'kbtu', label: usePeers ? `${pct(gap)} above the portfolio median` : `${pct(gap)} above the ENERGY STAR median` },
      category: 'operational_efficiency',
      priority: level(gap, T.intensityHigh),
      action: usePeers ? { kind: 'portfolio', label: 'Compare properties' } : { kind: 'invest', label: 'Explore upgrades' },
      method: `Modeled site energy divided by floor area, compared with ${usePeers ? 'the median of the other hotels in the portfolio (same model) and ' : ''}the ENERGY STAR Portfolio Manager hotel median (a national reference, not adjusted for climate). Shown when at least ${pct(T.intensityAbove)} above either.`,
    });
  }

  // 4. Exposure to a 20% price rise (electricity or gas, whichever costs more).
  const price = (['price_up_20', 'gas_up_20'] as const)
    .map((id) => ({ test: STRESS_TESTS.find((t) => t.id === id)!, delta: simulateEnergyScenario(hotel, STRESS_TESTS.find((t) => t.id === id)!.scenario, data).delta.cost }))
    .sort((a, b) => b.delta - a.delta)[0];
  if (price && price.delta / bill >= T.priceShare) {
    out.push({
      id: 'price',
      title: `Exposed to ${price.test.id === 'price_up_20' ? 'electricity' : 'natural gas'} price rises`,
      body: `If the ${price.test.id === 'price_up_20' ? 'electricity' : 'natural gas'} price rose 20% and stayed there, the bill would grow by about ${usd(price.delta)} a year (${pct(price.delta / bill)}). Upgrades that cut that fuel protect against it.`,
      metric: { value: price.delta, format: 'usd', label: 'a year added by a sustained 20% price rise' },
      category: 'energy_resilience',
      priority: level(price.delta / bill, T.highShare),
      action: { kind: 'stress', label: 'Run the price stress test', testId: price.test.id },
      method: `The same simulation with that price raised 20% all year (a persistent change), minus today's bill. Shown when it adds at least ${pct(T.priceShare)}.`,
    });
  }

  // 5. Equipment condition: 10% worn heating and cooling equipment.
  const worn = STRESS_TESTS.find((t) => t.id === 'hvac_decline');
  if (worn) {
    const d = simulateEnergyScenario(hotel, worn.scenario, data).delta.cost;
    if (d / bill >= T.equipmentShare) {
      out.push({
        id: 'equipment',
        title: 'Worn HVAC equipment would cost you',
        body: `Heating and cooling equipment that used 10% more energy (worn or poorly maintained) would add about ${usd(d)} a year. Regular maintenance and the equipment view show where the plant's energy goes.`,
        metric: { value: d, format: 'usd', label: 'a year if HVAC efficiency falls 10%' },
        category: 'equipment_performance',
        priority: level(d / bill, T.highShare),
        action: { kind: 'stress', label: 'Run the equipment stress test', testId: 'hvac_decline' },
        method: `The simulation with heating and cooling energy 10% higher for the same load (an illustrative decline, not a measured condition), minus today's bill. Shown when it adds at least ${pct(T.equipmentShare)}.`,
      });
    }
  }

  // 6. Weather: the costlier of a one-month heat wave and cold snap.
  const weather = (['heat_wave', 'cold_snap'] as const)
    .map((id) => ({ test: STRESS_TESTS.find((t) => t.id === id)!, delta: simulateEnergyScenario(hotel, STRESS_TESTS.find((t) => t.id === id)!.scenario, data).delta.cost }))
    .sort((a, b) => b.delta - a.delta)[0];
  if (weather && weather.delta / bill >= T.weatherShare) {
    const a = weather.test.assumptions[0]!;
    out.push({
      id: 'weather',
      title: weather.test.id === 'cold_snap' ? 'A cold January costs the most' : 'A hot July costs the most',
      body: `A ${weather.test.label.toLowerCase()} (${a.change}, ${a.period}) would add about ${usd(weather.delta)} in the year it happens. It is a one-off event, so it does not change long-term returns.`,
      metric: { value: weather.delta, format: 'usd', label: `added by a ${weather.test.label.toLowerCase()}, once` },
      category: 'energy_resilience',
      priority: level(weather.delta / bill, T.highShare),
      action: { kind: 'stress', label: `Run the ${weather.test.label.toLowerCase()} test`, testId: weather.test.id },
      method: `The simulation with that month's temperature shifted (NOAA normals ${a.change}), minus today's bill: the total for the one event, not annualized. Shown when it adds at least ${pct(T.weatherShare)} of the year's bill.`,
    });
  }

  // 7. Occupancy sensitivity: +10 points.
  const to = Math.min(1, p.occupancy + T.occupancyStepPts);
  if (to > p.occupancy) {
    const d = simulateOccupancyChange(hotel, to, p.occupancy, data).delta.cost;
    if (Math.abs(d) / bill >= T.occupancyShare) {
      out.push({
        id: 'occupancy',
        title: 'Busy seasons raise the bill',
        body: `Raising occupancy from ${Math.round(p.occupancy * 100)}% to ${Math.round(to * 100)}% adds about ${usd(d)} a year (${pct(d / bill)}): hot water, the kitchen and guest rooms follow guests, while base loads do not.`,
        metric: { value: d, format: 'usd', label: `a year at ${Math.round(to * 100)}% occupancy` },
        category: 'operational_efficiency',
        priority: level(Math.abs(d) / bill, T.highShare),
        action: { kind: 'scenario', label: 'Run an occupancy simulation' },
        method: `The simulation at ${Math.round(to * 100)}% average occupancy (same seasonal pattern) minus the simulation at the profile's ${Math.round(p.occupancy * 100)}%. Shown when the bill moves at least ${pct(T.occupancyShare)}.`,
      });
    }
  }

  // Energy resilience shows one card: the larger yearly cost of the price and weather exposures. Then a fixed order, most actionable
  // first: investment, cost driver, intensity, occupancy, resilience, equipment. At most `max`.
  const ORDER: EnergyInsight['id'][] = ['investment', 'cost_driver', 'intensity', 'occupancy', 'price', 'weather', 'equipment'];
  const resilience = out.filter((x) => x.category === 'energy_resilience').sort((a, b) => Math.abs(b.metric.value) - Math.abs(a.metric.value))[0];
  const picked = out.filter((x) => x.category !== 'energy_resilience' || x === resilience);
  return picked.sort((a, b) => ORDER.indexOf(a.id) - ORDER.indexOf(b.id)).slice(0, T.max);
}
