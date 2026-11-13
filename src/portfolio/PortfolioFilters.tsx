import { useMemo, useState } from "react";
import { ChevronDown, SlidersHorizontal, X } from "lucide-react";
import type { Ownership } from "@/engine/hotel";
import { useTwin } from "@/store/useTwin";
import type { PortfolioFilter } from "@/store/useTwin";
import { OWNERSHIP_LABEL } from "@/store/userHotels";
import { propertyCity } from "@/store/hotelDerived";
import { useIsMobile } from "@/hooks/use-mobile";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

const selectCls =
  "h-9 w-full rounded-lg border border-input bg-background px-2.5 text-sm transition-colors hover:border-foreground/30 focus-visible:border-primary";
const triggerCls =
  "inline-flex h-9 items-center gap-1.5 rounded-lg border border-input bg-background px-3 text-sm transition-colors hover:border-foreground/30 data-[state=open]:border-primary/60";

type Key = "brand" | "region" | "ownership" | "city";
const ALL: PortfolioFilter = { brand: null, region: null, ownership: null, city: null };

/**
 * Organization switcher, the city (multi-city organizations) and a compact "Filters" menu for brand, region and ownership, with chips for
 * the active filters. Uses the store's `portfolioFilter` only: every portfolio view (KPIs, ranking, map, table) follows it.
 */
export function PortfolioFilters({ shown }: { shown: number }) {
  const organizations = useTwin((s) => s.organizations);
  const organizationId = useTwin((s) => s.organizationId);
  const setOrganization = useTwin((s) => s.setOrganization);
  const properties = useTwin((s) => s.portfolio.properties);
  const filter = useTwin((s) => s.portfolioFilter);
  const setFilter = useTwin((s) => s.setPortfolioFilter);
  const mobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const options = useMemo(() => {
    const uniq = (xs: (string | undefined)[]) => [...new Set(xs.filter((x): x is string => !!x))].sort();
    return {
      brands: uniq(properties.map((p) => p.brand)),
      regions: uniq(properties.map((p) => p.region)),
      ownership: uniq(properties.map((p) => p.ownership)) as Ownership[],
      cities: uniq(properties.map(propertyCity)),
    };
  }, [properties]);
  const inMenu = [filter.brand, filter.region, filter.ownership].filter(Boolean).length;
  const chips: { key: Key; label: string }[] = [
    ...(filter.city ? [{ key: "city" as const, label: `City: ${filter.city}` }] : []),
    ...(filter.brand ? [{ key: "brand" as const, label: `Brand: ${filter.brand}` }] : []),
    ...(filter.region ? [{ key: "region" as const, label: `Region: ${filter.region}` }] : []),
    ...(filter.ownership ? [{ key: "ownership" as const, label: `Ownership: ${OWNERSHIP_LABEL[filter.ownership]}` }] : []),
  ];

  const fields = (
    <div className="grid gap-3" data-testid="filter-fields">
      <label className="text-xs">
        <span className="mb-1 block font-medium text-muted-foreground">Brand</span>
        <select className={selectCls} value={filter.brand ?? ""} onChange={(e) => setFilter({ brand: e.target.value || null })} data-testid="filter-brand">
          <option value="">All brands</option>
          {options.brands.map((b) => <option key={b} value={b}>{b}</option>)}
        </select>
      </label>
      <label className="text-xs">
        <span className="mb-1 block font-medium text-muted-foreground">Region</span>
        <select className={selectCls} value={filter.region ?? ""} onChange={(e) => setFilter({ region: e.target.value || null })} data-testid="filter-region">
          <option value="">All regions</option>
          {options.regions.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
      </label>
      <label className="text-xs">
        <span className="mb-1 block font-medium text-muted-foreground">Ownership</span>
        <select className={selectCls} value={filter.ownership ?? ""} onChange={(e) => setFilter({ ownership: (e.target.value || null) as Ownership | null })} data-testid="filter-ownership">
          <option value="">All types</option>
          {options.ownership.map((o) => <option key={o} value={o}>{OWNERSHIP_LABEL[o]}</option>)}
        </select>
      </label>
    </div>
  );
  const triggerLabel = (
    <>
      <SlidersHorizontal className="size-3.5 text-muted-foreground" aria-hidden />
      Filters{inMenu > 0 && <span className="num rounded-full bg-primary/15 px-1.5 text-[11px] font-medium text-primary">{inMenu}</span>}
      <ChevronDown className={`size-3.5 text-muted-foreground transition-transform motion-reduce:transition-none ${open ? "rotate-180" : ""}`} aria-hidden />
    </>
  );

  return (
    <div className="space-y-2" role="group" aria-label="Organization and filters" data-testid="portfolio-filters">
      <div className="flex flex-wrap items-end gap-2">
        <label className="min-w-0 text-xs">
          <span className="mb-1 block font-medium text-muted-foreground">Organization</span>
          <select className={`${selectCls} max-w-[16rem] sm:w-auto`} value={organizationId} onChange={(e) => setOrganization(e.target.value)} data-testid="org-select">
            {organizations.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        </label>
        {options.cities.length > 1 && (
          <label className="text-xs">
            <span className="mb-1 block font-medium text-muted-foreground">City</span>
            <select className={`${selectCls} sm:w-auto`} value={filter.city ?? ""} onChange={(e) => setFilter({ city: e.target.value || null })} data-testid="filter-city">
              <option value="">All cities</option>
              {options.cities.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
        )}
        {!mobile && (
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <button type="button" className={triggerCls} aria-label={`Filters${inMenu ? `, ${inMenu} active` : ""}`} data-testid="filter-menu">{triggerLabel}</button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-72 rounded-xl border-glass-border bg-[oklch(0.2_0.04_263)] p-4" data-testid="filter-popover">
              {fields}
              {inMenu > 0 && (
                <button type="button" className="mt-3 text-xs text-primary hover:underline" onClick={() => setFilter({ brand: null, region: null, ownership: null })}>
                  Clear these filters
                </button>
              )}
            </PopoverContent>
          </Popover>
        )}
        <span className="ml-auto self-center text-xs text-muted-foreground" aria-live="polite" data-testid="filter-count">
          Showing {shown} of {properties.length} hotels
        </span>
      </div>
      {mobile && (
        <Collapsible open={open} onOpenChange={setOpen}>
          <CollapsibleTrigger asChild>
            <button type="button" className={triggerCls} data-testid="filter-menu">{triggerLabel}</button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-2 rounded-xl border border-glass-border p-3" data-testid="filter-popover">{fields}</CollapsibleContent>
        </Collapsible>
      )}
      {chips.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5" aria-label="Active filters" data-testid="filter-chips">
          {chips.map((c) => (
            <span key={c.key} className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/[0.08] py-0.5 pl-2.5 pr-1 text-xs" data-testid={`filter-chip-${c.key}`}>
              {c.label}
              <button
                type="button"
                className="inline-flex size-5 items-center justify-center rounded-full text-muted-foreground hover:bg-primary/15 hover:text-foreground"
                onClick={() => setFilter({ [c.key]: null })}
                aria-label={`Remove filter ${c.label}`}
                data-testid={`filter-chip-remove-${c.key}`}
              >
                <X className="size-3" aria-hidden />
              </button>
            </span>
          ))}
          <button type="button" className="ml-1 text-xs text-primary hover:underline" onClick={() => setFilter(ALL)} data-testid="filter-clear">
            Reset filters
          </button>
        </div>
      )}
    </div>
  );
}
