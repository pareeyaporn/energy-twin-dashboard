import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { ScenarioSimulator } from "@/components/ScenarioSimulator";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/scenario")({
  head: () => ({
    meta: [
      { title: "Energy Twin — Scenario simulator" },
      { name: "description", content: "Compare estimated hotel energy, cost, and carbon before and after operating changes and stress tests." },
      { property: "og:title", content: "Energy Twin — Scenario simulator" },
      { property: "og:description", content: "Compare estimated hotel energy, cost, and carbon before and after operating changes and stress tests." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ScenarioPage,
});

function ScenarioPage() {
  return (
    <main className="min-h-screen bg-background">
      <header className="flex h-16 items-center justify-between gap-3 border-b border-border px-4 md:px-8">
        <Link to="/" className="font-semibold">Energy Twin</Link>
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm"><Link to="/optimizer">Budget optimizer</Link></Button>
          <Button asChild variant="ghost" size="sm"><Link to="/"><ArrowLeft />Dashboard</Link></Button>
        </div>
      </header>
      <ScenarioSimulator />
    </main>
  );
}
