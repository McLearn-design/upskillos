import { describe, expect, it } from 'vitest';
import { makePrimitive } from './primitives';
import { cylinderUV, traceUVProjection } from './projection';
import { angleDistortion } from './uv';
import { Trace } from './trace';

describe('UV projection', () => {
  it('planar: a flat grid is not stretched at all; tilted 60°, every face is stretched 2 : 1', () => {
    const flat = makePrimitive('grid', { size: 2, subdivisions: 4 });
    const t = new Trace('Project from above');
    const r = traceUVProjection(flat, 'planar', t);
    expect(r.worst).toBeCloseTo(1, 9);
    expect(t.steps.map((s) => s.phase)).toEqual(['Direction', 'One vertex', 'Stretch']);
    const q = t.steps[1].quiz!;
    expect(q.answer).toHaveLength(2);
    const tilted = makePrimitive('grid', { size: 2, subdivisions: 4 });
    const c = Math.cos(Math.PI / 3), s = Math.sin(Math.PI / 3);
    tilted.verts = tilted.verts.map(([x, y, z]) => [x, y * c - z * s, y * s + z * c]);
    for (const d of angleDistortion(tilted, traceUVProjection(tilted, 'planar').layer)) expect(d).toBeCloseTo(2, 9);
  });

  it('cylinder: the sides keep their angles, the wrap line is fixed, the lids collapse', () => {
    const can = makePrimitive('cylinder', { segments: 24 });
    const t = new Trace('Project around');
    const r = traceUVProjection(can, 'cylinder', t);
    expect(r.wrapped).toBeGreaterThan(0);
    const layer = cylinderUV(can);
    // No side face spans more than one segment's width of u.
    const sides = can.faces.map((f, i) => i).filter((i) => can.faces[i].length === 4);
    for (const i of sides) { const us = layer.faces[i].map((p) => p[0]); expect(Math.max(...us) - Math.min(...us)).toBeLessThan(0.2); }
    expect(t.steps.map((s) => s.phase)).toEqual(['Direction', 'One vertex', 'Wrap', 'Stretch']);
    expect(r.worst).toBeGreaterThan(5);
  });
});
