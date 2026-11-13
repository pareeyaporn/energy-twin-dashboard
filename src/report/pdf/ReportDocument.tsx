// The PDF investment report (react-pdf). Loaded only when a report is generated, so it is not in the main bundle. Every figure comes
// from the report data (`../data.ts`), which the on-screen preview also renders.
import { Document, G, Line, Page, Path, Polyline, Rect, StyleSheet, Svg, Text, View } from "@react-pdf/renderer";
import type { ReactNode } from "react";
import type { HotelReportData, PortfolioReportData, ReportData } from "../data";

const NAVY = "#0B1B33";
const INK = "#1E293B";
const MUTED = "#64748B";
const CYAN = "#0891B2";
const CYAN_LIGHT = "#CFFAFE";
const GREEN = "#059669";
const AMBER = "#D97706";
const RED = "#DC2626";
const RULE = "#E2E8F0";
const PALETTE = [CYAN, "#0E7490", "#38BDF8", "#155E75", "#67E8F9", "#0369A1", "#7DD3FC", "#164E63"];

/** The PDF's standard font has no glyphs for some symbols; use plain equivalents (text stays selectable). */
const t = (s: string) =>
  s.replace(/−/g, "-").replace(/₂/g, "2").replace(/→/g, "to").replace(/≈/g, "about ").replace(/≥/g, ">=").replace(/≤/g, "<=").replace(/–/g, "-").replace(/—/g, " - ");
const usd = (n: number) => `${n < 0 ? "-" : ""}$${Math.round(Math.abs(n)).toLocaleString("en-US")}`;
const num = (n: number, d = 0) => n.toLocaleString("en-US", { maximumFractionDigits: d, minimumFractionDigits: d });
const pct = (r: number) => `${Math.round(r * 100)}%`;
const yrs = (n: number | null) => (n === null ? "No payback" : `${n.toFixed(1)} years`);
const kusd = (n: number) => `${n < 0 ? "-" : ""}$${Math.abs(n) >= 1000 ? `${Math.round(Math.abs(n) / 1000)}k` : Math.round(Math.abs(n))}`;

const st = StyleSheet.create({
  page: { paddingTop: 64, paddingBottom: 54, paddingHorizontal: 44, fontSize: 9.5, color: INK, fontFamily: "Helvetica", lineHeight: 1.35 },
  header: { position: "absolute", top: 0, left: 0, right: 0, height: 40, backgroundColor: NAVY, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 44 },
  brand: { color: "#FFFFFF", fontSize: 11, fontFamily: "Helvetica-Bold" },
  brandAccent: { color: "#22D3EE" },
  headerRight: { color: "#CBD5E1", fontSize: 8 },
  footer: { position: "absolute", bottom: 20, left: 44, right: 44, flexDirection: "row", justifyContent: "space-between", fontSize: 7.5, color: MUTED, borderTopWidth: 0.5, borderTopColor: RULE, paddingTop: 6 },
  h1: { fontSize: 20, fontFamily: "Helvetica-Bold", color: NAVY, marginBottom: 4, lineHeight: 1.15 },
  h2: { fontSize: 13, fontFamily: "Helvetica-Bold", color: NAVY, marginTop: 14, marginBottom: 6 },
  h3: { fontSize: 10, fontFamily: "Helvetica-Bold", color: NAVY, marginTop: 8, marginBottom: 4 },
  sub: { color: MUTED, fontSize: 9 },
  badge: { alignSelf: "flex-start", backgroundColor: CYAN_LIGHT, color: "#155E75", fontSize: 7.5, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 3, marginRight: 4 },
  warnBadge: { alignSelf: "flex-start", backgroundColor: "#FEF3C7", color: "#92400E", fontSize: 7.5, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 3, marginRight: 4 },
  row: { flexDirection: "row" },
  kpiGrid: { flexDirection: "row", flexWrap: "wrap", marginTop: 8, marginHorizontal: -4 },
  kpi: { width: "25%", padding: 4 },
  kpiBox: { borderWidth: 0.75, borderColor: RULE, borderRadius: 4, padding: 7, borderTopWidth: 2.5, borderTopColor: CYAN },
  kpiLabel: { fontSize: 7.5, color: MUTED },
  kpiValue: { fontSize: 13, fontFamily: "Helvetica-Bold", color: NAVY, marginTop: 2 },
  kpiNote: { fontSize: 7, color: MUTED, marginTop: 1 },
  callout: { marginTop: 10, borderLeftWidth: 3, borderLeftColor: CYAN, backgroundColor: "#F0F9FF", padding: 9, borderRadius: 2 },
  table: { borderWidth: 0.5, borderColor: RULE, borderRadius: 3 },
  tr: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: RULE },
  th: { padding: 4, fontSize: 7.5, fontFamily: "Helvetica-Bold", color: MUTED, backgroundColor: "#F8FAFC" },
  td: { padding: 4, fontSize: 8.5 },
  right: { textAlign: "right" },
  bullet: { flexDirection: "row", marginBottom: 2.5 },
  dot: { width: 10, color: CYAN },
  small: { fontSize: 7.5, color: MUTED },
});

