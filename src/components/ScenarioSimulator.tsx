import type { ReactNode } from "react";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import { Leaf, RotateCcw, SlidersHorizontal, Wallet, Zap } from "lucide-react";
import { STRESS_TESTS } from "@/engine/hotel";
import type { Setpoints } from "@/engine/hotel";
import { useTwin } from "@/store/useTwin";
import { selectCompare } from "@/store/hotelDerived";
import { AnimatedNumber } from "@/components/AnimatedNumber";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const number = (value: number) => value.toLocaleString("en-US", { maximumFractionDigits: 0 });
const signedMoney = (value: number) => `${value > 0 ? "+" : value < 0 ? "−" : ""}$${number(Math.abs(value))}`;
const chartConfig = {
  before: { label: "Before", color: "var(--muted-foreground)" },
  after: { label: "After", color: "var(--primary)" },
};

interface ScenarioSliderProps {
  label: string;
  value: number;
  displayValue: string;
  min: number;
  max: number;
  step?: number;
  overridden: boolean;
  profileText: string;
  onValueChange: (value: number) => void;
  onReset: () => void;
}

function ScenarioSlider({ label, value, displayValue, min, max, step = 1, overridden, profileText, onValueChange, onReset }: ScenarioSliderProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <Label className="text-sm font-medium">{label}</Label>
          <p className="mt-1 text-xs text-muted-foreground">{profileText}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <span className="num text-sm font-semibold">{displayValue}</span>
          <Button type="button" variant="ghost" size="icon" className="h-7 w-7" disabled={!overridden} onClick={onReset} aria-label={`Clear ${label.toLowerCase()} scenario override`} title="Use hotel profile value">
            <RotateCcw className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
      <Slider aria-label={label} min={min} max={max} step={step} value={[value]} onValueChange={([next]) => { if (next !== undefined) onValueChange(next); }} />
    </div>
  );
}

function MetricTile({ id, label, icon, before, after, prefix = "", suffix }: { id: string; label: string; icon: ReactNode; before: number; after: number; prefix?: string; suffix: string }) {
  return (
    <section className="min-w-0 rounded-lg border border-border bg-card p-4" aria-label={`${label} before and after`}>
      <div className="mb-4 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-medium">{icon}{label}</h2>
        <Badge variant="outline" className="border-primary/25 text-[10px] font-normal text-primary">Estimate</Badge>
      </div>
      <dl className="space-y-3">
        <div className="flex min-w-0 items-center justify-between gap-3 border-b border-border pb-3">
          <dt className="label-caps">Before</dt>
          <dd className="num whitespace-nowrap text-base text-muted-foreground" data-testid={`scenario-${id}-before`} data-value={before}>
            <AnimatedNumber value={before} prefix={prefix} />
          </dd>
        </div>
        <div className="flex min-w-0 items-center justify-between gap-3">
          <dt className="label-caps text-primary">After</dt>
          <dd className="num whitespace-nowrap text-lg font-semibold" data-testid={`scenario-${id}-after`} data-value={after}>
            <AnimatedNumber value={after} prefix={prefix} />
          </dd>
        </div>
      </dl>
      <p className="mt-3 text-xs text-muted-foreground">{suffix} / year</p>
    </section>
  );
}

