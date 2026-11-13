import { useEffect, useMemo, useState } from "react";
import { useUtilityHydration } from "@/utility/UtilityDataSection";
import { useNavigate } from "@tanstack/react-router";
import { Building2, ChevronDown, Plus, Sparkles } from "lucide-react";
import { useTwin } from "@/store/useTwin";
import { selectPortfolioSummary } from "@/store/hotelDerived";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
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
import { PortfolioKpis } from "./PortfolioKpis";
import { scrollToAnchor, SectionHeading } from "./Section";
import { PortfolioChat } from "@/advisor/PortfolioChat";

/**
 * The homepage, in the order of the story: understand the portfolio (header, filters, headline figures), the top investment opportunity,
 * explore the hotels (the map), plan one budget across the chain, compare the properties, and the advanced analytics (closed by default).
 * Numbers come from the store (the engine). Leaving for a hotel keeps the page's state (organization, filters, map metric, selected hotel,
 * list, table sort, scroll), so coming back shows the same view.
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
  const [deeper, setDeeper] = useState(false);
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
        scrollToAnchor(v.anchor, reduce);
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
  const where = cityNames.length === 0 ? org.city : cityNames.length <= 3 ? cityNames.join(", ") : `${cityNames.length} cities`;
  const hasSynthetic = org.properties.length === 0 || org.properties.some((p) => p.synthetic);
  const synthetic = summary.properties.some((p) => !p.synthetic) ? "Sample hotels are synthetic · yours use your inputs · modeled estimates" : "Synthetic demonstration portfolio · modeled estimates";

  return (
    <div className="mx-auto w-full max-w-7xl space-y-12 overflow-x-clip px-3 pb-16 pt-5 md:space-y-16 md:px-6 md:pt-8" data-testid="portfolio-page">
      {/* 1 · Overview: header, organization and filters, the headline figures. */}
      <div className="space-y-7">
        <header className="flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
          <div className="min-w-0 max-w-3xl">
            <p className="text-xs font-medium text-primary">See the savings before you spend.</p>
            <h1 className="mt-1.5 flex items-center gap-2.5 text-2xl font-semibold tracking-tight md:text-[2rem]">
              <Building2 className="size-6 shrink-0 text-primary" aria-hidden />
              Your Hotel Portfolio
            </h1>
            <p className="mt-2 text-sm text-muted-foreground md:text-base">See where energy costs are highest, discover savings opportunities, and invest smarter.</p>
            <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1.5 text-xs text-muted-foreground" data-testid="portfolio-context">
              <span className="font-medium text-foreground/85">{org.name}</span>
              <span aria-hidden>·</span>
              <span>{org.properties.length} {org.properties.length === 1 ? "hotel" : "hotels"}</span>
              <span aria-hidden>·</span>
              <span>{where}</span>
              {hasSynthetic && (
                <span className="rounded-full border border-glass-border px-2 py-0.5 text-[11px] text-muted-foreground/90 sm:ml-1" data-testid="portfolio-synthetic">
                  {synthetic}
                </span>
              )}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <PortfolioChat label="Ask AI" variant="ghost" />
            <AddHotelDialog
              trigger={
                <Button size="sm" variant="outline" data-testid="add-my-hotel">
                  <Plus /> Add hotel
                </Button>
              }
            />
            <Button size="sm" variant="accent" onClick={() => scrollToAnchor(OPTIMIZER_ANCHOR, reduce)} data-testid="optimize-portfolio">
              <Sparkles /> Optimize portfolio
            </Button>
          </div>
        </header>

        <PortfolioFilters shown={t.properties} />

        <PortfolioKpis totals={t} budget={budget} cities={cities.length} />
      </div>

      {/* 2 · Top investment opportunity (the ranking's first hotel). */}
      <StartHere rows={summary.properties} onExplore={explore} onWhy={(id) => setWhy({ open: true, id })} />

      {/* ---- 3 · Explore your hotels. Page layout only: this heading and wrapper belong to the page; <CityMap/> and its props are unchanged. ---- */}
      <section aria-labelledby="portfolio-explore-heading" className="space-y-5" data-testid="portfolio-explore">
        <SectionHeading id="portfolio-explore-heading" title="Explore your hotels" subtitle="Compare properties across your portfolio and discover where energy improvements matter most." />
        <CityMap rows={summary.properties} onExplore={explore} reduce={reduce} onWhy={(id) => setWhy({ open: true, id })} />
      </section>
      {/* ---- end of the map section ---- */}

      {/* 4 · Plan your portfolio investments. */}
      <div data-anchor={OPTIMIZER_ANCHOR} className="scroll-mt-20">
        <PortfolioOptimizer onExplore={openPlan} onEdit={editPlan} />
      </div>

      {/* 5 · Compare properties. */}
      <section aria-labelledby="portfolio-compare-heading" className="space-y-5" data-testid="portfolio-compare-section">
        <SectionHeading
          id="portfolio-compare-heading"
          title="Compare properties"
          subtitle="Each hotel on its own: energy cost, intensity and savings potential from its own best package, before any shared budget. Click a column to sort."
        />
        <PortfolioTable rows={summary.properties} onExplore={explore} onRemove={removeHotel} onWhy={() => setWhy({ open: true, id: null })} />
      </section>

      {/* 6 · Advanced analytics, closed by default so the page leads with the decision. */}
      <Collapsible open={deeper} onOpenChange={setDeeper} asChild>
        <section aria-label="Advanced analytics" className="rounded-2xl border border-glass-border bg-card/30" data-testid="portfolio-deeper">
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="flex w-full items-center justify-between gap-3 rounded-2xl p-5 text-left transition-colors hover:bg-card/40 motion-reduce:transition-none md:p-6"
              data-testid="portfolio-deeper-toggle"
            >
              <span className="min-w-0">
                <span className="block text-lg font-semibold tracking-tight md:text-xl">Advanced analytics</span>
                <span className="mt-1 block text-sm text-muted-foreground">Totals by brand, region, ownership or city · electricity vs gas · portfolio stress tests · definitions</span>
              </span>
              <ChevronDown className={`size-5 shrink-0 text-muted-foreground transition-transform motion-reduce:transition-none ${deeper ? "rotate-180" : ""}`} aria-hidden />
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-8 border-t border-glass-border p-5 md:p-6">
            <PortfolioGroups rows={summary.properties} />
            <PortfolioCharts rows={summary.properties} />
            <PortfolioStress />
            <div className="space-y-1 text-xs text-muted-foreground" aria-label="Definitions and assumptions">
              {summary.definitions.map((d) => <p key={d}>{d}</p>)}
              <p>{org.note}</p>
            </div>
          </CollapsibleContent>
        </section>
      </Collapsible>

      <PriorityExplainer rows={summary.properties} open={why.open} focusId={why.id} onOpenChange={(open) => setWhy((w) => ({ ...w, open }))} />
    </div>
  );
}
