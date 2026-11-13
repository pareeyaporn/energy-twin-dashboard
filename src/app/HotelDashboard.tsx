import { useEffect, useState } from "react";
import { Disclaimer } from "@/components/Disclaimer";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TopBar } from "@/components/TopBar";
import { Stage } from "@/components/Stage";
import { KpiStrip } from "@/components/KpiStrip";
import { HotelTab } from "@/components/HotelTab";
import { ScenarioSimulator } from "@/components/ScenarioSimulator";
import { BudgetOptimizer } from "@/components/BudgetOptimizer";
import { SourcesSheet } from "@/components/SourcesSheet";
import { AdvisorPanel } from "@/components/AdvisorPanel";
import { rememberView } from "./landing";

// The single-hotel dashboard (workspace tabs, KPI strip, digital twin), moved here unchanged from `src/routes/index.tsx` when the portfolio
// became the homepage; served at `/hotel`.

const TABS = [
  { value: "hotel", label: "Hotel" },
  { value: "scenario", label: "Scenario" },
  { value: "invest", label: "Invest" },
  { value: "ask", label: "Ask" },
] as const;

function WorkspaceTabs({ tab, setTab }: { tab: string; setTab: (v: string) => void }) {
  const scroll = "mt-0 lg:min-h-0 lg:flex-1 lg:overflow-y-auto";
  return (
    <Tabs value={tab} onValueChange={setTab} className="flex flex-col lg:h-full">
      <div className="shrink-0 overflow-x-auto">
        <TabsList className="flex w-max min-w-full rounded-none sm:grid sm:w-full sm:grid-cols-4">
          {TABS.map((t, i) => <TabsTrigger key={t.value} value={t.value} className="min-w-24 shrink-0 sm:min-w-0"><span className="num mr-1 opacity-60">{i + 1}</span>{t.label}</TabsTrigger>)}
        </TabsList>
      </div>
      <TabsContent value="hotel" className={scroll}><HotelTab /></TabsContent>
      <TabsContent value="scenario" className={scroll}><ScenarioSimulator variant="panel" /></TabsContent>
      <TabsContent value="invest" className={scroll}><BudgetOptimizer workspace /></TabsContent>
      <TabsContent value="ask" className="mt-0 h-[700px] lg:min-h-0 lg:h-auto lg:flex-1"><AdvisorPanel /></TabsContent>
    </Tabs>
  );
}

export function HotelDashboard() {
  const [tab, setTab] = useState("hotel");
  useEffect(() => rememberView("hotel"), []);
  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-background">
      <TopBar />
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3 lg:flex-row lg:overflow-hidden">
          <aside className="panel order-2 w-full shrink-0 overflow-hidden lg:order-1 lg:w-[380px]" aria-label="Workspace">
            <WorkspaceTabs tab={tab} setTab={setTab} />
          </aside>
          <main className="order-1 flex w-full min-w-0 shrink-0 flex-col gap-3 lg:order-2 lg:flex-1 lg:overflow-hidden">
            <KpiStrip />
            <div className="rounded-lg border border-border lg:min-h-0 lg:flex-1 lg:overflow-y-auto"><Stage /></div>
          </main>
        </div>
      <Disclaimer />
      <SourcesSheet />
    </div>
  );
}
