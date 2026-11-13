import { useState } from "react";
import { Building2, ChevronDown, Leaf, PiggyBank, Wallet } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { PortfolioSummary } from "@/engine/hotel";
import { HowCalculated } from "@/explain/HowCalculated";
import type { MetricId } from "@/explain/explanations";
import { usd } from "@/twin/format";
import { compactNumber, compactUsd, pct, shareOf, tonnes } from "./format";
import { EstimateBadge } from "./Section";

interface Kpi {
  id: string;
  label: string;
  value: string;
  /** The exact value, for the title and the accessible label. */
  exact: string;
  support?: string;
  icon: LucideIcon;
  how?: MetricId;
  estimate: boolean;
  highlight?: boolean;
}

/**
 * The four headline figures (energy spend, savings potential, carbon, properties) and the compact strip of secondary totals. Every value is
 * the portfolio summary's (the engine's) total, formatted; the savings share is savings ÷ spend from the same totals.
 */
export function PortfolioKpis({ totals, budget, cities }: { totals: PortfolioSummary["totals"]; budget: number; cities: number }) {
  const [more, setMore] = useState(false);
  const t = totals;
  const share = shareOf(t.savingsPotential, t.cost);
  const kpis: Kpi[] = [
    { id: "cost", label: "Annual energy spend", value: `${compactUsd(t.cost)}/yr`, exact: `${usd(t.cost)} a year`, icon: Wallet, how: "portfolioCost", estimate: true },
    {
      id: "savings",
      label: "Potential annual savings",
      value: `${compactUsd(t.savingsPotential)}/yr`,
      exact: `${usd(t.savingsPotential)} a year, for ${usd(t.investmentRequired)} net investment`,
      support: `for ${compactUsd(t.investmentRequired)} net investment`,
      icon: PiggyBank,
      how: "savingsPotential",
      estimate: true,
      highlight: true,
    },
    { id: "carbon", label: "Annual carbon emissions", value: tonnes(t.carbonKg), exact: `${Math.round(t.carbonKg).toLocaleString("en-US")} kg CO₂e a year`, support: "per year", icon: Leaf, how: "portfolioCarbon", estimate: true },
    {
      id: "properties",
      label: "Properties",
      value: `${t.properties} ${t.properties === 1 ? "hotel" : "hotels"}`,
      exact: `${t.properties} hotels, ${t.rooms.toLocaleString("en-US")} rooms`,
      support: `${t.rooms.toLocaleString("en-US")} rooms${cities > 1 ? ` · ${cities} cities` : ""}`,
      icon: Building2,
      estimate: false,
    },
  ];
  const intensity = t.floorAreaSqft > 0 ? t.siteKBtu / t.floorAreaSqft : 0;
  const secondary: { k: string; v: string; exact: string; how?: MetricId }[] = [
    { k: "Electricity", v: compactNumber(t.elecKWh, "kWh/yr"), exact: `${Math.round(t.elecKWh).toLocaleString("en-US")} kWh a year` },
    { k: "Natural gas", v: compactNumber(t.gasTherms, "therms/yr"), exact: `${Math.round(t.gasTherms).toLocaleString("en-US")} therms a year` },
    { k: "Total energy", v: compactNumber(t.siteKBtu / 1000, "MMBtu/yr"), exact: `${Math.round(t.siteKBtu / 1000).toLocaleString("en-US")} MMBtu a year` },
    { k: "Energy intensity", v: `${intensity.toFixed(1)} kBtu/ft²/yr`, exact: `${intensity.toFixed(2)} kBtu per square foot a year`, how: "portfolioIntensity" },
    { k: "Rooms", v: t.rooms.toLocaleString("en-US"), exact: `${t.rooms.toLocaleString("en-US")} rooms` },
    { k: "Investment budget", v: compactUsd(budget), exact: usd(budget) },
  ];

  return (
    <section aria-label="Portfolio totals" className="space-y-3">
      <dl className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 lg:grid-cols-4" data-testid="portfolio-kpis">
        {kpis.map((k) => (
          <div
            key={k.id}
            className={`group relative flex min-w-0 flex-col rounded-2xl border p-4 transition-colors duration-200 motion-reduce:transition-none md:p-5 ${
              k.highlight
                ? "border-primary/35 bg-primary/[0.05] shadow-[0_0_40px_-22px_var(--primary)] hover:border-primary/55"
                : "border-glass-border bg-card/40 hover:border-foreground/15 hover:bg-card/60"
            }`}
            data-testid={`kpi-${k.id}`}
          >
            <dt className="flex min-h-10 items-start justify-between gap-2 text-sm text-muted-foreground">
              <span className="flex min-w-0 items-center gap-2">
                <k.icon className={`size-4 shrink-0 ${k.highlight ? "text-primary" : "text-muted-foreground/80"}`} aria-hidden />
                <span className="min-w-0">{k.label}</span>
              </span>
              <span className="flex shrink-0 items-center gap-1">
                {k.estimate && <EstimateBadge />}
                {k.how && <HowCalculated metric={k.how} />}
              </span>
            </dt>
            <dd className="num mt-3 text-2xl font-semibold tracking-tight md:text-[1.75rem]" title={k.exact} aria-label={`${k.label}: ${k.exact}`}>
              {k.value}
            </dd>
            {k.highlight && share !== null && (
              <dd className="mt-2 space-y-1.5" data-testid="kpi-savings-share" data-share={share}>
                <span className="text-xs text-muted-foreground">
                  <span className="num font-medium text-primary">{pct(share)}</span> of annual energy spend
                </span>
                <span className="block h-1 overflow-hidden rounded-full bg-foreground/10" aria-hidden>
                  <span className="block h-full rounded-full bg-primary" style={{ width: `${Math.min(100, share * 100)}%` }} />
                </span>
              </dd>
            )}
            {k.support && <dd className="mt-1 text-xs text-muted-foreground">{k.support}</dd>}
          </div>
        ))}
      </dl>
      <button
        type="button"
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground sm:hidden"
        aria-expanded={more}
        onClick={() => setMore((o) => !o)}
        data-testid="portfolio-kpis-more"
      >
        {more ? "Fewer portfolio metrics" : "More portfolio metrics"} <ChevronDown className={`size-3 transition-transform motion-reduce:transition-none ${more ? "rotate-180" : ""}`} />
      </button>
      <dl
        className={`${more ? "grid" : "hidden"} grid-cols-2 gap-x-4 gap-y-2 px-1 text-xs sm:flex sm:flex-wrap sm:items-baseline sm:gap-x-0 sm:gap-y-1.5`}
        data-testid="portfolio-kpis-secondary"
      >
        {secondary.map((x, i) => (
          <div key={x.k} className={`flex min-w-0 items-baseline gap-1.5 sm:px-4 ${i === 0 ? "sm:pl-0" : "sm:border-l sm:border-glass-border"}`} title={x.exact}>
            <dt className="flex items-center gap-1 text-muted-foreground">{x.k}{x.how && <HowCalculated metric={x.how} />}</dt>
            <dd className="num font-medium" aria-label={`${x.k}: ${x.exact}`}>{x.v}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
