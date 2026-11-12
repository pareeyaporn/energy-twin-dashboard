import { create } from "zustand";
import {
  DEFAULT_FINANCE,
  advisor,
  calculateBaselineEnergy,
  hotelData,
  optimizeInvestmentPortfolio,
  planFromPackage,
  prepareScenarioContext,
  prepareUpgradeContext,
  resolveProfile,
} from "@/engine/hotel";
import type {
  EnergyResult,
  HotelInput,
  Objective,
  PlanItem,
  UpgradeId,
  PortfolioResult,
  ResolvedProfile,
  Scenario,
  ScenarioResult,
  StressTest,
  ZoneId,
} from "@/engine/hotel";
import { computeScenarioResult, effectiveScenario, mergeInput, selectPlanContext, withoutKeys } from "./hotelDerived";
import { readStoredPlans, writeStoredPlans } from "./customPlans";
import type { CustomPlan } from "./customPlans";
export type { CustomPlan } from "./customPlans";
import presetsJson from "@/data/presetHomes.json";
import packagesJson from "@/data/mockPackages.json";
import partsJson from "@/data/mockParts.json";

type Range = [number, number];
export type PresetHome = (typeof presetsJson)[number];
export type Package = Omit<(typeof packagesJson)[number], "savingsRange"> & { savingsRange: Range };
export type Part = Omit<(typeof partsJson)[number], "costRange" | "savingsRange"> & { costRange: Range; savingsRange: Range };

const presets: PresetHome[] = presetsJson;
const packages = packagesJson as Package[];
const parts = partsJson as Part[];
const firstPreset = presets[0]!;
export type Goal = "savings" | "payback" | "value";
export type Fuel = "Gas" | "Electric" | "Oil" | "Propane";
export type Step = 1 | 2 | 3;

export interface HomeForm {
  zip: string;
  sqft: number;
  year: number;
  fuel: Fuel;
  system: string;
  electricMonthly: number;
  fuelMonthly: number;
  notes: string;
}

export type TwinLayer = "zones" | "rooms" | "equipment" | "flow";
/** "day": hours of a typical day; "year": month by month; "seasons": each month plays one compressed day (hour by hour, then the next month). */
export type TimeMode = "day" | "year" | "seasons";
export type CompareMode = "before" | "after" | "split";

export interface AdvisorMessage {
  id: string;
  role: "user" | "advisor";
  text: string;
  /** For advisor messages: "ai" if the model's answer passed the number check, "fallback" if the template answer was used. */
  source?: "ai" | "fallback";
  reason?: advisor.FallbackReason;
}

export interface SavedScenario {
  id: string;
  name: string;
  scenario: Scenario;
  stressTest: StressTest["id"] | null;
}

export interface TwinState {
  presets: PresetHome[];
  parts: Part[];
  selectedPresetId: string | null;
  home: HomeForm;
  budget: number;
  goal: Goal;
  assumptions: { priceGrowth: number; discountRate: number };
  thermalMode: boolean;
  season: "winter" | "summer";
  reduceEffects: boolean;
  selectedPart: string | null;
  results: Package[];
  optimizing: boolean;
  activePackageId: string | null;
  drawerOpen: boolean;
  sourcesOpen: boolean;
  step: Step;

