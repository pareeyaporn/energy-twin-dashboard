// Report data for what the user is looking at, read from the store (read-only: building a report changes nothing).
import { PORTFOLIO_OBJECTIVES, hotelData } from "@/engine/hotel";
import type { TwinState } from "@/store/useTwin";
import {
  selectActiveHotelPackage,
  selectCatalog,
  selectCustomPlanEvaluation,
  selectIsSynthetic,
  selectPlanContext,
  selectPortfolioSummary,
  selectUtilityAnalysis,
  selectUtilitySet,
} from "@/store/hotelDerived";
import { PROVENANCE_LABEL } from "@/store/utilityData";
import { buildHotelReport, buildPortfolioReport } from "./data";
import type { HotelReportData, PortfolioReportData, ReportUtility } from "./data";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** The open hotel's utility records for the report: source, period, actual vs modeled vs calibrated, the active baseline (docs/19). */
export function utilityForReport(s: TwinState): ReportUtility | null {
  const set = selectUtilitySet(s);
  const a = selectUtilityAnalysis(s);
  if (!set || !a) return null;
  const months = set.records.map((r) => r.month).filter((m): m is number => typeof m === "number");
  const dated = set.records.filter((r) => r.start && r.end);
  const period = dated.length
    ? `${dated[0]!.start} to ${dated[dated.length - 1]!.end} (${set.records.length} bills)`
    : months.length
      ? `${MONTHS[Math.min(...months)]}–${MONTHS[Math.max(...months)]} ${set.year} (${set.records.length} monthly records)`
      : `${set.records.length} records`;
  const calibratedActive = set.baseline === "calibrated" && s.baseline.calibration.method === "utility_bills";
  const fuel = (f: typeof a.report.elec, label: string) => ({
    fuel: label,
    unit: f.unit,
    bills: f.bills,
    coverageDays: f.coverageDays,
    actual: f.actualTotal,
    modeled: f.modeledTotal,
    calibrated: f.calibratedTotal,
    nmbeBefore: f.before?.nmbePct ?? null,
    cvrmseBefore: f.before?.cvrmsePct ?? null,
    nmbeAfter: f.usable ? (f.after?.nmbePct ?? null) : null,
    cvrmseAfter: f.usable ? (f.after?.cvrmsePct ?? null) : null,
    calibrated_used: f.usable && calibratedActive,
    note: f.reason,
  });
  const synthetic = (set.provenance === "sample" || set.provenance === "sample_edited") && !set.markedActual;
  return {
    source: PROVENANCE_LABEL[set.provenance] + (set.fileName ? ` (${set.fileName})` : ""),
    synthetic,
    billingPeriod: period,
    activeBaseline: calibratedActive ? "Calibrated baseline (fitted to the records)" : "Original modeled baseline",
    fuels: [fuel(a.report.elec, "Electricity"), fuel(a.report.gas, "Natural gas")],
    limits: [
      "Bills are compared with normal-year weather (NOAA 1991–2020), not the billing year's weather.",
      "Monthly records calibrate monthly totals; no hourly accuracy is claimed.",
      ...(synthetic ? ["These records are synthetic sample data, not the hotel's real bills."] : []),
    ],
  };
}

/**
 * Synthetic when the app says so, and also when the hotel was started from a synthetic sample and only edited (for example its
 * budget): editing a sample's budget does not make its building data real.
 */
export function isSyntheticHotel(s: TwinState): boolean {
  if (selectIsSynthetic(s)) return true;
  if (s.activePropertyId) return false;
  return hotelData.presets.some((p) => p.synthetic !== false && p.input.name === s.hotelInput.name);
}

const SCENARIO_NOTE = "Measured against the current what-if (the scenario or stress test running when the optimizer ran), not today's baseline.";

/** The AI package on screen: the applied one, else the given role, else the objective winner. */
export function aiReportFromState(s: TwinState, role?: string): HotelReportData | null {
  const plan = s.hotelPlan;
  if (!plan) return null;
  const pkg = (role ? plan.packages.find((p) => p.role === role) : null) ?? selectActiveHotelPackage(s) ?? plan.objectiveWinner ?? plan.packages[0] ?? null;
  if (!pkg) return null;
  return buildHotelReport({
    kind: "ai",
    hotel: s.hotel,
    baseline: s.hotelPlanBaseline ?? s.baseline,
    evaluation: pkg.evaluation,
    planLabel: `AI recommended · ${pkg.roleLabel}`,
    budget: plan.budget,
    discountRate: s.hotelDiscountRate,
    catalog: selectCatalog(s).items,
    synthetic: isSyntheticHotel(s),
    scenarioNote: plan.scenario ? SCENARIO_NOTE : null,
    utility: utilityForReport(s),
  });
}

/** A custom plan, evaluated by the same engine and assumptions as the AI packages. */
export function customReportFromState(s: TwinState, planId?: string): HotelReportData | null {
  const ev = selectCustomPlanEvaluation(s, planId);
  const plan = planId ? s.customPlans.find((p) => p.id === planId) : s.customPlans.find((p) => p.id === s.activeCustomPlanId);
  if (!ev?.evaluation || !plan) return null;
  const ctx = selectPlanContext(s);
  const quantities: Record<string, number> = {};
  for (const it of ev.items) quantities[it.id] = it.quantity;
  return buildHotelReport({
    kind: "custom",
    hotel: s.hotel,
    baseline: ctx.baseline,
    evaluation: ev.evaluation,
    planLabel: `Custom plan · ${plan.name}`,
    budget: ev.budget,
    discountRate: s.hotelDiscountRate,
    catalog: selectCatalog(s).items,
    synthetic: isSyntheticHotel(s),
    scenarioNote: s.optimizeOnScenario && s.scenarioResult ? SCENARIO_NOTE : null,
    quantities,
    utility: utilityForReport(s),
  });
}

/** The portfolio optimizer's plan for the chain shown on the Portfolio page. */
export function portfolioReportFromState(s: TwinState): PortfolioReportData | null {
  const plan = s.portfolioPlan;
  if (!plan) return null;
  return buildPortfolioReport({
    organization: s.portfolio.name,
    city: s.portfolio.city,
    synthetic: s.portfolio.synthetic,
    summary: selectPortfolioSummary(s),
    plan,
    objectiveLabel: PORTFOLIO_OBJECTIVES.find((o) => o.id === plan.objective)?.label ?? plan.objective,
  });
}
