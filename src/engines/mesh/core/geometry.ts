// Geometry processing on meshes: the discrete Laplacian and what it gives.
//
// Everything here works on triangles, with the vertex numbers of the mesh you
// edit, so values come out one per vertex. A quad can be cut into two triangles
// along either diagonal, and the choice matters: always cutting the same way
// biases the weights, and curvature then alternates from vertex to vertex. So
// each k-sided face is used as the average of all k of its fan triangulations
// (for a quad, both diagonals, each at weight ½). A triangle is used once.
//
//   cotan weights   w_ij = ½ (cot α_ij + cot β_ij), α and β the angles opposite edge ij
//   stiffness C     (C u)_i = Σ_j w_ij (u_i − u_j)       symmetric, positive semi-definite
//   mass M          M_i = ⅓ · area of the triangles around i  (lumped, barycentric)
//   Laplacian       Δu ≈ −M⁻¹ C u
//
// From these: mean curvature (the Laplacian of the position), Gaussian
// curvature (angle defect), smoothing, and distance along the surface by the
// heat method (Crane, Weischedel & Wardetzky 2013), which is two linear solves.

import type { EditMesh, Vec3 } from './EditMesh';
import { Trace, fmt, fmtV } from './trace';
import { faceTriangles } from './triangulate';

const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = (a: Vec3) => Math.hypot(a[0], a[1], a[2]);

export type Tri = [number, number, number];

/** Every distinct fan triangulation of every face, weighted equally, so no diagonal is preferred. */
export function weightedTriangles(mesh: EditMesh): { tris: Tri[]; weights: Float64Array; primary: Uint8Array } {
  const tris: Tri[] = [], w: number[] = [], primary: number[] = [];
  for (const f of mesh.faces) {
    const k = f.length;
    if (k === 3) { tris.push([f[0], f[1], f[2]]); w.push(1); primary.push(1); continue; }
    // A quad's fans from opposite corners are the same cut, so it has just two.
    const fans = k === 4 ? 2 : k;
    for (let r = 0; r < fans; r++) for (let i = 1; i + 1 < k; i++) { tris.push([f[r], f[(r + i) % k], f[(r + i + 1) % k]]); w.push(1 / fans); primary.push(r === 0 ? 1 : 0); }
  }
  return { tris, weights: Float64Array.from(w), primary: Uint8Array.from(primary) };
}

/** One triangulation per face (a fan, or ear clipping if concave): what is drawn, and what iso-lines are traced on. */
export function triangles(mesh: EditMesh): [number, number, number][] {
  const out: [number, number, number][] = [];
  for (const f of mesh.faces) for (const [a, b, c] of faceTriangles(mesh.verts, f)) out.push([f[a], f[b], f[c]]);
  return out;
}

/** cot of the angle at c in triangle (a, b, c): (u·v) / |u × v| with u = a − c, v = b − c. */
export function cotAt(a: Vec3, b: Vec3, c: Vec3): number {
  const u = sub(a, c), v = sub(b, c);
  const s = len(cross(u, v));
  return s < 1e-15 ? 0 : dot(u, v) / s;
}

/** A symmetric sparse matrix as a row map. */
export class Sparse {
  rows: Map<number, number>[];
  constructor(public n: number) { this.rows = Array.from({ length: n }, () => new Map()); }
  add(i: number, j: number, v: number): void { this.rows[i].set(j, (this.rows[i].get(j) ?? 0) + v); }
  get(i: number, j: number): number { return this.rows[i].get(j) ?? 0; }
  mul(x: ArrayLike<number>, out = new Float64Array(this.n)): Float64Array {
    for (let i = 0; i < this.n; i++) { let s = 0; for (const [j, v] of this.rows[i]) s += v * x[j]; out[i] = s; }
    return out;
  }
  diag(): Float64Array { return Float64Array.from({ length: this.n }, (_, i) => this.get(i, i)); }
  /** this + s·D for a diagonal D. */
  plusDiag(d: ArrayLike<number>, s = 1): Sparse {
    const r = new Sparse(this.n);
    this.rows.forEach((row, i) => row.forEach((v, j) => r.add(i, j, v)));
    for (let i = 0; i < this.n; i++) r.add(i, i, s * d[i]);
    return r;
  }
  scaled(s: number): Sparse { const r = new Sparse(this.n); this.rows.forEach((row, i) => row.forEach((v, j) => r.add(i, j, s * v))); return r; }
}

