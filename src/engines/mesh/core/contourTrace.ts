// Level sets: the iso-line where a per-vertex field equals one value (Heat map › Trace the iso-lines). The field is
// linear across each triangle, so the line is straight inside it: classify the corners as above or below the level,
// find where the level crosses each edge whose ends disagree, t = (L − a) / (b − a), and join the two crossings with
// a segment. Segments that share a crossing point are joined into chains: closed loops, or open chains that end on
// the mesh's boundary. Every triangle is crossed twice or not at all, so the chains never branch.

import type { EditMesh, Vec3 } from './EditMesh';
import { triangles } from './geometry';
import { Trace, fmt, fmtV } from './trace';

export interface ContourReport { level: number; above: number; crossed: number; segments: [Vec3, Vec3][]; loops: number; open: number; length: number }

const dist = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

export function traceContour(mesh: EditMesh, values: ArrayLike<number>, level: number, trace?: Trace): ContourReport {
  const V = mesh.verts, tris = triangles(mesh);
  // "Above" means at or above: a vertex exactly at the level counts as above, so every edge is crossed 0 or 1 times.
  const up = Array.from(V, (_, i) => values[i] >= level);
  const above = up.filter(Boolean).length;
  const key = (a: number, b: number) => (a < b ? `${a},${b}` : `${b},${a}`);
  const at = (a: number, b: number): Vec3 => {
    const t = (level - values[a]) / (values[b] - values[a]);
    return [V[a][0] + t * (V[b][0] - V[a][0]), V[a][1] + t * (V[b][1] - V[a][1]), V[a][2] + t * (V[b][2] - V[a][2])];
  };
  if (trace) {
    trace.step({
      phase: 'Classify', label: `Level ${fmt(level, 4)}: ${above} vertices at or above it, ${V.length - above} below`,
      detail: 'The iso-line separates the vertices whose value is at least the level from the rest: it is the edge of the region a threshold at this level would flag. Each vertex is tested once.',
      verts: up.flatMap((u, i) => (u ? [i] : [])).slice(0, 2000), field: Array.from(values), fieldLabel: 'the field',
    }, V.length <= trace.snapshotLimit ? mesh : undefined);
  }
  const segments: [Vec3, Vec3][] = [], ends: [string, string][] = [];
  const points = new Map<string, Vec3>();
  let shown = false;
  for (const [a, b, c] of tris) {
    const cut: [number, number][] = [];
    for (const [i, j] of [[a, b], [b, c], [c, a]] as const) if (up[i] !== up[j]) cut.push([i, j]);
    if (cut.length !== 2) continue;
    const ps = cut.map(([i, j]) => { const k = key(i, j); if (!points.has(k)) points.set(k, at(i, j)); return points.get(k)!; });
    segments.push([ps[0], ps[1]]);
    ends.push([key(...cut[0]), key(...cut[1])]);
    if (trace && !shown) {
      shown = true;
      const [i, j] = cut[0], t = (level - values[i]) / (values[j] - values[i]);
      trace.step({
        phase: 'One triangle', label: `Triangle ${a}, ${b}, ${c}: values ${[a, b, c].map((v) => fmt(values[v], 4)).join(', ')}; edges ${cut.map(([x, y]) => `${x}–${y}`).join(' and ')} are crossed`,
        detail: `Two corners on one side, one on the other: exactly two edges have ends that disagree. On edge ${i}–${j} the field goes from ${fmt(values[i], 4)} to ${fmt(values[j], 4)} linearly, so it equals ${fmt(level, 4)} at t = (L − a)/(b − a) = ${fmt(t, 4)} of the way along: the point ${fmtV(ps[0])}. The segment joins the two crossings.`,
        verts: [a, b, c], edges: cut, points: [{ p: ps[0], label: `t = ${fmt(t, 3)}`, color: '#facc15' }, { p: ps[1], color: '#facc15' }], lines: [[ps[0], ps[1]]],
        quiz: { prompt: `On edge ${i}–${j} the field is ${fmt(values[i], 4)} at v${i} and ${fmt(values[j], 4)} at v${j}. What fraction t of the way from v${i} to v${j} does it equal the level ${fmt(level, 4)}?`, answer: [t], labels: ['t'], rule: 't = (L − a)/(b − a): the field is linear along the edge.', tolerance: 0.01 },
      });
    }
  }
  // Join segments that share a crossing point. Each crossing is on one edge, shared by at most two triangles, so a
  // point has one segment (a chain's end, on the boundary) or two.
  const byPoint = new Map<string, number[]>();
  ends.forEach(([p, q], s) => { for (const k of [p, q]) { const l = byPoint.get(k); if (l) l.push(s); else byPoint.set(k, [s]); } });
  const used = new Uint8Array(segments.length);
  let loops = 0, open = 0;
  const walk = (s0: number, from: string) => {
    let s = s0, k = from;
    for (;;) {
      used[s] = 1;
      const next = ends[s][0] === k ? ends[s][1] : ends[s][0];
      const t = (byPoint.get(next) ?? []).find((x) => !used[x]);
      if (t === undefined) return next;
      s = t; k = next;
    }
  };
  // Open chains first, starting from an end (a point with one segment); what is left is closed loops.
  for (const [k, l] of byPoint) if (l.length === 1 && !used[l[0]]) { walk(l[0], k); open++; }
  for (let s = 0; s < segments.length; s++) if (!used[s]) { walk(s, ends[s][0]); loops++; }
  const length = segments.reduce((sum, [p, q]) => sum + dist(p, q), 0);
  if (trace) {
    trace.step({
      phase: 'Every triangle', label: `${segments.length} of ${tris.length} triangles are crossed; the rest have all three corners on one side`,
      detail: 'Three corners, two sides: either all agree (no segment) or two agree and one does not (two crossed edges, one segment). There is never a branch, so the segments join into simple chains.',
      lines: segments, field: Array.from(values), fieldLabel: 'the field',
    });
    trace.step({
      phase: 'Join', label: `${loops} closed loop${loops === 1 ? '' : 's'} and ${open} open chain${open === 1 ? '' : 's'}; total length ${fmt(length, 4)}`,
      detail: 'Segments in neighbouring triangles share the crossing point on their shared edge, so they join end to end. A chain that comes back to its start is a closed loop; one that runs into the mesh\'s boundary is open.',
      lines: segments, values: [['level', fmt(level, 4)], ['segments', String(segments.length)], ['loops', String(loops)], ['open chains', String(open)], ['length', fmt(length, 4)]],
    });
  }
  return { level, above, crossed: segments.length, segments, loops, open, length };
}
