// "How was this calculated?" (Improvement 6): one explanation per major figure, written from the engine's real inputs for the open hotel.
// Each says what the figure means, how it is computed, its main inputs with their data class, the sources and the limits. The text
// describes the implementation in src/engine/hotel (docs/13); if the engine changes, update the matching entry here.
import { ANALYSIS_YEAR, DEFAULT_FINANCE, hotelData } from "@/engine/hotel";
import type { TwinState } from "@/store/useTwin";
import { selectIsSynthetic } from "@/store/hotelDerived";

/** Where a value comes from (Improvement 6C). */
export type DataClass = "verified" | "user" | "modeled" | "synthetic" | "assumption";

export const DATA_CLASS: Record<DataClass, { label: string; meaning: string }> = {
  verified: { label: "Published source", meaning: "A rate, coefficient or program rule from an identifiable published source." },
  user: { label: "Your input", meaning: "Entered by you (building details, bills, rates)." },
  modeled: { label: "Modeled estimate", meaning: "Calculated by the simulation engine from the inputs." },
  synthetic: { label: "Synthetic demo data", meaning: "An illustrative property made up for the demonstration." },
  assumption: { label: "Assumption", meaning: "A value used where no reliable published figure was found; editable or to be replaced." },
};

export type MetricId =
  | "annualCost"
  | "siteEnergy"
  | "carbon"
  | "intensity"
  | "annualSavings"
  | "upgradeCost"
  | "incentives"
  | "payback"
  | "npv"
  | "netBenefit"
  | "savingsPotential"
  | "investmentPriority"
  | "portfolioCost"
  | "portfolioCarbon"
  | "portfolioIntensity";

export interface ExplainInput {
  label: string;
  value: string;
  cls: DataClass;
}

export interface Explanation {
  title: string;
  /** What the figure means, in one sentence. */
  means: string;
  /** How it is calculated, in one or two plain sentences. */
  how: string;
  inputs: ExplainInput[];
  sources: string[];
  limits: string[];
  /** Technical detail for the expandable part (equations, parameter names). */
  technical?: string;
}

/** Results are modeled estimates; no confidence score is invented (Improvement 6F). */
export const ESTIMATE_STATEMENT =
  "Results are modeled estimates based on the selected building profile and assumptions. Actual savings may differ.";

