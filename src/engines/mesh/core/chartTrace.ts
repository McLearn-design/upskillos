// Seams and charts (UV › Trace the charts). A surface can lie flat only if it is cut into pieces that are each
// topologically a disc. Seams are the cuts: faces joined across non-seam edges form one chart, found by breadth-first
// search from a face, never crossing a seam. Each chart is then tested: it is a disc when it is one piece with
// Euler characteristic χ = V − E + F = 1 and one boundary loop. A tube (χ = 0, two rims) or a closed piece (χ = 2,
// no rim) cannot be unwrapped without another cut.

import type { EditMesh } from './EditMesh';
import { charts } from './uv';
import { Trace } from './trace';

export interface ChartInfo { faces: number[]; V: number; E: number; F: number; chi: number; boundaries: number; disc: boolean }

export function traceCharts(mesh: EditMesh, seams: Set<string>, trace?: Trace): ChartInfo[] {
  const cs = charts(mesh, seams);
  const info = cs.map((c) => {
    const t = c.mesh.topology();
    return { faces: c.faces, V: t.V, E: t.E, F: t.F, chi: t.chi, boundaries: t.boundaryLoops, disc: t.pieces === 1 && t.chi === 1 && t.boundaryLoops === 1 };
  });
  if (trace) {
    const seamEdges = [...seams].map((k) => k.split('-').map(Number) as [number, number]).filter(([a, b]) => mesh.verts[a] && mesh.verts[b]);
    const top = mesh.topology();
    trace.step({
      phase: 'Seams', label: `${seamEdges.length} seam edge${seamEdges.length === 1 ? '' : 's'} on a surface with χ = ${top.chi} and ${top.boundaryLoops} boundary loop${top.boundaryLoops === 1 ? '' : 's'}`,
      detail: 'A seam is an edge the surface is cut along. Faces stay in one piece while they can be reached from each other by crossing edges that are not seams. The surface\'s own open edges are cuts too.',
      edges: seamEdges,
      quiz: { prompt: `The highlighted edges are seams. Into how many separate pieces (charts) do they cut the ${mesh.faces.length} faces?`, answer: [cs.length], labels: ['charts'], rule: 'Flood from a face across non-seam edges; each flood is one chart. Count the floods.', tolerance: 0 },
    }, mesh.verts.length <= trace.snapshotLimit ? mesh : undefined);
    const shown = Math.min(cs.length, 8);
    for (let k = 0; k < shown; k++) {
      const c = info[k];
      trace.step({
        phase: 'Grow charts', label: `Chart ${k + 1}: ${c.F} face${c.F === 1 ? '' : 's'}, flooded from face ${c.faces[0]} without crossing a seam`,
        detail: 'Breadth-first search: start at a face no chart has yet, then repeatedly add every face across a non-seam edge. When nothing more can be added, the chart is complete.',
        faces: c.faces,
      });
    }
    if (cs.length > shown) trace.step({ phase: 'Grow charts', label: `… and ${cs.length - shown} more charts`, faces: info.slice(shown).flatMap((c) => c.faces) });
    const bad = info.filter((c) => !c.disc);
    trace.step({
      phase: 'Disc test', label: bad.length ? `${info.length - bad.length} of ${info.length} charts are discs; ${bad.length} need${bad.length === 1 ? 's' : ''} another cut` : `All ${info.length} charts are discs: they can be flattened`,
      detail: 'A chart can lie flat without tearing only if it is a disc: one piece, χ = V − E + F = 1, one boundary loop. A tube has χ = 0 and two rims, so it needs a cut from rim to rim; a closed piece has χ = 2 and no rim, so it needs at least one seam.',
      faces: bad.flatMap((c) => c.faces),
      values: info.slice(0, 12).map((c, k) => [`chart ${k + 1}`, `V ${c.V}, E ${c.E}, F ${c.F}: χ = ${c.chi}, ${c.boundaries} rim${c.boundaries === 1 ? '' : 's'}${c.disc ? ', a disc' : ', not a disc'}`] as [string, string]),
    });
    const wedges = cs.reduce((s, c) => s + c.mesh.verts.length, 0);
    trace.step({
      phase: 'Wedges', label: `${mesh.verts.length} vertices become ${wedges} chart vertices (wedges)`,
      detail: 'Each chart gets its own copy of the vertices on its border, so a vertex on a seam appears once in each chart around it, and in a chart twice if the seam runs through it inside that chart. Those copies are the wedges of lesson 8.1.',
      edges: [...seams].map((k) => k.split('-').map(Number) as [number, number]).filter(([a, b]) => mesh.verts[a] && mesh.verts[b]),
    });
  }
  return info;
}
