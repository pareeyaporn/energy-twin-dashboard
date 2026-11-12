import { BookOpen, Flame, Share2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { useTwin } from "@/store/useTwin";
import { Logo } from "./Logo";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const steps = ["Hotel profile", "Explore", "Optimize"] as const;

export function TopBar() {
  const { step, thermalMode, setThermal, setSourcesOpen } = useTwin();
  return (
    <header className="flex h-16 shrink-0 items-center justify-between gap-4 border-b border-border px-6">
      <div className="flex min-w-0 items-center gap-3">
        <Logo />
        <div className="flex items-baseline gap-3">
          <span className="text-base font-semibold tracking-tight">Energy Twin</span>
          <span className="hidden truncate text-muted-foreground xl:inline">See the savings before you spend.</span>
        </div>
      </div>
      <nav aria-label="Progress" className="glass hidden items-center gap-1 rounded-full p-1 md:flex">
        {steps.map((s, i) => (
          <span key={s} aria-current={step === i + 1 ? "step" : undefined}
            className={cn("rounded-full px-3 py-1 text-xs font-medium transition-colors duration-300",
              step === i + 1 ? "bg-primary/15 text-primary" : step > i + 1 ? "text-foreground" : "text-text-muted")}>
            <span className="num mr-1.5 opacity-70">{i + 1}</span>{s}
          </span>
        ))}
      </nav>
      <div className="flex items-center gap-2">
        <label className={cn("flex cursor-pointer items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium transition-all duration-300",
          thermalMode ? "bg-heat/10 text-heat [text-shadow:0_0_12px_var(--heat)]" : "text-muted-foreground")}>
          <Flame className="h-4 w-4" />
          <span className="hidden lg:inline">Thermal Vision</span>
          <Switch checked={thermalMode} onCheckedChange={setThermal} aria-label="Thermal Vision" className="data-[state=checked]:bg-heat" />
        </label>
        <Button variant="ghost" size="sm" onClick={() => setSourcesOpen(true)}><BookOpen />Sources</Button>
        <Button variant="accentOutline" size="sm" onClick={() => { navigator.clipboard?.writeText(location.href); toast.success("Plan link copied"); }}>
          <Share2 />Share plan
        </Button>
      </div>
    </header>
  );
}
