import { describe, expect, it } from 'vitest';
import { makePrimitive } from './primitives';
import { traceContour } from './contourTrace';
import { Trace } from './trace';

describe('iso-lines', () => {
  it('a sphere cut by its height: one closed loop, a 32-sided polygon', () => {
    const m = makePrimitive('uvSphere', { radius: 1, segments: 32, rings: 16 });
    const t = new Trace('Trace the iso-line');
    const r = traceContour(m, m.verts.map((p) => p[1]), 0.05, t);
    expect(r.loops).toBe(1);
    expect(r.open).toBe(0);
    // Each segment is a chord of the circle at that height, so the loop is a little shorter than the circle.
    expect(r.length).toBeGreaterThan(6);
    expect(r.length).toBeLessThan(2 * Math.PI * Math.sqrt(1 - 0.05 ** 2));
    expect(t.steps.map((s) => s.phase)).toEqual(['Classify', 'One triangle', 'Every triangle', 'Join']);
    const q = t.steps[1].quiz!;
    expect(q.answer[0]).toBeGreaterThan(0);
    expect(q.answer[0]).toBeLessThan(1);
    for (const [a, b] of r.segments) { expect(a[1]).toBeCloseTo(0.05, 12); expect(b[1]).toBeCloseTo(0.05, 12); }
  });

  it('a torus cut through its middle: two loops; a grid: one open chain', () => {
    const torus = makePrimitive('torus', { segments: 32, tubeSegments: 12 });
    expect(traceContour(torus, torus.verts.map((p) => p[1]), 0.05)).toMatchObject({ loops: 2, open: 0 });
    const x = (p: number[]) => p[0];
    const grid = makePrimitive('grid', { size: 2, subdivisions: 8 });
    const r = traceContour(grid, grid.verts.map(x), 0.1);
    expect(r).toMatchObject({ loops: 0, open: 1 });
    expect(r.length).toBeCloseTo(2, 9);
  });

  it('a level outside the values crosses nothing', () => {
    const m = makePrimitive('cube');
    expect(traceContour(m, m.verts.map((p) => p[1]), 5)).toMatchObject({ crossed: 0, loops: 0, open: 0, length: 0 });
  });
});