export interface Operators { tris: Tri[]; weights: Float64Array; /** 1 for the triangles of one fan per face (for drawing). */ primary: Uint8Array; C: Sparse; mass: Float64Array; triArea: Float64Array }

/** The cotan stiffness matrix C and the lumped mass M of a mesh. */
export function operators(mesh: EditMesh, trace?: Trace): Operators {
  const V = mesh.verts, n = V.length, { tris, weights, primary } = weightedTriangles(mesh);
  const C = new Sparse(n), mass = new Float64Array(n), triArea = new Float64Array(tris.length);
  let shown = 0;
  tris.forEach(([a, b, c], t) => {
    const A = len(cross(sub(V[b], V[a]), sub(V[c], V[a]))) / 2;
    triArea[t] = A;
    for (const v of [a, b, c]) mass[v] += (weights[t] * A) / 3;
    // Each corner's cot weights the edge opposite it.
    for (const [i, j, k] of [[a, b, c], [b, c, a], [c, a, b]] as const) {
      const w = (weights[t] * cotAt(V[i], V[j], V[k])) / 2;
      C.add(i, j, -w); C.add(j, i, -w); C.add(i, i, w); C.add(j, j, w);
      if (trace && shown < 3 && weights[t] === weights[0] && trace.detailed(1)) {
        shown++;
        trace.step({
          phase: 'Cotan weights', label: `Angle at v${k} is ${fmt((Math.atan2(len(cross(sub(V[i], V[k]), sub(V[j], V[k]))), dot(sub(V[i], V[k]), sub(V[j], V[k]))) * 180) / Math.PI, 1)}°: edge ${i}–${j} gets ½·cot = ${fmt(w)}`,
          detail: `The weight of an edge is ½(cot α + cot β), the cotangents of the two angles facing it. Flat, well-shaped triangles give positive weights; very obtuse ones make them negative.${weights[t] < 1 ? ` This triangle is one of the fan triangulations of a ${Math.round(1 / weights[t])}-sided face, so it counts ×${fmt(weights[t])}.` : ''}`,
          edges: [[i, j]], verts: [k],
        });
      }
    }
  });
  trace?.step({
    phase: 'Cotan weights', label: `${n}×${n} matrix C with ${C.rows.reduce((s, r) => s + r.size, 0)} non-zeros; mass M = ⅓ of the area around each vertex`,
    detail: '(C u)_i = Σ_j w_ij (u_i − u_j): how much u at a vertex differs from its neighbours, weighted by geometry. It is the discrete Laplace–Beltrami operator, up to the mass.',
    field: Array.from(mass), fieldLabel: 'vertex mass (area)',
  });
  return { tris, weights, primary, C, mass, triArea };
}

/** Preconditioned conjugate gradients for a symmetric positive (semi-)definite system. */
export function solveCG(A: Sparse, b: ArrayLike<number>, { tol = 1e-10, maxIter = 2000, x0, onIter }: { tol?: number; maxIter?: number; x0?: ArrayLike<number>; onIter?: (k: number, res: number) => void } = {}): { x: Float64Array; iterations: number; residual: number } {
  const n = A.n, x = Float64Array.from(x0 ?? new Float64Array(n));
  const D = A.diag().map((d) => (Math.abs(d) > 1e-300 ? 1 / d : 1));
  const r = Float64Array.from(b); const Ax = A.mul(x); for (let i = 0; i < n; i++) r[i] -= Ax[i];
  const z = r.map((v, i) => v * D[i]), p = Float64Array.from(z), Ap = new Float64Array(n);
  let rz = r.reduce((s, v, i) => s + v * z[i], 0);
  const bn = Math.sqrt(Array.from(b).reduce((s, v) => s + v * v, 0)) || 1;
  let k = 0, res = Math.sqrt(r.reduce((s, v) => s + v * v, 0)) / bn;
  while (k < maxIter && res > tol) {
    A.mul(p, Ap);
    const pAp = p.reduce((s, v, i) => s + v * Ap[i], 0);
    if (Math.abs(pAp) < 1e-300) break;
    const alpha = rz / pAp;
    for (let i = 0; i < n; i++) { x[i] += alpha * p[i]; r[i] -= alpha * Ap[i]; }
    for (let i = 0; i < n; i++) z[i] = r[i] * D[i];
    const rz2 = r.reduce((s, v, i) => s + v * z[i], 0);
    const beta = rz2 / rz; rz = rz2;
    for (let i = 0; i < n; i++) p[i] = z[i] + beta * p[i];
    k++;
    res = Math.sqrt(r.reduce((s, v) => s + v * v, 0)) / bn;
    onIter?.(k, res);
  }
  return { x, iterations: k, residual: res };
}

