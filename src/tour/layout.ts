// Where the tour's spotlight and card go. Pure, so it can be tested: the card never covers the highlighted area.

export interface Box {
  top: number;
  left: number;
  width: number;
  height: number;
}

export const MARGIN = 12;
const GAP = 14;
const PAD = 8;

/** The area covered by several elements' rectangles, padded, then limited to the viewport. */
export function unionBox(rects: { top: number; left: number; right: number; bottom: number }[], vw: number, vh: number): Box | null {
  if (!rects.length) return null;
  const top = Math.max(MARGIN / 2, Math.min(...rects.map((r) => r.top)) - PAD);
  const left = Math.max(MARGIN / 2, Math.min(...rects.map((r) => r.left)) - PAD);
  const bottom = Math.min(vh - MARGIN / 2, Math.max(...rects.map((r) => r.bottom)) + PAD);
  const right = Math.min(vw - MARGIN / 2, Math.max(...rects.map((r) => r.right)) + PAD);
  if (bottom <= top || right <= left) return null;
  return { top, left, width: right - left, height: bottom - top };
}

export type Side = "bottom" | "top" | "right" | "left" | "center" | "dock";

const clamp = (x: number, lo: number, hi: number) => Math.min(Math.max(x, lo), Math.max(lo, hi));

/**
 * Places a card of size `card` next to `spot` on the side with the most room that fits. If no side fits (a tall area, a phone screen),
 * the card docks at the bottom (or top) of the screen and the spotlight is trimmed to the part of the area the card leaves visible.
 */
export function placeCard(spot: Box | null, card: { width: number; height: number }, vw: number, vh: number): { side: Side; card: { top: number; left: number }; spot: Box | null } {
  const w = Math.min(card.width, vw - 2 * MARGIN);
  const h = card.height;
  if (!spot) return { side: "center", card: { top: Math.max(MARGIN, (vh - h) / 2), left: (vw - w) / 2 }, spot: null };
  const room = {
    bottom: vh - (spot.top + spot.height) - GAP - MARGIN,
    top: spot.top - GAP - MARGIN,
    right: vw - (spot.left + spot.width) - GAP - MARGIN,
    left: spot.left - GAP - MARGIN,
  };
  const fits = {
    bottom: room.bottom >= h,
    top: room.top >= h,
    right: room.right >= w,
    left: room.left >= w,
  };
  const order = (["bottom", "top", "right", "left"] as const)
    .filter((s) => fits[s])
    .sort((a, b) => room[b] - room[a]);
  const side = order[0];
  if (side === "bottom") return { side, spot, card: { top: spot.top + spot.height + GAP, left: clamp(spot.left, MARGIN, vw - w - MARGIN) } };
  if (side === "top") return { side, spot, card: { top: spot.top - GAP - h, left: clamp(spot.left, MARGIN, vw - w - MARGIN) } };
  if (side === "right") return { side, spot, card: { top: clamp(spot.top, MARGIN, vh - h - MARGIN), left: spot.left + spot.width + GAP } };
  if (side === "left") return { side, spot, card: { top: clamp(spot.top, MARGIN, vh - h - MARGIN), left: spot.left - GAP - w } };
  // Nothing fits: dock the card at the edge farther from the area's middle and trim the spotlight to what stays visible.
  const middle = spot.top + spot.height / 2;
  const left = (vw - w) / 2;
  if (middle < vh / 2) {
    const top = vh - h - MARGIN;
    const bottom = Math.min(spot.top + spot.height, top - GAP);
    return { side: "dock", card: { top, left }, spot: bottom > spot.top ? { ...spot, height: bottom - spot.top } : null };
  }
  const cardBottom = MARGIN + h;
  const top = Math.max(spot.top, cardBottom + GAP);
  return { side: "dock", card: { top: MARGIN, left }, spot: spot.top + spot.height > top ? { ...spot, top, height: spot.top + spot.height - top } : null };
}

/** True when two boxes overlap (used by the tests). */
export function overlaps(a: Box, b: Box): boolean {
  return a.left < b.left + b.width && b.left < a.left + a.width && a.top < b.top + b.height && b.top < a.top + a.height;
}
