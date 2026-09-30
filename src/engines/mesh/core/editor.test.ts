import { describe, it, expect } from 'vitest';
import { Vector3 } from 'three';
import { Editor } from './Editor';
import { Scene, type SceneJSON } from './Scene';
import { runScript } from './api';
import { makePrimitive } from './primitives';

const fresh = () => { const e = new Editor(); e.newScene(); return e; };

/** Compare two scenes, allowing for the 6-decimal rounding of logged numbers. */
function same(a: SceneJSON, b: SceneJSON) {
  const close = (x: unknown, y: unknown): boolean => {
    if (typeof x === 'number' && typeof y === 'number') return Math.abs(x - y) < 1e-5;
    if (Array.isArray(x) && Array.isArray(y)) return x.length === y.length && x.every((v, i) => close(v, y[i]));
    if (x && y && typeof x === 'object' && typeof y === 'object') {
      const kx = Object.keys(x).filter((k) => (x as never)[k] !== undefined), ky = Object.keys(y).filter((k) => (y as never)[k] !== undefined);
      return kx.length === ky.length && kx.every((k) => close((x as never)[k], (y as never)[k]));
    }
    return x === y;
  };
  return close(a, b);
}

describe('scene graph', () => {
  it('composes world = parent world × local', () => {
    const s = new Scene();
    const p = s.add({ name: 'Parent', position: [1, 0, 0], rotation: [0, Math.PI / 2, 0] });
    const c = s.add({ name: 'Child', position: [1, 0, 0], parent: p.id });
    const w = new Vector3().setFromMatrixPosition(s.worldMatrix(c));
    // A quarter turn about Y takes (1, 0, 0) to (0, 0, -1); then the parent's offset.
    expect(w.x).toBeCloseTo(1, 12); expect(w.y).toBeCloseTo(0, 12); expect(w.z).toBeCloseTo(-1, 12);
  });

  it('re-parenting keeps the world position, and refuses cycles', () => {
    const s = new Scene();
    const a = s.add({ name: 'A', position: [2, 0, 0], scale: [2, 2, 2] });
    const b = s.add({ name: 'B', position: [0, 3, 1] });
    const before = new Vector3().setFromMatrixPosition(s.worldMatrix(b));
    expect(s.setParent(b.id, a.id)).toBe(true);
    const after = new Vector3().setFromMatrixPosition(s.worldMatrix(b));
    expect(after.distanceTo(before)).toBeLessThan(1e-12);
    expect(b.position[0]).toBeCloseTo(-1, 12);   // local = inverse(parent) × world: (0 − 2) / 2
    expect(s.setParent(a.id, b.id)).toBe(false);
  });

  it('names are unique, Blender style', () => {
    const s = new Scene();
    expect([s.add({ name: 'Cube' }).name, s.add({ name: 'Cube' }).name, s.add({ name: 'Cube' }).name]).toEqual(['Cube', 'Cube.001', 'Cube.002']);
  });

  it('saves and loads without loss', () => {
    const e = fresh();
    e.addPrimitive('torus');
    e.addModifier(e.active!, 'subsurf');
    const j = JSON.parse(JSON.stringify(e.scene.toJSON()));
    expect(Scene.fromJSON(j).toJSON()).toEqual(e.scene.toJSON());
  });
});

describe('undo and redo', () => {
  it('walks back through extrude and add, then forward again', () => {
    const e = fresh();
    const start = e.scene.toJSON();
    e.addPrimitive('cylinder');
    e.enterEdit(); e.setSelectMode('face'); e.selectElement(1); e.extrude(1);
    const end = e.scene.toJSON();
    e.undo(); e.undo();
    expect(e.scene.toJSON()).toEqual(start);
    e.redo(); e.redo();
    expect(e.scene.toJSON()).toEqual(end);
  });

  it('a new change clears the redo stack', () => {
    const e = fresh();
    e.addPrimitive('cone'); e.undo();
    e.addPrimitive('plane');
    expect(e.redoStack.length).toBe(0);
  });
});

