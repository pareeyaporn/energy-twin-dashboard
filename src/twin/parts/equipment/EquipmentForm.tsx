import { useMemo, useState } from "react";
import { KG_PER_LB, ZONE_IDS, ZONE_LABELS, equipmentTemplates, estimatedInventory, holdsRefrigerant, refrigerantOptions, validateEquipment } from "@/engine/hotel";
import type { EquipmentItem, EquipmentLever, EquipmentOverride, EquipmentTemplate, LeverValue, ZoneId } from "@/engine/hotel";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useTwin } from "@/store/useTwin";
import type { EquipmentSettings } from "@/store/useTwin";
import { CATEGORY_GROUPS } from "../equipmentSystems";

const inputCls = "w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm aria-[invalid=true]:border-heat";

/** How an efficiency is typed: thermal efficiency and LED share as a percentage, COP as a number. */
export const asPercent = (l: Pick<LeverValue, "kind">) => l.kind === "thermal" || l.kind === "ledShare";
const show = (l: LeverValue, v: number) => (asPercent(l) ? String(Math.round(v * 1000) / 10) : String(Math.round(v * 100) / 100));
const unitOf = (l: LeverValue) => (l.kind === "ledShare" ? "% LED" : l.kind === "thermal" ? "%" : l.kind === "kw" ? "kW DC" : "COP");

interface Draft {
  label: string;
  quantity: string;
  capacity: string;
  zone: ZoneId;
  schedule: string;
  ageYears: string;
  notes: string;
  refrigerantType: string;
  refrigerantLbs: string;
  levers: Partial<Record<EquipmentLever, string>>;
  lightingHours: string;
  commonHvacHours: string;
  smartControls: boolean;
}

function draftOf(item: EquipmentItem, hours: { lighting: number; commonHvac: number; smart: boolean }): Draft {
  return {
    label: item.label,
    quantity: String(item.count),
    capacity: item.capacity ? String(Math.round(item.capacity.value * 100) / 100) : "",
    zone: item.zone,
    schedule: item.schedule,
    ageYears: item.ageYears !== undefined ? String(item.ageYears) : "",
    notes: item.notes ?? "",
    refrigerantType: item.refrigerant?.type ?? "",
    refrigerantLbs: item.refrigerant ? String(item.refrigerant.lbsPerYear) : "",
    levers: Object.fromEntries(item.levers.filter((l) => l.lever !== "existingSolarKw").map((l) => [l.lever, show(l, l.value)])),
    lightingHours: String(hours.lighting),
    commonHvacHours: String(hours.commonHvac),
    smartControls: hours.smart,
  };
}

const num = (s: string) => (s.trim() === "" ? undefined : Number(s));

/**
 * Turns a draft into the item's override: only fields that differ from the estimate are kept (so they show as user-entered), and
 * efficiencies typed as a percentage are stored as fractions. Hotel settings (lighting hours, common-area HVAC hours, smart room
 * controls) go to the hotel's own inputs, not into the equipment list.
 */
