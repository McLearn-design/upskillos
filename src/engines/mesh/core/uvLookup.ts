// What UVs are (UV › Trace a texture lookup). A UV map gives every face corner a point (u, v) in the unit square
// of a texture. Corners, not vertices: where the surface is cut by a seam, one vertex has a different UV in each
// piece, so the UVs are stored per corner and the distinct (vertex, UV) pairs are called wedges. Inside a face the
// UV is interpolated from its corners; the GPU then reads the texture at that point. The trace follows one point,
// the face's centre, from its corners' UVs to a texel of MeshLab's 256 × 256 checker (8 × 8 squares).

import type { EditMesh, Vec3 } from './EditMesh';
import type { UV, UVLayer } from './uv';
import { Trace, fmt } from './trace';

export interface LookupReport { verts: number; corners: number; wedges: number; uv: UV; texel: [number, number]; square: [number, number]; white: boolean }

const SIZE = 256, SQUARES = 8;
const fract = (x: number) => x - Math.floor(x);

export function traceUVLookup(mesh: EditMesh, layer: UVLayer, face: number, scale = 1, trace?: Trace): LookupReport {
  const f = mesh.faces[face], uvs = layer.faces[face];
  // Every distinct UV each vertex has, over all the faces around it.
  const at = mesh.verts.map(() => new Map<string, UV>());
  layer.faces.forEach((fu, fi) => fu.forEach((p, i) => at[mesh.faces[fi][i]].set(`${p[0].toFixed(6)},${p[1].toFixed(6)}`, p)));
  const wedges = at.reduce((s, m) => s + m.size, 0), corners = layer.faces.reduce((s, fu) => s + fu.length, 0);
  const centre = f.reduce<Vec3>((c, v) => [c[0] + mesh.verts[v][0] / f.length, c[1] + mesh.verts[v][1] / f.length, c[2] + mesh.verts[v][2] / f.length], [0, 0, 0]);
  const uv: UV = [uvs.reduce((s, p) => s + p[0], 0) / f.length, uvs.reduce((s, p) => s + p[1], 0) / f.length];
  // The texture repeats: scale, then keep the fractional part.
  const tu = fract(uv[0] * scale), tv = fract(uv[1] * scale);
  const texel: [number, number] = [Math.min(SIZE - 1, Math.floor(tu * SIZE)), Math.min(SIZE - 1, Math.floor(tv * SIZE))];
  const square: [number, number] = [Math.floor(tu * SQUARES), Math.floor(tv * SQUARES)];
  const white = (square[0] + square[1]) % 2 === 0;
  if (trace) {
    trace.step({
      phase: 'Corners', label: `Face ${face}: ${f.length} corners, each with its own (u, v)`,
      detail: 'UVs belong to face corners, not to vertices. A vertex in the middle of a piece has the same UV in every face around it; a vertex on a seam has one UV per piece, so the texture can be cut there.',
      faces: [face], verts: [...f], values: f.map((v, i) => [`corner ${i} (v${v})`, `(${fmt(uvs[i][0], 4)}, ${fmt(uvs[i][1], 4)})`] as [string, string]),
    }, mesh.verts.length <= trace.snapshotLimit ? mesh : undefined);
    const split = f.filter((v) => at[v].size > 1);
    trace.step({
      phase: 'Wedges', label: `${mesh.verts.length} vertices, ${corners} face corners, ${wedges} distinct (vertex, UV) pairs`,
      detail: `A wedge is a vertex together with one of its UVs. ${wedges === mesh.verts.length ? 'Here every vertex has one UV: there are no seams.' : `${wedges - mesh.verts.length} more wedges than vertices: those vertices sit on seams.`} ${split.length ? `On this face, ${split.map((v) => `v${v} has ${at[v].size}`).join(', ')} different UVs.` : 'No vertex of this face is on a seam.'} The GPU needs one vertex per wedge, which is why a mesh with UVs uploads more vertices than it has.`,
      verts: mesh.verts.flatMap((_, v) => (at[v].size > 1 ? [v] : [])), faces: [face],
      values: [['vertices', String(mesh.verts.length)], ['corners', String(corners)], ['wedges', String(wedges)]],
    });
    trace.step({
      phase: 'Interpolate', label: `The face's centre ${'('}${centre.map((x) => fmt(x, 3)).join(', ')}) has UV (${fmt(uv[0], 4)}, ${fmt(uv[1], 4)})`,
      detail: 'Inside a face the UV is blended from its corners, with the same weights that place the point between them (barycentric weights on a triangle). At the centre every corner has the same weight, so the UV is the average of the corners\' UVs.',
      faces: [face], points: [{ p: centre, label: `(${fmt(uv[0], 3)}, ${fmt(uv[1], 3)})`, color: '#facc15' }],
      quiz: { prompt: `The corners of face ${face} have UVs ${uvs.map((p) => `(${fmt(p[0], 4)}, ${fmt(p[1], 4)})`).join(', ')}. What is the UV at the face's centre?`, answer: [...uv], labels: ['u', 'v'], rule: 'At the centre each corner weighs the same: the average of the corner UVs.', tolerance: 0.002 },
    });
    trace.step({
      phase: 'Texture lookup', label: `Texel (${texel[0]}, ${texel[1]}) of ${SIZE} × ${SIZE}: checker square (${square[0]}, ${square[1]}), ${white ? 'white' : 'coloured'}`,
      detail: `${scale !== 1 ? `The material repeats the texture ×${fmt(scale)}, so (u, v) is multiplied by ${fmt(scale)} and only the fractional part kept. ` : ''}The texture is a grid of ${SIZE} × ${SIZE} pixels (texels) covering the unit square: texel = floor(u · ${SIZE}), floor(v · ${SIZE}). The checker has ${SQUARES} × ${SQUARES} squares, so square = floor(u · ${SQUARES}), floor(v · ${SQUARES}); it is white when the two add up to an even number. The GPU blends the four nearest texels (bilinear filtering).`,
      faces: [face], points: [{ p: centre, label: white ? 'white' : 'coloured', color: white ? '#e5e7eb' : '#60a5fa' }],
      values: [['u, v', `${fmt(uv[0], 4)}, ${fmt(uv[1], 4)}`], ['texel', `${texel[0]}, ${texel[1]}`], ['square', `${square[0]}, ${square[1]}`]],
    });
  }
  return { verts: mesh.verts.length, corners, wedges, uv, texel, square, white };
}
