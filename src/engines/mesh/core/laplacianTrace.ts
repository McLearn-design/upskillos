// The Laplacian at one vertex, built up step by step (Mesh › Trace the Laplacian (one vertex)). The umbrella
// operator averages the neighbours with equal weights; the cotan operator weights edge i–j by ½(cot α + cot β), the
// angles facing it in its two triangles, and divides by the vertex's area (a third of the triangles round it). Applied
// to positions, the cotan Laplacian points along the normal with length 2H: twice the mean curvature (lesson 7.3).

import type { EditMesh, Vec3 } from './EditMesh';
import { triangles } from './geometry';
import { Trace, fmt, fmtV } from './trace';

const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a: Vec3, s: number): Vec3 => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = (a: Vec3) => Math.hypot(a[0], a[1], a[2]);
/** cot of the angle at c in triangle (a, b, c). */
const cotAt = (a: Vec3, b: Vec3, c: Vec3) => { const u = sub(a, c), w = sub(b, c); return dot(u, w) / (len(cross(u, w)) || 1e-300); };

export interface VertexLaplacian { neighbours: number[]; umbrella: Vec3; weights: number[]; area: number; cotan: Vec3; H: number }

export function traceVertexLaplacian(mesh: EditMesh, v: number, trace?: Trace): VertexLaplacian | string {
  const V = mesh.verts, P = V[v];
  const tris = triangles(mesh).filter((t) => t.includes(v));
  if (!tris.length) return `Vertex ${v} is on no face`;
  // For each neighbour j: the angles facing edge v–j, one per triangle containing it.
  const facing = new Map<number, number[]>();
  let area = 0;
  for (const t of tris) {
    const i = t.indexOf(v), j = t[(i + 1) % 3], k = t[(i + 2) % 3];
    area += len(cross(sub(V[j], P), sub(V[k], P))) / 2 / 3;
    for (const [nb, opp] of [[j, k], [k, j]] as const) {
      if (!facing.has(nb)) facing.set(nb, []);
      facing.get(nb)!.push(cotAt(P, V[nb], V[opp]));
    }
  }
  const neighbours = [...facing.keys()];
  const open = neighbours.some((j) => facing.get(j)!.length < 2);
  const umbrella = mul(neighbours.reduce<Vec3>((s, j) => add(s, sub(V[j], P)), [0, 0, 0]), 1 / neighbours.length);
  const weights = neighbours.map((j) => facing.get(j)!.reduce((s, c) => s + c, 0) / 2);
  const sum = neighbours.reduce<Vec3>((s, j, n) => add(s, mul(sub(V[j], P), weights[n])), [0, 0, 0]);
  const cotan = mul(sum, 1 / area);
  const H = len(cotan) / 2;
  if (trace) {
    trace.step({
      phase: 'Neighbours', label: `v${v}: ${neighbours.length} neighbours, ${tris.length} triangles round it${open ? ' (on an open edge: the rule assumes a closed fan)' : ''}`,
      detail: 'A Laplacian compares a vertex with its neighbours: the vertices joined to it by an edge (through the triangles the faces are drawn as).',
      verts: [v, ...neighbours],
    }, mesh.verts.length <= trace.snapshotLimit ? mesh : undefined);
    trace.step({
      phase: 'Umbrella', label: `Uniform weights: the average of (neighbour − v) is ${fmtV(umbrella)}`,
      detail: 'The umbrella operator gives every neighbour weight 1/n. It is what Mesh › Smooth vertices moves along (lesson 5.6). It ignores the shape of the triangles, so on uneven meshes it also slides vertices sideways.',
      arrows: [{ from: P, to: add(P, umbrella), label: 'umbrella', color: '#94a3b8' }],
    });
    // One edge in full, with a Predict question.
    const j = neighbours[0], cots = facing.get(j)!;
    const angles = cots.map((c) => (Math.atan2(1, c) * 180) / Math.PI);
    trace.step({
      phase: 'Cotan weights', label: `Edge ${v}–${j}: facing angles ${angles.map((a) => `${fmt(a, 1)}°`).join(' and ')}, weight ½(cot α + cot β) = ${fmt(weights[0], 4)}`,
      detail: 'Each edge is weighted by the cotangents of the two angles facing it. Long, thin triangles get small or negative weights; this choice makes the operator measure the surface itself, not how it was cut into triangles.',
      edges: [[v, j]], values: neighbours.map((nb, n) => [`edge ${v}–${nb}`, fmt(weights[n], 4)] as [string, string]),
      quiz: cots.length === 2 ? { prompt: `Edge ${v}–${j} faces the angles ${angles.map((a) => `${fmt(a, 2)}°`).join(' and ')} in its two triangles. What is its weight, ½(cot α + cot β)?`, answer: [weights[0]], labels: ['weight'], rule: 'w = ½ (cot α + cot β), cot θ = cos θ / sin θ.', tolerance: 0.005 } : undefined,
    });
    trace.step({
      phase: 'Area', label: `v${v}'s area: a third of each triangle round it, ${fmt(area, 4)} in all`,
      detail: 'The Laplacian is a density: the weighted sum is divided by the area the vertex stands for, so the result does not depend on how finely the surface is cut.',
      values: [['area A', fmt(area, 4)]],
    });
    trace.step({
      phase: 'Laplacian', label: `(1/A) Σ w (x_j − x_i) = ${fmtV(cotan)}: length ${fmt(len(cotan), 4)}, so mean curvature H ≈ ${fmt(H, 4)}`,
      detail: 'Applied to the positions themselves, the cotan Laplacian points along the surface normal (inward on a convex surface), with length 2H. That is how lesson 7.3 measures mean curvature.',
      arrows: [{ from: P, to: add(P, mul(cotan, 0.25)), label: 'Δx / 4', color: '#f59e0b' }],
      values: [['Δx', fmtV(cotan)], ['|Δx|', fmt(len(cotan), 4)], ['H = |Δx| / 2', fmt(H, 4)]],
    });
  }
  return { neighbours, umbrella, weights, area, cotan, H };
}
