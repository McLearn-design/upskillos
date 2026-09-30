import { describe, expect, it } from 'vitest';
import { makePrimitive } from './primitives';
import { EditMesh } from './EditMesh';
import { angleDistortion, charts, evaluateUV, lscm, sharpEdges, subdivideUV, triangleDistortion, unwrap, uvFits, mirrorUV } from './uv';
import type { Vec3 } from './EditMesh';
import { evaluate, mirror } from './modifiers';

const mean = (a: ArrayLike<number>) => Array.from(a).reduce((s, x) => s + x, 0) / a.length;

describe('distortion measure', () => {
  it('is 1 for a map that only rotates and scales, and σ₁/σ₂ = 2 for a stretch by 2', () => {
    const p: [Vec3, Vec3, Vec3] = [[0, 0, 0], [1, 0, 0], [0, 0, 1]];
    const d1 = triangleDistortion(p, [[0, 0], [0, 2], [-2, 0]]);  // turned 90°, scaled 2
    expect(d1.sigma1).toBeCloseTo(2, 12); expect(d1.sigma2).toBeCloseTo(2, 12);
    const d2 = triangleDistortion(p, [[0, 0], [2, 0], [0, 1]]);
    expect(d2.sigma1 / d2.sigma2).toBeCloseTo(2, 12);
  });
});

describe('charts', () => {
  it('a cube cut on its twelve sharp edges falls into six charts of four corners each', () => {
    const cube = makePrimitive('cube');
    const seams = new Set(sharpEdges(cube));
    expect(seams.size).toBe(12);
    const cs = charts(cube, seams);
    expect(cs.length).toBe(6);
    for (const c of cs) expect(c.mesh.verts.length).toBe(4);
  });

  it('a seam that stops part way still opens the surface: one chart, the seam vertices doubled', () => {
    const grid = makePrimitive('grid', { size: 2, subdivisions: 4 }); // 25 vertices
    // A cut from the edge to the centre along z = 0, x ≤ 0.
    const on = (x: number, z: number) => grid.verts.findIndex((v) => Math.abs(v[0] - x) < 1e-9 && Math.abs(v[2] - z) < 1e-9);
    const seam = new Set([[-1, -0.5], [-0.5, 0]].map(([a, b]) => EditMesh.edgeKey(on(a, 0), on(b, 0))));
    const cs = charts(grid, seam);
    expect(cs.length).toBe(1);
    // The cut's vertex on the outer edge and its middle vertex get a second wedge (one per side);
    // the vertex where the cut stops (the centre) has one side only, so stays single.
    expect(cs[0].mesh.verts.length).toBe(25 + 2);
  });
});

describe('LSCM', () => {
  it('flattens a flat grid without distortion (it is already conformal)', () => {
    const g = makePrimitive('grid', { size: 2, subdivisions: 6 });
    const uv = lscm(g);
    const layer = { faces: g.faces.map((f) => f.map((v) => uv[v])) };
    for (const d of angleDistortion(g, layer)) expect(d).toBeCloseTo(1, 6);
  });

  it('a cube cut on its sharp edges unwraps to six undistorted squares of equal size', () => {
    const cube = makePrimitive('cube');
    const layer = unwrap(cube, new Set(sharpEdges(cube)));
    expect(uvFits(cube, layer)).toBe(true);
    for (const d of angleDistortion(cube, layer)) expect(d).toBeCloseTo(1, 6);
    const areas = layer.faces.map((f) => Math.abs((f[1][0] - f[0][0]) * (f[2][1] - f[0][1]) - (f[2][0] - f[0][0]) * (f[1][1] - f[0][1])));
    for (const a of areas) expect(a).toBeCloseTo(areas[0], 9);
    // Each square lies straight in the texture: every edge runs along u or along v.
    for (const f of layer.faces) f.forEach((p, i) => { const q = f[(i + 1) % 4]; expect(Math.min(Math.abs(q[0] - p[0]), Math.abs(q[1] - p[1]))).toBeLessThan(1e-9); });
    for (const f of layer.faces) for (const [u, v] of f) { expect(u).toBeGreaterThanOrEqual(0); expect(u).toBeLessThanOrEqual(1); expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThanOrEqual(1); }
  });

  it('a sphere opened along one meridian unwraps toward conformal as it is refined, but cannot keep its areas', () => {
    const open = (seg: number, rings: number) => {
      const s = makePrimitive('uvSphere', { segments: seg, rings });
      // Seam: the meridian at angle 0 (x > 0, z ≈ 0), pole to pole.
      const mer = s.verts.map((v, i) => [v, i] as const).filter(([v]) => v[0] >= -1e-9 && Math.abs(v[2]) < 1e-9).map(([, i]) => i);
      const seams = new Set<string>();
      for (const [k, e] of s.edges()) if (mer.includes(e.a) && mer.includes(e.b)) seams.add(k);
      return { s, layer: unwrap(s, seams) };
    };
    // The discrete map is only as conformal as the triangles allow: halving their size halves the error.
    const coarse = open(24, 12), fine = open(48, 24);
    const dc = mean(angleDistortion(coarse.s, coarse.layer)), df = mean(angleDistortion(fine.s, fine.layer));
    expect(df - 1).toBeLessThan((dc - 1) * 0.6);
    expect(df).toBeLessThan(1.12);
    const { s, layer } = coarse;
    // Area: the ratio of UV area to surface area varies a lot (poles squeezed or blown up).
    const ratio = s.faces.map((f, fi) => {
      const t = layer.faces[fi];
      let a = 0; for (let i = 1; i + 1 < f.length; i++) a += Math.abs((t[i][0] - t[0][0]) * (t[i + 1][1] - t[0][1]) - (t[i + 1][0] - t[0][0]) * (t[i][1] - t[0][1])) / 2;
      return a / s.faceArea(fi);
    });
    expect(Math.max(...ratio) / Math.min(...ratio)).toBeGreaterThan(5);
  });

  it('a closed surface without seams is refused with a helpful message', () => {
    expect(() => unwrap(makePrimitive('cube'), new Set())).toThrow(/mark seams/);
  });
});

