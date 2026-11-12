import { ResponsiveContainer, Sankey, Tooltip } from "recharts";
import { useTwin } from "@/store/useTwin";
import { selectFlows } from "@/store/hotelDerived";
import { usd } from "../format";

const KIND_COLOR = { source: "var(--primary)", zone: "var(--efficient)", category: "var(--heat)" } as const;

/** Where the money goes: grid and gas to zones to uses, with yearly cost on every flow (Recharts Sankey, plus a text table). */
export function FlowLayer() {
  const flows = useTwin(selectFlows);
  const used = new Set(flows.links.flatMap((l) => [l.source, l.target]));
  // Keep only nodes that carry a flow, and re-index.
  const nodes = flows.nodes.filter((n) => used.has(n.id));
  const remap = new Map(nodes.map((n, i) => [n.id, i]));
  const data = {
    nodes: nodes.map((n) => ({ name: n.label, kind: n.kind })),
    links: flows.links.map((l) => ({ source: remap.get(l.source) ?? 0, target: remap.get(l.target) ?? 0, value: Math.max(1, Math.round(l.costUsd)) })),
  };

  return (
    <div>
      <div className="h-80 w-full" aria-hidden="true">
        <ResponsiveContainer width="100%" height="100%">
          <Sankey
            data={data}
            nodePadding={14}
            nodeWidth={10}
            margin={{ top: 8, right: 120, bottom: 8, left: 8 }}
            link={{ stroke: "var(--muted-foreground)", strokeOpacity: 0.25 }}
            node={({ x, y, width, height, payload }: { x: number; y: number; width: number; height: number; payload: { name: string; kind: keyof typeof KIND_COLOR; value: number } }) => (
              <g>
                <rect x={x} y={y} width={width} height={height} fill={KIND_COLOR[payload.kind] ?? "var(--primary)"} />
                <text x={x + width + 6} y={y + height / 2} dominantBaseline="middle" fontSize="11" fill="var(--foreground)">
                  {payload.name}
                </text>
              </g>
            )}
          >
            <Tooltip formatter={(v: number) => `${usd(v)} / yr`} />
          </Sankey>
        </ResponsiveContainer>
      </div>
      <table className="sr-only" aria-label="Energy cost flows">
        <thead>
          <tr><th>From</th><th>To</th><th>Cost per year</th></tr>
        </thead>
        <tbody>
          {flows.links.map((l) => (
            <tr key={`${l.source}-${l.target}`}>
              <td>{flows.nodes.find((n) => n.id === l.source)?.label}</td>
              <td>{flows.nodes.find((n) => n.id === l.target)?.label}</td>
              <td>{usd(l.costUsd)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-1 text-xs text-muted-foreground">Yearly cost, estimated. Link width is dollars per year.</p>
    </div>
  );
}
