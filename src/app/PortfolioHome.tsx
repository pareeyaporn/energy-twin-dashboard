import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Disclaimer } from "@/components/Disclaimer";
import { SourcesSheet } from "@/components/SourcesSheet";
import { TopBar } from "@/components/TopBar";
import { PortfolioPage } from "@/portfolio/PortfolioPage";
import { useTwin } from "@/store/useTwin";
import { firstLanding, lastView, rememberView } from "./landing";

/**
 * The homepage: the hotel portfolio (served at `/` and `/portfolio`). A returning user who last worked in the hotel dashboard goes back
 * there on the first load; an organization with a single hotel opens that hotel directly.
 */
export function PortfolioHome() {
  const navigate = useNavigate();
  const properties = useTwin((s) => s.portfolio.properties);
  const openProperty = useTwin((s) => s.openProperty);
  useEffect(() => {
    const first = firstLanding();
    if (properties.length === 1) {
      openProperty(properties[0]!.id);
      void navigate({ to: "/hotel", replace: true });
      return;
    }
    if (first && lastView() === "hotel") {
      void navigate({ to: "/hotel", replace: true });
      return;
    }
    rememberView("portfolio");
    // Runs again when the organization changes to one with a single hotel.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [properties.length === 1]);
  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <TopBar />
      <main className="flex-1">
        <PortfolioPage />
      </main>
      <Disclaimer />
      <SourcesSheet />
    </div>
  );
}
