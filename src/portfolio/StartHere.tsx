import { ArrowRight, Info, Target } from "lucide-react";
import type { PropertySummary } from "@/engine/hotel";
import { Button } from "@/components/ui/button";
import { startHere } from "./priority";

/** "Start here": the hotel that deserves attention first by investment priority, and why (from the engine's figures). */
export function StartHere({ rows, onExplore, onWhy }: { rows: PropertySummary[]; onExplore: (id: string) => void; onWhy: (id: string) => void }) {
  const s = startHere(rows);
  if (!s) {
    return (
      <section aria-label="Start here" className="rounded-xl border border-glass-border p-3 text-xs text-muted-foreground" data-testid="start-here">
        No hotel shown has an upgrade package with a positive 10-year return within its budget, so there is no investment priority to show.
      </section>
    );
  }
  return (
    <section
      aria-label="Start here"
      className="flex flex-wrap items-start gap-3 rounded-xl border border-primary/40 bg-primary/[0.06] p-3 shadow-[0_0_30px_-18px_var(--primary)]"
      data-testid="start-here"
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary" aria-hidden><Target className="size-4.5" /></span>
      <div className="min-w-0 flex-1 text-sm">
        <div className="text-[11px] font-medium uppercase tracking-[0.12em] text-primary">Start here · highest investment priority</div>
        <div className="font-semibold">{s.top.name} <span className="font-normal text-muted-foreground">· {s.top.neighborhood}, {s.top.city}</span></div>
        <p className="text-xs text-muted-foreground" data-testid="start-here-reason">{s.reason}</p>
        {s.contrast && <p className="mt-0.5 text-xs text-muted-foreground">{s.contrast}</p>}
      </div>
      <div className="flex shrink-0 flex-wrap gap-2">
        <Button size="sm" variant="ghost" onClick={() => onWhy(s.top.id)} data-testid="priority-why"><Info /> Why this ranking?</Button>
        <Button size="sm" onClick={() => onExplore(s.top.id)} data-testid="start-here-open">Open {s.top.name} <ArrowRight /></Button>
      </div>
    </section>
  );
}
