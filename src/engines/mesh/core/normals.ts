// Vertex normals for smooth shading (Object › Shade smooth, Shade auto smooth; Mesh › Trace the vertex normal).
//
// A face's normal is the cross product of its sides; summed over a fan of triangles it is as long as twice the
// face's area. A vertex normal for smooth shading is a weighted average of the normals of the faces round the
// vertex: weighted by area (what three.js and MeshLab's plain Shade smooth do) or by the face's angle at that
// corner (which does not change when a face is cut into more triangles).
//
// Auto smooth keeps hard edges hard: each face corner averages only the faces round its vertex whose normal is
// within the angle of its own face's normal. A cube's corners then keep three different normals (90° apart, more
// than 30°), so its faces stay flat, while a cylinder's sides (a few degrees apart) blend into one curve.

import type { EditMesh, Vec3 } from './EditMesh';
import type { Trace } from './trace';

export interface NormalOptions {
  /** Weight each face by its area, or by its angle at the vertex. */
  weight?: 'area' | 'angle';
  /** Auto smooth: only average faces within this many degrees of the corner's own face. null: average them all. */
  sharp?: number | null;
}

const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len = (a: Vec3) => Math.hypot(a[0], a[1], a[2]);
const unit = (a: Vec3): Vec3 => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

/** A face's normal times twice its area: the sum of the cross products of a fan of triangles. */
export function areaNormal(m: EditMesh, fi: number): Vec3 {
  const f = m.faces[fi], a = m.verts[f[0]];
  let n: Vec3 = [0, 0, 0];
  for (let i = 1; i + 1 < f.length; i++) {
    const c = cross(sub(m.verts[f[i]], a), sub(m.verts[f[i + 1]], a));
    n = [n[0] + c[0], n[1] + c[1], n[2] + c[2]];
  }
  return n;
}

/** The face's angle (radians) at its corner k: between the sides to the previous and the next corner. */
export function cornerAngle(m: EditMesh, fi: number, k: number): number {
  const f = m.faces[fi], p = m.verts[f[k]];
  const a = unit(sub(m.verts[f[(k + f.length - 1) % f.length]], p)), b = unit(sub(m.verts[f[(k + 1) % f.length]], p));
  return Math.acos(Math.max(-1, Math.min(1, dot(a, b))));
}

/** For every face, a unit normal at each of its corners, for smooth or auto-smooth shading. */
export function cornerNormals(m: EditMesh, opts: NormalOptions = {}): Vec3[][] {
  const weight = opts.weight ?? 'area', cos = opts.sharp == null ? -2 : Math.cos((opts.sharp * Math.PI) / 180);
  const an = m.faces.map((_, fi) => areaNormal(m, fi)), un = an.map(unit);
  const around: { fi: number; k: number }[][] = m.verts.map(() => []);
  m.faces.forEach((f, fi) => f.forEach((v, k) => around[v].push({ fi, k })));
  return m.faces.map((f, fi) => f.map((v) => {
    let s: Vec3 = [0, 0, 0];
    for (const { fi: g, k } of around[v]) {
      if (dot(un[g], un[fi]) < cos - 1e-12) continue;
      const w = weight === 'area' ? an[g] : (() => { const a = cornerAngle(m, g, k); return [un[g][0] * a, un[g][1] * a, un[g][2] * a] as Vec3; })();
      s = [s[0] + w[0], s[1] + w[1], s[2] + w[2]];
    }
    return len(s) > 1e-12 ? unit(s) : un[fi];
  }));
}

/**
 * How one vertex's normal is built (Mesh › Trace the vertex normal): the faces round it, each face's normal and
 * weight, the weighted sum and its direction; with auto smooth, which faces each corner leaves out. Traced, with
 * Predict questions on the first face's weight and on the averaged normal.
 */
