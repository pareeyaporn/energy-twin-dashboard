// Tour state, kept in its own small store (not the app's) so it survives moving between pages. It reads and restores the twin's view
// settings (time playback, layer, compare mode). To tell one story, the hotel steps may open the portfolio's top-priority hotel; the app's
// state is copied when the tour starts and put back exactly when it ends, so the user's own hotel, what-if and plans are unchanged.
import { create } from "zustand";
import { useTwin } from "@/store/useTwin";
import { tourSteps } from "./steps";
import type { TourMode, TourView, WorkspaceTab } from "./steps";

// v2 (November 2026): the portfolio-first tour shows once to browsers that finished or skipped the earlier one.
export const TOUR_STORAGE_KEY = "energy-twin:tour:v2";
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
  /** The app's state (data, not actions) when the tour started; put back at the end if the tour opened another hotel. */
  snapshot: Record<string, unknown>;
  /** True once the tour has opened a hotel for its story. */
  focused: boolean;
}

/** A copy of the app's state fields (not its actions), taken by reference: restoring it puts back exactly what was there. */
function snapshotApp(): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(useTwin.getState())) if (typeof v !== "function") out[k] = v;
  return out;
}

export interface TourState {
  active: boolean;
  /** Quick (8 steps, the default) or full (every feature); chosen on the welcome card or from the top bar. */
  mode: TourMode;
  setMode: (mode: TourMode) => void;
  index: number;
  /** +1 moving forward, -1 back; a step whose target is missing is skipped in this direction. */
  direction: 1 | -1;
  /** Where the user was when the tour started, restored at the end. */
  origin: TourOrigin | null;
  /** Set when the tour ends; the overlay restores the page and tab (and runs `then`), then clears it. */
  restore: { path: string; tab: WorkspaceTab | null; then?: "optimize" } | null;
  start: (origin: { path: string; tab: WorkspaceTab | null }, mode?: TourMode) => void;
  next: () => void;
  back: () => void;
  /** Move past a step that cannot be shown (its target is missing). */
  skipStep: () => void;
  /**
   * Opens a hotel for the story (the portfolio's top priority) if it is not the open one; the app's state is restored when the tour ends.
   */
  focusHotel: (propertyId: string) => void;
  /**
   * Ends the tour. `then: "optimize"` (the finish card's main button) opens Invest and runs the optimizer, at the user's request, on the
   * hotel the tour showed; otherwise the app's state from the start of the tour comes back.
   */
  end: (outcome: TourOutcome, then?: "optimize") => void;
  clearRestore: () => void;
}

const lastIndex = (mode: TourMode) => tourSteps(mode).length - 1;

export const useTour = create<TourState>((set, get) => ({
  active: false,
  mode: "quick",
  setMode: (mode) => set({ mode }),
  index: 0,
  direction: 1,
  origin: null,
  restore: null,
  start: (origin, mode) => set({ active: true, mode: mode ?? "quick", index: 0, direction: 1, origin: { ...origin, view: currentView(), snapshot: snapshotApp(), focused: false }, restore: null }),
  focusHotel: (propertyId) => {
    const s = get();
    if (!s.active || !s.origin) return;
    const app = useTwin.getState();
    if (app.activePropertyId === propertyId) return;
    if (!app.portfolio.properties.some((p) => p.id === propertyId)) return;
    if (!s.origin.focused) set({ origin: { ...s.origin, focused: true } });
    app.openProperty(propertyId);
  },
  next: () => {
    const s = get();
    if (!s.active) return;
    if (s.index >= lastIndex(s.mode)) s.end("completed");
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
    else if (i > lastIndex(s.mode)) s.end("completed");
    else set({ index: i });
  },
  end: (outcome, then) => {
    writeTourOutcome(outcome);
    const origin = get().origin;
    // Put the user's own hotel, what-if and plans back (the tour only opened a hotel to tell its story); keep the shown hotel when the
    // user asked to find its best investments.
    if (origin?.focused && then !== "optimize") useTwin.setState(origin.snapshot as Partial<ReturnType<typeof useTwin.getState>>);
    if (origin) applyView(origin.view);
    const restore = then === "optimize" ? { path: "/hotel", tab: "Invest" as const, then } : origin ? { path: origin.path, tab: origin.tab } : null;
    set({ active: false, index: 0, restore, origin: null });
  },
  clearRestore: () => set({ restore: null }),
}));
