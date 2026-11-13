import { useMemo, useState } from "react";
import { ArrowRight, ChevronDown, Database, MapPin, Pencil, X } from "lucide-react";
import { useShallow } from "zustand/react/shallow";
import { benchmarkComparison } from "@/engine/hotel";
import { useTwin } from "@/store/useTwin";
import { selectIsSynthetic, selectUtilityStatus } from "@/store/hotelDerived";
import { DefaultEstimate, DefaultEstimateNotice } from "./DefaultEstimate";
import { HotelHealthCard } from "./BenchmarkCard";
import { EnergyInsights } from "@/insights/EnergyInsights";
import { Briefing } from "@/advisor/Briefing";
import { UTILITY_STATUS, UtilityDataSection, useUtilityHydration } from "@/utility/UtilityDataSection";
import type { UtilityStep } from "@/utility/UtilityDataSection";
import { UtilityDataManager } from "@/utility/UtilityDataManager";
import { DATA_STATUS_TONE, dataStatusOf } from "@/utility/dataStatus";
import { HowCalculated } from "@/explain/HowCalculated";
import { compactUsd, reveal, sidebarCard } from "@/app/sidebar";
import { cn } from "@/lib/utils";
import { openWorkspaceTab } from "@/tour/dom";
import { HomePanel } from "./HomePanel";
import { HotelProfileForm, hvacOptions } from "./HotelProfileForm";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

// Claude Code edit (November 2026, sidebar redesign, at the user's request): the Hotel step is four compact sections, most important
// first: the hotel overview (with the preset and the profile form), the concise briefing, the top opportunities, hotel health; then
// one "Hotel profile & data" section and the next step. Everything that was here is still reachable, behind an expander.

const number = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 0 });
const kbtu = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 1 });

/** A. Hotel overview: who the hotel is, what it spends today, its intensity and data status; the preset and the full form on demand. */
function HotelOverview() {
  const p = useTwin(useShallow((s) => s.hotel.profile));
  const baseline = useTwin((s) => s.baseline);
  const status = dataStatusOf(useTwin(selectUtilityStatus), useTwin(selectIsSynthetic));
  const eui = useMemo(() => benchmarkComparison(baseline, p.floorAreaSqft).siteEuiKBtuPerSqft, [baseline, p.floorAreaSqft]);
  const cost = baseline.annual.cost;
  const [editing, setEditing] = useState(false);
  return (
    <section aria-label="Hotel overview" className={cn(sidebarCard, "space-y-3")} data-testid="hotel-overview">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="truncate text-base font-semibold leading-tight" data-testid="overview-name">{p.name}</h2>
          <p className="num mt-0.5 flex flex-wrap items-center gap-x-1 text-xs text-muted-foreground" data-testid="overview-facts">
            <MapPin className="size-3" aria-hidden />{p.city} · {number(p.rooms)} rooms · {number(p.floorAreaSqft)} ft²
          </p>
        </div>
        <span className={`shrink-0 rounded-full border px-1.5 py-px text-[10px] ${DATA_STATUS_TONE[status.id]}`} title={status.detail} data-testid="data-status">
          {status.label}
        </span>
      </div>
      <dl className="grid grid-cols-2 gap-3">
        <div className="min-w-0">
          <dt className="flex items-center gap-1 text-[11px] text-muted-foreground">Annual energy cost<HowCalculated metric="annualCost" /></dt>
          <dd className="num text-xl font-semibold leading-tight text-primary" title={`$${number(cost)} a year (modeled estimate, today)`} data-testid="overview-cost" data-value={cost}>
            {compactUsd(cost)}<span className="ml-0.5 text-xs font-normal text-muted-foreground">/yr</span>
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="flex items-center gap-1 text-[11px] text-muted-foreground">Energy intensity<HowCalculated metric="intensity" /></dt>
          <dd className="num text-xl font-semibold leading-tight" title={`${kbtu(eui)} kBtu per ft² a year (modeled estimate)`} data-testid="overview-eui" data-value={eui}>
            {kbtu(eui)}<span className="ml-1 text-xs font-normal text-muted-foreground">kBtu/ft²/yr</span>
          </dd>
        </div>
      </dl>
      <Collapsible open={editing} onOpenChange={setEditing}>
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1"><HomePanel presetOnly compact /></div>
          <CollapsibleTrigger asChild>
            <Button variant="outline" size="sm" className="h-9 shrink-0 gap-1 px-2.5 text-xs" aria-label="Edit hotel details" title="Edit hotel details" data-testid="edit-hotel-details">
              <Pencil className="size-3.5" />Edit
              <ChevronDown className={`size-3.5 transition-transform motion-reduce:transition-none ${editing ? "rotate-180" : ""}`} />
            </Button>
          </CollapsibleTrigger>
        </div>
        <CollapsibleContent className={`pt-3 ${reveal}`}><HotelProfileForm /></CollapsibleContent>
      </Collapsible>
    </section>
  );
}