describe('UVs through the modifiers', () => {
  it('follow a mirror and a subdivision face for face', () => {
    const cube = makePrimitive('cube');
    const layer = unwrap(cube, new Set(sharpEdges(cube)));
    const mirrored = mirror(cube, 'x', 0.001);
    const mu = mirrorUV(cube, layer, 'x', 0.001);
    expect(uvFits(mirrored, mu)).toBe(true);
    const sub = subdivideUV(layer, 2);
    expect(sub.faces.length).toBe(cube.faces.length * 16);
    const ev = evaluateUV(cube, layer, [{ type: 'mirror', axis: 'x', merge: 0.001, clip: false, enabled: true }, { type: 'subsurf', levels: 1, enabled: true }], 3, false);
    expect(uvFits(evaluate(cube, [{ type: 'mirror', axis: 'x', merge: 0.001, clip: false, enabled: true }, { type: 'subsurf', levels: 1, enabled: true }], 3), ev)).toBe(true);
  });
});

import { Editor } from './Editor';
import { runScript } from './api';
import { Scene } from './Scene';
import { fragmentShader, textureRGBA, SHADER_MODELS, DEFAULT_CUSTOM } from './shading';

describe('UVs in the editor and scripts', () => {
  it('seams from sharp edges, unwrap, a checker, the distortion map: logged and replayable', () => {
    const e = new Editor(); e.newScene();
    const cube = e.activeObject!;
    e.seamsFromSharp(60);
    expect(e.unwrap()).toBe(true);
    const o = e.scene.get(cube.id)!;
    expect(uvFits(o.mesh!, o.uv)).toBe(true);
    expect(o.material.texture).toBe('checker');
    expect(e.log.slice(-2).map((l) => l.code)).toEqual(['scene.get("Cube").mesh.seamsFromSharp(60)', 'scene.get("Cube").mesh.unwrap()\nscene.get("Cube").material.texture = "checker"']);
    expect(e.showField({ kind: 'uv' })).toBe(true);
    for (const d of e.field!.result.values) expect(d).toBeCloseTo(1, 6);
    const e2 = new Editor(); e2.newScene();
    expect(runScript(e2, e.log.map((l) => l.code).join('\n')).error).toBeNull();
    expect(e2.scene.get('Cube')!.uv).toEqual(o.uv);
    expect(Scene.fromJSON(JSON.parse(JSON.stringify(e.scene.toJSON()))).get('Cube')!.uv).toEqual(o.uv);
  });

  it('marking seams needs selected edges in edit mode; unwrapping a closed mesh without seams explains itself', () => {
    const e = new Editor(); e.newScene();
    expect(e.unwrap()).toBe(false);
    expect(e.message).toMatch(/mark seams/);
    e.enterEdit(); e.setSelectMode('edge'); e.selectAllElements();
    expect(e.markSeams()).toBe(true);
    expect(e.scene.get('Cube')!.seams!.length).toBe(12);
  });

  it('scripts: seams, unwrap, uv, distortion, shader and texture, with clear errors', () => {
    const e = new Editor(); e.newScene();
    const r = runScript(e, `
      const g = scene.add.grid({ name: 'G', size: 2, subdivisions: 4 })
      g.mesh.unwrap()
      g.material.shader = 'blinn-phong'
      g.material.texture = 'bricks'
      log(g.mesh.uv.length, Math.max(...g.mesh.uvDistortion()).toFixed(6), g.material.shader)
    `);
    expect(r.error).toBeNull();
    expect(r.output).toEqual(['16 1.000000 blinn-phong']);
    expect(runScript(e, `scene.get('G').material.shader = 'glossy'`).error).toMatch(/shader must be one of/);
  });
});

