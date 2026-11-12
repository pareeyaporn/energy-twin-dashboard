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

import { cameraViews } from '../layout';
import { pedestrianCounts } from '../People';
import { streetGeometry } from '../Street';
import { hash01 } from '../HotelScene';

describe('3D camera, street and people', () => {
  it('has a home view, a wider fly-in start and a close view for every zone and the roof', () => {
    for (const [rooms, floors] of [[100, 5], [300, 20]] as const) {
      const l = buildingLayout(rooms, floors);
      const v = cameraViews(l);
      const dist = (p: number[], t: number[]) => Math.hypot(p[0]! - t[0]!, p[1]! - t[1]!, p[2]! - t[2]!);
      expect(dist(v.intro.position, v.intro.target)).toBeGreaterThan(dist(v.home.position, v.home.target));
      // The home view is far enough to fit the whole height in a 38° field of view.
      expect(dist(v.home.position, v.home.target)).toBeGreaterThan(l.roofY / (2 * Math.tan((19 * Math.PI) / 180)));
      for (const f of Object.values(v.focus)) expect(f.position[1]).toBeGreaterThan(0);
      expect(Object.keys(v.focus)).toHaveLength(7);
    }
  });
  it('puts the street in front of the entrance path and scales pedestrians with guests out', () => {
    const g = streetGeometry(3.2);
    expect(g.sidewalkZ).toBeGreaterThan(3.2 / 2 + 5.5);
    expect(g.roadZ).toBeGreaterThan(g.sidewalkZ);
    expect(pedestrianCounts(0, 100)).toEqual({ street: 0, entrance: 0 });
    const few = pedestrianCounts(10, 100);
    const many = pedestrianCounts(50, 100);
    expect(many.street).toBeGreaterThan(few.street);
    expect(pedestrianCounts(300, 300).street).toBeLessThanOrEqual(12);
  });
  it('spreads deterministic pseudo-random values over [0, 1)', () => {
    const xs = Array.from({ length: 500 }, (_, i) => hash01(i));
    expect(Math.min(...xs)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...xs)).toBeLessThan(1);
    expect(hash01(42)).toBe(hash01(42));
    expect(xs.filter((x) => x < 0.5).length).toBeGreaterThan(200);
  });
});
