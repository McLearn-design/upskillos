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
import { singularValues, triangleJacobian } from './distortionTrace';
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
  // The first chart's pins carry a prediction; later charts' would only repeat it.
  if (trace && (label === 'Chart 1' || label === 'chart')) {
    trace.step({
      phase: 'Pins', label: `${label}: pin v${p1} at (0, 0) and v${p2}, the boundary vertex farthest from it, at (${fmt(L, 4)}, 0)`,
      detail: 'A conformal map can still be moved, turned and scaled without changing any angle, so the energy has no single minimum until something is fixed. Two pins fix all four freedoms: one point fixes the position, the second the turn and the size. Pinning them as far apart as they are on the surface keeps the scale close to 1.',
      verts: [p1, p2], values: [['n (vertices)', String(n)], ['unknowns', String(2 * n - 4)], ['boundary vertices', String(boundary.size)]],
      quiz: { prompt: `v${p1} is at (${m.verts[p1].map((x) => fmt(x, 3)).join(', ')}) and v${p2} at (${m.verts[p2].map((x) => fmt(x, 3)).join(', ')}). v${p1} is pinned at (0, 0) and v${p2} on the u axis, as far from it as on the surface. At what u?`, answer: [L], labels: ['u'], rule: 'The distance between the two vertices: √(Δx² + Δy² + Δz²).', tolerance: 0.002 },
    });
  }
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
  if (trace) {
    // Angles kept, areas not: each triangle's σ₁/σ₂ and its area scale σ₁σ₂.
    const ratio: number[] = [], scale: number[] = [];
    for (const f of m.faces) for (let i = 1; i + 1 < f.length; i++) {
      const { sigma1, sigma2 } = triangleDistortion([m.verts[f[0]], m.verts[f[i]], m.verts[f[i + 1]]], [uv[f[0]], uv[f[i]], uv[f[i + 1]]]);
      if (sigma2 > 1e-12) { ratio.push(sigma1 / sigma2); scale.push(sigma1 * sigma2); }
    }
    const mean = ratio.reduce((a, b) => a + b, 0) / (ratio.length || 1);
    trace.step({
      phase: 'Angles kept', label: `${label}: angle distortion σ₁/σ₂ mean ${fmt(mean, 4)}, worst ${fmt(Math.max(...ratio), 4)}; area scale from ${fmt(Math.min(...scale), 3)} to ${fmt(Math.max(...scale), 3)}`,
      detail: 'Conformal means every small square maps to a square: σ₁/σ₂ = 1. LSCM gets close everywhere it can. It does not keep areas: on a curved chart some squares come out bigger than others (σ₁σ₂ varies). A flat chart would keep both.',
    });
  }
  return uv;
}

// ── distortion ────────────────────────────────────────────────────────────

/**
 * How much a triangle is distorted by its UV map: the singular values σ₁ ≥ σ₂ of the
 * Jacobian from the triangle (in its own plane) to UV. σ₁/σ₂ = 1 means angles are kept
 * (conformal); σ₁σ₂ is how much area is scaled.
 */
