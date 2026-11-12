import { useTwin } from "@/store/useTwin";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

/** Default provenance comes from the resolved profile, never inferred values. */
export function DefaultEstimate({ field, active = true, dot = false }: { field?: string | undefined; active?: boolean; dot?: boolean }) {
  const usesDefault = useTwin((s) => field ? s.hotel.defaulted.includes(field) : s.hotel.defaulted.some((key) => !["budget", "objective", "horizonYears"].includes(key)));
  if (!active || !usesDefault) return null;
  if (dot) return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button type="button" className="inline-flex h-4 w-4 shrink-0 items-center justify-center" aria-label="Default (estimate)">
            <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-muted-foreground" />
          </button>
        </TooltipTrigger>
        <TooltipContent>Default (estimate)</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
  return <span className="block text-[10px] font-normal text-muted-foreground">default (estimate)</span>;
}

/** One provenance line for a card containing several fields, instead of repeating it on every field. */
export function DefaultEstimateNotice({ fields, active = true }: { fields?: readonly string[]; active?: boolean }) {
  const usesDefault = useTwin((s) => fields
    ? fields.some((field) => s.hotel.defaulted.includes(field))
    : s.hotel.defaulted.length > 0);
  return active && usesDefault
    ? <p className="text-[11px] leading-relaxed text-muted-foreground">Some values are defaults (estimates) — marked with •</p>
    : null;
}
