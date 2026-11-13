import { ExternalLink } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useTwin } from "@/store/useTwin";
import { DataClassLegend, FinancialAssumptionsPanel } from "@/explain/HowCalculated";

// The hotel model's main sources (every value and where it was read: docs/14 research log).
const sources = [
  { name: "EIA prices", desc: "Commercial electricity and natural gas prices by state (Electric Power Monthly, natural gas prices).", url: "https://www.eia.gov/electricity/monthly/" },
  { name: "EIA Annual Energy Outlook 2026", desc: "Energy price growth used in net benefit and NPV.", url: "https://www.eia.gov/outlooks/aeo/" },
  { name: "NREL ComStock", desc: "Hotel energy intensity and end-use split by climate zone (2025 Release 3).", url: "https://comstock.nrel.gov/" },
  { name: "NOAA Climate Normals", desc: "1991–2020 monthly temperatures for each city.", url: "https://www.ncei.noaa.gov/products/land-based-station/us-climate-normals" },
  { name: "EPA eGRID", desc: "Grid emission factors by subregion (eGRID2023).", url: "https://www.epa.gov/egrid" },
  { name: "NREL PVWatts", desc: "Solar production for each city.", url: "https://pvwatts.nrel.gov/" },
  { name: "Illinois Statewide TRM v14.0", desc: "Upgrade savings, measure lives and some costs.", url: "https://www.ilsag.info/technical-reference-manual/" },
  { name: "ComEd incentive worksheets", desc: "Business incentive rates and program rules (2026; 2025 lighting rates shown as illustrative).", url: "https://www.comed.com/ways-to-save/for-your-business" },
  { name: "LBNL Tracking the Sun / Distributed Solar", desc: "Installed solar prices by system size.", url: "https://emp.lbl.gov/tracking-the-sun" },
];

export function SourcesSheet() {
  const { sourcesOpen, setSourcesOpen } = useTwin();
  const plan = useTwin((s) => s.hotelPlan);
  const lineSources = [...new Set([...(plan?.packages ?? []), ...(plan?.objectiveWinner ? [plan.objectiveWinner] : [])].flatMap((p) => p.evaluation.lineItems.map((line) => line.source)))];
  return (
    <Sheet open={sourcesOpen} onOpenChange={setSourcesOpen}>
      <SheetContent className="overflow-y-auto border-border bg-panel">
        <SheetHeader><SheetTitle>Sources</SheetTitle><SheetDescription>References and assumptions behind the estimates; synthetic values are not verified.</SheetDescription></SheetHeader>
        <div className="mt-5 space-y-5"><FinancialAssumptionsPanel /><DataClassLegend /></div>
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
