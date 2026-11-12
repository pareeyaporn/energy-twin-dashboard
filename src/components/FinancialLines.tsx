import { useMemo, useState } from "react";
import { ArrowUpDown, BookOpen, LayoutGrid, Table2 } from "lucide-react";
import { useShallow } from "zustand/react/shallow";
import { useTwin } from "@/store/useTwin";
import { selectUpgradeComparison } from "@/store/hotelDerived";
import type { FinancialBreakdown } from "@/engine/hotel/types";
import type { UpgradeComparisonRow } from "@/engine/hotel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

// Display formatting only; values come straight from the engine's financial breakdown.
export const fmtMoney = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const fmtNum = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 0 });
const fmtRange = (r: { low: number; high: number }) => `${fmtMoney(r.low)} to ${fmtMoney(r.high)}`;
export const fmtPayback = (n: number | null) => (n === null ? "No payback" : `${n.toFixed(1)} years`);
const fmtTonnes = (kg: number) => `${(kg / 1000).toLocaleString("en-US", { maximumFractionDigits: 1 })} t`;
export const fmtEnergy = (f: FinancialBreakdown) => {
  const { elecKWh, gasTherms } = f.annualEnergySavings;
  const part = (v: number, unit: string) => (v < 0 ? `adds ${fmtNum(-v)} ${unit}` : `${fmtNum(v)} ${unit}`);
  return [part(elecKWh, "kWh"), gasTherms !== 0 ? part(gasTherms, "therms") : null].filter(Boolean).join(" · ");
};

function Incentives({ f }: { f: FinancialBreakdown }) {
  const applied = f.incentives.filter((i) => i.applied);
  const notApplied = f.incentives.filter((i, n, all) => !i.applied && all.findIndex((o) => !o.applied && o.label === i.label) === n);
  if (applied.length > 0) return <span className="num">{fmtMoney(f.incentivesTotal)}</span>;
  return <TooltipProvider delayDuration={200}><span className="inline-flex flex-wrap items-center justify-end gap-1"><span>None applied</span>{notApplied.map((i) => <Tooltip key={i.label}><TooltipTrigger asChild><button type="button" className="rounded border border-border px-1 text-[10px] text-muted-foreground underline-offset-2 hover:underline">{i.label}</button></TooltipTrigger><TooltipContent className="max-w-64">{i.note}</TooltipContent></Tooltip>)}</span></TooltipProvider>;
}

const neg = (n: number) => (n < 0 ? "text-heat" : undefined);

/** The same eight estimate lines for every upgrade and package. */
export function FinancialLines({ f, dense = false }: { f: FinancialBreakdown; dense?: boolean }) {
  const row = (label: string, value: React.ReactNode, sub?: React.ReactNode, cls?: string) => <div className="space-y-0.5"><div className="flex justify-between gap-3"><dt className="shrink-0 whitespace-nowrap text-muted-foreground">{label}</dt><dd className={cn("num text-right font-medium", cls)}>{value}</dd></div>{sub && <div className={cn("text-right text-[11px] text-muted-foreground", cls)}>{sub}</div>}</div>;
  return <dl className={cn("space-y-2", dense ? "text-xs" : "text-sm")}>
    {row("1 Gross installation cost", fmtMoney(f.grossCost.mid), fmtRange(f.grossCost))}
    {row("2 Incentives", <Incentives f={f} />)}
    {row("3 Net upfront investment", fmtMoney(f.netInvestment.mid))}
    {row("4 Annual energy savings", fmtEnergy(f))}
    {row("5 Annual savings", <span className="text-savings">{fmtMoney(f.annualSavings.mid)}</span>, `${fmtRange(f.annualSavings)} / yr`)}
    {row("6 Simple payback", fmtPayback(f.simplePaybackYears))}
    {row("7 Net benefit, 5 years", fmtMoney(f.netBenefit5.mid), fmtRange(f.netBenefit5), neg(f.netBenefit5.mid))}
    {row("   Net benefit, 10 years", fmtMoney(f.netBenefit10.mid), fmtRange(f.netBenefit10), neg(f.netBenefit10.mid))}
    {row("8 CO2, estimate / yr", fmtTonnes(f.carbonAvoidedKgPerYear.mid))}
    {f.solar && <div className="space-y-1 rounded-md border border-border p-2 text-xs"><p className="font-medium">Solar</p>
      {[["Size", `${f.solar.sizeKw.toLocaleString("en-US", { maximumFractionDigits: 1 })} kW`], ["Yearly generation", `${fmtNum(f.solar.generationKWh)} kWh`], ["Used on site", `${fmtNum(f.solar.selfConsumedKWh)} kWh`], ["Exported", `${fmtNum(f.solar.exportedKWh)} kWh`], ["Installed cost", `$${f.solar.installedCostPerW.toFixed(2)}/W`]].map(([l, v]) => <div key={l} className="flex justify-between gap-2"><span className="text-muted-foreground">{l}</span><span className="num">{v}</span></div>)}
    </div>}
  </dl>;
}

export function Assumptions({ f }: { f: FinancialBreakdown }) {
  if (f.assumptions.length === 0) return null;
  return <ul className="space-y-1 text-[11px] leading-snug text-muted-foreground">{f.assumptions.map((a) => <li key={a}>{a}</li>)}</ul>;
}

function SourceChip({ label, source }: { label: string; source: string }) {
  const open = useTwin((s) => s.setSourcesOpen);
  return <Button variant="outline" size="sm" className="h-auto min-h-6 max-w-full whitespace-normal py-0.5 text-left text-[10px]" aria-label={`Source for ${label}`} onClick={() => open(true)}><BookOpen className="shrink-0" />{source}</Button>;
}