/** Interior angle sum at each vertex, and whether it is on a boundary. */
function angleSums(mesh: EditMesh, tris: Tri[], weights: Float64Array): { sum: Float64Array; boundary: Uint8Array } {
  const V = mesh.verts, sum = new Float64Array(V.length), boundary = new Uint8Array(V.length);
  tris.forEach(([a, b, c], t) => { for (const [i, j, k] of [[a, b, c], [b, c, a], [c, a, b]] as const) {
    const u = sub(V[j], V[i]), v = sub(V[k], V[i]);
    sum[i] += weights[t] * Math.atan2(len(cross(u, v)), dot(u, v));
  } });
  for (const e of mesh.edges().values()) if (e.faces.length === 1) { boundary[e.a] = 1; boundary[e.b] = 1; }
  return { sum, boundary };
}

/**
 * Gaussian curvature by angle defect: K_i = (2π − Σθ) / M_i (π − Σθ on a boundary).
 * Summed over a closed surface, K·M gives exactly 2π times the Euler characteristic
 * (Gauss–Bonnet): the defects of a cube's corners are π/2 each, 8 × π/2 = 4π.
 */
export function gaussianCurvature(mesh: EditMesh, { integrated = false } = {}): Float64Array {
  const { tris, weights, mass } = operators(mesh);
  const { sum, boundary } = angleSums(mesh, tris, weights);
  return Float64Array.from(sum, (s, i) => { const d = (boundary[i] ? Math.PI : 2 * Math.PI) - s; return integrated ? d : mass[i] > 1e-15 ? d / mass[i] : 0; });
}

/**
 * Mean curvature from the Laplacian of position: Δx = −2H·n. Returns signed H
 * (positive where the surface bulges outward, 1/r on a sphere of radius r).
 */
export function meanCurvature(mesh: EditMesh): Float64Array {
  const { C, mass } = operators(mesh);
  const V = mesh.verts, H = new Float64Array(V.length);
  for (let i = 0; i < V.length; i++) {
    if (mass[i] < 1e-15) continue;
    let h: Vec3 = [0, 0, 0];
    for (const [j, w] of C.rows[i]) h = [h[0] + w * V[j][0], h[1] + w * V[j][1], h[2] + w * V[j][2]];
    // (C x)_i / (2 M_i) points outward with length H.
    const Hn: Vec3 = [h[0] / (2 * mass[i]), h[1] / (2 * mass[i]), h[2] / (2 * mass[i])];
    const s = Math.sign(dot(Hn, mesh.vertexNormal(i))) || 1;
    H[i] = s * len(Hn);
  }
  return H;
}

/** Mean edge length: the natural length scale of a mesh. */
export function meanEdge(mesh: EditMesh): number {
  let s = 0, n = 0;
  for (const e of mesh.edges().values()) { s += len(sub(mesh.verts[e.a], mesh.verts[e.b])); n++; }
  return n ? s / n : 1;
}

