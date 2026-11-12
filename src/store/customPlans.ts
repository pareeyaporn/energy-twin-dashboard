// Custom investment plans in the store: types and browser storage. Plans hold only the user's choices (upgrade ids and quantities);
// every number is computed from them by the engine (`evaluatePlan`), so stored plans can never carry stale figures.
import { CATALOG_IDS } from "@/engine/hotel";
import type { PlanItem, UpgradeId } from "@/engine/hotel";

export interface CustomPlan {
  id: string;
  name: string;
  items: PlanItem[];
  /** Set when the plan was copied from an AI package (its label), for display. */
  copiedFrom?: string;
  /** The portfolio property the plan was made for; plans without one (made before the portfolio existed) show everywhere. */
  propertyId?: string;
}

export const PLANS_STORAGE_KEY = "energy-twin:custom-plans:v1";

interface Stored {
  version: 1;
  plans: CustomPlan[];
  next: number;
  active: string | null;
}

/** Keeps only valid plans and items (known upgrade ids, finite quantities). */
export function sanitizePlans(raw: unknown): { plans: CustomPlan[]; next: number; active: string | null } {
  const empty = { plans: [], next: 1, active: null };
  if (!raw || typeof raw !== "object") return empty;
  const r = raw as Partial<Stored>;
  if (r.version !== 1 || !Array.isArray(r.plans)) return empty;
  const plans: CustomPlan[] = [];
  for (const p of r.plans) {
    if (!p || typeof p.id !== "string" || typeof p.name !== "string" || !Array.isArray(p.items)) continue;
    const items: PlanItem[] = [];
    for (const it of p.items) {
      if (!it || !CATALOG_IDS.includes(it.id as UpgradeId) || items.some((x) => x.id === it.id)) continue;
      items.push(typeof it.quantity === "number" && Number.isFinite(it.quantity) ? { id: it.id, quantity: it.quantity } : { id: it.id });
    }
    plans.push({ id: p.id, name: p.name.slice(0, 80), items, ...(typeof p.copiedFrom === "string" ? { copiedFrom: p.copiedFrom } : {}), ...(typeof p.propertyId === "string" ? { propertyId: p.propertyId } : {}) });
  }
  const next = typeof r.next === "number" && Number.isFinite(r.next) ? Math.max(1, Math.floor(r.next)) : plans.length + 1;
  const active = typeof r.active === "string" && plans.some((p) => p.id === r.active) ? r.active : (plans[0]?.id ?? null);
  return { plans, next, active };
}

export function readStoredPlans(): ReturnType<typeof sanitizePlans> {
  try {
    if (typeof window === "undefined" || !window.localStorage) return sanitizePlans(null);
    const txt = window.localStorage.getItem(PLANS_STORAGE_KEY);
    return sanitizePlans(txt ? JSON.parse(txt) : null);
  } catch {
    return sanitizePlans(null);
  }
}

export function writeStoredPlans(plans: CustomPlan[], next: number, active: string | null): void {
  try {
    if (typeof window === "undefined" || !window.localStorage) return;
    const data: Stored = { version: 1, plans, next, active };
    window.localStorage.setItem(PLANS_STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Storage full or blocked (private mode): plans still work for this visit.
  }
}
