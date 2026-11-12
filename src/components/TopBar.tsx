import { BookOpen, Building2, ChartNoAxesCombined, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { useTwin } from "@/store/useTwin";
import { Logo } from "./Logo";
import { TourButton } from "@/tour/TourButton";

export function TopBar() {
  const setSourcesOpen = useTwin((s) => s.setSourcesOpen);
  const resetDemo = useTwin((s) => s.resetDemo);
  return (
    <header className="flex h-16 shrink-0 items-center justify-between gap-2 border-b border-border px-3 lg:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <Logo />
        <div className="flex items-baseline gap-3">
          <span className="text-base font-semibold tracking-tight">Energy Twin</span>
          <span className="hidden truncate text-muted-foreground 2xl:inline">See the savings before you spend.</span>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="sm"><Link to="/portfolio" aria-label="Portfolio"><Building2 /><span className="hidden sm:inline">Portfolio</span></Link></Button>
        <Button asChild variant="ghost" size="sm"><Link to="/overview" aria-label="Report"><ChartNoAxesCombined /><span className="hidden xl:inline">Report</span></Link></Button>
        <TourButton />
        <Button variant="ghost" size="sm" aria-label="Reset demo" data-testid="reset-demo" onClick={() => { resetDemo(); toast("Demo reset to the starting state"); }}><RotateCcw /><span className="hidden lg:inline">Reset demo</span></Button>
        <Button variant="ghost" size="sm" aria-label="Sources" onClick={() => setSourcesOpen(true)}><BookOpen /><span className="hidden sm:inline">Sources</span></Button>
      </div>
    </header>
  );
}
