import { useEffect, useState } from "react";
import { BookOpen, Check, Loader2, Sparkles, TriangleAlert } from "lucide-react";
import { useTwin } from "@/store/useTwin";
import type { Objective, RankedPackage } from "@/engine/hotel/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

const money = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const number = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 0 });
const payback = (n: number | null) => n === null ? "Not available" : `${n.toFixed(1)} years`;
const objectives: { value: Objective; label: string }[] = [
  { value: "annual_savings", label: "Annual savings" }, { value: "payback", label: "Payback" },
  { value: "roi", label: "ROI" }, { value: "carbon", label: "Carbon" }, { value: "balanced", label: "Balanced" },
];

function InvestmentCard({ pkg, winner }: { pkg: RankedPackage; winner: boolean }) {
  const active = useTwin((s) => s.activeHotelPackageId === pkg.evaluation.id);
  const apply = useTwin((s) => s.applyHotelPackage);
  const sources = useTwin((s) => s.setSourcesOpen);
  const e = pkg.evaluation;
  const m = e.metrics;
  return <article onClick={(event) => { if (!(event.target instanceof Element) || !event.target.closest("button, a")) apply(e.id); }} className={cn("relative min-w-0 cursor-pointer space-y-4 rounded-lg border bg-card p-4", winner ? "border-primary" : "border-border", active && "ring-1 ring-primary/50")}>
    <div className="flex flex-wrap items-center justify-between gap-2"><Badge variant="secondary">{pkg.roleLabel}</Badge>{winner && <Badge className="bg-primary text-primary-foreground">Objective winner</Badge>}</div>
    <Button variant="ghost" className="h-auto w-full justify-start whitespace-normal p-0 text-left text-base font-semibold hover:bg-transparent hover:text-primary" aria-pressed={active} onClick={() => apply(e.id)}><span>{e.name}</span>{active && <Check className="ml-auto shrink-0 text-primary" />}</Button>
    <Badge variant="outline" className="text-muted-foreground">Estimate</Badge>
    <dl className="space-y-2 text-sm">
      <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Investment</dt><dd className="num font-semibold">{money(e.cost.mid)}</dd></div>
      <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Annual savings</dt><dd className="num font-semibold text-savings">{money(e.annualSavings.mid)}</dd></div>
      <div className="text-right text-xs text-muted-foreground">{money(e.annualSavings.low)}–{money(e.annualSavings.high)} / yr</div>
      <div className="flex justify-between gap-3"><dt className="text-muted-foreground">{m.horizonYears}-year net benefit</dt><dd className="num">{money(m.netBenefit)}</dd></div>
      <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Simple payback</dt><dd className="num">{payback(m.paybackYears)}</dd></div>
      <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Carbon avoided / yr</dt><dd className="num text-right">{number(m.carbonAvoidedKgPerYear)} kg CO₂e</dd></div>
      <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Remaining budget</dt><dd className="num">{money(m.remainingBudget)}</dd></div>
      <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Comfort score</dt><dd className="num">{number(e.comfort.score * 100)}%</dd></div>
    </dl>
    <p className="text-sm text-muted-foreground">{pkg.reason}</p>
    {pkg.note && <p className="text-xs text-heat">{pkg.note}</p>}
    {pkg.budgetRisk && <p role="note" className="flex items-start gap-2 rounded-md border border-heat/25 bg-heat/10 p-2 text-xs text-heat"><TriangleAlert className="h-4 w-4 shrink-0" /><span>High-end investment estimate ({money(e.cost.high)}) exceeds your budget.</span></p>}
    {e.comfort.notes.length > 0 && <ul className="space-y-2 text-xs">{e.comfort.notes.map((note) => <li key={note.id} className={note.severity === "warn" ? "text-heat" : "text-muted-foreground"}>{note.message}</li>)}</ul>}
    <div className="space-y-3 border-t border-border pt-3"><h3 className="text-xs font-medium text-muted-foreground">Investment line items</h3>{e.lineItems.map((line) => <div key={line.id} className="space-y-1 text-xs"><div className="flex justify-between gap-2"><span>{line.label}</span><span className="num shrink-0">{money(line.cost.mid)}</span></div><p className="text-muted-foreground">Annual savings: {money(line.annualSavingsMid)}</p><Button variant="outline" size="sm" className="h-6 text-[10px]" title={line.source} aria-label={`Source for ${line.label}`} onClick={() => sources(true)}><BookOpen />Source</Button><p className="break-words text-[10px] text-muted-foreground">{line.source}</p></div>)}</div>
    <Button variant={active ? "secondary" : "accentOutline"} className="w-full" onClick={() => apply(e.id)} aria-label={`Apply ${pkg.roleLabel}`} aria-pressed={active}>{active ? <><Check />Applied to twin</> : "Apply to twin"}</Button>
  </article>;
}

