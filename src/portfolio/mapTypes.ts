import type { PropertySummary } from "@/engine/hotel";
import type { CityGroup } from "./cities";

/** What both map views (street map and drawn map) receive. Display only: values and colors come from the engine via the store. */
export interface MapViewProps {
  rows: PropertySummary[];
  colors: Record<string, string>;
  /** 1 = highest for the selected metric. */
  ranks: Record<string, number>;
  hoverId: string | null;
  selectedId: string | null;
  metricLabel: string;
  valueText: (id: string) => string;
  onHover: (id: string | null) => void;
  onSelect: (id: string) => void;
  /** A click on the map itself (not a marker): closes the card. */
  onBackground: () => void;
  /** Fly to this hotel when `n` changes. */
  flyTo: { id: string; n: number } | null;
  /** Fit the hotels when this changes (0 = initial): those in `fitIds`, or all of them when it is null. */
  fitNonce: number;
  fitIds?: string[] | null;
  /** The hotels' cities (more than one: zoomed out, the street map shows one marker per city). */
  cities?: CityGroup[];
  cityValueText?: (city: string) => string;
  onPickCity?: (city: string) => void;
  reduce: boolean;
}

/** Room the overlays take (the card on the left, the hotel list on the right), so a hotel flown to lands in the open middle. */
export function overlayPadding(width: number): { top: number; bottom: number; left: number; right: number } {
  if (width >= 1024) return { top: 60, bottom: 60, left: 330, right: 310 };
  if (width >= 640) return { top: 60, bottom: 60, left: 330, right: 40 };
  return { top: 50, bottom: 110, left: 30, right: 30 };
}

/**
 * Room to leave when showing all hotels: the list on the right (desktop) and the legend at the bottom left; with a hotel's card open
 * (over the map from 640 px), its 300 px on the left too, so no hotel hides under it.
 */
export function fitPadding(width: number, cardOpen = false): { top: number; bottom: number; left: number; right: number } {
  const card = cardOpen && width >= 640 ? 330 : 0;
  if (width >= 1024) return { top: 70, bottom: 120, left: Math.max(90, card), right: 330 };
  if (width >= 640) return { top: 60, bottom: 120, left: Math.max(60, card), right: 60 };
  return { top: 50, bottom: 120, left: 30, right: 30 };
}

export const DOWNTOWN = { lat: 41.885, lng: -87.628 };
