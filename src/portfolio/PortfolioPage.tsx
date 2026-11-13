import { useEffect } from "react";
import { useUtilityHydration } from "@/utility/UtilityDataSection";
import { useNavigate } from "@tanstack/react-router";
import { Building2 } from "lucide-react";
import { useTwin } from "@/store/useTwin";
import { selectPortfolioSummary } from "@/store/hotelDerived";
import { usd } from "@/twin/format";
import { CityMap } from "./CityMap";
import { PortfolioCharts } from "./PortfolioCharts";
import { PortfolioOptimizer } from "./PortfolioOptimizer";
import { PortfolioStress } from "./PortfolioStress";
import { AddHotelDialog } from "./AddHotelDialog";
import { PortfolioFilters } from "./PortfolioFilters";
import { PortfolioGroups } from "./PortfolioGroups";
import { PortfolioTable } from "./PortfolioTable";

const compact = (n: number, unit: string) =>
  `${n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e4 ? `${Math.round(n / 1000).toLocaleString("en-US")}k` : Math.round(n).toLocaleString("en-US")} ${unit}`;

/** The hotel chain on one page: map, totals, comparison, charts and the shared-budget optimizer. Numbers come from the store. */
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
  // Custom plans and the user's own hotels live in the browser's storage; read them after mount (the server renders without them).
  useEffect(() => {
    hydrate();
    hydrateHotels();
  }, [hydrate, hydrateHotels]);
  const navigate = useNavigate();
  const explore = (id: string) => {
    openProperty(id);
    void navigate({ to: "/" });
  };
  const editPlan = (id: string, planId: string | null) => {
    openProperty(id);
    if (planId) setActivePlan(planId);
    void navigate({ to: "/" });
  };
  const t = summary.totals;
  const kpis: [string, string][] = [
    ["Properties", String(t.properties)],
    ["Rooms", t.rooms.toLocaleString("en-US")],
    ["Electricity", compact(t.elecKWh, "kWh / yr")],
    ["Natural gas", compact(t.gasTherms, "therms / yr")],
    ["Energy cost", `${usd(t.cost)} / yr`],
    ["CO₂", `${Math.round(t.carbonKg / 1000).toLocaleString("en-US")} t / yr`],
    ["Savings potential", `${usd(t.savingsPotential)} / yr`],
    ["Investment budget", usd(budget)],
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-5 p-3 md:p-6" data-testid="portfolio-page">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <nav aria-label="Breadcrumb" className="text-xs text-muted-foreground">Portfolio · {org.city}</nav>
          <h1 className="flex items-center gap-2 text-xl font-semibold"><Building2 className="size-5 text-primary" />{org.name}</h1>
          <p className="text-xs text-muted-foreground">
            {org.properties.length} hotels in {org.city} ·{" "}
            <span className="rounded-full border border-glass-border px-1.5 py-0.5" data-testid="portfolio-synthetic">
              {summary.properties.some((p) => !p.synthetic) ? "Sample hotels are synthetic · yours use your inputs · modeled estimates" : "Synthetic demonstration chain · modeled estimates"}
            </span>
          </p>
        </div>
        <AddHotelDialog />
      </header>

      <PortfolioFilters shown={t.properties} />

      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-8" aria-label="Portfolio totals">
        {kpis.map(([k, v]) => (
          <div key={k} className="panel rounded-xl p-3">
            <dt className="text-[11px] text-muted-foreground">{k}</dt>
            <dd className="num text-sm font-semibold">{v}</dd>
          </div>
        ))}
      </dl>

      <CityMap rows={summary.properties} onExplore={explore} reduce={reduce} />

      <section aria-label="Property comparison" className="space-y-2">
        <h2 className="text-base font-semibold">Compare the hotels</h2>
        <PortfolioTable rows={summary.properties} onExplore={explore} onRemove={removeHotel} />
      </section>

      <PortfolioGroups rows={summary.properties} />

      <PortfolioCharts rows={summary.properties} />

      <PortfolioOptimizer onExplore={explore} onEdit={editPlan} />

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
    </div>
  );
}
