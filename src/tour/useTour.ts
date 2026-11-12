// Tour state, kept in its own small store (not the app's) so it survives moving between pages and never touches hotel data.
import { create } from "zustand";
import { TOUR_STEPS } from "./steps";
import type { WorkspaceTab } from "./steps";

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

export interface TourState {
  active: boolean;
  index: number;
  /** +1 moving forward, -1 back; a step whose target is missing is skipped in this direction. */
  direction: 1 | -1;
  /** Where the user was when the tour started, restored at the end. */
  origin: { path: string; tab: WorkspaceTab | null } | null;
  /** Set when the tour ends; the overlay restores the origin view, then clears it. */
  restore: { path: string; tab: WorkspaceTab | null } | null;
  start: (origin: { path: string; tab: WorkspaceTab | null }) => void;
  next: () => void;
  back: () => void;
  /** Move past a step that cannot be shown (its target is missing). */
  skipStep: () => void;
  end: (outcome: TourOutcome) => void;
  clearRestore: () => void;
}

const last = TOUR_STEPS.length - 1;

export const useTour = create<TourState>((set, get) => ({
  active: false,
  index: 0,
  direction: 1,
  origin: null,
  restore: null,
  start: (origin) => set({ active: true, index: 0, direction: 1, origin, restore: null }),
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
  end: (outcome) => {
    writeTourOutcome(outcome);
    set((s) => ({ active: false, index: 0, restore: s.origin, origin: null }));
  },
  clearRestore: () => set({ restore: null }),
}));
