import { ArrowDown, ArrowRight, ArrowUp, ArrowUpDown, Info } from "lucide-react";
import { useTwin } from "@/store/useTwin";
import type { PropertySummary } from "@/engine/hotel";
import { usd } from "@/twin/format";
import { UtilityBadge } from "@/utility/UtilityBadge";
import { startHere } from "./priority";

type Col = {
  id: string;
  label: string;
  /** Shown under the label (units or what the column means). */
  hint?: string;
  value: (r: PropertySummary) => number | string;
  show: (r: PropertySummary) => string;
  numeric?: boolean;
};

const COLS: Col[] = [
  { id: "name", label: "Property", value: (r) => r.name, show: (r) => r.name },
  { id: "cost", label: "Energy cost", hint: "per year", value: (r) => r.annual.cost, show: (r) => usd(r.annual.cost), numeric: true },
  { id: "eui", label: "Intensity", hint: "kBtu/ft² · yr", value: (r) => r.siteEui, show: (r) => r.siteEui.toFixed(1), numeric: true },
  { id: "pot", label: "Savings potential", hint: "own best package, / yr", value: (r) => r.potential?.annualSavings ?? 0, show: (r) => (r.potential ? usd(r.potential.annualSavings) : "—"), numeric: true },
  { id: "inv", label: "Investment required", hint: "net of incentives", value: (r) => r.potential?.netInvestment ?? 0, show: (r) => (r.potential ? usd(r.potential.netInvestment) : "—"), numeric: true },
  { id: "pay", label: "Payback", hint: "years", value: (r) => r.potential?.paybackYears ?? Infinity, show: (r) => (r.potential?.paybackYears != null ? `${r.potential.paybackYears.toFixed(1)} yr` : "—"), numeric: true },
  { id: "prio", label: "Priority", hint: "score, 0–100", value: (r) => r.priorityScore, show: (r) => `${r.priorityScore}`, numeric: true },
];

/**
 * Every property side by side: click a header to sort (by cost, intensity, savings, priority or any column); the sort is kept when you
 * visit a hotel and come back, and the hotel you last opened is highlighted. The top investment opportunity is marked. Savings potential is
 * each hotel's own best package (not what the shared budget funds). Hotel names open the hotel.
 */
