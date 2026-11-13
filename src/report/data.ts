// The investment report's data: one pure function per report kind builds every figure from the engine's results, so the on-screen
// results, the preview and the PDF show the same numbers. Formatting only; nothing here is calculated beyond sums, shares and
// differences of engine outputs.
import type {
  CatalogItem,
  EnergyResult,
  FinancialBreakdown,
  PackageEvaluation,
  PortfolioPlan,
  PortfolioSummary,
  ResolvedProfile,
  Totals,
} from "@/engine/hotel";
import { ZONE_LABELS } from "@/engine/hotel";
import { HVAC_LABEL } from "@/portfolio/metrics";

export const KBTU_PER_KWH = 3.412;
export const KBTU_PER_THERM = 100;

export type ReportKind = "ai" | "custom" | "portfolio";

export interface ReportMetricPair {
  label: string;
  unit: string;
  before: number;
  after: number;
  /** after − before */
  change: number;
  /** change / before (null when before is 0) */
  changePct: number | null;
  /** True when lower is better (energy, cost, carbon): a fall is shown as an improvement. */
  lowerIsBetter: boolean;
}

export interface ReportUpgradeLine {
  id: string;
  label: string;
  description: string;
  /** Quantity or capacity in plain words ("100 rooms", "120 kW", "the whole hotel"). */
  quantity: string;
  installedCost: number;
  costRange: [number, number];
  /** Marginal savings in the model's order (they add up to the package total; interactions counted). */
  annualSavings: number;
  /** Line cost / its marginal savings; null when it saves nothing on its own in this package. */
  paybackYears: number | null;
  lifetimeYears: number;
  /** True when its simple payback is longer than its expected life. */
  paybackBeyondLife: boolean;
  incentives: { label: string; amount: number; applied: boolean; note: string; source: string }[];
  costStatus: string;
  source: string;
}

export interface HotelReportData {
  kind: "ai" | "custom";
  title: string;
  planName: string;
  /** "AI recommended · Maximum savings" or "Custom plan". */
  planLabel: string;
  hotel: {
    name: string;
    location: string;
    rooms: number;
    floorAreaSqft: number;
    floors: number | null;
    yearBuilt: number;
    hvac: string;
    occupancyPct: number;
    electricityRate: number;
    gasRate: number;
    synthetic: boolean;
    defaulted: string[];
  };
  /** "Measured against the current what-if: …" or null for today's baseline. */
  measuredAgainst: string | null;
  budget: number;
  current: {
    elecKWh: number;
    gasTherms: number;
    cost: number;
    elecCost: number;
    gasCost: number;
    carbonKg: number;
    siteEui: number;
    byCategory: { label: string; cost: number; share: number }[];
    byZone: { label: string; cost: number; share: number }[];
  };
  after: { elecKWh: number; gasTherms: number; cost: number; carbonKg: number; siteEui: number };
  comparison: ReportMetricPair[];
  investment: {
    grossCost: number;
    grossRange: [number, number];
    incentivesApplied: number;
    incentivesListed: { label: string; note: string }[];
    /**
     * Incentives shown for illustration only and NOT in the base case (for example a 2025 program rate not yet confirmed for 2026),
     * from `financials.illustrativeIncentives` when the engine provides it. Never counted in any figure of the report.
     */
    illustrative: { label: string; amount: number; note: string }[];
    /** What the net investment would be if the illustrative incentives were confirmed (null when there are none). */
    netIfIllustrative: number | null;
    netInvestment: number;
    remainingBudget: number;
    overBudget: boolean;
  };
  financial: {
    annualSavings: number;
    savingsRange: [number, number];
    savingsPctOfBill: number;
    paybackYears: number | null;
    npv5: number;
    npv10: number;
    netBenefit5: number;
    netBenefit10: number;
    discountRate: number;
    /** Year 0 (minus the net investment) to year 10: cumulative net benefit, mid case. */
    cumulative: number[];
    /** Year by year, years 1 to 10. */
    projection: { year: number; savings: number; cumulative: number; cumulativeNpv: number }[];
  };
  environment: { elecKWhSaved: number; gasThermsSaved: number; carbonKgAvoided: number; carbonPct: number };
  upgrades: ReportUpgradeLine[];
  /** True when the line savings add up to the package total (the engine's sequential attribution). */
  contributionsAdd: boolean;
  comfort: { score: number; notes: string[] };
  interpretation: { verdict: "attractive" | "marginal" | "unattractive"; headline: string; sentences: string[] };
  assumptions: string[];
  risks: string[];
  sources: string[];
}