export function triangleDistortion(p: [Vec3, Vec3, Vec3], t: [UV, UV, UV]): { sigma1: number; sigma2: number } {
  // Local 2D: q0 = (0, 0), q1 = (l1, 0), q2 = (d, h). J maps local → UV: J · [q1 q2] = [t1 − t0, t2 − t0].
  const [sigma1, sigma2] = singularValues(triangleJacobian(p, t).J);
  return { sigma1, sigma2 };
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
export function pack(chartUVs: { mesh: EditMesh; uv: UV[] }[], margin = 0.02, trace?: Trace): UV[][] {
  const bbox = (uv: UV[]) => { const us = uv.map((p) => p[0]), vs = uv.map((p) => p[1]); return (Math.max(...us) - Math.min(...us)) * (Math.max(...vs) - Math.min(...vs)); };
  let turned = 0;
  const boxes = chartUVs.map(({ mesh, uv: raw }, k) => {
    const uv = straighten(mesh, raw);
    if (Math.abs(bbox(uv) - bbox(raw)) > 1e-9 * Math.max(1, bbox(raw))) turned++;
    const a3 = area3(mesh), auv = areaUV(mesh, uv), s = Math.sqrt(a3 / (auv || 1));
    if (trace && k === 0) {
      trace.step({
        phase: 'Straighten', label: `Chart 1 turned to its smallest bounding box: ${fmt(bbox(raw), 4)} → ${fmt(bbox(uv), 4)}`,
        detail: 'LSCM leaves a chart at whatever angle its pins gave it. The smallest box around a polygon always has one side along one of the polygon\'s edges, so each edge direction is tried (as rotating calipers does) and the best kept. Smaller boxes pack tighter.',
      });
      trace.step({
        phase: 'True area', label: `Chart 1 covers ${fmt(a3, 4)} of surface and ${fmt(auv, 4)} of UV: scale its UVs by ${fmt(s, 4)}`,
        detail: 'Every chart is scaled so its UV area equals its area on the surface. Then one unit of UV covers one unit of surface everywhere: equal texel density, so no part of the model is blurrier than another just because its chart came out small.',
        quiz: { prompt: `Chart 1 covers ${fmt(a3, 4)} square units of surface, but its UVs cover ${fmt(auv, 4)}. By what factor must its UV coordinates be multiplied so the two areas match?`, answer: [s], labels: ['scale'], rule: 'Areas scale with the square of lengths: s = √(surface area / UV area).', tolerance: Math.max(0.002, 0.005 * s) },
      });
    }
    const scaled = uv.map(([u, v]) => [u * s, v * s] as UV);
    const us = scaled.map((p) => p[0]), vs = scaled.map((p) => p[1]);
    const u0 = Math.min(...us), v0 = Math.min(...vs);
    return { uv: scaled.map(([u, v]) => [u - u0, v - v0] as UV), w: Math.max(...us) - u0, h: Math.max(...vs) - v0, area: a3 };
  });
  const totalArea = boxes.reduce((s, b) => s + (b.w + margin) * (b.h + margin), 0);
  const rowWidth = Math.max(Math.sqrt(totalArea) * 1.15, ...boxes.map((b) => b.w + margin));
  const order = boxes.map((_, i) => i).sort((a, b) => boxes[b].h - boxes[a].h);
  const at: [number, number][] = [];
  let x = margin, y = margin, rowH = 0, maxX = 0, rows = 1;
  for (const i of order) {
    const b = boxes[i];
    if (x + b.w + margin > rowWidth + margin && x > margin) { x = margin; y += rowH + margin; rowH = 0; rows++; }
    at[i] = [x, y];
    x += b.w + margin; rowH = Math.max(rowH, b.h); maxX = Math.max(maxX, x);
  }
  const size = Math.max(maxX, y + rowH + margin);
  if (trace) {
    const used = boxes.reduce((s, b) => s + b.area, 0) / (size * size);
    trace.step({
      phase: 'Shelves', label: `${boxes.length} chart${boxes.length === 1 ? '' : 's'} (${turned} turned), tallest first, in ${rows} row${rows === 1 ? '' : 's'} up to ${fmt(rowWidth, 3)} wide`,
      detail: `Shelf packing: sort the boxes by height, place them left to right along a shelf, and start a new shelf above when the next one will not fit. The row width is about the square root of the total area (×1.15), so the layout comes out roughly square. A gap of ${fmt(margin)} between charts stops colours bleeding across when the texture is filtered.`,
    });
    trace.step({
      phase: 'Fit', label: `Scaled by 1/${fmt(size, 4)} into the square: the charts fill ${fmt(100 * used, 1)}% of it; a 1024² texture gives ${fmt(1024 / size, 1)} texels per unit of surface length`,
      detail: 'Last, the whole layout is scaled into [0, 1]². Every chart shrinks by the same factor, so texel density stays equal across the model. The unused part of the square is wasted texture memory.',
      values: [['layout size', fmt(size, 4)], ['square used', `${fmt(100 * used, 1)}%`], ['texels per unit length (1024²)', fmt(1024 / size, 1)]],
    });
  }
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
  const packed = pack(flat, 0.02, trace);
  const faces: UV[][] = mesh.faces.map((f) => f.map(() => [0, 0] as UV));
  cs.forEach((c, ci) => c.faces.forEach((fi, k) => { faces[fi] = c.corners[k].map((w) => packed[ci][w]); }));
  const layer = { faces };
  if (trace) {
    const dist = angleDistortion(mesh, layer);
    trace.step({
      phase: 'Result', label: `Charts scaled to their true area and packed into the unit square; mean angle distortion ${fmt(dist.reduce((a, b) => a + b, 0) / dist.length, 4)}`,
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

/**
 * The UVs of Catmull–Clark's new faces. Each face becomes one quad per corner:
 * (corner, edge point to the next corner, face point, edge point from the previous
 * corner), the same order `subdivide` makes its faces in.
 *
 * Linear (smooth = false): edge points are midpoints and corners stay, so the
 * texture is laid on the smoothed surface exactly as it was on the cage and slides
 * where the surface moves most.
 *
 * Smooth (Blender's "keep boundaries", the default): the UVs are subdivided with the
 * same rules as the surface, so the texture follows it. They are treated as a mesh of
 * their own. A UV vertex is the set of corners with the same mesh vertex AND the same
 * UV, so the two sides of a seam are separate vertices, and a seam is a boundary.
 * Boundary edges and vertices are kept linear: an island's outline does not shrink
 * or move, so textures still meet along seams.
 */
export function subdivideUV(uv: UVLayer, levels: number, mesh?: EditMesh, smooth = false, trace?: Trace): UVLayer {
  let faces = uv.faces, m = mesh;
  for (let l = 0; l < levels; l++) {
    faces = smooth && m ? smoothUVLevel(m, faces, l === 0 ? trace : undefined) : linearUVLevel(faces);
    if (m && l + 1 < levels) m = subdivide(m, 1);
  }
  return { faces };
}

function linearUVLevel(faces: UV[][]): UV[][] {
  const out: UV[][] = [];
  const mid = (a: UV, b: UV): UV => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  for (const f of faces) {
    const n = f.length, c: UV = [f.reduce((s, p) => s + p[0], 0) / n, f.reduce((s, p) => s + p[1], 0) / n];
    for (let i = 0; i < n; i++) out.push([f[i], mid(f[i], f[(i + 1) % n]), c, mid(f[(i - 1 + n) % n], f[i])]);
  }
  return out;
}

function smoothUVLevel(m: EditMesh, faces: UV[][], trace?: Trace): UV[][] {
  // 1. UV vertices: corners with the same mesh vertex and the same UV are one vertex.
  const ids = new Map<string, number>(), pos: UV[] = [];
  const corner = m.faces.map((f, fi) => f.map((v, k) => {
    const p = faces[fi][k], key = `${v}:${p[0].toFixed(9)}:${p[1].toFixed(9)}`;
    let id = ids.get(key);
    if (id === undefined) { id = pos.length; ids.set(key, id); pos.push([p[0], p[1]]); }
    return id;
  }));
  // 2. Face points, and the UV edges with the faces on each side.
  const facePt: UV[] = corner.map((f) => [f.reduce((s, i) => s + pos[i][0], 0) / f.length, f.reduce((s, i) => s + pos[i][1], 0) / f.length]);
  const ek = (a: number, b: number) => (a < b ? `${a}-${b}` : `${b}-${a}`);
  const edges = new Map<string, { a: number; b: number; faces: number[] }>();
  corner.forEach((f, fi) => f.forEach((a, k) => {
    const b = f[(k + 1) % f.length], key = ek(a, b);
    const e = edges.get(key);
    if (e) e.faces.push(fi); else edges.set(key, { a, b, faces: [fi] });
  }));
  // 3. Edge points: with a face on each side, the average of the two ends and the two face
  //    points; on a boundary (a seam or the mesh's edge), the midpoint.
  const edgePt = new Map<string, UV>();
  const boundary = new Set<number>();
  for (const [key, e] of edges) {
    const A = pos[e.a], B = pos[e.b];
    if (e.faces.length === 2) {
      const F1 = facePt[e.faces[0]], F2 = facePt[e.faces[1]];
      edgePt.set(key, [(A[0] + B[0] + F1[0] + F2[0]) / 4, (A[1] + B[1] + F1[1] + F2[1]) / 4]);
    } else {
      edgePt.set(key, [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2]);
      boundary.add(e.a); boundary.add(e.b);
    }
  }
  // 4. Vertex points: a boundary vertex stays; an interior one moves to (F̄ + 2R̄ + (n − 3)P) / n.
  const around = pos.map(() => ({ f: [] as number[], mids: [] as UV[] }));
  corner.forEach((f, fi) => f.forEach((i) => around[i].f.push(fi)));
  for (const e of edges.values()) {
    const mid: UV = [(pos[e.a][0] + pos[e.b][0]) / 2, (pos[e.a][1] + pos[e.b][1]) / 2];
    around[e.a].mids.push(mid); around[e.b].mids.push(mid);
  }
  const vertPt: UV[] = pos.map((P, i) => {
    if (boundary.has(i)) return P;
    const n = around[i].f.length;
    const Fb = around[i].f.reduce((s, fi) => [s[0] + facePt[fi][0] / n, s[1] + facePt[fi][1] / n], [0, 0]);
    const k = around[i].mids.length;
    const Rb = around[i].mids.reduce((s, q) => [s[0] + q[0] / k, s[1] + q[1] / k], [0, 0]);
    return [(Fb[0] + 2 * Rb[0] + (n - 3) * P[0]) / n, (Fb[1] + 2 * Rb[1] + (n - 3) * P[1]) / n];
  });
  if (trace) {
    const used = new Set(m.faces.flat()).size, f2 = (p: UV) => `(${fmt(p[0])}, ${fmt(p[1])})`;
    trace.step({
      phase: 'UV vertices', label: `${used} mesh vertices are ${pos.length} UV vertices: ${pos.length - used} extra copies where seams cut through`,
      detail: 'A UV vertex is a mesh vertex together with one UV. A vertex on a seam has a different UV on each side, so it becomes two (or more) UV vertices, and the seam becomes an open border of the UV mesh.',
      values: [['mesh vertices', String(used)], ['UV vertices', String(pos.length)]],
    });
    trace.step({
      phase: 'Borders kept', label: `${boundary.size} UV vertices on island outlines stay where they are; edges there get their midpoint`,
      detail: 'On an island\'s outline the UVs are not smoothed, so the outline does not shrink and the texture still meets itself across each seam.',
    });
    const inner = pos.findIndex((_, i) => !boundary.has(i) && around[i].f.length > 0);
    if (inner >= 0) {
      const n = around[inner].f.length;
      const Fb = around[inner].f.reduce((s, fi) => [s[0] + facePt[fi][0] / n, s[1] + facePt[fi][1] / n], [0, 0]) as UV;
      const k = around[inner].mids.length, Rb = around[inner].mids.reduce((s, q) => [s[0] + q[0] / k, s[1] + q[1] / k], [0, 0]) as UV;
      trace.step({
        phase: 'Inside points', label: `Inside an island the UVs move by the surface's own rule: UV vertex ${inner} → ${f2(vertPt[inner])}`,
        detail: 'Face points, edge points and vertex points, exactly as Catmull–Clark moves positions (lesson 6.2), but in the plane of the texture: (F̄ + 2R̄ + (n − 3)P) / n.',
        values: [['P', f2(pos[inner])], ['F̄', f2(Fb)], ['R̄', f2(Rb)], ['n', String(n)]],
        quiz: { prompt: `An inside UV vertex at ${f2(pos[inner])} has n = ${n}; the average of its face points is ${f2(Fb)} and of its edge midpoints ${f2(Rb)}. Where does it go?`, answer: vertPt[inner], labels: ['u', 'v'], rule: '(F̄ + 2R̄ + (n − 3)P) / n, in UV space.' },
      });
    }
  }
  // 5. The new faces, in subdivide's order.
  const out: UV[][] = [];
  corner.forEach((f, fi) => {
    const n = f.length;
    for (let i = 0; i < n; i++) {
      const a = f[i], next = f[(i + 1) % n], prev = f[(i - 1 + n) % n];
      out.push([vertPt[a], edgePt.get(ek(a, next))!, facePt[fi], edgePt.get(ek(prev, a))!]);
    }
  });
  return out;
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
    else if (mod.type === 'subsurf') { const lv = Math.min(maxLevels, Math.max(0, Math.round(mod.levels))); u = subdivideUV(u, lv, m, mod.uvSmooth !== false); m = subdivide(m, lv); }
  }
  return u;
}

/**
 * Subdivide a UV layer smoothly, traced, and compare the texture distortion it leaves on the subdivided surface
 * with linear UVs (Mesh › UV › Trace subdividing the UVs).
 */
export function traceUVSubdivision(mesh: EditMesh, uv: UVLayer, levels: number, trace?: Trace): { levels: number; linear: { mean: number; max: number }; smooth: { mean: number; max: number } } {
  const smoothUV = subdivideUV(uv, levels, mesh, true, trace), linearUV = subdivideUV(uv, levels);
  const surface = subdivide(mesh, levels);
  const stat = (u: UVLayer) => { const d = angleDistortion(surface, u); let s = 0, mx = 0; for (const x of d) { s += x; mx = Math.max(mx, x); } return { mean: s / d.length, max: mx }; };
  const lin = stat(linearUV), smo = stat(smoothUV);
  trace?.step({
    phase: 'Distortion', label: `On the surface subdivided ${levels}×: mean angle distortion ${fmt(lin.mean, 2)} with linear UVs, ${fmt(smo.mean, 2)} with smooth ones (1 is none)`,
    detail: 'Linear UVs keep the cage\'s texture layout while the surface moves under it, so the texture slides and stretches most where the surface moved most. Smooth UVs move with the surface, so squares on the texture stay closer to square.',
    values: [['mean, linear', fmt(lin.mean, 3)], ['mean, smooth', fmt(smo.mean, 3)], ['worst, linear', fmt(lin.max, 3)], ['worst, smooth', fmt(smo.max, 3)]],
  });
  return { levels, linear: lin, smooth: smo };
}
