// Measuring UV distortion (UV › Trace the distortion). Each triangle's UV map is linear: lay the triangle flat in its
// own plane (corner 0 at the origin, edge 0→1 along x), then the 2 × 2 Jacobian J takes those coordinates to UV.
// Its singular values σ₁ ≥ σ₂ are how much the map stretches the most- and least-stretched directions: σ₁/σ₂ is the
// angle distortion (1 = conformal), σ₁σ₂ = |det J| the area scale, and det J < 0 means the triangle is flipped.

import type { EditMesh, Vec3 } from './EditMesh';
import type { UV, UVLayer } from './uv';
import { Trace, fmt } from './trace';

export interface DistortionReport { sigma1: number; sigma2: number; ratio: number; area: number; flipped: boolean; meanRatio: number; worstRatio: number; flippedCount: number; areaSpread: number }

const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/** The Jacobian of one triangle's UV map, in the triangle's own frame, and the frame itself. */
export function triangleJacobian(p: [Vec3, Vec3, Vec3], t: [UV, UV, UV]): { J: [[number, number], [number, number]]; l1: number; d: number; h: number } {
  const e1 = sub(p[1], p[0]), e2 = sub(p[2], p[0]);
  const l1 = Math.hypot(...e1) || 1, x: Vec3 = [e1[0] / l1, e1[1] / l1, e1[2] / l1];
  const d = dot(e2, x), yv = sub(e2, [d * x[0], d * x[1], d * x[2]]), h = Math.hypot(...yv) || 1e-12;
  const du1 = t[1][0] - t[0][0], dv1 = t[1][1] - t[0][1], du2 = t[2][0] - t[0][0], dv2 = t[2][1] - t[0][1];
  const a = du1 / l1, c = dv1 / l1, b = (du2 - a * d) / h, dd = (dv2 - c * d) / h;
  return { J: [[a, b], [c, dd]], l1, d, h };
}

export function singularValues([[a, b], [c, d]]: [[number, number], [number, number]]): [number, number] {
  const s = a * a + b * b + c * c + d * d, t = Math.sqrt(Math.max(0, (a * a + b * b - c * c - d * d) ** 2 + 4 * (a * c + b * d) ** 2));
  return [Math.sqrt(Math.max(0, (s + t) / 2)), Math.sqrt(Math.max(0, (s - t) / 2))];
}

