import { useTwin } from "@/store/useTwin";
import { HotelProfileForm } from "./HotelProfileForm";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

export function HomePanel({ presetOnly = false, compact = false }: { presetOnly?: boolean; compact?: boolean } = {}) {
  const { hotelPresets, hotelPresetId, selectHotelPreset } = useTwin();
  const picker = (
        <section>
          <Label htmlFor="hotel-preset" className={compact ? "sr-only" : "label-caps mb-3 block"}>{compact ? "Sample hotel (preset)" : "Preset"}</Label>
          <Select value={hotelPresetId ?? ""} onValueChange={selectHotelPreset}>
            <SelectTrigger id="hotel-preset" aria-label="Hotel preset" className="h-auto min-h-9 [&>span]:whitespace-normal [&>span]:text-left"><SelectValue placeholder="Custom profile" /></SelectTrigger>
            <SelectContent>{hotelPresets.map((p) => <SelectItem key={p.id} value={p.id}><span className="block">{p.label}</span>{p.synthetic && <span className="block text-[10px] text-muted-foreground">Synthetic demo</span>}</SelectItem>)}</SelectContent>
          </Select>
        </section>
  );
  if (presetOnly) return picker;
  return (
    <div className="flex h-full flex-col">
      <h2 className="px-6 pt-6 text-xl font-semibold">Hotel profile</h2>
      <div className="flex-1 space-y-6 overflow-y-auto px-6 py-5">
        {picker}
        <div className="flex items-center gap-3"><div className="h-px flex-1 bg-border" /><span className="label-caps text-[11px]">Or enter your own</span><div className="h-px flex-1 bg-border" /></div>
        <HotelProfileForm />
      </div>
    </div>
  );
}
