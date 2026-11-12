import { DefaultEstimate } from "@/components/DefaultEstimate";
import { BenchmarkCard } from "@/components/BenchmarkCard";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { Leaf, Wallet, Zap } from "lucide-react";
import { useTwin } from "@/store/useTwin";
import { selectDisplayed, selectOpportunities, selectZoneRows } from "@/store/hotelDerived";
import { Badge } from "@/components/ui/badge";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import type { Category } from "@/engine/hotel/types";

const number = (value: number) => value.toLocaleString("en-US", { maximumFractionDigits: 0 });
const money = (value: number) => value.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const categories: Record<Category, string> = {
  hvac: "HVAC", lighting: "Lighting", hotWater: "Hot water", kitchen: "Kitchen", equipment: "Equipment", other: "Other",
};
const chartConfig = { elecCost: { label: "Electricity", color: "var(--primary)" }, gasCost: { label: "Natural gas", color: "var(--heat)" } };

function Estimate() {
  return <><Badge variant="outline" className="border-primary/25 text-[10px] font-normal text-primary">Estimate</Badge><DefaultEstimate dot /></>;
}

type BreakdownRow = { id: string; label: string; elecCost: number; gasCost: number; cost: number; elecKWh: number; gasTherms: number };

function Breakdown({ title, rows }: { title: string; rows: BreakdownRow[] }) {
  return (
    <section aria-label={title} className="min-w-0 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold">{title}</h2>
        <span className="text-xs text-muted-foreground">Annual cost · USD · estimate</span>
      </div>
      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-2"><span className="h-2 w-2 rounded-sm bg-primary" />Electricity</span>
        <span className="flex items-center gap-2"><span className="h-2 w-2 rounded-sm bg-heat" />Natural gas</span>
      </div>
      <ChartContainer config={chartConfig} className="h-[280px] w-full aspect-auto" aria-label={`${title}, annual electricity and natural gas costs`}>
        <BarChart data={rows} layout="vertical" accessibilityLayer margin={{ left: 0, right: 12, top: 0, bottom: 0 }}>
          <CartesianGrid horizontal={false} stroke="var(--border)" />
          <XAxis type="number" tickFormatter={(v: number) => money(v)} tickLine={false} axisLine={false} minTickGap={35} />
          <YAxis type="category" dataKey="label" width={112} tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
          <ChartTooltip cursor={false} content={<ChartTooltipContent labelKey="label" formatter={(value, name) => <div className="flex w-full items-center justify-between gap-4"><span className="text-muted-foreground">{chartConfig[name as keyof typeof chartConfig]?.label ?? name}</span><span className="num font-medium">{money(Number(value))}</span></div>} />} />
          <Bar dataKey="elecCost" stackId="cost" fill="var(--color-elecCost)" barSize={18} isAnimationActive={false} />
          <Bar dataKey="gasCost" stackId="cost" fill="var(--color-gasCost)" radius={[0, 3, 3, 0]} barSize={18} isAnimationActive={false} />
        </BarChart>
      </ChartContainer>
      <div className="table-scroll overflow-x-auto">
        <table className="sticky-first-column w-full min-w-[480px] text-xs sm:min-w-0">
          <caption className="sr-only">{title}: estimated annual energy consumption and cost</caption>
          <thead className="text-muted-foreground"><tr className="border-b border-border"><th className="py-2 text-left font-normal">{title === "By category" ? "Category" : "Zone"}</th><th className="px-2 text-right font-normal">kWh</th><th className="px-2 text-right font-normal">Therms</th><th className="py-2 text-right font-normal">Cost ($)</th></tr></thead>
          <tbody>{rows.map((row) => <tr key={row.id} className="border-b border-border/50"><th scope="row" className="py-2.5 pr-2 text-left font-medium">{row.label}</th><td className="num whitespace-nowrap px-2 text-right text-muted-foreground">{number(row.elecKWh)}</td><td className="num whitespace-nowrap px-2 text-right text-muted-foreground">{number(row.gasTherms)}</td><td className="num whitespace-nowrap text-right">{number(row.cost)}</td></tr>)}</tbody>
        </table>
      </div>
    </section>
  );
}

