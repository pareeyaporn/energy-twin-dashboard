// Keeps every hotel marker selectable when hotels sit close together (downtown) or at the same spot (two hotels added in one area):
// markers closer than `minPx` on screen are grouped and fanned out on a small circle around the group's center. Display only; the
// hotel's true position is kept and drawn as a dot with a leader line.

export interface ScreenPoint {
  id: string;
  x: number;
  y: number;
}

export type Offsets = Record<string, { dx: number; dy: number }>;

export function spreadOffsets(points: ScreenPoint[], minPx = 34): Offsets {
  const out: Offsets = {};
  for (const p of points) out[p.id] = { dx: 0, dy: 0 };
  if (points.length < 2 || !points.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y))) return out;
  // Group with union-find on pairwise distance.
  const parent = points.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i]!)));
  for (let i = 0; i < points.length; i++)
    for (let j = i + 1; j < points.length; j++) {
      const a = points[i]!;
      const b = points[j]!;
      if (Math.hypot(a.x - b.x, a.y - b.y) < minPx) parent[find(i)] = find(j);
    }
  const groups = new Map<number, ScreenPoint[]>();
  points.forEach((p, i) => {
    const g = find(i);
    groups.set(g, [...(groups.get(g) ?? []), p]);
  });
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    const cx = group.reduce((s, p) => s + p.x, 0) / group.length;
    const cy = group.reduce((s, p) => s + p.y, 0) / group.length;
    // Radius so neighbors on the circle are at least minPx apart.
    const r = Math.max(minPx * 0.7, minPx / (2 * Math.sin(Math.PI / group.length)));
    // Stable order: by angle around the center (ties by id), starting at the top.
    const sorted = [...group].sort((a, b) => Math.atan2(a.y - cy, a.x - cx) - Math.atan2(b.y - cy, b.x - cx) || a.id.localeCompare(b.id));
    sorted.forEach((p, k) => {
      const ang = -Math.PI / 2 + (2 * Math.PI * k) / group.length;
      out[p.id] = { dx: cx + r * Math.cos(ang) - p.x, dy: cy + r * Math.sin(ang) - p.y };
    });
  }
  return out;
}
