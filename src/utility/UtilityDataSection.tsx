import { useEffect, useState } from "react";
import { Database, Gauge, Lock, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTwin } from "@/store/useTwin";
import { selectUtilitySet, selectUtilityStatus } from "@/store/hotelDerived";
import { PROVENANCE_LABEL, isActualData } from "@/store/utilityData";
import { billTotals, coverageDays } from "@/engine/hotel";
import { UtilityDataManager } from "./UtilityDataManager";

const PRIVACY = "Kept in this browser only; not sent to Energy Twin's servers or the AI advisor.";
const usd = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;
export const UTILITY_STATUS = {
  modeled: { label: "Modeled estimate", text: "No utility data has been provided; the figures are Energy Twin's estimates.", tone: "border-border text-muted-foreground" },
  provided: { label: "Utility data provided", text: "Records are saved; the simulation still uses the modeled baseline until you choose the calibrated one.", tone: "border-primary/40 text-primary" },
  calibrated: { label: "Calibrated model", text: "The simulation is adjusted to the bills (calibrated baseline active).", tone: "border-savings/50 text-savings" },
} as const;

/** Reads saved utility data once in the browser. */
export function useUtilityHydration() {
  const hydrate = useTwin((s) => s.hydrateUtilityData);
  useEffect(() => hydrate(), [hydrate]);
}

export type UtilityStep = "edit" | "review";

/**
 * The Hotel tab's Utility Data section: status, coverage, billed spending, and the Utility Data Manager. `onManage` lets a parent own the
 * manager (so it can also open from a collapsed heading); `embedded` drops the card frame and moves the privacy note into a tooltip.
 */
export function UtilityDataSection({ onManage, embedded = false }: { onManage?: (step: UtilityStep) => void; embedded?: boolean } = {}) {
  useUtilityHydration();
  const status = useTwin(selectUtilityStatus);
  const set = useTwin(selectUtilitySet);
  const notice = useTwin((s) => s.utilityNotice);
  const clearNotice = useTwin((s) => s.clearUtilityNotice);
  const modeledCost = useTwin((s) => s.baseline.annual.cost);
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<UtilityStep>("edit");
  const manage = (next: UtilityStep) => {
    if (onManage) return onManage(next);
    setStep(next);
    setOpen(true);
  };
  const s = UTILITY_STATUS[status];
  const t = set ? billTotals(set.records) : null;
  const days = set ? Math.max(coverageDays(set.records, "elec"), coverageDays(set.records, "gas")) : 0;
  const billed = t ? t.elecCost + t.gasCost : 0;

  return (
    <section className={embedded ? "space-y-2 text-sm" : "space-y-2 rounded-lg border border-border bg-card p-4 text-sm"} aria-label="Utility data" data-testid="utility-section">
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-1.5 font-medium"><Database className="size-4 text-primary" />Utility data</h3>
        <span className={`rounded-full border px-2 py-0.5 text-[11px] ${s.tone}`} data-testid="utility-status">{s.label}</span>
      </div>
      <p className="text-xs text-muted-foreground">{s.text}</p>
      {set && t && (
        <dl className="grid grid-cols-2 gap-2 text-xs">
          <div><dt className="text-muted-foreground">Source</dt><dd className={isActualData(set) ? "" : "text-heat"}>{PROVENANCE_LABEL[set.provenance]}{set.markedActual && set.provenance === "sample_edited" ? " · marked as real" : ""}</dd></div>
          <div><dt className="text-muted-foreground">Billing coverage</dt><dd className="num">{set.records.length} bills · {days} days · {set.year}</dd></div>
          {billed !== 0 && <div><dt className="text-muted-foreground">Billed spending (actual)</dt><dd className="num font-medium" data-testid="utility-billed">{usd(billed)}</dd></div>}
          <div><dt className="text-muted-foreground">{status === "calibrated" ? "Calibrated projection" : "Modeled projection"}</dt><dd className="num font-medium">{usd(modeledCost)} / yr</dd></div>
        </dl>
      )}
      {notice && (
        <p role="status" className="flex items-start justify-between gap-2 rounded-md border border-primary/30 bg-primary/10 p-2 text-xs">
          <span>{notice}</span>
          <button type="button" onClick={clearNotice} aria-label="Dismiss" className="text-muted-foreground hover:text-foreground"><X className="size-3.5" /></button>
        </p>
      )}
      <div className="flex flex-wrap gap-2 pt-1">
        <Button size="sm" onClick={() => manage("edit")} data-testid="manage-utility"><Database />Manage Utility Data</Button>
        {set && <Button size="sm" variant="outline" onClick={() => manage("review")} data-testid="review-utility"><Gauge />Compare & calibrate</Button>}
      </div>
      {embedded ? (
        <p className="flex items-center gap-1 text-[10px] text-muted-foreground" title={PRIVACY}><Lock className="size-3" aria-hidden />Kept in this browser only<span className="sr-only">: {PRIVACY}</span></p>
      ) : (
        <p className="text-[10px] text-muted-foreground">{PRIVACY}</p>
      )}
      {!onManage && <UtilityDataManager open={open} onOpenChange={setOpen} initialStep={step} />}
    </section>
  );
}