const usd = (n: number, digits = 0) => `$${n.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
const pct = (x: number, digits = 1) => `${(x * 100).toFixed(digits)}%`;

/** The data class of a hotel input: your input unless the engine had to use a default (then synthetic for the demo hotels). */
function inputClass(s: TwinState, field: string): DataClass {
  if (!s.hotel.defaulted.includes(field)) return selectIsSynthetic(s) ? "synthetic" : "user";
  return "assumption";
}

function rateInputs(s: TwinState): ExplainInput[] {
  const p = s.hotel.profile;
  const fromBills = (s.hotel.notes ?? []).some((n) => /rate from your bills/.test(n));
  const cls = (field: string): DataClass => (fromBills ? "user" : s.hotel.defaulted.includes(field) ? "verified" : "user");
  return [
    { label: "Electricity price", value: `${usd(p.electricityRate, 4)} per kWh${s.hotel.defaulted.includes("electricityRate") && !fromBills ? ` (EIA ${p.state} commercial average)` : ""}`, cls: cls("electricityRate") },
    { label: "Natural gas price", value: `${usd(p.gasRate, 3)} per therm${s.hotel.defaulted.includes("gasRate") && !fromBills ? ` (EIA ${p.state} commercial average)` : ""}`, cls: cls("gasRate") },
  ];
}

function buildingInputs(s: TwinState): ExplainInput[] {
  const p = s.hotel.profile;
  const cal = s.baseline.calibration;
  return [
    { label: "Rooms and floor area", value: `${p.rooms} rooms, ${Math.round(p.floorAreaSqft).toLocaleString("en-US")} ft²`, cls: inputClass(s, "floorAreaSqft") },
    { label: "Location (weather)", value: `${p.city}, ${p.state} (NOAA 1991–2020 normals)`, cls: "verified" },
    { label: "Occupancy", value: pct(p.occupancy, 0), cls: inputClass(s, "occupancy") },
    {
      label: "Calibration",
      value:
        cal.source === "bill"
          ? `To your utility bills${cal.clamped ? " (limited to the allowed range)" : ""}`
          : "None: benchmark energy intensity for the climate (no bills entered)",
      cls: cal.source === "bill" ? "user" : "modeled",
    },
  ];
}

const WEATHER = "NOAA NCEI U.S. Climate Normals 1991–2020 (monthly)";
const PRICES = "EIA commercial electricity (Electric Power Monthly, Table 5.6.B) and natural gas prices by state";
const BENCH = "NREL ComStock 2025 Release 3 hotel energy intensity and end-use split by climate zone";
const GRID = "EPA eGRID2023 subregion emission factors";
const TRM = "Illinois Statewide Technical Reference Manual v14.0 (upgrade savings)";
const AEO = "EIA Annual Energy Outlook 2026 (price growth)";

/** The explanation for a figure, for the open hotel (all values from the engine and its data). */
export function explain(id: MetricId, s: TwinState): Explanation {
  const p = s.hotel.profile;
  const b = s.baseline;
  const synthetic = selectIsSynthetic(s);
  const synthLimit = synthetic ? ["This hotel is synthetic demonstration data."] : [];
  const r = s.hotelDiscountRate;
  switch (id) {
    case "annualCost":
      return {
        title: "Annual energy cost",
        means: "What the hotel is estimated to pay for electricity and natural gas in a typical year.",
        how: "The engine simulates energy use by zone, end use and month, then multiplies electricity by the electricity price and gas by the gas price.",
        inputs: [...buildingInputs(s), ...rateInputs(s)],
        sources: [BENCH, WEATHER, PRICES],
        limits: ["All-in average prices: demand charges and tariff tiers are not modeled separately.", "A typical weather year, not a specific past year.", ...synthLimit],
        technical: `cost = Σ (kWh × ${usd(b.rates.elecPerKWh, 4)}) + Σ (therms × ${usd(b.rates.gasPerTherm, 3)}) over 6 zones × 8 end uses × 12 months; site energy = EUI × floor area × age factor × calibration, split by the climate's end-use shares and four drivers (base, occupancy, weather, schedule). docs/13 §2–4.`,
      };
    case "siteEnergy":
      return {
        title: "Annual energy use",
        means: "Electricity and gas used on site in a year, in one unit (kBtu) so they can be added.",
        how: "The same simulation as the cost; electricity is converted at 3.412 kBtu per kWh and gas at 100 kBtu per therm.",
        inputs: buildingInputs(s),
        sources: [BENCH, WEATHER],
        limits: ["Site energy, not source (primary) energy.", "Modeled, not metered, unless calibrated to your bills.", ...synthLimit],
      };
    case "carbon":
      return {
        title: "Annual carbon emissions",
        means: "Estimated greenhouse-gas emissions from the electricity and gas the hotel uses (CO₂-equivalent).",
        how: "Electricity use times the regional grid's emission factor, plus gas use times the emission factor for burning natural gas.",
        inputs: [
          { label: "Grid region", value: `${p.gridSubregion}: ${b.emissionFactors.elecKgPerKWh.toFixed(3)} kg CO₂e per kWh`, cls: s.hotel.defaulted.includes("gridSubregion") ? "verified" : "user" },
          { label: "Natural gas", value: `${b.emissionFactors.gasKgPerTherm.toFixed(2)} kg CO₂e per therm`, cls: "verified" },
        ],
        sources: [GRID, "EPA GHG Emission Factors Hub 2025 (natural gas: 53.06 kg CO₂ per MMBtu plus CH₄ and N₂O, AR5)"],
        limits: ["Annual average grid factors, not hourly marginal emissions.", "Covers electricity and on-site natural gas (Scope 1 and 2 energy). Not included: refrigerant leaks, district steam, fuel oil, propane, generator diesel, vehicles, power-line losses and supply-chain (Scope 3) emissions.", "Estimates, not verified carbon savings.", ...synthLimit],
      };
    case "intensity":
      return {
        title: "Energy intensity",
        means: "Site energy per square foot a year, so hotels of different sizes can be compared.",
        how: "Annual site energy (kBtu) divided by the floor area.",
        inputs: [{ label: "Floor area", value: `${Math.round(p.floorAreaSqft).toLocaleString("en-US")} ft²`, cls: inputClass(s, "floorAreaSqft") }, ...buildingInputs(s).slice(1, 2)],
        sources: [BENCH, "ENERGY STAR Portfolio Manager hotel median (comparison only)"],
        limits: ["A cold climate and a restaurant raise intensity; comparisons with national medians are context, not a rating.", ...synthLimit],
      };
    case "annualSavings":
      return {
        title: "Estimated annual savings",
        means: "How much less the hotel would spend on energy in the first year after the upgrades.",
        how: "Each upgrade changes the simulated energy use (in a fixed order, so interactions such as LED lighting adding heating are counted once); savings are the cost before minus the cost after.",
        inputs: [...rateInputs(s), { label: "Upgrade savings rates", value: "Low, middle and high cases per upgrade", cls: "verified" }],
        sources: [TRM, "NREL and DOE studies cited per upgrade (Sources)"],
        limits: ["A range (low to high) is shown; the middle case is used for payback and NPV.", "Not a guarantee of savings.", ...synthLimit],
        technical: "Upgrades apply in order: envelope, lighting, controls, HVAC, water heating, solar. Each rescales the affected cells by load kind; the package saving is the difference of two full simulations, so it is not the sum of standalone savings. docs/13 §5.",
      };
    case "upgradeCost":
      return {
        title: "Installed cost",
        means: "The estimated price to buy and install the upgrades, before incentives.",
        how: "Each upgrade's cost rule (per room, per ft², per ton, per kW) times the hotel's quantity, with a low–middle–high range.",
        inputs: [{ label: "Cost basis", value: "Published unit costs where found; some remain assumptions (see each upgrade)", cls: "assumption" }],
        sources: ["IL-TRM, NREL TP-5500-82117, EIA equipment cost study (2023), LBNL solar prices (see each upgrade)"],
        limits: ["National or state unit costs, not contractor quotes.", "Some costs are still assumptions (the LED retrofit mix, VRF equipment); chiller costs are a lower bound."],
      };
    case "incentives": {
      const progs = hotelData.incentives.incentives.filter((x) => !x.states || x.states.includes(p.state));
      return {
        title: "Utility incentives",
        means: "Rebates that lower the upfront cost, counted only when the program, its rate and its year are confirmed.",
        how: `An incentive counts in the base case only when it is verified and its program year is ${ANALYSIS_YEAR}; a verified rate from another year is shown separately as illustrative and never counted.`,
        inputs: progs.slice(0, 6).map((x) => ({
          label: x.label,
          value: x.applied && x.verified ? `Counted (${x.programYear ?? "year not set"})` : x.status === "illustrative" ? `Shown separately (${x.programYear} rate)` : "Not counted (unverified)",
          cls: x.verified ? ("verified" as const) : ("assumption" as const),
        })),
        sources: [...new Set(progs.map((x) => x.source))].slice(0, 4),
        limits: ["Program funds are limited and pre-approval may be required; final amounts depend on verified equipment.", "Incentives are never guaranteed."],
      };
    }
    case "payback":
      return {
        title: "Simple payback",
        means: "How long until the investment pays for itself from energy savings.",
        how: "Net investment (installed cost minus counted incentives) divided by the first year's savings. Price growth is not included, so it is a simple, slightly conservative measure.",
        inputs: [{ label: "Net investment and first-year savings", value: "From the plan above", cls: "modeled" }],
        sources: [],
        limits: ["Ignores the time value of money; see NPV for that.", "Compare it with the equipment's expected life: a payback longer than the life never pays back."],
      };
    case "npv":
      return {
        title: "Net present value (NPV)",
        means: "The plan's total value in today's dollars: future savings discounted, minus the net investment. Above zero means it beats the discount rate.",
        how: `Yearly savings grow with energy prices (electricity ${pct(DEFAULT_FINANCE.priceGrowth, 2)}, gas ${pct(DEFAULT_FINANCE.gasPriceGrowth ?? DEFAULT_FINANCE.priceGrowth, 2)} a year) and are discounted at ${pct(r, 0)} a year, over 5 or 10 years.`,
        inputs: [
          { label: "Discount rate", value: `${pct(r, 0)} (editable)`, cls: "assumption" },
          { label: "Energy price growth", value: `electricity ${pct(DEFAULT_FINANCE.priceGrowth, 2)}, gas ${pct(DEFAULT_FINANCE.gasPriceGrowth ?? DEFAULT_FINANCE.priceGrowth, 2)} a year`, cls: "verified" },
        ],
        sources: [AEO],
        limits: ["No residual value after the horizon; maintenance is included for solar only.", "The 8% default discount rate is a product decision, not a market rate for your hotel."],
        technical: "NPV_N = Σ_{t=1..N} S_t / (1 + r)^t − I, with S_t = S_1,elec × (1 + g_e)^{t−1} + S_1,gas × (1 + g_g)^{t−1} (solar output falling 0.5% a year, upkeep subtracted). docs/13 §6.",
      };
    case "netBenefit":
      return {
        title: "Net benefit",
        means: "Savings over the period minus the net investment, without discounting.",
        how: "The same savings stream as NPV (prices rising), summed over 5 or 10 years, minus the net investment.",
        inputs: [{ label: "Energy price growth", value: `electricity ${pct(DEFAULT_FINANCE.priceGrowth, 2)}, gas ${pct(DEFAULT_FINANCE.gasPriceGrowth ?? DEFAULT_FINANCE.priceGrowth, 2)} a year`, cls: "verified" }],
        sources: [AEO],
        limits: ["Undiscounted: a dollar in year 10 counts like a dollar today."],
      };
    case "savingsPotential":
      return {
        title: "Savings potential",
        means: "What each hotel's best package within its own budget would save a year.",
        how: "For each hotel, the package with the highest 10-year NPV that fits its budget (only if that NPV is positive); the potential is that package's first-year savings. The portfolio figure is the sum.",
        inputs: [{ label: "Each hotel's budget and objective", value: "From its profile", cls: synthetic ? "synthetic" : "user" }],
        sources: [TRM],
        limits: ["A larger budget can raise the potential; it is not the technical maximum.", ...synthLimit],
      };
    case "portfolioCost":
      return {
        title: "Portfolio energy cost",
        means: "What the hotels shown are estimated to pay for electricity and gas in a typical year, added up.",
        how: "Each hotel is simulated on its own (its building, city weather, prices and, where chosen, its calibrated utility baseline and equipment corrections); the portfolio figure is the sum of their annual costs.",
        inputs: [{ label: "Hotels included", value: "Those matching the current organization and filters", cls: "modeled" }, { label: "Prices", value: "Each hotel's state EIA averages, or its own rates or bills", cls: "verified" }],
        sources: [BENCH, WEATHER, PRICES],
        limits: ["All-in average prices; no demand charges.", "Synthetic demonstration hotels unless you added your own."],
      };
    case "portfolioCarbon":
      return {
        title: "Portfolio carbon emissions",
        means: "Estimated CO₂-equivalent from the electricity and gas the hotels shown use, added up.",
        how: "For each hotel, electricity use times its grid region's factor plus gas use times the natural-gas factor; the portfolio figure is the sum.",
        inputs: [{ label: "Grid factors", value: "Each hotel's eGRID subregion (by city)", cls: "verified" }],
        sources: [GRID, "EPA GHG Emission Factors Hub 2025 (natural gas)"],
        limits: ["Annual average factors, not marginal; estimates, not verified carbon accounting.", "Covers electricity and on-site natural gas (Scope 1 and 2 energy). Not included: refrigerant leaks, district steam, fuel oil, propane, generator diesel, vehicles, power-line losses and supply-chain (Scope 3) emissions."],
      };
    case "portfolioIntensity":
      return {
        title: "Portfolio energy intensity",
        means: "Site energy per square foot a year for the hotels shown, taken together.",
        how: "The hotels' total site energy (kBtu) divided by their total floor area, so larger hotels weigh more.",
        inputs: [{ label: "Floor areas", value: "Each hotel's profile", cls: "modeled" }],
        sources: [BENCH],
        limits: ["A portfolio average; see each hotel's own intensity in the table."],
      };
    case "investmentPriority":
      return {
        title: "Investment priority",
        means: "Which hotel to start with: the best 10-year return per dollar invested, scaled so the best hotel scores 100.",
        how: "For each hotel, its best package's 10-year NPV divided by its net investment, then scaled against the best in the portfolio (0–100). High energy spending alone does not raise it; a hotel with no package of positive NPV scores 0.",
        inputs: [{ label: "Each hotel's best package", value: "10-year NPV and net investment from the engine", cls: "modeled" }],
        sources: [],
        limits: ["Depends on each hotel's budget and the eligible upgrades.", ...synthLimit],
      };
  }
}

