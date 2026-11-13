import { Bar, BarChart, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { PropertySummary } from "@/engine/hotel";
import { usd } from "@/twin/format";

const axis = { fontSize: 10, fill: "var(--muted-foreground)" };
const tip = { contentStyle: { background: "var(--popover)", border: "1px solid var(--border)", fontSize: 11 }, cursor: { fill: "var(--accent)", opacity: 0.3 } };
const short = (name: string) => name.replace(/ Hotel$/, "").replace("Lakefront Convention", "Convention");
const KWH_TO_MMBTU = 3.412 / 1000;
const THERM_TO_MMBTU = 0.1;

function Chart({ title, note, children }: { title: string; note: string; children: React.ReactElement }) {
  return (
    <figure className="rounded-xl border border-glass-border p-3">
      <figcaption className="text-sm font-medium">{title}</figcaption>
      <div className="mt-2 h-48 w-full" role="img" aria-label={`${title}. ${note}`}>
        <ResponsiveContainer width="100%" height="100%">{children}</ResponsiveContainer>
      </div>
      <p className="mt-1 text-[11px] text-muted-foreground">{note}</p>
    </figure>
  );
}

/** Four views of the portfolio; each bar's value is in its tooltip and in the comparison table. */
export function PortfolioCharts({ rows }: { rows: PropertySummary[] }) {
  const data = rows.map((r) => ({
    name: short(r.name),
    cost: r.annual.cost,
    eui: Math.round(r.siteEui * 10) / 10,
    potential: r.potential?.annualSavings ?? 0,
    elec: Math.round(r.annual.elecKWh * KWH_TO_MMBTU),
    gas: Math.round(r.annual.gasTherms * THERM_TO_MMBTU),
  }));
  const bar = { radius: [4, 4, 0, 0] as [number, number, number, number], isAnimationActive: false, maxBarSize: 36 };
  const x = <XAxis dataKey="name" tick={axis} stroke="var(--border)" interval={0} />;
  return (
    <div className="grid gap-3">
      <Chart title="Electricity vs natural gas" note="Site energy in MMBtu a year (1 kWh = 3,412 Btu; 1 therm = 100,000 Btu).">
        <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
          {x}
          <YAxis width={52} tick={axis} stroke="var(--border)" tickFormatter={(v: number) => `${Math.round(v / 1000)}k`} />
          <Tooltip {...tip} formatter={(v: unknown, n: string) => [`${Number(v).toLocaleString("en-US")} MMBtu`, n]} />
          <Legend wrapperStyle={{ fontSize: 11 }} formatter={(v: string) => <span style={{ color: "var(--foreground)" }}>{v}</span>} />
          <Bar dataKey="elec" name="Electricity" stackId="e" fill="var(--primary)" stroke="var(--background)" strokeWidth={2} isAnimationActive={false} maxBarSize={36} />
          <Bar dataKey="gas" name="Natural gas" stackId="e" fill="var(--heat)" stroke="var(--background)" strokeWidth={2} {...bar} />
        </BarChart>
      </Chart>
    </div>
  );
}
