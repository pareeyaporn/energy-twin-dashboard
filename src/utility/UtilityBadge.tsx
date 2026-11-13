import { useEffect } from "react";
import { useTwin } from "@/store/useTwin";
import { selectUtilitySet, selectUtilityStatus } from "@/store/hotelDerived";
import { isActualData } from "@/store/utilityData";
import { billTotals } from "@/engine/hotel";

const usd = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;

/** A portfolio hotel's utility-data marker: none, "Utility data" (saved, modeled baseline) or "Calibrated to bills". */
export function UtilityBadge({ propertyId }: { propertyId: string }) {
  const set = useTwin((s) => s.utilityData[propertyId]);
  if (!set) return null;
  const calibrated = set.baseline === "calibrated";
  const actual = isActualData(set);
  return (
    <span
      className={`ml-1.5 inline-flex rounded-full border px-1.5 text-[10px] font-normal ${calibrated ? "border-savings/50 text-savings" : "border-primary/40 text-primary"}`}
      title={`${calibrated ? "Calibrated baseline in use" : "Utility data saved; modeled baseline in use"} · ${actual ? "the hotel's records" : "synthetic sample records"}`}
      data-testid={`utility-badge-${propertyId}`}
    >
      {calibrated ? "Calibrated to bills" : "Utility data"}
      {!actual ? " (sample)" : ""}
    </span>
  );
}

/** Under the twin's yearly cost: billed spending from the records, kept apart from the modeled or calibrated projection. */
export function UtilityHeaderNote() {
  const hydrate = useTwin((s) => s.hydrateUtilityData);
  useEffect(() => hydrate(), [hydrate]);
  const set = useTwin(selectUtilitySet);
  const status = useTwin(selectUtilityStatus);
  if (!set) return null;
  const t = billTotals(set.records);
  const billed = t.elecCost + t.gasCost;
  return (
    <div className="text-[11px] text-muted-foreground" data-testid="twin-utility-note">
      {status === "calibrated" ? "Calibrated to bills" : "Modeled (bills saved, not applied)"}
      {billed !== 0 ? ` · billed ${usd(billed)} in ${set.year}${isActualData(set) ? "" : " (sample)"}` : ""}
    </div>
  );
}
