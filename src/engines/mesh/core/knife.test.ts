import { describe, expect, it } from 'vitest';
import { makePrimitive } from './primitives';
import { knife, knifeFaces } from './knife';
import { Editor } from './Editor';
import { runScript } from './api';
import type { Vec3 } from './EditMesh';

// A cube of size 2 (−1…1). The eye looks at it from the front (+z), a little above.
const eye: Vec3 = [0, 0.4, 6];
/** A knife line across the view at height y (in the plane z = 0), from x0 to x1. */
const across = (y: number, x0 = -5, x1 = 5) => ({ eye, from: [x0, y, 0] as Vec3, to: [x1, y, 0] as Vec3 });

describe('the knife', () => {
  it('cuts a cube all the way round when it cuts through: 10 faces, 12 vertices, still closed, same volume', () => {
    const m = makePrimitive('cube', { size: 2 });
    const cut = knife(m, across(0.2));
    expect(cut).toHaveLength(4);                       // the four sides it crosses
    const s = m.stats();
    expect(s).toMatchObject({ faces: 10, verts: 12, closed: true });
    expect(s.volume).toBeCloseTo(8, 12);
    expect(m.validate()).toEqual([]);
    // The cut is where the plane through the eye and the line meets the sides: every new vertex lies on it.
    const l = across(0.2), u = l.from.map((x, i) => x - eye[i]), w = l.to.map((x, i) => x - eye[i]);
    const n = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]];
    for (const v of m.verts.slice(8)) expect(n.reduce((s, c, i) => s + c * (v[i] - eye[i]), 0)).toBeCloseTo(0, 9);
  });

  it('cutting only the faces that face the eye leaves the back faces whole, but with the new vertices on their edges: no crack', () => {
    const m = makePrimitive('cube', { size: 2 });
    const facing = knifeFaces(m, eye);
    expect(facing).toHaveLength(1);                    // the front only: the eye (y = 0.4) is below the top (y = 1)
    const cut = knife(m, across(0.2), facing);
    expect(cut).toHaveLength(1);                       // only the front is crossed; the line misses the top
    const s = m.stats();
    expect(s.closed).toBe(true);
    expect(s.faces).toBe(7);
    expect(s.volume).toBeCloseTo(8, 12);
    // The two side faces now have five corners: the new vertex sits in their rings.
    expect(m.faces.filter((f) => f.length === 5)).toHaveLength(2);
  });

  it('through two opposite corners of the top face, it uses the corners and splits the face into two triangles', () => {
    const m = makePrimitive('cube', { size: 2 });
    const top = m.faces.findIndex((_, i) => m.faceNormal(i)[1] > 0.9);
    const corners = m.faces[top].map((v) => m.verts[v]);
    // Look straight down; the line runs through two opposite corners of the top face.
    const line = { eye: [0, 8, 0] as Vec3, from: corners[0], to: corners[2] };
    const cut = knife(m, line, [top]);
    expect(cut).toHaveLength(1);
    expect(m.verts).toHaveLength(8);                   // no new vertices
    expect(m.faces.filter((f) => f.length === 3)).toHaveLength(2);
    expect(m.stats().closed).toBe(true);
  });

  it('a short line cuts only between its ends', () => {
    const g = makePrimitive('grid', { size: 4, subdivisions: 4 });          // 16 unit squares, y = 0
    // From above, a line from x = −1.5 to x = 0.5 along z = 0.3 crosses two squares and part of a third.
    const cut = knife(g, { eye: [0, 10, 0.3], from: [-1.5, 0, 0.3], to: [0.5, 0, 0.3] });
    // Squares entirely crossed: x in [−1, 0] only; the squares at [−2, −1] and [0, 1] are entered and left inside, not crossed twice.
    expect(cut).toHaveLength(1);
    expect(g.validate()).toEqual([]);
  });

  it('crossing nothing changes nothing', () => {
    const m = makePrimitive('cube', { size: 2 });
    expect(knife(m, across(3))).toEqual([]);
    expect(m.faces).toHaveLength(6);
  });

  it('from the editor: one undo step, the new edges selected, and the logged code replays the same cut', () => {
    const e = new Editor();
    runScript(e, `scene.add.cube({ name: 'Box', size: 2 })`);
    e.selectObject(e.scene.get('Box')!.id); e.enterEdit(); e.setSelectMode('edge');
    expect(e.knife(across(0.2), true)).toBe(true);
    expect(e.sel.edges.size).toBe(4);
    const code = e.log.at(-1)!.code!;
    expect(code).toMatch(/mesh\.knife\(\{ eye: \[0, 0\.4, 6\], from: \[-5, 0\.2, 0\], to: \[5, 0\.2, 0\], through: true \}\)/);
    const replay = new Editor();
    runScript(replay, `scene.add.cube({ name: 'Box', size: 2 })\n${code}`);
    expect(replay.scene.get('Box')!.mesh!.toSnapshot()).toEqual(e.scene.get('Box')!.mesh!.toSnapshot());
    e.undo();
    expect(e.scene.get('Box')!.mesh!.faces).toHaveLength(6);
    expect(e.knife(across(3))).toBe(false);            // says why, adds no undo step
    expect(e.message).toMatch(/crosses no face/);
  });
});