/** The financial assumptions behind every plan, for the assumptions panel (Improvement 6E). */
export function financialAssumptions(s: TwinState): ExplainInput[] {
  const p = s.hotel.profile;
  const f = hotelData.defaults.finance;
  return [
    { label: "Discount rate (NPV)", value: `${pct(s.hotelDiscountRate, 0)} a year (editable; 3% shown as an alternative)`, cls: "assumption" },
    ...rateInputs(s),
    { label: "Electricity price growth", value: `${pct(f.elecPriceGrowth, 2)} a year (EIA AEO 2026)`, cls: "verified" },
    { label: "Gas price growth", value: `${pct(f.gasPriceGrowth, 2)} a year (EIA AEO 2026)`, cls: "verified" },
    { label: "Analysis horizon", value: `5 and 10 years (profile: ${p.horizonYears} years)`, cls: "assumption" },
    { label: "Analysis year (incentives)", value: String(ANALYSIS_YEAR), cls: "assumption" },
    { label: "Equipment life", value: "Per upgrade, from each upgrade's source (shown in the upgrade breakdown)", cls: "verified" },
    { label: "Installed costs", value: "Published unit costs where found; some still assumptions", cls: "assumption" },
    { label: "Maintenance", value: "Solar operation and maintenance $17.63 per kW a year (NREL ATB 2025); others not modeled", cls: "verified" },
    { label: "Incentives", value: `Only verified ${ANALYSIS_YEAR} program rates count`, cls: "verified" },
  ];
}
