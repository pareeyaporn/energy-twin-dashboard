import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { useShallow } from "zustand/react/shallow";
import { useTwin } from "@/store/useTwin";
import { DefaultEstimate, DefaultEstimateNotice } from "./DefaultEstimate";
import { BenchmarkCard } from "./BenchmarkCard";
import { EnergyInsights } from "@/insights/EnergyInsights";
import { Briefing } from "@/advisor/Briefing";
import { UtilityDataSection } from "@/utility/UtilityDataSection";
import { HomePanel } from "./HomePanel";
import { HotelProfileForm, hvacOptions } from "./HotelProfileForm";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

const number = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 0 });

/** Workspace tab 1: preset picker, a read-only profile summary, and the full form on demand. */
export function HotelTab() {
  const p = useTwin(useShallow((s) => s.hotel.profile));
  const [editing, setEditing] = useState(false);
  const rows: [string, string, string][] = [
    ["Name", p.name, "name"],
    ["City", p.city, "city"],
    ["Rooms", number(p.rooms), "rooms"],
    ["Floor area", `${number(p.floorAreaSqft)} ft²`, "floorAreaSqft"],
    ["HVAC type", hvacOptions.find((o) => o.value === p.hvacType)?.label ?? p.hvacType, "hvacType"],
    ...(p.monthlyEnergyBill === null ? [] : [["Monthly bill", `$${number(p.monthlyEnergyBill)}`, "monthlyEnergyBill"] as [string, string, string]]),
  ];
  return (
    <div className="space-y-5 p-5">
      {/* Claude Code edit (November 2026, page cleanup): what deserves attention comes first; the sample-hotel picker moves down
          (hotels are chosen from the portfolio; the demo script still uses it for the 300-room sample). */}
      <Briefing />
      <EnergyInsights />
      <dl className="space-y-2 rounded-lg border border-border bg-card p-4 text-sm" aria-label="Hotel summary">
        <div className="mb-2"><DefaultEstimateNotice fields={rows.map((row) => row[2])} /></div>
        {rows.map(([label, value, field]) => (
          <div key={label} className="flex justify-between gap-3"><dt className="text-muted-foreground">{label}</dt><dd className="num flex min-w-0 items-center justify-end gap-1 break-words text-right font-medium"><span>{value}</span><DefaultEstimate field={field} dot /></dd></div>
        ))}
      </dl>
      <UtilityDataSection />
      <BenchmarkCard />
      <HomePanel presetOnly />
      <Collapsible open={editing} onOpenChange={setEditing}>
        <CollapsibleTrigger asChild>
          <Button variant="outline" className="w-full justify-between">Edit details<ChevronDown className={`h-4 w-4 transition-transform ${editing ? "rotate-180" : ""}`} /></Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-4"><HotelProfileForm /></CollapsibleContent>
      </Collapsible>
    </div>
  );
}
