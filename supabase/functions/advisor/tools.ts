// The tools the advisor may ask the browser to run (docs/23). The browser runs them with the Energy Twin engine; this file only
// describes them to the AI. Keep the names in step with src/engine/hotel/advisor/tools.ts (a test checks they match).

export interface ToolDef {
  name: string;
  description: string;
  input_schema: { type: 'object'; properties: Record<string, unknown>; required?: string[] };
}

const OBJECTIVE = { type: 'string', enum: ['balanced', 'annual_savings', 'payback', 'roi', 'carbon'], description: 'What the best plan should maximize. Defaults to the hotel profile.' };

export const TOOL_DEFS: ToolDef[] = [
  {
    name: 'run_scenario',
    description:
      'Simulate the open hotel under a what-if against today\'s baseline and return the yearly energy cost, electricity, gas and carbon before and after, the change and its drivers. Give only the settings the question asks about.',
    input_schema: {
      type: 'object',
      properties: {
        occupancyPct: { type: 'number', description: 'Average yearly occupancy, percent (5 to 100).' },
        electricityPriceChangePct: { type: 'number', description: 'Electricity price change, percent (for example 20 for +20%).' },
        gasPriceChangePct: { type: 'number', description: 'Natural gas price change, percent.' },
        heatingSetpointF: { type: 'number', description: 'Occupied guest-room heating setpoint, F (60 to 78).' },
        coolingSetpointF: { type: 'number', description: 'Occupied guest-room cooling setpoint, F (68 to 82).' },
        weatherOffsetF: { type: 'number', description: 'Degrees F added to every month\'s normal temperature (-15 to 15).' },
        commonAreaHvacHours: { type: 'number', description: 'Hours a day the lobby and hallway HVAC runs (0 to 24).' },
        lightingHoursPerDay: { type: 'number', description: 'Hours a day common-area lights are on (0 to 24).' },
        smartRoomControls: { type: 'boolean', description: 'Turn smart guest-room controls on.' },
      },
    },
  },
  {
    name: 'find_best_plan',
    description:
      'Run the budget optimizer for the open hotel: tests every combination of eligible upgrades within the budget and returns the best package (cost, incentives, savings, payback, NPV, carbon) and the other recommended packages.',
    input_schema: { type: 'object', properties: { budget: { type: 'number', description: 'Investment budget in dollars.' }, objective: OBJECTIVE }, required: ['budget'] },
  },
  {
    name: 'evaluate_upgrades',
    description: 'Evaluate a specific set of upgrades together for the open hotel (installed cost, counted incentives, net investment, yearly savings, payback, NPV, carbon).',
    input_schema: {
      type: 'object',
      properties: {
        upgrades: {
          type: 'array',
          description: 'Upgrade ids: smart_room_controls, insulation, led_lighting, occupancy_sensors, energy_management, hvac_upgrade, water_heating, rooftop_solar_quarter, rooftop_solar_half, rooftop_solar. Optional quantity in the catalog unit.',
          items: { type: 'object', properties: { id: { type: 'string' }, quantity: { type: 'number' } }, required: ['id'] },
        },
      },
      required: ['upgrades'],
    },
  },
  {
    name: 'compare_upgrades',
    description: 'Compare single upgrades side by side on the same assumptions (cost, savings, payback, NPV, carbon, whether each fits the budget). Leave upgrades empty for all eligible upgrades.',
    input_schema: { type: 'object', properties: { upgrades: { type: 'array', items: { type: 'string' }, description: 'Upgrade ids to compare.' } } },
  },
  {
    name: 'run_stress_test',
    description: 'Run one of the app\'s stress tests on the open hotel and return the cost before and after and whether it is a one-off event or every year.',
    input_schema: {
      type: 'object',
      properties: { id: { type: 'string', enum: ['heat_wave', 'cold_snap', 'low_solar', 'conference_surge', 'low_occupancy', 'hvac_decline', 'price_up_20', 'gas_up_20'] } },
      required: ['id'],
    },
  },
  {
    name: 'portfolio_overview',
    description: 'The hotel chain: totals (hotels, rooms, energy cost, carbon, savings potential) and each hotel ranked by investment priority.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'portfolio_optimize',
    description: 'Split one budget across the hotel chain with the portfolio optimizer; returns the totals and the package chosen for each hotel.',
    input_schema: {
      type: 'object',
      properties: { budget: { type: 'number', description: 'Total budget for the chain, dollars.' }, objective: { type: 'string', enum: ['balanced', 'annual_savings', 'npv10', 'payback', 'carbon'] } },
      required: ['budget'],
    },
  },
];
