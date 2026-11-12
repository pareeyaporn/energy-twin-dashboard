// Scenery rules for the 3D hotel: season from the month, foliage, snow, sky and light from the sun's height. Pure and deterministic.
// These are visual only (scenery). Every energy number the scene shows comes from the engine through the store.

export type Season = 'winter' | 'spring' | 'summer' | 'fall';

/** Meteorological seasons (Northern Hemisphere): Dec–Feb winter, Mar–May spring, Jun–Aug summer, Sep–Nov fall. */
export function seasonOf(month: number): Season {
  const m = ((Math.round(month) % 12) + 12) % 12;
  if (m === 11 || m <= 1) return 'winter';
  if (m <= 4) return 'spring';
  if (m <= 7) return 'summer';
  return 'fall';
}

export interface Scenery {
  season: Season;
  /** Deciduous canopy color, or null when the trees are bare. */
  foliage: string | null;
  evergreen: string;
  ground: string;
  snowCover: boolean;
  snowfall: boolean;
}

export function sceneryFor(month: number): Scenery {
  const season = seasonOf(month);
  switch (season) {
    case 'winter':
      return { season, foliage: null, evergreen: '#2f5d4a', ground: '#e8eef5', snowCover: true, snowfall: true };
    case 'spring':
      return { season, foliage: '#7fc96b', evergreen: '#2f6b4f', ground: '#5f9e57', snowCover: false, snowfall: false };
    case 'summer':
      return { season, foliage: '#3f9a4d', evergreen: '#265c40', ground: '#4c8a45', snowCover: false, snowfall: false };
    case 'fall':
      return { season, foliage: month === 10 ? '#b8562f' : '#e08a2e', evergreen: '#2c5a44', ground: '#7d7a45', snowCover: false, snowfall: false };
  }
}

function hex(n: number): [number, number, number] {
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function mixHex(a: string, b: string, t: number): string {
  const x = hex(parseInt(a.slice(1), 16));
  const y = hex(parseInt(b.slice(1), 16));
  const k = Math.min(1, Math.max(0, t));
  return `#${x.map((v, i) => Math.round(v + ((y[i] ?? 0) - v) * k).toString(16).padStart(2, '0')).join('')}`;
}

export interface Lighting {
  /** 0 night … 1 full day, from the sun's height (twilight from −6° to +6°). */
  daylight: number;
  sky: string;
  fog: string;
  sunColor: string;
  sunIntensity: number;
  moonIntensity: number;
  ambient: number;
  /** 0..1 weight of the warm sunrise/sunset tint. */
  golden: number;
  stars: boolean;
}

/** Sky and light from the sun's elevation in degrees. Winter skies are slightly paler. */
export function lightingFor(sunElevationDeg: number, season: Season): Lighting {
  const daylight = Math.min(1, Math.max(0, (sunElevationDeg + 6) / 12));
  const golden = Math.max(0, 1 - Math.abs(sunElevationDeg - 2) / 10) * (sunElevationDeg > -6 ? 1 : 0);
  const dayBlue = season === 'winter' ? '#a9c4e4' : '#7fb4ec';
  const night = '#0a1020';
  const dusk = '#e58a5a';
  const base = mixHex(night, dayBlue, daylight);
  const sky = mixHex(base, dusk, golden * 0.55);
  return {
    daylight,
    sky,
    fog: sky,
    sunColor: mixHex('#ffffff', '#ffb070', golden),
    sunIntensity: 2.4 * Math.max(0, Math.sin((Math.max(0, sunElevationDeg) * Math.PI) / 180)) + 0.4 * golden * daylight,
    moonIntensity: (1 - daylight) * 0.35,
    ambient: 0.18 + 0.5 * daylight,
    golden,
    stars: daylight < 0.25,
  };
}

/** Direction to the sun as a unit vector in scene axes (x east, y up, z south), from elevation and azimuth in degrees. */
export function sunVector(elevationDeg: number, azimuthDeg: number): [number, number, number] {
  const e = (elevationDeg * Math.PI) / 180;
  const a = (azimuthDeg * Math.PI) / 180;
  return [Math.cos(e) * Math.sin(a), Math.sin(e), -Math.cos(e) * Math.cos(a)];
}

/** Season presets for the controls: a month and an hour (0-based month). */
export const SEASON_PRESETS = [
  { id: 'jan-night', label: 'January night', month: 0, hour: 21 },
  { id: 'apr-morning', label: 'April morning', month: 3, hour: 9 },
  { id: 'jul-afternoon', label: 'July afternoon', month: 6, hour: 15 },
  { id: 'oct-evening', label: 'October evening', month: 9, hour: 18 },
] as const;