function Shell({ children, title, subject, synthetic }: { children: ReactNode; title: string; subject: string; synthetic: boolean }) {
  return (
    <Page size="LETTER" style={st.page} wrap>
      <View style={st.header} fixed>
        <Text style={st.brand}>
          Energy <Text style={st.brandAccent}>Twin</Text>
        </Text>
        <Text style={st.headerRight}>{t(`${title} · ${subject}`)}</Text>
      </View>
      {children}
      <View style={st.footer} fixed>
        <Text>{t(synthetic ? "Modeled estimates · synthetic demonstration data · not an engineering audit" : "Modeled estimates · not an engineering audit or a guarantee of savings")}</Text>
        <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
      </View>
    </Page>
  );
}

function Kpi({ label, value, note, tone }: { label: string; value: string; note?: string | undefined; tone?: "good" | "bad" | undefined }) {
  return (
    <View style={st.kpi} wrap={false}>
      <View style={st.kpiBox}>
        <Text style={st.kpiLabel}>{t(label)}</Text>
        <Text style={[st.kpiValue, tone === "good" ? { color: GREEN } : tone === "bad" ? { color: RED } : {}]}>{t(value)}</Text>
        {note ? <Text style={st.kpiNote}>{t(note)}</Text> : null}
      </View>
    </View>
  );
}

function Bullets({ items }: { items: string[] }) {
  return (
    <View>
      {items.map((s, i) => (
        <View key={i} style={st.bullet} wrap={false}>
          <Text style={st.dot}>•</Text>
          <Text style={{ flex: 1 }}>{t(s)}</Text>
        </View>
      ))}
    </View>
  );
}

type Col = { label: string; w: number; right?: boolean };
function Table({ cols, rows }: { cols: Col[]; rows: (string | number)[][] }) {
  return (
    <View style={st.table}>
      <View style={st.tr} fixed>
        {cols.map((c, i) => (
          <Text key={i} style={[st.th, { width: `${c.w}%` }, c.right ? st.right : {}]}>{t(c.label)}</Text>
        ))}
      </View>
      {rows.map((r, i) => (
        <View key={i} style={[st.tr, i === rows.length - 1 ? { borderBottomWidth: 0 } : {}]} wrap={false}>
          {r.map((v, j) => (
            <Text key={j} style={[st.td, { width: `${cols[j]!.w}%` }, cols[j]!.right ? st.right : {}]}>{t(String(v))}</Text>
          ))}
        </View>
      ))}
    </View>
  );
}

/** Horizontal bars, one per item (values from the report data). */
function HBars({ items, width = 520, format = usd }: { items: { label: string; value: number; color?: string | undefined }[]; width?: number; format?: (n: number) => string }) {
  const rowH = 16;
  const labelW = Math.round(width * 0.36);
  const valueW = 46;
  const max = Math.max(1, ...items.map((i) => Math.abs(i.value)));
  const barW = width - labelW - valueW;
  const h = items.length * rowH + 4;
  return (
    <Svg width={width} height={h}>
      {items.map((it, i) => {
        const w = Math.max(1, (Math.abs(it.value) / max) * barW);
        const y = i * rowH + 3;
        return (
          <G key={i}>
            <Text x={0} y={y + 9} style={{ fontSize: 7.5, fill: INK } as never}>{t(it.label.length > Math.floor(labelW / 4.1) ? `${it.label.slice(0, Math.floor(labelW / 4.1) - 1)}…` : it.label)}</Text>
            <Rect x={labelW} y={y} width={w} height={10} fill={it.value < 0 ? RED : (it.color ?? CYAN)} rx={1.5} />
            <Text x={labelW + w + 4} y={y + 8.5} style={{ fontSize: 7.5, fill: MUTED } as never}>{t(format(it.value))}</Text>
          </G>
        );
      })}
    </Svg>
  );
}

