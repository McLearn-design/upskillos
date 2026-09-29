// UV unwrapping: flattening a surface onto a square so an image can be painted on it.
//
// 1. Seams. A closed surface cannot lie flat without being cut. Edges marked as
//    seams are cuts; the faces left joined across non-seam edges form charts.
//    A vertex on a seam belongs to several "wedges" (the corners around it on each
//    side of the cut), and each wedge gets its own UV: that is how a seam that stops
//    part way (a sphere's meridian) still opens the surface.
// 2. LSCM, least squares conformal maps (Lévy et al. 2002), per chart: find the map
//    (u, v) that is as close to angle-preserving as possible. In the form of
//    Mullen et al. 2008, the conformal energy is the Dirichlet energy minus the
//    chart's area in the plane:
//        E(u, v) = ½ (uᵀ C u + vᵀ C v) − ½ uᵀ S v
//    C is the cotan matrix the heat maps use; S adds +1/−1 along each boundary edge,
//    so ½ uᵀ S v is the signed area (the shoelace formula). E ≥ 0, and E = 0 exactly
//    when the map is conformal. Pinning two vertices fixes where the chart sits and
//    how big it is; E is then a positive definite quadratic, minimised by one
//    conjugate gradient solve.
// 3. Packing. Each chart is scaled so its UV area matches its area on the surface
//    (one texel covers the same area everywhere), laid out in rows, and the whole
//    layout scaled into the unit square.

import { EditMesh, type Vec3 } from './EditMesh';
import { Sparse, operators, solveCG } from './geometry';
import type { Modifier } from './modifiers';
import { mirror } from './modifiers';
import { subdivide } from './subdivision';
import { fmt } from './trace';
import type { Trace } from './trace';

export type UV = [number, number];
/** UVs per face corner: faces[f][i] is the UV of corner i of face f. */
export interface UVLayer { faces: UV[][] }

const ekey = EditMesh.edgeKey;

/** The UVs fit this mesh: one per corner of every face. */
export function uvFits(mesh: EditMesh, uv: UVLayer | undefined): uv is UVLayer {
  return !!uv && uv.faces.length === mesh.faces.length && uv.faces.every((f, i) => f.length === mesh.faces[i].length);
}

// ── charts and wedges ─────────────────────────────────────────────────────

class UnionFind {
  p: number[];
  constructor(n: number) { this.p = Array.from({ length: n }, (_, i) => i); }
  find(x: number): number { while (this.p[x] !== x) { this.p[x] = this.p[this.p[x]]; x = this.p[x]; } return x; }
  union(a: number, b: number): void { this.p[this.find(a)] = this.find(b); }
}

export interface Chart {
  faces: number[];
  /** The chart as its own mesh: one vertex per wedge, faces renumbered. */
  mesh: EditMesh;
  /** For each chart face (in `faces` order), each corner's chart vertex. */
  corners: number[][];
}

/**
 * Cut the mesh along its seams (and its open boundaries) into charts. Two faces are
 * in one chart if a chain of non-seam edges joins them; two corners at one vertex
 * are one wedge if they are joined around the vertex without crossing a seam.
 */
export function charts(mesh: EditMesh, seams: Set<string>): Chart[] {
  const F = mesh.faces;
  const offset: number[] = [];
  let total = 0;
  for (const f of F) { offset.push(total); total += f.length; }
  const corner = (fi: number, i: number) => offset[fi] + i;
  const faceUF = new UnionFind(F.length), cornerUF = new UnionFind(total);
  // For each directed edge a→b in a face: the face and the corner indices of a and b.
  const halves = new Map<string, { f: number; ia: number; ib: number }[]>();
  F.forEach((f, fi) => f.forEach((a, i) => {
    const j = (i + 1) % f.length, k = ekey(a, f[j]);
    (halves.get(k) ?? halves.set(k, []).get(k)!).push({ f: fi, ia: i, ib: j });
  }));
  for (const [k, hs] of halves) {
    if (hs.length !== 2 || seams.has(k)) continue;
    const [h1, h2] = hs;
    faceUF.union(h1.f, h2.f);
    // Across the edge, a's corner in one face is joined to a's corner in the other; b's likewise.
    const a1 = F[h1.f][h1.ia], a2i = F[h2.f][h2.ia] === a1 ? h2.ia : h2.ib, b2i = a2i === h2.ia ? h2.ib : h2.ia;
    cornerUF.union(corner(h1.f, h1.ia), corner(h2.f, a2i));
    cornerUF.union(corner(h1.f, h1.ib), corner(h2.f, b2i));
  }
  const byRoot = new Map<number, number[]>();
  F.forEach((_, fi) => { const r = faceUF.find(fi); (byRoot.get(r) ?? byRoot.set(r, []).get(r)!).push(fi); });
  return [...byRoot.values()].map((faces) => {
    const wedge = new Map<number, number>(), verts: Vec3[] = [];
    const corners = faces.map((fi) => F[fi].map((v, i) => {
      const w = cornerUF.find(corner(fi, i));
      if (!wedge.has(w)) { wedge.set(w, verts.length); verts.push([...mesh.verts[v]] as Vec3); }
      return wedge.get(w)!;
    }));
    return { faces, corners, mesh: new EditMesh(verts, corners.map((c) => [...c])) };
  });
}

