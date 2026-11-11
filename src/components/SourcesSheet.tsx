import { ExternalLink } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useTwin } from "@/store/useTwin";

const sources = [
  { name: "EIA", desc: "Electricity and natural gas prices by state.", url: "https://www.eia.gov/electricity/data.php" },
  { name: "NREL ResStock", desc: "Energy use and upgrade savings for typical U.S. homes.", url: "https://resstock.nrel.gov/" },
  { name: "EIA RECS", desc: "How American homes use energy, by region and type.", url: "https://www.eia.gov/consumption/residential/" },
  { name: "Rewiring America", desc: "Federal, state and local rebates for home upgrades.", url: "https://www.rewiringamerica.org/" },
  { name: "NREL PVWatts", desc: "Solar production estimates for your location.", url: "https://pvwatts.nrel.gov/" },
];

export function SourcesSheet() {
  const { sourcesOpen, setSourcesOpen } = useTwin();
  return (
    <Sheet open={sourcesOpen} onOpenChange={setSourcesOpen}>
      <SheetContent className="border-border bg-panel">
        <SheetHeader><SheetTitle>Sources</SheetTitle><SheetDescription>Public data behind every estimate.</SheetDescription></SheetHeader>
        <ul className="mt-6 space-y-3">
          {sources.map((s) => (
            <li key={s.name}>
              <a href={s.url} target="_blank" rel="noreferrer" className="lift glass flex items-start justify-between gap-3 rounded-xl p-4 hover:border-input">
                <span><span className="block font-medium">{s.name}</span><span className="text-xs text-muted-foreground">{s.desc}</span></span>
                <ExternalLink className="h-4 w-4 shrink-0 text-primary" />
              </a>
            </li>
          ))}
        </ul>
      </SheetContent>
    </Sheet>
  );
}
