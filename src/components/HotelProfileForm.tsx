import { useEffect, useState, type ReactNode } from "react";
import { RotateCcw } from "lucide-react";
import type { HotelInput, HvacType, Objective, Setpoints } from "@/engine/hotel";
import { useTwin } from "@/store/useTwin";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

function Field({ name, label, children, onReset }: { name: string; label: string; children: ReactNode; onReset: () => void }) {
  const defaulted = useTwin((s) => s.hotel.defaulted.includes(name));
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={`hotel-${name}`} className="text-xs leading-snug">{label}</Label>
        <Tooltip>
          <TooltipTrigger asChild><Button type="button" variant="ghost" size="icon" className="h-6 w-6 shrink-0 text-muted-foreground" aria-label={`Reset ${label} to default`} onClick={onReset}><RotateCcw className="h-3 w-3" /></Button></TooltipTrigger>
          <TooltipContent>Reset to default</TooltipContent>
        </Tooltip>
      </div>
      {children}
      {defaulted && <span className="block text-[10px] text-text-muted">default (estimate)</span>}
    </div>
  );
}

function ProfileInput({ name, label, value, numeric = false, step, onCommit, onReset }: {
  name: string; label: string; value: string | number | null; numeric?: boolean; step?: number | undefined;
  onCommit: (value: string) => void; onReset: () => void;
}) {
  const [draft, setDraft] = useState(String(value ?? ""));
  const hotel = useTwin((s) => s.hotel);
  useEffect(() => setDraft(String(value ?? "")), [value, hotel]);
  return <Field name={name} label={label} onReset={onReset}>
    <Input id={`hotel-${name}`} aria-label={label} type={numeric ? "number" : "text"} step={step ?? "any"}
      value={draft} onChange={(e) => setDraft(e.target.value)}
      onBlur={() => onCommit(draft)}
      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); e.currentTarget.blur(); } }} />
  </Field>;
}

const hvacOptions = [
  { value: "ptac", label: "PTAC — room units" }, { value: "vrf", label: "VRF" },
  { value: "central_plant", label: "Central plant" }, { value: "rtu", label: "Rooftop units" },
];
const objectiveOptions = [
  { value: "annual_savings", label: "Annual savings" }, { value: "payback", label: "Payback" },
  { value: "roi", label: "ROI" }, { value: "carbon", label: "Carbon" }, { value: "balanced", label: "Balanced" },
];

export function HotelProfileForm() {
  const { hotel, hotelInput, setHotelInput } = useTwin();
  const profile = hotel.profile;
  function input(name: keyof HotelInput, label: string, numeric = true, scale = 1, step?: number) {
    const raw = profile[name];
    const value = typeof raw === "number" ? Number((raw * scale).toFixed(6)) : typeof raw === "string" ? raw : null;
    return <ProfileInput key={name} name={name} label={label} value={value} numeric={numeric} step={step}
      onReset={() => setHotelInput({}, [name])}
      onCommit={(v) => {
        if (!v.trim()) { setHotelInput({}, [name]); return; }
        if (numeric && !Number.isFinite(Number(v))) return;
        setHotelInput({ [name]: numeric ? Number(v) / scale : v });
      }} />;
  }
  function choice(name: "hvacType" | "objective", label: string, options: { value: string; label: string }[]) {
    return <Field name={name} label={label} onReset={() => setHotelInput({}, [name])}>
      <Select value={profile[name]} onValueChange={(v) => setHotelInput(name === "hvacType" ? { hvacType: v as HvacType } : { objective: v as Objective })}>
        <SelectTrigger id={`hotel-${name}`} aria-label={label}><SelectValue /></SelectTrigger>
        <SelectContent>{options.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
      </Select>
    </Field>;
  }
  function temperature(name: keyof Setpoints, label: string) {
    const clear = () => {
      const remaining = { ...hotelInput.setpoints };
      delete remaining[name];
      setHotelInput(Object.keys(remaining).length ? { setpoints: remaining } : {}, ["setpoints"]);
    };
    return <ProfileInput name={`setpoints.${name}`} label={label} value={profile.setpoints[name]} numeric
      onReset={clear} onCommit={(v) => {
        if (!v.trim()) { clear(); return; }
        if (Number.isFinite(Number(v))) setHotelInput({ setpoints: { ...hotelInput.setpoints, [name]: Number(v) } });
      }} />;
  }
  return (
    <>
      <Accordion type="multiple" defaultValue={["building"]}>
        <AccordionItem value="building">
          <AccordionTrigger className="text-base font-semibold">Building</AccordionTrigger>
          <AccordionContent className="space-y-4">
            {input("name", "Name", false)}
            {input("city", "City", false)}
            <div className="grid grid-cols-2 gap-3">{input("state", "State", false)}{input("country", "Country", false)}</div>
            <div className="grid grid-cols-2 gap-3">{input("rooms", "Guest rooms", true, 1, 1)}{input("floors", "Floors", true, 1, 1)}</div>
            {input("floorAreaSqft", "Floor area (sq ft)")}
            {input("yearBuilt", "Year built", true, 1, 1)}
            {input("operatingHours", "Operating hours (h/day)")}
            {choice("hvacType", "HVAC type", hvacOptions)}
            {input("monthlyEnergyBill", "Monthly energy bill ($)")}
            {input("electricityRate", "Electricity price ($/kWh)", true, 1, 0.01)}
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="operations">
          <AccordionTrigger className="text-base font-semibold">Operations</AccordionTrigger>
          <AccordionContent className="space-y-4">
            {input("occupancy", "Occupancy (%)", true, 100)}
            {input("occupiedHoursPerRoom", "Occupied hours per room (h/day)")}
            <fieldset className="space-y-3">
              <legend className="mb-2 text-xs text-muted-foreground">Guest-room temperatures (°F)</legend>
              <div className="grid grid-cols-2 gap-3">{temperature("occupiedHeatF", "Occupied heating (°F)")}{temperature("occupiedCoolF", "Occupied cooling (°F)")}</div>
              <div className="grid grid-cols-2 gap-3">{temperature("vacantHeatF", "Vacant heating (°F)")}{temperature("vacantCoolF", "Vacant cooling (°F)")}</div>
            </fieldset>
            {input("commonAreaHvacHours", "Common-area HVAC (h/day)")}
            {input("lightingHoursPerDay", "Lighting hours (h/day)")}
            {input("hotWaterGalPerOccupiedRoomDay", "Hot water (gal/occupied room/day)")}
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="financial">
          <AccordionTrigger className="text-base font-semibold">Financial</AccordionTrigger>
          <AccordionContent className="space-y-4">
            {input("budget", "Budget ($)")}
            {input("horizonYears", "Investment horizon (years)", true, 1, 1)}
            {choice("objective", "Objective", objectiveOptions)}
          </AccordionContent>
        </AccordionItem>
      </Accordion>
      {hotel.notes.length > 0 && <ul aria-label="Profile notes" className="space-y-2 text-xs leading-relaxed text-muted-foreground">{hotel.notes.map((note, i) => <li key={`${i}-${note}`}>{note}</li>)}</ul>}
    </>
  );
}