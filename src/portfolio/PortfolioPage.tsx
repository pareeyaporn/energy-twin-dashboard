import { useEffect, useMemo, useState } from "react";
import { HowCalculated } from "@/explain/HowCalculated";
import type { MetricId } from "@/explain/explanations";
import { useUtilityHydration } from "@/utility/UtilityDataSection";
import { useNavigate } from "@tanstack/react-router";
import { Building2, ChevronDown, Sparkles } from "lucide-react";
import { useTwin } from "@/store/useTwin";
import { selectPortfolioSummary } from "@/store/hotelDerived";
import { usd } from "@/twin/format";
import { Button } from "@/components/ui/button";
import { openTabWhenReady } from "@/app/landing";
import { CityMap } from "./CityMap";
import { PortfolioCharts } from "./PortfolioCharts";
import { PortfolioOptimizer } from "./PortfolioOptimizer";
import { PortfolioStress } from "./PortfolioStress";
import { AddHotelDialog } from "./AddHotelDialog";
import { PortfolioFilters } from "./PortfolioFilters";
import { PortfolioGroups } from "./PortfolioGroups";
import { PortfolioTable } from "./PortfolioTable";
import { PriorityExplainer } from "./PriorityExplainer";
import { StartHere } from "./StartHere";
import { cityGroups } from "./cities";
import { OPTIMIZER_ANCHOR } from "./anchors";

const compact = (n: number, unit: string) =>
  `${n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e4 ? `${Math.round(n / 1000).toLocaleString("en-US")}k` : Math.round(n).toLocaleString("en-US")} ${unit}`;


/**
 * The homepage: the hotel portfolio on one page. Which hotel deserves attention first, the map, totals, comparison, charts, the
 * shared-budget optimizer and the stress tests. Numbers come from the store (the engine). Leaving for a hotel keeps the page's state
 * (organization, filters, map metric, selected hotel, list, table sort, scroll), so coming back shows the same view.
 */