// ── LSCM ──────────────────────────────────────────────────────────────────

/** Two boundary vertices far apart (farthest from any, then farthest from that). */
function pinPair(m: EditMesh, boundary: number[]): [number, number] {
  const d = (a: number, b: number) => Math.hypot(m.verts[a][0] - m.verts[b][0], m.verts[a][1] - m.verts[b][1], m.verts[a][2] - m.verts[b][2]);
  let p = boundary[0];
  for (const b of boundary) if (d(boundary[0], b) > d(boundary[0], p)) p = b;
  let q = p;
  for (const b of boundary) if (d(p, b) > d(p, q)) q = b;
  return [p, q];
}

/** Least squares conformal map of one chart. Returns a UV per chart vertex. */
export function lscm(m: EditMesh, trace?: Trace, label = 'chart'): UV[] {
  const n = m.verts.length;
  const { C } = operators(m);
  // S: +1 on each boundary edge i→j (in face order), −1 on j→i. ½ uᵀ S v is the signed area.
  const S = new Sparse(n), boundary = new Set<number>();
  const edges = m.edges();
  for (const f of m.faces) f.forEach((a, i) => {
    const b = f[(i + 1) % f.length];
    if (edges.get(ekey(a, b))!.faces.length === 1) { S.add(a, b, 1); S.add(b, a, -1); boundary.add(a); boundary.add(b); }
  });
  if (!boundary.size) throw new Error('This surface is closed: mark seams to cut it open before unwrapping');
  const [p1, p2] = pinPair(m, [...boundary]);
  const L = Math.hypot(...[0, 1, 2].map((k) => m.verts[p1][k] - m.verts[p2][k])) || 1;
  // Unknowns x = (u₀…u_{n−1}, v₀…v_{n−1}); H = [[C, −S/2], [S/2, C]].
  const pinned = new Map<number, number>([[p1, 0], [n + p1, 0], [p2, L], [n + p2, 0]]);
  const free: number[] = [];
  for (let i = 0; i < 2 * n; i++) if (!pinned.has(i)) free.push(i);
  const pos = new Map(free.map((g, i) => [g, i]));
  const A = new Sparse(free.length), rhs = new Float64Array(free.length);
  const entry = (r: number, c: number, val: number) => {
    const fr = pos.get(r);
    if (fr === undefined) return;
    const pc = pinned.get(c);
    if (pc !== undefined) rhs[fr] -= val * pc; else A.add(fr, pos.get(c)!, val);
  };
  C.rows.forEach((row, i) => row.forEach((val, j) => { entry(i, j, val); entry(n + i, n + j, val); }));
  S.rows.forEach((row, i) => row.forEach((val, j) => { entry(i, n + j, -val / 2); entry(n + i, j, val / 2); }));
  const sol = solveCG(A, rhs, { tol: 1e-10, maxIter: 20 * free.length + 100 });
  const x = new Float64Array(2 * n);
  for (const [g, v] of pinned) x[g] = v;
  free.forEach((g, i) => { x[g] = sol.x[i]; });
  let uv: UV[] = Array.from({ length: n }, (_, i) => [x[i], x[n + i]]);
  // Keep the chart the right way round (counter-clockwise faces stay counter-clockwise).
  let area = 0;
  for (const f of m.faces) for (let i = 1; i + 1 < f.length; i++) { const [a, b, c] = [uv[f[0]], uv[f[i]], uv[f[i + 1]]]; area += (b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1]); }
  if (area < 0) uv = uv.map(([u, v]) => [-u, v]);
  trace?.step({
    phase: 'Conformal solve', label: `${label}: ${n} vertices, pinned ${p1} → (0, 0) and ${p2} → (${fmt(L)}, 0); ${sol.iterations} CG iterations`,
    detail: 'Minimise E = ½(uᵀCu + vᵀCv) − ½ uᵀSv: the Dirichlet energy (how much the map stretches, as the heat maps measure it) minus the area it covers. E is zero exactly when every angle is kept. The two pins stop the chart sliding, turning or shrinking to a point.',
    values: [['residual', sol.residual.toExponential(1)], ['boundary vertices', String(boundary.size)]],
  });
  return uv;
}

