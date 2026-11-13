import { baselineConditions } from './conditions';
import { leverReference } from './equipment';
import {
  CALIBRATION_RANGE,
  CATEGORIES,
  CATEGORY_OF,
  DAYS_IN_MONTH,
  DAYS_IN_YEAR,
  END_USES,
  HVAC_END_USES,
  KBTU_PER_KWH,
  KBTU_PER_THERM,
  LOAD_TYPES,
  ZONE_IDS,
} from './constants';
import { hotelData } from './data';
import { calibrationReport } from './bills';
import { isResolved, resolveProfile } from './profile';
import type {
  Calibration,
  Category,
  Cell,
  Conditions,
  EndUse,
  EnergyResult,
  HotelData,
  HotelInput,
  HotelProfile,
  LoadType,
  MonthSummary,
  ResolvedProfile,
  Totals,
  ZoneId,
} from './types';

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

export const emptyTotals = (): Totals => ({
  elecKWh: 0,
  gasTherms: 0,
  siteKBtu: 0,
  elecCost: 0,
  gasCost: 0,
  cost: 0,
  carbonKg: 0,
});

export function addTotals(a: Totals, b: Totals): Totals {
  return {
    elecKWh: a.elecKWh + b.elecKWh,
    gasTherms: a.gasTherms + b.gasTherms,
    siteKBtu: a.siteKBtu + b.siteKBtu,
    elecCost: a.elecCost + b.elecCost,
    gasCost: a.gasCost + b.gasCost,
    cost: a.cost + b.cost,
    carbonKg: a.carbonKg + b.carbonKg,
  };
}

export function subTotals(a: Totals, b: Totals): Totals {
  return {
    elecKWh: a.elecKWh - b.elecKWh,
    gasTherms: a.gasTherms - b.gasTherms,
    siteKBtu: a.siteKBtu - b.siteKBtu,
    elecCost: a.elecCost - b.elecCost,
    gasCost: a.gasCost - b.gasCost,
    cost: a.cost - b.cost,
    carbonKg: a.carbonKg - b.carbonKg,
  };
}

export const cellTotals = (c: Cell): Totals => ({
  elecKWh: c.elecKWh,
  gasTherms: c.gasTherms,
  siteKBtu: c.siteKBtu,
  elecCost: c.elecCost,
  gasCost: c.gasCost,
  cost: c.cost,
  carbonKg: c.carbonKg,
});

/** Totals of a set of cells. */
export function sumCells(cells: Cell[]): Totals {
  return cells.reduce((t, x) => addTotals(t, cellTotals(x)), emptyTotals());
}

/** Annual, monthly, zone, end-use, category and load-kind aggregates of a set of cells. */
export function aggregateCells(
  cells: Cell[],
  monthMeta: { occupancy: number; hdd: number; cdd: number }[],
): Pick<EnergyResult, 'annual' | 'months' | 'byZone' | 'byCategory' | 'byEndUse' | 'byLoadType'> {
  const annual = sumCells(cells);
  const months: MonthSummary[] = monthMeta.map((meta, m) => ({
    month: m,
    days: DAYS_IN_MONTH[m] ?? 30,
    occupancy: meta.occupancy,
    hdd: meta.hdd,
    cdd: meta.cdd,
    totals: sumCells(cells.filter((x) => x.month === m)),
  }));
  const byZone = {} as Record<ZoneId, Totals>;
  for (const z of ZONE_IDS) byZone[z] = sumCells(cells.filter((x) => x.zone === z));
  const byEndUse = {} as Record<EndUse, Totals>;
  for (const u of END_USES) byEndUse[u] = sumCells(cells.filter((x) => x.endUse === u));
  const byCategory = {} as Record<Category, Totals>;
  for (const cat of CATEGORIES) byCategory[cat] = sumCells(cells.filter((x) => CATEGORY_OF[x.endUse] === cat));
  const byLoadType = { base: 0, occupancy: 0, weather: 0, schedule: 0 } as Record<LoadType, number>;
  for (const x of cells) for (const lt of LOAD_TYPES) byLoadType[lt] += x.loadKBtu[lt];
  return { annual, months, byZone, byCategory, byEndUse, byLoadType };
}

