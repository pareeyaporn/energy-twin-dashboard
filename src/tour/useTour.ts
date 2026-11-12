// Tour state, kept in its own small store (not the app's) so it survives moving between pages. It reads and restores the twin's view
// settings (time playback, layer, compare mode) and never touches hotel data.
import { create } from "zustand";
import { useTwin } from "@/store/useTwin";
import { TOUR_STEPS } from "./steps";
import type { TourView, WorkspaceTab } from "./steps";

export const TOUR_STORAGE_KEY = "energy-twin:tour:v1";
export type TourOutcome = "completed" | "skipped";

export function readTourOutcome(): TourOutcome | null {
  try {
    const v = typeof window === "undefined" ? null : window.localStorage.getItem(TOUR_STORAGE_KEY);
    return v === "completed" || v === "skipped" ? v : null;
  } catch {
    return null;
  }
}
function writeTourOutcome(v: TourOutcome): void {
  try {
    window.localStorage.setItem(TOUR_STORAGE_KEY, v);
  } catch {
    // Storage blocked: the tour may show again next visit; nothing else is affected.
  }
}

/** The twin's current view settings. */
export function currentView(): TourView {
  const s = useTwin.getState();
  return { timeMode: s.timeMode, timeMonth: s.timeMonth, timeHour: s.timeHour, playing: s.playing, playbackSpeed: s.playbackSpeed, twinLayer: s.twinLayer, compareMode: s.compareMode };
}

/** Applies view settings through the store's own setters, changing only what differs. */
export function applyView(v: TourView): void {
  const s = useTwin.getState();
  if (s.twinLayer !== v.twinLayer) s.setTwinLayer(v.twinLayer);
  if (s.compareMode !== v.compareMode) s.setCompareMode(v.compareMode);
  if (s.playbackSpeed !== v.playbackSpeed) s.setPlaybackSpeed(v.playbackSpeed);
  if (s.timeMode !== v.timeMode || s.timeMonth !== v.timeMonth || s.timeHour !== v.timeHour) s.setTime({ mode: v.timeMode, month: v.timeMonth, hour: v.timeHour });
  if (s.playing !== v.playing) s.setPlaying(v.playing);
}

export interface TourOrigin {
  path: string;
  tab: WorkspaceTab | null;
  view: TourView;
}

export interface TourState {
  active: boolean;
  index: number;
  /** +1 moving forward, -1 back; a step whose target is missing is skipped in this direction. */
  direction: 1 | -1;
  /** Where the user was when the tour started, restored at the end. */
  origin: TourOrigin | null;
  /** Set when the tour ends; the overlay restores the page and tab (and runs `then`), then clears it. */
  restore: { path: string; tab: WorkspaceTab | null; then?: "optimize" } | null;
  start: (origin: { path: string; tab: WorkspaceTab | null }) => void;
  next: () => void;
  back: () => void;
  /** Move past a step that cannot be shown (its target is missing). */
  skipStep: () => void;
  /** Ends the tour. `then: "optimize"` (the finish card's main button) opens Invest and runs the optimizer, at the user's request. */
  end: (outcome: TourOutcome, then?: "optimize") => void;
  clearRestore: () => void;
}

const last = TOUR_STEPS.length - 1;

export const useTour = create<TourState>((set, get) => ({
  active: false,
  index: 0,
  direction: 1,
  origin: null,
  restore: null,
  start: (origin) => set({ active: true, index: 0, direction: 1, origin: { ...origin, view: currentView() }, restore: null }),
  next: () => {
    const s = get();
    if (!s.active) return;
    if (s.index >= last) s.end("completed");
    else set({ index: s.index + 1, direction: 1 });
  },
  back: () => {
    const s = get();
    if (s.active && s.index > 0) set({ index: s.index - 1, direction: -1 });
  },
  skipStep: () => {
    const s = get();
    if (!s.active) return;
    const i = s.index + s.direction;
    if (i < 0) set({ index: 0, direction: 1 });
    else if (i > last) s.end("completed");
    else set({ index: i });
  },
  end: (outcome, then) => {
    writeTourOutcome(outcome);
    const origin = get().origin;
    if (origin) applyView(origin.view);
    const restore = then === "optimize" ? { path: "/", tab: "Invest" as const, then } : origin ? { path: origin.path, tab: origin.tab } : null;
    set({ active: false, index: 0, restore, origin: null });
  },
  clearRestore: () => set({ restore: null }),
}));