// ── distortion ────────────────────────────────────────────────────────────

/**
 * How much a triangle is distorted by its UV map: the singular values σ₁ ≥ σ₂ of the
 * Jacobian from the triangle (in its own plane) to UV. σ₁/σ₂ = 1 means angles are kept
 * (conformal); σ₁σ₂ is how much area is scaled.
 */
export function triangleDistortion(p: [Vec3, Vec3, Vec3], t: [UV, UV, UV]): { sigma1: number; sigma2: number } {
  const e1 = [p[1][0] - p[0][0], p[1][1] - p[0][1], p[1][2] - p[0][2]], e2 = [p[2][0] - p[0][0], p[2][1] - p[0][1], p[2][2] - p[0][2]];
  const l1 = Math.hypot(e1[0], e1[1], e1[2]) || 1;
  const x = e1.map((c) => c / l1);
  const d = e2[0] * x[0] + e2[1] * x[1] + e2[2] * x[2];
  const yv = [e2[0] - d * x[0], e2[1] - d * x[1], e2[2] - d * x[2]], h = Math.hypot(yv[0], yv[1], yv[2]) || 1e-12;
  // Local 2D: q0 = (0, 0), q1 = (l1, 0), q2 = (d, h). J maps local → UV: J · [q1 q2] = [t1 − t0, t2 − t0].
  const du1 = t[1][0] - t[0][0], dv1 = t[1][1] - t[0][1], du2 = t[2][0] - t[0][0], dv2 = t[2][1] - t[0][1];
  const a = du1 / l1, c = dv1 / l1, b = (du2 - a * d) / h, dd = (dv2 - c * d) / h;
  // Singular values of [[a, b], [c, dd]].
  const s1 = a * a + b * b + c * c + dd * dd, s2 = Math.sqrt(Math.max(0, (a * a + b * b - c * c - dd * dd) ** 2 + 4 * (a * c + b * dd) ** 2));
  return { sigma1: Math.sqrt(Math.max(0, (s1 + s2) / 2)), sigma2: Math.sqrt(Math.max(0, (s1 - s2) / 2)) };
}

/** Per vertex: the average angle distortion σ₁/σ₂ of the triangles around it (1 = perfect). */
export function angleDistortion(mesh: EditMesh, uv: UVLayer): Float64Array {
  const sum = new Float64Array(mesh.verts.length), cnt = new Float64Array(mesh.verts.length);
  mesh.faces.forEach((f, fi) => {
    for (let i = 1; i + 1 < f.length; i++) {
      const vs = [f[0], f[i], f[i + 1]], ts = [uv.faces[fi][0], uv.faces[fi][i], uv.faces[fi][i + 1]];
      const { sigma1, sigma2 } = triangleDistortion(vs.map((v) => mesh.verts[v]) as [Vec3, Vec3, Vec3], ts as [UV, UV, UV]);
      const r = sigma2 > 1e-12 ? sigma1 / sigma2 : 10;
      for (const v of vs) { sum[v] += Math.min(r, 10); cnt[v]++; }
    }
  });
  return sum.map((s, i) => (cnt[i] ? s / cnt[i] : 1));
}

// ── packing ───────────────────────────────────────────────────────────────

function area3(m: EditMesh): number { return m.faces.reduce((s, _, i) => s + m.faceArea(i), 0); }
function areaUV(m: EditMesh, uv: UV[]): number {
  let a = 0;
  for (const f of m.faces) for (let i = 1; i + 1 < f.length; i++) { const [p, q, r] = [uv[f[0]], uv[f[i]], uv[f[i + 1]]]; a += Math.abs((q[0] - p[0]) * (r[1] - p[1]) - (r[0] - p[0]) * (q[1] - p[1])) / 2; }
  return a;
}

/**
 * Turn a chart to the angle that gives it the smallest bounding box. LSCM leaves each chart
 * at whatever angle its two pins set (a square pinned at opposite corners comes out standing
 * on a corner); the best box is always lined up with one of the chart's own edges, so those
 * directions are the candidates (as the rotating-calipers method uses).
 */
