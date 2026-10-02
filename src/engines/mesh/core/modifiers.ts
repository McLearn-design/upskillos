// Modifiers: operations applied on the fly to an object's mesh for display and
// export, leaving the mesh you edit untouched - the basis of Blender-style box
// modelling. Model half a character; the mirror shows the whole; subdivision
// smooths the cage.

import { EditMesh, type Vec3 } from './EditMesh';
import { subdivide } from './subdivision';
import { Trace, fmt, fmtV } from './trace';

export type Axis = 'x' | 'y' | 'z';
export type Modifier =
  | { type: 'mirror'; axis: Axis; merge: number; clip: boolean; enabled: boolean }
  /** uvSmooth: subdivide the UVs with the surface (Blender's "keep boundaries"); false = linear. Missing means smooth. */
  | { type: 'subsurf'; levels: number; enabled: boolean; uvSmooth?: boolean };

export const defaultModifier = (type: Modifier['type']): Modifier =>
  type === 'mirror' ? { type, axis: 'x', merge: 0.001, clip: true, enabled: true } : { type, levels: 2, enabled: true };

const AX = { x: 0, y: 1, z: 2 } as const;

/**
 * Mirror across the object's own x = 0 (or y, z) plane. Vertices within
 * `merge` of the plane are shared by both halves, so the result is one
 * connected surface rather than two halves touching. Mirrored faces have their
 * winding reversed: a reflection turns counter-clockwise into clockwise, and
 * without the reversal every mirrored face would point inward.
 */
export function mirror(mesh: EditMesh, axis: Axis = 'x', merge = 0.001, trace?: Trace): EditMesh {
  const k = AX[axis];
  const n = mesh.verts.length;
  const verts: Vec3[] = mesh.verts.map((v) => [v[0], v[1], v[2]]);
  const map: number[] = [];
  mesh.verts.forEach((v, i) => {
    if (Math.abs(v[k]) <= merge) { map[i] = i; return; }
    const r: Vec3 = [v[0], v[1], v[2]]; r[k] = -r[k];
    map[i] = verts.length; verts.push(r);
  });
  const onPlane = map.filter((m, i) => m === i).length;
  const first = mesh.verts.findIndex((_, i) => map[i] !== i);
  trace?.step({
    phase: 'Reflect', label: `${n - onPlane} vertices reflected, ${onPlane} on the plane shared`,
    detail: `Reflection in the ${axis} = 0 plane negates the ${axis} coordinate. Vertices within ${fmt(merge)} of the plane are not copied, so the two halves join.`,
    verts: mesh.verts.map((_, i) => i).filter((i) => map[i] === i),
    values: [['plane', `${axis} = 0`], ['merge distance', fmt(merge)], ['shared', String(onPlane)], ['copied', String(n - onPlane)]],
    quiz: first >= 0 ? { prompt: `The mirror reflects in the ${axis} = 0 plane. Where does the copy of v${first} = ${fmtV(mesh.verts[first])} go?`, answer: verts[map[first]], labels: ['x', 'y', 'z'], rule: `Negate the ${axis} coordinate; keep the other two. The reflection matrix is the identity with −1 in the ${axis} place.` } : undefined,
  });
  const faces = mesh.faces.map((f) => f.slice());
  const seen = new Set(faces.map((f) => [...f].sort((a, b) => a - b).join(',')));
  let skipped = 0;
  for (const f of mesh.faces) {
    const r = f.map((v) => map[v]).reverse();
    const key = [...r].sort((a, b) => a - b).join(',');
    if (seen.has(key)) { skipped++; continue; }   // a face lying in the plane mirrors onto itself
    faces.push(r);
  }
  const out = new EditMesh(verts, faces);
  trace?.step({
    phase: 'Reverse winding', label: `${mesh.faces.length - skipped} faces mirrored with their corner order reversed`,
    detail: 'A reflection has determinant −1: it turns counter-clockwise rings clockwise. Reversing the ring puts each mirrored face\'s normal back outside.',
  }, out);
  return out;
}

/** Evaluate an object's modifier stack, top to bottom. */
export function evaluate(mesh: EditMesh, modifiers: Modifier[], maxLevels = 4): EditMesh {
  let m = mesh;
  for (const mod of modifiers) {
    if (!mod.enabled) continue;
    if (mod.type === 'mirror') m = mirror(m, mod.axis, mod.merge);
    else if (mod.type === 'subsurf') m = subdivide(m, Math.min(maxLevels, Math.max(0, Math.round(mod.levels))));
  }
  return m;
}

/** For extrude: whether an edge lies on the plane of a clipped mirror modifier. */
export function onMirrorPlane(mesh: EditMesh, modifiers: Modifier[]): ((a: number, b: number) => boolean) | undefined {
  const mir = modifiers.find((m) => m.type === 'mirror' && m.enabled && m.clip);
  if (!mir || mir.type !== 'mirror') return undefined;
  const k = AX[mir.axis];
  return (a, b) => Math.abs(mesh.verts[a][k]) <= mir.merge && Math.abs(mesh.verts[b][k]) <= mir.merge;
}
