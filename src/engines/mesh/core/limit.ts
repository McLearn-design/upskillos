// Where a vertex ends up after infinitely many Catmull–Clark steps. Once the faces round a vertex are all quads
// (after one step they always are), its limit position is a fixed weighted average of itself, its n edge
// neighbours e_j and its n diagonal neighbours f_j (the opposite corner of each quad):
//   v∞ = (n² v + 4 Σ e_j + Σ f_j) / (n (n + 5)).
// For n = 4 this is the bicubic B-spline's (1, 4, 1) ⊗ (1, 4, 1) / 36. The trace also subdivides a copy a few
// times, so you can watch the vertex approach the limit, and reports how fast the ring round it shrinks: by the
// scheme's subdominant eigenvalue λ(n) per step, ½ for a regular vertex.

import type { EditMesh, Vec3 } from './EditMesh';
import { catmullClark } from './subdivision';
import { Trace, fmt, fmtV } from './trace';

/** Catmull–Clark's subdominant eigenvalue at a vertex of valence n: how much the ring round it shrinks per step. */
export const ccLambda = (n: number) => (5 + Math.cos((2 * Math.PI) / n) + Math.cos(Math.PI / n) * Math.sqrt(18 + 2 * Math.cos((2 * Math.PI) / n))) / 16;

export function limitPosition(mesh: EditMesh, v: number, trace?: Trace): { limit: Vec3; n: number } | string {
  const around = mesh.faces.filter((f) => f.includes(v));
  if (!around.length) return `Vertex ${v} is on no face`;
  if (around.some((f) => f.length !== 4)) return 'The faces round this vertex are not all quads: subdivide once first (after one step they always are)';
  const edgeNb = new Set<number>(), diag = new Set<number>();
  for (const f of around) {
    const i = f.indexOf(v);
    edgeNb.add(f[(i + 1) % 4]); edgeNb.add(f[(i + 3) % 4]); diag.add(f[(i + 2) % 4]);
  }
  const n = edgeNb.size;
  if (n !== around.length) return 'This vertex is on an open edge: the limit rule here is for inside vertices';
  const sum = (ids: Set<number>): Vec3 => [...ids].reduce<Vec3>((s, x) => [s[0] + mesh.verts[x][0], s[1] + mesh.verts[x][1], s[2] + mesh.verts[x][2]], [0, 0, 0]);
  const E = sum(edgeNb), D = sum(diag), P = mesh.verts[v], w = n * (n + 5);
  const limit: Vec3 = [0, 1, 2].map((k) => { const x = (n * n * P[k] + 4 * E[k] + D[k]) / w; return Math.abs(x) < 1e-12 ? 0 : x; }) as Vec3;
  if (trace) {
    trace.step({
      phase: 'Neighbours', label: `v${v}: n = ${n}; ${n} edge neighbours, ${n} diagonal neighbours`,
      detail: 'Each quad round the vertex gives two edge neighbours (shared with the next quad) and one diagonal neighbour, the corner opposite.',
      verts: [v, ...edgeNb, ...diag],
      values: [['v', fmtV(P)], ['Σ edge neighbours', fmtV(E)], ['Σ diagonal neighbours', fmtV(D)]],
    }, mesh.verts.length <= trace.snapshotLimit ? mesh : undefined);
    trace.step({
      phase: 'Limit', label: `v∞ = (${n * n} v + 4 Σ e + Σ f) / ${w} = ${fmtV(limit)}`,
      detail: `Weights ${n * n}/${w} on the vertex, 4/${w} on each edge neighbour, 1/${w} on each diagonal one: they add up to 1. For a regular vertex (n = 4) this is the bicubic B-spline: 16/36, 4/36, 1/36.`,
      points: [{ p: P, label: `v${v}`, color: '#38bdf8' }, { p: limit, label: 'limit', color: '#f59e0b' }],
      quiz: { prompt: `v${v} = ${fmtV(P)} has n = ${n}; its edge neighbours add up to ${fmtV(E)} and its diagonal neighbours to ${fmtV(D)}. Where is its limit position?`, answer: limit, labels: ['x', 'y', 'z'], rule: 'v∞ = (n² v + 4 Σ e + Σ f) / (n (n + 5)).' },
    });
    // Watch it approach: subdivide a copy (old vertices keep their numbers) and measure the gap and the ring.
    let m = mesh;
    const ring = (mm: EditMesh) => { const nb = new Set<number>(); for (const f of mm.faces) { const i = f.indexOf(v); if (i >= 0) { nb.add(f[(i + 1) % f.length]); nb.add(f[(i + 3) % f.length]); } } return [...nb].reduce((s, x) => s + Math.hypot(mm.verts[x][0] - mm.verts[v][0], mm.verts[x][1] - mm.verts[v][1], mm.verts[x][2] - mm.verts[v][2]), 0) / nb.size; };
    let prev = ring(m);
    const rows: [string, string][] = [];
    for (let level = 1; level <= 4 && m.faces.length * 4 <= 60000; level++) {
      m = catmullClark(m);
      const r = ring(m), gap = Math.hypot(m.verts[v][0] - limit[0], m.verts[v][1] - limit[1], m.verts[v][2] - limit[2]);
      rows.push([`after ${level} more`, `${fmtV(m.verts[v])}, ${fmt(gap, 5)} from the limit; ring × ${fmt(r / prev, 4)}`]);
      prev = r;
    }
    trace.step({
      phase: 'Levels', label: `Subdivided again: the vertex closes in on ${fmtV(limit)}; the ring round it shrinks towards × ${fmt(ccLambda(n), 4)} a step`,
      detail: `A regular vertex's ring halves each step. At valence ${n} it shrinks by λ(${n}) = ${fmt(ccLambda(n), 4)} instead${n === 4 ? '' : n < 4 ? ': faster, so the quads round it end up smaller than their neighbours' : ': slower, so the quads round it stay stretched compared with the rest, which shows as pinching and wobbles in highlights'}.`,
      values: rows,
    });
  }
  return { limit, n };
}