function overrideOf(item: EquipmentItem, estimate: EquipmentItem | undefined, d: Draft): { override: EquipmentOverride; problems: Record<string, string> } {
  const problems: Record<string, string> = {};
  const o: EquipmentOverride = { id: item.id, ...(item.template ? { template: item.template } : {}) };
  const ref = estimate ?? item;
  const changed = (a: number | undefined, b: number | undefined) => a !== undefined && (b === undefined || Math.abs(a - b) > 1e-9);
  if (d.label.trim() !== ref.label || item.added) o.label = d.label.trim();
  const q = num(d.quantity);
  if (q === undefined || !Number.isFinite(q)) problems["quantity"] = "Enter a quantity.";
  else if (changed(q, ref.count) || item.added) o.quantity = q;
  if (item.capacity) {
    const c = num(d.capacity);
    if (c !== undefined && !Number.isFinite(c)) problems["capacity"] = "Enter a number.";
    else if (c !== undefined && (changed(c, ref.capacity?.value) || item.added)) o.capacity = c;
  }
  if (item.added && d.zone !== item.zone) o.zone = d.zone;
  if (d.schedule.trim() && d.schedule.trim() !== ref.schedule) o.schedule = d.schedule.trim();
  const age = num(d.ageYears);
  if (age !== undefined) {
    if (!Number.isFinite(age)) problems["ageYears"] = "Enter a number of years.";
    else o.ageYears = age;
  }
  if (d.notes.trim()) o.notes = d.notes.trim();
  if (holdsRefrigerant(item) && (d.refrigerantType || d.refrigerantLbs.trim())) {
    const lbs = num(d.refrigerantLbs);
    if (!d.refrigerantType) problems["refrigerant"] = "Choose the refrigerant.";
    else if (lbs === undefined || !Number.isFinite(lbs)) problems["refrigerant"] = "Enter the pounds added in a year (0 if none).";
    else o.refrigerant = { type: d.refrigerantType, lbsPerYear: lbs };
  }
  const levers: Partial<Record<EquipmentLever, number>> = {};
  for (const l of item.levers) {
    if (l.lever === "existingSolarKw") continue;
    const raw = d.levers[l.lever];
    const v = raw === undefined ? undefined : num(raw);
    if (v === undefined) continue;
    if (!Number.isFinite(v)) {
      problems[`levers.${l.lever}`] = "Enter a number.";
      continue;
    }
    const value = asPercent(l) ? v / 100 : v;
    const est = ref.levers.find((x) => x.lever === l.lever)?.estimate ?? l.estimate;
    if (changed(value, est) || item.added) levers[l.lever] = value;
  }
  if (Object.keys(levers).length === 1 && item.levers.filter((l) => l.lever !== "existingSolarKw").length === 1) o.efficiency = Object.values(levers)[0]!;
  else if (Object.keys(levers).length) o.levers = levers;
  return { override: o, problems };
}

export type EditorMode = { kind: "edit"; item: EquipmentItem } | { kind: "add"; template?: string };