  // ---- Hotel product (docs/13 Appendix A). Home-era fields above keep working. ----
  hotelPresets: { id: string; label: string; synthetic: boolean }[];
  hotelPresetId: string | null;
  /** What the user entered. */
  hotelInput: HotelInput;
  /** The input with defaults filled in (`defaulted` lists what is a default). */
  hotel: ResolvedProfile;
  baseline: EnergyResult;
  /** The user's what-if; {} means none. */
  scenario: Scenario;
  activeStressTest: StressTest["id"] | null;
  /** null when there is no scenario or stress test to simulate. */
  scenarioResult: ScenarioResult | null;
  /** Result of the budget optimizer (three packages and the objective winner). */
  hotelPlan: PortfolioResult | null;
  /** The situation the plan was measured against: the baseline, or the scenario's result if the optimizer ran on a scenario. */
  hotelPlanBaseline: EnergyResult | null;
  /** Discount rate for NPV (product decision: 8% default, 3% alternative); NPV only, payback and net benefit do not use it. */
  hotelDiscountRate: number;
  /** How many combinations the running (or last) optimizer run tests; set as soon as a run starts so the UI can count up to it. */
  optimizerCombinations: number | null;
  /** When true the optimizer measures upgrades against the current scenario (for example electricity +20%). */
  optimizeOnScenario: boolean;
  activeHotelPackageId: string | null;
  savedScenarios: SavedScenario[];
  nextScenarioNumber: number;
  advisorMessages: AdvisorMessage[];
  advisorBusy: boolean;
  advisorSeq: number;
  selectedZone: ZoneId | null;
  twinLayer: TwinLayer;
  timeMode: TimeMode;
  timeMonth: number;
  timeHour: number;
  playing: boolean;
  playbackSpeed: number;
  compareMode: CompareMode;
  setHotelInput: (patch: HotelInput, clear?: (keyof HotelInput)[]) => void;
  selectHotelPreset: (id: string) => void;
  setHotelBudget: (n: number) => void;
  setHotelObjective: (o: Objective) => void;
  setOptimizeOnScenario: (b: boolean) => void;
  /** Change the NPV discount rate (for example 0.08 or 0.03). Clears the plan so it is re-run with the new rate. */
  setHotelDiscountRate: (r: number) => void;
  setScenario: (patch: Scenario, clear?: (keyof Scenario)[]) => void;
  resetScenario: () => void;
  applyStressTest: (id: StressTest["id"] | null) => void;
  runHotelOptimizer: () => Promise<void>;
  applyHotelPackage: (id: string | null) => void;
  saveScenario: (name?: string) => void;
  loadScenario: (id: string) => void;
  renameScenario: (id: string, name: string) => void;
  deleteScenario: (id: string) => void;
  selectZone: (z: ZoneId | null) => void;
  setTwinLayer: (l: TwinLayer) => void;
  setTime: (t: { mode?: TimeMode; month?: number; hour?: number }) => void;
  setPlaying: (b: boolean) => void;
  setPlaybackSpeed: (n: number) => void;
  setCompareMode: (m: CompareMode) => void;
  askAdvisor: (question: string) => Promise<void>;
  clearAdvisor: () => void;
  resetHotel: () => void;

  /** Custom investment plans (kept in the browser's local storage; numbers are always recomputed by the engine). */
  customPlans: CustomPlan[];
  activeCustomPlanId: string | null;
  nextPlanNumber: number;
  /** True once plans were read from local storage (call `hydrateCustomPlans` after mount, in the browser). */
  customPlansHydrated: boolean;
  hydrateCustomPlans: () => void;
  /** Creates a plan (optionally with items) and makes it active; returns its id. */
  createCustomPlan: (name?: string, items?: PlanItem[]) => string;
  duplicateCustomPlan: (id: string) => string | null;
  renameCustomPlan: (id: string, name: string) => void;
  deleteCustomPlan: (id: string) => void;
  setActiveCustomPlan: (id: string | null) => void;
  /** Adds an upgrade to the active plan (creating a plan if there is none); quantity in the catalog's unit, omitted = the whole scope. */
  addPlanUpgrade: (upgradeId: UpgradeId, quantity?: number) => void;
  removePlanUpgrade: (upgradeId: UpgradeId) => void;
  setPlanQuantity: (upgradeId: UpgradeId, quantity: number) => void;
  /** "Customize AI plan": copies a recommended package into a new custom plan and makes it active; returns its id. */
  customizeFromPackage: (packageId: string) => string | null;

  selectPreset: (id: string) => void;
  updateHome: (patch: Partial<HomeForm>) => void;
  setBudget: (n: number) => void;
  setGoal: (g: Goal) => void;
  setAssumptions: (a: Partial<TwinState["assumptions"]>) => void;
  setThermal: (b: boolean) => void;
  toggleSeason: () => void;
  setReduceEffects: (b: boolean) => void;
  selectPart: (id: string | null) => void;
  runOptimize: () => Promise<void>;
  setActivePackage: (id: string) => void;
  setDrawerOpen: (b: boolean) => void;
  setSourcesOpen: (b: boolean) => void;
}

const homeFromPreset = (p: PresetHome): HomeForm => ({
  zip: p.zip, sqft: p.sqft, year: p.year, fuel: p.fuel as Fuel, system: p.system,
  electricMonthly: p.electricMonthly, fuelMonthly: p.fuelMonthly, notes: "",
});

