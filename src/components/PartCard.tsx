import { X } from "lucide-react";
import type { Part } from "@/store/useTwin";
import { InfoTip } from "./InfoTip";
import { hotelWording } from "@/lib/presentation";

const usd = (n: number) => `$${n.toLocaleString()}`;

export function PartCard({ part, onClose }: { part: Part; onClose: () => void }) {
  return (
    <div className="w-72 space-y-3 text-sm">
      <div className="flex items-start justify-between">
        <div>
          <p className="label-caps">Part</p>
          <h3 className="text-base font-semibold">{hotelWording(part.name)}</h3>
        </div>
        <button onClick={onClose} aria-label="Close part card" className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
      </div>
      <InfoTip text="Money you spend each year heating air that escapes through this part.">
        <p className="num text-2xl font-semibold text-heat">−{usd(part.lossPerYear)}<span className="text-sm font-normal text-muted-foreground"> /yr heat loss</span></p>
      </InfoTip>
      <dl className="space-y-2">
        <div><dt className="label-caps text-[11px]">Current condition</dt><dd>{hotelWording(part.condition)}</dd></div>
        <div><dt className="label-caps text-[11px]">Recommended upgrade</dt><dd>{hotelWording(part.upgrade)}</dd></div>
        <div className="grid grid-cols-2 gap-2">
          <div><dt className="label-caps text-[11px]">Cost</dt><dd className="num"><InfoTip text="Typical installed price range in your area.">{usd(part.costRange[0])}–{usd(part.costRange[1])}</InfoTip></dd></div>
          <div><dt className="label-caps text-[11px]">Saves</dt><dd className="num text-savings"><InfoTip text="How much less you'd likely pay each year after this upgrade.">{usd(part.savingsRange[0])}–{usd(part.savingsRange[1])}/yr</InfoTip></dd></div>
        </div>
      </dl>
      <span className="inline-block rounded-full border border-glass-border bg-glass px-2 py-0.5 text-[11px] text-muted-foreground">Source: {part.source}</span>
    </div>
  );
}