/**
 * Distance along the surface from the source vertices, by the heat method:
 *   1. let heat flow from the sources for a short time t:  (M + t C) u = δ
 *   2. take the direction heat flows, normalised:          X = −∇u / |∇u|   (per triangle)
 *   3. find the function whose gradient best matches X:    C φ = −∇·X
 * φ, shifted so the sources are at 0, is the distance. Only its direction is
 * kept from step 1, which is why a crude, blurry u still gives accurate distances.
 */
export function heatGeodesic(mesh: EditMesh, sources: number[], trace?: Trace, { tFactor = 1 } = {}): Float64Array {
  const V = mesh.verts, n = V.length;
  if (!sources.length) return new Float64Array(n);
  const ops = operators(mesh, trace);
  const { tris, weights, primary, C, mass } = ops;
  const h = meanEdge(mesh), t = tFactor * h * h;

  // 1. Heat flow: implicit Euler step from a spike at the sources.
  const delta = new Float64Array(n); for (const s of sources) delta[s] = 1;
  const heat = solveCG(C.scaled(t).plusDiag(mass), delta, { tol: 1e-12 });
  const u = heat.x;
  trace?.step({
    phase: 'Heat flow', label: `Solve (M + t·C) u = δ with t = h² = ${fmt(t, 4)}: ${heat.iterations} CG iterations`,
    detail: `Heat starts at ${sources.length} source vertex/vertices and spreads for a short time. One backward-Euler step of the heat equation ∂u/∂t = Δu is a linear system; h = ${fmt(h)} is the mean edge length.`,
    verts: sources, field: Array.from(u), fieldLabel: 'heat u (log scale)', fieldLog: true,
  });

  // 2. Normalised gradient per triangle.
  const X: Vec3[] = tris.map(([a, b, c]) => {
    const N0 = cross(sub(V[b], V[a]), sub(V[c], V[a])), A2 = len(N0);
    if (A2 < 1e-15) return [0, 0, 0];
    const N: Vec3 = [N0[0] / A2, N0[1] / A2, N0[2] / A2];
    // ∇u = (1 / 2A) Σ u_i (N × e_i), e_i the edge opposite vertex i, counter-clockwise.
    let g: Vec3 = [0, 0, 0];
    for (const [i, j, k] of [[a, b, c], [b, c, a], [c, a, b]] as const) {
      const e = sub(V[k], V[j]), ne = cross(N, e);
      g = [g[0] + u[i] * ne[0], g[1] + u[i] * ne[1], g[2] + u[i] * ne[2]];
    }
    const gl = len(g);
    return gl < 1e-300 ? [0, 0, 0] : [-g[0] / gl, -g[1] / gl, -g[2] / gl];
  });
  if (trace) {
    const drawn = tris.map((_, i) => i).filter((i) => primary[i]);
    const every = Math.max(1, Math.floor(drawn.length / 150));
    const scale = h * 1.1;
    trace.step({
      phase: 'Gradient field', label: `${tris.length} unit vectors X = −∇u / |∇u|, one per triangle${drawn.length < tris.length ? ` (both diagonals of each quad; ${drawn.length} drawn)` : ''}`,
      detail: 'Heat decreases away from the sources, so −∇u points away from them. Normalising throws away how much heat arrived and keeps only the direction: the direction of increasing distance.',
      arrows: drawn.filter((_, k) => k % every === 0).map((i) => {
        const [a, b, c] = tris[i], ctr: Vec3 = [(V[a][0] + V[b][0] + V[c][0]) / 3, (V[a][1] + V[b][1] + V[c][1]) / 3, (V[a][2] + V[b][2] + V[c][2]) / 3];
        return { from: ctr, to: [ctr[0] + X[i][0] * scale, ctr[1] + X[i][1] * scale, ctr[2] + X[i][2] * scale], color: '#38bdf8' };
      }),
      field: Array.from(u), fieldLabel: 'heat u (log scale)', fieldLog: true,
    });
  }

  // 3. Integrated divergence at each vertex: ½ Σ cot θ₁ (e₁·X) + cot θ₂ (e₂·X).
  const div = new Float64Array(n);
  tris.forEach(([a, b, c], ti) => {
    const Xt = X[ti];
    for (const [i, j, k] of [[a, b, c], [b, c, a], [c, a, b]] as const) {
      const e1 = sub(V[j], V[i]), e2 = sub(V[k], V[i]);
      div[i] += 0.5 * weights[ti] * (cotAt(V[i], V[j], V[k]) * dot(e1, Xt) + cotAt(V[i], V[k], V[j]) * dot(e2, Xt));
    }
  });
  trace?.step({
    phase: 'Divergence', label: `∇·X at every vertex (they sum to ${fmt(div.reduce((s, v) => s + v, 0), 6)})`,
    detail: 'How much the unit field flows out of each vertex\'s neighbourhood. For a true distance field it is the Laplacian of the distance, so the last step inverts the Laplacian.',
    field: Array.from(div), fieldLabel: '∇·X', fieldDiverging: true,
  });

  // 4. Poisson: C φ = −div, regularised by a tiny multiple of M to pin the constant.
  const residuals: number[] = [];
  const poisson = solveCG(C.plusDiag(mass, 1e-8), Float64Array.from(div, (d) => -d), { tol: 1e-10, onIter: (k, r) => { if (k % 5 === 0) residuals.push(r); } });
  const phi = poisson.x;
  const base = Math.min(...sources.map((s) => phi[s]));
  for (let i = 0; i < n; i++) phi[i] -= base;
  trace?.step({
    phase: 'Poisson solve', label: `Solve C φ = −∇·X: ${poisson.iterations} CG iterations, residual ${poisson.residual.toExponential(1)}`,
    detail: `Conjugate gradients: each iteration moves along a new direction that is C-orthogonal to all the previous ones. Residual every 5 iterations: ${residuals.slice(0, 8).map((r) => r.toExponential(0)).join(', ')}${residuals.length > 8 ? ' …' : ''}. Shift so the sources are at 0: φ is the distance.`,
    verts: sources, field: Array.from(phi), fieldLabel: 'geodesic distance', contours: 12,
  });
  return phi;
}

