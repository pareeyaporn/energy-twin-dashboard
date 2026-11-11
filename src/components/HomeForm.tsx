import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useTwin, type Fuel } from "@/store/useTwin";

const decades = [1900, 1910, 1920, 1930, 1940, 1950, 1960, 1970, 1980, 1990, 2000, 2010, 2020];

export function HomeForm() {
  const { home, updateHome } = useTwin();
  const [notesOpen, setNotesOpen] = useState(false);
  const decade = Math.floor(home.year / 10) * 10;
  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-2">
        <Label htmlFor="zip" className="label-caps">ZIP code</Label>
        <Input id="zip" inputMode="numeric" maxLength={5} placeholder="60618" value={home.zip}
          onChange={(e) => updateHome({ zip: e.target.value.replace(/\D/g, "").slice(0, 5) })} />
      </div>
      <div className="grid gap-3">
        <div className="flex justify-between"><Label className="label-caps">Home size</Label><span className="num text-sm font-medium">{home.sqft.toLocaleString()} sq ft</span></div>
        <Slider aria-label="Home size in square feet" min={600} max={5000} step={50} value={[home.sqft]} onValueChange={([v]) => updateHome({ sqft: v })} />
      </div>
      <div className="grid gap-2">
        <Label className="label-caps">Year built</Label>
        <Select value={String(decade)} onValueChange={(v) => updateHome({ year: Number(v) })}>
          <SelectTrigger aria-label="Year built"><SelectValue /></SelectTrigger>
          <SelectContent>{decades.map((d) => <SelectItem key={d} value={String(d)}>{d}s</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div className="grid gap-2">
        <Label className="label-caps">Heating fuel</Label>
        <ToggleGroup type="single" value={home.fuel} onValueChange={(v) => v && updateHome({ fuel: v as Fuel })} className="glass grid grid-cols-4 rounded-lg p-1" aria-label="Heating fuel">
          {["Gas", "Electric", "Oil", "Propane"].map((f) => (
            <ToggleGroupItem key={f} value={f} className="h-8 text-xs data-[state=on]:bg-primary/15 data-[state=on]:text-primary">{f}</ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>
      <div className="grid gap-2">
        <Label className="label-caps">Heating system</Label>
        <Select value={home.system} onValueChange={(v) => updateHome({ system: v })}>
          <SelectTrigger aria-label="Heating system"><SelectValue /></SelectTrigger>
          <SelectContent>{["Furnace", "Boiler", "Heat pump", "Electric baseboard"].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-2">
          <Label htmlFor="elec" className="label-caps">Electric / mo</Label>
          <Input id="elec" type="number" min={0} className="num" value={home.electricMonthly} onChange={(e) => updateHome({ electricMonthly: Number(e.target.value) || 0 })} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="fuelbill" className="label-caps">Gas/fuel / mo</Label>
          <Input id="fuelbill" type="number" min={0} className="num" value={home.fuelMonthly} onChange={(e) => updateHome({ fuelMonthly: Number(e.target.value) || 0 })} />
        </div>
      </div>
      <div>
        <button type="button" onClick={() => setNotesOpen(!notesOpen)} aria-expanded={notesOpen} className="flex items-center gap-1 text-xs font-medium text-primary">
          <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-300 ${notesOpen ? "rotate-180" : ""}`} />Add inspection notes
        </button>
        <AnimatePresence initial={false}>
          {notesOpen && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3 }} className="overflow-hidden">
              <Textarea aria-label="Inspection notes" className="mt-2" rows={4} placeholder="Paste notes from your inspection report" value={home.notes} onChange={(e) => updateHome({ notes: e.target.value })} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
