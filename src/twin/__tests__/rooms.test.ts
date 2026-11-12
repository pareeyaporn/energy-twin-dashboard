import { describe, expect, it } from 'vitest';
import { baselineConditions, presetProfile, roomOccupancyPattern } from '@/engine/hotel';
import { facadeLayout, windowColor } from '../parts/roomFacade';
import { buildingLayout } from '@/three/layout';

describe('room façade', () => {
  for (const id of ['demo-chicago-100', 'demo-chicago-300'] as const) {
    it(`has one window per room on the engine's floor, numbered like the 3D view (${id})`, () => {
      const p = presetProfile(id).profile;
      const rooms = roomOccupancyPattern(p, baselineConditions(p), 6, 21);
      const f = facadeLayout(rooms, p.floors);
      expect(f.windows).toHaveLength(rooms.length);
      for (const w of f.windows) expect(w.floor).toBe(rooms[w.index]!.floor);
      // Same floor assignment as the 3D layout's windows
      const three = buildingLayout(p.rooms, p.floors);
      for (const w of three.windows) expect(w.floor).toBe(rooms[w.index]!.floor);
      for (const w of f.windows) {
        expect(w.x).toBeGreaterThanOrEqual(f.bx);
        expect(w.x + w.w).toBeLessThanOrEqual(f.bx + f.bw + 1e-6);
        expect(w.y + w.h).toBeLessThanOrEqual(f.lobbyY + 1e-6);
      }
    });
  }
  it('lights windows at night and turns them to glass by day, keeping the states distinct', () => {
    expect(windowColor('occupied', 0)).toBe('#ffd68a');
    expect(windowColor('vacant', 0)).toBe('#1c2433');
    expect(windowColor('occupied', 1)).not.toBe(windowColor('occupied', 0));
    const day = new Set((['occupied', 'away', 'vacant'] as const).map((s) => windowColor(s, 1)));
    expect(day.size).toBe(3);
  });
});
