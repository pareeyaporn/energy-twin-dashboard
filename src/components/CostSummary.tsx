import { useTwin, selectBaselineCost } from "@/store/useTwin";
import { AnimatedNumber } from "./AnimatedNumber";
import { InfoTip } from "./InfoTip";

export function CostSummary() {
  const cost = useTwin(selectBaselineCost);
  const { electricMonthly, fuelMonthly } = useTwin((s) => s.home);
  const total = electricMonthly + fuelMonthly || 1;
  const elecPct = Math.round((electricMonthly / total) * 100);
  return (
    <div className="glass rounded-xl p-4">
      <p className="label-caps">Estimated yearly energy cost</p>
      <InfoTip text="What you likely spend each year on electricity plus heating fuel, before any upgrades.">
        <AnimatedNumber value={cost} prefix="$" className="mt-1 block text-3xl font-semibold tracking-tight" />
      </InfoTip>
      <div className="mt-3 flex h-1.5 overflow-hidden rounded-full bg-muted" aria-label={`Electric ${elecPct}%, gas ${100 - elecPct}%`}>
        <div className="bg-efficient transition-all duration-500" style={{ width: `${elecPct}%` }} />
        <div className="bg-heat transition-all duration-500" style={{ width: `${100 - elecPct}%` }} />
      </div>
      <div className="mt-1.5 flex justify-between text-[11px] text-muted-foreground">
        <span><span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-efficient" />Electric {elecPct}%</span>
        <span>Gas/fuel {100 - elecPct}%<span className="ml-1 inline-block h-1.5 w-1.5 rounded-full bg-heat" /></span>
      </div>
      <p className="mt-3 flex items-center gap-1 text-[11px] text-text-muted">Synthetic planning estimate <InfoTip text="Existing sample estimates use EIA and NREL ResStock references, adjusted with your bills; not a validated hotel model." /></p>
    </div>
  );
}
