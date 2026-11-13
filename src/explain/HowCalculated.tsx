import { useMemo, useState } from "react";
import { ChevronDown, Info } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useTwin } from "@/store/useTwin";
import { cn } from "@/lib/utils";
import { DATA_CLASS, ESTIMATE_STATEMENT, explain, financialAssumptions } from "./explanations";
import type { DataClass, ExplainInput, MetricId } from "./explanations";

const CLASS_TONE: Record<DataClass, string> = {
  verified: "border-savings/40 text-savings",
  user: "border-primary/40 text-primary",
  modeled: "border-glass-border text-foreground/80",
  synthetic: "border-heat/40 text-heat",
  assumption: "border-heat/30 text-heat/90",
};

/** A small label for a value's data class (published source, your input, modeled, synthetic, assumption). */
export function DataClassBadge({ cls }: { cls: DataClass }) {
  return (
    <span className={cn("inline-block shrink-0 rounded-full border px-1.5 py-px text-[9px] leading-tight", CLASS_TONE[cls])} title={DATA_CLASS[cls].meaning}>
      {DATA_CLASS[cls].label}
    </span>
  );
}

function InputRows({ rows }: { rows: ExplainInput[] }) {
  return (
    <ul className="space-y-1">
      {rows.map((r) => (
        <li key={r.label} className="flex items-start justify-between gap-2 text-[11px]">
          <span className="min-w-0">
            <span className="text-muted-foreground">{r.label}: </span>
            <span>{r.value}</span>
          </span>
          <DataClassBadge cls={r.cls} />
        </li>
      ))}
    </ul>
  );
}

/** The explanation, recomputed only when what it quotes changes (the hotel, its baseline, the discount rate). */
function useExplanation(metric: MetricId) {
  const hotel = useTwin((s) => s.hotel);
  const baseline = useTwin((s) => s.baseline);
  const rate = useTwin((s) => s.hotelDiscountRate);
  const preset = useTwin((s) => s.hotelPresetId);
  return useMemo(() => explain(metric, useTwin.getState()), [metric, hotel, baseline, rate, preset]);
}

/**
 * "How was this calculated?" next to a figure: an info button that opens a short explanation (what it means, how it is calculated,
 * the main inputs and their data class), with sources, limits and technical detail behind "More detail". Text from `explain()`.
 */
export function HowCalculated({ metric, className }: { metric: MetricId; className?: string }) {
  const [more, setMore] = useState(false);
  const e = useExplanation(metric);
  return (
    <Popover onOpenChange={(open) => !open && setMore(false)}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn("inline-flex shrink-0 items-center justify-center rounded-full p-0.5 text-muted-foreground hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", className)}
          aria-label={`How was ${e.title.toLowerCase()} calculated?`}
          data-testid={`how-${metric}`}
          onClick={(ev) => ev.stopPropagation()}
        >
          <Info className="size-3.5" aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(360px,calc(100vw-24px))] space-y-2 border-glass-border bg-popover p-3 text-xs" onClick={(ev) => ev.stopPropagation()} data-testid={`how-panel-${metric}`}>
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold">{e.title}</h3>
          <DataClassBadge cls="modeled" />
        </div>
        <p>{e.means}</p>
        <p className="text-muted-foreground">
          <span className="font-medium text-foreground">How: </span>
          {e.how}
        </p>
        {e.inputs.length > 0 && <InputRows rows={e.inputs} />}
        <button type="button" className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline" aria-expanded={more} onClick={() => setMore((m) => !m)}>
          {more ? "Less detail" : "More detail"} <ChevronDown className={cn("size-3 transition-transform", more && "rotate-180")} />
        </button>
        {more && (
          <div className="space-y-2 border-t border-border pt-2 text-[11px] text-muted-foreground">
            {e.technical && <p className="break-words">{e.technical}</p>}
            {e.sources.length > 0 && (
              <div>
                <div className="font-medium text-foreground">Sources</div>
                <ul className="list-disc pl-4">{e.sources.map((x) => <li key={x} className="break-words">{x}</li>)}</ul>
              </div>
            )}
            {e.limits.length > 0 && (
              <div>
                <div className="font-medium text-foreground">Limits</div>
                <ul className="list-disc pl-4">{e.limits.map((x) => <li key={x}>{x}</li>)}</ul>
              </div>
            )}
          </div>
        )}
        <p className="border-t border-border pt-2 text-[10px] text-muted-foreground">{ESTIMATE_STATEMENT}</p>
      </PopoverContent>
    </Popover>
  );
}

/** The financial assumptions behind every plan, in one list with their data class (Improvement 6E). */
export function FinancialAssumptionsPanel() {
  const hotel = useTwin((s) => s.hotel);
  const rate = useTwin((s) => s.hotelDiscountRate);
  const rows = useMemo(() => financialAssumptions(useTwin.getState()), [hotel, rate]);
  return (
    <section aria-label="Financial assumptions" className="space-y-2" data-testid="financial-assumptions">
      <h2 className="text-sm font-semibold">Financial assumptions</h2>
      <InputRows rows={rows} />
      <p className="text-[11px] text-muted-foreground">The discount rate is editable in the Invest tab; every payback, NPV and net benefit recalculates with it.</p>
    </section>
  );
}

/** What each data label means (Improvement 6C). */
export function DataClassLegend() {
  return (
    <section aria-label="How data is labeled" className="space-y-2" data-testid="data-class-legend">
      <h2 className="text-sm font-semibold">How data is labeled</h2>
      <ul className="space-y-1.5">
        {(Object.keys(DATA_CLASS) as DataClass[]).map((c) => (
          <li key={c} className="flex items-start gap-2 text-[11px]">
            <DataClassBadge cls={c} />
            <span className="text-muted-foreground">{DATA_CLASS[c].meaning}</span>
          </li>
        ))}
      </ul>
      <p className="text-[11px] text-muted-foreground">{ESTIMATE_STATEMENT} No confidence score is shown: where defensible ranges exist (savings, costs), they are given as low to high.</p>
    </section>
  );
}
