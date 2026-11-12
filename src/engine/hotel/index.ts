export * from './types';
export * from './constants';
export { hotelData } from './data';
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
} from './scenarios';
export type { StressTest, HvacSettings } from './scenarios';
export { typicalDayProfile, simulatedMeter, roomOccupancyPattern, equipmentInventory, energyFlows } from './twin';
export type { HourPoint, MeterReading, RoomPoint, RoomState, EquipmentItem, FlowGraph, FlowNode, FlowLink } from './twin';
export {
  upgradeDef,
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
export { calculateFinancialMetrics, DEFAULT_FINANCE } from './finance';
export { evaluatePackage } from './package';
export type { EvaluateOptions } from './package';
export { optimizeInvestmentPortfolio } from './optimizer';
export { explainPortfolio } from './explain';
export { opportunitiesByZone } from './opportunities';
export type { ZoneOpportunity } from './opportunities';
export * as advisor from './advisor';
