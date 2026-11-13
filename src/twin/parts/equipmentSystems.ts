// Which modeled system each equipment item belongs to, and how to read that system at an hour (docs/20).
// The engine models energy by zone and end use, not per appliance, so an item shows its system's modeled demand, labeled as the
// system's, once per system (items sharing a system point to it instead of repeating it).
import { END_USE_LABELS, ZONE_LABELS } from "@/engine/hotel";
import type { EndUse, EnergyResult, EquipmentCategory, EquipmentItem, UpgradeId, ZoneEndUseDay, ZoneId } from "@/engine/hotel";

export const CATEGORY_GROUPS: { id: EquipmentCategory; label: string }[] = [
  { id: "hvac", label: "HVAC and ventilation" },
  { id: "water", label: "Water heating" },
  { id: "lighting", label: "Lighting" },
  { id: "kitchen", label: "Kitchen and refrigeration" },
  { id: "laundry", label: "Laundry" },
  { id: "other", label: "Elevators and other equipment" },
  { id: "renewables", label: "Renewable energy" },
];

/** Kept for older readers. */
export type EquipmentGroup = EquipmentCategory;
export const GROUPS = CATEGORY_GROUPS;

interface SystemDef {
  endUses: EndUse[];
  /** Upgrades that act on this equipment. */
  upgrades: UpgradeId[];
}

const HVAC: EndUse[] = ["heating", "cooling", "ventilation"];

const BY_ID: Record<string, SystemDef> = {
  "room-hvac": { endUses: HVAC, upgrades: ["smart_room_controls", "energy_management", "insulation"] },
  "lobby-hvac": { endUses: HVAC, upgrades: ["energy_management", "occupancy_sensors", "insulation"] },
  "kitchen-hoods": { endUses: ["ventilation"], upgrades: ["energy_management"] },
  "central-plant": { endUses: HVAC, upgrades: ["hvac_upgrade", "energy_management"] },
  boilers: { endUses: ["heating"], upgrades: ["hvac_upgrade", "energy_management"] },
  chiller: { endUses: ["cooling"], upgrades: ["hvac_upgrade", "energy_management"] },
  "room-lighting": { endUses: ["lighting"], upgrades: ["led_lighting"] },
  "lobby-lighting": { endUses: ["lighting"], upgrades: ["led_lighting", "occupancy_sensors"] },
  "corridor-lighting": { endUses: ["lighting"], upgrades: ["led_lighting", "occupancy_sensors"] },
  "dhw-heater": { endUses: ["hotWater"], upgrades: ["water_heating"] },
  "dhw-storage": { endUses: ["hotWater"], upgrades: ["water_heating"] },
  "dhw-recirc": { endUses: ["hotWater"], upgrades: ["water_heating"] },
  "room-plug": { endUses: ["equipment"], upgrades: [] },
  "kitchen-range": { endUses: ["kitchen"], upgrades: [] },
  "kitchen-cold": { endUses: ["equipment"], upgrades: [] },
  elevators: { endUses: ["equipment"], upgrades: [] },
  laundry: { endUses: ["other"], upgrades: [] },
};

/** Added equipment: its system from what it is (heating, cooling, hot water, ...). */
function addedSystem(item: EquipmentItem): SystemDef {
  const levers = item.levers.map((l) => l.lever);
  if (levers.includes("heatingEfficiency")) return { endUses: ["heating"], upgrades: ["hvac_upgrade", "energy_management"] };
  if (levers.includes("coolingCop")) return { endUses: ["cooling"], upgrades: ["hvac_upgrade", "energy_management"] };
  switch (item.category) {
    case "hvac":
      return { endUses: ["ventilation"], upgrades: ["energy_management"] };
    case "water":
      return { endUses: ["hotWater"], upgrades: ["water_heating"] };
    case "lighting":
      return { endUses: ["lighting"], upgrades: ["led_lighting"] };
    case "kitchen":
      return { endUses: item.fuel === "gas" ? ["kitchen"] : ["equipment"], upgrades: [] };
    case "laundry":
      return { endUses: ["other"], upgrades: [] };
    case "renewables":
      return { endUses: [], upgrades: [] };
    default:
      return { endUses: ["equipment"], upgrades: [] };
  }
}