/** A full result for a changed set of cells (for example after upgrades), keeping the template's meta. */
export function toEnergyResult(template: EnergyResult, cells: Cell[]): EnergyResult {
  const agg = aggregateCells(
    cells,
    template.months.map((m) => ({ occupancy: m.occupancy, hdd: m.hdd, cdd: m.cdd })),
  );
  return { ...template, cells, ...agg };
}

function ageFactor(yearBuilt: number, data: HotelData): number {
  const row = data.defaults.ageFactor.find((r) => yearBuilt < r.before);
  return row?.factor ?? 1;
}

function climateFor(p: HotelProfile, data: HotelData) {
  const c = data.weather.climates[p.climateId] ?? data.weather.climates[data.weather.defaultClimate];
  if (!c) throw new Error(`No climate "${p.climateId}" in weather.json`);
  return c;
}

/** Heating and cooling degree days per month from monthly mean temperatures. */
export function degreeDays(meanTempF: number[], balancePointF: number, offsetF: number[]) {
  const hdd: number[] = [];
  const cdd: number[] = [];
  meanTempF.forEach((t, m) => {
    const days = DAYS_IN_MONTH[m] ?? 30;
    const adj = t + (offsetF[m] ?? 0);
    hdd.push(Math.max(0, balancePointF - adj) * days);
    cdd.push(Math.max(0, adj - balancePointF) * days);
  });
  return { hdd, cdd };
}

function fuelSplit(u: EndUse, p: HotelProfile, data: HotelData): { electric: number; gas: number } {
  if (u === 'heating') {
    return data.defaults.heatingFuelByHvac[p.hvacType] === 'electric' ? { electric: 1, gas: 0 } : { electric: 0, gas: 1 };
  }
  return data.defaults.fuelMix[u];
}

function zoneShare(u: EndUse, z: ZoneId, p: HotelProfile, data: HotelData): number {
  const d = data.defaults;
  if (HVAC_END_USES.includes(u)) {
    const plant = d.hvacPlantShare[p.hvacType];
    if (z === 'central_hvac') return plant;
    if (z === 'hot_water') return 0;
    return d.hvacZoneShares[z] * (1 - plant);
  }
  if (u === 'lighting' || u === 'equipment' || u === 'other' || u === 'kitchen' || u === 'hotWater') {
    return d.zoneAllocation[u][z];
  }
  return 0;
}

/** Setpoint multiplier on the weather-driven part of guest-room heating or cooling. 1 at the reference setpoints. */
function guestRoomSetpointMult(u: 'heating' | 'cooling', occ: number, c: Conditions, data: HotelData): number {
  const k = data.defaults.setpointSensitivity;
  const ref = data.defaults.referenceSetpoints;
  const g = (t: number) =>
    u === 'heating'
      ? clamp(1 + k.heatingPerF * (t - ref.heatF), k.min, k.max)
      : clamp(1 + k.coolingPerF * (ref.coolF - t), k.min, k.max);
  const presence = clamp((occ * c.occupiedHoursPerRoom) / 24, 0, 1); // share of time a booked room has a guest in it
  const occupied = u === 'heating' ? c.setpoints.occupiedHeatF : c.setpoints.occupiedCoolF;
  const vacant = u === 'heating' ? c.setpoints.vacantHeatF : c.setpoints.vacantCoolF;
  return presence * g(occupied) + (1 - presence) * g(vacant);
}

const LOAD_ZONES = ['guest_rooms', 'lobby_common', 'kitchen_restaurant', 'hallways_shared'] as const;

/**
 * Multiplier on the weather-driven part of an HVAC end use. The central plant serves the other zones, so its multiplier
 * is the load-weighted average of theirs: a setback in guest rooms also lowers what the plant has to deliver.
 */
