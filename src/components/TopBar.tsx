import { BookOpen, Building2, FileText, Hotel, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { useTwin } from "@/store/useTwin";
import { Logo } from "./Logo";
import { TourButton } from "@/tour/TourButton";
import { forgetView, openReports } from "@/app/landing";

// Navigation (Claude Code edit, November 2026, the portfolio-first homepage): Portfolio (/), Hotel analysis (/hotel), Reports (the hotel's
// Invest tab, scrolled to the report buttons when a plan exists), Tour, Sources; Reset demo is secondary and returns to the portfolio.
export function TopBar() {
  const setSourcesOpen = useTwin((s) => s.setSourcesOpen);
  const resetDemo = useTwin((s) => s.resetDemo);
  const navigate = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const on = (p: string) => (path === p || (p === "/" && path === "/portfolio") ? "bg-accent text-foreground" : "");
  return (
    <header className="flex h-16 shrink-0 items-center justify-between gap-2 border-b border-border px-3 lg:px-6">
      <Link to="/" className="flex min-w-0 items-center gap-3" aria-label="Energy Twin, portfolio home">
        <Logo />
        <div className="flex items-baseline gap-3">
          <span className="text-base font-semibold tracking-tight">Energy Twin</span>
          <span className="hidden truncate text-muted-foreground 2xl:inline">See the savings before you spend.</span>
        </div>
      </Link>
      <nav aria-label="Main" className="flex items-center gap-1 sm:gap-2">
        <Button asChild variant="ghost" size="sm" className={on("/")}><Link to="/" aria-label="Portfolio" data-testid="nav-portfolio"><Building2 /><span className="hidden sm:inline">Portfolio</span></Link></Button>
        <Button asChild variant="ghost" size="sm" className={on("/hotel")}><Link to="/hotel" aria-label="Hotel analysis" data-testid="nav-hotel"><Hotel /><span className="hidden md:inline">Hotel analysis</span></Link></Button>
        <Button variant="ghost" size="sm" aria-label="Reports" data-testid="nav-reports" onClick={() => void Promise.resolve(navigate({ to: "/hotel" })).then(() => openReports())}><FileText /><span className="hidden lg:inline">Reports</span></Button>
        <TourButton />
        <Button variant="ghost" size="sm" aria-label="Sources" onClick={() => setSourcesOpen(true)}><BookOpen /><span className="hidden sm:inline">Sources</span></Button>
        <Button
          variant="ghost"
          size="sm"
          aria-label="Reset demo"
          data-testid="reset-demo"
          className="text-muted-foreground"
          onClick={() => {
            resetDemo();
            forgetView();
            void navigate({ to: "/" });
            toast("Demo reset to the starting state");
          }}
        >
          <RotateCcw /><span className="hidden xl:inline text-xs">Reset demo</span>
        </Button>
      </nav>
    </header>
  );
}