/** A plan measured against a scenario goes stale when the scenario changes. */
const stalePlan = (s: TwinState) =>
  s.hotelPlan?.scenario ? { hotelPlan: null, hotelPlanBaseline: null, activeHotelPackageId: null } : {};

/**
 * "Optimize for this scenario" follows the scenario automatically: it turns on when a what-if or stress test starts and off when
 * the last one is cleared, so an applied package is measured against what the user is looking at. The user can still switch it
 * off while a scenario is active. When it flips, any plan is cleared, because it was measured against the other situation.
 */
const autoOptimize = (s: TwinState, scenario: Scenario, stress: StressTest["id"] | null) => {
  const was = Object.keys(s.scenario).length > 0 || s.activeStressTest !== null;
  const now = Object.keys(scenario).length > 0 || stress !== null;
  if (was === now || s.optimizeOnScenario === now) return {};
  return { optimizeOnScenario: now, hotelPlan: null, hotelPlanBaseline: null, activeHotelPackageId: null };
};

const clampInt = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, Math.round(n)));

/** Resolve the profile and compute its baseline. Deterministic, so the server and the browser agree. */
function recomputeHotel(input: HotelInput): { hotel: ResolvedProfile; baseline: EnergyResult } {
  const hotel = resolveProfile(input);
  return { hotel, baseline: calculateBaselineEnergy(hotel) };
}

const firstHotelPreset = hotelData.presets[0]!;

function initialHotelState() {
  const input: HotelInput = { ...firstHotelPreset.input };
  return {
    hotelPresets: hotelData.presets.map((p) => ({ id: p.id, label: p.label, synthetic: p.synthetic })),
    hotelPresetId: firstHotelPreset.id as string | null,
    hotelInput: input,
    ...recomputeHotel(input),
    scenario: {} as Scenario,
    activeStressTest: null as StressTest["id"] | null,
    scenarioResult: null as ScenarioResult | null,
    hotelPlan: null as PortfolioResult | null,
    hotelPlanBaseline: null as EnergyResult | null,
    optimizerCombinations: null as number | null,
    hotelDiscountRate: DEFAULT_FINANCE.discountRate,
    optimizeOnScenario: false,
    activeHotelPackageId: null as string | null,
    savedScenarios: [] as SavedScenario[],
    nextScenarioNumber: 1,
    advisorMessages: [] as AdvisorMessage[],
    advisorBusy: false,
    advisorSeq: 1,
    selectedZone: null as ZoneId | null,
    twinLayer: "zones" as TwinLayer,
    timeMode: "day" as TimeMode,
    timeMonth: 6,
    timeHour: 12,
    playing: false,
    playbackSpeed: 1,
    compareMode: "after" as CompareMode,
  };
}