function weatherMult(z: ZoneId, u: EndUse, occ: number, c: Conditions, data: HotelData): number {
  if (z === 'central_hvac' && HVAC_END_USES.includes(u)) {
    const shares = data.defaults.hvacZoneShares;
    let acc = 0;
    let tot = 0;
    for (const zz of LOAD_ZONES) {
      acc += shares[zz] * weatherMult(zz, u, occ, c, data);
      tot += shares[zz];
    }
    return acc / tot;
  }
  if (z === 'guest_rooms' && (u === 'heating' || u === 'cooling')) return guestRoomSetpointMult(u, occ, c, data);
  if ((z === 'lobby_common' || z === 'hallways_shared') && HVAC_END_USES.includes(u)) {
    return 1 - data.defaults.commonHvacRecoveryFactor * (1 - c.commonAreaHvacHours / 24);
  }
  return 1;
}

/** Schedule factor (1 = the 24-hour benchmark). The plant's ventilation follows the zones it serves. */
function scheduleFactor(z: ZoneId, u: EndUse, c: Conditions, data: HotelData): number {
  if (z === 'central_hvac' && u === 'ventilation') {
    const shares = data.defaults.hvacZoneShares;
    let acc = 0;
    let tot = 0;
    for (const zz of LOAD_ZONES) {
      acc += shares[zz] * scheduleFactor(zz, u, c, data);
      tot += shares[zz];
    }
    return acc / tot;
  }
  if (z === 'lobby_common' || z === 'hallways_shared') {
    if (u === 'lighting') return c.lightingHoursPerDay / 24;
    if (u === 'ventilation') return c.commonAreaHvacHours / 24;
  }
  return 1;
}

/**
 * Energy to bring a set-back guest room back to the occupied setpoint when a guest returns, in site kBtu.
 * events = booked rooms × returns per day × days (scaled by how much time guests are away); each event needs
 * setback depth × thermal mass per °F, spread over heating or cooling months by degree days, divided by equipment efficiency.
 * Zero when there is no setback, and zero when guests are always in their rooms.
 */
function recoverySiteKBtu(
  u: 'heating' | 'cooling',
  p: HotelProfile,
  c: Conditions,
  occ: number,
  days: number,
  hdd: number,
  cdd: number,
  data: HotelData,
): number {
  const k = data.defaults.recovery;
  const depth =
    u === 'heating'
      ? Math.max(0, c.setpoints.occupiedHeatF - c.setpoints.vacantHeatF)
      : Math.max(0, c.setpoints.vacantCoolF - c.setpoints.occupiedCoolF);
  if (depth <= 0 || k.kBtuPerRoomPerF <= 0) return 0;
  const away = 1 - c.occupiedHoursPerRoom / 24;
  const refAway = 1 - k.referenceOccupiedHoursPerRoom / 24;
  const events = occ * p.rooms * days * k.returnsPerBookedRoomPerDay * (refAway > 0 ? away / refAway : 0);
  const total = hdd + cdd;
  const share = total > 0 ? (u === 'heating' ? hdd : cdd) / total : 0;
  const thermal = events * depth * k.kBtuPerRoomPerF * share;
  const eff = u === 'heating' ? data.defaults.heatingSystems[p.hvacType].efficiency : k.coolingCOP;
  return eff > 0 ? thermal / eff : 0;
}

/**
 * The simulation core. Annual benchmark energy for each zone and end use is spread over the months by four drivers:
 *   monthly = E0 × ( wBase×days/365 + wOcc×occupancy + wWeather×weather×setpoint + wSched×hours )
 * Every driver equals 1 at the benchmark conditions, so the annual total equals E0 there. See docs/13.
 */
