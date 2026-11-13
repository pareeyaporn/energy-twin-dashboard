import type { UtilityStatus } from "@/store/hotelDerived";

// One data-status label for the open hotel, from provenance the store already tracks: the utility status (`selectUtilityStatus`:
// modeled, provided, calibrated) and the synthetic flag (`selectIsSynthetic`). Nothing is inferred beyond those two values.

export type DataStatusId = "synthetic" | "entered" | "provided" | "calibrated";

export interface DataStatus {
  id: DataStatusId;
  /** Short label for a pill. */
  label: string;
  /** One sentence for a tooltip. */
  detail: string;
}

export function dataStatusOf(utility: UtilityStatus, synthetic: boolean): DataStatus {
  if (utility === "calibrated") {
    return { id: "calibrated", label: "Calibrated to bills", detail: "The simulation is adjusted to the utility bills (calibrated baseline active). Still an estimate." };
  }
  if (utility === "provided") {
    return { id: "provided", label: "Bills provided", detail: "Utility records are saved; the figures still use the modeled baseline until you choose the calibrated one." };
  }
  return synthetic
    ? { id: "synthetic", label: "Synthetic estimate", detail: "Synthetic demo hotel; every figure is a modeled estimate." }
    : { id: "entered", label: "User-entered · modeled", detail: "Built from the details entered for this hotel; the figures are modeled estimates (no utility bills yet)." };
}

/** Pill colors: cyan for data that is the user's own or calibrated, amber for synthetic (it must stand out), muted otherwise. */
export const DATA_STATUS_TONE: Record<DataStatusId, string> = {
  synthetic: "border-heat/40 text-heat",
  entered: "border-border text-muted-foreground",
  provided: "border-primary/40 text-primary",
  calibrated: "border-savings/50 text-savings",
};
