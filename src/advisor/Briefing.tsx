import { useEffect, useMemo, useState } from "react";
import { Sparkles, X } from "lucide-react";
import { ShowMore, reveal, sidebarCard } from "@/app/sidebar";
import { cn } from "@/lib/utils";
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

/** The template's three sentences: what the hotel spends, the biggest issue, the next step. */
function templateParts(ctx: ReturnType<typeof briefingContext>) {
  const first = ctx.findings[0];
  const lead = `${ctx.hotel.name} spends an estimated ${usd(ctx.annual.energyCost)} a year on energy${ctx.hotel.synthetic ? " (synthetic demo data)" : ""}.`;
  const issue = first ? `${first.title}: ${first.text.split(/(?<=\.)\s/)[0]}` : "No finding stands out in the model's results.";
  const next = first ? `Next step: ${first.nextStep.replace(/[.→\s]+$/, "")}.` : "Next step: test a what-if or find the best investments.";
  return { first, lead, issue: issue.endsWith(".") ? issue : `${issue}.`, next };
}

/** The template briefing: three sentences from the same figures (used when the AI is off, slow, or its text fails the check). */
export function briefingTemplate(ctx: ReturnType<typeof briefingContext>): string {
  const { lead, issue, next } = templateParts(ctx);
  return [lead, issue, next].join(" ");
}

/**
 * The concise template shown on load: the same lead and next step, with only the finding's title in between (its supporting sentence
 * is on the opportunity card below). Same figures, a subset of the template's text, so it passes the same number check.
 */
export function briefingConciseTemplate(ctx: ReturnType<typeof briefingContext>): string {
  const { first, lead, issue, next } = templateParts(ctx);
  return [lead, first ? `Top finding: ${first.title.replace(/[.\s]+$/, "")}.` : issue, next].join(" ");
}

/** The sentences of a briefing (split after . ! ? before a capital, a digit or $; "4.2" and "$7,826" stay whole). */
export function briefingSentences(text: string): string[] {
  return text.trim().split(/(?<=[.!?])\s+(?=[A-Z0-9$])/).filter(Boolean);
}

/**
 * The concise AI briefing shown on load: its first two sentences. A prefix of a text that passed the number check quotes only numbers
 * that text quoted, so it passes the same check; nothing new is generated.
 */
export function briefingSummary(text: string, sentences = 2): string {
  return briefingSentences(text).slice(0, sentences).join(" ");
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
 * Shown concise (its first two sentences); "View full briefing" opens the complete text with its label and method (not open on load).
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
  const [open, setOpen] = useState(false);

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
  const text = fromAi ? ai.text : template;
  const summary = fromAi ? briefingSummary(text) : briefingConciseTemplate(ctx);
  return (
    <section aria-label="Briefing" className={cn(sidebarCard, "border-primary/25 bg-primary/[0.04] text-sm")} data-testid="briefing" data-source={fromAi ? "ai" : "fallback"}>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-1.5 text-[13px] font-semibold">
          <Sparkles className="size-3.5 text-primary" aria-hidden /> Briefing
          <span className="text-[11px] font-normal text-muted-foreground">· {fromAi ? "AI summary" : "Summary"} · estimates{ctx.hotel.synthetic ? " · synthetic" : ""}</span>
        </h3>
        <button type="button" onClick={() => setHidden(true)} className="rounded p-1 text-muted-foreground hover:bg-accent" aria-label="Hide the briefing for this session" data-testid="briefing-hide">
          <X className="size-3.5" />
        </button>
      </div>
      {open ? (
        <div id="briefing-full" className={reveal}>
          <p aria-live="polite" className="text-[13px] leading-relaxed" data-testid="briefing-full">{text}</p>
          <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
            {fromAi ? "AI summary of the model's results" : "Summary of the model's results"} · estimates. Built from today's baseline simulation and the
            opportunity cards below; every number is checked against the model's results before it is shown.
            {ctx.hotel.synthetic ? " Synthetic demo data." : ""}
          </p>
        </div>
      ) : (
        <p aria-live="polite" className="text-[13px] leading-relaxed text-foreground/90" data-testid="briefing-summary">{summary}</p>
      )}
      <div className="mt-1 flex items-center justify-between gap-2">
        <ShowMore open={open} onClick={() => setOpen((o) => !o)} more="View full briefing" less="Show less" controls="briefing-full" testId="briefing-toggle" />
      </div>
    </section>
  );
}
