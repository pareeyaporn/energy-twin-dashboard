import { useMemo } from "react";
import { BookOpen } from "lucide-react";
import { benchmarkComparison } from "@/engine/hotel";
import { useTwin } from "@/store/useTwin";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const eui = (value: number) => value.toLocaleString("en-US", { maximumFractionDigits: 1 });
const difference = (value: number) => `${value > 0 ? "+" : ""}${Math.round(value * 100)}% vs`;

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

/** Modeled site EUI beside published peer values; context only, never a performance rating. */
export function BenchmarkCard() {
  const baseline = useTwin((state) => state.baseline);
  const hotel = useTwin((state) => state.hotel);
  const comparison = useMemo(
    () => benchmarkComparison(baseline, hotel.profile.floorAreaSqft),
    [baseline, hotel.profile.floorAreaSqft],
  );
  const max = Math.max(comparison.siteEuiKBtuPerSqft, ...comparison.peers.map((peer) => peer.siteEuiKBtuPerSqft), 1);

  return (
    <section aria-label="How this hotel compares" className="min-w-0 space-y-4 rounded-lg border border-border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">How this hotel compares</h2>
        <Badge variant="outline" className="border-primary/25 text-[10px] font-normal text-primary">Estimate</Badge>
      </div>

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
    </section>
  );
}
