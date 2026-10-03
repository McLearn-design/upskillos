import { describe, expect, it } from 'vitest';
import { makePrimitive } from './primitives';
import { sharpEdges, unwrap } from './uv';
import { traceUVLookup } from './uvLookup';
import { Trace } from './trace';

describe('texture lookup', () => {
  it('a cube cut at its sharp edges: 8 vertices, 24 wedges; the centre is the corners\' average', () => {
    const m = makePrimitive('cube');
    const layer = unwrap(m, new Set(sharpEdges(m, 60)));
    const t = new Trace('Trace a texture lookup');
    const r = traceUVLookup(m, layer, 0, 1, t);
    expect([r.verts, r.corners, r.wedges]).toEqual([8, 24, 24]);
    const c = layer.faces[0];
    expect(r.uv[0]).toBeCloseTo(c.reduce((s, p) => s + p[0], 0) / 4, 12);
    expect(r.texel).toEqual([Math.floor(r.uv[0] * 256), Math.floor(r.uv[1] * 256)]);
    expect(r.white).toBe((r.square[0] + r.square[1]) % 2 === 0);
    expect(t.steps.map((s) => s.phase)).toEqual(['Corners', 'Wedges', 'Interpolate', 'Texture lookup']);
    expect(t.steps[2].quiz!.answer).toEqual([...r.uv]);
  });

  it('a plane with no seams has one wedge per vertex, and the texture repeats with scale', () => {
    const m = makePrimitive('grid', { size: 2, subdivisions: 4 });
    const layer = { faces: m.faces.map((f) => f.map((v) => [(m.verts[v][0] + 1) / 2, (m.verts[v][2] + 1) / 2] as [number, number])) };
    expect(traceUVLookup(m, layer, 0).wedges).toBe(m.verts.length);
    const once = traceUVLookup(m, layer, 5), twice = traceUVLookup(m, layer, 5, 2);
    expect(twice.texel[0]).toBe(Math.floor(((once.uv[0] * 2) % 1) * 256));
  });
});
