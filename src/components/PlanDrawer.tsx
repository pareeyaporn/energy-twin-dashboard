import { motion } from "framer-motion";
import { ChevronUp, Copy, Download, Link2, Sparkles } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip as RTooltip, XAxis, YAxis, Legend } from "recharts";
import { Button } from "@/components/ui/button";
import { useTwin, selectActivePackage } from "@/store/useTwin";
import { toast } from "sonner";
import { hotelWording } from "@/lib/presentation";

const axis = { stroke: "var(--text-muted)", fontSize: 11, tickLine: false, axisLine: false };
const tip = { contentStyle: { background: "var(--panel)", border: "1px solid var(--glass-border)", borderRadius: 12, fontSize: 12 }, cursor: { fill: "var(--muted)" } };

export function PlanDrawer() {
  const { drawerOpen, setDrawerOpen } = useTwin();
  const pkg = useTwin(selectActivePackage);
  const cumulative = pkg ? Array.from({ length: 16 }, (_, y) => ({ year: y, value: y * pkg.savings - pkg.cost })) : [];
  const summary = pkg ? `${hotelWording(pkg.name)}: costs $${pkg.cost.toLocaleString()}, saves about $${pkg.savings}/yr, pays back in ${pkg.payback} years.` : "";

  return (
    <motion.div initial={false} animate={{ height: drawerOpen ? "45vh" : 56 }} transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className="glass absolute inset-x-0 bottom-0 z-20 flex flex-col overflow-hidden rounded-t-2xl bg-panel/85">
      <button type="button" onClick={() => setDrawerOpen(!drawerOpen)} aria-expanded={drawerOpen} className="flex h-14 shrink-0 items-center gap-3 px-5 text-left">
        <span className="font-semibold">Your Plan</span>
        <span className="truncate text-sm text-muted-foreground">{pkg ? hotelWording(pkg.name) : "Pick a package to build your plan"}</span>
        {pkg && <span className="num shrink-0 rounded-full bg-savings/15 px-2.5 py-0.5 text-xs font-medium text-savings">Save ${pkg.savings}/yr</span>}
        <ChevronUp className={`ml-auto h-4 w-4 shrink-0 transition-transform duration-300 ${drawerOpen ? "rotate-180" : ""}`} />
      </button>
      {drawerOpen && (
        !pkg ? (
          <div className="grid flex-1 place-items-center text-sm text-text-muted">No plan yet — run “Find my best upgrades” and choose a package.</div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col gap-3 px-5 pb-4">
            <div className="grid min-h-0 flex-1 grid-cols-3 gap-4">
              <div className="flex min-h-0 flex-col gap-2 rounded-xl border border-glass-border p-3">
                <p className="label-caps text-[11px]">Now vs with plan ($/yr)</p>
                <div className="min-h-0 flex-1"><ResponsiveContainer><BarChart data={pkg.breakdown}><CartesianGrid stroke="var(--border)" vertical={false} /><XAxis dataKey="category" {...axis} /><YAxis {...axis} width={36} /><RTooltip {...tip} /><Legend wrapperStyle={{ fontSize: 11 }} /><Bar dataKey="now" name="Now" fill="var(--chart-1)" radius={4} /><Bar dataKey="plan" name="With plan" fill="var(--chart-2)" radius={4} /></BarChart></ResponsiveContainer></div>
                <p className="label-caps text-[11px]">Cumulative savings, 15 yrs</p>
                <div className="min-h-0 flex-1"><ResponsiveContainer><LineChart data={cumulative}><CartesianGrid stroke="var(--border)" vertical={false} /><XAxis dataKey="year" {...axis} /><YAxis {...axis} width={44} /><RTooltip {...tip} /><ReferenceLine y={0} stroke="var(--text-muted)" /><ReferenceLine x={Math.ceil(pkg.payback)} stroke="var(--savings)" strokeDasharray="3 3" label={{ value: "Payback", fill: "var(--savings)", fontSize: 10, position: "insideTopLeft" }} /><Line dataKey="value" name="Net $" stroke="var(--savings)" strokeWidth={2} dot={false} /></LineChart></ResponsiveContainer></div>
              </div>
              <div className="overflow-y-auto rounded-xl border border-glass-border p-4">
                <p className="label-caps mb-2 text-[11px]">Why this plan</p>
                <p className="text-sm leading-relaxed text-muted-foreground">{hotelWording(pkg.explanation)}</p>
                <p className="mt-3 flex items-center gap-1.5 text-[11px] text-text-muted"><Sparkles className="h-3 w-3 text-primary" />Written by AI from the calculated numbers</p>
              </div>
              <div className="overflow-y-auto rounded-xl border border-glass-border p-4">
                <p className="label-caps mb-2 text-[11px]">What's included</p>
                <ul className="space-y-2">
                  {pkg.items.map((it) => (
                    <li key={it.name} className="rounded-lg bg-glass p-2.5 text-sm">
                      <div className="flex justify-between font-medium"><span>{hotelWording(it.name)}</span><span className="num">${it.cost.toLocaleString()}</span></div>
                      <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
                        <span className="num"><span className="text-savings">${it.savings}/yr</span> · {it.lifetime} yr life</span>
                        <span className="rounded-full border border-glass-border px-1.5 text-[10px]">{it.source}</span>
                      </div>
                    </li>
                  ))}
                </ul>
                <p className="mt-3 text-[11px] text-text-muted">Planning estimate from public data, not a professional energy audit.</p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => { navigator.clipboard?.writeText(summary); toast.success("Summary copied"); }}><Copy />Copy summary</Button>
              <Button variant="ghost" size="sm" onClick={() => toast("PDF download coming soon")}><Download />Download PDF</Button>
              <Button variant="accentOutline" size="sm" onClick={() => { navigator.clipboard?.writeText(location.href); toast.success("Link copied"); }}><Link2 />Share link</Button>
            </div>
          </div>
        )
      )}
    </motion.div>
  );
}
