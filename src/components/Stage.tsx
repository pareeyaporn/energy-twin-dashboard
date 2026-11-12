import { HotelTwin } from "@/twin/HotelTwin";
import { useTwin } from "@/store/useTwin";
import { Badge } from "@/components/ui/badge";
import { DefaultEstimate } from "@/components/DefaultEstimate";

export function Stage() {
  const selectedZone = useTwin((s) => s.selectedZone);
  const layer = useTwin((s) => s.twinLayer);
  return (
    <div className="hotel-stage min-w-0 bg-background p-3 md:p-5" data-zone-selected={selectedZone !== null} data-twin-layer={layer}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-base font-semibold">Digital twin</h1>
        <Badge variant="outline" className="border-primary/30 text-primary">Simulated data</Badge>
      </div>
      <DefaultEstimate />
      <HotelTwin />
      {layer === "zones" && <div aria-label="Zone cost legend" className="mt-4 flex flex-wrap items-center gap-3 text-xs text-muted-foreground"><span>Annual zone cost</span><span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-efficient" />Lower</span><span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-heat" />Mid-range</span><span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-loss" />Higher</span></div>}
      {layer === "flow" && <div aria-label="Flow legend" className="mt-4 flex flex-wrap gap-4 text-xs text-muted-foreground"><span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-primary" />Energy sources</span><span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-efficient" />Zones</span><span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-heat" />End uses</span></div>}
    </div>
  );
}
