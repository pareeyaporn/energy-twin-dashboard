import { useMemo, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { AirVent, Check, Droplets, Gauge, Home, Lightbulb, Plus, Radar, Sun, Thermometer, X } from "lucide-react";
import { evaluatePlanItem } from "@/engine/hotel";
import type { CatalogItem, UpgradeId } from "@/engine/hotel";
import { useTwin } from "@/store/useTwin";
import { selectPlanContext } from "@/store/hotelDerived";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { SolarAssumptions } from "./SolarAssumptions";
import { energySaved, tonnes, unverifiedIncentives, usd, verifiedIncentives, years } from "./format";

export const UPGRADE_ICON: Partial<Record<UpgradeId, LucideIcon>> = {
  smart_room_controls: Thermometer,
  energy_management: Gauge,
  hvac_upgrade: AirVent,
  led_lighting: Lightbulb,
  occupancy_sensors: Radar,
  rooftop_solar: Sun,
  insulation: Home,
  water_heating: Droplets,
};

function fmtQty(item: CatalogItem, q: number): string {
  const k = item.quantity.kind;
  if (k === "whole") return "Whole system";
  if (k === "percent") return `${Math.round(q)}%`;
  if (k === "kw") return `${q.toLocaleString("en-US", { maximumFractionDigits: 1 })} kW`;
  return `${Math.round(q).toLocaleString("en-US")} ${item.quantity.unit}`;
}

/**
 * One upgrade in the catalog: what it is, how much of it (rooms, %, ft², kW), and its own figures at that quantity, computed by the
 * same engine function as the optimizer. Adding it puts it in the active plan, where the whole plan is recomputed together.
 */
export function CatalogCard({ item, planQuantity, onAdd, onRemove, onQuantity }: {
  item: CatalogItem;
  /** The quantity in the active plan, or null when the upgrade is not in it. */
  planQuantity: number | null;
  onAdd: (q: number) => void;
  onRemove: () => void;
  onQuantity: (q: number) => void;
}) {
  const ctx = useTwin(selectPlanContext);
  const budget = useTwin((s) => s.hotel.profile.budget);
  const rate = useTwin((s) => s.hotelDiscountRate);
  const [draft, setDraft] = useState(item.quantity.default);
  const inPlan = planQuantity !== null;
  const q = inPlan ? planQuantity : draft;
  const setQ = (v: number) => (inPlan ? onQuantity(v) : setDraft(v));
  const ev = useMemo(
    () => (item.available ? evaluatePlanItem(ctx, { id: item.id, quantity: q }, { budget, assumptions: { discountRate: rate } }) : null),
    [ctx, item.id, item.available, q, budget, rate],
  );
  const f = ev?.financials;
  const Icon = UPGRADE_ICON[item.id] ?? Gauge;
  const unverified = f ? unverifiedIncentives(f) : [];
  const qk = item.quantity;

  return (
    <article
      className={`flex min-w-0 flex-col rounded-xl border bg-glass p-3 text-sm transition-colors ${inPlan ? "border-primary/60 ring-1 ring-primary/30" : "border-glass-border hover:border-primary/30"} ${item.available ? "" : "opacity-60"}`}
      aria-label={item.label}
      data-testid={`catalog-${item.id}`}
    >
      <div className="flex items-start gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/15 text-primary" aria-hidden>
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <h4 className="font-medium leading-tight">{item.label}</h4>
          <div className="mt-1 flex flex-wrap gap-1">
            <Badge variant="outline" className={`h-5 px-1.5 text-[10px] font-normal ${item.costStatus === "sourced" ? "border-savings/40 text-savings" : "border-heat/40 text-heat"}`}>
              {item.costStatus === "sourced" ? "Sourced cost" : "Placeholder cost"}
            </Badge>
            <Badge variant="outline" className="h-5 px-1.5 text-[10px] font-normal text-muted-foreground">Estimated savings</Badge>
          </div>
        </div>
        {inPlan && <Check className="h-4 w-4 shrink-0 text-primary" aria-label="In your plan" />}
      </div>
      <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{item.description}</p>

      {!item.available ? (
        <p className="mt-2 text-xs text-heat">{item.unavailableReason}</p>
      ) : (
        <>
          <div className="mt-3 space-y-1.5">
            <div className="flex items-baseline justify-between gap-2 text-xs">
              <span className="text-muted-foreground">{qk.kind === "whole" ? "Scope" : "Quantity"}</span>
              <span className="font-medium tabular-nums">{fmtQty(item, q)}</span>
            </div>
            {qk.kind !== "whole" && (
              <div className="flex items-center gap-2">
                <Slider
                  value={[q]}
                  min={qk.min}
                  max={qk.max}
                  step={qk.step}
                  onValueChange={(v) => setQ(v[0] ?? q)}
                  aria-label={`${item.label} quantity (${qk.unit})`}
                  className="flex-1"
                />
                <input
                  type="number"
                  inputMode="decimal"
                  min={qk.min}
                  max={qk.max}
                  step={qk.step}
                  value={Math.round(q * 10) / 10}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    if (Number.isFinite(v)) setQ(Math.min(qk.max, Math.max(qk.min, v)));
                  }}
                  aria-label={`${item.label} quantity in ${qk.unit}`}
                  className="h-7 w-20 rounded-md border border-glass-border bg-background px-1.5 text-right text-xs tabular-nums"
                />
              </div>
            )}
            <p className="text-[11px] text-muted-foreground">{qk.scope}</p>
          </div>

          {f && (
            <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs" data-testid={`catalog-figures-${item.id}`}>
              <div><dt className="text-muted-foreground">Gross cost</dt><dd className="tabular-nums">{usd(f.grossCost.mid)}</dd></div>
              <div><dt className="text-muted-foreground">Net investment</dt><dd className="tabular-nums">{usd(f.netInvestment.mid)}</dd></div>
              <div><dt className="text-muted-foreground">Saves / yr</dt><dd className="tabular-nums text-savings">{usd(f.annualSavings.mid)}</dd></div>
              <div><dt className="text-muted-foreground">Payback</dt><dd className="tabular-nums">{years(f.simplePaybackYears)}</dd></div>
              <div><dt className="text-muted-foreground">NPV 10 yr</dt><dd className={`tabular-nums ${(f.npv10?.mid ?? 0) < 0 ? "text-heat" : ""}`}>{usd(f.npv10?.mid ?? 0)}</dd></div>
              <div><dt className="text-muted-foreground">CO₂ / yr</dt><dd className="tabular-nums">{tonnes(f.carbonAvoidedKgPerYear.mid)}</dd></div>
              <div className="col-span-2"><dt className="text-muted-foreground">Energy saved / yr</dt><dd className="tabular-nums">{energySaved(f)}</dd></div>
              <div className="col-span-2 text-[11px] text-muted-foreground">
                Incentives: {verifiedIncentives(f) > 0 ? `${usd(verifiedIncentives(f))} verified` : "none verified"}
                {unverified.length > 0 && ` · ${unverified.length} listed, unverified ($0 in figures)`}
              </div>
            </dl>
          )}
          <p className="mt-1 text-[10px] text-muted-foreground">On its own, before combining with the rest of a plan. Estimate.</p>
          {item.id === "rooftop_solar" && <SolarAssumptions sizeKw={q} />}

          <div className="mt-3 flex gap-2">
            {inPlan ? (
              <Button size="sm" variant="secondary" className="w-full" onClick={onRemove} aria-label={`Remove ${item.label} from plan`}>
                <X className="h-3.5 w-3.5" /> Remove
              </Button>
            ) : (
              <Button size="sm" variant="accentOutline" className="w-full" onClick={() => onAdd(q)} aria-label={`Add ${item.label} to plan`}>
                <Plus className="h-3.5 w-3.5" /> Add to plan
              </Button>
            )}
          </div>
        </>
      )}
    </article>
  );
}