/**
 * Laplacian smoothing, explicit: each step moves every vertex a fraction λ of
 * the way to the average of its neighbours (uniform "umbrella" weights, as in
 * Blender's Smooth Vertices) or to the cotan-weighted average. Boundary vertices
 * stay put. Returns how far each vertex moved in total.
 */
export function smooth(mesh: EditMesh, { iterations = 1, lambda = 0.5, method = 'uniform' as 'uniform' | 'cotan', only }: { iterations?: number; lambda?: number; method?: 'uniform' | 'cotan'; only?: number[] } = {}, trace?: Trace): Float64Array {
  const n = mesh.verts.length;
  const start = mesh.verts.map((v) => [...v] as Vec3);
  const boundary = new Uint8Array(n);
  for (const e of mesh.edges().values()) if (e.faces.length === 1) { boundary[e.a] = 1; boundary[e.b] = 1; }
  const movable = only ? new Set(only) : null;
  const nb: number[][] = Array.from({ length: n }, () => []);
  for (const e of mesh.edges().values()) { nb[e.a].push(e.b); nb[e.b].push(e.a); }
  for (let it = 0; it < iterations; it++) {
    const V = mesh.verts;
    const W = method === 'cotan' ? operators(mesh).C : null;
    const next = V.map((p, i) => {
      if (boundary[i] || (movable && !movable.has(i)) || !nb[i].length) return p;
      let avg: Vec3 = [0, 0, 0], wsum = 0;
      for (const j of nb[i]) {
        const w = W ? Math.max(0, -W.get(i, j)) : 1;
        avg = [avg[0] + w * V[j][0], avg[1] + w * V[j][1], avg[2] + w * V[j][2]]; wsum += w;
      }
      if (wsum < 1e-15) return p;
      avg = [avg[0] / wsum, avg[1] / wsum, avg[2] / wsum];
      return [p[0] + lambda * (avg[0] - p[0]), p[1] + lambda * (avg[1] - p[1]), p[2] + lambda * (avg[2] - p[2])] as Vec3;
    });
    const moved = next.map((p, i) => len(sub(p, V[i])));
    if (trace && it === 0) {
      // One vertex in full, the one that moves most: its neighbours, their average, and the step towards it.
      const i = moved.indexOf(Math.max(...moved));
      if (moved[i] > 0) {
        let avg: Vec3 = [0, 0, 0];
        for (const j of nb[i]) avg = [avg[0] + V[j][0], avg[1] + V[j][1], avg[2] + V[j][2]];
        avg = [avg[0] / nb[i].length, avg[1] / nb[i].length, avg[2] / nb[i].length];
        trace.step({
          phase: 'Smoothing', label: `v${i}: ${nb[i].length} neighbours${method === 'uniform' ? `, average ${fmtV(avg)}` : ''}; it moves ${fmt(moved[i], 4)}, the most of any vertex`,
          detail: 'Each vertex steps the fraction λ of the way from where it is to the average of its neighbours: x ← x + λ (x̄ − x). Vertices on an open edge stay put, so the outline keeps its shape.',
          verts: [i, ...nb[i]], points: [{ p: V[i], label: `v${i}`, color: '#38bdf8' }, { p: next[i], color: '#f59e0b' }],
          values: [['x', fmtV(V[i])], ['neighbours', nb[i].map((j) => `v${j}`).join(', ')], ['λ', fmt(lambda)]],
          quiz: method === 'uniform' ? { prompt: `v${i} is at ${fmtV(V[i])}; the average of its ${nb[i].length} neighbours is ${fmtV(avg)}. Where is it after one step with λ = ${fmt(lambda)}?`, answer: next[i], labels: ['x', 'y', 'z'], rule: 'x + λ (x̄ − x): the fraction λ of the way to the neighbours\' average.' } : undefined,
        });
      }
    }
    mesh.verts = next;
    mesh.touch();
    if (trace && trace.detailed(1)) {
      trace.step({
        phase: 'Smoothing', label: `Step ${it + 1}: average move ${fmt(moved.reduce((s, v) => s + v, 0) / n, 4)}, largest ${fmt(Math.max(...moved), 4)}`,
        detail: `x_i ← x_i + λ (x̄_i − x_i), λ = ${fmt(lambda)}, x̄_i the ${method === 'uniform' ? 'plain' : 'cotan-weighted'} average of the neighbours. This is one explicit step of the heat equation applied to the positions: bumps flatten fastest.`,
        field: moved, fieldLabel: 'distance moved this step',
      }, mesh);
    }
  }
  return Float64Array.from(mesh.verts, (p, i) => len(sub(p, start[i])));
}

