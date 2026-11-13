// The tour's live figures: one headline number per step, computed by the engine for the hotel that is open (read-only; nothing is
// stored or changed). Cached per hotel, so a figure is computed once. Every figure is an estimate and the card says so.
import {
  STRESS_TESTS,
  ZONE_IDS,
  ZONE_LABELS,
  benchmarkComparison,
  optimizeInvestmentPortfolio,
  upgradeCatalog,
  advisor,
  optimizePortfolioBudget,
  prepareUpgradeContext,
  simulateEnergyScenario,
  simulateOccupancyChange,
} from "@/engine/hotel";
import type { EnergyResult, PortfolioResult, ResolvedProfile } from "@/engine/hotel";
import type { TwinState } from "@/store/useTwin";
import { buildHotelReport } from "@/report/data";
import { selectEnergyInsights, selectPortfolioItems, selectPortfolioSummary } from "@/store/hotelDerived";

export interface Insight {
  value: number;
  format: "usd" | "pct" | "kbtu" | "years";
  /** What the number is, completing a sentence ("a year on energy"). */
  label: string;
  /** A second line with context (already formatted numbers from the engine). */
  note?: string;
}

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const usd = (n: number) => `$${Math.round(Math.abs(n)).toLocaleString("en-US")}`;
const pct = (share: number) => `${Math.round(share * 100)}%`;
const CATEGORY: Record<string, string> = { hvac: "heating, cooling and ventilation", lighting: "lighting", hotWater: "hot water", kitchen: "the kitchen", equipment: "plug loads", other: "other uses" };

const optimizerCache = new WeakMap<ResolvedProfile, Map<number, PortfolioResult>>();
/** The optimizer's answer for the open hotel at its own budget, on today's baseline (cached; nothing is stored in the app). */
export function bestPackage(hotel: ResolvedProfile, baseline: EnergyResult, discountRate: number): PortfolioResult {
  const byRate = optimizerCache.get(hotel) ?? new Map<number, PortfolioResult>();
  optimizerCache.set(hotel, byRate);
  let r = byRate.get(discountRate);
  if (!r) {
    r = optimizeInvestmentPortfolio(prepareUpgradeContext(hotel, undefined, baseline), { assumptions: { discountRate } });
    byRate.set(discountRate, r);
  }
  return r;
}

const stressCache = new WeakMap<ResolvedProfile, { label: string; delta: number }>();
function costliestStress(hotel: ResolvedProfile): { label: string; delta: number } {
  const hit = stressCache.get(hotel);
  if (hit) return hit;
  let best = { label: "", delta: -Infinity };
  for (const t of STRESS_TESTS) {
    const d = simulateEnergyScenario(hotel, t.scenario).delta.cost;
    if (d > best.delta) best = { label: t.label, delta: d };
  }
  stressCache.set(hotel, best);
  return best;
}

