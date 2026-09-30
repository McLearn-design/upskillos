// OBJ import and export.
//
// OBJ is the file to swap models with Blender: it keeps quads and n-gons (glTF
// and STL triangulate), so a model made here arrives in Blender with the same
// topology, ready to edit, and back again.

import { EditMesh, type Vec3 } from './EditMesh';
import type { Scene } from './Scene';
import { evaluatedMesh } from './evaluate';
import { Vector3 } from 'three';

export interface ObjObject { name: string; verts: Vec3[]; faces: number[][] }

/** Parse OBJ text into objects. Vertex numbering in OBJ is global and 1-based; here each object gets its own 0-based list. */
export function parseOBJ(text: string): ObjObject[] {
  const all: Vec3[] = [];
  const objects: { name: string; faces: number[][] }[] = [];
  let cur: { name: string; faces: number[][] } | null = null;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const [tag, ...rest] = line.split(/\s+/);
    if (tag === 'v') all.push([+rest[0], +rest[1], +rest[2]]);
    else if (tag === 'o' || tag === 'g') { cur = { name: rest.join(' ') || 'Object', faces: [] }; objects.push(cur); }
    else if (tag === 'f') {
      if (!cur) { cur = { name: 'Object', faces: [] }; objects.push(cur); }
      // "f 1/2/3 4//6 -1": the first number of each corner is the vertex; negative counts back from the end.
      const face = rest.map((c) => { const n = parseInt(c.split('/')[0], 10); return n < 0 ? all.length + n : n - 1; });
      if (face.length >= 3 && face.every((v) => v >= 0 && v < all.length)) cur.faces.push(face);
    }
  }
  return objects.filter((o) => o.faces.length).map((o) => {
    const used = [...new Set(o.faces.flat())].sort((a, b) => a - b);
    const local = new Map(used.map((g, i) => [g, i]));
    return { name: o.name, verts: used.map((g) => all[g]), faces: o.faces.map((f) => f.map((g) => local.get(g)!)) };
  });
}

/** Write visible meshes as OBJ, with transforms baked in (world coordinates) and modifiers applied if asked. */
export function exportOBJ(scene: Scene, { applyModifiers = true } = {}): string {
  const lines = ['# MeshLab OBJ export', `# ${new Date().toISOString().slice(0, 10)}`];
  let offset = 1;
  for (const o of scene.objects) {
    if (!o.mesh || !o.visible) continue;
    const mesh: EditMesh = applyModifiers ? evaluatedMesh(scene, o) : o.mesh;
    const m = scene.worldMatrix(o);
    lines.push(`o ${o.name}`);
    const p = new Vector3();
    for (const v of mesh.verts) { p.set(v[0], v[1], v[2]).applyMatrix4(m); lines.push(`v ${+p.x.toFixed(6)} ${+p.y.toFixed(6)} ${+p.z.toFixed(6)}`); }
    if (!o.smooth) lines.push('s off');
    for (const f of mesh.faces) lines.push(`f ${f.map((v) => v + offset).join(' ')}`);
    offset += mesh.verts.length;
  }
  return lines.join('\n') + '\n';
}
