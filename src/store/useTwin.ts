import { create } from "zustand";
import {
  DEFAULT_FINANCE,
  PORTFOLIO_DEFAULTS,
  STRESS_TESTS,
  hotelOrganizations,
  hotelPortfolio,
  optimizePortfolioBudget,
  prepareProperty,
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
  PortfolioObjective,
  PortfolioOrganization,
  PortfolioPlan,
  PortfolioProperty,
  Ownership,
  ResolvedProfile,
  Scenario,
  ScenarioResult,
  StressTest,
  ZoneId,
} from "@/engine/hotel";
import { computeScenarioResult, effectiveScenario, mergeInput, selectPlanContext, selectAllProperties, selectIsSynthetic, selectPortfolioItems, selectPortfolioSummary, withoutKeys } from "./hotelDerived";
import { readStoredPlans, writeStoredPlans } from "./customPlans";
import { readUserHotels, userProperty, writeUserHotels } from "./userHotels";
import type { ChicagoAreaId } from "./userHotels";
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

/** What is kept for a portfolio property while another one is open, so returning to it restores the user's work. */
export interface PropertySnapshot {
  hotelInput: HotelInput;
  hotelPresetId: string | null;
  hotel: ResolvedProfile;
  baseline: EnergyResult;
  scenario: Scenario;
  activeStressTest: StressTest["id"] | null;
  scenarioResult: ScenarioResult | null;
  hotelPlan: PortfolioResult | null;
  planBeforeStress: PortfolioResult | null;
  hotelPlanBaseline: EnergyResult | null;
  optimizeOnScenario: boolean;
  activeHotelPackageId: string | null;
  savedScenarios: SavedScenario[];
  nextScenarioNumber: number;
  advisorMessages: AdvisorMessage[];
  selectedZone: ZoneId | null;
}

export type PortfolioStressPlanChoice = "ai" | "mine" | "none";
export type UserHotel = PortfolioProperty & { areaId: ChicagoAreaId };

/** The sample chain plus the user's hotels (a stable object per list of user hotels). */
/** The selected organization with the user's hotels that belong to it (hotels saved before organizations existed go to the first). */
function portfolioWith(userHotels: UserHotel[], organizationId: string = hotelPortfolio.id): PortfolioOrganization {
  const org = hotelOrganizations.find((o) => o.id === organizationId) ?? hotelPortfolio;
  const mine = userHotels.filter((h) => (h.organizationId ?? hotelPortfolio.id) === org.id);
  return mine.length ? { ...org, properties: [...org.properties, ...mine] } : org;
}

