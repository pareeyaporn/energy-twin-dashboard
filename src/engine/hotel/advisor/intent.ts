import type { UpgradeId, ZoneId } from '../types';

export type Intent = 'portfolio' | 'compare' | 'budget' | 'hvac_cost' | 'occupancy' | 'scenario' | 'zone_cost' | 'general';

export interface ParsedQuestion {
  intent: Intent;
  /** Upgrades named in the question, in the order they appear. */
  upgrades: UpgradeId[];
  /** Dollar amounts in the question that look like budgets (for example $30,000 or 30k). */
  budgets: number[];
  zones: ZoneId[];
}

const UPGRADE_WORDS: [UpgradeId, RegExp][] = [
  ['smart_room_controls', /thermostat|room control|smart (room|hvac|control)|occupancy sensing/i],
  ['rooftop_solar', /solar|photovoltaic|\bpv\b/i],
  ['led_lighting', /\bleds?\b|lighting retrofit|light bulbs?/i],
  ['occupancy_sensors', /occupancy sensors?|motion sensors?|hallway sensors?/i],
  ['energy_management', /energy management|\bems\b|\bbms\b|building automation/i],
  ['hvac_upgrade', /hvac (upgrade|equipment|replacement)|chiller|boiler|new hvac|replace (the )?hvac/i],
  ['insulation', /insulat|envelope/i],
  ['water_heating', /water heat|hot water|low.?flow/i],
];

const ZONE_WORDS: [ZoneId, RegExp][] = [
  ['guest_rooms', /guest room|\brooms?\b/i],
  ['lobby_common', /lobby|common area/i],
  ['kitchen_restaurant', /kitchen|restaurant/i],
  ['hallways_shared', /hallway|corridor|elevator|laundry/i],
  ['central_hvac', /central (hvac|plant)|mechanical|boiler|chiller/i],
  ['hot_water', /hot water|water heat/i],
];

/** Amounts like $30,000, $30k, 30k, 30 thousand, 50,000 dollars. Only values that plausibly are budgets (1,000 to 5,000,000). */
export function parseBudgets(q: string): number[] {
  const out: number[] = [];
  const re = /\$\s?(\d{1,3}(?:,\d{3})+|\d+)(\.\d+)?\s?(k|thousand|m|million)?|\b(\d{1,3}(?:,\d{3})+|\d+)(\.\d+)?\s?(k|thousand|million)\b|\b(\d{1,3}(?:,\d{3})+|\d+)\s?dollars\b/gi;
  for (const m of q.matchAll(re)) {
    const digits = (m[1] ?? m[4] ?? m[7] ?? '').replace(/,/g, '');
    const frac = m[2] ?? m[5] ?? '';
    const unit = (m[3] ?? m[6] ?? '').toLowerCase();
    let v = Number(digits + frac);
    if (unit === 'k' || unit === 'thousand') v *= 1000;
    if (unit === 'm' || unit === 'million') v *= 1_000_000;
    if (Number.isFinite(v) && v >= 1000 && v <= 5_000_000 && !out.includes(v)) out.push(v);
  }
  return out;
}

/** Work out what is being asked. Deterministic keyword rules; the answer text itself never depends on a model. */
export function parseQuestion(question: string): ParsedQuestion {
  const q = question.toLowerCase();
  const found = UPGRADE_WORDS.map(([id, re]) => ({ id, at: q.search(re) }))
    .filter((x) => x.at >= 0)
    .sort((a, b) => a.at - b.at)
    .map((x) => x.id);
  // "occupancy sensors" should not also count as "occupancy sensing" thermostats
  const upgrades = found.includes('occupancy_sensors') && /occupancy sensors?/i.test(q) && !/thermostat|room control/i.test(q) ? found.filter((u) => u !== 'smart_room_controls') : found;
  const budgets = parseBudgets(question);
  const zones = ZONE_WORDS.filter(([, re]) => re.test(q)).map(([z]) => z);

  const versus = /\b(over|vs\.?|versus|or|instead of|rather than|before|first|than)\b/.test(q);
  let intent: Intent = 'general';
  // Questions about the chain: "which hotel first", "across our hotels", "the portfolio", "which property".
  const portfolio = /portfolio|\bchain\b|which (hotel|property)|our hotels|all (the |our |five |5 )?hotels|across (the |our |my )?(hotels|properties|portfolio)|\bproperties\b|each hotel|hotels? (should|to) (we |i )?(invest|start|upgrade|prioriti)/.test(q);
  if (portfolio) intent = 'portfolio';
  else if (upgrades.length >= 2 && versus) intent = 'compare';
  else if (budgets.length > 0 || /\b(budget|how should i (use|spend)|how much should i|afford)\b/.test(q)) intent = 'budget';
  else if (/hvac|heating|cooling|air.?condition/.test(q) && /(cost|expens|biggest|largest|most|why|high)/.test(q)) intent = 'hvac_cost';
  else if (/occupan|full hotel|fill|guests?\b.*(more|fewer)/.test(q)) intent = 'occupancy';
  else if (/heat wave|cold snap|price|rates?\b|what if|what happens if|scenario|conference|more expensive|goes? up|rises?\b|increases?\b/.test(q)) intent = 'scenario';
  else if (zones.length > 0 && /(cost|expens|use|energy|spend|biggest)/.test(q)) intent = 'zone_cost';
  return { intent, upgrades, budgets, zones };
}

export const ADVISOR_SUGGESTED_QUESTIONS = [
  'Why is HVAC my biggest cost?',
  'How does occupancy change my energy use?',
  'Should I start with solar or smart thermostats?',
  'How should I use $30,000?',
] as const;
