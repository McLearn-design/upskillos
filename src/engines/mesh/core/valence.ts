// Clean topology, measured. A vertex's valence is how many edges meet there. In a grid of quads an inside vertex
// has 4; a vertex with any other number is a pole (3 and 5 are the usual ones). Poles cannot all be avoided: on a
// closed mesh of quads, Σ (4 − valence) = 4χ (8 for anything shaped like a sphere), so a ball made of quads needs
// at least eight 3-poles' worth of them. Triangles and n-gons are counted too, since subdivision turns an n-gon
// into an n-pole.

import type { EditMesh } from './EditMesh';
import { Trace } from './trace';

export interface ValenceReport {
  valence: number[];
  /** Inside vertices (not on an open edge) by valence, e.g. { 3: 8, 4: 90 }. */
  inside: Record<number, number>;
  poles: number;
  tris: number; quads: number; ngons: number;
  /** Σ (4 − valence) over inside vertices, and 4χ, for a closed all-quad mesh (null otherwise). */
  budget: { sum: number; fourChi: number } | null;
}

export function traceValence(mesh: EditMesh, trace?: Trace): ValenceReport {
  const map = mesh.edges();
  const valence = mesh.verts.map(() => 0);
  const boundary = new Set<number>();
  for (const e of map.values()) {
    valence[e.a]++; valence[e.b]++;
    if (e.faces.length === 1) { boundary.add(e.a); boundary.add(e.b); }
  }
  const used = new Set(mesh.faces.flat());
  const inside: Record<number, number> = {};
  for (const v of used) if (!boundary.has(v)) inside[valence[v]] = (inside[valence[v]] ?? 0) + 1;
  const poles = Object.entries(inside).filter(([k]) => Number(k) !== 4).reduce((s, [, n]) => s + n, 0);
  let tris = 0, quads = 0, ngons = 0;
  for (const f of mesh.faces) { if (f.length === 3) tris++; else if (f.length === 4) quads++; else ngons++; }
  const closed = boundary.size === 0;
  const chi = used.size - map.size + mesh.faces.length;
  const budget = closed && tris === 0 && ngons === 0 ? { sum: [...used].reduce((s, v) => s + 4 - valence[v], 0), fourChi: 4 * chi } : null;

  if (trace) {
    const pole = [...used].find((v) => !boundary.has(v) && valence[v] !== 4);
    const list = Object.entries(inside).sort(([a], [b]) => Number(a) - Number(b)).map(([k, n]) => `${n} with ${k}`).join(', ');
    trace.step({
      phase: 'Valence', label: `Inside vertices: ${list || 'none'}; ${poles} pole${poles === 1 ? '' : 's'}`,
      detail: 'Valence is how many edges meet at a vertex. Inside a grid of quads it is 4. A vertex with another valence is a pole: 3 (an N-pole, like a cube\'s corner) or 5 (an E-pole) are normal; 6 or more pinch the surface. Vertices on an open edge are not counted.',
      field: valence, fieldLabel: 'edges at each vertex',
      verts: [...used].filter((v) => !boundary.has(v) && valence[v] !== 4),
      quiz: pole !== undefined ? { prompt: `How many edges meet at v${pole}, one of the highlighted vertices?`, answer: [valence[pole]], labels: ['edges'], rule: 'Count the edges that end at the vertex; inside a quad grid there are 4.', tolerance: 0 } : undefined,
    }, mesh.verts.length <= trace.snapshotLimit ? mesh : undefined);
    trace.step({
      phase: 'Faces', label: `${quads} quads, ${tris} triangles, ${ngons} n-gons`,
      detail: 'Quads subdivide into quads, and their edges line up into loops and rings. Triangles stop rings (lesson 5.3) and become 3-poles when subdivided; an n-gon becomes an n-pole.',
      faces: mesh.faces.map((f, i) => (f.length === 4 ? -1 : i)).filter((i) => i >= 0),
    });
    trace.step({
      phase: 'Pole budget',
      label: budget ? `Σ (4 − valence) = ${budget.sum} = 4χ = ${budget.fourChi}: the poles this shape cannot avoid` : `The pole budget applies to closed meshes of quads only (this one ${closed ? 'has triangles or n-gons' : 'has open edges'})`,
      detail: 'For a closed mesh of quads, every face has 4 edges and every edge 2 faces, so E = 2F; with V − E + F = χ, Σ (4 − valence) = 4V − 2E = 4χ. A sphere-like shape (χ = 2) needs 8: eight 3-poles, or more 3-poles balanced by 5-poles. A torus (χ = 0) needs none.',
      values: budget ? [['Σ (4 − valence)', String(budget.sum)], ['χ', String(chi)], ['4χ', String(budget.fourChi)]] : [['χ', String(chi)]],
    });
  }
  return { valence, inside, poles, tris, quads, ngons, budget };
}