export function PortfolioPage() {
  const org = useTwin((s) => s.portfolio);
  const summary = useTwin(selectPortfolioSummary);
  const budget = useTwin((s) => s.portfolioBudget);
  const reduce = useTwin((s) => s.reduceEffects);
  const openProperty = useTwin((s) => s.openProperty);
  const setActivePlan = useTwin((s) => s.setActiveCustomPlan);
  const hydrate = useTwin((s) => s.hydrateCustomPlans);
  const hydrateHotels = useTwin((s) => s.hydrateUserHotels);
  useUtilityHydration();
  const removeHotel = useTwin((s) => s.removeUserHotel);
  const setView = useTwin((s) => s.setPortfolioView);
  const [why, setWhy] = useState<{ open: boolean; id: string | null }>({ open: false, id: null });
  const [moreKpis, setMoreKpis] = useState(false);
  // Custom plans and the user's own hotels live in the browser's storage; read them after mount (the server renders without them).
  useEffect(() => {
    hydrate();
    hydrateHotels();
  }, [hydrate, hydrateHotels]);
  // Back from a hotel: the same scroll position, or the section a link asked for.
  useEffect(() => {
    const v = useTwin.getState().portfolioView;
    const t = setTimeout(() => {
      if (v.anchor) {
        document.querySelector(`[data-anchor="${v.anchor}"]`)?.scrollIntoView({ block: "start", behavior: reduce ? "auto" : "smooth" });
        setView({ anchor: null });
      } else if (v.scrollY > 0) window.scrollTo({ top: v.scrollY });
    }, 120);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const navigate = useNavigate();
  /** Opens a hotel; the portfolio remembers it (its card is open and its marker selected on return) and where the page was scrolled. */
  const leaveFor = (id: string) => {
    setView({ selectedId: id, scrollY: typeof window === "undefined" ? 0 : window.scrollY });
    openProperty(id);
  };
  const explore = (id: string) => {
    leaveFor(id);
    void navigate({ to: "/hotel" });
  };
  const openPlan = (id: string) => {
    leaveFor(id);
    void Promise.resolve(navigate({ to: "/hotel" })).then(() => openTabWhenReady("Invest"));
  };
  const editPlan = (id: string, planId: string | null) => {
    leaveFor(id);
    if (planId) setActivePlan(planId);
    void Promise.resolve(navigate({ to: "/hotel" })).then(() => openTabWhenReady("Invest"));
  };
  const t = summary.totals;
  const cities = useMemo(() => cityGroups(summary.properties), [summary.properties]);
  const cityNames = org.properties.length ? [...new Set(org.properties.map((p) => p.input.city ?? "Chicago"))] : [];
  const where = cityNames.length <= 1 ? cityNames[0] ?? org.city : `${cityNames.length} cities`;
  const intensity = t.floorAreaSqft > 0 ? t.siteKBtu / t.floorAreaSqft : 0;
  const primary: { k: string; v: string; note?: string; how?: MetricId }[] = [
    { k: "Annual energy cost", v: `${usd(t.cost)} / yr`, how: "portfolioCost" },
    { k: "Savings potential", v: `${usd(t.savingsPotential)} / yr`, note: `for ${usd(t.investmentRequired)} net`, how: "savingsPotential" },
    { k: "Carbon", v: `${Math.round(t.carbonKg / 1000).toLocaleString("en-US")} t CO₂e / yr`, how: "portfolioCarbon" },
    { k: "Properties", v: String(t.properties), note: `${t.rooms.toLocaleString("en-US")} rooms${cities.length > 1 ? ` · ${cities.length} cities` : ""}` },
  ];
  const secondary: [string, string][] = [
    ["Electricity", compact(t.elecKWh, "kWh / yr")],
    ["Natural gas", compact(t.gasTherms, "therms / yr")],
    ["Total energy", compact(t.siteKBtu / 1000, "MMBtu / yr")],
    ["Energy intensity", `${intensity.toFixed(1)} kBtu/ft² / yr`],
    ["Rooms", t.rooms.toLocaleString("en-US")],
    ["Investment budget", usd(budget)],
  ];
  const synthetic = summary.properties.some((p) => !p.synthetic) ? "Sample hotels are synthetic · yours use your inputs · modeled estimates" : "Synthetic demonstration portfolio · modeled estimates";

  return (
    <div className="mx-auto max-w-7xl space-y-5 p-3 md:p-6" data-testid="portfolio-page">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <nav aria-label="Breadcrumb" className="text-xs text-muted-foreground">Portfolio · {org.name}</nav>
          <h1 className="flex items-center gap-2 text-xl font-semibold md:text-2xl"><Building2 className="size-5 text-primary" />Your Hotel Portfolio</h1>
          <p className="text-sm text-muted-foreground">Monitor energy performance, identify opportunities, and prioritize investments across your properties.</p>
          <p className="mt-1 text-xs text-muted-foreground">
            <span className="text-primary">See the savings before you spend.</span> · {org.name} · {org.properties.length} hotels in {where} ·{" "}
            <span className="rounded-full border border-glass-border px-1.5 py-0.5" data-testid="portfolio-synthetic">{synthetic}</span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="accent"
            onClick={() => document.querySelector(`[data-anchor="${OPTIMIZER_ANCHOR}"]`)?.scrollIntoView({ block: "start", behavior: reduce ? "auto" : "smooth" })}
            data-testid="optimize-portfolio"
          >
            <Sparkles /> Optimize portfolio
          </Button>
          <AddHotelDialog />
        </div>
      </header>

      <PortfolioFilters shown={t.properties} />

      <section aria-label="Portfolio totals" className="space-y-2">
        <dl className="grid grid-cols-2 gap-2 lg:grid-cols-4" data-testid="portfolio-kpis">
          {primary.map((x) => (
            <div key={x.k} className="panel rounded-xl p-3">
              <dt className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">{x.k}<span className="flex items-center gap-1">{x.k !== "Properties" && <span className="rounded-full border border-glass-border px-1.5 text-[9px]">Estimate</span>}{x.how && <HowCalculated metric={x.how} />}</span></dt>
              <dd className="num text-lg font-semibold">{x.v}</dd>
              {x.note && <dd className="text-[11px] text-muted-foreground">{x.note}</dd>}
            </div>
          ))}
        </dl>
        <button type="button" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground sm:hidden" aria-expanded={moreKpis} onClick={() => setMoreKpis((o) => !o)}>
          {moreKpis ? "Fewer figures" : "More figures"} <ChevronDown className={`size-3 transition-transform ${moreKpis ? "rotate-180" : ""}`} />
        </button>
        <dl className={`${moreKpis ? "grid" : "hidden"} grid-cols-2 gap-x-4 gap-y-1 rounded-xl border border-glass-border px-3 py-2 text-xs sm:flex sm:flex-wrap sm:gap-x-6`} data-testid="portfolio-kpis-secondary">
          {secondary.map(([k, v]) => (
            <div key={k} className="flex items-baseline gap-1.5">
              <dt className="flex items-center gap-1 text-muted-foreground">{k}{k === "Energy intensity" && <HowCalculated metric="portfolioIntensity" />}</dt>
              <dd className="num font-medium">{v}</dd>
            </div>
          ))}
        </dl>
      </section>

      <StartHere rows={summary.properties} onExplore={explore} onWhy={(id) => setWhy({ open: true, id })} />

      <CityMap rows={summary.properties} onExplore={explore} reduce={reduce} onWhy={(id) => setWhy({ open: true, id })} />

      <section aria-label="Property comparison" className="space-y-2">
        <h2 className="text-base font-semibold">Compare the hotels</h2>
        <PortfolioTable rows={summary.properties} onExplore={explore} onRemove={removeHotel} onWhy={() => setWhy({ open: true, id: null })} />
      </section>

      <PortfolioGroups rows={summary.properties} />

      <PortfolioCharts rows={summary.properties} />

      <div data-anchor={OPTIMIZER_ANCHOR} className="scroll-mt-4">
        <PortfolioOptimizer onExplore={openPlan} onEdit={editPlan} />
      </div>

      <PortfolioStress />

      <section aria-label="Coming later" className="space-y-2">
        <h2 className="text-base font-semibold">More building types (coming later)</h2>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {org.futureBuildingTypes.map((b) => (
            <div key={b.id} className="rounded-xl border border-dashed border-glass-border p-3 text-xs">
              <div className="font-medium">{b.label}</div>
              <p className="text-muted-foreground">{b.note} Not simulated yet.</p>
            </div>
          ))}
        </div>
      </section>

      <section aria-label="Definitions and assumptions" className="space-y-1 text-[11px] text-muted-foreground">
        {summary.definitions.map((d) => <p key={d}>{d}</p>)}
        <p>{org.note}</p>
      </section>

      <PriorityExplainer rows={summary.properties} open={why.open} focusId={why.id} onOpenChange={(open) => setWhy((w) => ({ ...w, open }))} />
    </div>
  );
}
