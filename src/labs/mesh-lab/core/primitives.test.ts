import { describe, it, expect } from 'vitest';
import { makePrimitive, type PrimitiveType } from './primitives';

const dot = (a: number[], b: number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

describe('primitives', () => {
  const closed: [PrimitiveType, number][] = [['cube', 2], ['cylinder', 2], ['cone', 2], ['uvSphere', 2], ['torus', 0]];
  for (const [type, euler] of closed) {
    it(`${type} is one closed piece with Euler characteristic ${euler} and positive volume`, () => {
      const m = makePrimitive(type);
      const s = m.stats();
      expect(m.validate()).toEqual([]);
      expect(s.closed).toBe(true);
      expect(s.components).toBe(1);
      expect(s.euler).toBe(euler);
      expect(s.volume).toBeGreaterThan(0);
    });
  }

  for (const type of ['cube', 'cylinder', 'cone', 'uvSphere'] as PrimitiveType[]) {
    it(`${type}: every face normal points away from the centre`, () => {
      const m = makePrimitive(type);
      m.faces.forEach((_, fi) => expect(dot(m.faceNormal(fi), m.faceCenter(fi))).toBeGreaterThan(0));
    });
  }

  it('torus: every face normal points away from the tube centre line', () => {
    const m = makePrimitive('torus');
    m.faces.forEach((_, fi) => {
      const c = m.faceCenter(fi), r = Math.hypot(c[0], c[2]);
      const axis = [c[0] / r, 0, c[2] / r];            // the tube's centre is at radius 1 in this direction
      expect(dot(m.faceNormal(fi), [c[0] - axis[0], c[1], c[2] - axis[2]])).toBeGreaterThan(0);
    });
  });

  it('volumes approach the formulas as the segments grow', () => {
    expect(makePrimitive('cube', { size: 2 }).volume()).toBeCloseTo(8, 10);
    expect(makePrimitive('cylinder', { segments: 256 }).volume()).toBeCloseTo(2 * Math.PI, 2);
    expect(makePrimitive('uvSphere', { segments: 128, rings: 64 }).volume()).toBeCloseTo((4 / 3) * Math.PI, 1);
    expect(makePrimitive('torus', { segments: 128, tubeSegments: 64 }).volume()).toBeCloseTo(2 * Math.PI ** 2 * 1 * 0.25 ** 2, 2);
  });

  it('plane and grid face +Y and are open', () => {
    for (const m of [makePrimitive('plane'), makePrimitive('grid', { subdivisions: 4 })]) {
      m.faces.forEach((_, fi) => expect(m.faceNormal(fi)[1]).toBeCloseTo(1, 12));
      expect(m.stats().closed).toBe(false);
    }
    expect(makePrimitive('grid', { subdivisions: 4 }).stats()).toMatchObject({ verts: 25, faces: 16, edges: 40 });
    expect(makePrimitive('circle').faceNormal(0)[1]).toBeCloseTo(1, 12);
  });
});
