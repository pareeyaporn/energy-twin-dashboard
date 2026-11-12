import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TopBar } from "@/components/TopBar";
import { Stage } from "@/components/Stage";
import { KpiStrip } from "@/components/KpiStrip";
import { HotelTab } from "@/components/HotelTab";
import { ScenarioSimulator } from "@/components/ScenarioSimulator";
import { BudgetOptimizer } from "@/components/BudgetOptimizer";
import { SourcesSheet } from "@/components/SourcesSheet";
import { AdvisorPanel } from "@/components/AdvisorPanel";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Energy Twin — See the savings before you spend" },
      { name: "description", content: "Explore your hotel profile, digital twin, and estimated energy upgrade packages within your budget." },
      { property: "og:title", content: "Energy Twin — See the savings before you spend" },
      { property: "og:description", content: "Explore your hotel profile, digital twin, and estimated energy upgrade packages within your budget." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const TABS = [
  { value: "hotel", label: "Hotel" },
  { value: "scenario", label: "Scenario" },
  { value: "invest", label: "Invest" },
  { value: "ask", label: "Ask" },
] as const;

/** Render only one layout so each stage/popover exists once. */
function useIsDesktop() {
  const [desktop, setDesktop] = useState(true);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const on = () => setDesktop(mq.matches);
    on(); mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return desktop;
}

function WorkspaceTabs({ tab, setTab, desktop }: { tab: string; setTab: (v: string) => void; desktop: boolean }) {
  const scroll = desktop ? "min-h-0 flex-1 overflow-y-auto" : "";
  return (
    <Tabs value={tab} onValueChange={setTab} className={desktop ? "flex h-full flex-col" : ""}>
      <TabsList className={`grid w-full shrink-0 grid-cols-4 ${desktop ? "rounded-none" : "glass"}`}>
        {TABS.map((t, i) => <TabsTrigger key={t.value} value={t.value}><span className="num mr-1 opacity-60">{i + 1}</span>{t.label}</TabsTrigger>)}
      </TabsList>
      <TabsContent value="hotel" className={`mt-0 ${scroll} ${desktop ? "" : "panel"}`}><HotelTab /></TabsContent>
      <TabsContent value="scenario" className={`mt-0 ${scroll} ${desktop ? "" : "panel"}`}><ScenarioSimulator variant="panel" /></TabsContent>
      <TabsContent value="invest" className={`mt-0 ${scroll} ${desktop ? "" : "panel"}`}><BudgetOptimizer workspace /></TabsContent>
      <TabsContent value="ask" className={`mt-0 ${desktop ? "min-h-0 flex-1" : "panel h-[650px]"}`}><AdvisorPanel /></TabsContent>
    </Tabs>
  );
}

function Index() {
  const desktop = useIsDesktop();
  const [tab, setTab] = useState("hotel");
  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      <TopBar />
      {desktop ? (
        <div className="flex min-h-0 flex-1 gap-3 p-3">
          <aside className="panel w-[380px] shrink-0 overflow-hidden" aria-label="Workspace">
            <WorkspaceTabs tab={tab} setTab={setTab} desktop />
          </aside>
          <main className="flex min-w-0 flex-1 flex-col gap-3 overflow-hidden">
            <KpiStrip />
            <div className="min-h-0 flex-1 overflow-y-auto rounded-lg border border-border"><Stage /></div>
          </main>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3">
          <KpiStrip />
          <div className="min-w-0 shrink-0 rounded-lg border border-border"><Stage /></div>
          <WorkspaceTabs tab={tab} setTab={setTab} desktop={false} />
        </div>
      )}
      <SourcesSheet />
    </div>
  );
}