export const useTwin = create<TwinState>((set, get) => ({
  presets,
  parts,
  selectedPresetId: firstPreset.id,
  home: homeFromPreset(firstPreset),
  budget: 15000,
  goal: "value",
  assumptions: { priceGrowth: 2, discountRate: 3 },
  thermalMode: false,
  season: "winter",
  reduceEffects: false,
  selectedPart: null,
  results: [],
  optimizing: false,
  activePackageId: null,
  drawerOpen: false,
  sourcesOpen: false,
  step: 1,
  ...initialHotelState(),
  selectPreset: (id) => {
    const p = presets.find((x) => x.id === id);
    if (p) set({ selectedPresetId: id, home: homeFromPreset(p), results: [], activePackageId: null, step: 1 });
  },
  updateHome: (patch) => set((s) => ({ home: { ...s.home, ...patch }, selectedPresetId: null })),
  setBudget: (budget) => set({ budget }),
  setGoal: (goal) => set({ goal }),
  setAssumptions: (a) => set((s) => ({ assumptions: { ...s.assumptions, ...a } })),
  setThermal: (thermalMode) => set((s) => ({ thermalMode, selectedPart: null, step: thermalMode && s.step < 2 ? 2 : s.step })),
  toggleSeason: () => set((s) => ({ season: s.season === "winter" ? "summer" : "winter" })),
  setReduceEffects: (reduceEffects) => set({ reduceEffects }),
  selectPart: (selectedPart) => set({ selectedPart }),
  runOptimize: async () => {
    if (get().optimizing) return;
    set({ optimizing: true, results: [], activePackageId: null });
    await new Promise((r) => setTimeout(r, 2000));
    set({ optimizing: false, results: packages, step: 3 });
  },
  setActivePackage: (activePackageId) => set({ activePackageId }),
  setDrawerOpen: (drawerOpen) => set({ drawerOpen }),
  setSourcesOpen: (sourcesOpen) => set({ sourcesOpen }),

  // ---- Hotel actions ----
  setHotelInput: (patch, clear) =>
    set((s) => {
      const hotelInput = mergeInput(s.hotelInput, patch, clear);
      const { hotel, baseline } = recomputeHotel(hotelInput);
      return {
        hotelInput,
        hotel,
        baseline,
        hotelPresetId: null,
        scenarioResult: computeScenarioResult(hotel, effectiveScenario(s.scenario, s.activeStressTest)),
        hotelPlan: null,
        hotelPlanBaseline: null,
        activeHotelPackageId: null,
      };
    }),
  selectHotelPreset: (id) => {
    const preset = hotelData.presets.find((p) => p.id === id);
    if (!preset) return;
    const hotelInput: HotelInput = { ...preset.input };
    set({
      hotelInput,
      hotelPresetId: id,
      ...recomputeHotel(hotelInput),
      scenario: {},
      activeStressTest: null,
      scenarioResult: null,
      hotelPlan: null,
      hotelPlanBaseline: null,
      activeHotelPackageId: null,
    });
  },
  setHotelBudget: (n) => get().setHotelInput({ budget: Math.max(0, n) }),
  setHotelObjective: (objective) => get().setHotelInput({ objective }),
  setHotelDiscountRate: (r) =>
    set({ hotelDiscountRate: Number.isFinite(r) ? Math.min(0.3, Math.max(0, r)) : DEFAULT_FINANCE.discountRate, hotelPlan: null, hotelPlanBaseline: null, activeHotelPackageId: null }),
  setOptimizeOnScenario: (optimizeOnScenario) => set({ optimizeOnScenario, hotelPlan: null, hotelPlanBaseline: null, activeHotelPackageId: null }),
  setScenario: (patch, clear) =>
    set((s) => {
      const scenario = { ...withoutKeys(s.scenario, clear), ...patch };
      return { scenario, scenarioResult: computeScenarioResult(s.hotel, effectiveScenario(scenario, s.activeStressTest)), ...stalePlan(s), ...autoOptimize(s, scenario, s.activeStressTest) };
    }),
  resetScenario: () => set((s) => ({ scenario: {}, activeStressTest: null, scenarioResult: null, ...stalePlan(s), ...autoOptimize(s, {}, null) })),
  applyStressTest: (activeStressTest) =>
    set((s) => ({ activeStressTest, scenarioResult: computeScenarioResult(s.hotel, effectiveScenario(s.scenario, activeStressTest)), ...stalePlan(s), ...autoOptimize(s, s.scenario, activeStressTest) })),
  runHotelOptimizer: async () => {
    if (get().optimizing) return;
    const started = get().hotel;
    const startedScenario = get().scenarioResult;
    set({ optimizing: true, hotelPlan: null, hotelPlanBaseline: null, activeHotelPackageId: null });
    // Computed at once; the short wait lets the UI play its "testing combinations" animation.
    const scenario = get().optimizeOnScenario ? effectiveScenario(get().scenario, get().activeStressTest) : {};
    const onScenario = Object.keys(scenario).length > 0;
    const ctx = onScenario ? prepareScenarioContext(started, scenario) : prepareUpgradeContext(started, undefined, get().baseline);
    const assumptions = { discountRate: get().hotelDiscountRate };
    const plan = optimizeInvestmentPortfolio(ctx, onScenario ? { scenario, assumptions } : { assumptions });
    set({ optimizerCombinations: plan.combinationsTested });
    await new Promise((r) => setTimeout(r, 2000));
    // If the hotel or the scenario changed while waiting, the result is stale: drop it.
    const same = get().hotel === started && get().scenarioResult === startedScenario;
    set(same ? { optimizing: false, hotelPlan: plan, hotelPlanBaseline: ctx.baseline } : { optimizing: false });
  },
  applyHotelPackage: (id) =>
    set((s) => {
      if (id === null || !s.hotelPlan) return { activeHotelPackageId: null };
      const all = [...s.hotelPlan.packages, ...(s.hotelPlan.objectiveWinner ? [s.hotelPlan.objectiveWinner] : [])];
      return { activeHotelPackageId: all.some((p) => p.evaluation.id === id) ? id : null };
    }),
  saveScenario: (name) =>
    set((s) => {
      const n = s.nextScenarioNumber;
      const saved: SavedScenario = { id: `scn-${n}`, name: name?.trim() || `Scenario ${n}`, scenario: { ...s.scenario }, stressTest: s.activeStressTest };
      return { savedScenarios: [...s.savedScenarios, saved], nextScenarioNumber: n + 1 };
    }),
  loadScenario: (id) =>
    set((s) => {
      const saved = s.savedScenarios.find((x) => x.id === id);
      if (!saved) return {};
      const scenario = { ...saved.scenario };
      return { scenario, activeStressTest: saved.stressTest, scenarioResult: computeScenarioResult(s.hotel, effectiveScenario(scenario, saved.stressTest)), ...stalePlan(s), ...autoOptimize(s, scenario, saved.stressTest) };
    }),
  renameScenario: (id, name) =>
    set((s) => ({ savedScenarios: s.savedScenarios.map((x) => (x.id === id ? { ...x, name: name.trim() || x.name } : x)) })),
  deleteScenario: (id) => set((s) => ({ savedScenarios: s.savedScenarios.filter((x) => x.id !== id) })),
  selectZone: (selectedZone) => set({ selectedZone }),
  setTwinLayer: (twinLayer) => set({ twinLayer }),
  setTime: (t) =>
    set((s) => ({
      timeMode: t.mode ?? s.timeMode,
      timeMonth: t.month === undefined ? s.timeMonth : clampInt(t.month, 0, 11),
      timeHour: t.hour === undefined ? s.timeHour : clampInt(t.hour, 0, 23),
    })),
  setPlaying: (playing) => set({ playing }),
  setPlaybackSpeed: (n) => set({ playbackSpeed: Number.isFinite(n) && n > 0 ? n : 1 }),
  setCompareMode: (compareMode) => set({ compareMode }),
  askAdvisor: async (question) => {
    const q = question.trim();
    if (!q || get().advisorBusy) return;
    const n = get().advisorSeq;
    set((s) => ({
      advisorBusy: true,
      advisorSeq: s.advisorSeq + 2,
      advisorMessages: [...s.advisorMessages, { id: `m-${n}`, role: "user", text: q }],
    }));
    const s = get();
    // The context holds every number the advisor may use; the browser then rejects any answer with a number that is not in it.
    const context = advisor.buildAdvisorContext(
      {
        hotel: s.hotel,
        baseline: s.baseline,
        scenario: effectiveScenario(s.scenario, s.activeStressTest),
        scenarioResult: s.scenarioResult,
        plan: s.hotelPlan,
        syntheticDemo: s.hotelPresetId !== null,
        // Same rule as the optimizer and the comparison cards (selectUpgradeBaseline).
        measureUpgradesOnScenario: s.optimizeOnScenario,
      },
      q,
    );
    const answer = await advisor.askAdvisor(q, context, advisor.getAdvisorConfig());
    set((st) => ({
      advisorBusy: false,
      advisorMessages: [
        ...st.advisorMessages,
        { id: `m-${n + 1}`, role: "advisor", text: answer.text, source: answer.source, ...(answer.reason ? { reason: answer.reason } : {}) },
      ],
    }));
  },
  clearAdvisor: () => set({ advisorMessages: [], advisorBusy: false }),
  resetHotel: () => set({ ...initialHotelState(), optimizing: false }),

  customPlans: [] as CustomPlan[],
  activeCustomPlanId: null as string | null,
  nextPlanNumber: 1,
  customPlansHydrated: false,
  hydrateCustomPlans: () => {
    if (get().customPlansHydrated) return;
    const stored = readStoredPlans();
    set({ customPlans: stored.plans, nextPlanNumber: stored.next, activeCustomPlanId: stored.active, customPlansHydrated: true });
  },
  createCustomPlan: (name, items = []) => {
    const n = get().nextPlanNumber;
    const id = `plan-${n}-${get().customPlans.length + 1}`;
    const plan: CustomPlan = { id, name: name?.trim() || `My plan ${n}`, items: dedupeItems(items) };
    setPlans(set, get, [...get().customPlans, plan], n + 1, id);
    return id;
  },
  duplicateCustomPlan: (id) => {
    const src = get().customPlans.find((p) => p.id === id);
    if (!src) return null;
    return get().createCustomPlan(`${src.name} (copy)`, src.items.map((i) => ({ ...i })));
  },
  renameCustomPlan: (id, name) =>
    setPlans(set, get, get().customPlans.map((p) => (p.id === id ? { ...p, name: name.trim().slice(0, 80) || p.name } : p))),
  deleteCustomPlan: (id) => {
    const plans = get().customPlans.filter((p) => p.id !== id);
    const active = get().activeCustomPlanId === id ? (plans[plans.length - 1]?.id ?? null) : get().activeCustomPlanId;
    setPlans(set, get, plans, undefined, active);
  },
  setActiveCustomPlan: (id) => setPlans(set, get, get().customPlans, undefined, id === null || get().customPlans.some((p) => p.id === id) ? id : get().activeCustomPlanId),
  addPlanUpgrade: (upgradeId, quantity) => {
    if (!get().activeCustomPlanId) get().createCustomPlan();
    editActive(set, get, (items) => (items.some((i) => i.id === upgradeId) ? items : [...items, quantity === undefined ? { id: upgradeId } : { id: upgradeId, quantity }]));
  },
  removePlanUpgrade: (upgradeId) => editActive(set, get, (items) => items.filter((i) => i.id !== upgradeId)),
  setPlanQuantity: (upgradeId, quantity) =>
    editActive(set, get, (items) => items.map((i) => (i.id === upgradeId && Number.isFinite(quantity) ? { id: i.id, quantity } : i))),
  customizeFromPackage: (packageId) => {
    const s = get();
    const all = s.hotelPlan ? [...s.hotelPlan.packages, ...(s.hotelPlan.objectiveWinner ? [s.hotelPlan.objectiveWinner] : [])] : [];
    const pkg = all.find((p) => p.evaluation.id === packageId);
    if (!pkg) return null;
    const items = planFromPackage(selectPlanContext(s), pkg.evaluation.upgradeIds);
    const id = s.createCustomPlan(`${pkg.roleLabel} (customized)`, items);
    setPlans(set, get, get().customPlans.map((p) => (p.id === id ? { ...p, copiedFrom: pkg.roleLabel } : p)));
    return id;
  },
}));