export function Overview() {
  const displayed = useTwin(selectDisplayed);
  const zoneRows = useTwin(selectZoneRows);
  const opportunities = useTwin(selectOpportunities);
  const presetId = useTwin((s) => s.hotelPresetId);
  const hasScenario = useTwin((s) => s.scenarioResult !== null);
  const profile = useTwin((s) => s.hotel.profile);
  const { result } = displayed;
  const categoryRows = Object.entries(result.byCategory).map(([id, totals]) => ({ id, label: categories[id as Category], ...totals }));
  const zones = zoneRows.map((row) => ({ id: row.zone, label: row.label, ...result.byZone[row.zone] }));
  // Each upgrade occurs in multiple zones; rank its whole-hotel benefit only once.
  const topOpportunities = [...new Map(Object.values(opportunities).flat().map((item) => [item.id, item])).values()]
    .sort((a, b) => b.totalAnnualSavings - a.totalAnnualSavings || a.id.localeCompare(b.id)).slice(0, 3);

  return (
    <div className="mx-auto w-full max-w-7xl space-y-7 p-3 sm:p-4 md:p-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><h1 className="text-2xl font-semibold">Overview</h1><p className="mt-1 text-sm text-muted-foreground">{profile.name} · {profile.city}, {profile.state}</p></div>
        <div className="flex flex-wrap gap-2"><Badge variant="secondary">{displayed.kind === "package" ? "Applied package" : displayed.kind === "scenario" ? "Current scenario" : "Baseline"}</Badge>{presetId !== null && <Badge variant="outline" className="border-heat/30 text-heat">Synthetic demo data</Badge>}</div>
      </div>
      <dl className="grid gap-5 border-y border-border py-6 sm:grid-cols-3">
        <div className="min-w-0"><dt className="mb-3 flex flex-wrap items-center gap-2 text-sm text-muted-foreground"><Zap className="h-4 w-4 text-primary" />Annual energy use <Estimate /></dt><dd className="num text-2xl font-semibold" data-testid="annual-energy">{number(result.annual.siteKBtu)} <span className="text-sm font-normal text-muted-foreground">kBtu / yr</span></dd><dd className="num mt-2 text-xs text-muted-foreground">{number(result.annual.elecKWh)} kWh electricity · {number(result.annual.gasTherms)} therms gas</dd></div>
        <div className="min-w-0"><dt className="mb-3 flex flex-wrap items-center gap-2 text-sm text-muted-foreground"><Wallet className="h-4 w-4 text-heat" />Annual cost <Estimate /></dt><dd className="num text-2xl font-semibold" data-testid="annual-cost">{money(result.annual.cost)} <span className="text-sm font-normal text-muted-foreground">/ yr</span></dd><dd className="num mt-2 text-xs text-muted-foreground">{money(result.annual.elecCost)} electricity · {money(result.annual.gasCost)} gas</dd></div>
        <div className="min-w-0"><dt className="mb-3 flex flex-wrap items-center gap-2 text-sm text-muted-foreground"><Leaf className="h-4 w-4 text-savings" />Estimated emissions <Estimate /></dt><dd className="num text-2xl font-semibold" data-testid="annual-emissions">{number(result.annual.carbonKg)} <span className="text-sm font-normal text-muted-foreground">kg CO₂e / yr</span></dd><dd className="mt-2 text-xs text-muted-foreground">Electricity and natural gas</dd></div>
      </dl>
      <BenchmarkCard />
      <div className="grid gap-8 lg:grid-cols-2"><Breakdown title="By category" rows={categoryRows} /><Breakdown title="By zone" rows={zones} /></div>
      <section className="space-y-4 border-t border-border pt-6" aria-label="Top opportunities">
        <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-base font-semibold">Top opportunities</h2><span className="text-xs text-muted-foreground">Standalone upgrades · {hasScenario ? "current scenario" : "baseline"} estimates</span></div>
        {topOpportunities.length === 0 ? <p className="text-sm text-muted-foreground">No modeled opportunities reduce annual cost.</p> : <ol className="grid gap-4 md:grid-cols-3">{topOpportunities.map((item, index) => <li key={item.id} className="min-w-0 space-y-3 rounded-lg border border-border bg-card p-4"><div className="flex items-start gap-3"><span className="num text-lg text-primary">{index + 1}</span><h3 className="font-medium">{item.label}</h3></div><div className="flex flex-wrap items-center gap-2"><span className="num text-lg font-semibold text-savings">{money(item.totalAnnualSavings)} / yr</span><Estimate /></div><dl className="space-y-1 text-xs text-muted-foreground"><div className="flex justify-between gap-2"><dt>Investment</dt><dd className="num">{money(item.cost)}</dd></div><div className="flex justify-between gap-2"><dt>Simple payback</dt><dd className="num">{item.paybackYears === null ? "—" : `${item.paybackYears.toFixed(1)} years`}</dd></div></dl>{item.comfortNote && <p className="text-xs text-muted-foreground">{item.comfortNote}</p>}</li>)}</ol>}
        {topOpportunities.length > 0 && <p className="text-xs text-muted-foreground">Savings are evaluated separately and are not additive.</p>}
      </section>
      <section className="border-t border-border pt-4 text-xs text-muted-foreground" aria-label="Estimate sources"><h2 className="mb-2 font-medium text-foreground">Sources and assumptions</h2><ul className="space-y-1">{result.sources.map((source, index) => <li key={`${index}-${source}`}>{source}</li>)}</ul></section>
    </div>
  );
}