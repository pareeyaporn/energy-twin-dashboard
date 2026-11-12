import { useTwin } from "@/store/useTwin";

/** Default provenance comes from the resolved profile, never inferred values. */
export function DefaultEstimate({ field, active = true }: { field?: string | undefined; active?: boolean }) {
  const usesDefault = useTwin((s) => field ? s.hotel.defaulted.includes(field) : s.hotel.defaulted.some((key) => !["budget", "objective", "horizonYears"].includes(key)));
  return active && usesDefault ? <span className="block text-[10px] font-normal text-muted-foreground">default (estimate)</span> : null;
}