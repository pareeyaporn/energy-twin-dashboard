import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { useShallow } from "zustand/react/shallow";
import { useTwin } from "@/store/useTwin";
import { HomePanel } from "./HomePanel";
import { HotelProfileForm, hvacOptions } from "./HotelProfileForm";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

const number = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 0 });

/** Workspace tab 1: preset picker, a read-only profile summary, and the full form on demand. */
export function HotelTab() {
  const p = useTwin(useShallow((s) => s.hotel.profile));
  const [editing, setEditing] = useState(false);
  const rows: [string, string][] = [
    ["Name", p.name],
    ["City", p.city],
    ["Rooms", number(p.rooms)],
    ["Floor area", `${number(p.floorAreaSqft)} ft²`],
    ["HVAC type", hvacOptions.find((o) => o.value === p.hvacType)?.label ?? p.hvacType],
    ["Monthly bill", p.monthlyEnergyBill === null ? "estimated" : `$${number(p.monthlyEnergyBill)}`],
  ];
  return (
    <div className="space-y-5 p-5">
      <HomePanel presetOnly />
      <dl className="space-y-2 rounded-lg border border-border bg-card p-4 text-sm" aria-label="Hotel summary">
        {rows.map(([label, value]) => (
          <div key={label} className="flex justify-between gap-3"><dt className="text-muted-foreground">{label}</dt><dd className="num text-right font-medium">{value}</dd></div>
        ))}
      </dl>
      <Collapsible open={editing} onOpenChange={setEditing}>
        <CollapsibleTrigger asChild>
          <Button variant="outline" className="w-full justify-between">Edit details<ChevronDown className={`h-4 w-4 transition-transform ${editing ? "rotate-180" : ""}`} /></Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-4"><HotelProfileForm /></CollapsibleContent>
      </Collapsible>
    </div>
  );
}
