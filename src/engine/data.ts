import ratesJson from '@/data/rates.json';
import endUseSplitsJson from '@/data/endUseSplits.json';
import componentLossSharesJson from '@/data/componentLossShares.json';
import defaultsJson from '@/data/defaults.json';
import upgradesJson from '@/data/upgrades.json';
import type { EngineData, Era, PartId } from './types';

const { source: splitSource, verified: splitVerified, ...zones } = endUseSplitsJson as Record<string, unknown>;
const { source: lossSource, verified: lossVerified, ...eras } = componentLossSharesJson as Record<string, unknown>;

/** The sourced data the engine reads. Pass a different bundle to tests to isolate behavior. */
export const defaultData: EngineData = {
  upgrades: upgradesJson as unknown as EngineData['upgrades'],
  rates: ratesJson as unknown as EngineData['rates'],
  endUseSplits: {
    source: splitSource as string,
    verified: splitVerified as boolean,
    zones: zones as EngineData['endUseSplits']['zones'],
  },
  componentLossShares: {
    source: lossSource as string,
    verified: lossVerified as boolean,
    eras: eras as Record<Era, Record<PartId, number>>,
  },
  defaults: defaultsJson as unknown as EngineData['defaults'],
};