/** Narrows the portfolio views (map, table, totals, charts, optimizer, stress tests) to a brand, a region or an ownership type. */
export interface PortfolioFilter {
  brand: string | null;
  region: string | null;
  ownership: Ownership | null;
}
const NO_FILTER: PortfolioFilter = { brand: null, region: null, ownership: null };

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
  /** The plan in place when a stress test started (kept so the stress panel can test it if the optimizer re-runs). */
  planBeforeStress: PortfolioResult | null;
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
  /**
   * "Reset demo": everything back to the starting state in one step: the hotel, what-if, stress test, plans, saved scenarios, advisor,
   * twin controls, the portfolio, and the custom plans saved in this browser. Keeps the reduce-effects preference.
   */
  resetDemo: () => void;
  /** Counts "Reset demo" clicks, so view-only state outside the store (the 3D camera, explode, energy view) can reset too. */
  demoResets: number;

  // ---- Hotel portfolio (Phase 13). The single-hotel fields above always describe the open hotel. ----
  /** The synthetic demonstration hotel chain. */
  portfolio: PortfolioOrganization;
  /** The portfolio property shown in the single-hotel screens; null before one is opened from the portfolio. */
  activePropertyId: string | null;
  /** Saved state of the other properties (input, what-if, stress test, plan, saved scenarios, advisor). */
  propertyStates: Record<string, PropertySnapshot>;
  portfolioBudget: number;
  portfolioObjective: PortfolioObjective;
  portfolioPlan: PortfolioPlan | null;
  portfolioOptimizing: boolean;
  /** Load a property into the single-hotel screens, saving the open one first (as the preset switcher does, but restorable). */
  openProperty: (id: string) => void;
  setPortfolioBudget: (n: number) => void;
  setPortfolioObjective: (o: PortfolioObjective) => void;
  runPortfolioOptimizer: () => Promise<void>;
  /** "My portfolio": the custom plan chosen for each property (null = none). A property with no entry uses its latest plan. */
  portfolioCustomPlanIds: Record<string, string | null>;
  setPortfolioCustomPlan: (propertyId: string, planId: string | null) => void;
  /** "Customize AI plan" for the portfolio: copies each property's recommended package into a new custom plan for that property. */
  customizeAiPortfolio: () => string[];
  /** Portfolio stress test: which test, on which properties, and with which plans (the AI portfolio, mine, or none). */
  portfolioStressTestId: StressTest["id"] | null;
  portfolioStressScope: string[];
  portfolioStressPlan: PortfolioStressPlanChoice;
  setPortfolioStressTest: (id: StressTest["id"] | null) => void;
  setPortfolioStressScope: (ids: string[]) => void;
  setPortfolioStressPlan: (c: PortfolioStressPlanChoice) => void;
  /** The demonstration organizations and the selected one (`portfolio` is the selected organization). */
  organizations: PortfolioOrganization[];
  organizationId: string;
  portfolioFilter: PortfolioFilter;
  /** Switches the portfolio to another organization (clears the filter and the portfolio plan; the open hotel stays open). */
  setOrganization: (id: string) => void;
  setPortfolioFilter: (patch: Partial<PortfolioFilter>) => void;
  /** Hotels the user added ("Add my hotel"), kept in this browser; they join the portfolio after the sample chain. */
  userHotels: UserHotel[];
  nextUserHotelNumber: number;
  userHotelsHydrated: boolean;
  /** Reads the user's hotels from local storage (call after mount, in the browser). */
  hydrateUserHotels: () => void;
  /** Adds a hotel from the user's inputs (blank fields use defaults); returns its id. It does not open it. */
  addUserHotel: (input: HotelInput, areaId: ChicagoAreaId, meta?: { brand?: string; ownership?: Ownership }) => string;
  removeUserHotel: (id: string) => void;

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
    planBeforeStress: null as PortfolioResult | null,
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
    portfolio: hotelPortfolio,
    organizations: hotelOrganizations,
    organizationId: hotelPortfolio.id,
    portfolioFilter: NO_FILTER,
    activePropertyId: null as string | null,
    propertyStates: {} as Record<string, PropertySnapshot>,
    portfolioBudget: PORTFOLIO_DEFAULTS.budget,
    portfolioObjective: PORTFOLIO_DEFAULTS.objective,
    portfolioPlan: null as PortfolioPlan | null,
    portfolioOptimizing: false,
    portfolioCustomPlanIds: {} as Record<string, string | null>,
    portfolioStressTestId: null as StressTest["id"] | null,
    portfolioStressScope: hotelPortfolio.properties.map((p) => p.id),
    portfolioStressPlan: "ai" as PortfolioStressPlanChoice,
  };
}

function snapshotOf(s: TwinState): PropertySnapshot {
  return {
    hotelInput: s.hotelInput,
    hotelPresetId: s.hotelPresetId,
    hotel: s.hotel,
    baseline: s.baseline,
    scenario: s.scenario,
    activeStressTest: s.activeStressTest,
    scenarioResult: s.scenarioResult,
    hotelPlan: s.hotelPlan,
    planBeforeStress: s.planBeforeStress,
    hotelPlanBaseline: s.hotelPlanBaseline,
    optimizeOnScenario: s.optimizeOnScenario,
    activeHotelPackageId: s.activeHotelPackageId,
    savedScenarios: s.savedScenarios,
    nextScenarioNumber: s.nextScenarioNumber,
    advisorMessages: s.advisorMessages,
    selectedZone: s.selectedZone,
  };
}

/** When the open hotel is one the user added, its edited input is saved (state and local storage). */
function savedUserEdit(s: TwinState, hotelInput: HotelInput): Partial<TwinState> {
  if (!s.activePropertyId || !s.userHotels.some((h) => h.id === s.activePropertyId)) return {};
  const userHotels = s.userHotels.map((h) => (h.id === s.activePropertyId ? { ...h, input: hotelInput } : h));
  writeUserHotels(userHotels, s.nextUserHotelNumber);
  return { userHotels, portfolio: portfolioWith(userHotels, s.organizationId) };
}

