import { useEffect } from "react";
import { useRouterState } from "@tanstack/react-router";
import { CircleHelp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { currentWorkspaceTab, waitFor } from "./dom";
import { TourOverlay } from "./TourOverlay";
import { readTourOutcome, useTour } from "./useTour";

// Tried once per page load: the tour starts by itself only on a first visit (nothing saved yet), once the main view has loaded.
let autoStartTried = false;
/** For tests. */
export const resetTourAutoStart = () => {
  autoStartTried = false;
};

const loaded = () =>
  Array.from(document.querySelectorAll('[data-testid="kpi-cost"], section[aria-label="City map"]')).filter((e) => e.getBoundingClientRect().width > 0);

/** "Take a tour" in the top bar, the first-visit start, and the tour itself (it lives here so every page that has the top bar has it). */
export function TourButton({ autoStart = import.meta.env.MODE !== "test" }: { autoStart?: boolean }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const active = useTour((s) => s.active);
  const start = useTour((s) => s.start);

  useEffect(() => {
    if (!autoStart || autoStartTried || useTour.getState().active) return;
    if (pathname !== "/" && pathname !== "/portfolio") return;
    autoStartTried = true;
    if (readTourOutcome() !== null) return;
    const signal = { cancelled: false };
    let timer: ReturnType<typeof setTimeout> | undefined;
    void waitFor(loaded, 10_000, signal).then((found) => {
      if (signal.cancelled || !found.length || useTour.getState().active) return;
      // A short pause after the interface appears, so the first step does not flash in over a half-drawn page.
      timer = setTimeout(() => start({ path: pathname, tab: currentWorkspaceTab() }), 700);
    });
    return () => {
      signal.cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [autoStart, pathname, start]);

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        aria-label="Take a tour"
        data-testid="take-tour"
        disabled={active}
        onClick={() => start({ path: pathname, tab: currentWorkspaceTab() })}
      >
        <CircleHelp />
        <span className="hidden lg:inline">Tour</span>
      </Button>
      <TourOverlay />
    </>
  );
}
