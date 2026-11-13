import { createFileRoute } from "@tanstack/react-router";
import { HotelDashboard } from "@/app/HotelDashboard";

export const Route = createFileRoute("/hotel")({
  head: () => ({
    meta: [
      { title: "Energy Twin — Hotel analysis" },
      { name: "description", content: "Explore your hotel profile, digital twin, and estimated energy upgrade packages within your budget." },
      { property: "og:title", content: "Energy Twin — Hotel analysis" },
      { property: "og:description", content: "Explore your hotel profile, digital twin, and estimated energy upgrade packages within your budget." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: HotelDashboard,
});
