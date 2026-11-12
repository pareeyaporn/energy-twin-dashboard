import { DefaultEstimate } from "@/components/DefaultEstimate";
import type { ReactNode } from "react";
import { Leaf, Wallet, Zap } from "lucide-react";
import { useTwin } from "@/store/useTwin";
import { selectCompare } from "@/store/hotelDerived";
import { AnimatedNumber } from "@/components/AnimatedNumber";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const number = (n: number) => Math.round(n).toLocaleString("en-US");

function Kpi({ id, label, icon, before, after, prefix = "", unit }: { id: string; label: string; icon: ReactNode; before: number; after: number; prefix?: string; unit: string }) {
  const delta = after - before;
  const same = Math.round(before) === Math.round(after);
  const pct = before ? (delta / before) * 100 : 0;
  return (
    <section className="min-w-0 rounded-lg border border-border bg-card px-3 py-2 min-h-32" aria-label={`Annual ${label.toLowerCase()}`} data-testid={`kpi-${id}`}>
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">{icon}{label}</h2>
        <Badge variant="outline" className="border-primary/25 text-[10px] font-normal text-primary">Estimate</Badge>
      </div>
      <DefaultEstimate />
      <p className="num mt-1 flex flex-wrap items-baseline gap-x-1.5 text-sm">
        {!same && <><span className="text-muted-foreground">{prefix}{number(before)}</span><span className="text-muted-foreground" aria-label="to">→</span></>}
        <span className="text-base font-semibold"><AnimatedNumber value={after} prefix={prefix} /></span>
        <span className="text-[10px] text-muted-foreground">{unit} / yr</span>
      </p>
      <div className="min-h-4">{!same && <p className={cn("num text-xs", delta < 0 ? "text-savings" : "text-heat")}>{delta < 0 ? "−" : "+"}{prefix}{number(Math.abs(delta))} ({pct > 0 ? "+" : ""}{pct.toFixed(1)}%)</p>}</div>
    </section>
  );
}

/** Annual cost, energy and carbon for what the twin shows, against its baseline. */
export function KpiStrip() {
  const compare = useTwin(selectCompare);
  return (
    <div className="grid shrink-0 gap-2 sm:grid-cols-3">
      <Kpi id="cost" label="Cost" icon={<Wallet className="h-3.5 w-3.5 text-heat" />} before={compare.before.annual.cost} after={compare.after.annual.cost} prefix="$" unit="USD" />
      <Kpi id="energy" label="Energy" icon={<Zap className="h-3.5 w-3.5 text-primary" />} before={compare.before.annual.siteKBtu} after={compare.after.annual.siteKBtu} unit="kBtu" />
      <Kpi id="carbon" label="Carbon" icon={<Leaf className="h-3.5 w-3.5 text-savings" />} before={compare.before.annual.carbonKg} after={compare.after.annual.carbonKg} unit="kg CO₂e" />
    </div>
  );
}