/** E. Hotel profile & data: one line when closed (live), "Manage utility data" always at hand; details and utility data when open. */
function ProfileAndData() {
  useUtilityHydration();
  const p = useTwin(useShallow((s) => s.hotel.profile));
  const status = useTwin(selectUtilityStatus);
  const notice = useTwin((s) => s.utilityNotice);
  const clearNotice = useTwin((s) => s.clearUtilityNotice);
  const [open, setOpen] = useState(false);
  const [manager, setManager] = useState(false);
  const [step, setStep] = useState<UtilityStep>("edit");
  const manage = (next: UtilityStep) => {
    setStep(next);
    setManager(true);
  };
  const rows: [string, string, string][] = [
    ["Name", p.name, "name"],
    ["City", p.city, "city"],
    ["Rooms", number(p.rooms), "rooms"],
    ["Floor area", `${number(p.floorAreaSqft)} ft²`, "floorAreaSqft"],
    ["HVAC type", hvacOptions.find((o) => o.value === p.hvacType)?.label ?? p.hvacType, "hvacType"],
    ...(p.monthlyEnergyBill === null ? [] : [["Monthly bill", `$${number(p.monthlyEnergyBill)}`, "monthlyEnergyBill"] as [string, string, string]]),
  ];
  return (
    <section aria-label="Hotel profile and data" className={cn(sidebarCard, "relative p-0")} data-testid="profile-data">
      <div className="p-3 pl-4">
        <button
          type="button"
          className="block w-full min-w-0 rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-controls="profile-data-body"
          data-testid="profile-data-toggle"
        >
          <span className="flex min-h-8 items-center gap-1 pr-40 text-[13px] font-semibold">
            Hotel profile &amp; data
            <ChevronDown className={`size-4 text-muted-foreground transition-transform motion-reduce:transition-none ${open ? "rotate-180" : ""}`} aria-hidden />
          </span>
          <span className="num block truncate text-[11px] text-muted-foreground" data-testid="profile-data-line">
            {p.name} · {number(p.rooms)} rooms · {UTILITY_STATUS[status].label}
          </span>
        </button>
        <Button size="sm" variant="outline" className="absolute right-3 top-3 h-8 px-2 text-xs" onClick={() => manage("edit")} data-testid="manage-utility-header">
          <Database />Manage utility data
        </Button>
      </div>
      {!open && notice && (
        <p role="status" className="mx-3 mb-3 flex items-start justify-between gap-2 rounded-md border border-primary/30 bg-primary/10 p-2 text-xs">
          <span>{notice}</span>
          <button type="button" onClick={clearNotice} aria-label="Dismiss" className="text-muted-foreground hover:text-foreground"><X className="size-3.5" /></button>
        </p>
      )}
      {open && (
        <div id="profile-data-body" className={`space-y-4 border-t border-border/70 p-4 ${reveal}`}>
          <dl className="space-y-1.5 text-sm" aria-label="Hotel summary">
            <div className="mb-1"><DefaultEstimateNotice fields={rows.map((row) => row[2])} /></div>
            {rows.map(([label, value, field]) => (
              <div key={label} className="flex justify-between gap-3"><dt className="text-muted-foreground">{label}</dt><dd className="num flex min-w-0 items-center justify-end gap-1 break-words text-right font-medium"><span>{value}</span><DefaultEstimate field={field} dot /></dd></div>
            ))}
            <p className="pt-1 text-[11px] text-muted-foreground">Change these under Edit hotel details, at the top of this step.</p>
          </dl>
          <div className="border-t border-border/70 pt-4">
            <UtilityDataSection embedded onManage={manage} />
          </div>
        </div>
      )}
      <UtilityDataManager open={manager} onOpenChange={setManager} initialStep={step} />
    </section>
  );
}

/** F. The next step: open the Scenario tab (the same tab state the tab bar uses). */
function NextStep({ onSimulate }: { onSimulate: () => void }) {
  return (
    <div className="pt-1">
      <Button variant="accent" className="h-11 w-full justify-between text-sm" onClick={onSimulate} data-testid="simulate-hotel" title="Next: test occupancy, setpoints, schedules and prices before changing anything">
        Simulate this hotel<ArrowRight />
      </Button>
    </div>
  );
}

/** Workspace tab 1: the hotel at a glance, what deserves attention, then the profile and data, and the step to the Scenario tab. */
export function HotelTab({ onSimulate }: { onSimulate?: () => void } = {}) {
  return (
    <div className="space-y-3 p-3 sm:p-4" data-testid="hotel-step">
      <HotelOverview />
      <Briefing />
      <EnergyInsights />
      <HotelHealthCard />
      <ProfileAndData />
      <NextStep onSimulate={onSimulate ?? (() => openWorkspaceTab("Scenario"))} />
    </div>
  );
}
