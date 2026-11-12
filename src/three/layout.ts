// Geometry of the 3D hotel, derived from the profile only. Pure and deterministic so it can be tested without WebGL.
// Units are arbitrary scene units (1 ≈ 4 m). The building is a podium (lobby, kitchen) under the guest floors, with a central
// circulation core (hallways), a rooftop plant and a hot-water room beside the podium.

export interface Box {
  /** Center position. */
  x: number;
  y: number;
  z: number;
  /** Size. */
  w: number;
  h: number;
  d: number;
}

export interface WindowSlot {
  /** Room index (matches `roomOccupancyPattern`). */
  index: number;
  floor: number;
  x: number;
  y: number;
  z: number;
  /** +1 front facade, -1 back facade. */
  side: 1 | -1;
}

export interface BuildingLayout {
  floors: number;
  roomsPerFloor: number;
  floorHeight: number;
  width: number;
  depth: number;
  podium: { lobby: Box; kitchen: Box };
  guestFloors: Box[];
  core: Box;
  plant: Box;
  roofY: number;
  hotWater: Box;
  windows: WindowSlot[];
  /** Solar panel slots on the roof, in order; a package with a fraction of the roof uses the first share of them. */
  solarSlots: Box[];
}

const FLOOR_H = 1;
const PODIUM_H = 1.3;
const WINDOW_PITCH = 0.62;

/** Building geometry for a hotel with `rooms` rooms on `floors` guest floors. Rooms are split across a front and a back facade. */
export function buildingLayout(rooms: number, floors: number): BuildingLayout {
  const f = Math.max(1, Math.round(floors));
  const perFloor = Math.max(1, Math.ceil(rooms / f));
  const perSide = Math.ceil(perFloor / 2);
  const width = Math.max(4, perSide * WINDOW_PITCH + 1);
  const depth = 3.2;

  const lobby: Box = { x: -width / 4, y: PODIUM_H / 2, z: 0, w: width / 2 - 0.05, h: PODIUM_H, d: depth + 0.6 };
  const kitchen: Box = { x: width / 4, y: PODIUM_H / 2, z: 0, w: width / 2 - 0.05, h: PODIUM_H, d: depth + 0.6 };

  const guestFloors: Box[] = [];
  const windows: WindowSlot[] = [];
  for (let i = 0; i < f; i++) {
    const y = PODIUM_H + i * FLOOR_H + FLOOR_H / 2;
    guestFloors.push({ x: 0, y, z: 0, w: width, h: FLOOR_H * 0.92, d: depth });
    for (let k = 0; k < perFloor; k++) {
      const index = i * perFloor + k;
      if (index >= rooms) break;
      const side: 1 | -1 = k % 2 === 0 ? 1 : -1;
      const slot = Math.floor(k / 2);
      const x = -width / 2 + 0.5 + slot * WINDOW_PITCH + WINDOW_PITCH / 2 - 0.05;
      windows.push({ index, floor: i + 1, x, y, z: side * (depth / 2 + 0.011), side });
    }
  }

  const roofY = PODIUM_H + f * FLOOR_H;
  const core: Box = { x: 0, y: PODIUM_H + (f * FLOOR_H) / 2, z: 0, w: 0.9, h: f * FLOOR_H + 0.02, d: depth + 0.04 };
  const plant: Box = { x: width / 2 - 1.3, y: roofY + 0.4, z: 0, w: 1.8, h: 0.8, d: 1.6 };
  const hotWater: Box = { x: width / 2 + 0.9, y: 0.55, z: depth / 2 - 0.3, w: 1.1, h: 1.1, d: 1.1 };

  // Solar slots fill the roof left of the plant, row by row.
  const solarSlots: Box[] = [];
  const left = -width / 2 + 0.45;
  const right = plant.x - plant.w / 2 - 0.35;
  for (let zRow = -depth / 2 + 0.45; zRow <= depth / 2 - 0.45; zRow += 0.7) {
    for (let x = left; x <= right; x += 0.75) solarSlots.push({ x: x + 0.3, y: roofY + 0.12, z: zRow + 0.25, w: 0.62, h: 0.04, d: 0.55 });
  }

  return { floors: f, roomsPerFloor: perFloor, floorHeight: FLOOR_H, width, depth, podium: { lobby, kitchen }, guestFloors, core, plant, roofY, hotWater, windows, solarSlots };
}

/** How many solar slots a package's array fills (a quarter, half or all of the usable roof). */
export function solarSlotCount(totalSlots: number, roofFraction: number): number {
  if (roofFraction <= 0) return 0;
  return Math.max(1, Math.round(totalSlots * Math.min(1, roofFraction)));
}

export type Vec3 = [number, number, number];
export interface CameraView {
  position: Vec3;
  target: Vec3;
}
export type CameraFocus = 'guest_rooms' | 'lobby_common' | 'kitchen_restaurant' | 'hallways_shared' | 'central_hvac' | 'hot_water' | 'solar';

/**
 * Camera positions for the 3D twin: the home view, a wide "fly-in" start, and one close view per zone (plus the roof for solar),
 * so a selection can glide the camera to it. Pure, from the layout only.
 */
export function cameraViews(l: BuildingLayout): { home: CameraView; intro: CameraView; focus: Record<CameraFocus, CameraView> } {
  // Fits low hotels by width and tall towers by height (the camera's vertical field of view is 38°).
  const span = Math.max(l.width * 1.1, 4.5 + l.roofY * 0.7);
  const mid: Vec3 = [-1.2, l.roofY / 2, 0];
  const home: CameraView = { position: [span * 1.45, span * 0.95, span * 1.6], target: mid };
  const intro: CameraView = { position: [-span * 2.4, span * 2.2, span * 3.2], target: [0, l.roofY * 0.8, 0] };
  const near = (t: Vec3, dist: number, up = 0.45, side = 0.55): CameraView => ({
    target: t,
    position: [t[0] + dist * side, t[1] + dist * up, t[2] + dist],
  });
  const lobby = l.podium.lobby;
  const kitchen = l.podium.kitchen;
  return {
    home,
    intro,
    focus: {
      guest_rooms: near([0, l.roofY * 0.6, l.depth / 2], Math.max(13, l.roofY * 1.5), 0.3, 0.4),
      lobby_common: near([lobby.x, lobby.h, l.depth / 2], 11, 0.35, 0.25),
      kitchen_restaurant: near([kitchen.x, kitchen.h, l.depth / 2], 11, 0.35, 0.45),
      hallways_shared: near([0, l.core.y, l.depth / 2], Math.max(12, l.roofY * 1.4), 0.25, 0.2),
      central_hvac: { target: [l.plant.x, l.roofY + 0.4, 0], position: [l.plant.x + 6, l.roofY + 7, 9] },
      hot_water: near([l.hotWater.x, l.hotWater.h, l.hotWater.z], 9.5, 0.45, 0.8),
      solar: { target: [-l.width / 4, l.roofY, 0], position: [-l.width / 4 + 3, l.roofY + 9, 9] },
    },
  };
}