export function traceDistortion(mesh: EditMesh, layer: UVLayer, face: number, trace?: Trace): DistortionReport {
  const V = mesh.verts;
  // Every triangle (a fan per face) with its σ₁, σ₂ and det, for the whole-mesh step.
  let total3 = 0, totalUV = 0;
  const tris: { verts: number[]; s1: number; s2: number; det: number; area3: number }[] = [];
  mesh.faces.forEach((f, fi) => {
    for (let i = 1; i + 1 < f.length; i++) {
      const vs = [f[0], f[i], f[i + 1]], ts = [layer.faces[fi][0], layer.faces[fi][i], layer.faces[fi][i + 1]] as [UV, UV, UV];
      const P = vs.map((v) => V[v]) as [Vec3, Vec3, Vec3], { J } = triangleJacobian(P, ts), [s1, s2] = singularValues(J);
      const det = J[0][0] * J[1][1] - J[0][1] * J[1][0], e1 = sub(P[1], P[0]), e2 = sub(P[2], P[0]);
      const area3 = Math.hypot(e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]) / 2;
      tris.push({ verts: vs, s1, s2, det, area3 }); total3 += area3; totalUV += Math.abs(det) * area3;
    }
  });
  const ratios = tris.map((t) => (t.s2 > 1e-12 ? t.s1 / t.s2 : Infinity));
  const finite = ratios.filter(Number.isFinite);
  const meanRatio = finite.reduce((a, b) => a + b, 0) / (finite.length || 1), worstRatio = Math.max(...ratios);
  const flippedCount = tris.filter((t) => t.det < 0).length;
  // Area scale relative to the whole map's: 1 means this triangle gets its fair share of the texture.
  const fair = totalUV / (total3 || 1), rel = tris.map((t) => Math.abs(t.det) / (fair || 1)).filter((x) => x > 1e-12);
  const areaSpread = Math.max(...rel) / Math.min(...rel);
  const f = mesh.faces[face], ts = [layer.faces[face][0], layer.faces[face][1], layer.faces[face][2]] as [UV, UV, UV];
  const P = [V[f[0]], V[f[1]], V[f[2]]] as [Vec3, Vec3, Vec3];
  const { J, l1, d, h } = triangleJacobian(P, ts), [sigma1, sigma2] = singularValues(J);
  const det = J[0][0] * J[1][1] - J[0][1] * J[1][0], ratio = sigma2 > 1e-12 ? sigma1 / sigma2 : Infinity, area = Math.abs(det);
  if (trace) {
    trace.step({
      phase: 'Local frame', label: `Triangle v${f[0]}, v${f[1]}, v${f[2]} laid flat: (0, 0), (${fmt(l1, 4)}, 0), (${fmt(d, 4)}, ${fmt(h, 4)})`,
      detail: 'Put corner 0 at the origin and edge 0→1 along x, in the triangle\'s own plane: x along the edge, y at right angles to it in the plane. Now the triangle is a flat 2D triangle with the same lengths and angles as on the surface.',
      faces: [face], verts: f.slice(0, 3), values: [['edge 0→1 length', fmt(l1, 4)], ['corner 2', `(${fmt(d, 4)}, ${fmt(h, 4)})`]],
    }, V.length <= trace.snapshotLimit ? mesh : undefined);
    const du1 = ts[1][0] - ts[0][0];
    trace.step({
      phase: 'Jacobian', label: `J = [[${fmt(J[0][0], 4)}, ${fmt(J[0][1], 4)}], [${fmt(J[1][0], 4)}, ${fmt(J[1][1], 4)}]]`,
      detail: 'The map from the flat triangle to UV is linear, so it is a 2 × 2 matrix J with J·(edge in the frame) = (edge in UV) for both edges. Its first column is how UV changes per unit length along edge 0→1; the second, per unit length straight across it.',
      faces: [face],
      quiz: { prompt: `Edge v${f[0]}→v${f[1]} is ${fmt(l1, 4)} long on the surface and u changes by ${fmt(du1, 5)} along it. J's top-left entry a is how much u changes per unit length along that edge. What is a?`, answer: [J[0][0]], labels: ['a'], rule: 'a = Δu / length: the edge lies along the frame\'s x axis.', tolerance: Math.max(1e-4, 0.01 * Math.abs(J[0][0])) },
    });
    trace.step({
      phase: 'Singular values', label: `σ₁ = ${fmt(sigma1, 4)}, σ₂ = ${fmt(sigma2, 4)}: angle distortion σ₁/σ₂ = ${Number.isFinite(ratio) ? fmt(ratio, 4) : '∞'}, area scale σ₁σ₂ = ${fmt(area, 5)}${det < 0 ? ', flipped' : ''}`,
      detail: 'J takes a little circle to an ellipse; σ₁ and σ₂ are its two radii, the most and least stretch in any direction. They are the square roots of the eigenvalues of JᵀJ. Equal radii mean a circle stays a circle: angles are kept. Their product is |det J|, how much area is scaled; a negative det J means the triangle is mirrored in UV.',
      faces: [face], values: [['σ₁', fmt(sigma1, 4)], ['σ₂', fmt(sigma2, 4)], ['σ₁/σ₂', Number.isFinite(ratio) ? fmt(ratio, 4) : '∞'], ['σ₁σ₂ = |det J|', fmt(area, 5)]],
    });
    const field = new Float64Array(V.length), cnt = new Float64Array(V.length);
    tris.forEach((t, k) => { for (const v of t.verts) { field[v] += Math.min(Number.isFinite(ratios[k]) ? ratios[k] : 10, 10); cnt[v]++; } });
    trace.step({
      phase: 'Whole mesh', label: `${tris.length} triangles: angle distortion mean ${fmt(meanRatio, 4)}, worst ${Number.isFinite(worstRatio) ? fmt(worstRatio, 4) : '∞'}; area scale varies ${fmt(areaSpread, 3)}×; ${flippedCount} flipped`,
      detail: 'The same for every triangle. Angle distortion shows where squares turn into rectangles; the spread of area scale (each triangle\'s σ₁σ₂ against the map\'s average) shows where texels are larger or smaller than their fair share; flipped triangles show the texture mirrored. The heat map is each vertex\'s average angle distortion.',
      field: Array.from(field, (s, i) => (cnt[i] ? s / cnt[i] : 1)), fieldLabel: 'angle distortion σ₁/σ₂',
    });
  }
  return { sigma1, sigma2, ratio, area, flipped: det < 0, meanRatio, worstRatio, flippedCount, areaSpread };
}
