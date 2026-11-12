import { describe, expect, it } from 'vitest';
import { buildingLayout, solarSlotCount } from '../layout';
import { lightingFor, sceneryFor, seasonOf, sunVector } from '../environment';
import { sceneIntensityColor } from '../colors';

describe('3D layout', () => {
  it('has one window per room and a podium, core, plant and solar slots', () => {
    for (const [rooms, floors] of [[100, 5], [300, 20]] as const) {
      const l = buildingLayout(rooms, floors);
      expect(l.windows).toHaveLength(rooms);
      expect(new Set(l.windows.map((w) => w.index)).size).toBe(rooms);
      expect(l.guestFloors).toHaveLength(floors);
      expect(l.solarSlots.length).toBeGreaterThan(0);
    }
    expect(solarSlotCount(40, 0)).toBe(0);
    expect(solarSlotCount(40, 0.25)).toBe(10);
    expect(solarSlotCount(40, 1)).toBe(40);
  });
});

describe('3D environment', () => {
  it('maps months to seasons with snow only in winter and bare trees only in winter', () => {
    expect([0, 3, 6, 9].map(seasonOf)).toEqual(['winter', 'spring', 'summer', 'fall']);
    for (let m = 0; m < 12; m++) {
      const s = sceneryFor(m);
      expect(s.snowCover).toBe(s.season === 'winter');
      expect(s.foliage === null).toBe(s.season === 'winter');
    }
  });
  it('is dark with stars at night and bright by day', () => {
    expect(lightingFor(-20, 'winter').daylight).toBe(0);
    expect(lightingFor(-20, 'winter').stars).toBe(true);
    expect(lightingFor(50, 'summer').daylight).toBe(1);
    expect(lightingFor(50, 'summer').stars).toBe(false);
    expect(lightingFor(2, 'fall').golden).toBeGreaterThan(0.9);
    const [x, y, z] = sunVector(30, 180);
    expect(Math.hypot(x, y, z)).toBeCloseTo(1, 9);
    expect(z).toBeGreaterThan(0); // south
  });
  it('uses the blue to red cost scale', () => {
    expect(sceneIntensityColor(0)).toBe('#5b85f0');
    expect(sceneIntensityColor(1)).toBe('#e9605a');
  });
});
