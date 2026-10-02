import { describe, it, expect } from 'vitest';
import { EditMesh } from './EditMesh';
import { makePrimitive } from './primitives';
import { catmullClark, subdivide } from './subdivision';
import { mirror, evaluate } from './modifiers';
import { Trace, checkQuiz } from './trace';

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

describe('flip, traced', () => {
  it('each face: its normal, the corners reversed, and n′ = −n; the first face asks for a prediction', () => {
    const m = new EditMesh([[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0], [2, 0, 0]], [[0, 1, 2, 3], [1, 4, 2]]);
    const before = [m.faceNormal(0), m.faceNormal(1)];
    const t = new Trace('Flip normals');
    m.flip(undefined, t);
    expect(m.faces[0]).toEqual([3, 2, 1, 0]);
    expect(t.steps.map((s) => s.phase)).toEqual(['Normal before', 'Reversed', 'Normal before', 'Reversed']);
    for (const [i, n] of before.entries()) expect(m.faceNormal(i).map((x) => x + 0)).toEqual(n.map((x) => -x + 0));
    const q = t.steps[1].quiz!;
    expect(q.answer.map((x) => x + 0)).toEqual([0, 0, -1]);   // the square faced +z; reversed it faces −z
    expect(checkQuiz(q, [0, 0, -1]).correct).toBe(true);
    expect(checkQuiz(q, [0, 0, 1]).correct).toBe(false);
    expect(t.steps[3].quiz).toBeUndefined();
  });
});

describe('edge table, traced', () => {
  // The unit cube numbered as lesson 1.3 numbers it (vertex i at i % 2, ⌊i / 2⌋ % 2, ⌊i / 4⌋), lid removed.
  const V = Array.from({ length: 8 }, (_, i) => [i % 2, Math.floor(i / 2) % 2, Math.floor(i / 4)] as [number, number, number]);
  const box = () => new EditMesh(V.map((v) => [...v] as [number, number, number]), [[0, 4, 6, 2], [1, 3, 7, 5], [0, 1, 5, 4], [0, 2, 3, 1], [4, 5, 7, 6]]);

  it('every edge of every face, new or found; then the four rim edges are open', () => {
    const m = box(), t = new Trace('Edge table');
    const r = m.edgeTable(t);
    expect(r.edges).toBe(12);
    expect(r.open.map(([a, b]) => `${a}-${b}`).sort()).toEqual(['2-3', '2-6', '3-7', '6-7']);
    expect(r.nonManifold).toEqual([]);
    expect(t.steps).toHaveLength(20 + 1);   // 5 quads × 4 edges, then the classification
    expect(t.steps.filter((s) => s.phase === 'New edge')).toHaveLength(12);
    expect(t.steps.filter((s) => s.phase === 'Found')).toHaveLength(8);
    expect(m.faces).toHaveLength(5);         // reading the table changes nothing
  });

  it('asks twice: at the first key already in the table, and for the counts at the end', () => {
    const t = new Trace('Edge table');
    box().edgeTable(t);
    const asked = t.steps.filter((s) => s.quiz);
    expect(asked).toHaveLength(2);
    // Faces 0 and 1 share no edge; face 2's second edge, v1 → v5, is face 1's v5 → v1.
    expect(asked[0].label).toBe('Face 2, v1 → v5: key "1-5" found, faces 1 → 1, 2');
    expect(asked[0].quiz!.answer).toEqual([2, 9]);
    expect(checkQuiz(asked[1].quiz!, [4, 0]).correct).toBe(true);
  });

  it('a fin through the closed cube: two edges on three faces, two open', () => {
    const m = new EditMesh(V.map((v) => [...v] as [number, number, number]), [[0, 4, 6, 2], [1, 3, 7, 5], [0, 1, 5, 4], [2, 6, 7, 3], [0, 2, 3, 1], [4, 5, 7, 6], [0, 1, 7, 6]]);
    const r = m.edgeTable();
    expect(r.edges).toBe(14);
    expect(r.nonManifold.map(([a, b]) => `${a}-${b}`).sort()).toEqual(['0-1', '6-7']);
    expect(r.open.map(([a, b]) => `${a}-${b}`).sort()).toEqual(['0-6', '1-7']);
  });
});

