import defaultsJson from '@/data/hotel/defaults.json';
import weatherJson from '@/data/hotel/weather.json';
import ratesJson from '@/data/hotel/rates.json';
import emissionsJson from '@/data/hotel/emissions.json';
import shapesJson from '@/data/hotel/shapes.json';
import equipmentJson from '@/data/hotel/equipment.json';
import presetsJson from '@/data/hotel/presets.json';
import upgradesJson from '@/data/hotel/upgrades.json';
import incentivesJson from '@/data/hotel/incentives.json';
import type { HotelData } from './types';

/** The sourced data the hotel engine reads. Pass a different bundle to tests to isolate behavior. */
export const hotelData: HotelData = {
  defaults: defaultsJson as unknown as HotelData['defaults'],
  weather: weatherJson as unknown as HotelData['weather'],
  rates: ratesJson as unknown as HotelData['rates'],
  emissions: emissionsJson as unknown as HotelData['emissions'],
  shapes: shapesJson as unknown as HotelData['shapes'],
  equipment: equipmentJson as unknown as HotelData['equipment'],
  presets: presetsJson as unknown as HotelData['presets'],
  upgrades: upgradesJson as unknown as HotelData['upgrades'],
  incentives: incentivesJson as unknown as HotelData['incentives'],
};
