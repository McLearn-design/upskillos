import { describe, it, expect } from 'vitest';
import { EditMesh } from './EditMesh';
import { makePrimitive } from './primitives';
import { catmullClark, subdivide } from './subdivision';
import { mirror, evaluate } from './modifiers';
import { Trace } from './trace';

const cube = () => makePrimitive('cube', { size: 2 });
const find = (m: EditMesh, p: number[]) => m.verts.findIndex((v) => v.every((x, i) => Math.abs(x - p[i]) < 1e-9));

describe('Catmull-Clark', () => {
  it('turns a cube into 26 vertices and 24 quads, still closed', () => {
    const m = catmullClark(cube());
    const s = m.stats();
    expect(s).toMatchObject({ verts: 26, faces: 24, edges: 48, euler: 2, closed: true, components: 1 });
    expect(s.ngons.quads).toBe(24);
    expect(s.volume).toBeGreaterThan(0);
  });

  it('moves the corner (1,1,1) to (5/9, 5/9, 5/9) and keeps its index', () => {
    const c = cube(), corner = find(c, [1, 1, 1]);
    const m = catmullClark(c);
    m.verts[corner].forEach((x) => expect(x).toBeCloseTo(5 / 9, 12));
  });

  it('puts the edge point of (1,1,1)-(1,-1,1) at (3/4, 0, 3/4) and face points at face centres', () => {
    const m = catmullClark(cube());
    expect(find(m, [0.75, 0, 0.75])).toBeGreaterThan(-1);
    expect(find(m, [1, 0, 0])).toBeGreaterThan(-1);
    expect(find(m, [0, 1, 0])).toBeGreaterThan(-1);
  });

  it('turns every face into quads, whatever its size', () => {
    const m = catmullClark(makePrimitive('cylinder', { segments: 8 }));
    expect(m.stats().ngons).toEqual({ tris: 0, quads: 8 * 2 + 8 * 4, larger: 0 });
  });

  it('keeps a flat grid flat and moves boundary vertices only along the boundary', () => {
    const m = subdivide(makePrimitive('grid', { subdivisions: 3 }), 2);
    for (const v of m.verts) expect(Math.abs(v[1])).toBeLessThan(1e-12);
    expect(m.stats().closed).toBe(false);
  });

  it('converges: repeated steps shrink the cube toward a rounder shape', () => {
    const spread = (m: EditMesh) => { const d = m.verts.map((v) => Math.hypot(...v)); return Math.max(...d) / Math.min(...d); };
    const s1 = spread(subdivide(cube(), 1)), s3 = spread(subdivide(cube(), 3));
    expect(s3).toBeLessThan(s1);
    expect(s3).toBeLessThan(1.2);
  });

  it('records the four phases, one step per face, edge and vertex, and ends on the result', () => {
    const t = new Trace('subdivide');
    const m = catmullClark(cube(), t);
    expect(t.phases().map((p) => p.phase)).toEqual(['Face points', 'Edge points', 'Move vertices', 'Connect']);
    expect(t.steps.length).toBe(6 + 12 + 8 + 1);
    expect(t.steps.at(-1)!.mesh).toEqual(m.toSnapshot());
  });
});

describe('mirror', () => {
  const halfCube = () => {
    const m = cube();
    const left = m.faces.findIndex((_, fi) => m.faceNormal(fi)[0] < -0.5);
    m.deleteFaces([left]);
    m.verts.forEach((v) => { if (v[0] < 0) v[0] = 0; });   // the open side sits on the x = 0 plane
    return m.touch();
  };

  it('joins a half cube into one closed box with the seam vertices shared', () => {
    const half = halfCube();
    expect(half.stats().closed).toBe(false);
    const m = mirror(half, 'x');
    const s = m.stats();
    expect(s).toMatchObject({ verts: 12, closed: true, components: 1, euler: 2 });
    expect(s.volume).toBeCloseTo(8, 10);
  });

  it('reverses the mirrored faces so the whole solid points outward', () => {
    const m = mirror(halfCube(), 'x');
    expect(m.volume()).toBeGreaterThan(0);
    m.faces.forEach((_, fi) => { const c = m.faceCenter(fi); expect(m.faceNormal(fi)[0] * c[0] + m.faceNormal(fi)[1] * c[1] + m.faceNormal(fi)[2] * (c[2])).toBeGreaterThan(0); });
  });

  it('evaluates a stack: mirror, then subdivision', () => {
    const m = evaluate(halfCube(), [{ type: 'mirror', axis: 'x', merge: 0.001, clip: true, enabled: true }, { type: 'subsurf', levels: 1, enabled: true }]);
    expect(m.stats()).toMatchObject({ closed: true, components: 1 });
  });
});

