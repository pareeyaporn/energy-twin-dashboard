import { create } from "zustand";
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

interface TwinState {
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