export function simulate(
  p: HotelProfile,
  c: Conditions,
  data: HotelData = hotelData,
  calibration: Calibration = { factor: 1, source: 'benchmark', clamped: false },
): EnergyResult {
  const d = data.defaults;
  const climate = climateFor(p, data);
  const normal = degreeDays(climate.meanTempF, climate.balancePointF, new Array<number>(12).fill(0));
  const actual = degreeDays(climate.meanTempF, climate.balancePointF, c.weatherOffsetF);
  const hddN = normal.hdd.reduce((s, x) => s + x, 0);
  const cddN = normal.cdd.reduce((s, x) => s + x, 0);

  const elecRate = p.electricityRate * c.elecRateMult;
  const gasRate = p.gasRate * c.gasRateMult;
  const efElec = data.emissions.subregions[p.gridSubregion]?.kgCO2ePerKWh ?? data.emissions.usKgCO2ePerKWh;
  const efGas = data.emissions.gasKgCO2ePerTherm;

  const eui = data.defaults.euiKBtuPerSqft[p.climateId] ?? data.defaults.euiKBtuPerSqft['default'] ?? 92;
  const siteAnnual = eui * p.floorAreaSqft * ageFactor(p.yearBuilt, data) * calibration.factor;

  const cells: Cell[] = [];
  const hotWaterScale = c.hotWaterGalPerOccupiedRoomDay / d.benchmarkHotWaterGalPerOccupiedRoomDay;

  for (const u of END_USES) {
    // Heating: the CBECS share describes a gas-heated hotel; other systems need reference efficiency / their efficiency as much site energy.
    const hs = d.heatingSystems;
    // The hotel's current equipment (docs/20) replaces the reference efficiency where the operator entered one.
    const lev = p.equipmentLevers ?? {};
    const heatFactor = u === 'heating' ? hs.reference.efficiency / (lev.heatingEfficiency ?? hs[p.hvacType].efficiency) : 1;
    const ref = leverReference(p, data);
    const coolFactor = u === 'cooling' && lev.coolingCop ? ref.coolingCop / lev.coolingCop : 1;
    const share = (d.endUseShareOfSiteByClimate?.[p.climateId] ?? d.endUseShareOfSite)[u];
    const baseFuel = fuelSplit(u, p, data);
    // Water heaters' efficiency scales the gas part of hot water only (the electric part is pumps and electric heaters).
    const dhw = u === 'hotWater' && lev.waterHeaterEfficiency ? ref.waterHeaterEfficiency / lev.waterHeaterEfficiency : 1;
    const dhwMult = baseFuel.electric + baseFuel.gas * dhw;
    const fuel = dhw === 1 ? baseFuel : { electric: baseFuel.electric / dhwMult, gas: (baseFuel.gas * dhw) / dhwMult };
    const e0u = siteAnnual * share * heatFactor * coolFactor * dhwMult;
    const w = d.driverWeights[u];
    for (const z of ZONE_IDS) {
      const zs = zoneShare(u, z, p, data);
      if (zs <= 0) continue;
      // Lighting already LED in a zone uses less: the LED measure's own mid reduction on the LED share (docs/20).
      const ledShare = u === 'lighting' ? (lev.ledShare?.[z] ?? 0) : 0;
      const e0 = e0u * zs * (ledShare > 0 ? 1 - ledShare * ledReductionMid(data) : 1);
      for (let m = 0; m < 12; m++) {
        const days = DAYS_IN_MONTH[m] ?? 30;
        const occ = c.occupancyByMonth[m] ?? 0;
        const base = days / DAYS_IN_YEAR;
        const occTerm = ((occ * days) / (d.benchmarkOccupancy * DAYS_IN_YEAR)) * (u === 'hotWater' ? hotWaterScale : 1);
        const hdd = actual.hdd[m] ?? 0;
        const cdd = actual.cdd[m] ?? 0;
        let wx = 0;
        if (u === 'heating') wx = hddN > 0 ? hdd / hddN : 0;
        else if (u === 'cooling') wx = cddN > 0 ? cdd / cddN : 0;
        else if (u === 'ventilation') wx = hddN + cddN > 0 ? (hdd + cdd) / (hddN + cddN) : 0;
        const weatherTerm = wx * weatherMult(z, u, occ, c, data);
        const schedTerm = scheduleFactor(z, u, c, data) * base;

        const recovery =
          z === 'guest_rooms' && (u === 'heating' || u === 'cooling') ? recoverySiteKBtu(u, p, c, occ, days, hdd, cdd, data) : 0;
        // Smart room controls also turn the guest-room fan coil down while a room is empty (IL-TRM 4.4.8; calibrated share).
        const fanMult =
          z === 'guest_rooms' && u === 'ventilation' && c.smartRoomControls
            ? 1 - d.smartControlFan.reductionWhenEmpty * (1 - clamp((occ * c.occupiedHoursPerRoom) / 24, 0, 1))
            : 1;
        const loadKBtu: Record<LoadType, number> = {
          base: e0 * w.base * base * fanMult,
          occupancy: (e0 * w.occupancy * occTerm) * fanMult + recovery,
          weather: e0 * w.weather * weatherTerm * fanMult,
          schedule: e0 * w.schedule * schedTerm * fanMult,
        };
        // Equipment condition (stress test): heating and cooling use more (or less) energy for the same load.
        const hvacMult = u === 'heating' || u === 'cooling' ? (c.hvacEnergyMult ?? 1) : 1;
        if (hvacMult !== 1) for (const lt of Object.keys(loadKBtu) as LoadType[]) loadKBtu[lt] *= hvacMult;
        const siteKBtuRaw = loadKBtu.base + loadKBtu.occupancy + loadKBtu.weather + loadKBtu.schedule;
        // Utility-bill calibration (docs/19): each fuel's weather-independent kinds (base, occupancy, schedule) and its weather kind
        // scale by their own fitted factors; 1 without bills, so nothing changes then.
        let elecKBtu = siteKBtuRaw * fuel.electric;
        let gasKBtu = siteKBtuRaw * fuel.gas;
        const ff = calibration.fuelFactors;
        if (ff) {
          elecKBtu = 0;
          gasKBtu = 0;
          for (const lt of Object.keys(loadKBtu) as LoadType[]) {
            const kE = lt === 'weather' ? ff.elec.weather : ff.elec.base;
            const kG = lt === 'weather' ? ff.gas.weather : ff.gas.base;
            const e = loadKBtu[lt] * fuel.electric * kE;
            const g = loadKBtu[lt] * fuel.gas * kG;
            loadKBtu[lt] = e + g;
            elecKBtu += e;
            gasKBtu += g;
          }
        }
        const siteKBtu = elecKBtu + gasKBtu;
        const elecKWh = elecKBtu / KBTU_PER_KWH;
        const gasTherms = gasKBtu / KBTU_PER_THERM;
        const elecCost = elecKWh * elecRate;
        const gasCost = gasTherms * gasRate;
        cells.push({
          zone: z,
          endUse: u,
          month: m,
          elecKWh,
          gasTherms,
          siteKBtu,
          elecCost,
          gasCost,
          cost: elecCost + gasCost,
          carbonKg: elecKWh * efElec + gasTherms * efGas,
          loadKBtu,
        });
      }
    }
  }

  const monthMeta = Array.from({ length: 12 }, (_, m) => ({
    occupancy: c.occupancyByMonth[m] ?? 0,
    hdd: actual.hdd[m] ?? 0,
    cdd: actual.cdd[m] ?? 0,
  }));
  if (p.equipmentLevers?.existingSolarKw) applyExistingSolar(cells, p, data, { elecRate, gasRate, efElec, efGas });
  const agg = aggregateCells(cells, monthMeta);

  return {
    hotelName: p.name,
    cells,
    ...agg,
    calibration,
    rates: { elecPerKWh: elecRate, gasPerTherm: gasRate },
    emissionFactors: { elecKgPerKWh: efElec, gasKgPerTherm: efGas },
    estimated: calibration.source === 'benchmark' || calibration.clamped,
    conditions: c,
    sources: [d.source, data.weather.source, data.rates[p.state]?.source ?? data.rates['default']?.source ?? '', data.emissions.source].filter(Boolean),
  };
}

