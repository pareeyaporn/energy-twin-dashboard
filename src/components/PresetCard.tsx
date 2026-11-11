import { Home } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PresetHome } from "@/store/useTwin";

export function PresetCard({ preset, selected, onSelect }: { preset: PresetHome; selected: boolean; onSelect: () => void }) {
  return (
    <button type="button" role="radio" aria-checked={selected} onClick={onSelect}
      className={cn("lift flex w-full items-center gap-3 rounded-xl border p-3 text-left",
        selected ? "border-primary bg-primary/5 shadow-glow" : "border-glass-border bg-glass hover:border-input")}>
      <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-lg", selected ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground")}>
        <Home className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{preset.title} — {preset.city}</span>
        <span className="block truncate text-xs text-muted-foreground">{preset.year} · {preset.sqft.toLocaleString()} sq ft · {preset.systemLabel}</span>
      </span>
      <span className="num shrink-0 text-right text-sm font-semibold">${preset.yearlyCost.toLocaleString()}<span className="block text-[11px] font-normal text-text-muted">/yr</span></span>
    </button>
  );
}
