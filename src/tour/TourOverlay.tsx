import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, Sparkles, X } from "lucide-react";
import { useTwin } from "@/store/useTwin";
import { Button } from "@/components/ui/button";
import { TOUR_STEPS, bodyOf } from "./steps";
import { openWorkspaceTab, waitFor } from "./dom";
import { finishSummary, formatInsight, insightFor, projectionSeries, topPriorityId } from "./insights";
import type { Insight, ProjectionSeries } from "./insights";
import { ProjectionPreview } from "./ProjectionPreview";
import { placeCard, unionBox } from "./layout";
import type { Box } from "./layout";
import { applyView, currentView, useTour } from "./useTour";

/** How long a step waits for its page, tab or highlighted part before it is skipped (shorter in tests). */
export const TOUR_TIMING = { waitMs: 2500, navMs: 3000 };

const workspaceTabsReady = () => Array.from(document.querySelectorAll('aside[aria-label="Workspace"] [role="tab"]'));
const same = (a: Box | null, b: Box | null) =>
  a === b || (!!a && !!b && Math.abs(a.top - b.top) < 0.5 && Math.abs(a.left - b.left) < 0.5 && Math.abs(a.width - b.width) < 0.5 && Math.abs(a.height - b.height) < 0.5);

/** Counts a figure up from zero when it first shows (instant with reduce effects). The figure itself comes from the engine. */
function CountUp({ value, format, reduce, ms = 900 }: { value: number; format: Insight["format"]; reduce: boolean; ms?: number }) {
  const [shown, setShown] = useState(reduce ? value : 0);
  useEffect(() => {
    if (reduce) {
      setShown(value);
      return;
    }
    let raf = 0;
    const t0 = performance.now();
    const tick = (now: number) => {
      const k = Math.min(1, (now - t0) / ms);
      setShown(value * (1 - (1 - k) ** 3));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, reduce, ms]);
  return <span aria-hidden>{formatInsight(shown, format)}</span>;
}

function InsightBlock({ insight, reduce, hero }: { insight: Insight; reduce: boolean; hero: boolean }) {
  return (
    <div className="mt-3 rounded-xl border border-primary/25 bg-primary/10 px-3 py-2" data-testid="tour-insight">
      <div className="flex items-baseline justify-between gap-2">
        <div className={`num font-semibold tabular-nums text-primary ${hero ? "text-3xl" : "text-xl"}`}>
          <CountUp value={insight.value} format={insight.format} reduce={reduce} />
          <span className="sr-only">{formatInsight(insight.value, insight.format)}</span>
        </div>
        <span className="shrink-0 rounded-full border border-primary/30 px-1.5 text-[10px] text-primary">Estimate</span>
      </div>
      <div className="text-xs text-foreground/90">{insight.label}</div>
      {insight.note && <div className="mt-0.5 text-[11px] text-muted-foreground">{insight.note}</div>}
    </div>
  );
}

/**
 * The guided tour: dims the screen, spotlights the part of the app a step explains, and shows a card beside it with a live figure for the
 * open hotel. It opens the page and workspace tab a step needs, may play a view (time-lapse, energy flow) that it restores afterwards,
 * skips a step whose part is missing, blocks clicks on the app while it runs (so nothing changes), and returns the user where they started.
 */
export function TourOverlay() {
  const active = useTour((s) => s.active);
  const index = useTour((s) => s.index);
  const restore = useTour((s) => s.restore);
  const { next, back, skipStep, end, clearRestore } = useTour.getState();
  const reduce = useTwin((s) => s.reduceEffects);
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const step = TOUR_STEPS[index];
  const total = TOUR_STEPS.length;
  const [targets, setTargets] = useState<Element[] | null>(null);
  const [box, setBox] = useState<Box | null>(null);
  const [insight, setInsight] = useState<Insight | null>(null);
  const [summary, setSummary] = useState<ReturnType<typeof finishSummary>>([]);
  const [projection, setProjection] = useState<ProjectionSeries[]>([]);
  const [viewport, setViewport] = useState(() => (typeof window === "undefined" ? { w: 1280, h: 800 } : { w: window.innerWidth, h: window.innerHeight }));
  const [cardSize, setCardSize] = useState({ width: 360, height: 220 });
  // Animate only the move from one step to the next; afterwards the spotlight follows scrolling exactly.
  const [gliding, setGliding] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const primaryRef = useRef<HTMLButtonElement>(null);

  // Prepare the step: open its page and tab, show its view, wait for its target, scroll it into view (or skip it if it is missing).
  useEffect(() => {
    if (!active || !step) return;
    const signal = { cancelled: false };
    setTargets(null);
    setBox(null);
    setInsight(null);
    setProjection([]);
    // The hotel steps follow the portfolio's top-priority hotel (the one step 4 names); the user's own state comes back at the end.
    if (step.focus) {
      const top = topPriorityId(useTwin.getState());
      if (top) useTour.getState().focusHotel(top);
    }
    if (pathname !== step.route) {
      void navigate({ to: step.route });
      // If the page does not open, move on rather than wait forever.
      const t = setTimeout(() => skipStep(), TOUR_TIMING.navMs);
      return () => {
        signal.cancelled = true;
        clearTimeout(t);
      };
    }
    const origin = useTour.getState().origin;
    // Each step shows the user's own view plus its own settings. The twin layer stays as the last step left it (switching back to the 3D
    // view mid-tour would rebuild the 3D scene); the user's layer comes back when the tour ends.
    if (origin) applyView({ ...origin.view, twinLayer: currentView().twinLayer, ...(step.route === "/hotel" ? step.view : {}) });
    void (async () => {
      if (step.tab) {
        await waitFor(workspaceTabsReady, TOUR_TIMING.waitMs, signal);
        if (signal.cancelled) return;
        openWorkspaceTab(step.tab);
      }
      let els: Element[] = [];
      if (step.target) {
        els = await waitFor(step.target, TOUR_TIMING.waitMs, signal);
        if (signal.cancelled) return;
        if (!els.length) {
          skipStep();
          return;
        }
        const first = els[0]!;
        const tall = first.getBoundingClientRect().height > window.innerHeight * 0.6;
        first.scrollIntoView({ block: tall ? "start" : "center", inline: "nearest", behavior: reduce ? "auto" : "smooth" });
      }
      setTargets(els);
      // The live figure: computed by the engine for the open hotel (read-only), off the click path.
      setTimeout(() => {
        if (signal.cancelled) return;
        try {
          const s = useTwin.getState();
          if (step.insight) setInsight(insightFor(step.id, s));
          if (step.id === "finish") setSummary(finishSummary(s));
          if (step.id === "projections") setProjection(projectionSeries(s));
        } catch {
          setInsight(null);
          setProjection([]);
        }
      }, 30);
    })();
    return () => {
      signal.cancelled = true;
    };
  }, [active, index, pathname, step, navigate, reduce, skipStep]);

  // Follow the target: re-measure on scroll and resize (once per frame at most) and every 150 ms for layout shifts. Measuring every frame
  // would force layout while animations run underneath (the energy flow, the 3D view) and slow them down.
  useEffect(() => {
    if (!active || !targets) return;
    let frame = 0;
    const measure = () => {
      frame = 0;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      setViewport((v) => (v.w === vw && v.h === vh ? v : { w: vw, h: vh }));
      const nextBox = targets.length ? unionBox(targets.map((t) => t.getBoundingClientRect()), vw, vh) : null;
      setBox((b) => (same(b, nextBox) ? b : nextBox));
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };
    measure();
    const timer = setInterval(schedule, 150);
    window.addEventListener("scroll", schedule, { capture: true, passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      clearInterval(timer);
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule, { capture: true });
      window.removeEventListener("resize", schedule);
    };
  }, [active, targets]);

  useEffect(() => {
    if (!targets) return;
    setGliding(true);
    const t = setTimeout(() => setGliding(false), 350);
    return () => clearTimeout(t);
  }, [targets]);

  // Show the card only once the highlighted area has stopped moving (a page that is still loading can shift it).
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    setSettled(false);
    const t = setTimeout(() => setSettled(true), 200);
    return () => clearTimeout(t);
  }, [box]);

  useLayoutEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    const width = el.offsetWidth;
    const height = el.offsetHeight;
    setCardSize((s) => (s.width === width && s.height === height ? s : { width, height }));
  });

  // Keyboard: Escape skips the tour, arrows move between steps.
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        end("skipped");
      } else if (e.key === "ArrowRight") next();
      else if (e.key === "ArrowLeft") back();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, end, next, back]);

  useEffect(() => {
    if (active && targets) primaryRef.current?.focus({ preventScroll: true });
  }, [active, targets, index]);

  // When the tour ends, put the user back on the page and tab they started from (or open Invest and run the optimizer, if asked).
  useEffect(() => {
    if (!restore || active) return;
    if (pathname !== restore.path) {
      void navigate({ to: restore.path as "/" });
      return;
    }
    const signal = { cancelled: false };
    void (async () => {
      if (restore.tab) {
        await waitFor(workspaceTabsReady, TOUR_TIMING.waitMs, signal);
        if (!signal.cancelled) openWorkspaceTab(restore.tab);
      }
      if (signal.cancelled) return;
      clearRestore();
      if (restore.then === "optimize") void useTwin.getState().runHotelOptimizer();
    })();
    return () => {
      signal.cancelled = true;
    };
  }, [restore, active, pathname, navigate, clearRestore]);

  if (!active || !step || typeof document === "undefined") return null;
  const hero = !!step.hero;
  const ready = targets !== null && (settled || !step.target);
  const placed = placeCard(step.target ? box : null, cardSize, viewport.w, viewport.h);
  const spot = placed.spot;
  const first = index === 0;
  const last = index === total - 1;
  const motion = reduce || !gliding ? "opacity 250ms ease" : "top 300ms ease, left 300ms ease, width 300ms ease, height 300ms ease, opacity 250ms ease";
  const body = bodyOf(step, useTwin.getState());

  return createPortal(
    <div className="fixed inset-0 z-[1000] overflow-hidden" data-testid="tour" data-step={step.id}>
      {/* Catches every click so the app cannot be changed while the tour runs. */}
      <div className="absolute inset-0" aria-hidden onClick={(e) => e.stopPropagation()} />
      {spot ? (
        <>
          {/* Four dimming panels around the highlighted area (cheap to draw, so animations underneath stay smooth). */}
          {[
            { top: 0, left: 0, width: "100%", height: spot.top },
            { top: spot.top + spot.height, left: 0, width: "100%", bottom: 0 },
            { top: spot.top, left: 0, width: spot.left, height: spot.height },
            { top: spot.top, left: spot.left + spot.width, right: 0, height: spot.height },
          ].map((r, i) => (
            <div key={i} aria-hidden className="pointer-events-none absolute bg-[rgb(2_6_23/0.72)]" style={{ ...r, transition: motion }} />
          ))}
          <div
            aria-hidden
            className={`pointer-events-none absolute rounded-lg border-2 border-primary ${reduce ? "" : "shadow-[0_0_24px_4px_color-mix(in_oklab,var(--primary)_35%,transparent)]"}`}
            style={{ top: spot.top, left: spot.left, width: spot.width, height: spot.height, transition: motion }}
            data-testid="tour-spotlight"
          />
          {!reduce && (
            <div
              aria-hidden
              className="pointer-events-none absolute animate-pulse rounded-xl border border-primary/50"
              style={{ top: spot.top - 5, left: spot.left - 5, width: spot.width + 10, height: spot.height + 10, transition: motion }}
            />
          )}
        </>
      ) : (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background: hero
              ? "radial-gradient(ellipse at 50% 40%, color-mix(in oklab, var(--primary) 18%, rgb(2 6 23 / 0.8)) 0%, rgb(2 6 23 / 0.86) 60%)"
              : "rgb(2 6 23 / 0.72)",
          }}
        />
      )}
      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-title"
        aria-describedby="tour-body"
        className={`absolute rounded-2xl border bg-popover text-sm text-popover-foreground ${
          hero
            ? "w-[min(540px,calc(100vw-24px))] border-primary/50 p-6 shadow-[0_0_80px_-12px_var(--primary)]"
            : "w-[min(380px,calc(100vw-24px))] border-primary/30 p-4 shadow-2xl"
        }`}
        style={{ top: placed.card.top, left: placed.card.left, opacity: ready ? 1 : 0, transition: motion }}
        data-testid="tour-card"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            {hero && <Sparkles className="size-5 shrink-0 text-primary" aria-hidden />}
            <h2 id="tour-title" className={`font-semibold leading-tight ${hero ? "text-xl" : "text-base"}`}>{step.title}</h2>
          </div>
          {!last && (
            <button type="button" onClick={() => end("skipped")} className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground" aria-label="Skip tour">
              <X className="size-4" />
            </button>
          )}
        </div>
        <p id="tour-body" className="mt-2 leading-relaxed text-muted-foreground">{body}</p>
        {insight && <InsightBlock key={step.id} insight={insight} reduce={reduce} hero={hero} />}
        {projection.length > 0 && <ProjectionPreview key={`chart-${step.id}`} series={projection} reduce={reduce} />}
        {last && summary.length > 0 && (
          <dl className="mt-4 grid grid-cols-3 gap-2" data-testid="tour-summary">
            {summary.map((x) => (
              <div key={x.label} className="rounded-xl border border-primary/25 bg-primary/10 p-2 text-center">
                <dt className="text-[10px] text-muted-foreground">{x.label}</dt>
                <dd className="num text-base font-semibold text-primary">
                  <CountUp value={x.value} format={x.format} reduce={reduce} ms={1100} />
                  <span className="sr-only">{formatInsight(x.value, x.format)}</span>
                </dd>
              </div>
            ))}
            <p className="col-span-3 text-center text-[10px] text-muted-foreground">Estimates for {useTwin.getState().hotel.profile.name}, on today's baseline.</p>
          </dl>
        )}
        <div className="mt-4 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="flex gap-1" aria-hidden>
              {TOUR_STEPS.map((s, i) => (
                <span key={s.id} className={`h-1.5 rounded-full ${i === index ? "w-4 bg-primary" : i < index ? "w-1.5 bg-primary/50" : "w-1.5 bg-muted-foreground/40"}`} style={{ transition: reduce ? "none" : "width 200ms ease" }} />
              ))}
            </div>
            <span className="text-[11px] text-muted-foreground" aria-live="polite" data-testid="tour-progress">{index + 1} of {total}</span>
          </div>
          <div className="flex items-center gap-1.5">
            {!first && !last && <Button size="sm" variant="ghost" onClick={back} aria-label="Back"><ArrowLeft /> Back</Button>}
            {first && <Button size="sm" variant="ghost" onClick={() => end("skipped")}>Skip tour</Button>}
            {!last && <Button ref={primaryRef} size="sm" onClick={next} data-testid="tour-next">{first ? "Show me" : "Next"} <ArrowRight /></Button>}
          </div>
        </div>
        {last && (
          <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
            <button type="button" onClick={back} className="mr-auto text-[11px] text-muted-foreground hover:text-foreground">Back</button>
            <Button size="sm" variant="outline" onClick={() => end("completed")} data-testid="tour-finish">Start exploring</Button>
            <Button ref={primaryRef} size="sm" onClick={() => end("completed", "optimize")} data-testid="tour-optimize">
              <Sparkles /> Find my best investments
            </Button>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