describe('GUI and scripts share one scene', () => {
  it('runs the specification\'s own example', () => {
    const e = fresh();
    const r = runScript(e, `
      const cube = scene.addCube({ size: 10 });
      cube.position.set(5, 0, 0);
      cube.rotation.y = Math.PI / 4;
      for (const vertex of cube.geometry.vertices) {
        vertex.z += Math.sin(vertex.x);
      }
      log(cube.mesh.stats().verts);
    `);
    expect(r.error).toBeNull();
    expect(r.output).toEqual(['8']);
    const o = e.scene.get('Cube.001')!;
    expect(o.position).toEqual([5, 0, 0]);
    expect(o.rotation[1]).toBeCloseTo(Math.PI / 4, 15);
    const ref = makePrimitive('cube', { size: 10 });
    o.mesh!.verts.forEach((v, i) => expect(v[2]).toBeCloseTo(ref.verts[i][2] + Math.sin(ref.verts[i][0]), 12));
  });

  it('a script is one undo step', () => {
    const e = fresh();
    const before = e.scene.toJSON();
    runScript(e, 'scene.add.cube(); scene.add.torus(); scene.get("Cube").position.x = 3');
    expect(e.scene.objects.length).toBe(4);
    e.undo();
    expect(e.scene.toJSON()).toEqual(before);
  });

  it('a script that throws leaves the scene untouched', () => {
    const e = fresh();
    const before = e.scene.toJSON();
    const r = runScript(e, 'scene.add.cube(); scene.get("Cube").position.x = 9; throw new Error("stop")');
    expect(r.error).toBe('stop');
    expect(e.scene.toJSON()).toEqual(before);
    expect(e.undoStack.length).toBe(0);
  });

  it('a script that corrupts a mesh is rejected', () => {
    const e = fresh();
    const r = runScript(e, 'scene.get("Cube").mesh.setVerts({}); scene.get("Cube").mesh.delete({}); const m = scene.get("Cube"); m.mesh.faces; scene.add.mesh({ verts: [[0,0,0]], faces: [[0, 5, 2]] })');
    expect(r.error).toMatch(/invalid mesh/);
  });

  it('replaying the GUI log rebuilds the same scene', () => {
    const e = fresh();
    const cube = e.active!;
    e.setTransform(cube, 'position', 1, 1.25);
    e.setTransform(cube, 'rotation', 1, 0.3);
    e.addModifier(cube, 'mirror');
    e.enterEdit();
    e.setSelectMode('face'); e.selectElement(1); e.extrude(0.75); e.inset(0.2);
    e.setSelectMode('edge'); e.clearElements();
    const m = e.editObject!.mesh!;
    const edge = [...m.edges().values()].find((x) => x.faces.length === 2)!;
    e.loopCut(edge.a, edge.b, 0.4);
    e.setVerts({ 0: [-1.5, -1, -1] });
    e.exitEdit();
    e.addPrimitive('uvSphere', { segments: 12, rings: 6 }, { position: [3, 0, 0] });
    e.setParent(e.active!, cube);
    e.rename(e.active!, 'Head');
    e.setMaterial(cube, { color: '#ff8800' });
    e.addModifier(cube, 'subsurf');
    e.updateModifier(cube, 1, { levels: 1 });

    const replay = fresh();
    const r = runScript(replay, e.log.map((l) => l.code).join('\n'));
    expect(r.error).toBeNull();
    expect(same(replay.scene.toJSON(), e.scene.toJSON())).toBe(true);
  });
});

describe('edit-mode details', () => {
  it('mirror clipping keeps seam vertices on the plane', () => {
    const e = fresh();
    const o = e.activeObject!;
    e.addModifier(o.id, 'mirror');
    o.mesh!.verts.forEach((v) => { if (v[0] < 0) v[0] = 0; });
    const start = o.mesh!.verts.map((v) => [...v] as [number, number, number]);
    o.mesh!.verts.forEach((v) => { v[0] += 0.5; });
    e.clipToMirror(o, start, o.mesh!.verts.map((_, i) => i));
    expect(o.mesh!.verts.filter((_, i) => start[i][0] === 0).every((v) => v[0] === 0)).toBe(true);
    expect(o.mesh!.verts.filter((_, i) => start[i][0] === 1).every((v) => v[0] === 1.5)).toBe(true);
  });

  it('switching from vertex to face mode keeps only fully selected faces', () => {
    const e = fresh();
    e.enterEdit(); e.setSelectMode('vert');
    const m = e.editObject!.mesh!;
    const top = m.faces.findIndex((_, fi) => m.faceNormal(fi)[1] > 0.5);
    e.setElements(m.faces[top]);
    e.setSelectMode('face');
    expect([...e.sel.faces]).toEqual([top]);
  });

  it('operations explain what is missing instead of failing silently', () => {
    const e = fresh();
    expect(e.extrude()).toBe(false);
    expect(e.message).toMatch(/edit mode/);
    e.enterEdit();
    expect(e.extrude()).toBe(false);
    expect(e.message).toMatch(/select some faces/);
  });

  it('records a trace when tracing is on', () => {
    const e = fresh();
    e.traceEnabled = true;
    e.enterEdit(); e.smoothSubdivide();
    expect(e.trace?.op).toBe('Catmull–Clark');
    expect(e.trace?.phases().length).toBe(4);
  });
});

describe('the GUI → code log follows undo and redo', () => {
  it('an undone step leaves the log; redo puts it back; replay matches the scene either way', () => {
    const e = new Editor(); e.newScene();
    e.addPrimitive('torus');
    e.addPrimitive('cone');
    expect(e.log.length).toBe(2);
    e.undo();
    expect(e.log.length).toBe(1);
    const replay = () => { const e2 = new Editor(); e2.newScene(); runScript(e2, e.log.map((l) => l.code).join('\n')); return e2.scene.objects.map((o) => o.name); };
    expect(replay()).toEqual(e.scene.objects.map((o) => o.name));
    e.redo();
    expect(e.log.length).toBe(2);
    expect(replay()).toEqual(e.scene.objects.map((o) => o.name));
  });
});
