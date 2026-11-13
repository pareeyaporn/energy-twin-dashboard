import { useEffect, useState } from "react";
import { ArrowRight, BookOpen, Check, ChevronDown, Loader2, Sparkles, TriangleAlert } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useTwin } from "@/store/useTwin";
import { selectIsSynthetic } from "@/store/hotelDerived";
import type { Objective, RankedPackage } from "@/engine/hotel/types";
import { Button } from "@/components/ui/button";
import { BudgetInput } from "@/components/BudgetInput";
import { DefaultEstimate, DefaultEstimateNotice } from "@/components/DefaultEstimate";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { DiscountRateControl, NpvEstimate } from "@/components/DiscountRateControl";
import { ProjectionSparkline, ProjectionToggle } from "@/components/Projection";
import { AiPlanResults } from "@/report/ResultsSummary";
import { FinancialLines, UpgradeComparison, fmtEnergy } from "@/components/FinancialLines";
import { CustomizeButton, InvestModes, WhyThisPlan } from "@/plans/InvestModes";

const money = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const number = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 0 });
const payback = (n: number | null) => n === null ? "No payback" : `${n.toFixed(1)} years`;
const objectives: { value: Objective; label: string }[] = [
  { value: "annual_savings", label: "Annual savings" }, { value: "payback", label: "Payback" },
  { value: "roi", label: "ROI" }, { value: "carbon", label: "Carbon" }, { value: "balanced", label: "Balanced" },
];

function PackageSummary({ pkg }: { pkg: RankedPackage }) {
  const f = pkg.evaluation.financials;
  const rows: [string, React.ReactNode][] = [
    ["Net investment", money(f.netInvestment.mid)],
    ["Saved per year", <span className="text-savings">{money(f.annualSavings.mid)}</span>],
    ["Simple payback", payback(f.simplePaybackYears)],
    ["Net benefit, 10 years", <span className={f.netBenefit10.mid < 0 ? "text-heat" : undefined}>{money(f.netBenefit10.mid)}</span>],
    ["CO2, estimate / yr", `${(f.carbonAvoidedKgPerYear.mid / 1000).toLocaleString("en-US", { maximumFractionDigits: 1 })} t`],
  ];
  return <dl className="grid grid-cols-2 gap-x-3 gap-y-3 text-xs">
    {rows.map(([label, value]) => <div key={label} className="min-w-0"><dt className="text-muted-foreground">{label}</dt><dd className="num mt-0.5 font-medium">{value}</dd></div>)}
  </dl>;
}

function PackageExtraFigures({ pkg, dense = false }: { pkg: RankedPackage; dense?: boolean }) {
  const e = pkg.evaluation;
  return <div className="space-y-4 pt-1">
    <FinancialLines f={e.financials} dense={dense} />
    <dl className={cn("space-y-2 border-t border-border pt-2", dense ? "text-xs" : "text-sm")}><div className="flex justify-between gap-3"><dt className="text-muted-foreground">Remaining budget</dt><dd className="num">{money(e.metrics.remainingBudget)}</dd></div><div className="flex justify-between gap-3"><dt className="text-muted-foreground">Comfort score</dt><dd className="num">{number(e.comfort.score * 100)}%</dd></div></dl>
    <ProjectionToggle f={e.financials} />
  </div>;
}

function FiguresToggle({ open, onClick }: { open: boolean; onClick: () => void }) {
  return <Button variant="ghost" size="sm" className="h-7 px-0 text-xs hover:bg-transparent hover:text-primary" aria-expanded={open} onClick={onClick}>{open ? "Hide all figures" : "Show all figures"}<ChevronDown className={cn("transition-transform", open && "rotate-180")} /></Button>;
}