/** Before and after bars for one metric. */
function BeforeAfter({ label, before, after, format, width = 250 }: { label: string; before: number; after: number; format: (n: number) => string; width?: number }) {
  const max = Math.max(1, before, after);
  const barW = width - 110;
  const rows = [
    { k: "Before", v: before, c: "#94A3B8" },
    { k: "After", v: after, c: CYAN },
  ];
  return (
    <View style={{ marginBottom: 6 }} wrap={false}>
      <Text style={{ fontSize: 8, fontFamily: "Helvetica-Bold", color: NAVY, marginBottom: 2 }}>{t(label)}</Text>
      <Svg width={width} height={30}>
        {rows.map((r, i) => (
          <G key={r.k}>
            <Text x={0} y={i * 14 + 9} style={{ fontSize: 7.5, fill: MUTED } as never}>{r.k}</Text>
            <Rect x={36} y={i * 14 + 2} width={Math.max(1, (r.v / max) * barW)} height={10} fill={r.c} rx={1.5} />
            <Text x={36 + Math.max(1, (r.v / max) * barW) + 4} y={i * 14 + 10} style={{ fontSize: 7.5, fill: INK } as never}>{t(format(r.v))}</Text>
          </G>
        ))}
      </Svg>
    </View>
  );
}

/** Cumulative net benefit, year 0 to year 10 (crosses zero at payback). */
function CashFlow({ values, width = 520, height = 150 }: { values: number[]; width?: number; height?: number }) {
  if (values.length < 2) return null;
  const pad = { l: 46, r: 10, t: 8, b: 18 };
  const lo = Math.min(0, ...values);
  const hi = Math.max(0, ...values);
  const span = hi - lo || 1;
  const x = (i: number) => pad.l + (i / (values.length - 1)) * (width - pad.l - pad.r);
  const y = (v: number) => pad.t + ((hi - v) / span) * (height - pad.t - pad.b);
  const pts = values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const area = `M ${x(0)} ${y(0)} ${values.map((v, i) => `L ${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(" ")} L ${x(values.length - 1)} ${y(0)} Z`;
  return (
    <Svg width={width} height={height}>
      <Path d={area} fill={CYAN_LIGHT} />
      <Line x1={pad.l} x2={width - pad.r} y1={y(0)} y2={y(0)} stroke={MUTED} strokeWidth={0.6} strokeDasharray="3 2" />
      <Polyline points={pts} fill="none" stroke={CYAN} strokeWidth={2} />
      {values.map((v, i) => (
        <Rect key={i} x={x(i) - 1.5} y={y(v) - 1.5} width={3} height={3} fill={v < 0 ? RED : GREEN} />
      ))}
      <Text x={2} y={y(hi) + 3} style={{ fontSize: 7, fill: MUTED } as never}>{kusd(hi)}</Text>
      <Text x={2} y={y(0) + 3} style={{ fontSize: 7, fill: MUTED } as never}>$0</Text>
      {lo < 0 ? <Text x={2} y={y(lo) + 3} style={{ fontSize: 7, fill: MUTED } as never}>{kusd(lo)}</Text> : null}
      {values.map((_, i) => (i % 2 === 0 ? <Text key={`y${i}`} x={x(i) - 6} y={height - 4} style={{ fontSize: 7, fill: MUTED } as never}>{`Yr ${i}`}</Text> : null))}
    </Svg>
  );
}

function Verdict({ v }: { v: HotelReportData["interpretation"] }) {
  const color = v.verdict === "attractive" ? GREEN : v.verdict === "marginal" ? AMBER : RED;
  return (
    <View style={[st.callout, { borderLeftColor: color }]} wrap={false}>
      <Text style={{ fontFamily: "Helvetica-Bold", color, marginBottom: 3 }}>{t(v.headline)}</Text>
      {v.sentences.map((s, i) => (
        <Text key={i} style={{ marginBottom: 2 }}>{t(s)}</Text>
      ))}
    </View>
  );
}

function HotelReport({ d, generated }: { d: HotelReportData; generated: string }) {
  const f = d.financial;
  const subject = d.hotel.name;
  return (
    <Document title={`${d.title} - ${d.hotel.name}`} author="Energy Twin" subject={d.planName} creator="Energy Twin">
      <Shell title={d.title} subject={subject} synthetic={d.hotel.synthetic}>
        <Text style={st.h1}>{t(d.hotel.name)}</Text>
        <Text style={st.sub}>{t(`${d.title} · ${d.planLabel} · generated ${generated}`)}</Text>
        <View style={[st.row, { marginTop: 6 }]}>
          <Text style={st.badge}>Modeled estimates</Text>
          {d.hotel.synthetic ? <Text style={st.warnBadge}>Synthetic demonstration hotel</Text> : null}
          {d.measuredAgainst ? <Text style={st.warnBadge}>Measured against a what-if</Text> : null}
        </View>

        <Text style={st.h2}>Executive summary</Text>
        <Text>{t(`Recommended investment: ${d.planName}.`)}</Text>
        <View style={st.kpiGrid}>
          <Kpi label="Net investment" value={usd(d.investment.netInvestment)} note={`${usd(d.investment.grossCost)} installed${d.investment.incentivesApplied > 0 ? `, less ${usd(d.investment.incentivesApplied)} incentives` : ""}`} />
          <Kpi label="Estimated annual savings" value={usd(f.annualSavings)} note={`${usd(f.savingsRange[0])} to ${usd(f.savingsRange[1])}`} tone="good" />
          <Kpi label="Cut in the energy bill" value={pct(f.savingsPctOfBill)} note={`of ${usd(d.current.cost)} a year`} />
          <Kpi label="Pays for itself in" value={yrs(f.paybackYears)} note="simple payback" />
          <Kpi label="NPV, 5 years" value={usd(f.npv5)} note={`at ${pct(f.discountRate)} a year`} tone={f.npv5 < 0 ? "bad" : undefined} />
          <Kpi label="NPV, 10 years" value={usd(f.npv10)} note={`at ${pct(f.discountRate)} a year`} tone={f.npv10 < 0 ? "bad" : "good"} />
          <Kpi label="Carbon avoided" value={`${num(d.environment.carbonKgAvoided / 1000, 1)} t CO2e`} note={`${pct(d.environment.carbonPct)} of emissions a year`} />
          <Kpi label="Budget left" value={usd(d.investment.remainingBudget)} note={`of ${usd(d.budget)}${d.investment.overBudget ? " (over budget)" : ""}`} tone={d.investment.overBudget ? "bad" : undefined} />
        </View>
        <Verdict v={d.interpretation} />

        <Text style={st.h2}>Property overview</Text>
        <Table
          cols={[{ label: "Item", w: 30 }, { label: "Value", w: 70 }]}
          rows={[
            ["Location", d.hotel.location || "-"],
            ["Rooms", num(d.hotel.rooms)],
            ["Floor area", `${num(d.hotel.floorAreaSqft)} ft²`],
            ["Year built", String(d.hotel.yearBuilt)],
            ["Heating and cooling", d.hotel.hvac],
            ["Average occupancy", `${d.hotel.occupancyPct}%`],
            ["Energy prices", `$${d.hotel.electricityRate.toFixed(4)} per kWh · $${d.hotel.gasRate.toFixed(3)} per therm`],
            ["Plan", d.planLabel],
          ]}
        />

        <View break>
          <Text style={st.h2}>Current energy performance</Text>
        </View>
        <View style={st.kpiGrid}>
          <Kpi label="Energy spending" value={usd(d.current.cost)} note="a year" />
          <Kpi label="Electricity" value={`${num(d.current.elecKWh)} kWh`} note={`${usd(d.current.elecCost)} a year`} />
          <Kpi label="Natural gas" value={`${num(d.current.gasTherms)} therms`} note={`${usd(d.current.gasCost)} a year`} />
          <Kpi label="Energy intensity" value={`${num(d.current.siteEui, 1)} kBtu/ft²`} note={`${num(d.current.carbonKg / 1000, 0)} t CO2e a year`} />
        </View>
        <Text style={st.h3}>Where the money goes (modeled cost by use)</Text>
        <HBars items={d.current.byCategory.map((c, i) => ({ label: `${c.label} (${pct(c.share)})`, value: c.cost, color: PALETTE[i % PALETTE.length] }))} />
        <Text style={st.h3}>Key cost drivers by area of the hotel</Text>
        <HBars items={d.current.byZone.slice(0, 6).map((c) => ({ label: `${c.label} (${pct(c.share)})`, value: c.cost }))} />

        <Text style={st.h2}>Before and after the upgrades</Text>
        <Table
          cols={[{ label: "Measure", w: 28 }, { label: "Before", w: 18, right: true }, { label: "After", w: 18, right: true }, { label: "Change", w: 20, right: true }, { label: "Change %", w: 16, right: true }]}
          rows={d.comparison.map((c) => {
            const fmt = (v: number) => (c.unit.startsWith("$") ? usd(v) : num(v, c.unit.startsWith("kBtu") || c.unit.startsWith("t") ? 1 : 0));
            return [`${c.label} (${c.unit})`, fmt(c.before), fmt(c.after), `${c.change > 0 ? "+" : ""}${fmt(c.change)}`, c.changePct === null ? "-" : `${c.changePct > 0 ? "+" : ""}${(c.changePct * 100).toFixed(1)}%`];
          })}
        />
        <View style={[st.row, { marginTop: 8, justifyContent: "space-between" }]} wrap={false}>
          <BeforeAfter label="Energy spending ($ a year)" before={d.current.cost} after={d.after.cost} format={usd} />
          <BeforeAfter label="Carbon (t CO2e a year)" before={d.current.carbonKg / 1000} after={d.after.carbonKg / 1000} format={(v) => num(v, 1)} />
        </View>
        <View style={[st.row, { justifyContent: "space-between" }]} wrap={false}>
          <BeforeAfter label="Electricity (kWh a year)" before={d.current.elecKWh} after={d.after.elecKWh} format={(v) => num(v)} />
          <BeforeAfter label="Natural gas (therms a year)" before={d.current.gasTherms} after={d.after.gasTherms} format={(v) => num(v)} />
        </View>

        <View break>
          <Text style={st.h2}>Investment analysis</Text>
        </View>
        <Table
          cols={[{ label: "Upgrade", w: 22 }, { label: "Quantity", w: 24 }, { label: "Installed", w: 11, right: true }, { label: "Incentive", w: 11, right: true }, { label: "Saves / yr", w: 11, right: true }, { label: "Payback", w: 12, right: true }, { label: "Life", w: 9, right: true }]}
          rows={[
            ...d.upgrades.map((u) => [
              u.label,
              u.quantity,
              usd(u.installedCost),
              u.incentives.some((x) => x.applied) ? usd(u.incentives.filter((x) => x.applied).reduce((s, x) => s + x.amount, 0)) : "-",
              usd(u.annualSavings),
              u.paybackYears === null ? "-" : `${u.paybackYears.toFixed(1)} yr${u.paybackBeyondLife ? "*" : ""}`,
              `${u.lifetimeYears} yr`,
            ]),
            ["Package total", "", usd(d.investment.grossCost), d.investment.incentivesApplied > 0 ? usd(d.investment.incentivesApplied) : "-", usd(f.annualSavings), yrs(f.paybackYears).replace(" years", " yr"), ""],
          ]}
        />
        <Text style={[st.small, { marginTop: 3 }]}>
          {t(
            d.contributionsAdd
              ? "Each upgrade's savings are its contribution when the model applies the upgrades one after another (interactions counted, for example LED lighting adding a little heating), so they add up to the package total; the split depends on the order. Line payback = installed cost / contribution, before incentives."
              : "The upgrades interact, so their individual effects are not additive; the package total is computed with all of them together.",
          )}
          {d.upgrades.some((u) => u.paybackBeyondLife) ? t(" * Payback longer than the equipment's expected life.") : ""}
        </Text>
        <View style={[st.row, { marginTop: 6, justifyContent: "space-between" }]} wrap={false}>
          <View style={{ width: "49%" }}>
            <Text style={st.h3}>Investment by upgrade</Text>
            <HBars width={250} items={d.upgrades.map((u, i) => ({ label: u.label, value: u.installedCost, color: PALETTE[i % PALETTE.length] }))} format={kusd} />
          </View>
          <View style={{ width: "49%" }}>
            <Text style={st.h3}>Annual savings by upgrade</Text>
            <HBars width={250} items={d.upgrades.map((u) => ({ label: u.label, value: u.annualSavings, color: GREEN }))} format={kusd} />
          </View>
        </View>
        {d.upgrades.length > 0 ? (
          <View>
            <Text style={st.h3}>What each upgrade involves</Text>
            {d.upgrades.map((u) => (
              <View key={u.id} style={{ marginBottom: 4 }} wrap={false}>
                <Text style={{ fontFamily: "Helvetica-Bold" }}>{t(`${u.label} · ${u.quantity}`)}</Text>
                {u.description ? <Text>{t(u.description)}</Text> : null}
                <Text style={st.small}>{t(`Installed cost ${usd(u.costRange[0])} to ${usd(u.costRange[1])} (mid ${usd(u.installedCost)}); expected life ${u.lifetimeYears} years.${u.incentives.length ? ` Incentives: ${u.incentives.map((x) => `${x.label} ${x.applied ? usd(x.amount) : "(listed, not counted)"}`).join("; ")}.` : ""}`)}</Text>
              </View>
            ))}
          </View>
        ) : null}
        <View wrap={false}>
          <Text style={st.h3}>Cumulative net benefit, years 0 to 10 (crosses $0 at payback)</Text>
          <CashFlow values={f.cumulative} height={120} />
          <View style={[st.row, { justifyContent: "space-between", marginTop: 4 }]}>
            {[f.projection.slice(0, 5), f.projection.slice(5)].map((part, k) => (
              <View key={k} style={{ width: "49.3%" }}>
                <Table
                  cols={[{ label: "Year", w: 14 }, { label: "Savings", w: 28, right: true }, { label: "Cumulative", w: 30, right: true }, { label: `NPV at ${pct(f.discountRate)}`, w: 28, right: true }]}
                  rows={part.map((y) => [String(y.year), usd(y.savings), usd(y.cumulative), usd(y.cumulativeNpv)])}
                />
              </View>
            ))}
          </View>
        </View>

        <View break>
          <Text style={st.h2}>Assumptions and methodology</Text>
        </View>
        <Text style={{ marginBottom: 4 }}>
          {t("Energy Twin simulates the hotel's energy use by zone, end use and month from its characteristics, local weather normals, occupancy and published benchmarks, then applies each upgrade to that simulation and prices the result with the hotel's energy prices. Financial results use one common breakdown for every plan.")}
        </Text>
        <Bullets items={d.assumptions} />
        {d.equipment && (
          <>
            <Text style={st.h3}>Current equipment</Text>
            <Text style={{ marginBottom: 2 }}>{t(d.equipment.note)}</Text>
            <Bullets items={d.equipment.lines} />
          </>
        )}
        <Text style={st.h3}>Utility incentives</Text>
        <Bullets
          items={[
            ...(d.investment.incentivesApplied > 0 ? [`Counted: ${usd(d.investment.incentivesApplied)} from published program rates (program year and rules in the sources); pre-approval required, not guaranteed.`] : ["No incentives are counted in the base case."]),
            ...d.investment.incentivesListed.map((x) => `Listed, not counted: ${x.label}.`),
            ...d.investment.illustrative.map((x) => `Illustrative only, NOT in the base case: ${x.label}, ${usd(x.amount)}${x.note ? ` (${x.note})` : ""}.`),
            ...(d.investment.netIfIllustrative !== null ? [`If those were confirmed, the net investment would be ${usd(d.investment.netIfIllustrative)} instead of ${usd(d.investment.netInvestment)}; no other figure in this report includes them.`] : []),
          ]}
        />
        <Text style={st.h3}>Data sources</Text>
        <Bullets items={d.sources} />
        <Text style={st.h2}>Risks and limitations</Text>
        <Bullets items={d.risks} />
        <View style={[st.callout, { marginTop: 12 }]} wrap={false}>
          <Text style={{ fontFamily: "Helvetica-Bold", color: NAVY }}>Recommendation</Text>
          <Text>{t(`${d.interpretation.headline} ${d.interpretation.verdict === "unattractive" ? "We do not recommend proceeding on these figures; consider a different package or a larger share of incentives." : "Validate the scope and quotes with an energy audit or a qualified engineer before committing capital."}`)}</Text>
        </View>
      </Shell>
    </Document>
  );
}

function PortfolioReport({ d, generated }: { d: PortfolioReportData; generated: string }) {
  const t0 = d.totals;
  return (
    <Document title={`${d.title} - ${d.organization}`} author="Energy Twin" creator="Energy Twin">
      <Shell title={d.title} subject={d.organization} synthetic={d.synthetic}>
        <Text style={st.h1}>{t(d.organization)}</Text>
        <Text style={st.sub}>{t(`${d.title} · ${d.current.hotels} hotels in ${d.city} · objective: ${d.objective} · generated ${generated}`)}</Text>
        <View style={[st.row, { marginTop: 6 }]}>
          <Text style={st.badge}>Modeled estimates</Text>
          {d.synthetic ? <Text style={st.warnBadge}>Synthetic demonstration portfolio</Text> : null}
        </View>
        <Text style={st.h2}>Executive summary</Text>
        <View style={st.kpiGrid}>
          <Kpi label="Budget" value={usd(d.budget)} note={`${usd(t0.remainingBudget)} left`} />
          <Kpi label="Net investment" value={usd(t0.netInvestment)} note={`${usd(t0.grossCost)} installed, less ${usd(t0.incentives)} incentives`} />
          <Kpi label="Estimated annual savings" value={usd(t0.annualSavings)} note={`${pct(t0.shareOfPortfolioCost)} of the portfolio's bill`} tone="good" />
          <Kpi label="Pays for itself in" value={yrs(t0.paybackYears)} note="portfolio simple payback" />
          <Kpi label="NPV, 5 years" value={usd(t0.npv5)} note={`at ${pct(d.discountRate)}`} tone={t0.npv5 < 0 ? "bad" : undefined} />
          <Kpi label="NPV, 10 years" value={usd(t0.npv10)} note={`at ${pct(d.discountRate)}`} tone={t0.npv10 < 0 ? "bad" : "good"} />
          <Kpi label="Carbon avoided" value={`${num(t0.carbonAvoidedKg / 1000, 1)} t CO2e`} note="a year" />
          <Kpi label="Portfolio energy spend" value={usd(d.current.cost)} note={`${num(d.current.siteEui, 1)} kBtu/ft² on average`} />
        </View>
        <Verdict v={d.interpretation} />
        <Text style={st.h2}>Investment by property</Text>
        <Table
          cols={[{ label: "Hotel", w: 20 }, { label: "Package", w: 30 }, { label: "Net investment", w: 13, right: true }, { label: "Saves / yr", w: 12, right: true }, { label: "Payback", w: 11, right: true }, { label: "NPV 10 yr", w: 14, right: true }]}
          rows={[
            ...d.allocations.map((a) => [a.name, a.packageName ?? "Nothing within budget", usd(a.netInvestment), usd(a.annualSavings), a.paybackYears === null ? "-" : `${a.paybackYears.toFixed(1)} yr`, usd(a.npv10)]),
            ["Portfolio", "", usd(t0.netInvestment), usd(t0.annualSavings), yrs(t0.paybackYears).replace(" years", " yr"), usd(t0.npv10)],
          ]}
        />
        <View style={[st.row, { marginTop: 8, justifyContent: "space-between" }]} wrap={false}>
          <View style={{ width: "49%" }}>
            <Text style={st.h3}>Investment by property</Text>
            <HBars width={250} items={d.allocations.map((a, i) => ({ label: a.name, value: a.netInvestment, color: PALETTE[i % PALETTE.length] }))} format={kusd} />
          </View>
          <View style={{ width: "49%" }}>
            <Text style={st.h3}>Annual savings by property</Text>
            <HBars width={250} items={d.allocations.map((a) => ({ label: a.name, value: a.annualSavings, color: GREEN }))} format={kusd} />
          </View>
        </View>
        <Text style={st.h3}>Current performance and investment priority</Text>
        <Table
          cols={[{ label: "Hotel", w: 34 }, { label: "Rooms", w: 12, right: true }, { label: "Energy cost / yr", w: 20, right: true }, { label: "kBtu / ft²", w: 16, right: true }, { label: "Priority", w: 18, right: true }]}
          rows={d.properties.map((p) => [p.name, num(p.rooms), usd(p.cost), num(p.siteEui, 1), `${p.priorityScore} of 100`])}
        />
        <View break>
          <Text style={st.h2}>Assumptions and methodology</Text>
        </View>
        <Bullets items={d.assumptions} />
        <Text style={st.h3}>Data sources</Text>
        <Bullets items={d.sources} />
        <Text style={st.h2}>Risks and limitations</Text>
        <Bullets items={d.risks} />
      </Shell>
    </Document>
  );
}

export function ReportDocument({ data, generated }: { data: ReportData; generated: string }) {
  return data.kind === "portfolio" ? <PortfolioReport d={data} generated={generated} /> : <HotelReport d={data} generated={generated} />;
}
