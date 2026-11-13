import { advisor } from "@/engine/hotel";
import type { ReportData } from "./data";

/**
 * The context the AI's executive summary may use: the report's own figures (docs/18), without the utility bills (privacy: monthly
 * bill values never leave for the summary) and without long text. Shares are also given as percentages and kilograms as tonnes,
 * the units the report prints, so a sentence quoting the report passes the number check. Nothing is calculated beyond those unit
 * conversions.
 */
export function reportSummaryContext(data: ReportData): Record<string, unknown> {
  const walk = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.slice(0, 24).map(walk);
    if (v && typeof v === "object") {
      const out: Record<string, unknown> = {};
      for (const [k, x] of Object.entries(v)) {
        if (k === "utility" || k === "aiSummary" || k === "sources" || k === "assumptions") continue;
        if (typeof x === "string" && x.length > 300) continue;
        out[k] = walk(x);
        if (typeof x === "number" && /pct|share|rate/i.test(k) && Math.abs(x) <= 1.5) out[`${k}AsPercent`] = Math.round(x * 1000) / 10;
        if (typeof x === "number" && /kg/i.test(k)) out[`${k.replace(/kg/i, "")}Tonnes`] = Math.round(x / 100) / 10;
      }
      return out;
    }
    return v;
  };
  return { report: walk(data), hasUtilityData: data.kind !== "portfolio" && !!data.utility };
}

/**
 * The report with an AI executive summary added, if the AI is set up, answers within 8 seconds and every number in the summary is in
 * the report. Otherwise the report is returned unchanged (no summary; nothing else appears).
 */
export async function withAiSummary(data: ReportData, config: advisor.AdvisorConfig = advisor.getAdvisorConfig()): Promise<ReportData> {
  if (!config.endpoint) return data;
  const ctx = reportSummaryContext(data);
  if (JSON.stringify(ctx).length > 50_000) return data;
  const r = await advisor.askAdvisorText("report_summary", ctx, "", config);
  return r.source === "ai" && r.text ? { ...data, aiSummary: r.text } : data;
}
