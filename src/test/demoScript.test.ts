// Task 8.8: every figure the demo script (docs/07) quotes, recomputed from the engine through the same store actions the app uses.
// The test fails when a figure in the script no longer matches the engine: then update the script (never the calculations).
// Print the current figures with: DEMO_FIGURES=1 npx vitest run src/test/demoScript.test.ts
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { useTwin } from "@/store/useTwin";
import { selectAllProperties, selectDisplayed, selectHourState, selectPortfolioSummary, selectUpgradeComparison } from "@/store/hotelDerived";
import { ZONE_IDS, ZONE_LABELS, benchmarkComparison } from "@/engine/hotel";
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

/** The demo path, act by act, with the figures each act says. */
export async function demoFigures(): Promise<{ figures: Record<string, string>; names: Record<string, string> }> {
  const t = () => useTwin.getState();
  const f: Record<string, string> = {};
  const names: Record<string, string> = {};
  t().resetDemo();

  // Act 1 and 2: the 100-room hotel.
  const s = t();
  f["baseline cost"] = usd(s.baseline.annual.cost);
  const zones = [...ZONE_IDS].sort((a, b) => s.baseline.byZone[b].cost - s.baseline.byZone[a].cost);
  zones.slice(0, 3).forEach((z, i) => (f[`zone ${i + 1}: ${ZONE_LABELS[z]}`] = usd(s.baseline.byZone[z].cost)));
  const bench = benchmarkComparison(s.baseline, s.hotel.profile.floorAreaSqft);
  const star = bench.peers.find((p) => p.id.startsWith("energy_star"))!;
  f["site EUI"] = `${bench.siteEuiKBtuPerSqft.toFixed(1)} kBtu/ft²`;
  f["vs ENERGY STAR median"] = `${Math.round(star.difference * 100)}% above the ENERGY STAR hotel median of ${star.siteEuiKBtuPerSqft.toFixed(0)}`;

  // Act 3: a living building (the 3D presets January night 21:00 and July afternoon 15:00).
  t().setTime({ mode: "seasons", month: 0, hour: 21 });
  f["January night heating"] = `${Math.round(selectHourState(t()).demandKW.heating)} kW`;
  t().setTime({ month: 6, hour: 15 });
  f["July afternoon cooling"] = `${Math.round(selectHourState(t()).demandKW.cooling)} kW`;

  // Act 4: occupancy 60% → 85%, then smart room controls.
  t().setScenario({ occupancy: 0.85 });
  const occ = selectDisplayed(t()).result.annual.cost;
  f["85% occupancy cost"] = usd(occ);
  f["85% occupancy rise"] = usd(occ - s.baseline.annual.cost);
  t().setScenario({ smartRoomControls: true });
  const smart = selectDisplayed(t()).result.annual.cost;
  f["smart controls save at 85%"] = usd(occ - smart);

  // Act 5: $50,000 on the scenario.
  t().setHotelBudget(50_000);
  const plan = await optimize();
  f["combinations tested"] = plan.combinationsTested.toLocaleString("en-US");
  f["feasible packages"] = plan.feasibleCount.toLocaleString("en-US");
  const top = plan.packages[0] as RankedPackage;
  const tf = top.evaluation.financials;
  names["top package"] = top.evaluation.name;
  f["top gross"] = usd(tf.grossCost.mid);
  f["top incentives"] = usd(tf.incentivesTotal);
  f["top net"] = usd(tf.netInvestment.mid);
  f["top saves / yr"] = usd(tf.annualSavings.mid);
  f["top payback"] = yrs(tf.simplePaybackYears);
  f["top 10-year net benefit"] = usd(tf.netBenefit10.mid);
  f["top CO2 / yr"] = `${Math.round(tf.carbonAvoidedKgPerYear.mid / 1000)} t`;
  // ComEd's 2025 lighting rate: shown separately, not counted (the program-year rule, docs/15).
  const ti = tf.illustrativeIncentives;
  if (ti) {
    f["top illustrative incentive"] = usd(ti.total);
    f["top illustrative net"] = usd(ti.netInvestment);
    f["top illustrative payback"] = yrs(ti.simplePaybackYears);
  }
  const fast = plan.packages.find((p) => p.role === "fastest_payback");
  if (fast) {
    names["fastest payback package"] = fast.evaluation.name;
    f["fastest payback"] = yrs(fast.evaluation.financials.simplePaybackYears);
  }
  const solar = selectUpgradeComparison(t()).find((r) => r.id === "rooftop_solar");
  if (solar) {
    f["solar cost"] = usd(solar.financials.grossCost.mid);
    f["solar payback"] = yrs(solar.financials.simplePaybackYears);
  }
  t().applyHotelPackage(top.evaluation.id);
  f["after applying top package"] = usd(selectDisplayed(t()).result.annual.cost);

  // Act 7: the 300-room preset at $150,000 (the preset resets the scenario).
  t().selectHotelPreset("demo-chicago-300");
  f["300-room baseline"] = usd(t().baseline.annual.cost);
  t().setHotelBudget(150_000);
  const big = (await optimize()).packages[0]!;
  const bf = big.evaluation.financials;
  names["300 package"] = big.evaluation.name;
  f["300 gross"] = usd(bf.grossCost.mid);
  f["300 net"] = usd(bf.netInvestment.mid);
  f["300 saves / yr"] = usd(bf.annualSavings.mid);
  f["300 payback"] = yrs(bf.simplePaybackYears);
  if (bf.illustrativeIncentives) f["300 illustrative net"] = usd(bf.illustrativeIncentives.netInvestment);

  // Portfolio (optional act): the chain.
  t().resetDemo();
  const sum = selectPortfolioSummary(t());
  f["portfolio hotels"] = String(selectAllProperties(t()).filter((p) => p.organizationId === t().organizationId).length);
  f["portfolio energy cost"] = usd(sum.totals.cost);
  f["portfolio savings potential"] = usd(sum.totals.savingsPotential);
  const first = [...sum.properties].sort((a, b) => b.priorityScore - a.priorityScore)[0]!;
  f["portfolio top priority"] = `${first.name} (${first.priorityScore} of 100)`;
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
    expect(names["top package"]).toMatch(/LED lighting/);
    expect(names["300 package"]).toMatch(/insulation.*LED.*Occupancy sensors/i);
  }, 60_000);
});