export function straighten(mesh: EditMesh, uv: UV[]): UV[] {
  const angles = new Set<number>([0]);
  for (const e of mesh.edges().values()) {
    const a = uv[e.a], b = uv[e.b];
    if (Math.hypot(b[0] - a[0], b[1] - a[1]) > 1e-12) angles.add(Math.atan2(b[1] - a[1], b[0] - a[0]) % (Math.PI / 2));
    if (angles.size > 256) break;
  }
  let best = 0, bestArea = Infinity;
  for (const t of angles) {
    const c = Math.cos(-t), s = Math.sin(-t);
    let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
    for (const [u, v] of uv) { const x = c * u - s * v, y = s * u + c * v; u0 = Math.min(u0, x); u1 = Math.max(u1, x); v0 = Math.min(v0, y); v1 = Math.max(v1, y); }
    const area = (u1 - u0) * (v1 - v0);
    if (area < bestArea - 1e-12) { bestArea = area; best = t; }
  }
  const c = Math.cos(-best), s = Math.sin(-best);
  return uv.map(([u, v]) => [c * u - s * v, s * u + c * v] as UV);
}

/** Straighten and scale each chart to its true area, lay them out in rows, and fit the layout in [0, 1]² with a margin. */
export function pack(chartUVs: { mesh: EditMesh; uv: UV[] }[], margin = 0.02): UV[][] {
  const boxes = chartUVs.map(({ mesh, uv: raw }) => {
    const uv = straighten(mesh, raw);
    const s = Math.sqrt(area3(mesh) / (areaUV(mesh, uv) || 1));
    const scaled = uv.map(([u, v]) => [u * s, v * s] as UV);
    const us = scaled.map((p) => p[0]), vs = scaled.map((p) => p[1]);
    const u0 = Math.min(...us), v0 = Math.min(...vs);
    return { uv: scaled.map(([u, v]) => [u - u0, v - v0] as UV), w: Math.max(...us) - u0, h: Math.max(...vs) - v0 };
  });
  const totalArea = boxes.reduce((s, b) => s + (b.w + margin) * (b.h + margin), 0);
  const rowWidth = Math.max(Math.sqrt(totalArea) * 1.15, ...boxes.map((b) => b.w + margin));
  const order = boxes.map((_, i) => i).sort((a, b) => boxes[b].h - boxes[a].h);
  const at: [number, number][] = [];
  let x = margin, y = margin, rowH = 0, maxX = 0;
  for (const i of order) {
    const b = boxes[i];
    if (x + b.w + margin > rowWidth + margin && x > margin) { x = margin; y += rowH + margin; rowH = 0; }
    at[i] = [x, y];
    x += b.w + margin; rowH = Math.max(rowH, b.h); maxX = Math.max(maxX, x);
  }
  const size = Math.max(maxX, y + rowH + margin);
  return boxes.map((b, i) => b.uv.map(([u, v]) => [(u + at[i][0]) / size, (v + at[i][1]) / size] as UV));
}

/** Unwrap a mesh: charts from seams, LSCM on each, packed into the unit square. */
export function unwrap(mesh: EditMesh, seams: Set<string>, trace?: Trace): UVLayer {
  const cs = charts(mesh, seams);
  trace?.step({
    phase: 'Cut into charts', label: `${cs.length} chart${cs.length === 1 ? '' : 's'} from ${[...seams].filter((k) => mesh.edges().has(k)).length} seam edges`,
    detail: 'Faces joined by edges that are not seams stay together. Each chart will be flattened on its own; a vertex on a seam gets one UV on each side of it.',
    faces: cs[0]?.faces ?? [],
  });
  const flat = cs.map((c, i) => ({ mesh: c.mesh, uv: lscm(c.mesh, trace, `Chart ${i + 1}`) }));
  const packed = pack(flat);
  const faces: UV[][] = mesh.faces.map((f) => f.map(() => [0, 0] as UV));
  cs.forEach((c, ci) => c.faces.forEach((fi, k) => { faces[fi] = c.corners[k].map((w) => packed[ci][w]); }));
  const layer = { faces };
  if (trace) {
    const dist = angleDistortion(mesh, layer);
    trace.step({
      phase: 'Pack', label: `Charts scaled to their true area and packed into the unit square; mean angle distortion ${fmt(dist.reduce((a, b) => a + b, 0) / dist.length, 4)}`,
      detail: 'Angle distortion is σ₁/σ₂ of each triangle\'s map, 1 when angles are kept. LSCM makes it small; it cannot also keep areas where the surface is curved (the Gauss–Bonnet idea: a sphere cannot lie flat).',
      field: Array.from(dist), fieldLabel: 'angle distortion σ₁/σ₂',
    });
  }
  return layer;
}

