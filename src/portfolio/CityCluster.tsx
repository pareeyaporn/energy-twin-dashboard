import { MapPin } from "lucide-react";
import type { CityGroup } from "./cities";

/**
 * A city on the map when the view is zoomed out over several cities: its name, how many hotels it has and the city's figure for the map's
 * metric. Clicking it zooms to that city's hotels.
 */
export function CityCluster({ group, valueText, metricLabel, onPick }: { group: CityGroup; valueText: string; metricLabel: string; onPick: (city: string) => void }) {
  return (
    <div className="pointer-events-none absolute left-0 top-0 h-0 w-0">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onPick(group.city);
        }}
        className="pointer-events-auto absolute flex -translate-x-1/2 -translate-y-1/2 items-center gap-2 whitespace-nowrap rounded-2xl border border-primary/50 bg-[oklch(0.2_0.05_263/0.92)] px-3 py-1.5 text-left shadow-[0_0_22px_-4px_var(--primary)] transition-transform hover:scale-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
        aria-label={`${group.city}: ${group.hotels} hotel${group.hotels === 1 ? "" : "s"}, ${metricLabel} ${valueText}. Zoom to ${group.city}.`}
        data-testid={`city-cluster-${group.city}`}
      >
        <span className="flex size-7 items-center justify-center rounded-full bg-primary/20 text-xs font-semibold text-primary">{group.hotels}</span>
        <span>
          <span className="flex items-center gap-1 text-xs font-semibold"><MapPin className="size-3 text-primary" aria-hidden />{group.city}</span>
          <span className="num block text-[10px] text-muted-foreground">{valueText}</span>
        </span>
      </button>
    </div>
  );
}
