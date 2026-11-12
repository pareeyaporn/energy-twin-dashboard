import { Link } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import { useTwin } from "@/store/useTwin";
import { selectActiveProperty } from "@/store/hotelDerived";

/** Portfolio → Chicago → hotel, shown when the open hotel came from the portfolio. */
export function PortfolioBreadcrumb() {
  const property = useTwin(selectActiveProperty);
  const orgs = useTwin((s) => s.organizations);
  const current = useTwin((s) => s.portfolio);
  const name = useTwin((s) => s.hotel.profile.name);
  if (!property) return null;
  const org = orgs.find((o) => o.id === property.organizationId) ?? current;
  return (
    <nav aria-label="Breadcrumb" className="mb-1 flex flex-wrap items-center gap-1 text-xs text-muted-foreground" data-testid="portfolio-breadcrumb">
      <Link to="/portfolio" className="inline-flex items-center gap-0.5 text-primary hover:underline">
        <ChevronLeft className="size-3" />
        Portfolio
      </Link>
      <span aria-hidden>›</span>
      <span>{org.name}</span>
      <span aria-hidden>›</span>
      <span aria-current="page" className="text-foreground">{name}</span>
    </nav>
  );
}