function InvestmentCard({ pkg, winner, objective }: { pkg: RankedPackage; winner: boolean; objective: string }) {
  const active = useTwin((s) => s.activeHotelPackageId === pkg.evaluation.id);
  const apply = useTwin((s) => s.applyHotelPackage);
  const sources = useTwin((s) => s.setSourcesOpen);
  const [showAll, setShowAll] = useState(false);
  const e = pkg.evaluation;
  return <article onClick={(event) => { if (!(event.target instanceof Element) || !event.target.closest("button, a")) apply(e.id); }} className={cn("relative w-full min-w-0 cursor-pointer space-y-4 rounded-lg border bg-card p-4", winner ? "border-primary" : "border-border", active && "ring-1 ring-primary/50")}>
    <div className="flex flex-wrap items-center justify-between gap-2"><Badge variant="secondary">{pkg.roleLabel}</Badge>{winner && <Badge className="max-w-full whitespace-normal bg-primary text-primary-foreground">Best for your objective ({objective})</Badge>}</div>
    <Button variant="ghost" className="h-auto w-full justify-start whitespace-normal p-0 text-left text-base font-semibold hover:bg-transparent hover:text-primary" aria-pressed={active} onClick={() => apply(e.id)}><span>{e.name}</span>{active && <Check className="ml-auto shrink-0 text-primary" />}</Button>
    <div className="flex items-center gap-1"><Badge variant="outline" className="text-muted-foreground">Estimate</Badge><DefaultEstimate dot /></div>
    <PackageSummary pkg={pkg} />
    <div className="border-t border-border pt-2"><FiguresToggle open={showAll} onClick={() => setShowAll((open) => !open)} />{showAll && <div className="space-y-4 pt-3">
      <PackageExtraFigures pkg={pkg} />
      <p className="text-sm text-muted-foreground">{pkg.reason}</p>
      {pkg.note && <p className="text-xs text-heat">{pkg.note}</p>}
      {pkg.budgetRisk && <p role="note" className="flex items-start gap-2 rounded-md border border-heat/25 bg-heat/10 p-2 text-xs text-heat"><TriangleAlert className="h-4 w-4 shrink-0" /><span>High-end investment estimate ({money(e.cost.high)}) exceeds your budget.</span></p>}
      {e.comfort.notes.length > 0 && <ul className="space-y-2 text-xs">{e.comfort.notes.map((note) => <li key={note.id} className={note.severity === "warn" ? "text-heat" : "text-muted-foreground"}>{note.message}</li>)}</ul>}
      <div className="space-y-3 border-t border-border pt-3"><h3 className="text-xs font-medium text-muted-foreground">Investment line items</h3>{e.lineItems.map((line) => <div key={line.id} className="space-y-1 text-xs"><div className="flex justify-between gap-2"><span>{line.label}</span><span className="num shrink-0">{money(line.cost.mid)}</span></div><p className="text-muted-foreground">Annual savings: {money(line.annualSavingsMid)}</p><Button variant="outline" size="sm" className="h-6 text-[10px]" aria-label={`Source for ${line.label}`} onClick={() => sources(true)}><BookOpen />Source</Button></div>)}</div>
    </div>}</div>
    <Button variant={active ? "secondary" : "accentOutline"} className="w-full" onClick={() => apply(e.id)} aria-label={`Apply ${pkg.roleLabel}`} aria-pressed={active}>{active ? <><Check />Applied to twin</> : "Apply to twin"}</Button>
    <CustomizeButton packageId={e.id} label={pkg.roleLabel} />
  </article>;
}

const BUDGET_CHIPS = [25_000, 50_000, 100_000];

