import { createFileRoute } from "@tanstack/react-router";
import { Disclaimer } from "@/components/Disclaimer";
import { SourcesSheet } from "@/components/SourcesSheet";
import { TopBar } from "@/components/TopBar";
import { PortfolioPage } from "@/portfolio/PortfolioPage";

export const Route = createFileRoute("/portfolio")({
  head: () => ({
    meta: [
      { title: "Energy Twin — Hotel portfolio" },
      { name: "description", content: "A synthetic Chicago hotel chain on a map: compare energy use, find savings potential and split one investment budget across hotels." },
      { property: "og:title", content: "Energy Twin — Hotel portfolio" },
      { property: "og:description", content: "Compare a hotel chain's estimated energy use and split one investment budget across its hotels." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Portfolio,
});

function Portfolio() {
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