/** Saves the open property (if any) into `propertyStates`. */
const savedStates = (s: TwinState) => (s.activePropertyId ? { ...s.propertyStates, [s.activePropertyId]: snapshotOf(s) } : s.propertyStates);

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
        ...(s.activePropertyId ? { portfolioPlan: null } : {}),
        ...savedUserEdit(s, hotelInput),
      };
    }),
  selectHotelPreset: (id) => {
    const preset = hotelData.presets.find((p) => p.id === id);
    if (!preset) return;
    const hotelInput: HotelInput = { ...preset.input };
    set((s) => ({
      propertyStates: savedStates(s),
      activePropertyId: null,
      hotelInput,
      hotelPresetId: id,
      ...recomputeHotel(hotelInput),
      scenario: {},
      activeStressTest: null,
      scenarioResult: null,
      hotelPlan: null,
      hotelPlanBaseline: null,
      activeHotelPackageId: null,
    }));
  },
  setHotelBudget: (n) => get().setHotelInput({ budget: Math.max(0, n) }),
  setHotelObjective: (objective) => get().setHotelInput({ objective }),
  setHotelDiscountRate: (r) =>
    set({ hotelDiscountRate: Number.isFinite(r) ? Math.min(0.3, Math.max(0, r)) : DEFAULT_FINANCE.discountRate, hotelPlan: null, hotelPlanBaseline: null, activeHotelPackageId: null, portfolioPlan: null }),
  setOptimizeOnScenario: (optimizeOnScenario) => set({ optimizeOnScenario, hotelPlan: null, hotelPlanBaseline: null, activeHotelPackageId: null }),
  setScenario: (patch, clear) =>
    set((s) => {
      const scenario = { ...withoutKeys(s.scenario, clear), ...patch };
      return { scenario, scenarioResult: computeScenarioResult(s.hotel, effectiveScenario(scenario, s.activeStressTest)), ...stalePlan(s), ...autoOptimize(s, scenario, s.activeStressTest) };
    }),
  resetScenario: () => set((s) => ({ scenario: {}, activeStressTest: null, scenarioResult: null, ...stalePlan(s), ...autoOptimize(s, {}, null) })),
  // Persistent changes (prices, worn equipment) become the basis for investing, as before: the optimizer switches to them. The plan the
  // user had is kept in `planBeforeStress`, so the stress panel can test it. Temporary events (weather, occupancy, a cloudy year) do not
  // switch the optimizer: they must not change long-term returns, so the current plan stays.
  applyStressTest: (activeStressTest) =>
    set((s) => {
      const scenarioResult = computeScenarioResult(s.hotel, effectiveScenario(s.scenario, activeStressTest));
      const persistent = (id: StressTest["id"] | null) => STRESS_TESTS.find((t) => t.id === id)?.duration === "persistent";
      const planBeforeStress = activeStressTest === null ? null : (s.planBeforeStress ?? s.hotelPlan);
      if (persistent(activeStressTest) || persistent(s.activeStressTest))
        return { activeStressTest, scenarioResult, planBeforeStress, ...stalePlan(s), ...autoOptimize(s, s.scenario, activeStressTest) };
      return { activeStressTest, scenarioResult, planBeforeStress, ...(s.hotelPlan?.scenario ? stalePlan(s) : {}) };
    }),
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
        syntheticDemo: selectIsSynthetic(s),
        // Same rule as the optimizer and the comparison cards (selectUpgradeBaseline).
        measureUpgradesOnScenario: s.optimizeOnScenario,
        portfolio: {
          organization: s.portfolio.name,
          summary: selectPortfolioSummary(s),
          plan: s.portfolioPlan,
          openHotel: s.activePropertyId ? s.hotel.profile.name : null,
          syntheticDemo: s.portfolio.synthetic,
        },
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
  resetHotel: () =>
    set((s) => ({
      ...initialHotelState(),
      optimizing: false,
      portfolio: portfolioWith(s.userHotels),
      portfolioStressScope: portfolioWith(s.userHotels).properties.map((p) => p.id),
      organizationId: hotelPortfolio.id,
    })),
  demoResets: 0,
  resetDemo: () => {
    advisor.clearAdvisorCache();
    set((s) => ({ ...initialHotelState(), optimizing: false, customPlans: [], activeCustomPlanId: null, nextPlanNumber: 1, customPlansHydrated: true, userHotels: [], nextUserHotelNumber: 1, userHotelsHydrated: true, demoResets: s.demoResets + 1 }));
    writeStoredPlans([], 1, null);
    writeUserHotels([], 1);
  },

  openProperty: (id) =>
    set((s) => {
      if (id === s.activePropertyId) return {};
      const property = selectAllProperties(s).find((p) => p.id === id);
      if (!property) return {};
      const propertyStates = savedStates(s);
      const saved = propertyStates[id];
      // Keep the active custom plan only if it belongs to the newly opened hotel (or to no hotel).
      const visible = s.customPlans.filter((p) => !p.propertyId || p.propertyId === id);
      const activeCustomPlanId = visible.some((p) => p.id === s.activeCustomPlanId) ? s.activeCustomPlanId : (visible[visible.length - 1]?.id ?? null);
      if (saved) return { ...saved, propertyStates, activePropertyId: id, activeCustomPlanId };
      const hotelInput: HotelInput = { ...property.input };
      return {
        propertyStates,
        activePropertyId: id,
        activeCustomPlanId,
        hotelInput,
        hotelPresetId: property.presetId ?? null,
        ...recomputeHotel(hotelInput),
        scenario: {},
        activeStressTest: null,
        scenarioResult: null,
        hotelPlan: null,
        planBeforeStress: null,
        hotelPlanBaseline: null,
        optimizeOnScenario: false,
        activeHotelPackageId: null,
        savedScenarios: [],
        nextScenarioNumber: 1,
        advisorMessages: [],
        selectedZone: null,
      };
    }),
  setPortfolioBudget: (n) => set({ portfolioBudget: Number.isFinite(n) ? Math.max(0, Math.min(50_000_000, n)) : PORTFOLIO_DEFAULTS.budget, portfolioPlan: null }),
  setPortfolioObjective: (portfolioObjective) => set({ portfolioObjective, portfolioPlan: null }),
  runPortfolioOptimizer: async () => {
    if (get().portfolioOptimizing) return;
    const items = selectPortfolioItems(get());
    set({ portfolioOptimizing: true, portfolioPlan: null });
    const s = get();
    const plan = optimizePortfolioBudget(items, { budget: s.portfolioBudget, objective: s.portfolioObjective, discountRate: s.hotelDiscountRate });
    // Computed at once; the short wait lets the UI show that it is testing combinations.
    await new Promise((r) => setTimeout(r, 1200));
    const same = selectPortfolioItems(get()) === items && get().portfolioBudget === plan.budget && get().portfolioObjective === plan.objective;
    set(same ? { portfolioOptimizing: false, portfolioPlan: plan } : { portfolioOptimizing: false });
  },

  setPortfolioCustomPlan: (propertyId, planId) =>
    set((s) => {
      if (!s.portfolio.properties.some((p) => p.id === propertyId)) return {};
      const ok = planId === null || s.customPlans.some((p) => p.id === planId && (!p.propertyId || p.propertyId === propertyId));
      return ok ? { portfolioCustomPlanIds: { ...s.portfolioCustomPlanIds, [propertyId]: planId } } : {};
    }),
  customizeAiPortfolio: () => {
    const s = get();
    if (!s.portfolioPlan) return [];
    const items = selectPortfolioItems(s);
    let n = s.nextPlanNumber;
    const created: CustomPlan[] = [];
    const ids: Record<string, string | null> = { ...s.portfolioCustomPlanIds };
    for (const a of s.portfolioPlan.allocations) {
      if (!a.candidate) continue;
      const item = items.find((x) => x.property.id === a.propertyId);
      if (!item) continue;
      const ctx = prepareProperty(item.property, item.input).ctx;
      const id = `plan-${n}-${s.customPlans.length + created.length + 1}`;
      n++;
      created.push({ id, name: "AI portfolio (customized)", items: dedupeItems(planFromPackage(ctx, a.candidate.upgradeIds)), propertyId: a.propertyId, copiedFrom: "AI portfolio" });
      ids[a.propertyId] = id;
    }
    if (!created.length) return [];
    const forOpen = created.find((p) => p.propertyId === s.activePropertyId)?.id;
    setPlans(set, get, [...s.customPlans, ...created], n, forOpen ?? s.activeCustomPlanId);
    set({ portfolioCustomPlanIds: ids });
    return created.map((p) => p.id);
  },
  userHotels: [] as UserHotel[],
  nextUserHotelNumber: 1,
  userHotelsHydrated: false,
  hydrateUserHotels: () => {
    if (get().userHotelsHydrated) return;
    const stored = readUserHotels();
    const hotels = stored.hotels.filter((h) => !get().userHotels.some((x) => x.id === h.id));
    const userHotels = [...get().userHotels, ...hotels];
    set((s) => ({
      userHotels,
      nextUserHotelNumber: Math.max(s.nextUserHotelNumber, stored.next),
      userHotelsHydrated: true,
      portfolio: portfolioWith(userHotels, s.organizationId),
      portfolioStressScope: [...s.portfolioStressScope, ...hotels.filter((h) => (h.organizationId ?? hotelPortfolio.id) === s.organizationId).map((h) => h.id)],
    }));
  },
  addUserHotel: (input, areaId, meta = {}) => {
    const s = get();
    const n = s.nextUserHotelNumber;
    const id = `my-hotel-${n}`;
    const clean: HotelInput = { ...input, name: input.name?.trim() || `My hotel ${n}` };
    const hotel: UserHotel = { ...userProperty(id, clean, areaId, s.userHotels.length, { ...meta, organizationId: s.organizationId }), areaId };
    const userHotels = [...s.userHotels, hotel];
    writeUserHotels(userHotels, n + 1);
    set({ userHotels, nextUserHotelNumber: n + 1, portfolio: portfolioWith(userHotels, s.organizationId), portfolioPlan: null, portfolioStressScope: [...s.portfolioStressScope, id] });
    return id;
  },
  removeUserHotel: (id) => {
    const s = get();
    if (!s.userHotels.some((h) => h.id === id)) return;
    if (s.activePropertyId === id) s.selectHotelPreset(hotelData.presets[0]!.id);
    const userHotels = get().userHotels.filter((h) => h.id !== id);
    writeUserHotels(userHotels, get().nextUserHotelNumber);
    const { [id]: _drop, ...propertyStates } = get().propertyStates;
    const { [id]: _plan, ...portfolioCustomPlanIds } = get().portfolioCustomPlanIds;
    set({
      userHotels,
      portfolio: portfolioWith(userHotels, get().organizationId),
      propertyStates,
      portfolioCustomPlanIds,
      portfolioPlan: null,
      portfolioStressScope: get().portfolioStressScope.filter((x) => x !== id),
    });
  },
  setOrganization: (id) =>
    set((s) => {
      if (id === s.organizationId || !s.organizations.some((o) => o.id === id)) return {};
      const portfolio = portfolioWith(s.userHotels, id);
      return { organizationId: id, portfolio, portfolioFilter: NO_FILTER, portfolioPlan: null, portfolioStressScope: portfolio.properties.map((p) => p.id) };
    }),
  setPortfolioFilter: (patch) => set((s) => ({ portfolioFilter: { ...s.portfolioFilter, ...patch }, portfolioPlan: null })),
  setPortfolioStressTest: (portfolioStressTestId) => set({ portfolioStressTestId }),
  setPortfolioStressScope: (ids) => set((s) => ({ portfolioStressScope: s.portfolio.properties.map((p) => p.id).filter((id) => ids.includes(id)) })),
  setPortfolioStressPlan: (portfolioStressPlan) => set({ portfolioStressPlan }),

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
    const property = get().activePropertyId;
    const plan: CustomPlan = { id, name: name?.trim() || `My plan ${n}`, items: dedupeItems(items), ...(property ? { propertyId: property } : {}) };
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