function dedupeItems(items: PlanItem[]): PlanItem[] {
  const out: PlanItem[] = [];
  for (const i of items) if (!out.some((x) => x.id === i.id)) out.push({ ...i });
  return out;
}

type SetFn = (partial: Partial<TwinState>) => void;
function setPlans(set: SetFn, get: () => TwinState, plans: CustomPlan[], next?: number, active?: string | null): void {
  const nextPlanNumber = next ?? get().nextPlanNumber;
  const activeCustomPlanId = active === undefined ? get().activeCustomPlanId : active;
  set({ customPlans: plans, nextPlanNumber, activeCustomPlanId });
  writeStoredPlans(plans, nextPlanNumber, activeCustomPlanId);
}
function editActive(set: SetFn, get: () => TwinState, edit: (items: PlanItem[]) => PlanItem[]): void {
  const id = get().activeCustomPlanId;
  if (!id) return;
  setPlans(set, get, get().customPlans.map((p) => (p.id === id ? { ...p, items: edit(p.items) } : p)));
}

/** Baseline yearly cost: from selected preset, or from the entered monthly bills. */
export const selectBaselineCost = (s: TwinState) => {
  const p = s.presets.find((x) => x.id === s.selectedPresetId);
  return p ? p.yearlyCost : (s.home.electricMonthly + s.home.fuelMonthly) * 12;
};
export const selectActivePackage = (s: TwinState) => s.results.find((p) => p.id === s.activePackageId) ?? null;
export const selectCurrentCost = (s: TwinState) => selectActivePackage(s)?.newYearlyCost ?? selectBaselineCost(s);
export const selectHomeLabel = (s: TwinState) => {
  const p = s.presets.find((x) => x.id === s.selectedPresetId);
  return p ? { title: p.title, city: p.shortCity, zone: p.climateZone } : { title: "Your home", city: s.home.zip || "—", zone: "—" };
};
