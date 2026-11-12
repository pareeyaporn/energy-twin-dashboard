export * from './types';
export * from './constants';
export { hotelData, hotelPortfolio, hotelOrganizations } from './data';
export { resolveProfile, presetProfile, isResolved } from './profile';
export { baselineConditions, applyScenario, comfortFlags, monthlyOccupancy } from './conditions';
export {
  calculateBaselineEnergy,
  simulate,
  degreeDays,
  emptyTotals,
  addTotals,
  subTotals,
  sumCells,
  aggregateCells,
  toEnergyResult,
} from './baseline';
export {
  simulateEnergyScenario,
  simulateOccupancyChange,
  simulateHVACSettings,
  STRESS_TESTS,
  STRESS_CATEGORIES,
} from './scenarios';
export type { StressTest, HvacSettings } from './scenarios';
export { typicalDayProfile, simulatedMeter, roomOccupancyPattern, equipmentInventory, energyFlows, energyFlowsAt, typicalDayByZoneEndUse } from './twin';
export type { HourPoint, MeterReading, RoomPoint, RoomState, EquipmentItem, FlowGraph, FlowNode, FlowLink, ZoneEndUseDay } from './twin';
export { parseUtilityBillsCsv, normalizeBills, billRates, billFit, parseMonth, GUIDELINE_14_MONTHLY } from './bills';
export {
  upgradeDef,
  upgradeLifetime,
  orderUpgrades,
  eligibleUpgrades,
  validateUpgradeSet,
  prepareUpgradeContext,
  prepareScenarioContext,
  contextFromBaseline,
  calculateUpgradeSavings,
  solarSizeKw,
  areasOf,
  comfortFor,
} from './upgrades';
export type { UpgradeContext } from './upgrades';
export { upgradeCost, packageCost } from './costs';
export {
  calculateFinancialMetrics,
  DEFAULT_FINANCE,
  ANALYSIS_YEAR,
  incentiveStatus,
  programYearOf,
  BENEFIT_YEARS,
  PROJECTION_YEARS,
  financialBreakdown,
  incentiveLines,
  netBenefitOver,
  npvOver,
  savingsInYear,
} from './finance';
export type { IncentiveOverrides, SavingsStream } from './finance';
export { evaluatePackage, packageMetrics, solarDegradation } from './package';
export { compareUpgrades } from './comparison';
export type { UpgradeComparisonRow } from './comparison';
export {
  climateSolar,
  regionalSolar,
  solarCostPerW,
  exportCreditPerKWh,
  solarYield,
  daylightShape,
  daylight,
  sunElevationDeg,
  sunAzimuthDeg,
  solarHourKW,
  outdoorTempF,
} from './solar';
export type { EvaluateOptions } from './package';
export { optimizeInvestmentPortfolio, normalizedWeights } from './optimizer';
export { explainPortfolio } from './explain';
export { opportunitiesByZone } from './opportunities';
export type { ZoneOpportunity } from './opportunities';
export * as advisor from './advisor';
export { benchmarkComparison } from './benchmark';
export {
  CATALOG_CATEGORIES,
  CATALOG_IDS,
  upgradeCatalog,
  planAmounts,
  evaluatePlan,
  evaluatePlanItem,
  planFromPackage,
  explainPlan,
} from './plans';
export type { CatalogItem, CatalogQuantity, QuantityKind, PlanItem, PlanWarning, PlanWarningKind, PlanEvaluation } from './plans';
export { stressRecommendation, stressTestReport } from './stress';
export type { StressReport, StressPlanInput, StressPlanResult } from './stress';
export type { StressCategory } from './scenarios';

export {
  PORTFOLIO_DEFAULTS,
  PORTFOLIO_OBJECTIVES,
  PORTFOLIO_DEFINITIONS,
  prepareProperty,
  propertyCandidates,
  portfolioSummary,
  optimizePortfolioBudget,
  chooseOnePerGroup,
  portfolioTotals,
} from './portfolio';
export type { PreparedProperty, PropertySummary, PortfolioSummary, PortfolioAllocation, PortfolioPlan, PortfolioTotals } from './portfolio';
export { evaluatePortfolioCustomPlan, portfolioStressReport } from './portfolioPlans';
export type { PortfolioCustomRow, PortfolioCustomEvaluation, PortfolioStressRow, PortfolioStressReport } from './portfolioPlans';