export function ScenarioSimulator() {
  const profile = useTwin((s) => s.hotel.profile);
  const presetId = useTwin((s) => s.hotelPresetId);
  const scenario = useTwin((s) => s.scenario);
  const scenarioResult = useTwin((s) => s.scenarioResult);
  const activeStressTest = useTwin((s) => s.activeStressTest);
  const compare = useTwin(selectCompare);
  const setScenario = useTwin((s) => s.setScenario);
  const resetScenario = useTwin((s) => s.resetScenario);
  const applyStressTest = useTwin((s) => s.applyStressTest);
  const optimizeOnScenario = useTwin((s) => s.optimizeOnScenario);
  const setOptimizeOnScenario = useTwin((s) => s.setOptimizeOnScenario);

  const occupancy = Math.round((scenario.occupancy ?? profile.occupancy) * 100);
  const occupiedHeatF = scenario.setpoints?.occupiedHeatF ?? profile.setpoints.occupiedHeatF;
  const occupiedCoolF = scenario.setpoints?.occupiedCoolF ?? profile.setpoints.occupiedCoolF;
  const smartRoomControls = scenario.smartRoomControls ?? profile.smartRoomControls;
  const commonAreaHvacHours = scenario.commonAreaHvacHours ?? profile.commonAreaHvacHours;
  const lightingHoursPerDay = scenario.lightingHoursPerDay ?? profile.lightingHoursPerDay;
  const electricityRateChangePct = scenario.electricityRateChangePct ?? 0;
  const hasScenario = Object.keys(scenario).length > 0 || activeStressTest !== null;
  const monthly = compare.before.months.map((month, index) => ({
    month: MONTHS[index],
    before: month.totals.siteKBtu,
    after: compare.after.months[index]?.totals.siteKBtu ?? 0,
  }));

  const changeSetpoint = (key: keyof Setpoints, value: number) => {
    setScenario({ setpoints: { ...scenario.setpoints, [key]: value } });
  };
  const resetSetpoint = (key: keyof Setpoints) => {
    const remaining = { ...scenario.setpoints };
    delete remaining[key];
    setScenario(Object.keys(remaining).length > 0 ? { setpoints: remaining } : {}, ["setpoints"]);
  };

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 p-4 md:p-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold"><SlidersHorizontal className="h-6 w-6 text-primary" />Scenario simulator</h1>
          <p className="mt-1 text-sm text-muted-foreground">Test operating changes before applying them to {profile.name}.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {compare.kind === "scenario" && <Badge variant="secondary">Current scenario</Badge>}
          {presetId !== null && <Badge variant="outline" className="border-heat/30 text-heat">Synthetic demo data</Badge>}
        </div>
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
        <aside className="panel min-w-0 space-y-6 p-5" aria-label="Scenario controls">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-semibold">Operating assumptions</h2>
            <Button type="button" variant="outline" size="sm" onClick={resetScenario} disabled={!hasScenario}><RotateCcw />Reset</Button>
          </div>

          <ScenarioSlider label="Occupancy" value={occupancy} displayValue={`${occupancy}%`} min={0} max={100} overridden={scenario.occupancy !== undefined} profileText={`Hotel profile: ${Math.round(profile.occupancy * 100)}%`} onValueChange={(value) => setScenario({ occupancy: value / 100 })} onReset={() => setScenario({}, ["occupancy"])} />
          <div className="space-y-5 border-t border-border pt-5">
            <ScenarioSlider label="Guest-room occupied heating" value={occupiedHeatF} displayValue={`${occupiedHeatF}°F`} min={55} max={75} overridden={scenario.setpoints?.occupiedHeatF !== undefined} profileText={`Hotel profile: ${profile.setpoints.occupiedHeatF}°F`} onValueChange={(value) => changeSetpoint("occupiedHeatF", value)} onReset={() => resetSetpoint("occupiedHeatF")} />
            <ScenarioSlider label="Guest-room occupied cooling" value={occupiedCoolF} displayValue={`${occupiedCoolF}°F`} min={68} max={85} overridden={scenario.setpoints?.occupiedCoolF !== undefined} profileText={`Hotel profile: ${profile.setpoints.occupiedCoolF}°F`} onValueChange={(value) => changeSetpoint("occupiedCoolF", value)} onReset={() => resetSetpoint("occupiedCoolF")} />
          </div>

          <div className="flex items-start justify-between gap-4 border-t border-border pt-5">
            <div className="space-y-1">
              <Label htmlFor="scenario-smart-controls" className="text-sm font-medium">Smart room controls</Label>
              <p className="text-xs text-muted-foreground">Set back vacant guest rooms automatically.</p>
            </div>
            <div className="flex items-center gap-1">
              <Switch id="scenario-smart-controls" checked={smartRoomControls} onCheckedChange={(checked) => setScenario({ smartRoomControls: checked })} />
              <Button type="button" variant="ghost" size="icon" className="h-7 w-7" disabled={scenario.smartRoomControls === undefined} onClick={() => setScenario({}, ["smartRoomControls"])} aria-label="Clear smart room controls scenario override"><RotateCcw className="h-3.5 w-3.5" /></Button>
            </div>
          </div>

          <div className="space-y-5 border-t border-border pt-5">
            <ScenarioSlider label="Common-area HVAC hours" value={commonAreaHvacHours} displayValue={`${commonAreaHvacHours} h/day`} min={0} max={24} overridden={scenario.commonAreaHvacHours !== undefined} profileText={`Hotel profile: ${profile.commonAreaHvacHours} h/day`} onValueChange={(value) => setScenario({ commonAreaHvacHours: value })} onReset={() => setScenario({}, ["commonAreaHvacHours"])} />
            <ScenarioSlider label="Lighting hours" value={lightingHoursPerDay} displayValue={`${lightingHoursPerDay} h/day`} min={0} max={24} step={0.5} overridden={scenario.lightingHoursPerDay !== undefined} profileText={`Hotel profile: ${profile.lightingHoursPerDay} h/day`} onValueChange={(value) => setScenario({ lightingHoursPerDay: value })} onReset={() => setScenario({}, ["lightingHoursPerDay"])} />
            <ScenarioSlider label="Electricity price change" value={electricityRateChangePct} displayValue={`${electricityRateChangePct > 0 ? "+" : ""}${electricityRateChangePct}%`} min={-50} max={100} step={5} overridden={scenario.electricityRateChangePct !== undefined} profileText="Relative to the current electricity price" onValueChange={(value) => setScenario({ electricityRateChangePct: value })} onReset={() => setScenario({}, ["electricityRateChangePct"])} />
          </div>

          <div className="flex items-start justify-between gap-4 border-t border-border pt-5">
            <div className="space-y-1">
              <Label htmlFor="scenario-optimize" className="text-sm font-medium">Optimize for this scenario</Label>
              <p className="text-xs text-muted-foreground">Measure investment results against these operating conditions.</p>
            </div>
            <Switch id="scenario-optimize" checked={optimizeOnScenario} onCheckedChange={setOptimizeOnScenario} />
          </div>
        </aside>

        <div className="min-w-0 space-y-6">
          <section className="panel min-w-0 p-5" aria-label="Stress tests">
            <div className="mb-4"><h2 className="font-semibold">Stress tests</h2><p className="mt-1 text-xs text-muted-foreground">Select one event; select it again to clear it.</p></div>
            <div className="grid gap-3 sm:grid-cols-2">
              {STRESS_TESTS.map((test) => {
                const active = activeStressTest === test.id;
                return <Button key={test.id} type="button" variant={active ? "accent" : "outline"} aria-pressed={active} onClick={() => applyStressTest(active ? null : test.id)} className="h-auto min-h-20 items-start justify-start whitespace-normal p-3 text-left"><span><span className="block font-medium">{test.label}</span><span className={cn("mt-1 block text-xs font-normal", active ? "text-primary-foreground/80" : "text-muted-foreground")}>{test.description}</span></span></Button>;
              })}
            </div>
          </section>

          <div className="grid gap-4 md:grid-cols-3">
            <MetricTile id="energy" label="Energy" icon={<Zap className="h-4 w-4 text-primary" />} before={compare.before.annual.siteKBtu} after={compare.after.annual.siteKBtu} suffix="kBtu" />
            <MetricTile id="cost" label="Cost" icon={<Wallet className="h-4 w-4 text-heat" />} before={compare.before.annual.cost} after={compare.after.annual.cost} prefix="$" suffix="USD" />
            <MetricTile id="carbon" label="Carbon" icon={<Leaf className="h-4 w-4 text-savings" />} before={compare.before.annual.carbonKg} after={compare.after.annual.carbonKg} suffix="kg CO₂e" />
          </div>

          <section className="panel min-w-0 p-5" aria-label="Monthly before and after energy">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2"><div><h2 className="font-semibold">Monthly energy</h2><p className="mt-1 text-xs text-muted-foreground">Site energy before and after · kBtu · estimates</p></div><div className="flex gap-4 text-xs text-muted-foreground"><span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-muted-foreground" />Before</span><span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-primary" />After</span></div></div>
            <ChartContainer config={chartConfig} className="h-[280px] w-full aspect-auto">
              <LineChart data={monthly} accessibilityLayer margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
                <YAxis width={54} tickLine={false} axisLine={false} tick={{ fontSize: 11 }} tickFormatter={(value: number) => number(value)} />
                <ChartTooltip cursor={{ stroke: "var(--border)" }} content={<ChartTooltipContent formatter={(value, name) => <div className="flex w-full items-center justify-between gap-5"><span className="text-muted-foreground">{chartConfig[name as keyof typeof chartConfig]?.label ?? name}</span><span className="num font-medium">{number(Number(value))} kBtu</span></div>} />} />
                <Line type="monotone" dataKey="before" stroke="var(--color-before)" strokeWidth={2} dot={false} isAnimationActive={false} />
                <Line type="monotone" dataKey="after" stroke="var(--color-after)" strokeWidth={2} dot={false} isAnimationActive={false} />
              </LineChart>
            </ChartContainer>
          </section>

          <div className="grid items-start gap-6 lg:grid-cols-2">
            <section className="panel min-w-0 p-5" aria-label="Why this changed">
              <h2 className="font-semibold">Why this changed</h2>
              {!scenarioResult || scenarioResult.drivers.length === 0 ? <p className="mt-4 text-sm text-muted-foreground">Adjust a control or apply a stress test to see the largest cost drivers.</p> : <ul className="mt-4 space-y-4">{scenarioResult.drivers.map((driver) => <li key={driver.id} className="border-b border-border pb-4 last:border-0 last:pb-0"><div className="flex items-start justify-between gap-3"><h3 className="text-sm font-medium">{driver.label}</h3><span className={cn("num shrink-0 text-sm font-semibold", driver.deltaCost < 0 ? "text-savings" : driver.deltaCost > 0 ? "text-heat" : "text-muted-foreground")}>{signedMoney(driver.deltaCost)} / yr</span></div><p className="mt-2 text-xs leading-relaxed text-muted-foreground">{driver.detail}</p></li>)}</ul>}
            </section>

            <section className="panel min-w-0 p-5" aria-label="Comfort notes">
              <h2 className="font-semibold">Comfort notes</h2>
              {!scenarioResult ? <p className="mt-4 text-sm text-muted-foreground">Comfort notes appear when a scenario changes guest-room or common-area conditions.</p> : scenarioResult.flags.length === 0 ? <p className="mt-4 text-sm text-muted-foreground">No comfort warnings for this scenario.</p> : <ul className="mt-4 space-y-3">{scenarioResult.flags.map((flag) => <li key={flag.id} role="note" className={cn("rounded-md border p-3 text-sm", flag.severity === "warn" ? "border-heat/30 bg-heat/10 text-heat" : "border-border text-muted-foreground")}>{flag.message}</li>)}</ul>}
            </section>
          </div>
          <p className="text-xs text-muted-foreground">Scenario results are estimates, not a forecast or an engineering audit.</p>
        </div>
      </div>
    </div>
  );
}