export function traceVertexNormal(m: EditMesh, v: number, opts: NormalOptions = {}, trace?: Trace): { faces: number[]; weights: number[]; normal: Vec3; groups: number } {
  const weight = opts.weight ?? 'area';
  const ring = m.faces.flatMap((f, fi) => f.map((x, k) => (x === v ? { fi, k } : null)).filter(Boolean) as { fi: number; k: number }[]);
  if (!ring.length) throw new Error(`Vertex ${v} is on no face`);
  const r = (x: number) => +(Math.abs(x) < 1e-12 ? 0 : x).toFixed(4);
  const v3 = (a: Vec3) => `(${a.map(r).join(', ')})`;
  const un = ring.map(({ fi }) => unit(areaNormal(m, fi)));
  const ws = ring.map(({ fi, k }) => (weight === 'area' ? len(areaNormal(m, fi)) / 2 : cornerAngle(m, fi, k)));
  let s: Vec3 = [0, 0, 0];
  ring.forEach((_, i) => { s = [s[0] + un[i][0] * ws[i], s[1] + un[i][1] * ws[i], s[2] + un[i][2] * ws[i]]; });
  const normal = unit(s);
  const corner = cornerNormals(m, opts);
  const distinct: Vec3[] = [];
  for (const { fi } of ring) {
    const n = corner[fi][m.faces[fi].indexOf(v)];
    if (!distinct.some((d) => dot(d, n) > 1 - 1e-9)) distinct.push(n);
  }
  if (trace) {
    trace.step({ phase: 'Faces round it', label: `Vertex ${v} is on ${ring.length} faces: ${ring.map(({ fi }) => fi).join(', ')}`, detail: 'Smooth shading gives the vertex one normal made from all the faces that meet there, so the light changes gradually across their shared edges.', verts: [v], faces: ring.map(({ fi }) => fi) });
    ring.forEach(({ fi }, i) => trace.step({
      phase: 'Face normals', label: `Face ${fi}: normal ${v3(un[i])}, ${weight === 'area' ? `area ${r(ws[i])}` : `angle at the vertex ${r((ws[i] * 180) / Math.PI)}°`}`,
      detail: weight === 'area' ? 'The cross products of a fan of triangles add up to the face\'s normal times twice its area: half its length is the area, the weight.' : 'The face\'s angle at this corner, between its two sides that meet here: cutting the face into more triangles does not change it.',
      faces: [fi], verts: [v], values: [['normal', v3(un[i])], ['weight', weight === 'area' ? String(r(ws[i])) : `${r(ws[i])} rad`]],
      quiz: i === 0 ? { prompt: `Face ${fi}'s ${weight === 'area' ? 'area' : 'angle at vertex ' + v + ' (radians)'} is its weight. What is it?`, answer: [ws[0]], labels: ['weight'], rule: weight === 'area' ? 'Half the length of the summed cross products of its fan of triangles.' : 'The angle between the two sides of the face that meet at the vertex.' } : undefined,
    }));
    trace.step({
      phase: 'Average', label: `Weighted sum ${v3(s)}; vertex normal ${v3(normal)}`,
      detail: 'Add each face\'s unit normal times its weight, then make the sum one unit long. Bigger (or wider-angled) faces pull the normal towards themselves.',
      verts: [v], values: [['sum', v3(s)], ['normal', v3(normal)]],
      quiz: { prompt: `Add the faces' unit normals, each times its weight, and make the result 1 long. What is vertex ${v}'s smooth normal?`, answer: normal, labels: ['x', 'y', 'z'], rule: 'Σ weight × unit normal, divided by its length.' },
    });
    if (opts.sharp != null) trace.step({
      phase: 'Auto smooth', label: distinct.length > 1 ? `Auto smooth ${opts.sharp}°: the corners here use ${distinct.length} different normals (a hard edge runs through this vertex)` : `Auto smooth ${opts.sharp}°: every face here is within ${opts.sharp}° of the others, so all corners share one normal`,
      detail: 'Each face\'s corner averages only the faces whose normals are within the angle of its own. Faces across a sharp edge are left out, so the edge stays crisp while gentle curves stay smooth.',
      verts: [v], values: distinct.map((d, i) => [`normal ${i + 1}`, v3(d)] as [string, string]),
    });
  }
  return { faces: ring.map(({ fi }) => fi), weights: ws, normal, groups: distinct.length };
}