/** The system an item belongs to: its zone and end uses, a label, and a key shared by items on the same system. */
export function systemOf(item: EquipmentItem): SystemDef & { zone: ZoneId; label: string; key: string; group: EquipmentCategory } {
  const def = item.added ? addedSystem(item) : (BY_ID[item.id] ?? { endUses: ["equipment"] as EndUse[], upgrades: [] });
  const uses = def.endUses.length === 3 ? "HVAC" : def.endUses.map((u) => END_USE_LABELS[u].toLowerCase()).join(" and ");
  const zoneLabel = ZONE_LABELS[item.zone];
  const label = zoneLabel.toLowerCase() === uses ? zoneLabel : `${zoneLabel} ${uses}`.trim();
  return { ...def, zone: item.zone, label, key: `${item.zone}|${def.endUses.join(",")}`, group: item.category };
}

/** 1 therm per hour of gas is 29.3071 kW (thermal). */
const KW_PER_THERM_H = 29.3071;

export type ModeledStatus = "running" | "low" | "idle";

export interface SystemReading {
  /** Site kW at the hour (electricity plus gas converted), the day's peak, and the status from their ratio. */
  kWNow: number;
  kWPeak: number;
  /** The two fuels apart: electricity in kW and gas input in therms per hour (and kBtu per hour). */
  elecKWNow: number;
  gasThermsNow: number;
  gasKBtuHNow: number;
  status: ModeledStatus;
  costPerHour: number;
  annualCost: number;
  annualKWh: number;
  annualTherms: number;
  modeled: boolean;
}

/** Reads a system from the engine's typical day (hour) and annual cells. Status: running above 60% of the day's peak, idle below 15%. */
export function systemReading(
  day: Record<string, ZoneEndUseDay>,
  result: EnergyResult,
  zone: ZoneId,
  endUses: EndUse[],
  hour: number,
): SystemReading {
  const h = Math.max(0, Math.min(23, Math.round(hour)));
  const at = (t: number) =>
    endUses.reduce(
      (acc, u) => {
        const d = day[`${zone}|${u}`];
        if (!d) return acc;
        return { elec: acc.elec + (d.elecKW[t] ?? 0), gas: acc.gas + (d.gasThermsPerHour[t] ?? 0) };
      },
      { elec: 0, gas: 0 },
    );
  const series = Array.from({ length: 24 }, (_, t) => {
    const x = at(t);
    return x.elec + x.gas * KW_PER_THERM_H;
  });
  const now = at(h);
  const kWNow = series[h] ?? 0;
  const kWPeak = Math.max(0, ...series);
  const ratio = kWPeak > 0 ? kWNow / kWPeak : 0;
  const cells = result.cells.filter((c) => c.zone === zone && endUses.includes(c.endUse));
  return {
    kWNow,
    kWPeak,
    elecKWNow: now.elec,
    gasThermsNow: now.gas,
    gasKBtuHNow: now.gas * 100,
    status: ratio > 0.6 ? "running" : ratio >= 0.15 ? "low" : "idle",
    costPerHour: endUses.reduce((s, u) => s + (day[`${zone}|${u}`]?.costPerHour[h] ?? 0), 0),
    annualCost: cells.reduce((s, c) => s + c.cost, 0),
    annualKWh: cells.reduce((s, c) => s + c.elecKWh, 0),
    annualTherms: cells.reduce((s, c) => s + c.gasTherms, 0),
    modeled: cells.length > 0 && cells.some((c) => c.cost > 0),
  };
}

const num = (v: number) => v.toLocaleString("en-US", { maximumFractionDigits: v < 10 ? 1 : 0 });

/** "2 × 825 kBtu/h (1,650 kBtu/h total)": quantity and per-unit capacity kept apart (docs/20 audit). */
export function quantityText(i: EquipmentItem): string {
  if (!i.capacity) return `× ${i.count.toLocaleString("en-US")}`;
  const { value, unit } = i.capacity;
  if (i.count === 1) return `1 × ${num(value)} ${unit}`;
  return `${i.count.toLocaleString("en-US")} × ${num(value)} ${unit} (${num(i.count * value)} ${unit} total)`;
}