export interface PortfolioReportData {
  kind: "portfolio";
  title: string;
  organization: string;
  city: string;
  synthetic: boolean;
  budget: number;
  objective: string;
  discountRate: number;
  current: { hotels: number; rooms: number; cost: number; siteKBtu: number; floorAreaSqft: number; siteEui: number; carbonKg: number };
  totals: PortfolioPlan["totals"];
  allocations: {
    name: string;
    packageName: string | null;
    grossCost: number;
    netInvestment: number;
    annualSavings: number;
    paybackYears: number | null;
    npv10: number;
    baselineCost: number;
    savingsPct: number;
  }[];
  properties: { name: string; rooms: number; cost: number; siteEui: number; priorityScore: number }[];
  interpretation: { verdict: "attractive" | "marginal" | "unattractive"; headline: string; sentences: string[] };
  assumptions: string[];
  risks: string[];
  sources: string[];
  method: string;
}

export type ReportData = HotelReportData | PortfolioReportData;

const usd = (n: number) => `${n < 0 ? "-" : ""}$${Math.round(Math.abs(n)).toLocaleString("en-US")}`;
const yrs = (n: number) => `${n.toFixed(1)} years`;
const siteKBtu = (t: Pick<Totals, "elecKWh" | "gasTherms">) => t.elecKWh * KBTU_PER_KWH + t.gasTherms * KBTU_PER_THERM;
const pair = (label: string, unit: string, before: number, after: number): ReportMetricPair => ({
  label,
  unit,
  before,
  after,
  change: after - before,
  changePct: before !== 0 ? (after - before) / before : null,
  lowerIsBetter: true,
});

/** Illustrative incentives (not in the base case): the engine's `financials.illustrativeIncentives` lines (program-year rule, docs/15 §21). */
function illustrativeOf(f: FinancialBreakdown): { label: string; amount: number; note: string }[] {
  const ill = f.illustrativeIncentives;
  if (!ill) return [];
  return ill.lines
    .filter((l) => l.amount > 0)
    .map((l) => ({ label: l.label, amount: l.amount, note: `program year ${l.programYear}; ${ill.label}` }));
}

const CATEGORY_LABEL: Record<string, string> = {
  hvac: "Heating, cooling and ventilation",
  lighting: "Lighting",
  hotWater: "Hot water",
  kitchen: "Kitchen",
  equipment: "Plug loads and equipment",
  other: "Other",
};

/**
 * Plain-language reading of a plan's finances, from its own figures. Honest about poor results: a negative 10-year NPV, a payback
 * longer than the equipment's life or no savings are said as such, and such a plan is not called attractive.
 */
export function interpretFinancials(
  f: FinancialBreakdown,
  baselineCost: number,
  lifeYears: number | null,
  subject = "This plan",
): HotelReportData["interpretation"] {
  const npv10 = f.npv10?.mid ?? f.netBenefit10.mid;
  const pay = f.simplePaybackYears;
  const share = baselineCost > 0 ? f.annualSavings.mid / baselineCost : 0;
  const sentences: string[] = [];
  sentences.push(
    `${subject} requires an estimated ${usd(f.netInvestment.mid)} investment after incentives${f.incentivesTotal > 0 ? ` (${usd(f.grossCost.mid)} installed, less ${usd(f.incentivesTotal)} of utility incentives)` : ""} and is projected to reduce annual energy spending by ${usd(f.annualSavings.mid)}, about ${Math.round(share * 100)}% of the modeled bill.`,
  );
  let verdict: HotelReportData["interpretation"]["verdict"];
  if (pay === null || f.annualSavings.mid <= 0) {
    verdict = "unattractive";
    sentences.push("It does not save money in the model, so it does not pay for itself.");
  } else {
    sentences.push(`The simple payback is about ${yrs(pay)}${lifeYears !== null ? `, against an expected equipment life of about ${Math.round(lifeYears)} years` : ""}.`);
    const beyondLife = lifeYears !== null && pay > lifeYears;
    if (beyondLife) sentences.push("The payback is longer than the equipment is expected to last, so on these estimates it would not recover its cost.");
    sentences.push(
      npv10 >= 0
        ? `Discounted at ${Math.round((f.discountRate ?? 0.08) * 100)}% a year, its 10-year net present value is ${usd(npv10)}: the savings are worth more than the investment over ten years.`
        : `Discounted at ${Math.round((f.discountRate ?? 0.08) * 100)}% a year, its 10-year net present value is ${usd(npv10)}: over ten years the savings do not cover the investment.`,
    );
    verdict = beyondLife || npv10 < 0 ? "unattractive" : pay > 7 ? "marginal" : "attractive";
    if (verdict === "marginal") sentences.push("It pays back, but slowly; compare it with shorter-payback options before committing capital.");
  }
  if (f.annualSavings.low < 0) sentences.push(`At the low end of the estimate range it would not save money (${usd(f.annualSavings.low)} a year), so the result depends on the assumptions.`);
  const headline =
    verdict === "attractive"
      ? `Financially attractive on these estimates: pays back in about ${yrs(pay ?? 0)} with a positive 10-year NPV.`
      : verdict === "marginal"
        ? `Pays back in about ${yrs(pay ?? 0)}: positive over ten years, but slow.`
        : "Not financially attractive on these estimates.";
  return { verdict, headline, sentences };
}

