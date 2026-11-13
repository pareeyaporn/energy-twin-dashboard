import type { ReactNode } from "react";
import type { HotelReportData, PortfolioReportData, ReportData } from "./data";

// The report preview: the same report data and sections as the PDF, drawn as light "paper" pages in the browser (works on phones,
// where an embedded PDF viewer often does not).
const usd = (n: number) => `${n < 0 ? "-" : ""}$${Math.round(Math.abs(n)).toLocaleString("en-US")}`;
const num = (n: number, d = 0) => n.toLocaleString("en-US", { maximumFractionDigits: d, minimumFractionDigits: d });
const pct = (r: number) => `${Math.round(r * 100)}%`;
const yrs = (n: number | null) => (n === null ? "No payback" : `${n.toFixed(1)} years`);

function Paper({ children }: { children: ReactNode }) {
  return <section className="mx-auto mb-3 w-full max-w-[816px] overflow-hidden rounded-md bg-white text-[12px] leading-relaxed text-slate-800 shadow">{children}</section>;
}
function Band({ title, subject }: { title: string; subject: string }) {
  return (
    <div className="flex items-center justify-between gap-2 bg-[#0B1B33] px-5 py-2.5 text-[11px] text-slate-300">
      <span className="font-semibold text-white">Energy <span className="text-cyan-400">Twin</span></span>
      <span className="truncate">{title} · {subject}</span>
    </div>
  );
}
const H2 = ({ children }: { children: ReactNode }) => <h3 className="mb-2 mt-4 text-[15px] font-bold text-[#0B1B33]">{children}</h3>;
const H3 = ({ children }: { children: ReactNode }) => <h4 className="mb-1 mt-3 text-[12px] font-bold text-[#0B1B33]">{children}</h4>;

