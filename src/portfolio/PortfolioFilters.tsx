import { useMemo } from "react";
import { X } from "lucide-react";
import type { Ownership } from "@/engine/hotel";
import { useTwin } from "@/store/useTwin";
import { OWNERSHIP_LABEL } from "@/store/userHotels";
import { propertyCity } from "@/store/hotelDerived";

const selectCls = "rounded-md border border-input bg-background px-2 py-1 text-xs";

/** Organization switcher and brand / region / ownership filters. Every portfolio view follows the filter. */
export function PortfolioFilters({ shown }: { shown: number }) {
  const organizations = useTwin((s) => s.organizations);
  const organizationId = useTwin((s) => s.organizationId);
  const setOrganization = useTwin((s) => s.setOrganization);
  const properties = useTwin((s) => s.portfolio.properties);
  const filter = useTwin((s) => s.portfolioFilter);
  const setFilter = useTwin((s) => s.setPortfolioFilter);
  const options = useMemo(() => {
    const uniq = (xs: (string | undefined)[]) => [...new Set(xs.filter((x): x is string => !!x))].sort();
    return {
      brands: uniq(properties.map((p) => p.brand)),
      regions: uniq(properties.map((p) => p.region)),
      ownership: uniq(properties.map((p) => p.ownership)) as Ownership[],
      cities: uniq(properties.map(propertyCity)),
    };
  }, [properties]);
  const active = !!(filter.brand || filter.region || filter.ownership || filter.city);

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-xl border border-glass-border p-3" role="group" aria-label="Organization and filters" data-testid="portfolio-filters">
      <label className="text-xs">
        <span className="mb-1 block text-muted-foreground">Organization</span>
        <select className={selectCls} value={organizationId} onChange={(e) => setOrganization(e.target.value)} data-testid="org-select">
          {organizations.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
        </select>
      </label>
      {options.cities.length > 1 && (
        <label className="text-xs">
          <span className="mb-1 block text-muted-foreground">City</span>
          <select className={selectCls} value={filter.city ?? ""} onChange={(e) => setFilter({ city: e.target.value || null })} data-testid="filter-city">
            <option value="">All cities</option>
            {options.cities.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
      )}
      <label className="text-xs">
        <span className="mb-1 block text-muted-foreground">Brand</span>
        <select className={selectCls} value={filter.brand ?? ""} onChange={(e) => setFilter({ brand: e.target.value || null })} data-testid="filter-brand">
          <option value="">All brands</option>
          {options.brands.map((b) => <option key={b} value={b}>{b}</option>)}
        </select>
      </label>
      <label className="text-xs">
        <span className="mb-1 block text-muted-foreground">Region</span>
        <select className={selectCls} value={filter.region ?? ""} onChange={(e) => setFilter({ region: e.target.value || null })} data-testid="filter-region">
          <option value="">All regions</option>
          {options.regions.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
      </label>
      <label className="text-xs">
        <span className="mb-1 block text-muted-foreground">Ownership</span>
        <select className={selectCls} value={filter.ownership ?? ""} onChange={(e) => setFilter({ ownership: (e.target.value || null) as Ownership | null })} data-testid="filter-ownership">
          <option value="">All types</option>
          {options.ownership.map((o) => <option key={o} value={o}>{OWNERSHIP_LABEL[o]}</option>)}
        </select>
      </label>
      {active && (
        <button type="button" className="inline-flex items-center gap-1 text-xs text-primary hover:underline" onClick={() => setFilter({ brand: null, region: null, ownership: null, city: null })} data-testid="filter-clear">
          <X className="size-3" /> Clear filters
        </button>
      )}
      <span className="ml-auto text-xs text-muted-foreground" aria-live="polite" data-testid="filter-count">
        Showing {shown} of {properties.length} hotels
      </span>
    </div>
  );
}