/**
 * Baseline energy, cost and carbon by zone, end use and month. Without a bill, benchmarks stand in (flagged
 * estimated). With a bill, the benchmark is scaled by a bounded factor so the annual cost matches 12 × the bill.
 */
export function calculateBaselineEnergy(
  input: HotelInput | ResolvedProfile = {},
  data: HotelData = hotelData,
): EnergyResult {
  const resolved = isResolved(input) ? input : resolveProfile(input, data);
  const p = resolved.profile;
  const cond = baselineConditions(p, data);
  const raw = simulate(p, cond, data);
  if (p.utilityBills.length > 0) {
    const calibrated = calibrateToBills(p, cond, raw, data);
    if (calibrated.calibration.source === 'bill') return calibrated;
    // No fuel could be calibrated: fall back to the monthly bill (if any) or the benchmark, keeping the report.
    if (p.monthlyEnergyBill == null || raw.annual.cost <= 0) return calibrated;
  }
  if (p.monthlyEnergyBill == null || raw.annual.cost <= 0) return raw;
  const wanted = (p.monthlyEnergyBill * 12) / raw.annual.cost;
  const factor = clamp(wanted, CALIBRATION_RANGE[0], CALIBRATION_RANGE[1]);
  return simulate(p, cond, data, { factor, source: 'bill', clamped: factor !== wanted });
}

