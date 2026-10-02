// Turning a face into triangles, for drawing and picking. The GPU draws only triangles, so every face with more
// than three corners is cut up. A convex face is cut as a fan from its first corner, as before. A concave face
// (an L, a U, anything with a corner that turns the other way) cannot be: some fan triangles would lie outside
// the face. It is cut by ear clipping instead, in the face's own plane: repeatedly cut off a corner whose
// triangle is inside the face and holds no other corner (an "ear"), until three corners are left.
//
// Triangles are returned as corner positions within the face (0 … k − 1), not vertex numbers, so per-corner
// data (UVs, auto-smooth normals) can follow them.

import type { Vec3 } from './EditMesh';
import { Trace, fmt } from './trace';

type Tri = [number, number, number];

const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/** The face's normal by Newell's method (the sum of cross products round it): right for concave faces too. */
export function newellNormal(verts: Vec3[], f: number[]): Vec3 {
  const n: Vec3 = [0, 0, 0];
  for (let i = 0; i < f.length; i++) {
    const a = verts[f[i]], b = verts[f[(i + 1) % f.length]];
    n[0] += (a[1] - b[1]) * (a[2] + b[2]);
    n[1] += (a[2] - b[2]) * (a[0] + b[0]);
    n[2] += (a[0] - b[0]) * (a[1] + b[1]);
  }
  return n;
}

/** How much the outline turns at each corner, about the normal: positive turns left (convex), negative right. */
export function cornerTurns(verts: Vec3[], f: number[], n = newellNormal(verts, f)): number[] {
  const k = f.length;
  return f.map((_, i) => dot(cross(sub(verts[f[i]], verts[f[(i + k - 1) % k]]), sub(verts[f[(i + 1) % k]], verts[f[i]])), n));
}

/** The fan from corner 0: [0, i, i + 1]. */
export const fan = (k: number): Tri[] => Array.from({ length: Math.max(0, k - 2) }, (_, i) => [0, i + 1, i + 2] as Tri);

/**
 * Triangles covering face f, as corner positions. Convex faces (and triangles and quads that are not bent back)
 * get the fan; concave faces are ear-clipped. With a trace, every step is recorded.
 */
export function faceTriangles(verts: Vec3[], f: number[], trace?: Trace): Tri[] {
  const k = f.length;
  if (k < 3) return [];
  const n = newellNormal(verts, f);
  const scale = Math.max(1e-300, dot(n, n));
  const turns = cornerTurns(verts, f, n);
  const reflex = turns.map((t, i) => (t < -1e-9 * scale ? i : -1)).filter((i) => i >= 0);
  trace?.step({
    phase: 'Convex?', label: reflex.length ? `${reflex.length} corner${reflex.length === 1 ? '' : 's'} turn${reflex.length === 1 ? 's' : ''} the other way (${reflex.map((i) => `corner ${i}`).join(', ')}): concave, so ear clipping` : `Every corner turns the same way: convex, so a fan from corner 0 (${k - 2} triangles)`,
    detail: 'Walk the outline: at each corner, (cur − prev) × (next − cur) · n says which way it turns. All one way: convex, and the fan from corner 0 stays inside. Any the other way: concave, and some fan triangle would cover the notch.',
    values: turns.map((t, i) => [`corner ${i} (v${f[i]})`, t >= -1e-9 * scale ? 'turns left' : 'turns right (reflex)'] as [string, string]),
    verts: reflex.map((i) => f[i]),
  });
  if (!reflex.length) return fan(k);

  // Into the plane: drop the axis the normal points along most, and keep the outline counter-clockwise.
  const ax = Math.abs(n[0]) > Math.abs(n[1]) ? (Math.abs(n[0]) > Math.abs(n[2]) ? 0 : 2) : (Math.abs(n[1]) > Math.abs(n[2]) ? 1 : 2);
  const [u, w] = ax === 0 ? [1, 2] : ax === 1 ? [2, 0] : [0, 1];
  const sign = n[ax] >= 0 ? 1 : -1;
  const p = f.map((v) => [verts[v][u], verts[v][w] * sign]);
  const area2 = (a: number, b: number, c: number) => (p[b][0] - p[a][0]) * (p[c][1] - p[a][1]) - (p[c][0] - p[a][0]) * (p[b][1] - p[a][1]);
  const inside = (x: number, a: number, b: number, c: number) => area2(a, b, x) >= 0 && area2(b, c, x) >= 0 && area2(c, a, x) >= 0;

  const left = [...Array(k).keys()];
  const out: Tri[] = [];
  let asked = false;
  let guard = k * k;
  while (left.length > 3 && guard-- > 0) {
    let cut = -1;
    for (let j = 0; j < left.length; j++) {
      const a = left[(j + left.length - 1) % left.length], b = left[j], c = left[(j + 1) % left.length];
      const convex = area2(a, b, c) > 0;
      const blocker = convex ? left.find((x) => x !== a && x !== b && x !== c && inside(x, a, b, c)) : undefined;
      const ear = convex && blocker === undefined;
      if (trace && trace.detailed(1)) {
        const ask = !asked && !ear; if (ask) asked = true;
        trace.step({
          phase: 'Ear clipping', label: `Corner ${b} (v${f[b]}), triangle [${a}, ${b}, ${c}]: ${!convex ? 'reflex, not an ear' : blocker !== undefined ? `corner ${blocker} is inside it, not an ear` : 'an ear: cut it off'}`,
          detail: 'An ear is a corner whose triangle with its two neighbours turns the right way (convex) and contains no other corner of what is left. Cutting it off leaves a smaller face that is still a simple polygon.',
          verts: [f[a], f[b], f[c]],
          ...(ask ? { quiz: { prompt: `Corner ${b}'s triangle [${a}, ${b}, ${c}] is not an ear. Which corner (0 to ${k - 1}) stops it: give the corner itself if it is reflex, or the corner lying inside the triangle.`, answer: [blocker ?? b], labels: ['corner'], rule: 'An ear must turn the same way as the face (not reflex) and hold no other remaining corner inside its triangle.', tolerance: 0 } } : {}),
        });
      }
      if (ear) { cut = j; out.push([a, b, c]); break; }
    }
    if (cut < 0) break; // a degenerate outline: fall back to the fan for what is left
    left.splice(cut, 1);
  }
  if (left.length === 3) out.push([left[0], left[1], left[2]]);
  else for (let i = 1; i + 1 < left.length; i++) out.push([left[0], left[i], left[i + 1]]);
  trace?.step({ phase: 'Done', label: `${out.length} triangles: ${out.map((t) => `[${t.join(', ')}]`).join(' ')}`, detail: `A face with k corners always becomes k − 2 triangles, however it is cut: their angles add up to the face's, (k − 2) · 180° = ${fmt((k - 2) * 180)}°.` });
  return out;
}