/** The add / edit dialog: fields for the item's kind, validated by the engine before anything is saved. */
export function EquipmentForm({ mode, onClose }: { mode: EditorMode; onClose: () => void }) {
  const hotel = useTwin((s) => s.hotel);
  const input = useTwin((s) => s.hotelInput);
  const setEquipment = useTwin((s) => s.setEquipment);
  const templates = equipmentTemplates();
  const [category, setCategory] = useState<string>(mode.kind === "add" ? (templates.find((t) => t.id === mode.template)?.category ?? "hvac") : "");
  const [templateId, setTemplateId] = useState<string>(mode.kind === "add" ? (mode.template ?? templates.find((t) => t.category === "hvac")?.id ?? "") : "");
  const template: EquipmentTemplate | undefined = templates.find((t) => t.id === templateId);
  const estimates = useMemo(() => estimatedInventory(hotel.profile), [hotel.profile]);
  const nextId = useMemo(() => {
    const used = new Set((input.equipment ?? []).map((o) => o.id));
    let n = 1;
    while (used.has(`added-${n}`)) n++;
    return `added-${n}`;
  }, [input.equipment]);
  // The item being edited, or a fresh one from the template (the engine builds it, so defaults match the docs).
  const item = useMemo<EquipmentItem | null>(() => {
    if (mode.kind === "edit") return mode.item;
    if (!template) return null;
    return {
      id: nextId,
      template: template.id,
      zone: template.zone,
      label: template.label,
      category: template.category,
      count: 1,
      capacity: { value: template.defaultCapacity ?? 0, unit: template.capacityUnit },
      fuel: template.fuel,
      schedule: template.defaultSchedule ?? "",
      efficiency: "",
      levers:
        template.lever === "existingSolarKw"
          ? [{ lever: "existingSolarKw", kind: "kw", value: 0, estimate: 0, label: "kW DC" }]
          : template.lever && template.efficiencyKind
            ? [{ lever: template.lever, kind: template.efficiencyKind, value: template.defaultEfficiency ?? 0, estimate: template.defaultEfficiency ?? 0, label: template.efficiencyKind === "thermal" ? "thermal efficiency" : "COP" }]
            : [],
      roles: [],
      modelNote: template.note ?? (template.lever ? "Feeds the simulation through its efficiency." : "Informational: adding it does not change modeled consumption."),
      source: "",
      estimated: false,
      userEntered: [],
      added: true,
    };
  }, [mode, template, nextId, hotel.profile]);
  const hours = { lighting: hotel.profile.lightingHoursPerDay, commonHvac: hotel.profile.commonAreaHvacHours, smart: hotel.profile.smartRoomControls };
  const [draft, setDraft] = useState<Draft | null>(() => (item ? draftOf(item, hours) : null));
  const [draftFor, setDraftFor] = useState<string | null>(item ? `${item.id}|${item.template ?? ""}` : null);
  if (item && draftFor !== `${item.id}|${item.template ?? ""}`) {
    setDraft(draftOf(item, hours));
    setDraftFor(`${item.id}|${item.template ?? ""}`);
  }
  const d = draft;
  const estimate = item && !item.added ? estimates.find((e) => e.id === item.id) : undefined;
  const scheduleSetting = item?.id === "lobby-lighting" || item?.id === "corridor-lighting" ? "lighting" : item?.id === "lobby-hvac" ? "commonHvac" : null;
  const smartSetting = item?.id === "room-hvac";

  // Validate the whole list as it would be saved, with the engine's own rules.
  const check = useMemo(() => {
    if (!item || !d) return null;
    const { override, problems } = overrideOf(item, estimate, d);
    const others = (input.equipment ?? []).filter((o) => o.id !== item.id);
    const nextList = Object.keys(override).length > 1 || item.added ? [...others, override] : others;
    const v = validateEquipment(nextList, hotel.profile);
    for (const p of v.problems) if (p.id === item.id && p.severity === "error" && p.field) problems[p.field] = p.message;
    const settings: EquipmentSettings = {};
    const lh = num(d.lightingHours);
    const ch = num(d.commonHvacHours);
    if (scheduleSetting === "lighting") {
      if (lh === undefined || !Number.isFinite(lh) || lh < 0 || lh > 24) problems["lightingHours"] = "Hours must be 0 to 24.";
      else if (lh !== hotel.profile.lightingHoursPerDay) settings.lightingHoursPerDay = lh;
    }
    if (scheduleSetting === "commonHvac") {
      if (ch === undefined || !Number.isFinite(ch) || ch < 0 || ch > 24) problems["commonHvacHours"] = "Hours must be 0 to 24.";
      else if (ch !== hotel.profile.commonAreaHvacHours) settings.commonAreaHvacHours = ch;
    }
    if (smartSetting && d.smartControls !== hotel.profile.smartRoomControls) settings.smartRoomControls = d.smartControls;
    const warnings = v.problems.filter((p) => p.severity === "warning").map((p) => p.message);
    return { nextList, problems, settings, warnings };
  }, [item, d, estimate, input.equipment, hotel.profile, scheduleSetting, smartSetting]);

  const set = (patch: Partial<Draft>) => setDraft((x) => (x ? { ...x, ...patch } : x));
  const err = (f: string) => check?.problems[f];
  const save = () => {
    if (!check || Object.keys(check.problems).length) return;
    setEquipment(check.nextList, check.settings);
    onClose();
  };
  const title = mode.kind === "add" ? "Add equipment" : `Edit ${mode.item.label}`;
  const field = (id: string, label: string, node: React.ReactNode, hint?: string, f?: string) => (
    <label key={id} htmlFor={id} className="block text-xs">
      <span className="mb-1 block font-medium">{label}</span>
      {node}
      {hint && <span className="mt-0.5 block text-[11px] text-muted-foreground">{hint}</span>}
      {f && err(f) && <span className="mt-0.5 block text-[11px] text-heat" role="alert">{err(f)}</span>}
    </label>
  );

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto" data-testid="equipment-form">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            This is the equipment installed in the hotel today. Correcting it recalculates the baseline; it is not an investment and never shows as savings.
          </DialogDescription>
        </DialogHeader>
        {mode.kind === "add" && (
          <div className="grid gap-3 sm:grid-cols-2">
            {field("eq-category", "Category", (
              <select id="eq-category" className={inputCls} value={category} onChange={(e) => { setCategory(e.target.value); setTemplateId(templates.find((t) => t.category === e.target.value)?.id ?? ""); }}>
                {CATEGORY_GROUPS.filter((g) => templates.some((t) => t.category === g.id)).map((g) => <option key={g.id} value={g.id}>{g.label}</option>)}
              </select>
            ))}
            {field("eq-template", "Equipment type", (
              <select id="eq-template" className={inputCls} value={templateId} onChange={(e) => setTemplateId(e.target.value)} data-testid="eq-template">
                {templates.filter((t) => t.category === category).map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
            ))}
          </div>
        )}
        {item && d && (
          <div className="space-y-3">
            <p className="rounded-md border border-glass-border bg-background/40 p-2 text-[11px] text-muted-foreground">{item.modelNote}</p>
            {field("eq-label", "Name", <input id="eq-label" className={inputCls} value={d.label} maxLength={80} onChange={(e) => set({ label: e.target.value })} aria-invalid={!!err("label")} />, undefined, "label")}
            <div className="grid gap-3 sm:grid-cols-2">
              {field("eq-qty", "Quantity", <input id="eq-qty" inputMode="numeric" className={inputCls} value={d.quantity} onChange={(e) => set({ quantity: e.target.value })} aria-invalid={!!err("quantity")} data-testid="eq-quantity" />, "Number of units", "quantity")}
              {item.capacity && field("eq-cap", `Capacity per unit (${item.capacity.unit})`, <input id="eq-cap" inputMode="decimal" className={inputCls} value={d.capacity} onChange={(e) => set({ capacity: e.target.value })} aria-invalid={!!err("capacity")} data-testid="eq-capacity" />, item.levers.some((l) => l.lever === "existingSolarKw") ? "Array size; sets the generation" : item.id === "boilers" || item.id === "chiller" ? "Sets the replacement cost basis" : "Informational", "capacity")}
            </div>
            {item.levers.filter((l) => l.lever !== "existingSolarKw").map((l) =>
              field(`eq-lev-${l.lever}`, `${l.label[0]!.toUpperCase()}${l.label.slice(1)} (${unitOf(l)})`, (
                <input id={`eq-lev-${l.lever}`} inputMode="decimal" className={inputCls} value={d.levers[l.lever] ?? ""} onChange={(e) => set({ levers: { ...d.levers, [l.lever]: e.target.value } })} aria-invalid={!!err(`levers.${l.lever}`) || (!!err("efficiency") && item.levers.length === 1)} data-testid={`eq-lever-${l.lever}`} />
              ), `Estimate: ${show(l, l.estimate)}${asPercent(l) ? "%" : ""}. Changes the modeled baseline.`, item.levers.filter((x) => x.lever !== "existingSolarKw").length === 1 ? "efficiency" : `levers.${l.lever}`),
            )}
            {scheduleSetting === "lighting" && field("eq-lh", "Lighting hours per day (hotel setting)", <input id="eq-lh" inputMode="decimal" className={inputCls} value={d.lightingHours} onChange={(e) => set({ lightingHours: e.target.value })} aria-invalid={!!err("lightingHours")} />, "The hotel's lighting schedule for lobbies and corridors; changes the model.", "lightingHours")}
            {scheduleSetting === "commonHvac" && field("eq-ch", "Common-area HVAC hours per day (hotel setting)", <input id="eq-ch" inputMode="decimal" className={inputCls} value={d.commonHvacHours} onChange={(e) => set({ commonHvacHours: e.target.value })} aria-invalid={!!err("commonHvacHours")} />, "Changes the model.", "commonHvacHours")}
            {smartSetting && (
              <label className="flex items-start gap-2 text-xs">
                <input type="checkbox" checked={d.smartControls} onChange={(e) => set({ smartControls: e.target.checked })} className="mt-0.5" data-testid="eq-smart" />
                <span>
                  <span className="font-medium">Smart guest-room controls already installed</span>
                  <span className="block text-[11px] text-muted-foreground">Vacant rooms are set back in the baseline, and the upgrade is no longer offered.</span>
                </span>
              </label>
            )}
            {item.added && field("eq-zone", "Zone", (
              <select id="eq-zone" className={inputCls} value={d.zone} onChange={(e) => set({ zone: e.target.value as ZoneId })}>
                {ZONE_IDS.map((z) => <option key={z} value={z}>{ZONE_LABELS[z]}</option>)}
              </select>
            ))}
            {!scheduleSetting && field("eq-sched", "Operating schedule", <input id="eq-sched" className={inputCls} value={d.schedule} maxLength={120} onChange={(e) => set({ schedule: e.target.value })} />, "Informational")}
            <div className="grid gap-3 sm:grid-cols-2">
              {field("eq-age", "Age (years)", <input id="eq-age" inputMode="numeric" className={inputCls} value={d.ageYears} onChange={(e) => set({ ageYears: e.target.value })} aria-invalid={!!err("ageYears")} />, "Informational", "ageYears")}
              {field("eq-notes", "Notes", <input id="eq-notes" className={inputCls} value={d.notes} maxLength={500} onChange={(e) => set({ notes: e.target.value })} />)}
            </div>
            {holdsRefrigerant(item) && (() => {
              const opt = refrigerantOptions().find((r) => r.id === d.refrigerantType);
              const lbs = num(d.refrigerantLbs);
              const kg = opt?.gwp != null && lbs !== undefined && Number.isFinite(lbs) ? lbs * KG_PER_LB * opt.gwp : null;
              return (
                <div className="grid gap-3 sm:grid-cols-2" data-testid="eq-refrigerant">
                  {field("eq-ref-type", "Refrigerant (service records)", (
                    <select id="eq-ref-type" className={inputCls} value={d.refrigerantType} onChange={(e) => set({ refrigerantType: e.target.value })} aria-invalid={!!err("refrigerant")}>
                      <option value="">Not entered</option>
                      {refrigerantOptions().map((r) => <option key={r.id} value={r.id}>{r.label}{r.gwp !== null ? ` (GWP ${r.gwp.toLocaleString("en-US")})` : ""}</option>)}
                    </select>
                  ), opt?.typicalUse ?? "Carbon only; never changes energy or cost.")}
                  {field("eq-ref-lbs", "Pounds added in a year (to replace leaks)", <input id="eq-ref-lbs" inputMode="decimal" className={inputCls} value={d.refrigerantLbs} onChange={(e) => set({ refrigerantLbs: e.target.value })} aria-invalid={!!err("refrigerant")} />,
                    opt && opt.gwp === null ? "R-22 is ozone-depleting and outside EPA's greenhouse-gas inventory: recorded, not counted." : kg !== null ? `About ${(kg / 1000).toLocaleString("en-US", { maximumFractionDigits: 1 })} t CO₂e a year (lb × 0.454 × GWP, EPA).` : "From the service contractor's records.", "refrigerant")}
                </div>
              );
            })()}
            {check?.warnings.map((w) => <p key={w} className="text-[11px] text-heat">{w}</p>)}
          </div>
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={!check || Object.keys(check.problems).length > 0} data-testid="eq-save">{mode.kind === "add" ? "Add to current equipment" : "Save correction"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
