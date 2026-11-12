import { Disclaimer } from "@/components/Disclaimer";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { BudgetOptimizer } from "@/components/BudgetOptimizer";
import { SourcesSheet } from "@/components/SourcesSheet";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/optimizer")({
  head: () => ({ meta: [
    { title: "Energy Twin — Budget optimizer" },
    { name: "description", content: "Compare estimated hotel energy investments within your budget, including savings ranges, payback, carbon impact, and comfort." },
    { property: "og:title", content: "Energy Twin — Budget optimizer" },
    { property: "og:description", content: "Compare estimated hotel energy investments within your budget, including savings ranges, payback, carbon impact, and comfort." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: OptimizerPage,
});

function OptimizerPage() {
  return <main className="min-h-screen bg-background"><header className="flex h-16 items-center justify-between gap-3 border-b border-border px-4 md:px-8"><Link to="/" className="font-semibold">Energy Twin</Link><Button asChild variant="ghost" size="sm"><Link to="/"><ArrowLeft />Dashboard</Link></Button></header><BudgetOptimizer /><Disclaimer /><SourcesSheet /></main>;
}