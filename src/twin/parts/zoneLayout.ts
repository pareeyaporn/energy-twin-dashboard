import type { ZoneId } from "@/engine/hotel";

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}
export interface ZoneShape {
  rects: Rect[];
  /** Where the label goes. */
  label: { x: number; y: number };
  short: string;
}

/** A simple building cross-section in a 640 x 430 view: roof plant, guest floors around a core, ground floor, boiler room. */
export const VIEW = { w: 640, h: 430 };

export const ZONE_SHAPES: Record<ZoneId, ZoneShape> = {
  central_hvac: { rects: [{ x: 90, y: 26, w: 460, h: 64 }], label: { x: 320, y: 52 }, short: "Central HVAC" },
  guest_rooms: {
    rects: [
      { x: 90, y: 98, w: 198, h: 180 },
      { x: 352, y: 98, w: 198, h: 180 },
    ],
    label: { x: 189, y: 176 },
    short: "Guest rooms",
  },
  // Wide enough for a horizontal label; the label sits between the ghost-upgrade markers.
  hallways_shared: { rects: [{ x: 288, y: 98, w: 64, h: 252 }], label: { x: 320, y: 234 }, short: "Halls" },
  lobby_common: { rects: [{ x: 90, y: 286, w: 198, h: 64 }], label: { x: 189, y: 310 }, short: "Lobby" },
  kitchen_restaurant: { rects: [{ x: 352, y: 286, w: 198, h: 64 }], label: { x: 451, y: 310 }, short: "Kitchen" },
  hot_water: { rects: [{ x: 90, y: 358, w: 460, h: 50 }], label: { x: 320, y: 380 }, short: "Hot water" },
};

/** The second guest-room wing shows building facts, so it is not an unlabeled block. */
export const GUEST_WING_FACTS = { x: 451, y: 176 };
