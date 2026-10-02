// OBJ import and export.
//
// OBJ is the file to swap models with Blender: it keeps quads and n-gons (glTF
// and STL triangulate), so a model made here arrives in Blender with the same
// topology, ready to edit, and back again.

import { EditMesh, type Vec3 } from './EditMesh';
import type { Scene } from './Scene';
import { evaluatedMesh } from './evaluate';
import type { Trace } from './trace';
import { Vector3 } from 'three';

export interface ObjObject { name: string; verts: Vec3[]; faces: number[][] }

/**
 * Parse OBJ text into objects. Vertex numbering in OBJ is global and 1-based; here each object gets its own
 * 0-based list. Traced: each v line with the number OBJ gives it and the number it is stored under, each f line
 * with its corners converted, and anything skipped.
 */
export function parseOBJ(text: string, trace?: Trace): ObjObject[] {
  const all: Vec3[] = [];
  const objects: { name: string; faces: number[][] }[] = [];
  let cur: { name: string; faces: number[][] } | null = null;
  let asked = false;
  text.split(/\r?\n/).forEach((raw, lineNo) => {
    const line = raw.trim();
    if (!line || line.startsWith('#')) return;
    const [tag, ...rest] = line.split(/\s+/);
    const at = `line ${lineNo + 1}: ${line}`;
    if (tag === 'v') {
      all.push([+rest[0], +rest[1], +rest[2]]);
      trace?.step({ phase: 'Vertices', label: `${at} → vertex ${all.length} in the file, stored as ${all.length - 1}`, detail: 'OBJ numbers vertices from 1, in the order the v lines come; arrays count from 0, so vertex n is stored at n − 1.', points: [{ p: all[all.length - 1], label: String(all.length - 1) }], values: [['OBJ number', String(all.length)], ['stored as', String(all.length - 1)]] });
    } else if (tag === 'o' || tag === 'g') {
      cur = { name: rest.join(' ') || 'Object', faces: [] }; objects.push(cur);
      trace?.step({ phase: 'Objects', label: `${at} → a new object, "${cur.name}"`, detail: 'Faces after this line belong to it. Vertex numbers do not restart: they count through the whole file.', values: [['object', cur.name]] });
    } else if (tag === 'f') {
      if (!cur) { cur = { name: 'Object', faces: [] }; objects.push(cur); }
      // "f 1/2/3 4//6 -1": the first number of each corner is the vertex; negative counts back from the end.
      const face = rest.map((c) => { const n = parseInt(c.split('/')[0], 10); return n < 0 ? all.length + n : n - 1; });
      const ok = face.length >= 3 && face.every((v) => v >= 0 && v < all.length);
      if (ok) cur.faces.push(face);
      const quiz = ok && !asked;
      if (quiz) asked = true;
      trace?.step({
        phase: ok ? 'Faces' : 'Skipped',
        label: ok ? `${at} → face ${cur.faces.length - 1}: ${face.join(', ')}` : `${at} → skipped: ${face.length < 3 ? 'fewer than 3 corners' : 'a corner names a vertex the file does not have (yet)'}`,
        detail: 'Each corner may be v, v/vt, v//vn or v/vt/vn: only the first number, the vertex, is used. Subtract 1 for the 0-based list; a negative number counts back from the last vertex read so far (−1 is the latest).',
        verts: ok ? face : [], values: [['corners in the file', rest.join(' ')], ['stored', ok ? face.join(', ') : 'skipped']],
        quiz: quiz ? { prompt: `The file has had ${all.length} v lines so far. Which vertex numbers does "${line}" store, counting from 0?`, answer: face, labels: face.map((_, i) => `corner ${i + 1}`), rule: 'Take the number before any slash and subtract 1 (OBJ counts from 1). A negative number n means the vertex |n| from the end: −1 is the last one read.' } : undefined,
      });
    }
  });
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
