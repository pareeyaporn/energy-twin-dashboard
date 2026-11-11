import { useEffect, useState } from "react";
import { ChevronDown, Loader2, Sparkles } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Label } from "@/components/ui/label";
import { useTwin } from "@/store/useTwin";
import { GoalCards } from "./GoalCards";
import { PackageCard } from "./PackageCard";
import { AnimatedNumber } from "./AnimatedNumber";

function Ticker() {
  const [n, setN] = useState(1);
  useEffect(() => { const t = setInterval(() => setN((v) => Math.min(32, v + 1)), 60); return () => clearInterval(t); }, []);
  return <span className="num">{n}</span>;
}

export function OptimizePanel() {
  const s = useTwin();
  const [openA, setOpenA] = useState(false);
  return (
    <div className="flex h-full flex-col">
      <h2 className="px-6 pt-6 text-xl font-semibold">Optimize</h2>
      <div className="flex-1 space-y-6 overflow-y-auto px-6 py-5">
        <section className="space-y-3">
          <p className="label-caps">Your budget</p>
          <AnimatedNumber value={s.budget} prefix="$" className="block text-3xl font-semibold tracking-tight" />
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
            <Input aria-label="Budget in dollars" type="number" min={2000} max={40000} step={500} className="num pl-6" value={s.budget}
              onChange={(e) => s.setBudget(Math.max(0, Math.min(40000, Number(e.target.value) || 0)))} />
          </div>
          <Slider aria-label="Budget" min={2000} max={40000} step={500} value={[s.budget]} onValueChange={([v]) => s.setBudget(v)} />
          <div className="num flex justify-between text-[11px] text-text-muted"><span>$2,000</span><span>$40,000</span></div>
        </section>
        <section className="space-y-3"><p className="label-caps">What matters most</p><GoalCards /></section>
        <section>
          <button type="button" onClick={() => setOpenA(!openA)} aria-expanded={openA} className="label-caps flex w-full items-center justify-between">
            Assumptions<ChevronDown className={`h-4 w-4 transition-transform duration-300 ${openA ? "rotate-180" : ""}`} />
          </button>
          <AnimatePresence initial={false}>
            {openA && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3 }} className="overflow-hidden">
                <div className="space-y-4 pt-4">
                  <div className="grid gap-2">
                    <Label className="text-xs text-muted-foreground">Electricity price growth per year</Label>
                    <ToggleGroup type="single" value={String(s.assumptions.priceGrowth)} onValueChange={(v) => v && s.setAssumptions({ priceGrowth: Number(v) })} className="glass grid grid-cols-3 rounded-lg p-1">
                      {[0, 2, 4].map((g) => <ToggleGroupItem key={g} value={String(g)} className="h-8 text-xs data-[state=on]:bg-primary/15 data-[state=on]:text-primary">{g}%</ToggleGroupItem>)}
                    </ToggleGroup>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="disc" className="text-xs text-muted-foreground">Discount rate (%)</Label>
                    <Input id="disc" type="number" step={0.5} min={0} max={15} className="num" value={s.assumptions.discountRate} onChange={(e) => s.setAssumptions({ discountRate: Number(e.target.value) || 0 })} />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </section>
        <Button variant="accent" size="lg" className="shimmer h-12 w-full text-base" onClick={s.runOptimize} disabled={s.optimizing}>
          {s.optimizing ? <><Loader2 className="animate-spin" />Testing <Ticker /> of 32 combinations…</> : <><Sparkles />Find my best upgrades</>}
        </Button>
        <section aria-live="polite" className="space-y-3">
          {s.optimizing && [0, 1, 2].map((i) => <div key={i} className="h-40 animate-pulse rounded-xl bg-glass" />)}
          {!s.optimizing && s.results.length === 0 && (
            <p className="rounded-xl border border-dashed border-glass-border p-4 text-center text-xs text-text-muted">Set your budget and goal, then find your best upgrades.</p>
          )}
          {s.results.length > 0 && (
            <>
              <p className="label-caps">Top 3 packages</p>
              {s.results.map((p, i) => (
                <PackageCard key={p.id} pkg={p} rank={i + 1} active={s.activePackageId === p.id}
                  onSelect={() => s.setActivePackage(p.id)}
                  onPreview={() => { s.setActivePackage(p.id); s.setThermal(true); }} />
              ))}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
