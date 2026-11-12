import { useState } from "react";
import { Area, Bar, ComposedChart, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChevronDown } from "lucide-react";
import type { FinancialBreakdown } from "@/engine/hotel/types";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { formatRate } from "@/components/DiscountRateControl";
import { cn } from "@/lib/utils";

const money = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const tone = (n: number) => (n < 0 ? "text-heat" : "text-savings");
export const projectionNote = (f: FinancialBreakdown) => `Savings grow with EIA price forecasts; ${f.solar ? "solar output falls 0.5% a year; " : ""}year 5 and year 10 equal the net benefit shown above. Estimate.`;

export function ProjectionChart({ f }: { f: FinancialBreakdown }) {
  const p = f.projection ?? [];
  if (p.length === 0) return <p className="text-xs text-muted-foreground">No projection available.</p>;
  const rate = f.discountRate !== undefined ? formatRate(f.discountRate) : "";
  const data = p.map((y) => ({ year: y.year, savings: y.savings.mid, net: y.cumulativeNet.mid, band: [y.cumulativeNet.low, y.cumulativeNet.high], npv: y.cumulativeNpv }));
  return <div className="space-y-3">
    <div className="h-56 w-full" role="img" aria-label="10-year projection chart, estimate">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <XAxis dataKey="year" tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} stroke="var(--border)" />
          <YAxis width={56} tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} stroke="var(--border)" tickFormatter={(v: number) => `$${Math.round(v / 1000)}k`} />
          <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", fontSize: 11 }} formatter={(v: unknown, name: string) => [Array.isArray(v) ? `${money(v[0])} to ${money(v[1])}` : money(Number(v)), name]} labelFormatter={(l) => `Year ${l}`} />
          <Area dataKey="band" name="Net benefit range" stroke="none" fill="var(--primary)" fillOpacity={0.15} isAnimationActive={false} />
          <Bar dataKey="savings" name="Savings this year" fill="var(--savings)" fillOpacity={0.7} isAnimationActive={false} />
          <ReferenceLine y={0} stroke="var(--muted-foreground)" strokeDasharray="4 4" />
          <Line dataKey="net" name="Cumulative net benefit" stroke="var(--primary)" strokeWidth={2} dot={false} isAnimationActive={false} />
          <Line dataKey="npv" name={`Discounted (NPV) at ${rate}`} stroke="var(--heat)" strokeDasharray="5 4" strokeWidth={1.5} dot={false} isAnimationActive={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
    <p className="text-[11px] text-muted-foreground">Bars: savings each year · Line: cumulative net benefit (shaded low to high; crosses zero at payback) · Dashed: Discounted (NPV) at {rate}</p>
    <div className="table-scroll overflow-x-auto"><table className="sticky-first-column w-full min-w-[560px] text-[11px] sm:min-w-0"><caption className="sr-only">10-year projection, estimate</caption><thead><tr className="border-b border-border text-muted-foreground"><th className="p-1 text-left">Year</th><th className="p-1 text-right">Savings</th><th className="p-1 text-right">Cumulative net benefit</th><th className="p-1 text-right">Discounted at {rate}</th></tr></thead>
      <tbody>{p.map((y) => <tr key={y.year} className="border-b border-border/50"><td className="p-1">{y.year}</td><td className={cn("num p-1 text-right", tone(y.savings.mid))}>{money(y.savings.mid)}</td><td className="num whitespace-nowrap p-1 text-right"><span className={tone(y.cumulativeNet.mid)}>{money(y.cumulativeNet.mid)}</span> <span className="text-muted-foreground">({money(y.cumulativeNet.low)} to {money(y.cumulativeNet.high)})</span></td><td className={cn("num p-1 text-right", tone(y.cumulativeNpv))}>{money(y.cumulativeNpv)}</td></tr>)}</tbody></table></div>
    <p className="text-[11px] text-muted-foreground">{projectionNote(f)}</p>
  </div>;
}

export function ProjectionToggle({ f }: { f: FinancialBreakdown }) {
  const [open, setOpen] = useState(false);
  return <div className="space-y-2 border-t border-border pt-2">
    <Button variant="ghost" size="sm" className="h-7 px-0 text-xs hover:bg-transparent hover:text-primary" aria-expanded={open} onClick={() => setOpen((o) => !o)}>{open ? "Hide" : "Show"} 10-year projection<ChevronDown className={cn("transition-transform", open && "rotate-180")} /></Button>
    {open && <ProjectionChart f={f} />}
  </div>;
}

export function ProjectionSparkline({ f, label }: { f: FinancialBreakdown; label: string }) {
  const p = f.projection ?? [];
  if (p.length === 0) return <span className="text-muted-foreground">—</span>;
  const last = p[p.length - 1]!.cumulativeNet.mid;
  const data = p.map((y) => ({ year: y.year, net: y.cumulativeNet.mid }));
  return <Dialog>
    <DialogTrigger asChild><button type="button" className="ml-auto inline-block h-7 w-24 rounded hover:bg-muted" aria-label={`Open 10-year projection for ${label}`}>
      <ResponsiveContainer width="100%" height="100%"><LineChart data={data} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}><YAxis hide domain={["dataMin", "dataMax"]} /><ReferenceLine y={0} stroke="var(--muted-foreground)" strokeDasharray="2 2" /><Line dataKey="net" stroke={last < 0 ? "var(--heat)" : "var(--savings)"} strokeWidth={1.5} dot={false} isAnimationActive={false} /></LineChart></ResponsiveContainer>
    </button></DialogTrigger>
    <DialogContent className="max-w-2xl"><DialogHeader><DialogTitle>10-year projection · {label}</DialogTitle><DialogDescription>Estimate from the computed results.</DialogDescription></DialogHeader><ProjectionChart f={f} /></DialogContent>
  </Dialog>;
}
