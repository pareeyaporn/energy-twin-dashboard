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
import { useTwin } from "@/store/useTwin";
import { rememberView } from "./landing";

// The single-hotel dashboard (workspace tabs, KPI strip, digital twin), moved here from `src/routes/index.tsx` when the portfolio
// became the homepage; served at `/hotel`. November 2026 (sidebar redesign, at the user's request): restyled step navigation (sticky,
// progress line); the Hotel step's "Simulate this hotel" opens the Scenario step through the same tab state.

const TABS = [
  { value: "hotel", label: "Hotel" },
  { value: "scenario", label: "Scenario" },
  { value: "invest", label: "Invest" },
  { value: "ask", label: "Ask" },
] as const;

/** One line under each step: what it is for (shown as the tab's title and to screen readers). */
const PURPOSE: Record<(typeof TABS)[number]["value"], string> = {
  hotel: "Understand the hotel and its opportunities",
  scenario: "Simulate conditions and risks",
  invest: "Optimize investments within a budget",
  ask: "Ask the AI advisor",
};

/**
 * The step navigation (1 Hotel → 2 Scenario → 3 Invest → 4 Ask) and the four steps. The bar stays at the top of the sidebar: outside the
 * scroll area on desktop, sticky on smaller screens (where the page scrolls). Exported for tests.
 */
export function WorkspaceTabs({ tab, setTab }: { tab: string; setTab: (v: string) => void }) {
  const scroll = "mt-0 lg:min-h-0 lg:flex-1 lg:overflow-y-auto data-[state=active]:animate-in data-[state=active]:fade-in-0 data-[state=active]:duration-200 motion-reduce:animate-none";
  const index = Math.max(0, TABS.findIndex((t) => t.value === tab));
  return (
    <Tabs value={tab} onValueChange={setTab} className="flex flex-col lg:h-full">
      <div className="sticky top-0 z-20 shrink-0 border-b border-border/70 bg-panel/95 backdrop-blur supports-[backdrop-filter]:bg-panel/80">
        <div className="overflow-x-auto">
          <TabsList aria-label="Hotel analysis steps" className="flex h-auto w-max min-w-full gap-1 rounded-none bg-transparent p-1.5 sm:grid sm:w-full sm:grid-cols-4">
            {TABS.map((t, i) => (
              <TabsTrigger
                key={t.value}
                value={t.value}
                title={PURPOSE[t.value]}
                className="group min-h-10 min-w-24 shrink-0 gap-1.5 rounded-lg px-2 text-[13px] text-muted-foreground transition-colors duration-200 hover:text-foreground data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-none motion-reduce:transition-none sm:min-w-0"
              >
                <span
                  className={`num grid size-5 shrink-0 place-items-center rounded-full border text-[10px] font-semibold transition-colors duration-200 motion-reduce:transition-none ${
                    i < index ? "border-primary/40 text-primary/80" : "border-border"
                  } group-data-[state=active]:border-primary group-data-[state=active]:bg-primary group-data-[state=active]:text-primary-foreground`}
                >
                  {i + 1}
                </span>
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
        <div className="h-0.5 w-full bg-border/40" aria-hidden>
          <div className="h-full bg-primary/70 transition-[width] duration-300 ease-out motion-reduce:transition-none" style={{ width: `${((index + 1) / TABS.length) * 100}%` }} />
        </div>
      </div>
      <TabsContent value="hotel" className={scroll}><HotelTab onSimulate={() => setTab("scenario")} /></TabsContent>
      <TabsContent value="scenario" className={scroll}><ScenarioSimulator variant="panel" /></TabsContent>
      <TabsContent value="invest" className={scroll}><BudgetOptimizer workspace /></TabsContent>
      <TabsContent value="ask" className="mt-0 h-[700px] lg:min-h-0 lg:h-auto lg:flex-1"><AdvisorPanel /></TabsContent>
    </Tabs>
  );
}

export function HotelDashboard() {
  const [tab, setTab] = useState("hotel");
  const reduceEffects = useTwin((s) => s.reduceEffects);
  useEffect(() => rememberView("hotel"), []);
  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-background">
      <TopBar />
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3 lg:flex-row lg:overflow-hidden">
          <aside className={`panel order-2 w-full shrink-0 overflow-clip lg:order-1 lg:w-[380px] lg:overflow-hidden ${reduceEffects ? "[&_*]:animate-none! [&_*]:transition-none!" : ""}`} aria-label="Workspace">
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