function quantityText(id: string, catalog: CatalogItem[], amounts: { coverage?: Partial<Record<string, number>>; quantities?: Partial<Record<string, number>> }, solarKw: number): string {
  if (id.startsWith("rooftop_solar")) return `${Math.round(solarKw).toLocaleString("en-US")} kW of panels`;
  const item = catalog.find((c) => c.id === id);
  if (!item) return "Whole scope";
  const q = item.quantity;
  const explicit = amounts.quantities?.[id];
  if (q.kind === "whole") return q.scope || "Whole hotel";
  const v = explicit ?? (amounts.coverage?.[id] !== undefined ? amounts.coverage[id]! * q.max : q.default);
  const n = Math.round(v).toLocaleString("en-US");
  return `${n}${q.unit === "%" ? "%" : ` ${q.unit}`}${q.scope ? ` ${q.scope}` : ""}`;
}

export interface HotelReportInput {
  kind: "ai" | "custom";
  hotel: ResolvedProfile;
  /** What the plan was measured against (the optimizer's baseline, which may be a what-if). */
  baseline: EnergyResult;
  evaluation: PackageEvaluation;
  planLabel: string;
  budget: number;
  discountRate: number;
  catalog: CatalogItem[];
  synthetic: boolean;
  /** Set when the plan was measured against a what-if. */
  scenarioNote?: string | null;
  /** Custom plan quantities, by upgrade (in the catalog unit). */
  quantities?: Partial<Record<string, number>>;
}