function CompactInvestmentCard({ pkg, winner, objective }: { pkg: RankedPackage; winner: boolean; objective: string }) {
  const active = useTwin((s) => s.activeHotelPackageId === pkg.evaluation.id);
  const apply = useTwin((s) => s.applyHotelPackage);
  const setCompareMode = useTwin((s) => s.setCompareMode);
  const [showAll, setShowAll] = useState(false);
  const e = pkg.evaluation;
  return <article className={cn("w-full min-w-0 space-y-3 rounded-lg border bg-card p-3", winner ? "border-primary" : "border-border", active && "ring-1 ring-primary/50")}>
    <div className="flex flex-wrap items-center justify-between gap-2"><Badge variant="secondary">{pkg.roleLabel}</Badge>{winner && <Badge className="max-w-full whitespace-normal bg-primary text-primary-foreground">Best for your objective ({objective})</Badge>}</div>
    <h3 className="text-sm font-semibold">{e.name}</h3>
    <div className="flex items-center gap-1"><Badge variant="outline" className="text-muted-foreground">Estimate</Badge><DefaultEstimate dot /></div>
    <PackageSummary pkg={pkg} />
    <div className="border-t border-border pt-2"><FiguresToggle open={showAll} onClick={() => setShowAll((open) => !open)} />{showAll && <PackageExtraFigures pkg={pkg} dense />}</div>
    <Button size="sm" variant={active ? "secondary" : "accentOutline"} className="w-full" aria-label={`Apply ${pkg.roleLabel}`} aria-pressed={active} onClick={() => { apply(e.id); setCompareMode("split"); }}>{active ? <><Check />Applied</> : "Apply"}</Button>
    <CustomizeButton packageId={e.id} label={pkg.roleLabel} />
  </article>;
}