describe('topology, traced', () => {
  it('counts V, E, F, pieces and boundary loops; genus from χ = 2 − 2g − b', () => {
    const V = Array.from({ length: 8 }, (_, i) => [i % 2, Math.floor(i / 2) % 2, Math.floor(i / 4)] as [number, number, number]);
    const sides = [[0, 4, 6, 2], [1, 3, 7, 5], [0, 1, 5, 4], [2, 6, 7, 3], [0, 2, 3, 1], [4, 5, 7, 6]];
    expect(new EditMesh(V.map((v) => [...v] as [number, number, number]), sides).topology()).toEqual({ V: 8, E: 12, F: 6, chi: 2, pieces: 1, boundaryLoops: 0, genus: 0 });
    // A tube: the four sides round y, no top or bottom: two boundary loops, χ = 0, genus 0.
    expect(new EditMesh(V.map((v) => [...v] as [number, number, number]), sides.filter((_, i) => i !== 2 && i !== 3)).topology()).toEqual({ V: 8, E: 12, F: 4, chi: 0, pieces: 1, boundaryLoops: 2, genus: 0 });
    // Two pieces: no single genus.
    const two = new EditMesh([...V, ...V.map((v) => [v[0] + 3, v[1], v[2]] as [number, number, number])], [...sides, ...sides.map((f) => f.map((k) => k + 8))]);
    expect(two.topology()).toMatchObject({ chi: 4, pieces: 2, genus: null });
    const t = new Trace('Euler characteristic');
    two.topology(t);
    expect(t.steps.map((x) => x.phase)).toEqual(['Count', 'Count', 'Count', 'Count', 'Result']);
    expect(t.steps.filter((x) => x.quiz)).toHaveLength(1);   // χ only: two pieces have no one genus to ask for
  });
});

describe('weld by distance, traced', () => {
  it('finds a match across a cell wall, which rounding to a grid would miss', () => {
    // 0.0049 and 0.0051 are 0.0002 apart, but round to different cells of a 0.01 grid (0 and 1).
    const m = new EditMesh([[0.0049, 0, 0], [0.0051, 0, 0], [1, 0, 0], [0, 1, 0]], [[0, 2, 3], [1, 3, 2]]);
    expect(m.clone().weld(0).verts).toHaveLength(4);
    const t = new Trace('Merge by distance');
    m.weld(0.01, t);
    expect(m.verts).toHaveLength(3);
    expect(m.faces).toEqual([[0, 1, 2], [0, 2, 1]]);
    expect(t.steps.map((x) => x.phase)).toEqual(['Keep', 'Merge', 'Keep', 'Keep', 'Repoint faces']);
  });

  it('joins only within the distance, and drops faces that collapse', () => {
    const m = new EditMesh([[0, 0, 0], [0.02, 0, 0], [1, 0, 0], [0, 1, 0]], [[0, 1, 2], [0, 2, 3]]);
    expect(m.clone().weld(0.01).verts).toHaveLength(4);
    const w = m.clone().weld(0.03);
    expect(w.verts).toHaveLength(3);
    expect(w.faces).toEqual([[0, 1, 2]]);   // the first triangle lost a corner and is gone; the second is repointed
  });
});

describe('fill, traced', () => {
  it('each rim edge fixes a step; the loop; the new face points out, and asks for its normal', () => {
    const V = Array.from({ length: 8 }, (_, i) => [i % 2, Math.floor(i / 2) % 2, Math.floor(i / 4)] as [number, number, number]);
    const m = new EditMesh(V, [[0, 4, 6, 2], [1, 3, 7, 5], [0, 1, 5, 4], [0, 2, 3, 1], [4, 5, 7, 6]]);
    const t = new Trace('Fill');
    const f = m.fill([2, 3, 6, 7], t);
    expect(t.steps.map((x) => x.phase)).toEqual(['Rim edges', 'Rim edges', 'Rim edges', 'Rim edges', 'Loop', 'New face']);
    expect(m.faceNormal(f).map((x) => x + 0)).toEqual([0, 1, 0]);
    expect(checkQuiz(t.steps[5].quiz!, [0, 1, 0]).correct).toBe(true);
    expect(m.stats().closed).toBe(true);
  });
});
