import { ExternalLink } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useTwin } from "@/store/useTwin";

const sources = [
  { name: "EIA", desc: "Electricity and natural gas prices by state.", url: "https://www.eia.gov/electricity/data.php" },
  { name: "NREL ResStock", desc: "Legacy sample energy and upgrade reference; not hotel-specific.", url: "https://resstock.nrel.gov/" },
  { name: "EIA RECS", desc: "Legacy energy consumption reference; not hotel-specific.", url: "https://www.eia.gov/consumption/residential/" },
  { name: "Rewiring America", desc: "Legacy upgrade incentive reference; hotel eligibility not verified.", url: "https://www.rewiringamerica.org/" },
  { name: "NREL PVWatts", desc: "Solar production estimates for your location.", url: "https://pvwatts.nrel.gov/" },
];

export function SourcesSheet() {
  const { sourcesOpen, setSourcesOpen } = useTwin();
  const plan = useTwin((s) => s.hotelPlan);
  const lineSources = [...new Set([...(plan?.packages ?? []), ...(plan?.objectiveWinner ? [plan.objectiveWinner] : [])].flatMap((p) => p.evaluation.lineItems.map((line) => line.source)))];
  return (
    <Sheet open={sourcesOpen} onOpenChange={setSourcesOpen}>
      <SheetContent className="overflow-y-auto border-border bg-panel">
        <SheetHeader><SheetTitle>Sources</SheetTitle><SheetDescription>References and assumptions behind the estimates; synthetic values are not verified.</SheetDescription></SheetHeader>
        {lineSources.length > 0 && <section className="mt-5 space-y-3"><h2 className="text-sm font-semibold">Investment sources</h2><ul className="space-y-3 text-xs text-muted-foreground">{lineSources.map((source) => <li key={source} className="break-words border-b border-border pb-3">{source}</li>)}</ul></section>}
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