/** Planar projection onto the plane of two axes (for terrain): u, v from the coordinates, fitted to [0, 1]. */
export function planarUV(mesh: EditMesh, axes: [0 | 1 | 2, 0 | 1 | 2] = [0, 2]): UVLayer {
  const us = mesh.verts.map((v) => v[axes[0]]), vs = mesh.verts.map((v) => v[axes[1]]);
  const u0 = Math.min(...us), v0 = Math.min(...vs), s = Math.max(Math.max(...us) - u0, Math.max(...vs) - v0) || 1;
  return { faces: mesh.faces.map((f) => f.map((v) => [(mesh.verts[v][axes[0]] - u0) / s, (mesh.verts[v][axes[1]] - v0) / s] as UV)) };
}

/** Edges whose faces meet at more than `degrees` (a cube's twelve edges): seams for hard-surface models. */
export function sharpEdges(mesh: EditMesh, degrees = 60): string[] {
  const cos = Math.cos((degrees * Math.PI) / 180), out: string[] = [];
  for (const [k, e] of mesh.edges()) {
    if (e.faces.length !== 2) continue;
    const a = mesh.faceNormal(e.faces[0]), b = mesh.faceNormal(e.faces[1]);
    if (a[0] * b[0] + a[1] * b[1] + a[2] * b[2] < cos) out.push(k);
  }
  return out;
}

// ── UVs through the modifiers ─────────────────────────────────────────────

/** Mirror: the mirrored faces reuse their originals' UVs, in reversed corner order (as the faces are). */
export function mirrorUV(mesh: EditMesh, uv: UVLayer, axis: 'x' | 'y' | 'z', merge: number): UVLayer {
  const k = { x: 0, y: 1, z: 2 }[axis];
  const map = mesh.verts.map((v, i) => (Math.abs(v[k]) <= merge ? i : -1));
  let next = mesh.verts.length;
  const m = map.map((x) => (x >= 0 ? x : next++));
  const seen = new Set(mesh.faces.map((f) => [...f].sort((a, b) => a - b).join(',')));
  const faces = uv.faces.map((f) => f.map((p) => [...p] as UV));
  mesh.faces.forEach((f, fi) => {
    const key = f.map((v) => m[v]).sort((a, b) => a - b).join(',');
    if (!seen.has(key)) faces.push([...uv.faces[fi]].reverse().map((p) => [...p] as UV));
  });
  return { faces };
}

/** Catmull–Clark's new faces, with UVs averaged linearly the same way (corner, edge midpoint, centre, edge midpoint). */
export function subdivideUV(uv: UVLayer, levels: number): UVLayer {
  let faces = uv.faces;
  for (let l = 0; l < levels; l++) {
    const out: UV[][] = [];
    for (const f of faces) {
      const n = f.length, c: UV = [f.reduce((s, p) => s + p[0], 0) / n, f.reduce((s, p) => s + p[1], 0) / n];
      const mid = (a: UV, b: UV): UV => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      for (let i = 0; i < n; i++) out.push([f[i], mid(f[i], f[(i + 1) % n]), c, mid(f[(i - 1 + n) % n], f[i])]);
    }
    faces = out;
  }
  return { faces };
}

/**
 * The UVs of the mesh as drawn, following the modifier stack in the same order the
 * evaluated mesh does (mirror, then subdivision, for a skinned mesh).
 */
export function evaluateUV(mesh: EditMesh, uv: UVLayer, modifiers: Modifier[], maxLevels: number, skinned: boolean): UVLayer {
  let m = mesh, u = uv;
  const order = skinned ? [...modifiers.filter((x) => x.type === 'mirror'), ...modifiers.filter((x) => x.type === 'subsurf')] : modifiers;
  for (const mod of order) {
    if (!mod.enabled) continue;
    if (mod.type === 'mirror') { u = mirrorUV(m, u, mod.axis, mod.merge); m = mirror(m, mod.axis, mod.merge); }
    else if (mod.type === 'subsurf') { const lv = Math.min(maxLevels, Math.max(0, Math.round(mod.levels))); u = subdivideUV(u, lv); m = subdivide(m, lv); }
  }
  return u;
}