/**
 * Calibrate to utility bills (docs/19): per fuel, bounded multipliers on the weather-independent and the weather-driven parts, fitted
 * to the bills by least squares (`calibrationReport`). A fuel that cannot be calibrated keeps the model (factors 1). When no fuel can,
 * the uncalibrated result is returned with the report attached, so the app can say why.
 */
function calibrateToBills(p: HotelProfile, cond: Conditions, raw: EnergyResult, data: HotelData): EnergyResult {
  const report = calibrationReport(raw, p.utilityBills);
  if (!report.usable) return { ...raw, calibration: { ...raw.calibration, report } };
  const fuelFactors = { elec: report.elec.factors, gas: report.gas.factors };
  const clamped = (report.elec.usable && report.elec.atBound) || (report.gas.usable && report.gas.atBound);
  const cal: Calibration = { factor: 1, source: 'bill', clamped, method: 'utility_bills', fuelFactors, report };
  return simulate(p, cond, data, cal);
}

/** The LED retrofit's mid lighting reduction (upgrades.json), used for lighting that is already LED. */
export function ledReductionMid(data: HotelData): number {
  return data.upgrades.upgrades.find((u) => u.id === 'led_lighting')?.params['lightingReduction']?.mid ?? 0;
}

/**
 * Existing solar (docs/20): each month's generation (kW x the location's PVWatts mid yield x the month's share) is subtracted from
 * the hotel's purchased electricity, at most all of it (no export credit, monthly netting). The reduction is spread over the month's
 * electric cells in proportion to their electricity, so every zone and end use shows purchased energy.
 */
function applyExistingSolar(cells: Cell[], p: HotelProfile, data: HotelData, env: { elecRate: number; gasRate: number; efElec: number; efGas: number }): void {
  const kw = p.equipmentLevers?.existingSolarKw ?? 0;
  const climate = data.weather.climates[p.climateId] ?? data.weather.climates[data.weather.defaultClimate];
  const sol = climate?.solar;
  if (!sol || kw <= 0) return;
  for (let m = 0; m < 12; m++) {
    const month = cells.filter((c) => c.month === m);
    const elec = month.reduce((s, c) => s + c.elecKWh, 0);
    if (elec <= 0) continue;
    const gen = kw * sol.kWhPerKwYear.mid * (sol.monthlyShare[m] ?? 0);
    const k = 1 - Math.min(gen, elec) / elec;
    for (const c of month) {
      if (c.elecKWh <= 0) continue;
      const removedKBtu = c.elecKWh * (1 - k) * KBTU_PER_KWH;
      const site = c.siteKBtu;
      c.elecKWh *= k;
      if (site > 0) for (const lt of Object.keys(c.loadKBtu) as LoadType[]) c.loadKBtu[lt] *= (site - removedKBtu) / site;
      c.siteKBtu = Math.max(0, site - removedKBtu);
      c.elecCost = c.elecKWh * env.elecRate;
      c.cost = c.elecCost + c.gasCost;
      c.carbonKg = c.elecKWh * env.efElec + c.gasTherms * env.efGas;
    }
  }
}
