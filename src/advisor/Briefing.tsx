import { useEffect, useMemo, useState } from "react";
import { Sparkles, X } from "lucide-react";
import { advisor } from "@/engine/hotel";
import type { EnergyInsight } from "@/engine/hotel/insights";
import { useTwin } from "@/store/useTwin";
import type { TwinState } from "@/store/useTwin";
import { selectEnergyInsights, selectIsSynthetic } from "@/store/hotelDerived";
import { usd } from "@/twin/format";
import { useAdvisorUi } from "./uiStore";

/** What the briefing may talk about: the hotel's basics and the insight cards (their figures as numbers, so the check can match them). */
export function briefingContext(s: TwinState, insights: readonly EnergyInsight[]) {
  const a = s.baseline.annual;
  return {
    hotel: { name: s.hotel.profile.name, city: s.hotel.profile.city, rooms: s.hotel.profile.rooms, synthetic: selectIsSynthetic(s) },
    annual: { energyCost: Math.round(a.cost), electricityKWh: Math.round(a.elecKWh), gasTherms: Math.round(a.gasTherms), carbonTonnes: Math.round(a.carbonKg / 100) / 10 },
    findings: insights.slice(0, 4).map((i) => ({
      title: i.title,
      text: i.body,
      figures: advisor.extractNumbers(i.body).map((t) => t.value),
      value: i.metric.value,
      nextStep: i.action.label,
    })),
  };
}

/** The template briefing: three sentences from the same figures (used when the AI is off, slow, or its text fails the check). */
export function briefingTemplate(ctx: ReturnType<typeof briefingContext>): string {
  const first = ctx.findings[0];
  const lead = `${ctx.hotel.name} spends an estimated ${usd(ctx.annual.energyCost)} a year on energy${ctx.hotel.synthetic ? " (synthetic demo data)" : ""}.`;
  const issue = first ? `${first.title}: ${first.text.split(/(?<=\.)\s/)[0]}` : "No finding stands out in the model's results.";
  const next = first ? `Next step: ${first.nextStep.replace(/[.→\s]+$/, "")}.` : "Next step: test a what-if or find the best investments.";
  return [lead, issue.endsWith(".") ? issue : `${issue}.`, next].join(" ");
}

const idle = (fn: () => void): (() => void) => {
  const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number; cancelIdleCallback?: (id: number) => void };
  if (w.requestIdleCallback) {
    const id = w.requestIdleCallback(fn, { timeout: 3000 });
    return () => w.cancelIdleCallback?.(id);
  }
  const id = setTimeout(fn, 800);
  return () => clearTimeout(id);
};

/**
 * The AI briefing at the top of the Hotel tab (docs/23): three sentences on what the hotel spends, the biggest issue and the next step.
 * The template shows at once; the AI text replaces it only if every number in it is in the context. Hidden for the session on request.
 */
export function Briefing() {
  const insights = useTwin(selectEnergyInsights);
  const hotel = useTwin((s) => s.hotel);
  const baseline = useTwin((s) => s.baseline);
  const hidden = useAdvisorUi((s) => s.briefingHidden);
  const setHidden = useAdvisorUi((s) => s.setBriefingHidden);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const ctx = useMemo(() => briefingContext(useTwin.getState(), insights), [insights, hotel, baseline]);
  const template = useMemo(() => briefingTemplate(ctx), [ctx]);
  const [ai, setAi] = useState<{ for: typeof ctx; text: string } | null>(null);

  useEffect(() => {
    if (hidden) return;
    let live = true;
    const cancel = idle(() => {
      void advisor.askAdvisorText("briefing", ctx, template, advisor.getAdvisorConfig()).then((r) => {
        if (live && r.source === "ai") setAi({ for: ctx, text: r.text });
      });
    });
    return () => {
      live = false;
      cancel();
    };
  }, [ctx, template, hidden]);

  if (hidden) {
    return (
      <button type="button" className="text-[11px] text-muted-foreground underline-offset-2 hover:underline" onClick={() => setHidden(false)} data-testid="briefing-show">
        Show the AI briefing
      </button>
    );
  }
  const fromAi = ai?.for === ctx;
  return (
    <section aria-label="Briefing" className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm" data-testid="briefing" data-source={fromAi ? "ai" : "fallback"}>
      <div className="mb-1 flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-1.5 text-xs font-semibold">
          <Sparkles className="size-3.5 text-primary" aria-hidden /> Briefing
        </h3>
        <button type="button" onClick={() => setHidden(true)} className="rounded p-0.5 text-muted-foreground hover:bg-accent" aria-label="Hide the briefing for this session" data-testid="briefing-hide">
          <X className="size-3.5" />
        </button>
      </div>
      <p aria-live="polite">{fromAi ? ai.text : template}</p>
      <p className="mt-1 text-[10px] text-muted-foreground">{fromAi ? "AI summary of the model's results · estimates" : "Summary of the model's results · estimates"}</p>
    </section>
  );
}
