import { describe, expect, it } from 'vitest';
import { makePrimitive } from './primitives';
import { singularValues, traceDistortion, triangleJacobian } from './distortionTrace';
import { Trace } from './trace';

describe('UV distortion', () => {
  it('a turn and a scale has equal singular values; a squash does not; a mirror is flipped', () => {
    const c = Math.cos(0.3), s = Math.sin(0.3);
    expect(singularValues([[2 * c, -2 * s], [2 * s, 2 * c]]).map((x) => +x.toFixed(9))).toEqual([2, 2]);
    expect(singularValues([[1, 0], [0, 0.25]])).toEqual([1, 0.25]);
    const { J } = triangleJacobian([[0, 0, 0], [2, 0, 0], [0, 0, 1]], [[0, 0], [1, 0], [0, 0.5]]);
    expect(J[0][0]).toBeCloseTo(0.5, 12);
  });

  it('a grid with its own (x, z) as UVs: no distortion; mirrored: every triangle flipped', () => {
    const m = makePrimitive('grid', { size: 2, subdivisions: 4 });
    const layer = { faces: m.faces.map((f) => f.map((v) => [m.verts[v][0], m.verts[v][2]] as [number, number])) };
    const t = new Trace('Trace the distortion');
    const r = traceDistortion(m, layer, 0, t);
    expect(r.ratio).toBeCloseTo(1, 9);
    expect(r.areaSpread).toBeCloseTo(1, 9);
    expect(t.steps.map((x) => x.phase)).toEqual(['Local frame', 'Jacobian', 'Singular values', 'Whole mesh']);
    const mirrored = { faces: layer.faces.map((f) => f.map(([u, v]) => [-u, v] as [number, number])) };
    const back = traceDistortion(m, mirrored, 0);
    expect(back.flippedCount + r.flippedCount).toBe(m.faces.length * 2);     // two triangles per quad, each flipped in exactly one
    expect(back.flipped).not.toBe(r.flipped);
  });
});