type SortKey = "label" | "gross" | "incentives" | "net" | "kwh" | "savings" | "payback" | "nb5" | "nb10" | "co2";
const columns: { key: SortKey; label: string; value: (r: UpgradeComparisonRow) => number | string; show: (r: UpgradeComparisonRow) => React.ReactNode }[] = [
  { key: "label", label: "Upgrade", value: (r) => r.label, show: (r) => r.label },
  { key: "gross", label: "Gross cost", value: (r) => r.financials.grossCost.mid, show: (r) => fmtMoney(r.financials.grossCost.mid) },
  { key: "incentives", label: "Incentives", value: (r) => r.financials.incentivesTotal, show: (r) => r.financials.incentives.some((i) => i.applied) ? fmtMoney(r.financials.incentivesTotal) : "None applied" },
  { key: "net", label: "Net investment", value: (r) => r.financials.netInvestment.mid, show: (r) => fmtMoney(r.financials.netInvestment.mid) },
  { key: "kwh", label: "Energy saved / yr", value: (r) => r.financials.annualEnergySavings.elecKWh, show: (r) => fmtEnergy(r.financials) },
  { key: "savings", label: "Savings / yr", value: (r) => r.financials.annualSavings.mid, show: (r) => fmtMoney(r.financials.annualSavings.mid) },
  { key: "payback", label: "Payback", value: (r) => r.financials.simplePaybackYears ?? Number.POSITIVE_INFINITY, show: (r) => fmtPayback(r.financials.simplePaybackYears) },
  { key: "nb5", label: "Net benefit 5 yr", value: (r) => r.financials.netBenefit5.mid, show: (r) => <span className={neg(r.financials.netBenefit5.mid)}>{fmtMoney(r.financials.netBenefit5.mid)}</span> },
  { key: "nb10", label: "Net benefit 10 yr", value: (r) => r.financials.netBenefit10.mid, show: (r) => <span className={neg(r.financials.netBenefit10.mid)}>{fmtMoney(r.financials.netBenefit10.mid)}</span> },
  { key: "co2", label: "CO2, estimate / yr", value: (r) => r.financials.carbonAvoidedKgPerYear.mid, show: (r) => fmtTonnes(r.financials.carbonAvoidedKgPerYear.mid) },
];

export function UpgradeComparison({ compact = false }: { compact?: boolean }) {
  const rows = useTwin(useShallow(selectUpgradeComparison));
  const [view, setView] = useState<"cards" | "table">("cards");
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 } | null>(null);
  const sorted = useMemo(() => {
    if (!sort) return rows;
    const col = columns.find((c) => c.key === sort.key)!;
    return [...rows].sort((a, b) => { const x = col.value(a), y = col.value(b); return (typeof x === "string" ? x.localeCompare(String(y)) : x - (y as number)) * sort.dir; });
  }, [rows, sort]);
  return <section aria-label="Upgrade comparison" className="space-y-3">
    <div className="flex flex-wrap items-center justify-between gap-2"><div className="flex items-center gap-2"><h2 className="font-semibold">Compare upgrades</h2><Badge variant="outline" className="text-muted-foreground">Estimate</Badge></div>
      <div className="flex gap-1" role="group" aria-label="Comparison view"><Button size="sm" variant={view === "cards" ? "secondary" : "ghost"} className="h-7" aria-pressed={view === "cards"} onClick={() => setView("cards")}><LayoutGrid />Cards</Button><Button size="sm" variant={view === "table" ? "secondary" : "ghost"} className="h-7" aria-pressed={view === "table"} onClick={() => setView("table")}><Table2 />Table</Button></div></div>
    {rows.length === 0 ? <p className="text-sm text-muted-foreground">No eligible upgrades for this hotel.</p> : view === "cards" ? <div className={cn("grid items-start gap-3", !compact && "md:grid-cols-2 xl:grid-cols-3")}>{rows.map((r) => <article key={r.id} className="min-w-0 space-y-3 rounded-lg border border-border bg-card p-3"><div className="flex items-start justify-between gap-2"><h3 className="text-sm font-semibold">{r.label}</h3><Badge variant="outline" className="shrink-0 text-muted-foreground">Estimate</Badge></div><FinancialLines f={r.financials} dense /><Assumptions f={r.financials} /><SourceChip label={r.label} source={r.source} /></article>)}</div>
      : <div className="overflow-x-auto"><table className="w-full min-w-[960px] text-xs"><caption className="sr-only">Estimated upgrade comparison</caption><thead><tr className="border-b border-border">{columns.map((c) => <th key={c.key} className={cn("p-2", c.key === "label" ? "text-left" : "text-right")} aria-sort={sort?.key === c.key ? (sort.dir === 1 ? "ascending" : "descending") : "none"}><button type="button" className="inline-flex items-center gap-1 hover:text-primary" onClick={() => setSort((s) => ({ key: c.key, dir: s?.key === c.key && s.dir === 1 ? -1 : 1 }))}>{c.label}<ArrowUpDown className="h-3 w-3" /></button></th>)}</tr></thead><tbody>{sorted.map((r) => <tr key={r.id} className="border-b border-border/50">{columns.map((c) => <td key={c.key} className={cn("p-2", c.key === "label" ? "text-left font-medium" : "num whitespace-nowrap text-right")}>{c.show(r)}</td>)}</tr>)}</tbody></table><p className="mt-2 text-[11px] text-muted-foreground">All values are estimates.</p></div>}
  </section>;
}
