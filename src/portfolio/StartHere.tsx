import { AskAbout } from "@/advisor/AskAbout";
import { ArrowRight, Info, MapPin } from "lucide-react";
import type { PropertySummary } from "@/engine/hotel";
import { upgradeDef } from "@/engine/hotel";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { usd } from "@/twin/format";
import { compactUsd } from "./format";
import { EstimateBadge } from "./Section";
import { startHere } from "./priority";

/**
 * The top investment opportunity: the first hotel of the investment-priority ranking (`startHere`, the engine's scores) with three of
 * its best package's figures. "Why this hotel?" holds the reasoning; the full ranking opens the explainer.
 */
export function StartHere({ rows, onExplore, onWhy }: { rows: PropertySummary[]; onExplore: (id: string) => void; onWhy: (id: string) => void }) {
  const s = startHere(rows);
  if (!s) {
    return (
      <section aria-label="Top investment opportunity" className="rounded-2xl border border-glass-border p-5 text-sm text-muted-foreground" data-testid="start-here">
        No hotel shown has an upgrade package with a positive 10-year return within its budget, so there is no investment priority to show.
      </section>
    );
  }
  const c = s.top.potential!;
  const metrics: { k: string; v: string; exact: string; hint: string }[] = [
    { k: "Projected annual savings", v: `${compactUsd(c.annualSavings)}/yr`, exact: `${usd(c.annualSavings)} a year`, hint: "Annual savings of this hotel's best package" },
    { k: "Net investment", v: compactUsd(c.netInvestment), exact: usd(c.netInvestment), hint: "Installed cost minus confirmed incentives" },
    {
      k: "Simple payback",
      v: c.paybackYears !== null ? `${c.paybackYears.toFixed(1)} yrs` : "—",
      exact: c.paybackYears !== null ? `${c.paybackYears.toFixed(2)} years` : "No payback",
      hint: "Net investment ÷ annual savings",
    },
  ];
  const pkg = c.upgradeIds.map((id) => upgradeDef(id).label).join(" + ");
  return (
    <section
      aria-label="Top investment opportunity"
      className="relative overflow-hidden rounded-2xl border border-primary/30 bg-[linear-gradient(135deg,color-mix(in_oklab,var(--primary)_9%,transparent),transparent_60%)] p-5 md:p-6"
      data-testid="start-here"
    >
      <div className="flex flex-wrap items-start justify-between gap-x-8 gap-y-5">
        <div className="min-w-0 max-w-xl">
          <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">
            Top investment opportunity <EstimateBadge />
          </p>
          <p className="mt-2 text-xl font-semibold tracking-tight md:text-2xl" data-testid="start-here-name">{s.top.name}</p>
          <p className="mt-0.5 flex items-center gap-1 text-sm text-muted-foreground">
            <MapPin className="size-3.5" aria-hidden /> {s.top.neighborhood}, {s.top.city}
          </p>
          <p className="mt-3 text-sm text-muted-foreground">Highest modeled investment priority based on financial return and upgrade opportunity.</p>
        </div>
        <dl className="grid w-full grid-cols-3 gap-3 sm:w-auto sm:gap-8" data-testid="start-here-metrics">
          {metrics.map((m) => (
            <div key={m.k} className="min-w-0" title={`${m.k}: ${m.exact}. ${m.hint}.`}>
              <dt className="text-xs text-muted-foreground">{m.k}</dt>
              <dd className="num mt-1 text-lg font-semibold md:text-2xl" aria-label={`${m.k}: ${m.exact}`}>{m.v}</dd>
            </div>
          ))}
        </dl>
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-2">
        <Button onClick={() => onExplore(s.top.id)} data-testid="start-here-open">
          Explore this hotel <ArrowRight />
        </Button>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" data-testid="priority-why"><Info /> Why this hotel?</Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-[min(26rem,calc(100vw-2rem))] space-y-2 rounded-xl border-glass-border bg-[oklch(0.2_0.04_263)] p-4 text-sm" data-testid="start-here-why">
            <p className="font-medium">Why {s.top.name}?</p>
            <p className="text-muted-foreground" data-testid="start-here-reason">{s.reason}</p>
            {s.contrast && <p className="text-muted-foreground">{s.contrast}</p>}
            <p className="text-xs text-muted-foreground">Best package: {pkg}. Modeled estimates.</p>
            <button type="button" className="text-xs font-medium text-primary hover:underline" onClick={() => onWhy(s.top.id)} data-testid="priority-why-all">
              How every hotel is ranked →
            </button>
          </PopoverContent>
        </Popover>
        <AskAbout scope="portfolio" question="Which hotel should we invest in first, and why?" label="Ask AI" className="self-center" />
      </div>
    </section>
  );
}