export function insightFor(stepId: string, s: TwinState): Insight | null {
  const p = s.hotel.profile;
  const a = s.baseline.annual;
  switch (stepId) {
    case "welcome": {
      // The portfolio-first welcome: the chain's yearly energy cost (sum of each hotel's modeled baseline).
      const t = selectPortfolioSummary(s).totals;
      if (t.properties === 0) return null;
      return { value: t.cost, format: "usd", label: `a year on energy across ${t.properties} hotel${t.properties === 1 ? "" : "s"}`, note: `${t.rooms.toLocaleString("en-US")} rooms and ${Math.round(t.carbonKg / 1000).toLocaleString("en-US")} t of CO₂ a year.` };
    }
    case "portfolio-kpis": {
      const t = selectPortfolioSummary(s).totals;
      if (t.properties === 0) return null;
      return { value: t.savingsPotential, format: "usd", label: "a year of savings potential across the portfolio", note: `For ${usd(t.investmentRequired)} of investment after counted incentives, each hotel within its own budget.` };
    }
    case "ranking": {
      const sum = selectPortfolioSummary(s);
      const top = [...sum.properties].sort((x, y) => y.priorityScore - x.priorityScore)[0];
      const spender = [...sum.properties].sort((x, y) => y.annual.cost - x.annual.cost)[0];
      if (!top || !top.potential) return null;
      return {
        value: top.potential.annualSavings,
        format: "usd",
        label: `a year saved at ${top.name}, the top priority (${top.priorityScore} of 100)`,
        ...(spender && spender.name !== top.name && spender.priorityScore < top.priorityScore ? { note: `${spender.name} spends the most, but returns less per dollar invested (${spender.priorityScore} of 100).` } : spender?.name === top.name ? { note: "It also has the largest energy bill." } : {}),
      };
    }
    case "portfolio-optimizer": {
      const plan = tourPortfolioPlan(s);
      const funded = plan.allocations.filter((x: { evaluation: unknown }) => x.evaluation).length;
      if (plan.totals.annualSavings <= 0) return null;
      return {
        value: plan.totals.annualSavings,
        format: "usd",
        label: `a year saved by splitting ${usd(plan.budget)} across the hotels`,
        note: `${funded} of ${plan.allocations.length} hotels get a package${plan.totals.paybackYears !== null ? `; paid back in ${plan.totals.paybackYears.toFixed(1)} years` : ""}.`,
      };
    }
    case "explore": {
      const row = selectPortfolioSummary(s).properties.find((r) => r.id === s.activePropertyId);
      return { value: a.cost, format: "usd", label: `a year on energy at ${p.name}`, ...(row ? { note: `Investment priority ${row.priorityScore} of 100; ${p.rooms} rooms in ${p.city}.` } : {}) };
    }
    case "insights": {
      const first = selectEnergyInsights(s)[0];
      if (!first) return null;
      return { value: first.metric.value, format: first.metric.format, label: `${first.title.charAt(0).toLowerCase()}${first.title.slice(1)}`, note: `${selectEnergyInsights(s).length} findings for ${p.name}, most actionable first.` };
    }
    case "profile": {
      const b = benchmarkComparison(s.baseline, p.floorAreaSqft);
      const star = b.peers.find((x) => x.id.startsWith("energy_star")) ?? b.peers[0];
      return {
        value: b.siteEuiKBtuPerSqft,
        format: "kbtu",
        label: "of energy per square foot a year",
        ...(star ? { note: `${pct(Math.abs(star.difference))} ${star.difference >= 0 ? "above" : "below"} the ${star.label.replace(/ \(U\.S\.\)$/, "")}.` } : {}),
      };
    }
    case "costs": {
      const top = Object.entries(s.baseline.byCategory).sort((x, y) => y[1].cost - x[1].cost)[0];
      if (!top || a.cost <= 0) return null;
      return { value: top[1].cost / a.cost, format: "pct", label: `of the bill goes to ${CATEGORY[top[0]] ?? top[0]}`, note: `${usd(top[1].cost)} a year.` };
    }
    case "twin": {
      const z = [...ZONE_IDS].sort((x, y) => s.baseline.byZone[y].cost - s.baseline.byZone[x].cost)[0]!;
      return { value: s.baseline.byZone[z].cost, format: "usd", label: `a year in ${ZONE_LABELS[z].toLowerCase()}, the costliest zone` };
    }
    case "seasons": {
      const months = s.baseline.months;
      const hi = [...months].sort((x, y) => y.totals.cost - x.totals.cost)[0];
      const lo = [...months].sort((x, y) => x.totals.cost - y.totals.cost)[0];
      if (!hi || !lo) return null;
      return { value: hi.totals.cost, format: "usd", label: `in ${MONTHS[hi.month] ?? ""}, the costliest month`, note: `${MONTHS[lo.month] ?? ""} costs ${usd(lo.totals.cost)}, the least.` };
    }
    case "flow": {
      // Carbon versus cost: natural gas's share of each (the same annual figures, gas carbon at the EPA factor).
      if (a.cost <= 0 || a.carbonKg <= 0) return null;
      const gasCarbon = a.gasTherms * s.baseline.emissionFactors.gasKgPerTherm;
      return { value: gasCarbon / a.carbonKg, format: "pct", label: "of the carbon comes from natural gas", note: `Gas is ${pct(a.gasCost / a.cost)} of the bill but ${pct(gasCarbon / a.carbonKg)} of the carbon.` };
    }
    case "drivers": {
      const from = p.occupancy;
      const to = from <= 0.7 ? Math.min(1, from + 0.25) : Math.max(0, from - 0.25);
      const d = simulateOccupancyChange(s.hotel, to, from).delta.cost;
      return { value: d, format: "usd", label: `a year if occupancy goes from ${Math.round(from * 100)}% to ${Math.round(to * 100)}%`, note: "Base loads run whether rooms are full or not, so energy does not rise one for one." };
    }
    case "stress": {
      const c = costliestStress(s.hotel);
      return c.delta > 0 ? { value: c.delta, format: "usd", label: `a year added by the costliest shock: ${c.label.toLowerCase()}` } : null;
    }
    case "optimizer": {
      const r = bestPackage(s.hotel, s.baseline, s.hotelDiscountRate);
      const w = r.objectiveWinner;
      if (!w) return null;
      const pay = w.evaluation.financials.simplePaybackYears;
      return {
        value: w.evaluation.financials.annualSavings.mid,
        format: "usd",
        label: `a year saved by the best package within ${usd(r.budget)}`,
        note: `${w.evaluation.name}${pay !== null ? `, paying back in ${pay.toFixed(1)} years` : ""}. ${r.combinationsTested.toLocaleString("en-US")} combinations tested.`,
      };
    }
    case "projections": {
      const series = projectionSeries(s);
      const best = [...series].sort((x, y) => y.net10 - x.net10)[0];
      if (!best) return null;
      return {
        value: best.net10,
        format: "usd",
        label: `net over 10 years from the ${best.role.toLowerCase()} package`,
        note: `${best.name}: ${usd(best.netInvestment)} upfront after counted incentives${best.paybackYears !== null ? `, paid back in ${best.paybackYears.toFixed(1)} years` : ""}.`,
      };
    }
    case "portfolio": {
      // The map: the spread in efficiency between the hotels (site energy per ft², from each hotel's baseline).
      const rows = [...selectPortfolioSummary(s).properties].sort((x, y) => y.siteEui - x.siteEui);
      const hi = rows[0];
      const lo = rows[rows.length - 1];
      if (!hi || !lo) return null;
      return { value: hi.siteEui, format: "kbtu", label: `at ${hi.name}, the least efficient hotel shown`, ...(rows.length > 1 ? { note: `${lo.name} uses ${lo.siteEui.toFixed(1)} kBtu/ft², the least.` } : {}) };
    }
    default:
      return null;
  }
}

