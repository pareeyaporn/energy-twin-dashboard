import { useMemo, useState } from "react";
import { Activity, BookOpen } from "lucide-react";
import { benchmarkComparison } from "@/engine/hotel";
import { useTwin } from "@/store/useTwin";
import { selectIsSynthetic, selectUtilityStatus } from "@/store/hotelDerived";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ShowMore, SidebarHeading, reveal, sidebarCard } from "@/app/sidebar";
import { cn } from "@/lib/utils";
import { DATA_STATUS_TONE, dataStatusOf } from "@/utility/dataStatus";

const eui = (value: number) => value.toLocaleString("en-US", { maximumFractionDigits: 1 });
const difference = (value: number) => `${value > 0 ? "+" : ""}${Math.round(value * 100)}% vs`;

/** The ENERGY STAR hotel median is the headline reference in the compact Hotel health card. */
export const HEADLINE_PEER_ID = "energy_star_hotel_median";

function BenchmarkBar({ label, value, max, hotel = false }: { label: string; value: number; max: number; hotel?: boolean }) {
  return (
    <div
      className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
      role="img"
      aria-label={`${label}: ${eui(value)} kBtu per square foot a year`}
    >
      <div
        className={hotel ? "h-full rounded-full bg-primary" : "h-full rounded-full bg-muted-foreground/60"}
        style={{ width: `${max > 0 ? Math.max(2, (value / max) * 100) : 0}%` }}
      />
    </div>
  );
}

function useComparison() {
  const baseline = useTwin((state) => state.baseline);
  const floorArea = useTwin((state) => state.hotel.profile.floorAreaSqft);
  return useMemo(() => benchmarkComparison(baseline, floorArea), [baseline, floorArea]);
}

/** The full comparison: the hotel and every peer with exact values, bars, sources and the caveat. */
function BenchmarkDetails() {
  const comparison = useComparison();
  const max = Math.max(comparison.siteEuiKBtuPerSqft, ...comparison.peers.map((peer) => peer.siteEuiKBtuPerSqft), 1);
  return (
    <>
      <div className="space-y-2" data-testid="hotel-site-eui" data-value={comparison.siteEuiKBtuPerSqft}>
        <div className="flex items-baseline justify-between gap-3 text-sm">
          <span>This hotel</span>
          <span className="num font-semibold">{eui(comparison.siteEuiKBtuPerSqft)}</span>
        </div>
        <p className="text-[11px] text-muted-foreground">kBtu per ft² a year, modeled</p>
        <BenchmarkBar hotel label="This hotel" value={comparison.siteEuiKBtuPerSqft} max={max} />
      </div>

      <div className="space-y-4 border-t border-border pt-3">
        {comparison.peers.map((peer) => (
          <div key={peer.id} className="min-w-0 space-y-2" data-testid={`benchmark-peer-${peer.id}`} data-value={peer.siteEuiKBtuPerSqft} data-difference={peer.difference}>
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
              <div className="min-w-0">
                <p className="text-xs font-medium leading-snug">{peer.label}</p>
                <p className="num mt-1 text-xs text-muted-foreground">
                  {eui(peer.siteEuiKBtuPerSqft)} kBtu per ft² a year · {difference(peer.difference)}
                </p>
              </div>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="outline" size="sm" className="h-6 shrink-0 px-2 text-[10px]" aria-label={`Source for ${peer.label}`}>
                      <BookOpen />Source
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-80">{peer.source}</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <BenchmarkBar label={peer.label} value={peer.siteEuiKBtuPerSqft} max={max} />
          </div>
        ))}
      </div>
      <p className="text-[11px] leading-relaxed text-muted-foreground">{comparison.note}</p>
      <p className="text-[11px] leading-relaxed text-muted-foreground">
        Peer values are national medians and means across all climates, amenity levels and hotel types (CBECS lodging also includes nursing
        homes and dormitories). A difference is context, not proof of inefficiency: climate, pools, kitchens and laundry all move energy use.
      </p>
    </>
  );
}

/** Modeled site EUI beside published peer values; context only, never a performance rating. */
export function BenchmarkCard() {
  return (
    <section aria-label="How this hotel compares" className="min-w-0 space-y-4 rounded-lg border border-border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">How this hotel compares</h2>
        <Badge variant="outline" className="border-primary/25 text-[10px] font-normal text-primary">Estimate</Badge>
      </div>
      <BenchmarkDetails />
    </section>
  );
}

/**
 * Hotel health (the Hotel step): energy intensity and its difference from the ENERGY STAR hotel median, both from `benchmarkComparison`
 * (the same figures as the full card), the data status and a short caveat. "View benchmarks & sources" opens the full comparison.
 */
export function HotelHealthCard() {
  const comparison = useComparison();
  const status = dataStatusOf(useTwin(selectUtilityStatus), useTwin(selectIsSynthetic));
  const [open, setOpen] = useState(false);
  const headline = comparison.peers.find((p) => p.id === HEADLINE_PEER_ID) ?? comparison.peers[0];
  const pct = headline ? Math.round(headline.difference * 100) : null;
  return (
    <section aria-label="Hotel health" className={cn(sidebarCard, "space-y-3")} data-testid="hotel-health">
      <SidebarHeading
        icon={<Activity className="size-4 text-primary" aria-hidden />}
        title="Hotel health"
        right={<span className={`shrink-0 rounded-full border px-1.5 py-px text-[10px] ${DATA_STATUS_TONE[status.id]}`} title={status.detail}>{status.label}</span>}
      />
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
        <div>
          <p className="num text-2xl font-semibold leading-none" data-testid="health-eui" data-value={comparison.siteEuiKBtuPerSqft}>
            {eui(comparison.siteEuiKBtuPerSqft)}
            <span className="ml-1 text-xs font-normal text-muted-foreground">kBtu/ft²/yr</span>
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">Energy intensity, modeled</p>
        </div>
        {headline && pct !== null && (
          <p className="text-right text-xs" data-testid="health-difference" data-value={pct}>
            <span className="num text-base font-semibold text-primary">{pct > 0 ? "+" : ""}{pct}%</span>
            <span className="block text-[11px] text-muted-foreground">vs ENERGY STAR hotel median</span>
          </p>
        )}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-x-3">
        <ShowMore open={open} onClick={() => setOpen((o) => !o)} more="View benchmarks & sources" less="Hide benchmarks" controls="benchmark-details" testId="health-toggle" />
        <p className="text-[10px] leading-snug text-muted-foreground">National, all climates: context, not a rating</p>
      </div>
      {open && (
        <div id="benchmark-details" className={`space-y-4 border-t border-border pt-3 ${reveal}`} aria-label="How this hotel compares">
          <BenchmarkDetails />
        </div>
      )}
    </section>
  );
}
