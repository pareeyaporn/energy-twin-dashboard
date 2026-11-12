import { create } from "zustand";
import {
  calculateBaselineEnergy,
  hotelData,
  optimizeInvestmentPortfolio,
  prepareScenarioContext,
  prepareUpgradeContext,
  resolveProfile,
} from "@/engine/hotel";
import type {
  EnergyResult,
  HotelInput,
  Objective,
  PortfolioResult,
  ResolvedProfile,
  Scenario,
  ScenarioResult,
  StressTest,
  ZoneId,
} from "@/engine/hotel";
import { computeScenarioResult, effectiveScenario, mergeInput, withoutKeys } from "./hotelDerived";
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
export type TimeMode = "day" | "year";
export type CompareMode = "before" | "after" | "split";

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
  /** When true the optimizer measures upgrades against the current scenario (for example electricity +20%). */
  optimizeOnScenario: boolean;
  activeHotelPackageId: string | null;
  savedScenarios: SavedScenario[];
  nextScenarioNumber: number;
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
  resetHotel: () => void;

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
    optimizeOnScenario: false,
    activeHotelPackageId: null as string | null,
    savedScenarios: [] as SavedScenario[],
    nextScenarioNumber: 1,
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
  setOptimizeOnScenario: (optimizeOnScenario) => set({ optimizeOnScenario, hotelPlan: null, hotelPlanBaseline: null, activeHotelPackageId: null }),
  setScenario: (patch, clear) =>
    set((s) => {
      const scenario = { ...withoutKeys(s.scenario, clear), ...patch };
      return { scenario, scenarioResult: computeScenarioResult(s.hotel, effectiveScenario(scenario, s.activeStressTest)), ...stalePlan(s) };
    }),
  resetScenario: () => set((s) => ({ scenario: {}, activeStressTest: null, scenarioResult: null, ...stalePlan(s) })),
  applyStressTest: (activeStressTest) =>
    set((s) => ({ activeStressTest, scenarioResult: computeScenarioResult(s.hotel, effectiveScenario(s.scenario, activeStressTest)), ...stalePlan(s) })),
  runHotelOptimizer: async () => {
    if (get().optimizing) return;
    const started = get().hotel;
    const startedScenario = get().scenarioResult;
    set({ optimizing: true, hotelPlan: null, hotelPlanBaseline: null, activeHotelPackageId: null });
    // Computed at once; the short wait lets the UI play its "testing combinations" animation.
    const scenario = get().optimizeOnScenario ? effectiveScenario(get().scenario, get().activeStressTest) : {};
    const onScenario = Object.keys(scenario).length > 0;
    const ctx = onScenario ? prepareScenarioContext(started, scenario) : prepareUpgradeContext(started, undefined, get().baseline);
    const plan = optimizeInvestmentPortfolio(ctx, onScenario ? { scenario } : {});
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
      return { scenario, activeStressTest: saved.stressTest, scenarioResult: computeScenarioResult(s.hotel, effectiveScenario(scenario, saved.stressTest)), ...stalePlan(s) };
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
  resetHotel: () => set({ ...initialHotelState(), optimizing: false }),
}));

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
