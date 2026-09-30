import { describe, expect, it } from 'vitest';
import { makePrimitive } from './primitives';
import { EditMesh } from './EditMesh';
import { bevelEdges, dissolveEdges, dissolveFaces, dissolveVerts, insetRegion } from './modelling';

const ok = (m: EditMesh) => { expect(m.validate()).toEqual([]); const s = m.stats(); expect(s.closed).toBe(true); expect(s.euler).toBe(2); return s; };
const edge = (m: EditMesh, p: number[], q: number[]) => {
  const at = (x: number[]) => m.verts.findIndex((v) => v.every((c, i) => Math.abs(c - x[i]) < 1e-9));
  return [at(p), at(q)] as [number, number];
};

describe('region inset', () => {
  it('insets a 2 × 2 patch as one piece: its outline moves in by the thickness, mitred at the corners', () => {
    const g = makePrimitive('grid', { size: 2, subdivisions: 2 });
    const added = insetRegion(g, [0, 1, 2, 3], 0.2);
    expect(added.length).toBe(8);          // one bridge per outline edge
    expect(g.faces.length).toBe(12);
    expect(g.verts.length).toBe(9 + 8);
    // The inner corners are 0.2 in from both sides: (±0.8, 0, ±0.8); the centre vertex has not moved.
    for (const [x, z] of [[0.8, 0.8], [-0.8, 0.8], [0.8, -0.8], [-0.8, -0.8]]) expect(g.verts.some((v) => Math.abs(v[0] - x) < 1e-9 && Math.abs(v[2] - z) < 1e-9)).toBe(true);
    expect(g.verts.some((v) => Math.hypot(v[0], v[2]) < 1e-9)).toBe(true);
  });

  it('insetting a cube\'s top keeps it closed and its volume the same', () => {
    const c = makePrimitive('cube');
    const top = c.faces.findIndex((_, i) => c.faceNormal(i)[1] > 0.9);
    insetRegion(c, [top], 0.25);
    const s = ok(c);
    expect(s.volume).toBeCloseTo(8, 12);
    expect(c.faces[top].map((v) => c.verts[v]).every((p) => Math.abs(Math.abs(p[0]) - 0.75) < 1e-9 && Math.abs(Math.abs(p[2]) - 0.75) < 1e-9)).toBe(true);
  });
});

describe('bevel', () => {
  it('one cube edge: a strip replaces it, two sides become pentagons, volume 8 − w²', () => {
    const c = makePrimitive('cube');
    bevelEdges(c, [edge(c, [1, 1, 1], [1, 1, -1])], 0.3);
    const s = ok(c);
    expect(c.faces.length).toBe(7); expect(c.verts.length).toBe(10);
    expect(c.faces.filter((f) => f.length === 5).length).toBe(2);
    expect(s.volume).toBeCloseTo(8 - 0.09, 12);
  });

  it('all twelve edges: shrunken faces, twelve strips and eight corner triangles, every vertex still on the cube', () => {
    const c = makePrimitive('cube');
    bevelEdges(c, [...c.edges().values()].map((e) => [e.a, e.b]), 0.25);
    ok(c);
    expect(c.faces.length).toBe(6 + 12 + 8); expect(c.verts.length).toBe(24);
    expect(c.faces.filter((f) => f.length === 3).length).toBe(8);
    for (const v of c.verts) expect(Math.max(...v.map(Math.abs))).toBeCloseTo(1, 12);
  });

  it('three segments round the edge: the middle of the curve sits inside the old corner', () => {
    const c = makePrimitive('cube');
    bevelEdges(c, [edge(c, [1, 1, 1], [1, 1, -1])], 0.4, 3);
    ok(c);
    expect(c.faces.length).toBe(6 + 3);
    // Profile points: between the old sharp edge (x = y = 1) and the flat chamfer (x + y = 2 − 0.4).
    const mid = c.verts.filter((v) => v[0] < 1 - 1e-9 && v[1] < 1 - 1e-9 && v[0] > 0.5 && v[1] > 0.5);
    expect(mid.length).toBe(4);
    for (const v of mid) { expect(v[0] + v[1]).toBeGreaterThan(1.6); expect(v[0] + v[1]).toBeLessThan(2); }
  });

  it('edges ending at vertices with four faces get corner patches and stay closed', () => {
    const c = makePrimitive('cube'); c.subdivideFaces();           // every face into four: valence-4 vertices
    const e = [...c.edges().values()][0];
    bevelEdges(c, [[e.a, e.b]], 0.2);
    ok(c);
    const all = makePrimitive('cube'); all.subdivideFaces();
    bevelEdges(all, [...all.edges().values()].map((x) => [x.a, x.b]), 0.15, 2);
    ok(all);
  });
});

