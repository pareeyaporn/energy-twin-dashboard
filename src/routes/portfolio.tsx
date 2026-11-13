import { createFileRoute } from "@tanstack/react-router";
import { PortfolioHome } from "@/app/PortfolioHome";

export const Route = createFileRoute("/portfolio")({
  head: () => ({
    meta: [
      { title: "Energy Twin — Hotel portfolio" },
      { name: "description", content: "Your hotels on a map: compare energy use, find savings potential and split one investment budget across hotels." },
      { property: "og:title", content: "Energy Twin — Hotel portfolio" },
      { property: "og:description", content: "Compare a hotel chain's estimated energy use and split one investment budget across its hotels." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Portfolio,
});

// The same page as the homepage (`/`), kept so older links keep working.
function Portfolio() {
  return <PortfolioHome />;
}
