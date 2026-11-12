import { AnimatePresence, motion } from "framer-motion";
import { MapPin, RefreshCcw, Rotate3d, Scissors, Snowflake, Sun, MoreHorizontal, TrendingDown, Thermometer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useTwin, selectCurrentCost, selectHomeLabel } from "@/store/useTwin";
import { useShallow } from "zustand/react/shallow";
import { AnimatedNumber } from "./AnimatedNumber";
import { InfoTip } from "./InfoTip";
import { PartCard } from "./PartCard";
import { toast } from "sonner";
import { hotelWording } from "@/lib/presentation";

function ToolBtn({ label, onClick, children }: { label: string; onClick?: () => void; children: React.ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild><Button variant="ghost" size="icon" aria-label={label} onClick={onClick} className="active:scale-90">{children}</Button></TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

export function StageOverlays() {
  const s = useTwin();
  const cost = useTwin(selectCurrentCost);
  const label = useTwin(useShallow(selectHomeLabel));
  const soon = (what: string) => () => toast(`${what} coming soon`);
  return (
    <>
      <div className="absolute left-4 top-4 flex gap-2">
        <span className="glass flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium"><MapPin className="h-3.5 w-3.5 text-primary" />Synthetic profile · {label.city}</span>
        <InfoTip text="Your climate zone describes winters and summers at the building's location.">
          <span className="glass flex rounded-full px-3 py-1.5 text-xs text-muted-foreground">Climate zone {label.zone}</span>
        </InfoTip>
      </div>

      <div className="glass absolute right-4 top-4 rounded-2xl px-5 py-4">
        <p className="label-caps flex items-center gap-1.5"><TrendingDown className="h-3.5 w-3.5 text-savings" />Yearly energy cost</p>
        <InfoTip text="Estimated annual building energy cost. Pick a package to see the cost with upgrades.">
          <p className="mt-1 text-4xl font-semibold tracking-tight"><AnimatedNumber value={cost} prefix="$" /><span className="text-base font-normal text-muted-foreground"> / yr</span></p>
        </InfoTip>
      </div>

      <AnimatePresence>
        {s.thermalMode && s.parts.map((p, i) => (
          <Popover key={p.id} open={s.selectedPart === p.id} onOpenChange={(o) => s.selectPart(o ? p.id : null)}>
            <PopoverTrigger asChild>
              <motion.button
                initial={{ opacity: 0, scale: 0.8, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.8 }}
                transition={{ delay: i * 0.08, duration: 0.3 }}
                style={{ left: `${p.pos.x}%`, top: `${p.pos.y}%` }}
                className="absolute z-10 -translate-x-1/2 whitespace-nowrap rounded-full border border-heat/40 bg-heat/15 px-3 py-1 text-xs font-medium text-heat backdrop-blur-md hover:bg-heat/25"
                aria-label={`${hotelWording(p.name)}, losing $${p.lossPerYear} per year. Open details`}>
                <span className="num">{hotelWording(p.name)} −${p.lossPerYear}/yr</span>
              </motion.button>
            </PopoverTrigger>
            <PopoverContent className="glass w-auto rounded-2xl border-glass-border bg-panel/80">
              <PartCard part={p} onClose={() => s.selectPart(null)} />
            </PopoverContent>
          </Popover>
        ))}
      </AnimatePresence>

      <AnimatePresence>
        {s.thermalMode && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="glass absolute bottom-20 left-4 w-56 rounded-xl p-3">
            <p className="label-caps mb-2 flex items-center gap-1 text-[11px]"><Thermometer className="h-3 w-3" />Heat loss</p>
            <div className="h-2 rounded-full bg-thermal" />
            <div className="mt-1.5 flex justify-between text-[11px] text-muted-foreground"><span>Efficient</span><span>Losing heat</span></div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="glass absolute bottom-20 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full p-1.5">
        <ToolBtn label="Rotate" onClick={soon("Rotate")}><Rotate3d /></ToolBtn>
        <ToolBtn label="Reset view" onClick={soon("Reset view")}><RefreshCcw /></ToolBtn>
        <ToolBtn label="Cutaway" onClick={soon("Cutaway")}><Scissors /></ToolBtn>
        <ToolBtn label={s.season === "winter" ? "Season: winter" : "Season: summer"} onClick={s.toggleSeason}>
          {s.season === "winter" ? <Snowflake className="text-efficient" /> : <Sun className="text-heat" />}
        </ToolBtn>
        <DropdownMenu>
          <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" aria-label="More view options"><MoreHorizontal /></Button></DropdownMenuTrigger>
          <DropdownMenuContent side="top">
            <DropdownMenuCheckboxItem checked={s.reduceEffects} onCheckedChange={(v) => s.setReduceEffects(!!v)}>Reduce effects</DropdownMenuCheckboxItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </>
  );
}
