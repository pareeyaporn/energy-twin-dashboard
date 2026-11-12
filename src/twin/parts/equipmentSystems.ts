// Which modeled system each estimated equipment item belongs to, and how to read that system at an hour.
// The engine models energy by zone and end use, not per appliance, so an item shows its system's modeled demand.
import { END_USE_LABELS, ZONE_LABELS } from "@/engine/hotel";
import type { EndUse, EnergyResult, EquipmentItem, UpgradeId, ZoneEndUseDay, ZoneId } from "@/engine/hotel";

export type EquipmentGroup = "hvac" | "water" | "lighting" | "other";

export const GROUPS: { id: EquipmentGroup; label: string }[] = [
  { id: "hvac", label: "HVAC and ventilation" },
  { id: "water", label: "Water heating" },
  { id: "lighting", label: "Lighting" },
  { id: "other", label: "Other systems" },
];

interface SystemDef {
  group: EquipmentGroup;
  endUses: EndUse[];
  /** Upgrades that act on this equipment. */
  upgrades: UpgradeId[];
}

const HVAC: EndUse[] = ["heating", "cooling", "ventilation"];

const BY_ID: Record<string, SystemDef> = {
  "room-hvac": { group: "hvac", endUses: HVAC, upgrades: ["smart_room_controls", "energy_management", "insulation"] },
  "lobby-hvac": { group: "hvac", endUses: HVAC, upgrades: ["energy_management", "occupancy_sensors", "insulation"] },
  "kitchen-hoods": { group: "hvac", endUses: ["ventilation"], upgrades: ["energy_management"] },
  "central-plant": { group: "hvac", endUses: HVAC, upgrades: ["hvac_upgrade", "energy_management"] },
  boilers: { group: "hvac", endUses: ["heating"], upgrades: ["hvac_upgrade", "energy_management"] },
  chiller: { group: "hvac", endUses: ["cooling"], upgrades: ["hvac_upgrade", "energy_management"] },
  "room-lighting": { group: "lighting", endUses: ["lighting"], upgrades: ["led_lighting"] },
  "lobby-lighting": { group: "lighting", endUses: ["lighting"], upgrades: ["led_lighting", "occupancy_sensors"] },
  "corridor-lighting": { group: "lighting", endUses: ["lighting"], upgrades: ["led_lighting", "occupancy_sensors"] },
  "dhw-heater": { group: "water", endUses: ["hotWater"], upgrades: ["water_heating"] },
  "dhw-storage": { group: "water", endUses: ["hotWater"], upgrades: ["water_heating"] },
  "dhw-recirc": { group: "water", endUses: ["hotWater"], upgrades: ["water_heating"] },
  "room-plug": { group: "other", endUses: ["equipment"], upgrades: [] },
  "kitchen-range": { group: "other", endUses: ["kitchen"], upgrades: [] },
  "kitchen-cold": { group: "other", endUses: ["equipment"], upgrades: [] },
  elevators: { group: "other", endUses: ["equipment"], upgrades: [] },
  laundry: { group: "other", endUses: ["other"], upgrades: [] },
};

/** The system an item belongs to: its group, zone and end uses (unknown items fall back to "other" in their zone). */
export function systemOf(item: EquipmentItem): SystemDef & { zone: ZoneId; label: string } {
  const def = BY_ID[item.id] ?? { group: "other" as const, endUses: ["equipment"] as EndUse[], upgrades: [] };
  const uses = def.endUses.length === 3 ? "HVAC" : def.endUses.map((u) => END_USE_LABELS[u].toLowerCase()).join(", ");
  return { ...def, zone: item.zone, label: `${ZONE_LABELS[item.zone]} ${uses}` };
}

/** 1 therm per hour of gas is 29.3071 kW. */
const KW_PER_THERM_H = 29.3071;

export type ModeledStatus = "running" | "low" | "idle";

export interface SystemReading {
  /** Site kW at the hour (electricity plus gas converted), the day's peak, and the status from their ratio. */
  kWNow: number;
  kWPeak: number;
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
  const kwAt = (t: number) =>
    endUses.reduce((s, u) => {
      const d = day[`${zone}|${u}`];
      return s + (d ? (d.elecKW[t] ?? 0) + (d.gasThermsPerHour[t] ?? 0) * KW_PER_THERM_H : 0);
    }, 0);
  const series = Array.from({ length: 24 }, (_, t) => kwAt(t));
  const kWNow = series[h] ?? 0;
  const kWPeak = Math.max(0, ...series);
  const ratio = kWPeak > 0 ? kWNow / kWPeak : 0;
  const cells = result.cells.filter((c) => c.zone === zone && endUses.includes(c.endUse));
  return {
    kWNow,
    kWPeak,
    status: ratio > 0.6 ? "running" : ratio >= 0.15 ? "low" : "idle",
    costPerHour: endUses.reduce((s, u) => s + (day[`${zone}|${u}`]?.costPerHour[h] ?? 0), 0),
    annualCost: cells.reduce((s, c) => s + c.cost, 0),
    annualKWh: cells.reduce((s, c) => s + c.elecKWh, 0),
    annualTherms: cells.reduce((s, c) => s + c.gasTherms, 0),
    modeled: cells.length > 0 && cells.some((c) => c.cost > 0),
  };
}