/** What the tour's report card shows: the PDF's own sections and the plan's one-line reading, for the best package (read-only, cached run). */
export interface ReportOutline {
  plan: string;
  headline: string;
  verdict: "attractive" | "marginal" | "unattractive";
  sections: string[];
}

/** The hotel report's page sections, in order (as in src/report/pdf/ReportDocument.tsx). */
export const REPORT_SECTIONS = [
  "Executive summary",
  "Property overview",
  "Current energy performance",
  "Before and after the upgrades",
  "Investment analysis",
  "Assumptions and methodology",
  "Risks and limitations",
];

export function reportOutline(s: TwinState): ReportOutline | null {
  const r = bestPackage(s.hotel, s.baseline, s.hotelDiscountRate);
  const w = r.objectiveWinner;
  if (!w) return null;
  const ctx = prepareUpgradeContext(s.hotel, undefined, s.baseline);
  const d = buildHotelReport({
    kind: "ai",
    hotel: s.hotel,
    baseline: s.baseline,
    evaluation: w.evaluation,
    planLabel: `AI recommended · ${w.roleLabel}`,
    budget: r.budget,
    discountRate: s.hotelDiscountRate,
    catalog: upgradeCatalog(ctx).items,
    synthetic: true,
  });
  return { plan: w.evaluation.name, headline: d.interpretation.headline, verdict: d.interpretation.verdict, sections: REPORT_SECTIONS };
}

/**
 * The advisor card: an example question and the answer the advisor's engine tools give for it (the same `run_scenario` tool the AI calls,
 * run in the browser, and its template answer). No network, nothing stored, nothing applied.
 */