export function PortfolioTable({ rows, onExplore, onRemove, onWhy }: { rows: PropertySummary[]; onExplore: (id: string) => void; onRemove?: (id: string) => void; onWhy?: () => void }) {
  const sort = useTwin((s) => s.portfolioView.tableSort);
  const last = useTwin((s) => s.portfolioView.selectedId);
  const setView = useTwin((s) => s.setPortfolioView);
  const setSort = (f: (s: { id: string; dir: 1 | -1 }) => { id: string; dir: 1 | -1 }) => setView({ tableSort: f(sort) });
  const col = COLS.find((c) => c.id === sort.id) ?? COLS[COLS.length - 1]!;
  const sorted = [...rows].sort((a, b) => {
    const x = col.value(a);
    const y = col.value(b);
    const c = typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y));
    return c * sort.dir || a.name.localeCompare(b.name);
  });
  const topId = startHere(rows)?.top.id ?? null;
  const maxPot = Math.max(0, ...rows.map((r) => r.potential?.annualSavings ?? 0));
  return (
    <div className="space-y-2">
      <div className="table-scroll relative overflow-x-auto rounded-2xl border border-glass-border bg-card/30">
        <table className="sticky-first-column w-full min-w-[820px] text-sm" data-testid="portfolio-table">
          <caption className="sr-only">Portfolio comparison (synthetic demonstration properties, modeled estimates)</caption>
          <thead>
            <tr className="border-b border-glass-border text-xs text-muted-foreground">
              {COLS.map((c) => {
                const on = c.id === sort.id;
                return (
                  <th key={c.id} scope="col" aria-sort={on ? (sort.dir === 1 ? "ascending" : "descending") : "none"} className={`px-4 py-3 align-bottom font-medium ${c.numeric ? "text-right" : "text-left"}`}>
                    <span className={`inline-flex items-center gap-1 ${c.numeric ? "flex-row-reverse" : ""}`}>
                      <button
                        type="button"
                        className={`group inline-flex items-center gap-1 rounded transition-colors hover:text-foreground ${on ? "text-foreground" : ""}`}
                        onClick={() => setSort((s) => ({ id: c.id, dir: s.id === c.id ? (s.dir === 1 ? -1 : 1) : c.numeric ? -1 : 1 }))}
                        data-testid={`sort-${c.id}`}
                      >
                        {c.label}
                        {on ? (
                          sort.dir === 1 ? <ArrowUp className="size-3 text-primary" /> : <ArrowDown className="size-3 text-primary" />
                        ) : (
                          <ArrowUpDown className="size-3 opacity-0 transition-opacity group-hover:opacity-60" aria-hidden />
                        )}
                      </button>
                      {c.id === "prio" && onWhy && (
                        <button type="button" onClick={onWhy} className="inline-flex text-muted-foreground hover:text-primary" aria-label="How investment priority is ranked" data-testid="priority-info">
                          <Info className="size-3" />
                        </button>
                      )}
                    </span>
                    {c.hint && <span className="block text-[11px] font-normal text-muted-foreground/70">{c.hint}</span>}
                  </th>
                );
              })}
              <th className="px-4 py-3"><span className="sr-only">Open</span></th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => {
              const isLast = r.id === last;
              const isTop = r.id === topId;
              return (
                <tr
                  key={r.id}
                  className={`border-b border-glass-border/60 transition-colors last:border-0 motion-reduce:transition-none ${
                    isLast ? "bg-primary/[0.09] hover:bg-primary/[0.12]" : isTop ? "bg-primary/[0.035] hover:bg-foreground/[0.04]" : "hover:bg-foreground/[0.04]"
                  }`}
                  data-testid="portfolio-row"
                  data-last={isLast ? "true" : undefined}
                  data-top={isTop ? "true" : undefined}
                >
                  {COLS.map((c) => (
                    <td key={c.id} className={`px-4 py-3 ${c.numeric ? "num text-right" : ""} ${c.id === "name" ? "font-medium" : ""}`}>
                      {c.id === "name" ? (
                        <span className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1">
                          {isLast && <span className="-ml-2 mr-0.5 h-5 w-0.5 rounded-full bg-primary" aria-hidden />}
                          <button type="button" className="text-left transition-colors hover:text-primary hover:underline" onClick={() => onExplore(r.id)} data-testid={`table-open-${r.id}`}>
                            {c.show(r)}
                          </button>
                          {isTop && <span className="rounded-full border border-primary/40 px-1.5 text-[10px] font-medium text-primary" title="Top investment opportunity (highest priority score)">Top</span>}
                          {!r.synthetic && <span className="rounded-full border border-primary/40 px-1.5 text-[10px] font-normal text-primary">Your hotel</span>}
                          <UtilityBadge propertyId={r.id} />
                        </span>
                      ) : c.id === "pot" ? (
                        <span className="inline-flex flex-col items-end gap-1">
                          <span className="text-savings">{c.show(r)}</span>
                          <span className="block h-1 w-20 overflow-hidden rounded-full bg-foreground/10" aria-hidden>
                            <span className="block h-full rounded-full bg-savings/80" style={{ width: `${maxPot > 0 ? ((r.potential?.annualSavings ?? 0) / maxPot) * 100 : 0}%` }} />
                          </span>
                        </span>
                      ) : c.id === "prio" ? (
                        <span className="inline-flex items-center justify-end gap-2" aria-label={`Priority score ${r.priorityScore} of 100`}>
                          <span className="hidden h-1.5 w-12 overflow-hidden rounded-full bg-foreground/10 sm:block" aria-hidden>
                            <span className="block h-full rounded-full bg-primary" style={{ width: `${r.priorityScore}%` }} />
                          </span>
                          <span className={`w-7 font-semibold ${isTop ? "text-primary" : ""}`}>{c.show(r)}</span>
                        </span>
                      ) : (
                        c.show(r)
                      )}
                    </td>
                  ))}
                  <td className="px-4 py-3 text-right">
                    <button type="button" className="inline-flex items-center gap-1 whitespace-nowrap text-xs font-medium text-primary hover:underline" onClick={() => onExplore(r.id)}>
                      Analyze <ArrowRight className="size-3" aria-hidden />
                    </button>
                    {!r.synthetic && onRemove && (
                      <button type="button" className="ml-3 whitespace-nowrap text-xs text-muted-foreground hover:text-loss hover:underline" onClick={() => onRemove(r.id)} aria-label={`Remove ${r.name}`}>Remove</button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="px-1 text-xs text-muted-foreground">
        Savings potential is each hotel's own best package within its own budget, not what the portfolio budget funds (see Plan your portfolio
        investments). Modeled estimates.
      </p>
    </div>
  );
}
