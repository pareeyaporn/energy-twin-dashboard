import { useState } from "react";
import type { PortfolioPlan } from "@/engine/hotel";
import { useTwin } from "@/store/useTwin";
import { usd } from "@/twin/format";
import { allocationView } from "./allocation";
import { compactUsd, pct } from "./format";

/**
 * The budget split by hotel: one segment per funded hotel (its package's gross installed cost, the cost the budget is checked against)
 * and the unused remainder. Hover or focus a segment for its figures; click it to open that hotel's plan. The legend repeats every value,
 * so nothing depends on color or hover alone.
 */
export function AllocationBar({ plan, onExplore }: { plan: PortfolioPlan; onExplore: (id: string) => void }) {
  const order = useTwin((s) => s.portfolio.properties.map((p) => p.id).join("|"));
  const view = allocationView(plan, order.split("|"));
  const [active, setActive] = useState<string | null>(null);
  const used = view.segments.reduce((s, x) => s + x.amount, 0);
  const seg = view.segments.find((x) => x.propertyId === active) ?? null;
  // Tooltip position: the middle of the active segment, as a share of the bar.
  let left = 0;
  for (const x of view.segments) {
    if (x.propertyId === active) {
      left += Math.min(x.share, 1) / 2;
      break;
    }
    left += Math.min(x.share, 1);
  }
  const clampLeft = Math.min(0.85, Math.max(0.15, left));

  return (
    <div className="space-y-3" data-testid="allocation-bar" data-budget={view.budget} data-remainder={view.remainder}>
      <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
        <p className="font-medium">Budget allocation by hotel</p>
        <p className="text-xs text-muted-foreground">
          <span className="num font-medium text-foreground">{usd(used)}</span> of {usd(view.budget)} allocated · gross installed cost, before incentives (the cost the budget is checked against)
        </p>
      </div>
      <div className="relative">
        {seg && (
          <div
            role="tooltip"
            className="pointer-events-none absolute bottom-full z-10 mb-2 w-64 -translate-x-1/2 rounded-xl border border-glass-border bg-[oklch(0.18_0.04_263/0.97)] p-3 text-xs shadow-[0_12px_32px_-12px_rgb(0_0_0/0.9)]"
            style={{ left: `${clampLeft * 100}%` }}
            data-testid="allocation-tooltip"
          >
            <p className="flex items-center gap-1.5 font-medium text-foreground">
              <span className="size-2.5 shrink-0 rounded-sm" style={{ background: seg.color }} aria-hidden />
              {seg.name}
            </p>
            <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
              <dt className="text-muted-foreground">Allocated (gross)</dt>
              <dd className="num text-right">{usd(seg.amount)} · {pct(seg.share)}</dd>
              <dt className="text-muted-foreground">Net investment</dt>
              <dd className="num text-right">{usd(seg.netInvestment)}</dd>
              <dt className="text-muted-foreground">Annual savings</dt>
              <dd className="num text-right">{usd(seg.annualSavings)}/yr</dd>
              <dt className="text-muted-foreground">Payback</dt>
              <dd className="num text-right">{seg.paybackYears != null ? `${seg.paybackYears.toFixed(1)} yrs` : "—"}</dd>
            </dl>
            <p className="mt-2 text-muted-foreground">{seg.packageLabel}</p>
            <p className="mt-1 text-[11px] text-primary">Click to open the hotel plan</p>
          </div>
        )}
        <div className="flex h-9 w-full gap-[2px] overflow-hidden rounded-lg" role="list" aria-label="Budget allocation by hotel (estimates)" onMouseLeave={() => setActive(null)}>
          {view.segments.map((x) => (
            <button
              key={x.propertyId}
              type="button"
              role="listitem"
              className="h-full min-w-[6px] transition-[filter,opacity] duration-150 first:rounded-l-lg hover:brightness-110 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-white motion-reduce:transition-none"
              style={{ flexGrow: x.amount, flexBasis: 0, background: x.color, opacity: active && active !== x.propertyId ? 0.55 : 1 }}
              onMouseEnter={() => setActive(x.propertyId)}
              onFocus={() => setActive(x.propertyId)}
              onBlur={() => setActive(null)}
              onClick={() => onExplore(x.propertyId)}
              aria-label={`${x.name}: ${usd(x.amount)} gross (${pct(x.share)} of the budget), saves ${usd(x.annualSavings)} a year, payback ${x.paybackYears != null ? `${x.paybackYears.toFixed(1)} years` : "none"}, ${x.packageLabel}. Open the hotel plan.`}
              data-testid={`allocation-segment-${x.propertyId}`}
              data-amount={x.amount}
            />
          ))}
          {view.remainder > 0 && (
            <div
              role="listitem"
              className="h-full rounded-r-lg bg-[repeating-linear-gradient(135deg,color-mix(in_oklab,var(--foreground)_10%,transparent)_0_6px,color-mix(in_oklab,var(--foreground)_4%,transparent)_6px_12px)]"
              style={{ flexGrow: view.remainder, flexBasis: 0 }}
              aria-label={`Unallocated: ${usd(view.remainder)} (${pct(view.remainderShare)} of the budget)`}
              title={`Unallocated: ${usd(view.remainder)}`}
              data-testid="allocation-remainder"
              data-amount={view.remainder}
            />
          )}
        </div>
      </div>
      <ul className="flex flex-wrap gap-x-5 gap-y-1.5 text-xs" aria-label="Allocation legend">
        {view.segments.map((x) => (
          <li key={x.propertyId}>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded text-left hover:text-foreground"
              onMouseEnter={() => setActive(x.propertyId)}
              onMouseLeave={() => setActive(null)}
              onClick={() => onExplore(x.propertyId)}
            >
              <span className="size-2.5 shrink-0 rounded-sm" style={{ background: x.color }} aria-hidden />
              <span className="text-foreground/90">{x.name}</span>
              <span className="num text-muted-foreground">{compactUsd(x.amount)}</span>
            </button>
          </li>
        ))}
        {view.remainder > 0 && (
          <li className="inline-flex items-center gap-1.5 text-muted-foreground">
            <span className="size-2.5 shrink-0 rounded-sm border border-glass-border bg-foreground/10" aria-hidden />
            Unallocated <span className="num">{compactUsd(view.remainder)}</span>
          </li>
        )}
        {view.unfunded.length > 0 && (
          <li className="text-muted-foreground">No package: {view.unfunded.map((u) => u.name).join(", ")}</li>
        )}
      </ul>
    </div>
  );
}
