import { describe, expect, it } from 'vitest';
import { makePrimitive } from './primitives';
import { Sparse, solveCG, operators, gaussianCurvature, meanCurvature, heatGeodesic, smooth, smoothImplicit, contours, levelsFor, cotAt } from './geometry';
import { Trace } from './trace';
import { subdivide } from './subdivision';
import type { Vec3 } from './EditMesh';
import { Editor } from './Editor';
import { runScript } from './api';

const sum = (a: ArrayLike<number>) => Array.from(a).reduce((s, v) => s + v, 0);

describe('linear algebra', () => {
  it('cot of the angle at the third vertex', () => {
    expect(cotAt([1, 0, 0], [0, 1, 0], [0, 0, 0])).toBeCloseTo(0, 12); // right angle
    expect(cotAt([1, 0, 0], [0.5, Math.sqrt(3) / 2, 0], [0, 0, 0])).toBeCloseTo(1 / Math.sqrt(3), 12); // 60°
  });

  it('conjugate gradients solves a symmetric positive definite system', () => {
    // [4 1; 1 3] x = [1; 2]  →  x = [1/11, 7/11]
    const A = new Sparse(2); A.add(0, 0, 4); A.add(0, 1, 1); A.add(1, 0, 1); A.add(1, 1, 3);
    const { x, iterations } = solveCG(A, [1, 2]);
    expect(x[0]).toBeCloseTo(1 / 11, 10); expect(x[1]).toBeCloseTo(7 / 11, 10);
    expect(iterations).toBeLessThanOrEqual(2); // exact in n steps
  });

  it('the cotan matrix is symmetric, rows sum to zero, and mass sums to the area', () => {
    const m = makePrimitive('uvSphere', { radius: 1, segments: 16, rings: 8 });
    const { C, mass } = operators(m);
    for (let i = 0; i < C.n; i++) {
      expect(Math.abs(sum([...C.rows[i].values()]))).toBeLessThan(1e-12);
      for (const [j, v] of C.rows[i]) expect(C.get(j, i)).toBeCloseTo(v, 12);
    }
    expect(sum(mass)).toBeCloseTo(m.area(), 10);
  });

  it('C annihilates linear functions on a flat grid (it measures bending only)', () => {
    const m = makePrimitive('grid', { size: 2, subdivisions: 6 });
    const { C } = operators(m);
    const f = m.verts.map((p) => 3 * p[0] - 2 * p[2] + 1);
    const Cf = C.mul(f);
    const boundary = new Set<number>();
    for (const e of m.edges().values()) if (e.faces.length === 1) { boundary.add(e.a); boundary.add(e.b); }
    Cf.forEach((v, i) => { if (!boundary.has(i)) expect(Math.abs(v)).toBeLessThan(1e-12); });
  });
});

describe('curvature', () => {
  it('Gauss–Bonnet: the angle defects of a closed surface sum to 2π·χ exactly', () => {
    for (const [type, chi] of [['cube', 2], ['uvSphere', 2], ['torus', 0], ['cylinder', 2]] as const) {
      const K = gaussianCurvature(makePrimitive(type), { integrated: true });
      expect(sum(K)).toBeCloseTo(2 * Math.PI * chi, 9);
    }
  });

  it("a cube's curvature is all at its corners: π/2 each, zero elsewhere", () => {
    const K = gaussianCurvature(makePrimitive('cube'), { integrated: true });
    K.forEach((k) => expect(k).toBeCloseTo(Math.PI / 2, 12));
  });

  it('a sphere of radius r has K ≈ 1/r² and H ≈ 1/r', () => {
    const r = 2, m = makePrimitive('uvSphere', { radius: r, segments: 48, rings: 24 });
    const K = gaussianCurvature(m), H = meanCurvature(m);
    // Away from the poles, where the triangles are well shaped.
    const mid = m.verts.map((p, i) => [p, i] as const).filter(([p]) => Math.abs(p[1]) < 0.7 * r).map(([, i]) => i);
    for (const i of mid) { expect(K[i]).toBeCloseTo(1 / (r * r), 2); expect(H[i]).toBeCloseTo(1 / r, 2); }
  });

  it('on quads, curvature does not depend on which diagonal a quad is cut along', () => {
    // A subdivided cube pushed onto the unit sphere: all quads, all cut the same way by a
    // single fan. With one diagonal H ranged 0.74 to 1.57; averaging both gives 1 ± 2%.
    const m = subdivide(makePrimitive('cube'), 3);
    m.verts = m.verts.map((p) => { const l = Math.hypot(...p); return [p[0] / l, p[1] / l, p[2] / l] as Vec3; });
    const H = Array.from(meanCurvature(m)).sort((a, b) => a - b);
    const q = (f: number) => H[Math.floor(f * (H.length - 1))];
    expect(q(0.5)).toBeCloseTo(1, 1);
    expect(q(0.05)).toBeGreaterThan(0.98); expect(q(0.95)).toBeLessThan(1.02);
  });

  it('a flat grid has zero curvature inside', () => {
    const m = makePrimitive('grid', { size: 2, subdivisions: 5 });
    const H = meanCurvature(m), K = gaussianCurvature(m);
    m.verts.forEach((p, i) => { if (Math.abs(p[0]) < 0.99 && Math.abs(p[2]) < 0.99) { expect(H[i]).toBeCloseTo(0, 10); expect(K[i]).toBeCloseTo(0, 10); } });
  });
});