describe('dissolve', () => {
  it('dissolving a 2 × 2 grid\'s faces leaves one eight-sided face; the loose centre goes', () => {
    const g = makePrimitive('grid', { size: 2, subdivisions: 2 });
    expect(dissolveFaces(g, [0, 1, 2, 3])).toBe(1);
    expect(g.faces.length).toBe(1); expect(g.faces[0].length).toBe(8); expect(g.verts.length).toBe(8);
  });

  it('dissolving a cube edge joins two faces into a hexagon; dissolving a vertex merges its fan', () => {
    const c = makePrimitive('cube');
    dissolveEdges(c, [edge(c, [1, 1, 1], [1, 1, -1])]);
    expect(c.faces.length).toBe(5); expect(c.faces.filter((f) => f.length === 6).length).toBe(1);
    const g = makePrimitive('grid', { size: 2, subdivisions: 2 });
    const centre = g.verts.findIndex((v) => Math.hypot(v[0], v[2]) < 1e-9);
    dissolveVerts(g, [centre]);
    expect(g.faces.length).toBe(1); expect(g.faces[0].length).toBe(8);
    // A vertex on two edges in a line is simply taken out of its face.
    const mid = g.verts.findIndex((v) => Math.abs(v[0]) < 1e-9);
    dissolveVerts(g, [mid]);
    expect(g.faces[0].length).toBe(7);
  });
});

import { Editor } from './Editor';
import { runScript } from './api';

describe('in the editor', () => {
  it('bevel, region inset and dissolve: adjustable, one undo step each, and the log replays them', () => {
    const e = new Editor(); e.newScene();
    e.enterEdit(); e.setSelectMode('edge');
    const m = () => e.editObject!.mesh!;
    const [a, b] = edge(m(), [1, 1, 1], [1, 1, -1]);
    e.selectElement(`${Math.min(a, b)}-${Math.max(a, b)}`);
    expect(e.bevel(0.2, 1)).toBe(true);
    expect(m().faces.length).toBe(7);
    e.adjustLast({ segments: 3 });                       // change it afterwards, as Blender's Adjust panel
    expect(m().faces.length).toBe(9);
    e.setSelectMode('face');
    e.selectElement(m().faces.findIndex((_, i) => m().faceNormal(i)[1] > 0.9 && m().faces[i].length === 4));
    expect(e.insetRegion(0.1)).toBe(true);
    ok(m());
    const before = m().faces.length;
    e.setSelectMode('face'); e.selectAllElements();
    e.selectElement(0); e.selectElement(1, true);
    e.dissolve();
    expect(m().faces.length).toBeLessThanOrEqual(before);
    const e2 = new Editor(); e2.newScene();
    expect(runScript(e2, e.log.map((l) => l.code).join('\n')).error).toBeNull();
    expect(e2.scene.get('Cube')!.mesh!.toSnapshot()).toEqual(m().toSnapshot());
    const n = e.undoStack.length;
    e.undo();
    expect(e.undoStack.length).toBe(n - 1);
  });
});