/** Every figure of a hotel investment report (AI package or custom plan), from the engine's evaluation and its baseline. */
export function buildHotelReport(i: HotelReportInput): HotelReportData {
  const p = i.hotel.profile;
  const e = i.evaluation;
  const f = e.financials;
  const b = i.baseline.annual;
  const a = e.outcome.annual;
  const area = p.floorAreaSqft || 1;
  const euiBefore = siteKBtu(b) / area;
  const euiAfter = siteKBtu(a) / area;
  const total = e.lineItems.reduce((s, l) => s + l.annualSavingsMid, 0);
  const contributionsAdd = Math.abs(total - f.annualSavings.mid) <= Math.max(1, Math.abs(f.annualSavings.mid) * 1e-6);
  const upgrades: ReportUpgradeLine[] = e.lineItems.map((li) => {
    const cat = i.catalog.find((c) => c.id === li.id || (li.id.startsWith("rooftop_solar") && c.id === "rooftop_solar"));
    const pay = li.annualSavingsMid > 0 ? li.cost.mid / li.annualSavingsMid : null;
    return {
      id: li.id,
      label: li.label,
      description: cat?.description ?? "",
      quantity: quantityText(li.id, i.catalog, { quantities: i.quantities ?? {} }, e.sizing.solarKw),
      installedCost: li.cost.mid,
      costRange: [li.cost.low, li.cost.high],
      annualSavings: li.annualSavingsMid,
      paybackYears: pay,
      lifetimeYears: li.lifetimeYears,
      paybackBeyondLife: pay !== null && pay > li.lifetimeYears,
      incentives: f.incentives
        .filter((x) => x.id.startsWith(`${li.id}:`))
        .map((x) => ({ label: x.label, amount: x.amount, applied: x.applied, note: x.note, source: x.source })),
      costStatus: cat?.costStatus ?? "estimate",
      source: li.source,
    };
  });
  // Equipment life of the package: savings-weighted average of its lines (for the payback-versus-life reading).
  const lifeWeight = e.lineItems.reduce((s, l) => s + Math.max(0, l.annualSavingsMid), 0);
  const life = lifeWeight > 0 ? e.lineItems.reduce((s, l) => s + Math.max(0, l.annualSavingsMid) * l.lifetimeYears, 0) / lifeWeight : null;
  const projection = (f.projection ?? []).map((y) => ({ year: y.year, savings: y.savings.mid, cumulative: y.cumulativeNet.mid, cumulativeNpv: y.cumulativeNpv }));
  const byCat = Object.entries(i.baseline.byCategory)
    .map(([k, v]) => ({ label: CATEGORY_LABEL[k] ?? k, cost: v.cost, share: b.cost > 0 ? v.cost / b.cost : 0 }))
    .sort((x, y) => y.cost - x.cost);
  const byZone = Object.entries(i.baseline.byZone)
    .map(([k, v]) => ({ label: ZONE_LABELS[k as keyof typeof ZONE_LABELS] ?? k, cost: v.cost, share: b.cost > 0 ? v.cost / b.cost : 0 }))
    .sort((x, y) => y.cost - x.cost);
  const listed = f.incentives.filter((x) => !x.applied).map((x) => ({ label: x.label, note: x.note }));
  const illustrative = illustrativeOf(f);
  const interpretation = interpretFinancials(f, b.cost, life);
  const risks = [
    ...(i.synthetic ? [`${p.name} is a synthetic demonstration hotel: its figures illustrate the method, not a real property.`] : []),
    ...(i.hotel.defaulted.length ? [`Some inputs use defaults (${i.hotel.defaulted.slice(0, 6).join(", ")}${i.hotel.defaulted.length > 6 ? ", …" : ""}); results change when they are replaced with the hotel's own data.`] : []),
    "Energy use is simulated from building characteristics, local weather normals and published benchmarks; it is not measured. The model has not been calibrated to this hotel's utility bills unless an annual bill was entered.",
    "Savings are planning estimates, shown with a low-to-high range; actual savings depend on the equipment chosen, its installation and how the hotel is operated.",
    ...(f.incentivesTotal > 0 ? ["Utility incentives use the published program rates, are estimated from the modeled equipment, need the utility's pre-approval and are subject to available funds; they are not guaranteed."] : []),
    ...(listed.length ? [`Incentives listed but not counted: ${listed.map((x) => x.label).join("; ")}.`] : []),
    ...(illustrative.length ? [`Shown for illustration only, not in the base case: ${illustrative.map((x) => `${x.label} (${usd(x.amount)})`).join("; ")}; these depend on a program rate that is not confirmed for the current year.`] : []),
    ...(upgrades.some((u) => u.costStatus !== "sourced") ? ["Some installed costs are assumptions or bounds rather than quotes; obtain contractor quotes before deciding."] : []),
    ...e.comfort.notes.map((n) => n.message),
    "Before investing, confirm equipment compatibility and scope with an energy audit or a qualified engineer.",
  ];
  return {
    kind: i.kind,
    title: "Investment decision summary",
    planName: e.name,
    planLabel: i.planLabel,
    hotel: {
      name: p.name,
      location: [p.city, p.state].filter(Boolean).join(", "),
      rooms: p.rooms,
      floorAreaSqft: p.floorAreaSqft,
      floors: p.floors ?? null,
      yearBuilt: p.yearBuilt,
      hvac: HVAC_LABEL[p.hvacType] ?? p.hvacType,
      occupancyPct: Math.round(p.occupancy * 100),
      electricityRate: p.electricityRate,
      gasRate: p.gasRate,
      synthetic: i.synthetic,
      defaulted: [...i.hotel.defaulted],
    },
    measuredAgainst: i.scenarioNote ?? null,
    budget: i.budget,
    current: {
      elecKWh: b.elecKWh,
      gasTherms: b.gasTherms,
      cost: b.cost,
      elecCost: b.elecCost,
      gasCost: b.gasCost,
      carbonKg: b.carbonKg,
      siteEui: euiBefore,
      byCategory: byCat,
      byZone,
    },
    after: { elecKWh: a.elecKWh, gasTherms: a.gasTherms, cost: a.cost, carbonKg: a.carbonKg, siteEui: euiAfter },
    comparison: [
      pair("Electricity", "kWh / yr", b.elecKWh, a.elecKWh),
      pair("Natural gas", "therms / yr", b.gasTherms, a.gasTherms),
      pair("Energy spending", "$ / yr", b.cost, a.cost),
      pair("Carbon emissions", "t CO2e / yr", b.carbonKg / 1000, a.carbonKg / 1000),
      pair("Energy intensity", "kBtu / ft² / yr", euiBefore, euiAfter),
    ],
    investment: {
      grossCost: f.grossCost.mid,
      grossRange: [f.grossCost.low, f.grossCost.high],
      incentivesApplied: f.incentivesTotal,
      incentivesListed: listed,
      illustrative,
      netIfIllustrative: illustrative.length && f.illustrativeIncentives ? f.illustrativeIncentives.netInvestment : null,
      netInvestment: f.netInvestment.mid,
      remainingBudget: i.budget - f.grossCost.mid,
      overBudget: f.grossCost.mid > i.budget,
    },
    financial: {
      annualSavings: f.annualSavings.mid,
      savingsRange: [f.annualSavings.low, f.annualSavings.high],
      savingsPctOfBill: b.cost > 0 ? f.annualSavings.mid / b.cost : 0,
      paybackYears: f.simplePaybackYears,
      npv5: f.npv5?.mid ?? 0,
      npv10: f.npv10?.mid ?? 0,
      netBenefit5: f.netBenefit5.mid,
      netBenefit10: f.netBenefit10.mid,
      discountRate: f.discountRate ?? i.discountRate,
      cumulative: [-f.netInvestment.mid, ...projection.map((y) => y.cumulative)],
      projection,
    },
    environment: {
      elecKWhSaved: f.annualEnergySavings.elecKWh,
      gasThermsSaved: f.annualEnergySavings.gasTherms,
      carbonKgAvoided: f.carbonAvoidedKgPerYear.mid,
      carbonPct: b.carbonKg > 0 ? f.carbonAvoidedKgPerYear.mid / b.carbonKg : 0,
    },
    upgrades,
    contributionsAdd,
    comfort: { score: e.comfort.score, notes: e.comfort.notes.map((n) => n.message) },
    interpretation,
    assumptions: [
      `Energy prices: electricity $${p.electricityRate.toFixed(4)} per kWh and natural gas $${p.gasRate.toFixed(3)} per therm (all-in averages for the hotel's location).`,
      ...f.assumptions,
      `Analysis horizon: 10 years (5- and 10-year results shown); equipment lives: ${upgrades.map((u) => `${u.label} ${u.lifetimeYears} years`).join("; ")}.`,
      `Occupancy ${Math.round(p.occupancy * 100)}% a year on average, with the hotel's seasonal pattern.`,
      ...(i.scenarioNote ? [i.scenarioNote] : []),
    ],
    risks,
    sources: [...new Set(upgrades.map((u) => u.source).concat(i.baseline.sources ?? []).filter(Boolean))]
      .slice(0, 10)
      .map((x) => (x.length > 320 ? `${x.slice(0, 317).trimEnd()}…` : x))
      .concat("Full source notes for every value are in the app's Sources panel and docs/14 (research log)."),
  };
}