describe('heat method geodesic distance', () => {
  it('on a flat grid it is the straight-line distance', () => {
    const m = makePrimitive('grid', { size: 4, subdivisions: 40 });
    const src = m.verts.findIndex((p) => Math.hypot(p[0], p[2]) < 1e-9);
    const d = heatGeodesic(m, [src]);
    const h = 4 / 40;
    let worst = 0;
    m.verts.forEach((p, i) => { const r = Math.hypot(p[0], p[2]); if (r < 1.5) worst = Math.max(worst, Math.abs(d[i] - r)); });
    expect(d[src]).toBe(0);
    expect(worst).toBeLessThan(h); // within one edge length (measured 0.06 for h = 0.1)
  });

  it('on a sphere it is the great-circle distance r·acos(y/r)', () => {
    const r = 1, m = makePrimitive('uvSphere', { radius: r, segments: 64, rings: 32 });
    const pole = m.verts.reduce((best, p, i) => (p[1] > m.verts[best][1] ? i : best), 0);
    const d = heatGeodesic(m, [pole]);
    let worst = 0;
    m.verts.forEach((p, i) => { worst = Math.max(worst, Math.abs(d[i] - r * Math.acos(Math.max(-1, Math.min(1, p[1] / r))))); });
    expect(worst / Math.PI).toBeLessThan(0.01); // under 1% of the half circumference (measured 0.1%)
  });

  it('records the four phases with fields', () => {
    const m = makePrimitive('uvSphere', { segments: 12, rings: 6 });
    const t = new Trace('geodesic');
    heatGeodesic(m, [0], t);
    expect(t.phases().map((p) => p.phase)).toEqual(['Cotan weights', 'Heat flow', 'Gradient field', 'Divergence', 'Poisson solve']);
    const last = t.steps[t.steps.length - 1];
    expect(last.field).toHaveLength(m.verts.length);
    expect(last.contours).toBeGreaterThan(0);
  });
});

describe('smoothing and contours', () => {
  it('smoothing flattens a bump and leaves the boundary alone', () => {
    const m = makePrimitive('grid', { size: 2, subdivisions: 8 });
    const peak = m.verts.findIndex((p) => Math.hypot(p[0], p[2]) < 1e-9);
    m.verts[peak] = [0, 1, 0];
    const edge0 = m.verts.map((p) => [...p] as Vec3);
    const moved = smooth(m, { iterations: 5, lambda: 0.5 });
    expect(m.verts[peak][1]).toBeLessThan(0.2);
    expect(moved[peak]).toBeGreaterThan(0.8);
    m.verts.forEach((p, i) => { if (Math.abs(edge0[i][0]) > 0.99 || Math.abs(edge0[i][2]) > 0.99) expect(p).toEqual(edge0[i]); });
  });

  it('implicit smoothing: one large step flattens a bump, the boundary stays, and it is traced', () => {
    const m = makePrimitive('grid', { size: 2, subdivisions: 8 });
    const peak = m.verts.findIndex((p) => Math.hypot(p[0], p[2]) < 1e-9);
    m.verts[peak] = [0, 0.3, 0];
    const edge0 = m.verts.map((p) => [...p] as Vec3);
    const t = new Trace('Implicit smoothing');
    smoothImplicit(m, { strength: 5 }, t);
    expect(m.verts[peak][1]).toBeLessThan(0.06);
    m.verts.forEach((p, i) => { if (Math.abs(edge0[i][0]) > 0.99 || Math.abs(edge0[i][2]) > 0.99) expect(p).toEqual(edge0[i]); });
    expect(t.steps.map((s) => s.phase)).toEqual(['The system', 'Solve']);
    expect(t.steps[0].quiz!.answer[0]).toBeGreaterThan(0);
  });

  it('implicit smoothing is stable at any step; a sphere shrinks like mean curvature flow', () => {
    // Mean curvature flow on a unit sphere moves every point inward at the same speed, so it stays round.
    const m = makePrimitive('uvSphere', { radius: 1, segments: 32, rings: 16 });
    const t = new Trace('Implicit smoothing');
    smoothImplicit(m, { strength: 2 }, t);
    const R = m.verts.map((p) => Math.hypot(...p)), mean = sum(R) / R.length;
    for (const r of R) expect(Math.abs(r - mean)).toBeLessThan(0.01);
    expect(mean).toBeLessThan(1);
    expect(t.steps.at(-1)!.phase).toBe('Shrinkage');
    const huge = makePrimitive('uvSphere', { radius: 1, segments: 32, rings: 16 });
    smoothImplicit(huge, { strength: 1000 });
    for (const p of huge.verts) { expect(Math.hypot(...p)).toBeLessThan(0.05); expect(Number.isFinite(p[0])).toBe(true); }
  });

  it('only the selected vertices move', () => {
    const m = makePrimitive('uvSphere', { segments: 16, rings: 8 });
    const before = m.verts.map((p) => [...p] as Vec3);
    m.verts[20] = [m.verts[20][0] * 1.3, m.verts[20][1] * 1.3, m.verts[20][2] * 1.3];
    const moved = smoothImplicit(m, { strength: 2, only: [20] });
    moved.forEach((d, i) => { if (i !== 20) expect(m.verts[i]).toEqual(before[i]); });
    expect(Math.hypot(...m.verts[20])).toBeLessThan(1.3);
  });

  it('contours of the height of a sphere are circles at that height', () => {
    const m = makePrimitive('uvSphere', { segments: 24, rings: 12 });
    const y = m.verts.map((p) => p[1]);
    const segs = contours(m, y, [0.25]);
    expect(segs.length).toBeGreaterThan(20);
    for (const [a, b] of segs) { expect(a[1]).toBeCloseTo(0.25, 12); expect(b[1]).toBeCloseTo(0.25, 12); }
    expect(levelsFor([0, 10], 4)).toEqual([2, 4, 6, 8]);
  });
});

