import type { AdvisorContext, AdvisorPackage, AdvisorPlan, AdvisorUpgrade } from './context';
import type { ParsedQuestion } from './intent';

/**
 * Deterministic answers built only from the numbers in the context. Used when the AI function is not configured, is slow, fails,
 * or returns text that fails the number check, and cached for the demo. Three to six sentences, ending with the limitation.
 */

const usd = (n: number) => `${n < 0 ? '-' : ''}$${Math.abs(n).toLocaleString('en-US')}`;
const pct = (n: number) => `${Math.abs(n)}%`;
const years = (n: number | null) => (n === null ? 'no payback' : `a payback of ${n} years`);

const OBJECTIVE_TEXT: Record<string, string> = {
  annual_savings: 'maximum yearly savings',
  payback: 'the fastest payback',
  roi: 'the best return on investment',
  carbon: 'the largest carbon reduction',
  balanced: 'a balance of savings, carbon and guest comfort',
};

function limitation(c: AdvisorContext): string[] {
  const out: string[] = [];
  if (c.hotel.syntheticDemo) out.push('This hotel is a synthetic demo, so the figures illustrate the method rather than a real property.');
  out.push('These are planning estimates from synthetic and public data, shown as ranges, not an engineering audit or a guarantee of savings.');
  return out;
}

function describeUpgrade(u: AdvisorUpgrade): string {
  return `${u.label} costs about ${usd(u.cost)} and should save about ${usd(u.annualSavings.mid)} a year (${pct(u.annualSavingsPctOfBill)} of the bill), with ${years(u.paybackYears)}`;
}

function describePackage(p: AdvisorPackage): string {
  return `${p.name}: about ${usd(p.cost)} to install, saving about ${usd(p.annualSavings.mid)} a year (${usd(p.annualSavings.low)} to ${usd(p.annualSavings.high)}), with ${years(p.paybackYears)} and a five-year net benefit of ${usd(p.netBenefit)}`;
}

function general(c: AdvisorContext): string[] {
  const [first, second] = c.baseline.byCategory;
  const s = [
    `${c.hotel.name} spends an estimated ${usd(c.baseline.annualCost)} a year on energy, about ${usd(c.baseline.costPerRoom)} per room, mostly on ${first?.label.toLowerCase()} (${pct(first?.sharePct ?? 0)} of the bill) and ${second?.label.toLowerCase()} (${pct(second?.sharePct ?? 0)}).`,
  ];
  const top = c.plan?.objectiveWinner;
  if (top) s.push(`For a budget of ${usd(c.plan!.budget)}, the model's top choice is ${describePackage(top)}.`);
  else {
    const quick = c.upgrades.filter((u) => u.paybackYears !== null).sort((a, b) => (a.paybackYears ?? 0) - (b.paybackYears ?? 0))[0];
    if (quick) s.push(`The quickest-paying single upgrade is ${describeUpgrade(quick)}. Run the budget optimizer to see the best combination.`);
  }
  return s;
}

function hvacCost(c: AdvisorContext): string[] {
  const idx = c.baseline.byCategory.findIndex((x) => x.label === 'HVAC');
  const hvac = c.baseline.byCategory[idx];
  if (!hvac) return general(c);
  const plant = c.baseline.byZone.find((z) => z.label.startsWith('Central HVAC'));
  const guest = c.baseline.byZone.find((z) => z.label === 'Guest rooms');
  const s = [
    `HVAC is ${idx === 0 ? 'your largest cost category' : 'one of your larger cost categories'}: about ${usd(hvac.annualCost)} a year, ${pct(hvac.sharePct)} of the estimated bill.`,
    `Heating and cooling follow the weather and how guest rooms are conditioned when empty, and the central plant ${plant ? `zone costs about ${usd(plant.annualCost)}` : 'carries much of it'}${guest ? `, while the guest-room zone costs about ${usd(guest.annualCost)}` : ''}.`,
  ];
  const related = c.upgrades
    .filter((u) => ['smart_room_controls', 'energy_management', 'hvac_upgrade', 'insulation'].includes(u.id))
    .sort((a, b) => b.annualSavings.mid - a.annualSavings.mid)[0];
  if (related) s.push(`The HVAC-related option that saves the most is ${describeUpgrade(related)}.`);
  return s;
}

function occupancy(c: AdvisorContext): string[] {
  const ex = c.occupancyExample;
  const dir = ex.annualCostChange >= 0 ? 'raises' : 'lowers';
  const s = [
    `In the model, moving occupancy from ${ex.fromPct}% to ${ex.toPct}% ${dir} your yearly energy cost by about ${usd(ex.annualCostChange)} (${pct(ex.annualCostChangePct)} of the bill).`,
  ];
  if (ex.biggestChanges.length) s.push(`The biggest changes are ${ex.biggestChanges.map((b) => `${b.label.toLowerCase()} (${usd(b.annualCostChange)})`).join(', ')}.`);
  s.push('Energy does not scale one-for-one with occupancy: base loads such as corridor lighting and standby losses run regardless, while hot water, the kitchen and in-room use rise with guests.');
  return s;
}