export function BudgetOptimizer({ compact = false, workspace = false }: { compact?: boolean; workspace?: boolean }) {
  if (workspace) compact = true;
  const hotel = useTwin((s) => s.hotel);
  const plan = useTwin((s) => s.hotelPlan);
  const optimizing = useTwin((s) => s.optimizing);
  const preset = useTwin((s) => (selectIsSynthetic(s) ? "synthetic" : null));
  const setBudget = useTwin((s) => s.setHotelBudget);
  const setObjective = useTwin((s) => s.setHotelObjective);
  const run = useTwin((s) => s.runHotelOptimizer);
  const apply = useTwin((s) => s.applyHotelPackage);
  const optimizerCombinations = useTwin((s) => s.optimizerCombinations);
  const optimizeOnScenario = useTwin((s) => s.optimizeOnScenario);
  const setOptimizeOnScenario = useTwin((s) => s.setOptimizeOnScenario);
  const [progress, setProgress] = useState(0);
  const [comparisonOpen, setComparisonOpen] = useState(false);

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
  const objectiveLabel = objectives.find((item) => item.value === (plan?.objective ?? hotel.profile.objective))?.label ?? "Balanced";
  return <InvestModes compact={compact} ai={<div className={cn("space-y-6", compact ? "p-5" : "mx-auto max-w-7xl p-4 md:p-8")}>
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h1 className="text-xl font-semibold">Budget optimizer</h1><p className="mt-1 text-sm text-muted-foreground">{hotel.profile.name}</p></div>{preset !== null && <Badge variant="outline" className="border-heat/30 text-heat">Synthetic demo data</Badge>}</div>
    <section className={cn("grid items-end gap-4 border-y border-border py-5", !compact && "md:grid-cols-[1fr_1fr_auto]")}>
      <div className={cn(!compact && "md:col-span-3")}><DefaultEstimateNotice fields={["budget", "objective"]} /></div>
      <div className="space-y-2"><span className="flex items-center gap-1"><Label htmlFor={compact ? "panel-hotel-budget" : "hotel-budget"}>Investment budget ($)</Label><DefaultEstimate field="budget" dot /></span><BudgetInput id={compact ? "panel-hotel-budget" : "hotel-budget"} value={hotel.profile.budget} disabled={optimizing} onCommit={setBudget} />{workspace && <div className="flex flex-wrap gap-2">{BUDGET_CHIPS.map((amount) => <Button key={amount} type="button" size="sm" variant={hotel.profile.budget === amount ? "secondary" : "outline"} className="h-7 text-xs" disabled={optimizing} onClick={() => setBudget(amount)}>{money(amount)}</Button>)}</div>}</div>
      <div className="space-y-2"><span className="flex items-center gap-1"><Label htmlFor={compact ? "panel-hotel-objective" : "hotel-objective"}>Objective</Label><DefaultEstimate field="objective" dot /></span><Select value={hotel.profile.objective} disabled={optimizing} onValueChange={(value) => { const option = objectives.find((item) => item.value === value); if (option) setObjective(option.value); }}><SelectTrigger id={compact ? "panel-hotel-objective" : "hotel-objective"}><SelectValue /></SelectTrigger><SelectContent>{objectives.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent></Select></div>
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex min-h-9 items-center gap-2">
          <Switch id={compact ? "panel-optimize-scenario" : "optimize-scenario"} aria-label="Optimize for this scenario" checked={optimizeOnScenario} disabled={optimizing} onCheckedChange={setOptimizeOnScenario} />
          <Label htmlFor={compact ? "panel-optimize-scenario" : "optimize-scenario"} className="max-w-36 text-xs leading-snug">Optimize for this scenario</Label>
        </div>
        <Button variant="accent" className="min-h-10 min-w-56 whitespace-normal" disabled={optimizing} onClick={() => { void run(); }}>{optimizing ? <><Loader2 className="animate-spin motion-reduce:animate-none" />Testing combinations…</> : <><Sparkles />Find the best investments</>}</Button>
      </div>
    </section>
    <div role="status" aria-live="polite" className="min-h-14 space-y-2">{optimizing && <><p className="text-sm text-muted-foreground">Testing combinations… <span className="num" data-testid="optimizer-combination-counter" data-count={Math.floor(progress * (optimizerCombinations ?? 0))} data-total={optimizerCombinations ?? 0}>{number(Math.floor(progress * (optimizerCombinations ?? 0)))} / {number(optimizerCombinations ?? 0)}</span></p><progress aria-label="Testing combinations" value={progress} max={1} className="h-2 w-full accent-primary" /></>}{!optimizing && !plan && <p className="text-sm text-muted-foreground">No investment packages yet.</p>}</div>
    {workspace && cards.length === 0 && <Button asChild variant="link" className="h-auto px-0"><Link to="/optimizer">Compare in detail<ArrowRight /></Link></Button>}
    {!optimizing && plan && <>
      <div className="flex flex-wrap items-center gap-3">
        <p role="status" className="num text-xs text-muted-foreground">{number(plan.combinationsTested)} combinations tested · {number(plan.feasibleCount)} feasible packages · Estimates</p>
        {plan.scenario && <Badge variant="secondary" className="text-primary">Measured against the current scenario</Badge>}
      </div>
      <WhyThisPlan />
      <AiPlanResults compact={compact} />
      {workspace && cards.length > 0 ? <><section aria-label="Investment packages" className="space-y-3">{cards.map((pkg) => <CompactInvestmentCard key={`${pkg.role}-${pkg.evaluation.id}`} pkg={pkg} winner={pkg.evaluation.id === winner?.evaluation.id} objective={objectiveLabel} />)}</section><Button asChild variant="link" className="h-auto px-0"><Link to="/optimizer">Compare in detail<ArrowRight /></Link></Button></> : cards.length === 0 ? <section aria-label="No investments found" className="space-y-3 border-l-2 border-heat pl-4"><h2 className="font-semibold">No suitable package</h2><p className="text-sm text-muted-foreground">{plan.emptyReason}</p>{plan.cheapestUseful && <p className="text-sm">Lowest-cost useful investment: {plan.cheapestUseful.label} · <span className="num">{money(plan.cheapestUseful.cost)}</span></p>}</section> : <>
        <section aria-label="Investment packages" className={cn("grid items-start gap-4", !compact && "lg:grid-cols-3")}>{cards.map((pkg) => <InvestmentCard key={`${pkg.role}-${pkg.evaluation.id}`} pkg={pkg} winner={pkg.evaluation.id === winner?.evaluation.id} objective={objectiveLabel} />)}</section>
        {winner && !cards.some((pkg) => pkg.evaluation.id === winner.evaluation.id) && <section aria-label="Objective winner" className="space-y-3 border-t border-primary/30 pt-4"><h2 className="font-semibold">Objective winner · {winner.roleLabel}</h2><InvestmentCard pkg={winner} winner objective={objectiveLabel} /></section>}
        <Collapsible open={comparisonOpen} onOpenChange={setComparisonOpen} asChild><section aria-label="Package comparison" className="space-y-3 border-t border-border pt-5"><CollapsibleTrigger asChild><Button variant="ghost" className="h-auto px-0 text-base font-semibold hover:bg-transparent hover:text-primary" aria-expanded={comparisonOpen}>Compare investments<ChevronDown className={cn("transition-transform", comparisonOpen && "rotate-180")} /></Button></CollapsibleTrigger><CollapsibleContent className="space-y-3"><DiscountRateControl /><div className="table-scroll overflow-x-auto"><table className="sticky-first-column w-full min-w-[640px] text-sm"><caption className="sr-only">Estimated investment package comparison</caption><thead><tr className="border-b border-border"><th className="p-3 text-left">Estimate</th>{cards.map((pkg) => <th key={pkg.role} className={cn("p-3 text-right", pkg.evaluation.id === winner?.evaluation.id && "text-primary")}>{pkg.roleLabel}</th>)}</tr></thead><tbody>{[
          ["1 Gross installation cost", (p: RankedPackage) => `${money(p.evaluation.financials.grossCost.mid)} (${money(p.evaluation.financials.grossCost.low)} to ${money(p.evaluation.financials.grossCost.high)})`],
          ["2 Incentives", (p: RankedPackage) => p.evaluation.financials.incentives.some((i) => i.applied) ? money(p.evaluation.financials.incentivesTotal) : "None applied"],
          ["3 Net upfront investment", (p: RankedPackage) => money(p.evaluation.financials.netInvestment.mid)],
          ["4 Annual energy savings", (p: RankedPackage) => fmtEnergy(p.evaluation.financials)],
          ["5 Annual savings", (p: RankedPackage) => `${money(p.evaluation.financials.annualSavings.mid)} (${money(p.evaluation.financials.annualSavings.low)} to ${money(p.evaluation.financials.annualSavings.high)})`],
          ["6 Simple payback", (p: RankedPackage) => payback(p.evaluation.financials.simplePaybackYears)],
          ["7 Net benefit, 5 years", (p: RankedPackage) => `${money(p.evaluation.financials.netBenefit5.mid)} (${money(p.evaluation.financials.netBenefit5.low)} to ${money(p.evaluation.financials.netBenefit5.high)})`],
          ["   Net benefit, 10 years", (p: RankedPackage) => `${money(p.evaluation.financials.netBenefit10.mid)} (${money(p.evaluation.financials.netBenefit10.low)} to ${money(p.evaluation.financials.netBenefit10.high)})`],
          ["8 CO2, estimate / yr", (p: RankedPackage) => `${(p.evaluation.financials.carbonAvoidedKgPerYear.mid / 1000).toLocaleString("en-US", { maximumFractionDigits: 1 })} t`],
          ["NPV, 5 years", (p: RankedPackage) => <NpvEstimate f={p.evaluation.financials} years={5} />],
          ["NPV, 10 years", (p: RankedPackage) => <NpvEstimate f={p.evaluation.financials} years={10} />],
          ["Projection", (p: RankedPackage) => <ProjectionSparkline f={p.evaluation.financials} label={p.roleLabel} />],
          ["Remaining budget", (p: RankedPackage) => money(p.evaluation.metrics.remainingBudget)],
          ["Comfort score", (p: RankedPackage) => `${number(p.evaluation.comfort.score * 100)}%`],
        ].map(([label, format]) => <tr key={String(label)} className="border-b border-border/50"><th className="p-3 text-left font-normal text-muted-foreground">{String(label)}</th>{cards.map((pkg) => <td key={pkg.role} className="num whitespace-nowrap p-3 text-right">{typeof format === "function" ? format(pkg) : ""}</td>)}</tr>)}</tbody></table></div></CollapsibleContent></section></Collapsible>
      </>}
    </>}
    <UpgradeComparison compact={compact} />
  </div>} />;
}