describe('heat maps in the editor', () => {
  const fresh = () => { const e = new Editor(); e.newScene(); return e; };

  it('distance from the selection follows the mesh as it is edited, and is dropped with its object', () => {
    const e = fresh();
    const cube = e.activeObject!;
    e.enterEdit(); e.setSelectMode('vert'); e.selectElement(0);
    expect(e.showDistanceFromSelection()).toBe(true);
    expect(e.field!.result.values[0]).toBe(0);
    expect(e.log.at(-1)!.code).toBe('scene.get("Cube").mesh.showField("geodesic", { from: [0] })');
    const far = Math.max(...e.field!.result.values);
    // The opposite corner of a 2-unit cube is 2 + 2 away across two faces (unfold them: √(2² + 4²) ≈ 4.47).
    expect(far).toBeGreaterThan(4); expect(far).toBeLessThan(4.7);
    e.setSelectMode('face'); e.selectElement(0); e.extrude(1);
    expect(e.field!.mesh.verts.length).toBe(cube.mesh!.verts.length); // recomputed on the new mesh
    e.exitEdit(); e.deleteObjects([cube.id]);
    expect(e.field).toBeNull();
  });

  it('a field on an object with modifiers is computed on the evaluated mesh', () => {
    const e = fresh();
    const cube = e.activeObject!;
    e.addModifier(cube.id, 'subsurf');
    e.showField({ kind: 'mean' });
    expect(e.field!.mesh.verts.length).toBeGreaterThan(cube.mesh!.verts.length);
  });

  it('scripts read curvature and distance, colour by their own values, and smooth', () => {
    const e = fresh();
    const r = runScript(e, `
      const s = scene.add.uvSphere({ name: 'Ball', radius: 2, segments: 32, rings: 16 })
      const H = s.mesh.curvature('mean')
      const d = s.mesh.geodesic(0)
      print(H.length === s.mesh.verts.length, d[0])
      s.mesh.showField(s.mesh.verts.map(v => v.y * v.y), { label: 'y squared' })
      const L = s.mesh.laplacian()
      print(L.rows.length, Math.abs(L.mass.reduce((a, b) => a + b) - s.mesh.stats().area) < 1e-9)
    `);
    expect(r.error).toBeNull();
    expect(r.output).toEqual(['true 0', '482 true']);
    expect(e.field!.result.label).toBe('y squared');
    expect(runScript(e, `scene.get('Ball').mesh.showField('wobble')`).error).toMatch(/unknown field/);
  });

  it('smooth vertices is one undo step and can be adjusted afterwards', () => {
    const e = fresh();
    e.addPrimitive('grid', { size: 2, subdivisions: 6 });
    const g = e.activeObject!;
    const mid = g.mesh!.verts.findIndex((p) => Math.hypot(p[0], p[2]) < 1e-9);
    g.mesh!.verts[mid] = [0, 1, 0];
    e.enterEdit(); e.setSelectMode('vert'); e.selectAllElements();
    expect(e.smoothVerts(1, 0.5)).toBe(true);
    const once = g.mesh!.verts[mid][1];
    expect(once).toBeCloseTo(0.5, 12); // halfway to the neighbours' average of 0
    e.adjustLast({ iterations: 10 });
    expect(e.activeObject!.mesh!.verts[mid][1]).toBeLessThan(0.1);
    e.undo();
    expect(e.activeObject!.mesh!.verts[mid][1]).toBe(1);
  });
});
