import { hotelData } from "@/engine/hotel";
import type { FinancialBreakdown } from "@/engine/hotel/types";
import { useTwin } from "@/store/useTwin";
import { Button } from "@/components/ui/button";

export const formatRate = (rate: number) => rate.toLocaleString("en-US", { style: "percent", maximumFractionDigits: 1 });

export function NpvEstimate({ f, years }: { f: FinancialBreakdown; years: 5 | 10 }) {
  const value = years === 5 ? f.npv5 : f.npv10;
  if (!value || f.discountRate === undefined) return <span className="text-muted-foreground">Not available</span>;
  const money = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
  return <span className="inline-flex flex-col items-end gap-0.5"><span>{money(value.mid)}</span><span className="text-[11px] text-muted-foreground">{money(value.low)} to {money(value.high)}</span><span className="text-[11px] text-muted-foreground">at {formatRate(f.discountRate)} · Estimate</span></span>;
}

export function DiscountRateControl() {
  const rate = useTwin((s) => s.hotelDiscountRate);
  const setRate = useTwin((s) => s.setHotelDiscountRate);
  const rates = [hotelData.defaults.finance.discountRate, ...hotelData.defaults.finance.discountRateAlternatives];
  return <div className="space-y-2">
    <div className="flex flex-wrap items-center gap-2"><span className="text-xs font-medium">Discount rate</span><div role="group" aria-label="Discount rate" className="flex gap-1">{rates.map((value) => <Button key={value} size="sm" variant={rate === value ? "secondary" : "outline"} className="h-7 text-xs" aria-pressed={rate === value} onClick={() => setRate(value)}>{formatRate(value)}</Button>)}</div></div>
    <p className="text-[11px] leading-relaxed text-muted-foreground">8% is the default for commercial investment analysis; 3% is an alternative scenario (a product decision)</p>
  </div>;
}