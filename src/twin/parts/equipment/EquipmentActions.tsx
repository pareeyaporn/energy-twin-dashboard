import { useMemo } from "react";
import { evaluatePackage, replacementUpgrade, upgradeDef, validateEquipment } from "@/engine/hotel";
import type { EquipmentItem, PackageEvaluation, UpgradeId } from "@/engine/hotel";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useTwin } from "@/store/useTwin";
import { selectPlanContext } from "@/store/hotelDerived";
import { usd } from "../../format";

/** Confirm removing an item: says what changes in the model, and blocks removing the last heating, cooling or hot-water equipment. */
export function RemoveDialog({ item, onClose }: { item: EquipmentItem; onClose: () => void }) {
  const hotel = useTwin((s) => s.hotel);
  const stored = useTwin((s) => s.hotelInput.equipment);
  const list = stored ?? [];
  const setEquipment = useTwin((s) => s.setEquipment);
  const next = item.added ? list.filter((o) => o.id !== item.id) : [...list.filter((o) => o.id !== item.id), { ...(list.find((o) => o.id === item.id) ?? { id: item.id }), removed: true }];
  const blocked = useMemo(() => validateEquipment(next, hotel.profile).problems.find((p) => p.id === item.id && p.field === "removed"), [next, hotel.profile, item.id]);
  const consequence = blocked
    ? blocked.message
    : item.levers.some((l) => l.lever === "existingSolarKw")
      ? "Its generation will no longer lower the hotel's purchased electricity."
      : item.levers.length
        ? "The model will use the efficiency of the remaining equipment of this kind (or the estimate if none is left)."
        : "This is informational equipment: the modeled energy does not change.";
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md" data-testid="equipment-remove">
        <DialogHeader>
          <DialogTitle>Remove {item.label}?</DialogTitle>
          <DialogDescription>{consequence}</DialogDescription>
        </DialogHeader>
        {!blocked && <p className="text-xs text-muted-foreground">You can undo this, or restore the sample equipment at any time.</p>}
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="destructive" disabled={!!blocked} onClick={() => { setEquipment(next); onClose(); }} data-testid="eq-remove-confirm">Remove</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const TARGET: Record<string, string> = {
  hvac_upgrade: "High-efficiency HVAC equipment (condensing boiler about 0.92, higher-efficiency chiller or units)",
  led_lighting: "LED fixtures for the rest of the lighting",
  water_heating: "0.90 thermal-efficiency water heaters and low-flow fixtures",
  rooftop_solar: "More rooftop solar, on the roof left",
};

/** The engine's evaluation of an upgrade against the current hotel (the same calculation as the optimizer and custom plans). */
function useProposal(id: UpgradeId | null): { e: PackageEvaluation | null; error: string | null } {
  const ctx = useTwin(selectPlanContext);
  return useMemo(() => {
    if (!id) return { e: null, error: null };
    try {
      return { e: evaluatePackage(ctx, [id]), error: null };
    } catch (err) {
      return { e: null, error: err instanceof Error ? err.message : "Not available for this hotel." };
    }
  }, [ctx, id]);
}

function Comparison({ item, id }: { item: EquipmentItem; id: UpgradeId }) {
  const { e, error } = useProposal(id);
  const add = useTwin((s) => s.addPlanUpgrade);
  const def = upgradeDef(id);
  if (!e) return <p className="text-xs text-muted-foreground">{error ?? "Not available."}</p>;
  const f = e.financials;
  const rows: [string, string, string][] = [
    ["Equipment", `${item.label} · ${item.efficiency}`, TARGET[id] ?? def.label],
    ["Installed cost", "—", `${usd(f.grossCost.mid)} (${usd(f.grossCost.low)} to ${usd(f.grossCost.high)})`],
    ["Net after confirmed incentives", "—", usd(f.netInvestment.mid)],
    ["Energy a year", "today", `−${Math.round(f.annualEnergySavings.elecKWh).toLocaleString("en-US")} kWh, −${Math.round(f.annualEnergySavings.gasTherms).toLocaleString("en-US")} therms`],
    ["Energy cost a year", usd(e.newAnnualCost + f.annualSavings.mid), `${usd(e.newAnnualCost)} (saves ${usd(f.annualSavings.mid)})`],
    ["CO₂ a year", "today", `−${(f.carbonAvoidedKgPerYear.mid / 1000).toFixed(1)} t`],
    ["Payback", "—", f.simplePaybackYears === null ? "does not pay back" : `${f.simplePaybackYears.toFixed(1)} years`],
    ["NPV, 10 years", "—", f.npv10 ? usd(f.npv10.mid) : "—"],
  ];
  return (
    <div className="space-y-2" data-testid="equipment-comparison">
      <table className="w-full text-xs">
        <caption className="sr-only">Current equipment against the proposed upgrade, estimates</caption>
        <thead>
          <tr className="text-left text-muted-foreground"><th className="p-1 font-medium" scope="col"></th><th className="p-1 font-medium" scope="col">Current</th><th className="p-1 font-medium" scope="col">Proposed</th></tr>
        </thead>
        <tbody>
          {rows.map(([k, a, b]) => (
            <tr key={k} className="border-t border-border/50"><th scope="row" className="p-1 text-left font-normal text-muted-foreground">{k}</th><td className="p-1">{a}</td><td className="num p-1">{b}</td></tr>
          ))}
        </tbody>
      </table>
      <p className="text-[11px] text-muted-foreground">
        Whole-hotel upgrade: {def.label}{id === "hvac_upgrade" ? " covers the heating and the cooling equipment together" : ""}. Measured against your current equipment by the same engine as the optimizer; estimates, not quotes.
      </p>
      <Button size="sm" variant="accentOutline" onClick={() => add(id)} data-testid="eq-add-to-plan">Add to my plan</Button>
    </div>
  );
}

/** Replace: the current item next to the upgrade the model has for it, or "needs more information". */
export function ReplaceDialog({ item, onClose }: { item: EquipmentItem; onClose: () => void }) {
  const id = replacementUpgrade(item);
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto" data-testid="equipment-replace">
        <DialogHeader>
          <DialogTitle>Replace {item.label}</DialogTitle>
          <DialogDescription>A proposed upgrade: evaluated against the hotel as it is today. It changes nothing until you add it to a plan and apply it.</DialogDescription>
        </DialogHeader>
        {id ? <Comparison item={item} id={id} /> : <NeedsInfo item={item} />}
        <DialogFooter><Button variant="ghost" onClick={onClose}>Close</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function NeedsInfo({ item }: { item: EquipmentItem }) {
  return (
    <p className="rounded-md border border-dashed border-glass-border p-2 text-xs text-muted-foreground" data-testid="equipment-needs-info">
      Needs more information: the model has no replacement measure or sourced cost for {item.label.toLowerCase()}
      {item.template === "heat_pump_water_heater" ? " (a heat-pump water heater changes the fuel, which the model does not simulate yet)" : ""}. Energy Twin does not invent equipment costs or savings.
    </p>
  );
}

/** "Proposed upgrades": one row per replaceable system, from the current equipment, evaluated by the engine. */
export function ProposedUpgrades({ items }: { items: EquipmentItem[] }) {
  const byUpgrade = new Map<UpgradeId, EquipmentItem[]>();
  const unknown: EquipmentItem[] = [];
  for (const i of items) {
    const id = replacementUpgrade(i);
    if (id) byUpgrade.set(id, [...(byUpgrade.get(id) ?? []), i]);
    else if (i.added) unknown.push(i);
  }
  return (
    <div className="space-y-4" data-testid="proposed-upgrades">
      <p className="text-xs text-muted-foreground">
        Upgrades you could make to the current equipment, each measured against the hotel as it is today. The investment optimizer and Build your own plan
        use the same figures; nothing here changes the baseline.
      </p>
      {[...byUpgrade.entries()].map(([id, list]) => (
        <section key={id} className="rounded-xl border border-glass-border bg-glass p-3" aria-label={upgradeDef(id).label}>
          <h4 className="mb-1 text-sm font-semibold">{upgradeDef(id).label}</h4>
          <p className="mb-2 text-[11px] text-muted-foreground">Replaces: {list.map((i) => i.label).join(", ")}</p>
          <Comparison item={list[0]!} id={id} />
        </section>
      ))}
      {unknown.map((i) => <NeedsInfo key={i.id} item={i} />)}
    </div>
  );
}
