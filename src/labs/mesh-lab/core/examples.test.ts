import { describe, it, expect } from 'vitest';
import { Editor } from './Editor';
import { runScript } from './api';
import { EXAMPLES } from './examples';
import { evaluate } from './modifiers';
import { parseOBJ, exportOBJ } from './formats';
import { advance } from '../../../utils/playback';

const fresh = () => { const e = new Editor(); e.newScene(); return e; };

describe('example scripts', () => {
  for (const ex of EXAMPLES) {
    it(`"${ex.title}" runs cleanly`, () => {
      const r = runScript(fresh(), ex.code);
      expect(r.error).toBeNull();
      expect(r.output.length).toBeGreaterThan(0);
    });
  }

  it('the character is one closed, connected surface once mirrored and smoothed', () => {
    const e = fresh();
    expect(runScript(e, EXAMPLES.find((x) => x.id === 'character')!.code).error).toBeNull();
    const o = e.scene.get('Character')!;
    const cage = evaluate(o.mesh!, o.modifiers.filter((m) => m.type === 'mirror'));
    expect(cage.stats()).toMatchObject({ closed: true, components: 1, euler: 2 });
    expect(cage.volume()).toBeGreaterThan(0);
    const smooth = evaluate(o.mesh!, o.modifiers);
    expect(smooth.stats()).toMatchObject({ closed: true, components: 1 });
    expect(smooth.stats().ngons).toMatchObject({ tris: 0, larger: 0 });
  });

  it('the torus by hand has Euler characteristic 0 and the quad sphere sits on the unit sphere', () => {
    const e = fresh();
    runScript(e, EXAMPLES.find((x) => x.id === 'torus-by-hand')!.code);
    expect(e.scene.get('Torus by hand')!.mesh!.stats()).toMatchObject({ euler: 0, closed: true });
    runScript(e, EXAMPLES.find((x) => x.id === 'quad-sphere')!.code);
    for (const v of e.scene.get('Quad sphere')!.mesh!.verts) expect(Math.hypot(...v)).toBeCloseTo(1, 12);
  });

  it('one quad reaches the GPU as two triangles', () => {
    const r = runScript(fresh(), EXAMPLES.find((x) => x.id === 'buffers')!.code);
    expect(r.output.at(-1)).toBe('so the GPU draws 2 triangles');
  });

  it('the curvature example prints Gauss–Bonnet exactly and shows a heat map', () => {
    const e = fresh();
    const r = runScript(e, EXAMPLES.find((x) => x.id === 'curvature')!.code);
    expect(r.output[2]).toBe('Σ K·area = 12.566371  4π = 12.566371  Euler 2');
    expect(e.field?.spec.kind).toBe('geodesic');
  });
});

describe('OBJ', () => {
  it('round-trips quads, names and world positions', () => {
    const e = fresh();
    runScript(e, 'const c = scene.get("Cube"); c.position.set(1, 2, 3)');
    const objs = parseOBJ(exportOBJ(e.scene));
    expect(objs.map((o) => o.name)).toEqual(['Cube']);
    expect(objs[0].faces.every((f) => f.length === 4)).toBe(true);
    const xs = objs[0].verts.map((v) => v[0]), ys = objs[0].verts.map((v) => v[1]);
    expect([Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)]).toEqual([0, 2, 1, 3]);
  });

  it('reads negative and slashed indices, and numbers each object from zero', () => {
    const objs = parseOBJ('v 0 0 0\nv 1 0 0\nv 1 1 0\no A\nf 1/1/1 2//2 3\nv 5 5 5\nv 6 5 5\nv 6 6 5\no B\nf -3 -2 -1\n');
    expect(objs.map((o) => [o.name, o.faces])).toEqual([['A', [[0, 1, 2]]], ['B', [[0, 1, 2]]]]);
    expect(objs[1].verts[0]).toEqual([5, 5, 5]);
  });
});

describe('shared playback', () => {
  it('advances by the speed\'s step count and stops on the last step', () => {
    expect(advance(3, 10, 2)).toEqual({ step: 5, done: false });
    expect(advance(8, 10, 2)).toEqual({ step: 9, done: true });
    expect(advance(0, 1, 1)).toEqual({ step: 0, done: true });
  });
});

import { evalExpr } from './expr';
describe('number-field expressions', () => {
  it('evaluates arithmetic, constants and functions, and rejects anything else', () => {
    expect(evalExpr('pi/4')).toBeCloseTo(Math.PI / 4, 15);
    expect(evalExpr('2*1.5 + 1')).toBe(4);
    expect(evalExpr('-(3 + 4)^2')).toBe(-49);
    expect(evalExpr('sqrt(2)/2')).toBeCloseTo(Math.SQRT1_2, 15);
    expect(evalExpr('1e-3')).toBe(0.001);
    expect(evalExpr('2^3^2')).toBe(512);
    for (const bad of ['', 'alert(1)', '1+', 'x', '(1', 'constructor']) expect(evalExpr(bad)).toBeNull();
  });
});