export function BudgetOptimizer({ compact = false }: { compact?: boolean }) {
  const hotel = useTwin((s) => s.hotel);
  const plan = useTwin((s) => s.hotelPlan);
  const optimizing = useTwin((s) => s.optimizing);
  const preset = useTwin((s) => s.hotelPresetId);
  const setBudget = useTwin((s) => s.setHotelBudget);
  const setObjective = useTwin((s) => s.setHotelObjective);
  const run = useTwin((s) => s.runHotelOptimizer);
  const apply = useTwin((s) => s.applyHotelPackage);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!optimizing) return;
    setProgress(0);
    const start = performance.now();
    const timer = window.setInterval(() => setProgress(Math.min(1, (performance.now() - start) / 2000)), 40);
    return () => window.clearInterval(timer);
  }, [optimizing]);

  useEffect(() => {
    if (!plan?.objectiveWinner || optimizing) return;
    const timer = window.setTimeout(() => {
      // Never override a manual card selection or apply a stale result.
      const state = useTwin.getState();
      if (state.hotelPlan === plan && state.activeHotelPackageId === null && plan.objectiveWinner) apply(plan.objectiveWinner.evaluation.id);
    }, 600);
    return () => window.clearTimeout(timer);
  }, [plan, optimizing, apply]);

  const winner = plan?.objectiveWinner;
  const cards = plan?.packages ?? [];
  return <div className={cn("space-y-6", compact ? "p-5" : "mx-auto max-w-7xl p-4 md:p-8")}>
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h1 className="text-xl font-semibold">Budget optimizer</h1><p className="mt-1 text-sm text-muted-foreground">{hotel.profile.name}</p></div>{preset !== null && <Badge variant="outline" className="border-heat/30 text-heat">Synthetic demo data</Badge>}</div>
    <section className={cn("grid items-end gap-4 border-y border-border py-5", !compact && "md:grid-cols-[1fr_1fr_auto]")}>
      <div className="space-y-2"><Label htmlFor={compact ? "panel-hotel-budget" : "hotel-budget"}>Investment budget ($)</Label><Input id={compact ? "panel-hotel-budget" : "hotel-budget"} className="num" type="number" min={0} step={500} value={hotel.profile.budget} disabled={optimizing} onChange={(event) => { const value = Number(event.target.value); if (Number.isFinite(value)) setBudget(value); }} /></div>
      <div className="space-y-2"><Label htmlFor={compact ? "panel-hotel-objective" : "hotel-objective"}>Objective</Label><Select value={hotel.profile.objective} disabled={optimizing} onValueChange={(value) => { const option = objectives.find((item) => item.value === value); if (option) setObjective(option.value); }}><SelectTrigger id={compact ? "panel-hotel-objective" : "hotel-objective"}><SelectValue /></SelectTrigger><SelectContent>{objectives.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent></Select></div>
      <Button variant="accent" className="whitespace-normal" disabled={optimizing} onClick={() => { void run(); }}>{optimizing ? <><Loader2 className="animate-spin motion-reduce:animate-none" />Testing combinations…</> : <><Sparkles />Find the best investments</>}</Button>
    </section>
    {optimizing && <div role="status" className="space-y-2"><p className="text-sm text-muted-foreground">Testing combinations… <span className="num">{plan ? Math.floor(progress * plan.combinationsTested) : `${Math.floor(progress * 100)}%`}</span></p><progress aria-label="Testing combinations" value={progress} max={1} className="h-2 w-full accent-primary" /></div>}
    {!optimizing && plan && <>
      <p role="status" className="num text-xs text-muted-foreground">{number(plan.combinationsTested)} combinations tested · {number(plan.feasibleCount)} feasible packages · Estimates</p>
      {cards.length === 0 ? <section aria-label="No investments found" className="space-y-3 border-l-2 border-heat pl-4"><h2 className="font-semibold">No suitable package</h2><p className="text-sm text-muted-foreground">{plan.emptyReason}</p>{plan.cheapestUseful && <p className="text-sm">Lowest-cost useful investment: {plan.cheapestUseful.label} · <span className="num">{money(plan.cheapestUseful.cost)}</span></p>}</section> : <>
        <section aria-label="Investment packages" className={cn("grid items-start gap-4", !compact && "lg:grid-cols-3")}>{cards.map((pkg) => <InvestmentCard key={`${pkg.role}-${pkg.evaluation.id}`} pkg={pkg} winner={pkg.evaluation.id === winner?.evaluation.id} />)}</section>
        {winner && !cards.some((pkg) => pkg.evaluation.id === winner.evaluation.id) && <section aria-label="Objective winner" className="space-y-3 border-t border-primary/30 pt-4"><h2 className="font-semibold">Objective winner · {winner.roleLabel}</h2><InvestmentCard pkg={winner} winner /></section>}
        <section aria-label="Package comparison" className="space-y-3 border-t border-border pt-5"><h2 className="font-semibold">Compare investments</h2><div className="overflow-x-auto"><table className="w-full min-w-[640px] text-sm"><caption className="sr-only">Estimated investment package comparison</caption><thead><tr className="border-b border-border"><th className="p-3 text-left">Estimate</th>{cards.map((pkg) => <th key={pkg.role} className={cn("p-3 text-right", pkg.evaluation.id === winner?.evaluation.id && "text-primary")}>{pkg.roleLabel}</th>)}</tr></thead><tbody>{[
          ["Investment", (p: RankedPackage) => money(p.evaluation.cost.mid)],
          ["Annual savings", (p: RankedPackage) => money(p.evaluation.annualSavings.mid)],
          ["Savings range / yr", (p: RankedPackage) => `${money(p.evaluation.annualSavings.low)}–${money(p.evaluation.annualSavings.high)}`],
          [`${cards[0]?.evaluation.metrics.horizonYears ?? hotel.profile.horizonYears}-year net benefit`, (p: RankedPackage) => money(p.evaluation.metrics.netBenefit)],
          ["Simple payback", (p: RankedPackage) => payback(p.evaluation.metrics.paybackYears)],
          ["Carbon avoided / yr", (p: RankedPackage) => `${number(p.evaluation.metrics.carbonAvoidedKgPerYear)} kg CO₂e`],
          ["Remaining budget", (p: RankedPackage) => money(p.evaluation.metrics.remainingBudget)],
          ["Comfort score", (p: RankedPackage) => `${number(p.evaluation.comfort.score * 100)}%`],
        ].map(([label, format]) => <tr key={String(label)} className="border-b border-border/50"><th className="p-3 text-left font-normal text-muted-foreground">{String(label)}</th>{cards.map((pkg) => <td key={pkg.role} className="num whitespace-nowrap p-3 text-right">{typeof format === "function" ? format(pkg) : ""}</td>)}</tr>)}</tbody></table></div></section>
      </>}
    </>}
    <p className="text-xs text-muted-foreground">Estimates from synthetic and public data, not an engineering audit. No guaranteed savings.</p>
  </div>;
}