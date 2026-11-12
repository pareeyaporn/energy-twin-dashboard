import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, Sparkles, X } from "lucide-react";
import { useTwin } from "@/store/useTwin";
import { Button } from "@/components/ui/button";
import { TOUR_STEPS } from "./steps";
import { openWorkspaceTab, waitFor } from "./dom";
import { placeCard, unionBox } from "./layout";
import type { Box } from "./layout";
import { useTour } from "./useTour";

/** How long a step waits for its page, tab or highlighted part before it is skipped (shorter in tests). */
export const TOUR_TIMING = { waitMs: 2500, navMs: 3000 };

const workspaceTabsReady = () => Array.from(document.querySelectorAll('aside[aria-label="Workspace"] [role="tab"]'));
const same = (a: Box | null, b: Box | null) =>
  a === b || (!!a && !!b && Math.abs(a.top - b.top) < 0.5 && Math.abs(a.left - b.left) < 0.5 && Math.abs(a.width - b.width) < 0.5 && Math.abs(a.height - b.height) < 0.5);

/**
 * The guided tour: dims the screen, spotlights the part of the app a step explains, and shows a small card beside it. It opens the page and
 * workspace tab a step needs, skips a step whose part is missing, blocks clicks on the app while it runs (so nothing changes), and puts
 * the user back where they started when it ends.
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
  const [viewport, setViewport] = useState(() => (typeof window === "undefined" ? { w: 1280, h: 800 } : { w: window.innerWidth, h: window.innerHeight }));
  const [cardSize, setCardSize] = useState({ width: 360, height: 220 });
  // Animate only the move from one step to the next; afterwards the spotlight follows scrolling exactly.
  const [gliding, setGliding] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const primaryRef = useRef<HTMLButtonElement>(null);

  // Prepare the step: open its page and tab, wait for its target, scroll it into view (or skip the step if it is missing).
  useEffect(() => {
    if (!active || !step) return;
    const signal = { cancelled: false };
    setTargets(null);
    setBox(null);
    if (pathname !== step.route) {
      void navigate({ to: step.route });
      // If the page does not open, move on rather than wait forever.
      const t = setTimeout(() => skipStep(), TOUR_TIMING.navMs);
      return () => {
        signal.cancelled = true;
        clearTimeout(t);
      };
    }
    void (async () => {
      if (step.tab) {
        await waitFor(workspaceTabsReady, TOUR_TIMING.waitMs, signal);
        if (signal.cancelled) return;
        openWorkspaceTab(step.tab);
      }
      if (!step.target) {
        setTargets([]);
        return;
      }
      const els = await waitFor(step.target, TOUR_TIMING.waitMs, signal);
      if (signal.cancelled) return;
      if (!els.length) {
        skipStep();
        return;
      }
      const first = els[0]!;
      const tall = first.getBoundingClientRect().height > window.innerHeight * 0.6;
      first.scrollIntoView({ block: tall ? "start" : "center", inline: "nearest", behavior: reduce ? "auto" : "smooth" });
      setTargets(els);
    })();
    return () => {
      signal.cancelled = true;
    };
  }, [active, index, pathname, step, navigate, reduce, skipStep]);

  // Follow the target while it scrolls or the window resizes (one read per frame, a state update only when it moves).
  useEffect(() => {
    if (!active || !targets) return;
    let frame = 0;
    const tick = () => {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      setViewport((v) => (v.w === vw && v.h === vh ? v : { w: vw, h: vh }));
      const next = targets.length ? unionBox(targets.map((t) => t.getBoundingClientRect()), vw, vh) : null;
      setBox((b) => (same(b, next) ? b : next));
      frame = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(frame);
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

  // When the tour ends, put the user back on the page and tab they started from.
  useEffect(() => {
    if (!restore || active) return;
    if (pathname !== restore.path) {
      void navigate({ to: restore.path as "/" });
      return;
    }
    const signal = { cancelled: false };
    void (async () => {
      if (restore.tab) {
        await waitFor(workspaceTabsReady, 2500, signal);
        if (!signal.cancelled) openWorkspaceTab(restore.tab);
      }
      if (!signal.cancelled) clearRestore();
    })();
    return () => {
      signal.cancelled = true;
    };
  }, [restore, active, pathname, navigate, clearRestore]);

  if (!active || !step || typeof document === "undefined") return null;
  const ready = targets !== null && (settled || !step.target);
  const placed = placeCard(step.target ? box : null, cardSize, viewport.w, viewport.h);
  const spot = placed.spot;
  const first = index === 0;
  const last = index === total - 1;
  const motion = reduce || !gliding ? "opacity 200ms ease" : "top 300ms ease, left 300ms ease, width 300ms ease, height 300ms ease, opacity 200ms ease";

  return createPortal(
    <div className="fixed inset-0 z-[1000] overflow-hidden" data-testid="tour" data-step={step.id}>
      {/* Catches every click so the app cannot be changed while the tour runs. */}
      <div className="absolute inset-0" aria-hidden onClick={(e) => e.stopPropagation()} />
      {spot ? (
        <div
          aria-hidden
          className="pointer-events-none absolute rounded-xl"
          style={{
            top: spot.top,
            left: spot.left,
            width: spot.width,
            height: spot.height,
            transition: motion,
            boxShadow: "0 0 0 200vmax rgb(2 6 23 / 0.72), 0 0 0 2px var(--primary), 0 0 28px 6px color-mix(in oklab, var(--primary) 35%, transparent)",
          }}
          data-testid="tour-spotlight"
        />
      ) : (
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-[rgb(2_6_23/0.72)]" style={{ transition: reduce ? "none" : "opacity 200ms ease" }} />
      )}
      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-title"
        aria-describedby="tour-body"
        className="absolute w-[min(360px,calc(100vw-24px))] rounded-2xl border border-primary/30 bg-popover/95 p-4 text-sm text-popover-foreground shadow-2xl backdrop-blur"
        style={{ top: placed.card.top, left: placed.card.left, opacity: ready ? 1 : 0, transition: motion }}
        data-testid="tour-card"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            {(first || last) && <Sparkles className="size-4 shrink-0 text-primary" aria-hidden />}
            <h2 id="tour-title" className="text-base font-semibold leading-tight">{step.title}</h2>
          </div>
          {!last && (
            <button type="button" onClick={() => end("skipped")} className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground" aria-label="Skip tour">
              <X className="size-4" />
            </button>
          )}
        </div>
        <p id="tour-body" className="mt-2 leading-relaxed text-muted-foreground">{step.body}</p>
        <div className="mt-4 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="flex gap-1" aria-hidden>
              {TOUR_STEPS.map((s, i) => (
                <span key={s.id} className={`h-1.5 rounded-full ${i === index ? "w-4 bg-primary" : "w-1.5 bg-muted-foreground/40"}`} style={{ transition: reduce ? "none" : "width 200ms ease" }} />
              ))}
            </div>
            <span className="text-[11px] text-muted-foreground" aria-live="polite" data-testid="tour-progress">{index + 1} of {total}</span>
          </div>
          <div className="flex items-center gap-1.5">
            {!first && !last && <Button size="sm" variant="ghost" onClick={back} aria-label="Back"><ArrowLeft /> Back</Button>}
            {first && <Button size="sm" variant="ghost" onClick={() => end("skipped")}>Skip tour</Button>}
            {last ? (
              <Button ref={primaryRef} size="sm" onClick={() => end("completed")} data-testid="tour-finish">Start exploring <ArrowRight /></Button>
            ) : (
              <Button ref={primaryRef} size="sm" onClick={next} data-testid="tour-next">{first ? "Show me" : "Next"} <ArrowRight /></Button>
            )}
          </div>
        </div>
        {last && <button type="button" onClick={back} className="mt-2 text-[11px] text-muted-foreground hover:text-foreground">Back</button>}
      </div>
    </div>,
    document.body,
  );
}
