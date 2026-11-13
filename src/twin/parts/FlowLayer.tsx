import { useMemo, useState } from "react";
import { energyFlows, energyFlowsAt } from "@/engine/hotel";
import type { FlowGraph, FlowLink } from "@/engine/hotel";
import { useTwin } from "@/store/useTwin";
import { selectCompare } from "@/store/hotelDerived";
import { hourLabel, monthLabel, usd } from "../format";
import { useTweened } from "../useTweened";
import { flowBands, pathKeys, sankeyLayout } from "./sankey";
import type { FlowMetric, Fuel, PlacedBand } from "./sankey";

const FUEL_COLOR: Record<Fuel, string> = { elec: "var(--primary)", gas: "var(--heat)" };
const FUEL_LABEL: Record<Fuel, string> = { elec: "Electricity", gas: "Natural gas" };
const NODE_COLOR = { source: "", zone: "var(--efficient)", category: "var(--muted-foreground)" } as const;

type Period = "year" | "hour";

const kwh = (n: number) => `${Math.round(n).toLocaleString("en-US")} kWh`;
const therms = (n: number) => `${Math.round(n).toLocaleString("en-US")} therms`;
const money = (n: number, period: Period) => (period === "year" ? `${usd(n)} / yr` : `$${n < 10 ? n.toFixed(2) : Math.round(n).toLocaleString("en-US")} / h`);
const carbon = (kg: number, period: Period) =>
  period === "year"
    ? `${(kg / 1000).toLocaleString("en-US", { maximumFractionDigits: kg < 10000 ? 1 : 0 })} t CO₂e / yr`
    : `${kg.toLocaleString("en-US", { maximumFractionDigits: kg < 10 ? 1 : 0 })} kg CO₂e / h`;
const METRIC_NAME: Record<FlowMetric, string> = { cost: "cost", energy: "site energy", carbon: "carbon" };
const energy = (kbtu: number, period: Period) =>
  period === "year" ? `${(kbtu / 1000).toLocaleString("en-US", { maximumFractionDigits: 0 })} MMBtu / yr` : `${(kbtu / 3.412).toLocaleString("en-US", { maximumFractionDigits: 1 })} kW-equiv.`;

