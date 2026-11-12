// The tour's live figures: one headline number per step, computed by the engine for the hotel that is open (read-only; nothing is
// stored or changed). Cached per hotel, so a figure is computed once. Every figure is an estimate and the card says so.
import {
  STRESS_TESTS,
  ZONE_IDS,
  ZONE_LABELS,
  benchmarkComparison,
  optimizeInvestmentPortfolio,
  prepareUpgradeContext,
  simulateEnergyScenario,
  simulateOccupancyChange,
} from "@/engine/hotel";
import type { EnergyResult, PortfolioResult, ResolvedProfile } from "@/engine/hotel";
import type { TwinState } from "@/store/useTwin";
import { selectPortfolioSummary } from "@/store/hotelDerived";

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
    case "welcome":
      return { value: a.cost, format: "usd", label: `a year on energy at ${p.name}`, note: `About ${usd(a.cost / p.rooms)} per room and ${Math.round(a.carbonKg / 1000).toLocaleString("en-US")} t of CO₂ a year.` };
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
    case "flow":
      return a.cost > 0 ? { value: a.elecCost / a.cost, format: "pct", label: "of the bill is electricity", note: `Natural gas is ${usd(a.gasCost)} a year.` } : null;
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
    case "portfolio": {
      const sum = selectPortfolioSummary(s);
      const top = [...sum.properties].sort((x, y) => y.priorityScore - x.priorityScore)[0];
      return {
        value: sum.totals.savingsPotential,
        format: "usd",
        label: `a year of savings potential across ${sum.totals.properties} hotels`,
        ...(top ? { note: `Top priority: ${top.name} (${top.priorityScore} of 100).` } : {}),
      };
    }
    default:
      return null;
  }
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