function Kpi({ label, value, note, tone }: { label: string; value: string; note?: string | undefined; tone?: "good" | "bad" | undefined }) {
  return (
    <div className="rounded border border-slate-200 border-t-[3px] border-t-cyan-600 p-2">
      <div className="text-[10px] text-slate-500">{label}</div>
      <div className={`text-[16px] font-bold tabular-nums ${tone === "good" ? "text-emerald-600" : tone === "bad" ? "text-red-600" : "text-[#0B1B33]"}`}>{value}</div>
      {note && <div className="text-[10px] text-slate-500">{note}</div>}
    </div>
  );
}
function Bars({ items, format = usd, color = "#0891B2" }: { items: { label: string; value: number }[]; format?: (n: number) => string; color?: string }) {
  const max = Math.max(1, ...items.map((i) => Math.abs(i.value)));
  return (
    <ul className="space-y-1">
      {items.map((i) => (
        <li key={i.label} className="grid grid-cols-[minmax(0,40%)_1fr] items-center gap-2 text-[11px]">
          <span className="truncate">{i.label}</span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 rounded-sm" style={{ width: `${Math.max(1, (Math.abs(i.value) / max) * 75)}%`, background: i.value < 0 ? "#DC2626" : color }} />
            <span className="shrink-0 tabular-nums text-slate-500">{format(i.value)}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}
function Table({ head, rows, right = [] }: { head: string[]; rows: (string | number)[][]; right?: number[] }) {
  return (
    <div className="overflow-x-auto rounded border border-slate-200">
      <table className="w-full min-w-[480px] text-[11px]">
        <thead className="bg-slate-50 text-slate-500"><tr>{head.map((h, i) => <th key={h} className={`p-1.5 font-semibold ${right.includes(i) ? "text-right" : "text-left"}`}>{h}</th>)}</tr></thead>
        <tbody>{rows.map((r, i) => <tr key={i} className="border-t border-slate-200">{r.map((v, j) => <td key={j} className={`p-1.5 tabular-nums ${right.includes(j) ? "text-right" : ""}`}>{v}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}
function Verdict({ v }: { v: HotelReportData["interpretation"] }) {
  const c = v.verdict === "attractive" ? "border-emerald-600 text-emerald-700" : v.verdict === "marginal" ? "border-amber-600 text-amber-700" : "border-red-600 text-red-700";
  return (
    <div className={`mt-3 rounded-sm border-l-4 bg-sky-50 p-3 ${c}`} data-testid="report-verdict">
      <p className="font-bold">{v.headline}</p>
      {v.sentences.map((s, i) => <p key={i} className="text-slate-700">{s}</p>)}
    </div>
  );
}
function Cumulative({ values }: { values: number[] }) {
  const W = 640, H = 140, l = 44, r = 8, tp = 8, b = 18;
  const lo = Math.min(0, ...values), hi = Math.max(0, ...values), span = hi - lo || 1;
  const x = (i: number) => l + (i / Math.max(1, values.length - 1)) * (W - l - r);
  const y = (v: number) => tp + ((hi - v) / span) * (H - tp - b);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Cumulative net benefit, years 0 to 10">
      <line x1={l} x2={W - r} y1={y(0)} y2={y(0)} stroke="#64748B" strokeDasharray="3 2" strokeWidth={0.8} />
      <polyline points={values.map((v, i) => `${x(i)},${y(v)}`).join(" ")} fill="none" stroke="#0891B2" strokeWidth={2.2} />
      <text x={2} y={y(hi) + 4} fontSize={10} fill="#64748B">{usd(hi)}</text>
      <text x={2} y={y(0) + 4} fontSize={10} fill="#64748B">$0</text>
      {lo < 0 && <text x={2} y={y(lo) + 4} fontSize={10} fill="#64748B">{usd(lo)}</text>}
      <text x={l} y={H - 3} fontSize={10} fill="#64748B">Year 0</text>
      <text x={W - r} y={H - 3} fontSize={10} fill="#64748B" textAnchor="end">Year {values.length - 1}</text>
    </svg>
  );
}
const List = ({ items }: { items: string[] }) => <ul className="list-disc space-y-0.5 pl-5">{items.map((s, i) => <li key={i}>{s}</li>)}</ul>;

function HotelPreview({ d }: { d: HotelReportData }) {
  const f = d.financial;
  return (
    <>
      <Paper>
        <Band title={d.title} subject={d.hotel.name} />
        <div className="p-5">
          <h2 className="text-[22px] font-bold text-[#0B1B33]">{d.hotel.name}</h2>
          <p className="text-slate-500">{d.title} · {d.planLabel}</p>
          <div className="mt-1 flex flex-wrap gap-1 text-[10px]">
            <span className="rounded bg-cyan-100 px-1.5 text-cyan-800">Modeled estimates</span>
            {d.hotel.synthetic && <span className="rounded bg-amber-100 px-1.5 text-amber-800">Synthetic demonstration hotel</span>}
            {d.measuredAgainst && <span className="rounded bg-amber-100 px-1.5 text-amber-800">Measured against a what-if</span>}
          </div>
          <H2>Executive summary</H2>
          <p>Recommended investment: {d.planName}.</p>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Kpi label="Net investment" value={usd(d.investment.netInvestment)} note={`${usd(d.investment.grossCost)} installed${d.investment.incentivesApplied > 0 ? `, less ${usd(d.investment.incentivesApplied)} incentives` : ""}`} />
            <Kpi label="Estimated annual savings" value={usd(f.annualSavings)} note={`${usd(f.savingsRange[0])} to ${usd(f.savingsRange[1])}`} tone="good" />
            <Kpi label="Cut in the energy bill" value={pct(f.savingsPctOfBill)} note={`of ${usd(d.current.cost)} a year`} />
            <Kpi label="Pays for itself in" value={yrs(f.paybackYears)} note="simple payback" />
            <Kpi label="NPV, 5 years" value={usd(f.npv5)} note={`at ${pct(f.discountRate)} a year`} tone={f.npv5 < 0 ? "bad" : undefined} />
            <Kpi label="NPV, 10 years" value={usd(f.npv10)} note={`at ${pct(f.discountRate)} a year`} tone={f.npv10 < 0 ? "bad" : "good"} />
            <Kpi label="Carbon avoided" value={`${num(d.environment.carbonKgAvoided / 1000, 1)} t CO2e`} note={`${pct(d.environment.carbonPct)} of emissions a year`} />
            <Kpi label="Budget left" value={usd(d.investment.remainingBudget)} note={`of ${usd(d.budget)}`} tone={d.investment.overBudget ? "bad" : undefined} />
          </div>
          <Verdict v={d.interpretation} />
          <H2>Property overview</H2>
          <Table head={["Item", "Value"]} rows={[["Location", d.hotel.location || "-"], ["Rooms", num(d.hotel.rooms)], ["Floor area", `${num(d.hotel.floorAreaSqft)} ft²`], ["Year built", String(d.hotel.yearBuilt)], ["Heating and cooling", d.hotel.hvac], ["Average occupancy", `${d.hotel.occupancyPct}%`]]} />
        </div>
      </Paper>
      <Paper>
        <Band title={d.title} subject={d.hotel.name} />
        <div className="p-5">
          <H2>Current energy performance</H2>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Kpi label="Energy spending" value={usd(d.current.cost)} note="a year" />
            <Kpi label="Electricity" value={`${num(d.current.elecKWh)} kWh`} note={`${usd(d.current.elecCost)} a year`} />
            <Kpi label="Natural gas" value={`${num(d.current.gasTherms)} therms`} note={`${usd(d.current.gasCost)} a year`} />
            <Kpi label="Energy intensity" value={`${num(d.current.siteEui, 1)} kBtu/ft²`} note={`${num(d.current.carbonKg / 1000)} t CO2e a year`} />
          </div>
          <H3>Where the money goes</H3>
          <Bars items={d.current.byCategory.map((c) => ({ label: `${c.label} (${pct(c.share)})`, value: c.cost }))} />
          <H3>Key cost drivers by area</H3>
          <Bars items={d.current.byZone.slice(0, 6).map((c) => ({ label: `${c.label} (${pct(c.share)})`, value: c.cost }))} />
          <H2>Before and after the upgrades</H2>
          <Table
            head={["Measure", "Before", "After", "Change", "Change %"]}
            right={[1, 2, 3, 4]}
            rows={d.comparison.map((c) => {
              const fmt = (v: number) => (c.unit.startsWith("$") ? usd(v) : num(v, c.unit.startsWith("kBtu") || c.unit.startsWith("t") ? 1 : 0));
              return [`${c.label} (${c.unit})`, fmt(c.before), fmt(c.after), `${c.change > 0 ? "+" : ""}${fmt(c.change)}`, c.changePct === null ? "-" : `${c.changePct > 0 ? "+" : ""}${(c.changePct * 100).toFixed(1)}%`];
            })}
          />
        </div>
      </Paper>
      <Paper>
        <Band title={d.title} subject={d.hotel.name} />
        <div className="p-5">
          <H2>Investment analysis</H2>
          <Table
            head={["Upgrade", "Quantity", "Installed", "Incentive", "Saves / yr", "Payback", "Life"]}
            right={[2, 3, 4, 5, 6]}
            rows={[
              ...d.upgrades.map((u) => [u.label, u.quantity, usd(u.installedCost), u.incentives.some((x) => x.applied) ? usd(u.incentives.filter((x) => x.applied).reduce((s, x) => s + x.amount, 0)) : "-", usd(u.annualSavings), u.paybackYears === null ? "-" : `${u.paybackYears.toFixed(1)} yr${u.paybackBeyondLife ? "*" : ""}`, `${u.lifetimeYears} yr`]),
              ["Package total", "", usd(d.investment.grossCost), d.investment.incentivesApplied > 0 ? usd(d.investment.incentivesApplied) : "-", usd(f.annualSavings), yrs(f.paybackYears), ""],
            ]}
          />
          <p className="mt-1 text-[10px] text-slate-500">
            {d.contributionsAdd ? "Each upgrade's savings are its contribution when the model applies the upgrades one after another (interactions counted), so they add up to the package total; the split depends on the order." : "The upgrades interact, so their individual effects are not additive; the package total is computed with all of them together."}
          </p>
          <H3>Cumulative net benefit, years 0 to 10</H3>
          <Cumulative values={f.cumulative} />
          <Table head={["Year", "Savings", "Cumulative", `NPV at ${pct(f.discountRate)}`]} right={[1, 2, 3]} rows={f.projection.map((y) => [y.year, usd(y.savings), usd(y.cumulative), usd(y.cumulativeNpv)])} />
        </div>
      </Paper>
      <Paper>
        <Band title={d.title} subject={d.hotel.name} />
        <div className="p-5">
          <H2>Assumptions and methodology</H2>
          <List items={d.assumptions} />
          {d.utility && (
            <>
              <H3>Utility data and baseline</H3>
              <Table
                head={["Fuel", "Bills (actual)", "Modeled", "Calibrated", "NMBE / CV before", "NMBE / CV after"]}
                right={[1, 2, 3, 4, 5]}
                rows={d.utility.fuels.map((x) => [
                x.fuel,
                `${Math.round(x.actual).toLocaleString("en-US")} ${x.unit}`,
                `${Math.round(x.modeled).toLocaleString("en-US")} ${x.unit}`,
                x.calibrated_used ? `${Math.round(x.calibrated).toLocaleString("en-US")} ${x.unit}` : "not used",
                x.cvrmseBefore === null ? "-" : `${x.nmbeBefore!.toFixed(1)}% / ${x.cvrmseBefore.toFixed(1)}%`,
                x.cvrmseAfter === null ? "-" : `${x.nmbeAfter!.toFixed(1)}% / ${x.cvrmseAfter.toFixed(1)}%`,
              ])}
              />
              <List
                items={[
              `Source: ${d.utility.source}. Billing period: ${d.utility.billingPeriod}.`,
              `Baseline used in this report: ${d.utility.activeBaseline}.`,
              ...d.utility.fuels.filter((x) => x.note).map((x) => `${x.fuel}: ${x.note}`),
              "NMBE and CV(RMSE) are ASHRAE Guideline 14 measures of how far the model is from the bills (monthly criteria: within ±5% and 15%).",
              ...d.utility.limits,
            ]}
              />
            </>
          )}
          <H3>Utility incentives</H3>
          <List
            items={[
              d.investment.incentivesApplied > 0 ? `Counted: ${usd(d.investment.incentivesApplied)} from published program rates; pre-approval required, not guaranteed.` : "No incentives are counted in the base case.",
              ...d.investment.incentivesListed.map((x) => `Listed, not counted: ${x.label}.`),
              ...d.investment.illustrative.map((x) => `Illustrative only, NOT in the base case: ${x.label}, ${usd(x.amount)}${x.note ? ` (${x.note})` : ""}.`),
              ...(d.investment.netIfIllustrative !== null ? [`If those were confirmed, the net investment would be ${usd(d.investment.netIfIllustrative)}; no other figure includes them.`] : []),
            ]}
          />
          <H3>Data sources</H3>
          <List items={d.sources} />
          <H2>Risks and limitations</H2>
          <List items={d.risks} />
        </div>
      </Paper>
    </>
  );
}

function PortfolioPreview({ d }: { d: PortfolioReportData }) {
  const t = d.totals;
  return (
    <>
      <Paper>
        <Band title={d.title} subject={d.organization} />
        <div className="p-5">
          <h2 className="text-[22px] font-bold text-[#0B1B33]">{d.organization}</h2>
          <p className="text-slate-500">{d.title} · {d.current.hotels} hotels in {d.city} · objective: {d.objective}</p>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Kpi label="Budget" value={usd(d.budget)} note={`${usd(t.remainingBudget)} left`} />
            <Kpi label="Net investment" value={usd(t.netInvestment)} note={`${usd(t.grossCost)} installed`} />
            <Kpi label="Estimated annual savings" value={usd(t.annualSavings)} note={`${pct(t.shareOfPortfolioCost)} of the bill`} tone="good" />
            <Kpi label="Pays for itself in" value={yrs(t.paybackYears)} />
            <Kpi label="NPV, 5 years" value={usd(t.npv5)} tone={t.npv5 < 0 ? "bad" : undefined} />
            <Kpi label="NPV, 10 years" value={usd(t.npv10)} tone={t.npv10 < 0 ? "bad" : "good"} />
            <Kpi label="Carbon avoided" value={`${num(t.carbonAvoidedKg / 1000, 1)} t CO2e`} note="a year" />
            <Kpi label="Portfolio energy spend" value={usd(d.current.cost)} />
          </div>
          <Verdict v={d.interpretation} />
          <H2>Investment by property</H2>
          <Table head={["Hotel", "Package", "Net investment", "Saves / yr", "Payback", "NPV 10 yr"]} right={[2, 3, 4, 5]} rows={[...d.allocations.map((a) => [a.name, a.packageName ?? "Nothing within budget", usd(a.netInvestment), usd(a.annualSavings), a.paybackYears === null ? "-" : `${a.paybackYears.toFixed(1)} yr`, usd(a.npv10)]), ["Portfolio", "", usd(t.netInvestment), usd(t.annualSavings), yrs(t.paybackYears), usd(t.npv10)]]} />
          <H3>Annual savings by property</H3>
          <Bars items={d.allocations.map((a) => ({ label: a.name, value: a.annualSavings }))} color="#059669" />
        </div>
      </Paper>
      <Paper>
        <Band title={d.title} subject={d.organization} />
        <div className="p-5">
          <H2>Assumptions and methodology</H2>
          <List items={d.assumptions} />
          <H2>Risks and limitations</H2>
          <List items={d.risks} />
        </div>
      </Paper>
    </>
  );
}

export function ReportPreview({ data }: { data: ReportData }) {
  return data.kind === "portfolio" ? <PortfolioPreview d={data} /> : <HotelPreview d={data} />;
}
