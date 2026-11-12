import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { Overview } from "@/components/Overview";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/overview")({
  head: () => ({ meta: [
    { title: "Energy Twin — Hotel energy overview" },
    { name: "description", content: "Review estimated hotel energy use, annual costs, emissions, category and zone breakdowns, and top investment opportunities." },
    { property: "og:title", content: "Energy Twin — Hotel energy overview" },
    { property: "og:description", content: "Review estimated hotel energy use, annual costs, emissions, category and zone breakdowns, and top investment opportunities." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: OverviewPage,
});

function OverviewPage() {
  return <main className="min-h-screen bg-background"><header className="flex h-16 items-center justify-between gap-3 border-b border-border px-4 md:px-8"><Link to="/" className="font-semibold">Energy Twin</Link><Button asChild variant="ghost" size="sm"><Link to="/"><ArrowLeft />Dashboard</Link></Button></header><Overview /></main>;
}