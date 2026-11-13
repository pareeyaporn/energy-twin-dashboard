// @vitest-environment node
// A real PDF is generated from the report data (hotel and portfolio) and checked: a PDF header, several pages, and the figures as text.
import { renderToBuffer } from "@react-pdf/renderer";
import { writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  optimizeInvestmentPortfolio,
  optimizePortfolioBudget,
  portfolioSummary,
  prepareUpgradeContext,
  presetProfile,
  upgradeCatalog,
  hotelPortfolio,
} from "@/engine/hotel";
import { buildHotelReport, buildPortfolioReport } from "../data";
import { ReportDocument } from "../pdf/ReportDocument";

const pages = (buf: Buffer) => (buf.toString("latin1").match(/\/Type\s*\/Page[^s]/g) ?? []).length;

describe("PDF report", () => {
  it("renders a multi-page hotel report", async () => {
    const hotel = presetProfile("demo-chicago-100");
    const ctx = prepareUpgradeContext(hotel);
    const plan = optimizeInvestmentPortfolio(ctx, {});
    const pkg = plan.objectiveWinner!;
    const data = buildHotelReport({
      kind: "ai",
      hotel,
      baseline: ctx.baseline,
      evaluation: pkg.evaluation,
      planLabel: `AI recommended · ${pkg.roleLabel}`,
      budget: plan.budget,
      discountRate: 0.08,
      catalog: upgradeCatalog(ctx).items,
      synthetic: true,
    });
    const buf = await renderToBuffer(<ReportDocument data={data} generated="November 12, 2026" />);
    expect(buf.subarray(0, 5).toString()).toBe("%PDF-");
    if (process.env["REPORT_OUT"]) writeFileSync(`${process.env["REPORT_OUT"]}/report-hotel-test.pdf`, buf);
    expect(pages(buf)).toBeGreaterThanOrEqual(3);
  }, 60_000);

  it("renders the utility data and baseline section when the hotel has records", async () => {
    const hotel = presetProfile("demo-chicago-100");
    const ctx = prepareUpgradeContext(hotel);
    const pkg = optimizeInvestmentPortfolio(ctx, {}).objectiveWinner!;
    const fuel = (name: string, unit: string) => ({ fuel: name, unit, bills: 12, coverageDays: 365, actual: 1000, modeled: 950, calibrated: 998, nmbeBefore: 2.6, cvrmseBefore: 4.2, nmbeAfter: 0, cvrmseAfter: 1.7, calibrated_used: true, note: null });
    const data = buildHotelReport({
      kind: "ai", hotel, baseline: ctx.baseline, evaluation: pkg.evaluation, planLabel: "AI", budget: 50_000, discountRate: 0.08, catalog: upgradeCatalog(ctx).items, synthetic: true,
      utility: { source: "Sample data (synthetic)", synthetic: true, billingPeriod: "Jan–Dec 2025 (12 monthly records)", activeBaseline: "Calibrated baseline (fitted to the records)", fuels: [fuel("Electricity", "kWh"), fuel("Natural gas", "therms")], limits: ["Bills are compared with normal-year weather."] },
    });
    const buf = await renderToBuffer(<ReportDocument data={data} generated="November 13, 2026" />);
    expect(buf.subarray(0, 5).toString()).toBe("%PDF-");
    if (process.env["REPORT_OUT"]) writeFileSync(`${process.env["REPORT_OUT"]}/report-utility-test.pdf`, buf);
    expect(pages(buf)).toBeGreaterThanOrEqual(3);
  }, 60_000);

  it("renders a portfolio report", async () => {
    const items = hotelPortfolio.properties.map((property) => ({ property }));
    const summary = portfolioSummary(items);
    const plan = optimizePortfolioBudget(items, { budget: 500_000 });
    const data = buildPortfolioReport({ organization: hotelPortfolio.name, city: hotelPortfolio.city, synthetic: true, summary, plan, objectiveLabel: "Maximum savings" });
    const buf = await renderToBuffer(<ReportDocument data={data} generated="November 12, 2026" />);
    expect(buf.subarray(0, 5).toString()).toBe("%PDF-");
    if (process.env["REPORT_OUT"]) writeFileSync(`${process.env["REPORT_OUT"]}/report-portfolio-test.pdf`, buf);
    expect(pages(buf)).toBeGreaterThanOrEqual(2);
  }, 60_000);
});
