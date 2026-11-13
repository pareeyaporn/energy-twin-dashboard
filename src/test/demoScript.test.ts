// Task 8.8: every figure the demo script (docs/07) quotes, recomputed from the engine through the same store actions the app uses.
// The test fails when a figure in the script no longer matches the engine: then update the script (never the calculations).
// Print the current figures with: DEMO_FIGURES=1 npx vitest run src/test/demoScript.test.ts
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { useTwin } from "@/store/useTwin";
import { selectAllProperties, selectDisplayed, selectHourState, selectPortfolioSummary, selectUpgradeComparison } from "@/store/hotelDerived";
import { ZONE_IDS, ZONE_LABELS } from "@/engine/hotel";
import type { RankedPackage } from "@/engine/hotel";

const usd = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;
const yrs = (n: number | null) => (n === null ? "never" : `${n.toFixed(1)} years`);

async function optimize() {
  vi.useFakeTimers();
  const run = useTwin.getState().runHotelOptimizer();
  await vi.advanceTimersByTimeAsync(2100);
  await run;
  vi.useRealTimers();
  const plan = useTwin.getState().hotelPlan!;
  expect(plan).not.toBeNull();
  return plan;
}

async function optimizePortfolio() {
  vi.useFakeTimers();
  const run = useTwin.getState().runPortfolioOptimizer();
  await vi.advanceTimersByTimeAsync(3000);
  await run;
  vi.useRealTimers();
  const plan = useTwin.getState().portfolioPlan!;
  expect(plan).not.toBeNull();
  return plan;
}

/** The demo path (docs/07, November 2026 version), act by act, with the figures each act says. */
export async function demoFigures(): Promise<{ figures: Record<string, string>; names: Record<string, string> }> {
  const t = () => useTwin.getState();
  const f: Record<string, string> = {};
  const names: Record<string, string> = {};
  t().resetDemo();

  // Act 1: the portfolio (3D map, KPIs, top opportunity).
  const sum = selectPortfolioSummary(t());
  f["portfolio hotels"] = String(selectAllProperties(t()).filter((p) => p.organizationId === t().organizationId).length);
  f["portfolio energy cost"] = usd(sum.totals.cost);
  f["portfolio savings potential"] = usd(sum.totals.savingsPotential);
  f["portfolio savings share"] = `${((sum.totals.savingsPotential / sum.totals.cost) * 100).toFixed(1)}%`;
  const first = [...sum.properties].sort((a, b) => b.priorityScore - a.priorityScore)[0]!;
  names["top hotel"] = first.name;
  f["top opportunity saves / yr"] = usd(first.potential!.annualSavings);
  f["top opportunity net investment"] = usd(first.potential!.netInvestment);
  f["top opportunity payback"] = yrs(first.potential!.paybackYears);
  const spender = [...sum.properties].sort((a, b) => b.annual.cost - a.annual.cost)[0]!;
  names["biggest spender"] = spender.name;
  f["biggest spender cost"] = usd(spender.annual.cost);

  // Act 2: one budget across the chain (the page's default budget and objective).
  const pp = await optimizePortfolio();
  f["portfolio budget"] = usd(pp.budget);
  f["portfolio plan saves / yr"] = usd(pp.totals.annualSavings);
  f["portfolio plan payback"] = yrs(pp.totals.paybackYears);
  f["portfolio hotels funded"] = `${pp.allocations.filter((a) => a.evaluation).length} of ${pp.allocations.length}`;

  // Act 3: fly into the top hotel; the twin, a January night, a July afternoon, the carbon view.
  t().openProperty(first.id);
  const s = t();
  f["hotel cost"] = usd(s.baseline.annual.cost);
  const zones = [...ZONE_IDS].sort((a, b) => s.baseline.byZone[b].cost - s.baseline.byZone[a].cost);
  f[`zone 1: ${ZONE_LABELS[zones[0]!]}`] = usd(s.baseline.byZone[zones[0]!].cost);
  t().setTime({ mode: "seasons", month: 0, hour: 21 });
  f["January night heating"] = `${Math.round(selectHourState(t()).demandKW.heating)} kW`;
  t().setTime({ month: 6, hour: 15 });
  f["July afternoon cooling"] = `${Math.round(selectHourState(t()).demandKW.cooling)} kW`;
  const a = s.baseline.annual;
  const gasCarbon = a.gasTherms * s.baseline.emissionFactors.gasKgPerTherm;
  f["gas share of the bill"] = `${Math.round((a.gasCost / a.cost) * 100)}%`;
  f["gas share of the carbon"] = `${Math.round((gasCarbon / a.carbonKg) * 100)}%`;
  f["hotel carbon"] = `${Math.round(a.carbonKg / 1000).toLocaleString("en-US")} t`;

  // Act 4: ask the AI "What if occupancy rises to 85%?" (the run_scenario tool), then Apply this what-if (the same scenario).
  t().setScenario({ occupancy: 0.85 });
  const occ = selectDisplayed(t()).result.annual.cost;
  f["85% occupancy cost"] = usd(occ);
  f["85% occupancy rise"] = usd(occ - s.baseline.annual.cost);

  // Act 5: the hotel's budget on that scenario (the optimizer follows the scenario).
  const plan = await optimize();
  f["hotel budget"] = usd(t().hotel.profile.budget);
  f["combinations tested"] = plan.combinationsTested.toLocaleString("en-US");
  f["feasible packages"] = plan.feasibleCount.toLocaleString("en-US");
  const top = plan.packages[0] as RankedPackage;
  const tf = top.evaluation.financials;
  names["top package"] = top.evaluation.name;
  f["top net"] = usd(tf.netInvestment.mid);
  f["top saves / yr"] = usd(tf.annualSavings.mid);
  f["top payback"] = yrs(tf.simplePaybackYears);
  f["top 10-year net benefit"] = usd(tf.netBenefit10.mid);
  f["top CO2 / yr"] = `${Math.round(tf.carbonAvoidedKgPerYear.mid / 1000)} t`;
  const solar = selectUpgradeComparison(t()).find((r) => r.id === "rooftop_solar");
  if (solar) {
    f["solar cost"] = usd(solar.financials.grossCost.mid);
    f["solar payback"] = yrs(solar.financials.simplePaybackYears);
  }
  t().applyHotelPackage(top.evaluation.id);
  f["after applying top package"] = usd(selectDisplayed(t()).result.annual.cost);
  t().resetDemo();
  return { figures: f, names };
}

describe("demo script figures (docs/07)", () => {
  it("every figure the script quotes matches the engine", async () => {
    const { figures: f, names } = await demoFigures();
    if (process.env["DEMO_FIGURES"]) console.log(Object.entries({ ...f, ...names }).map(([k, v]) => `${k.padEnd(30)} ${v}`).join("\n"));
    const script = readFileSync("docs/07_DEMO_CHECKLIST.md", "utf8");
    const section = script.slice(script.indexOf("## Demo path"), script.indexOf("## Q&A prep"));
    // Each figure must appear in bold, exactly as the app formats it (package names are said in short, so they are printed only).
    const missing = Object.entries(f).filter(([, v]) => !section.includes(`**${v}**`));
    expect(missing, "update docs/07 with these engine figures").toEqual([]);
    expect(names["top hotel"]).toBe("Riverwalk Grand");
  }, 60_000);
});