export interface PortfolioReportInput {
  organization: string;
  city: string;
  synthetic: boolean;
  summary: PortfolioSummary;
  plan: PortfolioPlan;
  objectiveLabel: string;
}

/** Every figure of a portfolio investment report, from the portfolio summary and the shared-budget optimizer's plan. */
export function buildPortfolioReport(i: PortfolioReportInput): PortfolioReportData {
  const s = i.summary;
  const t = i.plan.totals;
  const area = s.properties.reduce((x, r) => x + r.floorAreaSqft, 0);
  const site = s.properties.reduce((x, r) => x + r.annual.siteKBtu, 0);
  const allocations = i.plan.allocations.map((al) => {
    const f = al.evaluation?.financials;
    return {
      name: al.name,
      packageName: al.evaluation?.name ?? null,
      grossCost: f?.grossCost.mid ?? 0,
      netInvestment: f?.netInvestment.mid ?? 0,
      annualSavings: f?.annualSavings.mid ?? 0,
      paybackYears: f?.simplePaybackYears ?? null,
      npv10: f?.npv10?.mid ?? 0,
      baselineCost: al.baselineCost,
      savingsPct: al.baselineCost > 0 ? (f?.annualSavings.mid ?? 0) / al.baselineCost : 0,
    };
  });
  const sentences = [
    `The plan spends ${usd(t.grossCost)} of the ${usd(i.plan.budget)} budget before incentives (${usd(t.netInvestment)} after ${usd(t.incentives)} of utility incentives) across ${t.propertiesWithPackage ?? allocations.filter((x) => x.packageName).length} of ${allocations.length} hotels.`,
    `It is projected to save ${usd(t.annualSavings)} a year, about ${Math.round(t.shareOfPortfolioCost * 100)}% of the portfolio's modeled energy cost${t.paybackYears !== null ? `, paying back in about ${yrs(t.paybackYears)} overall` : ""}.`,
    t.npv10 >= 0
      ? `Its 10-year net present value at ${Math.round(i.plan.discountRate * 100)}% is ${usd(t.npv10)}.`
      : `Its 10-year net present value at ${Math.round(i.plan.discountRate * 100)}% is ${usd(t.npv10)}: over ten years the savings do not cover the investment.`,
  ];
  const verdict: PortfolioReportData["interpretation"]["verdict"] = t.paybackYears === null || t.npv10 < 0 ? "unattractive" : t.paybackYears > 7 ? "marginal" : "attractive";
  return {
    kind: "portfolio",
    title: "Portfolio investment summary",
    organization: i.organization,
    city: i.city,
    synthetic: i.synthetic,
    budget: i.plan.budget,
    objective: i.objectiveLabel,
    discountRate: i.plan.discountRate,
    current: { hotels: s.properties.length, rooms: s.properties.reduce((x, r) => x + r.rooms, 0), cost: s.totals.cost, siteKBtu: site, floorAreaSqft: area, siteEui: area > 0 ? site / area : 0, carbonKg: s.properties.reduce((x, r) => x + r.annual.carbonKg, 0) },
    totals: t,
    allocations,
    properties: s.properties.map((r) => ({ name: r.name, rooms: r.rooms, cost: r.annual.cost, siteEui: r.floorAreaSqft > 0 ? r.annual.siteKBtu / r.floorAreaSqft : 0, priorityScore: r.priorityScore })).sort((a, b) => b.priorityScore - a.priorityScore),
    interpretation: {
      verdict,
      headline: verdict === "attractive" ? "Financially attractive on these estimates." : verdict === "marginal" ? "Pays back, but slowly." : "Not financially attractive on these estimates.",
      sentences,
    },
    assumptions: [
      `Each hotel is simulated on its own profile with the same engine and financial assumptions; NPV at ${Math.round(i.plan.discountRate * 100)}% a year.`,
      `Optimization: ${i.plan.method}`,
      ...i.plan.notes,
      ...s.definitions.slice(0, 4),
    ],
    risks: [
      ...(i.synthetic ? ["The portfolio's hotels are synthetic demonstration properties; the figures illustrate the method, not real hotels."] : []),
      "Energy use is simulated, not measured, and the model is not calibrated to each hotel's utility bills.",
      "Savings and costs are planning estimates with ranges; utility incentives need pre-approval and are not guaranteed.",
      "All hotels share Chicago weather normals and utility prices in this version.",
      "Confirm each hotel's scope with an energy audit or a qualified engineer before investing.",
    ],
    sources: ["Energy model: EIA CBECS lodging end uses, NOAA weather normals, EIA prices and outlook, EPA eGRID emissions, Illinois TRM savings, ComEd incentive worksheets (see the app's Sources panel)."],
    method: i.plan.method,
  };
}

/** A descriptive file name: EnergyTwin_LakeshoreInn_InvestmentReport_2026-11-12.pdf (the date is the user's, at click time). */
export function reportFileName(name: string, date: Date): string {
  const clean = name.replace(/[^A-Za-z0-9]+/g, " ").trim().split(" ").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join("") || "Hotel";
  const d = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  return `EnergyTwin_${clean}_InvestmentReport_${d}.pdf`;
}
