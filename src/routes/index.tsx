import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TopBar } from "@/components/TopBar";
import { HomePanel } from "@/components/HomePanel";
import { Stage } from "@/components/Stage";
import { OptimizePanel } from "@/components/OptimizePanel";
import { PlanDrawer } from "@/components/PlanDrawer";
import { SourcesSheet } from "@/components/SourcesSheet";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Energy Twin — See the savings before you spend" },
      { name: "description", content: "See where your house wastes energy and which upgrades to buy within your budget." },
      { property: "og:title", content: "Energy Twin — See the savings before you spend" },
      { property: "og:description", content: "See where your house wastes energy and which upgrades to buy within your budget." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const ease = { duration: 0.3, ease: [0.22, 1, 0.36, 1] as const };

function CollapseBtn({ side, open, onClick, label }: { side: "left" | "right"; open: boolean; onClick: () => void; label: string }) {
  const pointLeft = side === "left" ? open : !open;
  return (
    <button type="button" onClick={onClick} aria-label={`${open ? "Collapse" : "Expand"} ${label}`}
      className={`glass absolute top-1/2 z-30 grid h-8 w-5 -translate-y-1/2 place-items-center rounded-md text-muted-foreground hover:text-foreground ${side === "left" ? "-right-3" : "-left-3"}`}>
      {pointLeft ? <ChevronLeft className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
    </button>
  );
}

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

function Index() {
  const desktop = useIsDesktop();
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);
  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      <TopBar />
      {desktop ? (
      <div className="flex min-h-0 flex-1 gap-3 p-3">
        <motion.aside animate={{ width: leftOpen ? 340 : 0 }} transition={ease} className="relative shrink-0">
          <div className="panel h-full overflow-hidden" style={{ opacity: leftOpen ? 1 : 0, transition: "opacity 300ms" }}>
            <div className="h-full w-[340px]"><HomePanel /></div>
          </div>
          <CollapseBtn side="left" open={leftOpen} onClick={() => setLeftOpen(!leftOpen)} label="Your Home panel" />
        </motion.aside>
        <main className="relative min-w-0 flex-1 overflow-hidden rounded-2xl">
          <Stage />
          <PlanDrawer />
        </main>
        <motion.aside animate={{ width: rightOpen ? 380 : 0 }} transition={ease} className="relative shrink-0">
          <div className="panel h-full overflow-hidden" style={{ opacity: rightOpen ? 1 : 0, transition: "opacity 300ms" }}>
            <div className="ml-auto h-full w-[380px]"><OptimizePanel /></div>
          </div>
          <CollapseBtn side="right" open={rightOpen} onClick={() => setRightOpen(!rightOpen)} label="Optimize panel" />
        </motion.aside>
      </div>
      ) : (
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3">
        <div className="relative h-[60vh] shrink-0 overflow-hidden rounded-2xl"><Stage /><PlanDrawer /></div>
        <Tabs defaultValue="home">
          <TabsList className="glass grid w-full grid-cols-2"><TabsTrigger value="home">Your Home</TabsTrigger><TabsTrigger value="optimize">Optimize</TabsTrigger></TabsList>
          <TabsContent value="home" className="panel"><HomePanel /></TabsContent>
          <TabsContent value="optimize" className="panel"><OptimizePanel /></TabsContent>
        </Tabs>
      </div>
      )}
      <SourcesSheet />
    </div>
  );
}