function compare(c: AdvisorContext, q: ParsedQuestion): string[] | null {
  const [a, b] = q.upgrades.map((id) => c.upgrades.find((u) => u.id === id));
  if (!a || !b) return null;
  const s = [`${describeUpgrade(a)}.`, `${describeUpgrade(b)}.`];
  const pair: [AdvisorUpgrade, AdvisorUpgrade] = (a.paybackYears ?? Infinity) <= (b.paybackYears ?? Infinity) ? [a, b] : [b, a];
  const [first, second] = pair;
  if (first.paybackYears !== null) {
    s.push(`On these estimates ${first.label} pays back faster (${first.paybackYears} years against ${second.paybackYears ?? 'no payback'}), and its five-year net benefit is ${usd(first.netBenefit)} against ${usd(second.netBenefit)}.`);
  }
  const fit = (u: AdvisorUpgrade) => (u.cost <= c.hotel.budget ? 'fits' : 'does not fit');
  s.push(`With your ${usd(c.hotel.budget)} budget, ${a.label} ${fit(a)} and ${b.label} ${fit(b)}.`);
  return s;
}

function planFor(c: AdvisorContext, q: ParsedQuestion): AdvisorPlan | null {
  const wanted = q.budgets[0];
  if (wanted !== undefined) {
    const match = c.otherBudgets.find((p) => p.budget === wanted) ?? (c.plan && c.plan.budget === wanted ? c.plan : null);
    if (match) return match;
  }
  return c.plan ?? c.otherBudgets[0] ?? null;
}

function budget(c: AdvisorContext, q: ParsedQuestion): string[] | null {
  const plan = planFor(c, q);
  if (!plan) return null;
  const s = [`With ${usd(plan.budget)} to spend, the model tested ${plan.combinationsTested} combinations of upgrades and ${plan.feasibleCount} fit.`];
  const win = plan.objectiveWinner ?? plan.packages[0];
  if (!win) {
    s.push(plan.emptyReason ?? 'No package met the budget and comfort limits.');
    return s;
  }
  s.push(`For ${OBJECTIVE_TEXT[c.hotel.objective] ?? 'your goal'}, the top choice is ${describePackage(win)}, leaving ${usd(win.remainingBudget)} of the budget unspent.`);
  const others = plan.packages.filter((p) => p.name !== win.name).map((p) => `${p.role.toLowerCase()}: ${p.name} (${usd(p.cost)}, saving ${usd(p.annualSavings.mid)} a year)`);
  if (others.length) s.push(`Other options are ${others.join('; ')}.`);
  return s;
}

function scenario(c: AdvisorContext): string[] {
  const sc = c.scenario;
  if (!sc) {
    return [
      `No what-if is active, so the figures describe the current baseline of ${usd(c.baseline.annualCost)} a year.`,
      `You can try a stress test such as a heat wave, a cold snap, a conference surge or a 20% electricity price rise, or change occupancy, setpoints and schedules, and the estimate updates.`,
    ];
  }
  const dir = sc.annualCostChange >= 0 ? 'raises' : 'lowers';
  const s = [`${sc.description.join('; ')}. That ${dir} your estimated yearly energy cost by about ${usd(sc.annualCostChange)} (${pct(sc.annualCostChangePct)} of the bill).`];
  if (sc.drivers.length) s.push(`The reasons: ${sc.drivers.map((d) => `${d.label.toLowerCase()} (${usd(d.annualCostChange)})`).join('; ')}.`);
  if (sc.comfortWarnings.length) s.push('The model also flags comfort or operational tradeoffs for these settings; review the warnings before using them.');
  return s;
}

function zoneCost(c: AdvisorContext, q: ParsedQuestion): string[] | null {
  const rows = c.baseline.byZone.filter((z) => q.zones.some((id) => zoneLabelMatches(id, z.label)));
  const row = rows[0];
  if (!row) return null;
  const s = [`${row.label} costs about ${usd(row.annualCost)} a year, ${pct(row.sharePct)} of the estimated bill.`];
  const helpers = c.upgrades.filter((u) => u.zonesHelped.includes(row.label)).sort((a, b) => b.annualSavings.mid - a.annualSavings.mid).slice(0, 2);
  if (helpers.length) s.push(`Upgrades that lower its cost: ${helpers.map((u) => `${u.label} (${usd(u.annualSavings.mid)} a year for the whole hotel)`).join('; ')}.`);
  return s;
}

const ZONE_LABELS_BY_ID: Record<string, string> = {
  guest_rooms: 'Guest rooms',
  lobby_common: 'Lobby and common areas',
  kitchen_restaurant: 'Kitchen and restaurant',
  hallways_shared: 'Hallways and shared facilities',
  central_hvac: 'Central HVAC and mechanical',
  hot_water: 'Hot water',
};
const zoneLabelMatches = (id: string, label: string) => ZONE_LABELS_BY_ID[id] === label;

export function fallbackAnswer(q: ParsedQuestion, c: AdvisorContext): string {
  let body: string[] | null = null;
  switch (q.intent) {
    case 'compare':
      body = compare(c, q);
      break;
    case 'budget':
      body = budget(c, q);
      break;
    case 'hvac_cost':
      body = hvacCost(c);
      break;
    case 'occupancy':
      body = occupancy(c);
      break;
    case 'scenario':
      body = scenario(c);
      break;
    case 'zone_cost':
      body = zoneCost(c, q);
      break;
    default:
      body = null;
  }
  return [...(body ?? general(c)), ...limitation(c)].join(' ');
}