function Toggle<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: { id: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div role="group" aria-label={label} className="flex overflow-hidden rounded-lg border border-glass-border text-xs">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          aria-pressed={value === o.id}
          onClick={() => onChange(o.id)}
          className={`px-2.5 py-1 transition-colors ${value === o.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent"}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/**
 * Where the energy, money and carbon go: grid and gas → zones → uses, as an animated Sankey. Band width is the chosen metric (cost, site
 * energy or carbon) for the year or for the clock's hour; electricity is cyan and gas amber. Every value comes from the engine's flow graph.
 */
export function FlowLayer() {
  const compare = useTwin(selectCompare);
  const mode = useTwin((s) => s.compareMode);
  const month = useTwin((s) => s.timeMonth);
  const hour = useTwin((s) => s.timeHour);
  const speed = useTwin((s) => s.playbackSpeed);
  const reduce = useTwin((s) => s.reduceEffects);
  const [metric, setMetric] = useState<FlowMetric>("cost");
  const [period, setPeriod] = useState<Period>("year");
  const [hover, setHover] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  const result = mode === "before" ? compare.before : compare.after;
  const graph: FlowGraph = useMemo(() => (period === "year" ? energyFlows(result) : energyFlowsAt(result, month, hour)), [result, period, month, hour]);
  const bands = useMemo(() => flowBands(graph, metric), [graph, metric]);
  const target = useMemo(() => Object.fromEntries(bands.map((b) => [b.key, b.value])), [bands]);
  const eased = useTweened(target, reduce);
  // Lay out the eased values; keep bands that are easing out so widths shrink smoothly instead of vanishing.
  const layout = useMemo(() => {
    const known = new Map(bands.map((b) => [b.key, b]));
    const all = Object.keys(eased).map((key) => {
      const b = known.get(key);
      if (b) return { ...b, value: eased[key] ?? 0 };
      const [ends, fuel] = key.split(":");
      const [source, t] = (ends ?? "").split(">");
      return { key, source: source ?? "", target: t ?? "", fuel: (fuel as Fuel) ?? "elec", value: eased[key] ?? 0 };
    });
    return sankeyLayout(graph, all.filter((b) => b.value > 0));
  }, [eased, bands, graph]);

  const linkOf = (b: PlacedBand): FlowLink | undefined => graph.links.find((l) => l.source === b.source && l.target === b.target);
  const label = (id: string) => graph.nodes.find((n) => n.id === id)?.label ?? id;
  const lit = pathKeys(bands, hover ?? selected);
  const active = lit.size > 0;
  const fmt = (v: number) => (metric === "cost" ? money(v, period) : metric === "carbon" ? carbon(v, period) : energy(v, period));
  const animate = !reduce;
  const dur = `${(1.6 / Math.max(0.5, speed)).toFixed(2)}s`;
  const sel = layout.bands.find((b) => b.key === selected);
  const selLink = sel ? linkOf(sel) : undefined;
  const total = layout.total;

  return (
    <div className="min-w-0 space-y-3">
      <style>{`
        @keyframes twin-flow { to { stroke-dashoffset: -28; } }
        .twin-flow-dots { animation: twin-flow var(--flow-dur, 1.6s) linear infinite; }
        @media (prefers-reduced-motion: reduce) { .twin-flow-dots { animation: none; } }
        .twin-band { transition: stroke-opacity 180ms ease; }
      `}</style>
      <div className="flex flex-wrap items-center gap-2">
        <Toggle label="Width shows" value={metric} onChange={setMetric} options={[{ id: "cost", label: "Cost" }, { id: "energy", label: "Energy" }, { id: "carbon", label: "Carbon" }]} />
        <Toggle label="Period" value={period} onChange={setPeriod} options={[{ id: "year", label: "Annual" }, { id: "hour", label: "This hour" }]} />
        <span className="ml-auto flex items-center gap-3 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1.5"><span aria-hidden className="h-2 w-4 rounded-full" style={{ background: FUEL_COLOR.elec }} /> Electricity</span>
          <span className="flex items-center gap-1.5"><span aria-hidden className="h-2 w-4 rounded-full" style={{ background: FUEL_COLOR.gas }} /> Natural gas</span>
          {mode === "before" && <span className="rounded-full border border-glass-border px-1.5">Before</span>}
        </span>
      </div>

      <div className="-mx-1 overflow-x-auto px-1" data-testid="flow-scroll">
      <svg
        viewBox={`0 0 ${layout.width} ${layout.height}`}
        className="h-auto w-full min-w-[620px] md:min-w-0"
        role="img"
        aria-label={`Energy flow, ${METRIC_NAME[metric]}, ${period === "year" ? "annual" : `${monthLabel(month)} ${hourLabel(hour)}`}. Details in the table below.`}
        onMouseLeave={() => setHover(null)}
        data-testid="flow-sankey"
      >
        <g fill="none">
          {layout.bands.map((b) => {
            const on = !active || lit.has(b.key);
            return (
              <path
                key={b.key}
                d={b.path}
                className="twin-band cursor-pointer"
                stroke={FUEL_COLOR[b.fuel]}
                strokeWidth={Math.max(0.6, b.w)}
                strokeOpacity={active ? (on ? 0.55 : 0.07) : 0.28}
                tabIndex={0}
                role="button"
                aria-label={`${label(b.source)} to ${label(b.target)}, ${FUEL_LABEL[b.fuel]}: ${fmt(b.value)}`}
                aria-pressed={selected === b.key}
                onMouseEnter={() => setHover(b.key)}
                onFocus={() => setHover(b.key)}
                onBlur={() => setHover(null)}
                onClick={() => setSelected(selected === b.key ? null : b.key)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setSelected(selected === b.key ? null : b.key);
                  }
                }}
              />
            );
          })}
        </g>
        {/* Moving dots along each band's curve: illustrative motion, speed follows the playback control */}
        {animate && (
          <g fill="none" pointerEvents="none" style={{ ["--flow-dur" as string]: dur }}>
            {layout.bands
              .filter((b) => b.w >= 1.5)
              .map((b) => {
                const on = !active || lit.has(b.key);
                return (
                  <path
                    key={b.key}
                    d={b.path}
                    className="twin-flow-dots"
                    stroke={FUEL_COLOR[b.fuel]}
                    strokeWidth={Math.min(4, Math.max(1.4, b.w * 0.3))}
                    strokeLinecap="round"
                    strokeDasharray="0.1 13.9"
                    strokeOpacity={on ? 0.95 : 0.12}
                  />
                );
              })}
          </g>
        )}
        {layout.nodes.map((n) => {
          const fill = n.kind === "source" ? FUEL_COLOR[n.id === "gas" ? "gas" : "elec"] : NODE_COLOR[n.kind];
          const dim = active && ![...lit].some((k) => k.startsWith(`${n.id}>`) || k.includes(`>${n.id}:`));
          return (
            <g key={n.id} opacity={dim ? 0.35 : 1} onMouseEnter={() => setHover(n.id)} className="cursor-default transition-opacity">
              <rect x={n.x} y={n.y} width={layout.nodeWidth} height={Math.max(1, n.h)} rx={2} fill={fill} />
              <text x={n.x + layout.nodeWidth + 6} y={n.y + n.h / 2} dominantBaseline="middle" fontSize="11" fill="var(--foreground)" stroke="var(--background)" strokeWidth={3} strokeOpacity={0.85} paintOrder="stroke" strokeLinejoin="round">
                {n.label}
                <tspan fill="var(--muted-foreground)" fontSize="10">{`  ${fmt(n.value)}`}</tspan>
              </text>
            </g>
          );
        })}
      </svg>
      </div>

      {sel && selLink && (
        <div data-testid="flow-detail" className="rounded-lg border border-glass-border bg-glass p-3 text-sm">
          <div className="flex items-start justify-between gap-2">
            <div className="font-medium">
              {label(sel.source)} → {label(sel.target)} <span className="text-muted-foreground">· {FUEL_LABEL[sel.fuel]}</span>
            </div>
            <button type="button" className="text-xs text-muted-foreground hover:text-foreground" onClick={() => setSelected(null)}>Close</button>
          </div>
          <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-5">
            <div><dt className="text-muted-foreground">Energy</dt><dd className="tabular-nums">{sel.fuel === "elec" ? kwh(selLink.elecKWh) : therms(selLink.gasTherms)}{period === "hour" ? " this hour" : " / yr"}</dd></div>
            <div><dt className="text-muted-foreground">Cost</dt><dd className="tabular-nums">{money(sel.fuel === "elec" ? selLink.elecCostUsd : selLink.gasCostUsd, period)}</dd></div>
            <div><dt className="text-muted-foreground">Carbon</dt><dd className="tabular-nums">{carbon(sel.fuel === "elec" ? selLink.elecCarbonKg : selLink.gasCarbonKg, period)}</dd></div>
            <div><dt className="text-muted-foreground">Share of total</dt><dd className="tabular-nums">{total > 0 ? `${((sel.value / total) * 100).toFixed(1)}%` : "—"} <span className="text-muted-foreground">(of {METRIC_NAME[metric]})</span></dd></div>
            <div><dt className="text-muted-foreground">Whole link</dt><dd className="tabular-nums">{money(selLink.costUsd, period)}</dd></div>
          </dl>
          <p className="mt-1.5 text-[11px] text-muted-foreground">Modeled estimate.</p>
        </div>
      )}

      <table className="sr-only" aria-label="Energy cost flows">
        <thead>
          <tr><th>From</th><th>To</th><th>Electricity</th><th>Gas</th><th>Cost</th><th>Carbon</th></tr>
        </thead>
        <tbody>
          {graph.links.map((l) => (
            <tr key={`${l.source}-${l.target}`}>
              <td>{label(l.source)}</td>
              <td>{label(l.target)}</td>
              <td>{kwh(l.elecKWh)}</td>
              <td>{therms(l.gasTherms)}</td>
              <td>{money(l.costUsd, period)}</td>
              <td>{carbon(l.carbonKg, period)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-xs text-muted-foreground" data-testid="flow-caption">
        {period === "year"
          ? `Annual ${METRIC_NAME[metric]}, modeled estimate. Band width is ${metric === "cost" ? "dollars" : metric === "carbon" ? "tonnes of CO₂e (energy × EPA emission factors)" : "energy"} per year; the moving dots are illustrative, not real-time flow.`
          : `A typical ${monthLabel(month)} day at ${hourLabel(hour)}, modeled from the monthly totals (follows the twin's clock). Not real-time monitoring.`}{" "}
        Hover a band to follow its path; click it for details.
      </p>
    </div>
  );
}
