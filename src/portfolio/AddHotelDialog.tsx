import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import type { HotelInput, HvacType } from "@/engine/hotel";
import { useTwin } from "@/store/useTwin";
import { CHICAGO_AREAS } from "@/store/userHotels";
import type { ChicagoAreaId } from "@/store/userHotels";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

const HVAC_OPTIONS: { value: HvacType; label: string }[] = [
  { value: "central_plant", label: "Central plant (gas boiler and chiller)" },
  { value: "ptac", label: "PTAC room units (electric heat)" },
  { value: "pthp", label: "PTHP room heat pumps" },
  { value: "vrf", label: "VRF heat pumps" },
  { value: "rtu", label: "Rooftop units (gas heat)" },
];

type Draft = { name: string; area: ChicagoAreaId; rooms: string; floors: string; floorArea: string; yearBuilt: string; hvac: HvacType; occupancy: string; bill: string; budget: string };
const EMPTY: Draft = { name: "", area: "loop", rooms: "", floors: "", floorArea: "", yearBuilt: "", hvac: "central_plant", occupancy: "", bill: "", budget: "" };

const num = (s: string) => (s.trim() === "" ? undefined : Number(s.replace(/[$,\s%]/g, "")));

/** Checks the draft; returns the engine input or the problems to fix. Blank optional fields use the documented defaults. */
export function draftToInput(d: Draft): { input: HotelInput | null; errors: string[] } {
  const errors: string[] = [];
  const rooms = num(d.rooms);
  if (rooms === undefined || !Number.isFinite(rooms) || rooms < 5 || rooms > 3000) errors.push("Guest rooms: enter a number from 5 to 3,000.");
  const check = (v: number | undefined, label: string, lo: number, hi: number) => {
    if (v !== undefined && (!Number.isFinite(v) || v < lo || v > hi)) errors.push(`${label}: enter a number from ${lo.toLocaleString("en-US")} to ${hi.toLocaleString("en-US")}, or leave it blank.`);
    return v;
  };
  const floors = check(num(d.floors), "Floors", 1, 120);
  const floorArea = check(num(d.floorArea), "Floor area", 2000, 5_000_000);
  const yearBuilt = check(num(d.yearBuilt), "Year built", 1850, 2026);
  const occupancy = check(num(d.occupancy), "Occupancy", 5, 100);
  const bill = check(num(d.bill), "Monthly energy bill", 500, 5_000_000);
  const budget = check(num(d.budget), "Investment budget", 0, 50_000_000);
  if (errors.length) return { input: null, errors };
  const input: HotelInput = { rooms: Math.round(rooms!), hvacType: d.hvac };
  if (d.name.trim()) input.name = d.name.trim().slice(0, 80);
  if (floors !== undefined) input.floors = Math.round(floors);
  if (floorArea !== undefined) input.floorAreaSqft = floorArea;
  if (yearBuilt !== undefined) input.yearBuilt = Math.round(yearBuilt);
  if (occupancy !== undefined) input.occupancy = occupancy / 100;
  if (bill !== undefined) input.monthlyEnergyBill = bill;
  if (budget !== undefined) input.budget = budget;
  return { input, errors };
}

function Field({ id, label, hint, children }: { id: string; label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label htmlFor={id} className="block text-xs">
      <span className="mb-1 block font-medium">{label}</span>
      {children}
      {hint && <span className="mt-0.5 block text-[11px] text-muted-foreground">{hint}</span>}
    </label>
  );
}

const inputCls = "w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm";

/** "Add my hotel": a short form; the hotel joins the portfolio map and opens in its own digital twin. Saved in this browser only. */
export function AddHotelDialog({ trigger }: { trigger?: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [d, setD] = useState<Draft>(EMPTY);
  const [errors, setErrors] = useState<string[]>([]);
  const add = useTwin((s) => s.addUserHotel);
  const openProperty = useTwin((s) => s.openProperty);
  const hydrate = useTwin((s) => s.hydrateUserHotels);
  const navigate = useNavigate();
  const set = (k: keyof Draft) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setD((x) => ({ ...x, [k]: e.target.value }));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const r = draftToInput(d);
    setErrors(r.errors);
    if (!r.input) return;
    hydrate();
    const id = add(r.input, d.area);
    openProperty(id);
    setOpen(false);
    setD(EMPTY);
    toast(`${r.input.name ?? "Your hotel"} added: here is its digital twin`);
    void navigate({ to: "/" });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setErrors([]); }}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="sm" data-testid="add-my-hotel">
            <Plus /> Add my hotel
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add my hotel</DialogTitle>
          <DialogDescription>
            A few facts are enough: Energy Twin fills the rest with documented hotel defaults (marked in the profile) and builds the hotel's digital
            twin. Everything stays in this browser.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3" noValidate>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field id="mh-name" label="Hotel name"><input id="mh-name" className={inputCls} value={d.name} onChange={set("name")} placeholder="My hotel" maxLength={80} /></Field>
            <Field id="mh-area" label="Location (Chicago)" hint="Chicago weather and Illinois rates are used.">
              <select id="mh-area" className={inputCls} value={d.area} onChange={set("area")}>
                {CHICAGO_AREAS.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
              </select>
            </Field>
            <Field id="mh-rooms" label="Guest rooms *"><input id="mh-rooms" className={inputCls} inputMode="numeric" value={d.rooms} onChange={set("rooms")} placeholder="for example 150" required /></Field>
            <Field id="mh-hvac" label="Heating and cooling">
              <select id="mh-hvac" className={inputCls} value={d.hvac} onChange={set("hvac")}>
                {HVAC_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </Field>
            <Field id="mh-floors" label="Floors" hint="Optional"><input id="mh-floors" className={inputCls} inputMode="numeric" value={d.floors} onChange={set("floors")} /></Field>
            <Field id="mh-area-sqft" label="Floor area (ft²)" hint="Optional; estimated from rooms if blank"><input id="mh-area-sqft" className={inputCls} inputMode="numeric" value={d.floorArea} onChange={set("floorArea")} /></Field>
            <Field id="mh-year" label="Year built" hint="Optional"><input id="mh-year" className={inputCls} inputMode="numeric" value={d.yearBuilt} onChange={set("yearBuilt")} /></Field>
            <Field id="mh-occ" label="Average occupancy (%)" hint="Optional"><input id="mh-occ" className={inputCls} inputMode="decimal" value={d.occupancy} onChange={set("occupancy")} /></Field>
            <Field id="mh-bill" label="Monthly energy bill ($)" hint="Optional; improves the estimate"><input id="mh-bill" className={inputCls} inputMode="decimal" value={d.bill} onChange={set("bill")} /></Field>
            <Field id="mh-budget" label="Investment budget ($)" hint="Optional"><input id="mh-budget" className={inputCls} inputMode="decimal" value={d.budget} onChange={set("budget")} /></Field>
          </div>
          {errors.length > 0 && (
            <ul className="space-y-0.5 text-xs text-heat" role="alert" data-testid="add-hotel-errors">
              {errors.map((x) => <li key={x}>{x}</li>)}
            </ul>
          )}
          <p className="text-[11px] text-muted-foreground">Results are modeled estimates, not an engineering audit. You can change any detail later under Hotel, Edit details.</p>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" data-testid="add-hotel-submit">Add and open its twin</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