export const ADVISOR_EXAMPLE_QUESTION = "What if occupancy rises to 85%?";
export function advisorExample(s: TwinState): { question: string; answer: string } | null {
  const question = ADVISOR_EXAMPLE_QUESTION;
  const env = { hotel: s.hotel, baseline: s.baseline, discountRate: s.hotelDiscountRate };
  const calls = advisor.planToolCalls(question, "hotel");
  if (!calls.length) return null;
  const runs = calls.map((c, i) => advisor.runTool(env, { ...c, id: c.id ?? `tour-${i}` } as never));
  const ctx = advisor.buildAdvisorContext({ hotel: s.hotel, baseline: s.baseline, scenario: {}, scenarioResult: null, plan: null, syntheticDemo: true }, question);
  const text = advisor.toolAnswer(runs, ctx);
  const sentences = text.split(/(?<=[.!?])\s+(?=[A-Z])/);
  const answer = sentences.slice(0, 2).join(" ");
  return answer ? { question, answer: `${answer} [Apply this what-if]` } : null;
}

/** The open portfolio's top-priority hotel (highest investment priority among the hotels shown), or null. */
export function topPriorityId(s: TwinState): string | null {
  const rows = selectPortfolioSummary(s).properties;
  const top = [...rows].sort((x, y) => y.priorityScore - x.priorityScore || x.name.localeCompare(y.name))[0];
  return top && top.priorityScore > 0 ? top.id : null;
}

const portfolioPlanCache = new WeakMap<object, Map<string, ReturnType<typeof optimizePortfolioBudget>>>();
/** The portfolio optimizer at the page's budget and objective, for the tour (read-only, cached per portfolio items). */
function tourPortfolioPlan(s: TwinState) {
  const items = selectPortfolioItems(s);
  const byKey = portfolioPlanCache.get(items) ?? new Map();
  portfolioPlanCache.set(items, byKey);
  const key = `${s.portfolioBudget}|${s.portfolioObjective}|${s.hotelDiscountRate}`;
  let plan = byKey.get(key);
  if (!plan) {
    plan = optimizePortfolioBudget(items, { budget: s.portfolioBudget, objective: s.portfolioObjective, discountRate: s.hotelDiscountRate });
    byKey.set(key, plan);
  }
  return plan;
}

/** One recommended package's 10-year projection for the tour's chart (all figures from the engine, mid case). */
export interface ProjectionSeries {
  role: string;
  name: string;
  netInvestment: number;
  /** Year 0 (minus the net investment) to year 10: savings to date minus the net investment. */
  cumulative: number[];
  net10: number;
  paybackYears: number | null;
}

/** The 10-year projections of the packages the optimizer recommends for the open hotel at its own budget (read-only, cached). */
export function projectionSeries(s: TwinState): ProjectionSeries[] {
  const r = bestPackage(s.hotel, s.baseline, s.hotelDiscountRate);
  return r.packages
    .filter((p) => (p.evaluation.financials.projection ?? []).length > 0)
    .slice(0, 3)
    .map((p) => {
      const f = p.evaluation.financials;
      return {
        role: p.roleLabel,
        name: p.evaluation.name,
        netInvestment: f.netInvestment.mid,
        cumulative: [-f.netInvestment.mid, ...(f.projection ?? []).map((y) => y.cumulativeNet.mid)],
        net10: f.netBenefit10.mid,
        paybackYears: f.simplePaybackYears,
      };
    });
}

/** The finish card's summary: what the hotel spends, what the best package saves and how fast it pays back. */
export function finishSummary(s: TwinState): { label: string; value: number; format: Insight["format"] }[] {
  const r = bestPackage(s.hotel, s.baseline, s.hotelDiscountRate);
  const f = r.objectiveWinner?.evaluation.financials;
  const out: { label: string; value: number; format: Insight["format"] }[] = [{ label: "Energy spend / yr", value: s.baseline.annual.cost, format: "usd" }];
  if (f) {
    out.push({ label: "Best package saves / yr", value: f.annualSavings.mid, format: "usd" });
    if (f.simplePaybackYears !== null) out.push({ label: "Pays back in", value: f.simplePaybackYears, format: "years" });
  }
  return out;
}

export function formatInsight(v: number, format: Insight["format"]): string {
  if (format === "usd") return `${v < 0 ? "−" : ""}${usd(v)}`;
  if (format === "pct") return pct(v);
  if (format === "kbtu") return `${v.toFixed(1)} kBtu/ft²`;
  return `${v.toFixed(1)} years`;
}