describe('inset, loop cut, delete, merge', () => {
  it('inset keeps the cube closed, adds a face per edge, and keeps the volume', () => {
    const m = cube();
    const top = m.faces.findIndex((_, fi) => m.faceNormal(fi)[1] > 0.5);
    m.insetFaces([top], 0.25);
    expect(m.stats()).toMatchObject({ verts: 12, faces: 10, closed: true, euler: 2 });
    expect(m.volume()).toBeCloseTo(8, 10);
    // The inner corner lies a quarter of the way to the centre: (±0.75, 1, ±0.75).
    expect(find(m, [0.75, 1, 0.75])).toBeGreaterThan(-1);
  });

  it('finds the closed ring of four side faces around a cube', () => {
    const m = cube();
    const a = find(m, [1, -1, 1]), b = find(m, [1, 1, 1]);
    const r = m.edgeRing(a, b);
    expect(r.closed).toBe(true);
    expect(r.faces.length).toBe(4);
    expect(r.edges.length).toBe(4);
  });

  it('loop cut around a cube adds a ring of 4 vertices and keeps it closed', () => {
    const m = cube();
    m.loopCut(find(m, [1, -1, 1]), find(m, [1, 1, 1]));
    expect(m.stats()).toMatchObject({ verts: 12, faces: 10, edges: 20, closed: true, euler: 2 });
    expect(m.volume()).toBeCloseTo(8, 10);
    expect(m.verts.slice(8).every((v) => Math.abs(v[1]) < 1e-12)).toBe(true);   // the new ring sits at mid-height
  });

  it('loop cut across an open grid runs parallel, even off-centre', () => {
    const m = makePrimitive('grid', { size: 4, subdivisions: 4 });
    const a = find(m, [-2, 0, -2]), b = find(m, [-1, 0, -2]);
    m.loopCut(a, b, 0.25);
    const fresh = m.verts.slice(25);
    expect(fresh.length).toBe(5);
    fresh.forEach((v) => expect(v[0]).toBeCloseTo(-1.75, 12));
    expect(m.stats()).toMatchObject({ faces: 20, components: 1 });
  });

  it('delete a face opens the cube; delete a vertex removes its three faces', () => {
    const m = cube();
    m.deleteFaces([0]);
    expect(m.stats()).toMatchObject({ faces: 5, verts: 8, boundaryEdges: 4, closed: false });
    const n = cube();
    n.deleteVerts([0]);
    expect(n.stats()).toMatchObject({ faces: 3, verts: 7 });
    expect(n.validate()).toEqual([]);
  });

  it('merging the top four vertices makes a closed pyramid', () => {
    const m = cube();
    const top = m.verts.map((v, i) => [v, i] as const).filter(([v]) => v[1] > 0).map(([, i]) => i);
    m.mergeVerts(top);
    expect(m.stats()).toMatchObject({ verts: 5, faces: 5, closed: true, euler: 2 });
    expect(m.validate()).toEqual([]);
    expect(m.volume()).toBeCloseTo(8 / 3, 10);   // base 4, height 2: (1/3)·4·2
  });

  it('extrude records its phases and ends on the result', () => {
    const m = cube(), t = new Trace('extrude');
    const top = m.faces.findIndex((_, fi) => m.faceNormal(fi)[1] > 0.5);
    m.extrudeFaces([top], 1, t);
    expect(t.phases().map((p) => p.phase)).toEqual(['Average normal', 'Copy vertices', 'Border edges', 'Lift faces', 'Walls']);
    expect(t.steps.at(-1)!.mesh).toEqual(m.toSnapshot());
    expect(m.volume()).toBeCloseTo(12, 10);
  });
});