describe('shading', () => {
  it('builds a fragment shader for every model around one shade() function', () => {
    for (const m of SHADER_MODELS) if (m !== 'pbr') {
      const fs = fragmentShader(m);
      expect(fs).toMatch(/vec3 shade\(vec3 N, vec3 L, vec3 V, vec2 uv, vec3 base, vec3 light\)/);
      expect(fs).toMatch(/gl_FragColor = vec4\(shade\(/);
    }
    expect(fragmentShader('custom', 'return vec3(1.0);')).toMatch(/\{\n  return vec3\(1\.0\);\n\}/);
    expect(fragmentShader('custom')).toContain(DEFAULT_CUSTOM.split('\n')[3]);
    expect(fragmentShader('lambert', undefined, true)).toContain('dFdx(vPosW)');
  });

  it('draws the checker as 8 × 8 alternating squares', () => {
    const px = textureRGBA('checker', 64);
    const at = (x: number, y: number) => px[(y * 64 + x) * 4];
    expect(at(0, 0)).toBe(235); expect(at(8, 0)).not.toBe(235); expect(at(8, 8)).toBe(235); expect(at(63, 63)).toBe(235);
  });
});

describe('smooth UV subdivision (keep boundaries)', () => {
  const planar = (m: EditMesh) => ({ faces: m.faces.map((f) => f.map((v) => [m.verts[v][0], m.verts[v][2]] as [number, number])) });

  it('reproduces a straight projection exactly: on a flat grid the smoothed UV of every corner is its new vertex’s (x, z)', async () => {
    const { subdivide } = await import('./subdivision');
    const g = makePrimitive('grid', { size: 2, subdivisions: 4 });
    const sub = subdivide(g, 1), uv = subdivideUV(planar(g), 1, g, true);
    expect(uv.faces.length).toBe(sub.faces.length);
    let checked = 0;
    sub.faces.forEach((f, fi) => f.forEach((v, k) => {
      const p = sub.verts[v];
      expect(uv.faces[fi][k][0]).toBeCloseTo(p[0], 12);
      expect(uv.faces[fi][k][1]).toBeCloseTo(p[2], 12);
      checked++;
    }));
    expect(checked).toBe(sub.faces.length * 4);
  });

  it('keeps island boundaries: a cube cut into six islands gets exactly the linear UVs', () => {
    const cube = makePrimitive('cube');
    const layer = unwrap(cube, new Set(sharpEdges(cube)));
    // Level 1: every UV vertex is on an island edge. Level 2 has inside points, but each island is a flat
    // square, and the smoothing rules reproduce a flat square grid exactly: the same, up to rounding.
    const a = subdivideUV(layer, 2, cube, true), b = subdivideUV(layer, 2, cube, false);
    a.faces.forEach((f, i) => f.forEach((p, k) => { expect(p[0]).toBeCloseTo(b.faces[i][k][0], 12); expect(p[1]).toBeCloseTo(b.faces[i][k][1], 12); }));
  });

  it('on a sphere, smooth UVs distort the texture less than linear ones on the smoothed surface', async () => {
    const { subdivide } = await import('./subdivision');
    const sphere = makePrimitive('uvSphere', { segments: 12, rings: 8 });
    // One seam, pole to pole along the +x side: a single island.
    const seam = [...sphere.edges().values()].filter((e) => [e.a, e.b].every((v) => Math.abs(sphere.verts[v][2]) < 1e-9 && sphere.verts[v][0] >= -1e-9)).map((e) => `${e.a}-${e.b}`);
    expect(seam).toHaveLength(8);
    const layer = unwrap(sphere, new Set(seam)), surface = subdivide(sphere, 2);
    const stats = (smooth: boolean) => { const d = angleDistortion(surface, subdivideUV(layer, 2, sphere, smooth)); return { mean: d.reduce((a, b) => a + b, 0) / d.length, max: Math.max(...d) }; };
    const lin = stats(false), smo = stats(true);
    // Measured: mean 1.49 → 1.32, worst 4.89 → 2.89 (1 is no distortion).
    expect(smo.mean).toBeLessThan(lin.mean - 0.1);
    expect(smo.max).toBeLessThan(lin.max * 0.7);
  });

  it('is the default in the modifier stack, and uvSmooth: false gives the old linear UVs', () => {
    const g = makePrimitive('grid', { size: 2, subdivisions: 3 });
    const bumpy = new EditMesh(g.verts.map((v) => [v[0], 0.3 * Math.sin(3 * v[0]) * Math.cos(2 * v[2]), v[2]] as Vec3), g.faces.map((f) => [...f]));
    const uv = planar(bumpy);
    const sub = (uvSmooth?: boolean) => evaluateUV(bumpy, uv, [{ type: 'subsurf', levels: 1, enabled: true, ...(uvSmooth === undefined ? {} : { uvSmooth }) }], 3, false);
    expect(sub()).toEqual(subdivideUV(uv, 1, bumpy, true));
    expect(sub(false)).toEqual(subdivideUV(uv, 1));
    expect(sub()).not.toEqual(sub(false));
  });
});
