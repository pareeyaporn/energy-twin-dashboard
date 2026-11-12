import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useTwin } from "@/store/useTwin";
import { selectCatalog, selectCustomPlanEvaluation, selectPlanExplanation } from "@/store/hotelDerived";
import { PLANS_STORAGE_KEY, sanitizePlans } from "@/store/customPlans";

const get = () => useTwin.getState();
function resetPlans() {
  window.localStorage.clear();
  useTwin.setState({ customPlans: [], activeCustomPlanId: null, nextPlanNumber: 1, customPlansHydrated: false });
}

describe("custom plans in the store", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    get().resetHotel();
    resetPlans();
  });
  afterEach(() => vi.useRealTimers());

  it("creates, edits, duplicates, renames and deletes plans, and stores them in local storage", () => {
    get().addPlanUpgrade("led_lighting");
    expect(get().customPlans).toHaveLength(1);
    get().addPlanUpgrade("smart_room_controls", 40);
    get().setPlanQuantity("led_lighting", 50);
    const plan = get().customPlans[0]!;
    expect(plan.items).toEqual([{ id: "led_lighting", quantity: 50 }, { id: "smart_room_controls", quantity: 40 }]);
    const ev = selectCustomPlanEvaluation(get())!;
    expect(ev.evaluation!.upgradeIds).toEqual(["led_lighting", "smart_room_controls"]);
    expect(selectCustomPlanEvaluation(get())).toBe(ev); // memoized

    const copy = get().duplicateCustomPlan(plan.id)!;
    expect(get().activeCustomPlanId).toBe(copy);
    get().renameCustomPlan(copy, "  Lobby first  ");
    expect(get().customPlans.find((p) => p.id === copy)!.name).toBe("Lobby first");
    get().removePlanUpgrade("smart_room_controls");
    expect(get().customPlans.find((p) => p.id === copy)!.items).toEqual([{ id: "led_lighting", quantity: 50 }]);
    expect(get().customPlans.find((p) => p.id === plan.id)!.items).toHaveLength(2); // the original is untouched

    const stored = JSON.parse(window.localStorage.getItem(PLANS_STORAGE_KEY)!);
    expect(stored.plans).toHaveLength(2);
    get().deleteCustomPlan(copy);
    expect(get().customPlans).toHaveLength(1);
    expect(get().activeCustomPlanId).toBe(plan.id);

    // A new visit reads them back
    useTwin.setState({ customPlans: [], activeCustomPlanId: null, customPlansHydrated: false });
    get().hydrateCustomPlans();
    expect(get().customPlans.map((p) => p.name)).toEqual([plan.name]);
    // Resetting the hotel keeps the user's plans
    get().resetHotel();
    expect(get().customPlans).toHaveLength(1);
  });

  it("“Customize AI plan” copies a package with exactly its numbers", async () => {
    const p = get().runHotelOptimizer();
    await vi.advanceTimersByTimeAsync(2000);
    await p;
    const pkg = get().hotelPlan!.packages[0]!;
    const id = get().customizeFromPackage(pkg.evaluation.id)!;
    expect(get().activeCustomPlanId).toBe(id);
    const ev = selectCustomPlanEvaluation(get())!.evaluation!;
    expect(ev.financials.annualSavings.mid).toBeCloseTo(pkg.evaluation.financials.annualSavings.mid, 6);
    expect(ev.financials.grossCost.mid).toBeCloseTo(pkg.evaluation.financials.grossCost.mid, 6);
    expect(get().customPlans.find((x) => x.id === id)!.copiedFrom).toBe(pkg.roleLabel);
    expect(selectPlanExplanation(get(), pkg.evaluation.id).length).toBeGreaterThan(2);
    expect(get().customizeFromPackage("nope")).toBeNull();
  });

  it("offers the catalog and ignores corrupt storage", () => {
    expect(selectCatalog(get()).items.length).toBe(8);
    window.localStorage.setItem(PLANS_STORAGE_KEY, "{not json");
    get().hydrateCustomPlans();
    expect(get().customPlans).toEqual([]);
    const clean = sanitizePlans({ version: 1, next: 3, active: "a", plans: [{ id: "a", name: "A", items: [{ id: "led_lighting", quantity: 30 }, { id: "bogus" }, { id: "led_lighting" }] }] });
    expect(clean.plans[0]!.items).toEqual([{ id: "led_lighting", quantity: 30 }]);
  });
});
