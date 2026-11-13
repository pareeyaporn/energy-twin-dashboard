import { createFileRoute } from "@tanstack/react-router";
import { PortfolioHome } from "@/app/PortfolioHome";

// The homepage is the hotel portfolio (Claude Code, November 2026). The single-hotel dashboard that lived here moved unchanged to
// `src/app/HotelDashboard.tsx`, served at `/hotel`.
export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Energy Twin — Your hotel portfolio" },
      { name: "description", content: "Monitor energy performance, identify opportunities, and prioritize investments across your hotels." },
      { property: "og:title", content: "Energy Twin — Your hotel portfolio" },
      { property: "og:description", content: "Monitor energy performance, identify opportunities, and prioritize investments across your hotels." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PortfolioHome,
});
