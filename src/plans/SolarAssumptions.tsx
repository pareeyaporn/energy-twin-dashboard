import { useState } from "react";
import { solarCostPerW } from "@/engine/hotel";
import { useTwin } from "@/store/useTwin";

/**
 * Editable solar assumptions for this hotel: the installed price per W (default: LBNL 2024 national median for the array's size, before
 * incentives) and the credit per exported kWh (default $0, a conservative fallback until the applicable tariff is confirmed).
 */
export function SolarAssumptions({ sizeKw }: { sizeKw: number }) {
  const profile = useTwin((s) => s.hotel.profile);
  const setInput = useTwin((s) => s.setHotelInput);
  const { solarCostPerW: _override, ...withoutOverride } = profile;
  const benchmark = solarCostPerW(sizeKw, withoutOverride).mid;
  const [price, setPrice] = useState(profile.solarCostPerW?.toString() ?? "");
  const [credit, setCredit] = useState(profile.solarExportCreditPerKWh?.toString() ?? "");
  const commit = (key: "solarCostPerW" | "solarExportCreditPerKWh", raw: string) => {
    const v = Number(raw);
    if (raw.trim() === "" || !Number.isFinite(v)) setInput({}, [key]);
    else setInput({ [key]: v });
  };
  return (
    <details className="mt-2 rounded-lg border border-glass-border/70 bg-background/40 p-2 text-[11px]">
      <summary className="cursor-pointer text-muted-foreground">Solar assumptions (editable)</summary>
      <div className="mt-2 space-y-2">
        <label className="flex items-center justify-between gap-2">
          <span>
            Installed price, $/W
            <span className="block text-[10px] text-muted-foreground">Default {`$${benchmark.toFixed(2)}`}: LBNL 2024 national median for {Math.round(sizeKw)} kW, before incentives</span>
          </span>
          <input
            type="number"
            step="0.05"
            min="0.5"
            max="10"
            placeholder={benchmark.toFixed(2)}
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            onBlur={() => commit("solarCostPerW", price)}
            aria-label="Solar installed price per W"
            className="h-7 w-20 rounded-md border border-glass-border bg-background px-1.5 text-right tabular-nums"
          />
        </label>
        <label className="flex items-center justify-between gap-2">
          <span>
            Export credit, $/kWh
            <span className="block text-[10px] text-muted-foreground">Default $0: conservative until the hotel's tariff is confirmed</span>
          </span>
          <input
            type="number"
            step="0.01"
            min="0"
            max="0.5"
            placeholder="0.00"
            value={credit}
            onChange={(e) => setCredit(e.target.value)}
            onBlur={() => commit("solarExportCreditPerKWh", credit)}
            aria-label="Solar export credit per kWh"
            className="h-7 w-20 rounded-md border border-glass-border bg-background px-1.5 text-right tabular-nums"
          />
        </label>
        <p className="text-[10px] text-muted-foreground">Leave empty to use the default. Changes apply to the AI plan and your plans alike.</p>
      </div>
    </details>
  );
}
