import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Scale, Sparkles, Wand2, Wrench } from "lucide-react";
import { useTwin } from "@/store/useTwin";
import { selectPlanExplanation } from "@/store/hotelDerived";
import { Button } from "@/components/ui/button";
import { PlanBuilder } from "./PlanBuilder";
import { PlanCompare } from "./PlanCompare";

export type InvestMode = "ai" | "build" | "compare";

const ModeContext = createContext<{ mode: InvestMode; setMode: (m: InvestMode) => void } | null>(null);

const MODES: { id: InvestMode; label: string; icon: typeof Sparkles }[] = [
  { id: "ai", label: "AI recommended", icon: Sparkles },
  { id: "build", label: "Build your own", icon: Wrench },
  { id: "compare", label: "Compare", icon: Scale },
];

/**
 * The Invest step in three connected modes: the AI-recommended packages (the existing optimizer, passed in as `ai`), a plan you build
 * from the catalog, and the two side by side. Plans are kept in this browser (local storage).
 */
export function InvestModes({ ai, compact = false }: { ai: ReactNode; compact?: boolean }) {
  const [mode, setMode] = useState<InvestMode>("ai");
  const hydrate = useTwin((s) => s.hydrateCustomPlans);
  const customize = useTwin((s) => s.customizeFromPackage);
  useEffect(() => hydrate(), [hydrate]);
  return (
    <ModeContext.Provider value={{ mode, setMode }}>
      <div className={compact ? "space-y-4" : "mx-auto max-w-7xl space-y-4"}>
        <div role="tablist" aria-label="Investment mode" className={`flex overflow-hidden rounded-lg border border-glass-border text-sm ${compact ? "mx-5 mt-5" : "mx-4 mt-4 md:mx-8"}`}>
          {MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              role="tab"
              aria-selected={mode === m.id}
              aria-controls={`invest-${m.id}`}
              id={`invest-tab-${m.id}`}
              onClick={() => setMode(m.id)}
              className={`flex flex-1 items-center justify-center gap-1.5 px-2 py-2 transition-colors ${mode === m.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent"}`}
            >
              <m.icon className="h-3.5 w-3.5" aria-hidden />
              <span>{m.label}</span>
            </button>
          ))}
        </div>
        <div id={`invest-${mode}`} role="tabpanel" aria-labelledby={`invest-tab-${mode}`}>
          {mode === "ai" && ai}
          {mode === "build" && <div className={compact ? "px-5 pb-5" : "px-4 pb-8 md:px-8"}><PlanBuilder compact={compact} /></div>}
          {mode === "compare" && (
            <div className={compact ? "px-5 pb-5" : "px-4 pb-8 md:px-8"}>
              <PlanCompare
                onCustomize={(id) => {
                  if (customize(id)) setMode("build");
                }}
              />
            </div>
          )}
        </div>
      </div>
    </ModeContext.Provider>
  );
}

/** "Customize AI plan": copies the package into a new custom plan and opens the builder. Place it on each recommended package. */
export function CustomizeButton({ packageId, label }: { packageId: string; label: string }) {
  const ctx = useContext(ModeContext);
  const customize = useTwin((s) => s.customizeFromPackage);
  if (!ctx) return null;
  return (
    <Button
      size="sm"
      variant="ghost"
      className="w-full text-xs text-primary hover:bg-primary/10"
      aria-label={`Customize ${label}`}
      onClick={(e) => {
        e.stopPropagation();
        if (customize(packageId)) ctx.setMode("build");
      }}
    >
      <Wand2 className="h-3.5 w-3.5" /> Customize AI plan
    </Button>
  );
}

/** Why the optimizer chose the highlighted package, from the numbers (deterministic; the advisor can explain further). */
export function WhyThisPlan() {
  const lines = useTwin((s) => selectPlanExplanation(s));
  const [open, setOpen] = useState(false);
  if (!lines.length) return null;
  const shown = open ? lines : lines.slice(0, 3);
  return (
    <section aria-label="Why this plan" className="space-y-1.5 rounded-lg border border-primary/25 bg-primary/5 p-3 text-xs" data-testid="why-this-plan">
      <h3 className="flex items-center gap-1.5 font-semibold text-primary"><Sparkles className="h-3.5 w-3.5" aria-hidden /> Why this plan</h3>
      <ul className="list-disc space-y-1 pl-4 text-muted-foreground">
        {shown.map((l, i) => <li key={i}>{l}</li>)}
      </ul>
      {lines.length > 3 && (
        <button type="button" className="text-primary hover:underline" onClick={() => setOpen(!open)}>
          {open ? "Show less" : `Show ${lines.length - 3} more`}
        </button>
      )}
    </section>
  );
}
