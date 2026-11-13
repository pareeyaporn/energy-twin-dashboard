// Layout for the energy-flow Sankey: three columns (sources → zones → uses), one band per link and fuel.
// Pure geometry: it only places the values it is given (from the engine's flow graph); it computes no energy or money.
import type { FlowGraph, FlowNode } from "@/engine/hotel";

export type FlowMetric = "cost" | "energy" | "carbon";
export type Fuel = "elec" | "gas";

export interface Band {
  key: string;
  source: string;
  target: string;
  fuel: Fuel;
  value: number;
}

export interface PlacedNode extends FlowNode {
  x: number;
  y: number;
  h: number;
  value: number;
}

export interface PlacedBand extends Band {
  w: number;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  /** Center-line path (draw with stroke-width = w). */
  path: string;
}

export interface SankeyLayout {
  width: number;
  height: number;
  nodeWidth: number;
  nodes: PlacedNode[];
  bands: PlacedBand[];
  /** Sum of the source column (the whole hotel). */
  total: number;
}

const COLUMN: Record<FlowNode["kind"], number> = { source: 0, zone: 1, category: 2 };

/** One band per link and fuel: source links carry one fuel; zone-to-use links are split into their electricity and gas parts. */
export function flowBands(graph: FlowGraph, metric: FlowMetric): Band[] {
  const out: Band[] = [];
  for (const l of graph.links) {
    const elec = metric === "cost" ? l.elecCostUsd : metric === "carbon" ? l.elecCarbonKg : l.elecKBtu;
    const gas = metric === "cost" ? l.gasCostUsd : metric === "carbon" ? l.gasCarbonKg : l.gasKBtu;
    if (elec > 0) out.push({ key: `${l.source}>${l.target}:elec`, source: l.source, target: l.target, fuel: "elec", value: elec });
    if (gas > 0) out.push({ key: `${l.source}>${l.target}:gas`, source: l.source, target: l.target, fuel: "gas", value: gas });
  }
  return out;
}

/** Places nodes and bands. `values` can override band values by key (used to ease widths between two states). */
export function sankeyLayout(
  graph: FlowGraph,
  bands: Band[],
  opts: { width?: number; height?: number; nodeWidth?: number; pad?: number; left?: number; right?: number } = {},
): SankeyLayout {
  const width = opts.width ?? 760;
  const height = opts.height ?? 340;
  const nodeWidth = opts.nodeWidth ?? 12;
  const pad = opts.pad ?? 10;
  const left = opts.left ?? 4;
  const right = opts.right ?? 150;

  const inSum = new Map<string, number>();
  const outSum = new Map<string, number>();
  for (const b of bands) {
    outSum.set(b.source, (outSum.get(b.source) ?? 0) + b.value);
    inSum.set(b.target, (inSum.get(b.target) ?? 0) + b.value);
  }
  const used = graph.nodes.filter((n) => (inSum.get(n.id) ?? 0) + (outSum.get(n.id) ?? 0) > 0);
  const value = (id: string) => Math.max(inSum.get(id) ?? 0, outSum.get(id) ?? 0);
  const cols = [0, 1, 2].map((c) => used.filter((n) => COLUMN[n.kind] === c));
  const colTotal = cols.map((c) => c.reduce((s, n) => s + value(n.id), 0));
  const k = Math.min(...cols.map((c, i) => (c.length ? (height - pad * (c.length - 1)) / Math.max(1e-9, colTotal[i] ?? 0) : Infinity)));
  const scale = Number.isFinite(k) ? k : 0;
  const span = width - left - right - nodeWidth;
  const xOf = (c: number) => left + (span * c) / 2;

  const nodes: PlacedNode[] = [];
  cols.forEach((c, ci) => {
    const used = (colTotal[ci] ?? 0) * scale + pad * Math.max(0, c.length - 1);
    let y = (height - used) / 2;
    for (const n of c) {
      const h = value(n.id) * scale;
      nodes.push({ ...n, x: xOf(ci), y, h, value: value(n.id) });
      y += h + pad;
    }
  });
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const order = new Map(nodes.map((n, i) => [n.id, i]));
  const fuelRank = (f: Fuel) => (f === "elec" ? 0 : 1);

  // Stack bands at each end, ordered by the node at the other end (then electricity before gas), so they do not cross needlessly.
  const outOffset = new Map<string, number>();
  const inOffset = new Map<string, number>();
  const sorted = [...bands].filter((b) => byId.has(b.source) && byId.has(b.target));
  const startY = new Map<string, number>();
  for (const b of [...sorted].sort((a, c) => (order.get(a.source)! - order.get(c.source)!) || (order.get(a.target)! - order.get(c.target)!) || fuelRank(a.fuel) - fuelRank(c.fuel))) {
    const s = byId.get(b.source)!;
    const off = outOffset.get(s.id) ?? 0;
    startY.set(b.key, s.y + off);
    outOffset.set(s.id, off + b.value * scale);
  }
  const placed: PlacedBand[] = [];
  for (const b of [...sorted].sort((a, c) => (order.get(a.target)! - order.get(c.target)!) || (order.get(a.source)! - order.get(c.source)!) || fuelRank(a.fuel) - fuelRank(c.fuel))) {
    const s = byId.get(b.source)!;
    const t = byId.get(b.target)!;
    const w = b.value * scale;
    const off = inOffset.get(t.id) ?? 0;
    inOffset.set(t.id, off + w);
    const x0 = s.x + nodeWidth;
    const x1 = t.x;
    const y0 = (startY.get(b.key) ?? s.y) + w / 2;
    const y1 = t.y + off + w / 2;
    const xm = (x0 + x1) / 2;
    placed.push({ ...b, w, x0, y0, x1, y1, path: `M${x0.toFixed(1)},${y0.toFixed(1)} C${xm.toFixed(1)},${y0.toFixed(1)} ${xm.toFixed(1)},${y1.toFixed(1)} ${x1.toFixed(1)},${y1.toFixed(1)}` });
  }
  return { width, height, nodeWidth, nodes, bands: placed, total: colTotal[0] ?? 0 };
}

/**
 * Bands on the same energy path as `key`: a source band and the zone's onward bands of the same fuel, or a zone-to-use band and the
 * source band that feeds it. For a node id, every band touching it plus those paths.
 */
export function pathKeys(bands: Band[], key: string | null): Set<string> {
  const out = new Set<string>();
  if (!key) return out;
  const hit = bands.find((b) => b.key === key);
  const add = (b: Band) => {
    out.add(b.key);
    if (b.source === "grid" || b.source === "gas") {
      for (const x of bands) if (x.source === b.target && x.fuel === b.fuel) out.add(x.key);
    } else {
      for (const x of bands) if (x.target === b.source && x.fuel === b.fuel) out.add(x.key);
    }
  };
  if (hit) add(hit);
  else for (const b of bands) if (b.source === key || b.target === key) add(b);
  return out;
}