/**
 * Iso-lines of a per-vertex field: on each triangle, linear interpolation finds
 * where the field crosses each level (marching triangles). Returns segments.
 */
export function contours(mesh: EditMesh, values: ArrayLike<number>, levels: number[]): [Vec3, Vec3][] {
  const V = mesh.verts, out: [Vec3, Vec3][] = [];
  const lerp = (a: number, b: number, L: number): Vec3 => { const t = (L - values[a]) / (values[b] - values[a]); return [V[a][0] + t * (V[b][0] - V[a][0]), V[a][1] + t * (V[b][1] - V[a][1]), V[a][2] + t * (V[b][2] - V[a][2])]; };
  for (const [a, b, c] of triangles(mesh)) for (const L of levels) {
    const pts: Vec3[] = [];
    for (const [i, j] of [[a, b], [b, c], [c, a]] as const) if ((values[i] < L) !== (values[j] < L)) pts.push(lerp(i, j, L));
    if (pts.length === 2) out.push([pts[0], pts[1]]);
  }
  return out;
}

/** Evenly spaced levels strictly inside [min, max]. */
export function levelsFor(values: ArrayLike<number>, count: number): number[] {
  let lo = Infinity, hi = -Infinity;
  for (let i = 0; i < values.length; i++) { lo = Math.min(lo, values[i]); hi = Math.max(hi, values[i]); }
  if (!(hi > lo)) return [];
  return Array.from({ length: count }, (_, i) => lo + ((i + 1) * (hi - lo)) / (count + 1));
}