describe('fill (F): close a hole with one face', () => {
  const openBox = () => {
    const m = makePrimitive('cube', { size: 2 });
    m.deleteFaces([m.faces.findIndex((_, i) => m.faceNormal(i)[1] > 0.9)]);
    const rim = m.verts.map((p, i) => [p, i] as const).filter(([p]) => p[1] > 0.9).map(([, i]) => i);
    return { m, rim };
  };

  it('closes an open box with a face wound like its neighbours: closed, facing up, positive volume', () => {
    const { m, rim } = openBox();
    expect(rim.length).toBe(4);
    expect(m.stats().closed).toBe(false);
    // Any click order: the loop comes from the hole, not from the order of the selection.
    const f = m.fill([rim[2], rim[0], rim[3], rim[1]]);
    expect(m.stats()).toMatchObject({ faces: 6, closed: true });
    expect(m.faceNormal(f)[1]).toBeCloseTo(1);
    expect(m.volume()).toBeCloseTo(8);
  });

  it('says why when the selection is not one hole, and changes nothing', () => {
    expect(makePrimitive('cube', { size: 2 }).fillPlan([0, 1, 2])).toMatch(/not all on one hole/); // no hole at all
    const { m, rim } = openBox();
    expect(m.fillPlan(rim.slice(0, 2))).toMatch(/at least three/);
    expect(m.fillPlan(rim.slice(0, 3))).toMatch(/not all on one hole|one loop/);
    expect(() => m.fill(rim.slice(0, 3))).toThrow();
    expect(m.faces.length).toBe(5);
  });

  it('is one undo step from the editor, and logs mesh.fill', () => {
    const e = new Editor();
    runScript(e, `const b = scene.add.cube({ name: 'Box', size: 2 })
b.mesh.delete({ faces: b.mesh.faces.top() })`);
    e.selectObject(e.scene.get('Box')!.id);
    e.enterEdit();
    e.setSelectMode('vert');
    const m = e.scene.get('Box')!.mesh!;
    m.verts.forEach((p, i) => { if (p[1] > 0.9) e.sel.verts.add(i); });
    expect(e.fill()).toBe(true);
    expect(m.stats().closed).toBe(true);
    expect(e.log.at(-1)!.code).toMatch(/mesh\.fill\(\[/);
    e.undo();
    expect(e.scene.get('Box')!.mesh!.stats().closed).toBe(false);
  });
});

describe('loop select (Alt+click)', () => {
  it('on a torus, both loops through a vertex close all the way round', () => {
    const t = makePrimitive('torus', { segments: 48, tubeSegments: 12 });   // vertex i*12 + j
    const round = t.edgeLoop(0, 12);          // along the main circle
    expect(round).toMatchObject({ closed: true });
    expect(round.edges).toHaveLength(48);
    const tube = t.edgeLoop(0, 1);            // round the tube
    expect(tube.closed).toBe(true);
    expect(tube.edges).toHaveLength(12);
    expect(new Set(tube.edges.flat()).size).toBe(12);
  });

  it('on a grid, an inside loop runs edge to edge and a border loop stops at the corners', () => {
    const g = makePrimitive('grid', { subdivisions: 4 });                  // 5 × 5 vertices, id = j*5 + i
    const inside = g.edgeLoop(11, 12);                                      // row j = 2, i = 1 → 2
    expect(inside.closed).toBe(false);
    expect(inside.edges.map(([a, b]) => [a, b])).toEqual([[10, 11], [11, 12], [12, 13], [13, 14]]);
    const border = g.edgeLoop(1, 2);                                        // the j = 0 side
    expect(border.edges.flat().sort((a, b) => a - b)).toEqual([0, 1, 1, 2, 2, 3, 3, 4]);
  });

  it('on a UV sphere, a meridian stops where the triangles at the poles begin', () => {
    const s = makePrimitive('uvSphere', { segments: 8, rings: 6 });
    // Pick an edge between two rings, away from the poles: its loop is part of a meridian.
    const e = [...s.edges().values()].find((x) => x.faces.every((f) => s.faces[f].length === 4) && Math.abs(s.verts[x.a][1] - s.verts[x.b][1]) > 1e-6 && Math.abs(s.verts[x.a][0]) + Math.abs(s.verts[x.a][2]) > 0.1)!;
    const loop = s.edgeLoop(e.a, e.b);
    expect(loop.closed).toBe(false);
    expect(loop.edges.length).toBe(6 - 2);   // the quad rings only
    const xs = new Set(loop.edges.flat().map((v) => Math.atan2(s.verts[v][2], s.verts[v][0]).toFixed(6)));
    expect(xs.size).toBe(1);                 // all at one longitude
  });

  it('in the editor: edge mode selects the loop, face mode the ring of faces, Shift adds', () => {
    const e = new Editor();
    runScript(e, `scene.add.torus({ name: 'T', segments: 48, tubeSegments: 12 })`);
    e.selectObject(e.scene.get('T')!.id); e.enterEdit();
    e.setSelectMode('edge');
    e.selectLoop(0, 12);
    expect(e.sel.edges.size).toBe(48);
    e.selectLoop(0, 1, true);
    expect(e.sel.edges.size).toBe(60);
    e.setSelectMode('face');
    e.selectLoop(0, 1);
    expect(e.sel.faces.size).toBe(48);       // the faces the tube edge (0, 1) crosses, all round
  });
});
