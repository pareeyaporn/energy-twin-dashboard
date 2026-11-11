import { Eye } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Package } from "@/store/useTwin";
import { InfoTip } from "./InfoTip";

const usd = (n: number) => `$${Math.abs(n).toLocaleString()}`;

export function PackageCard({ pkg, rank, active, onSelect, onPreview }: { pkg: Package; rank: number; active: boolean; onSelect: () => void; onPreview: () => void }) {
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: rank * 0.1, duration: 0.35 }}
      role="button" tabIndex={0} aria-pressed={active} onClick={onSelect} onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onSelect())}
      className={cn("lift cursor-pointer rounded-xl border p-4", active ? "border-primary bg-primary/5 shadow-glow" : "border-glass-border bg-glass hover:border-input")}>
      <div className="flex items-start gap-3">
        <span className={cn("num grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-semibold", rank === 1 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>{rank}</span>
        <div className="min-w-0 flex-1">
          {rank === 1 && <span className="mb-1 inline-block rounded-full bg-savings/15 px-2 py-0.5 text-[11px] font-medium text-savings">Best match</span>}
          <h3 className="font-semibold leading-snug">{pkg.name}</h3>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {pkg.upgrades.map((u) => <span key={u} className="rounded-full border border-glass-border px-2 py-0.5 text-[11px] text-muted-foreground">{u}</span>)}
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
        <div><dt className="label-caps text-[11px]">Cost</dt><dd className="num font-semibold"><InfoTip text="Total upfront price to install everything in this package.">{usd(pkg.cost)}</InfoTip></dd></div>
        <div><dt className="label-caps text-[11px]">Saves</dt><dd className="num font-semibold text-savings"><InfoTip text="Likely range of how much less you'd pay each year.">{usd(pkg.savingsRange[0])}–{usd(pkg.savingsRange[1])}/yr</InfoTip></dd></div>
        <div><dt className="label-caps text-[11px]">Payback</dt><dd className="num font-semibold"><InfoTip text="Years until savings add up to what you paid.">{pkg.payback} yrs</InfoTip></dd></div>
        <div><dt className="label-caps text-[11px]">15-yr value</dt><dd className={cn("num font-semibold", pkg.value15 >= 0 ? "text-savings" : "text-loss")}><InfoTip text="Total savings over 15 years minus the upfront cost. Positive means you come out ahead.">{pkg.value15 >= 0 ? "+" : "−"}{usd(pkg.value15)}</InfoTip></dd></div>
      </dl>
      <p className="mt-3 text-xs text-muted-foreground">{pkg.reason}</p>
      <Button variant="ghost" size="sm" className="mt-2 -ml-2 text-primary" onClick={(e) => { e.stopPropagation(); onPreview(); }}><Eye />Preview on house</Button>
    </motion.div>
  );
}
