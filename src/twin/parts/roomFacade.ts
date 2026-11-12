// Geometry and colors for the room façade. Pure: room states come from the engine's room pattern; this only places and colors them.
// Rooms are laid out per floor in index order, the same numbering as the 3D view's windows (floor = index / rooms per floor).
import type { RoomPoint, RoomState } from "@/engine/hotel";

export interface FacadeWindow {
  index: number;
  floor: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface FacadeLayout {
  width: number;
  height: number;
  perFloor: number;
  /** Building rectangle (guest floors). */
  bx: number;
  by: number;
  bw: number;
  bh: number;
  lobbyY: number;
  lobbyH: number;
  floorLines: number[];
  floorLabels: { floor: number; y: number }[];
  windows: FacadeWindow[];
}

export function facadeLayout(rooms: RoomPoint[], floors: number, width = 640): FacadeLayout {
  const f = Math.max(1, Math.round(floors));
  const perFloor = Math.max(1, Math.ceil(rooms.length / f));
  const margin = 30;
  const bw = width - margin * 2;
  const pitch = bw / perFloor;
  const ww = Math.max(4, pitch * 0.62);
  const floorH = Math.max(12, Math.min(34, ww * 1.5));
  const wh = floorH * 0.58;
  const by = 18;
  const bh = floorH * f;
  const lobbyH = Math.max(22, floorH * 1.3);
  const lobbyY = by + bh;
  const height = lobbyY + lobbyH + 14;
  const windows: FacadeWindow[] = [];
  for (const r of rooms) {
    const fl = Math.floor(r.index / perFloor); // 0 = first guest floor (bottom)
    const k = r.index % perFloor;
    const row = f - 1 - fl;
    windows.push({ index: r.index, floor: fl + 1, x: margin + k * pitch + (pitch - ww) / 2, y: by + row * floorH + (floorH - wh) * 0.42, w: ww, h: wh });
  }
  return {
    width,
    height,
    perFloor,
    bx: margin,
    by,
    bw,
    bh,
    lobbyY,
    lobbyH,
    floorLines: Array.from({ length: f - 1 }, (_, i) => by + (i + 1) * floorH),
    floorLabels: Array.from({ length: f }, (_, i) => ({ floor: f - i, y: by + i * floorH + floorH / 2 })),
    windows,
  };
}

function mix(a: string, b: string, t: number): string {
  const p = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const x = p(a);
  const y = p(b);
  const k = Math.min(1, Math.max(0, t));
  return `#${x.map((v, i) => Math.round(v + ((y[i] ?? 0) - v) * k).toString(16).padStart(2, "0")).join("")}`;
}

const NIGHT: Record<RoomState, string> = { occupied: "#ffd68a", away: "#7a6a4a", vacant: "#1c2433" };
const DAY_GLASS = "#a8c4e6";

/** Window color for a room state and daylight (0 night … 1 day): glowing at night, glass by day with the state showing through. */
export function windowColor(state: RoomState, daylight: number): string {
  const k = state === "occupied" ? 0.28 : 0.5;
  return mix(NIGHT[state], DAY_GLASS, daylight * k);
}
