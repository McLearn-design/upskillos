// Picking by ray (Object › Trace picking): a pixel becomes a ray from the eye (lesson 3.2 run backwards), and the
// ray is tested against every triangle with the Möller–Trumbore method. The nearest hit in front of the eye is
// what was clicked. three.js's Raycaster, which MeshLab's viewport uses, does the same test.

import { Matrix4, Vector3 } from 'three';
import type { CameraSettings } from './camera';
import type { Vec3 } from './EditMesh';
import type { Trace } from './trace';
import { faceTriangles } from './triangulate';

export interface Ray { origin: Vec3; dir: Vec3 }
export interface TriangleHit { t: number; u: number; v: number }

const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/** The ray from a camera's eye through pixel (px, py) of a width × height image (pixel centres at +0.5). */
export function rayFromPixel(elements: ArrayLike<number>, cam: CameraSettings, size: { width: number; height: number }, px: number, py: number): Ray & { ndc: [number, number] } {
  const m = new Matrix4().fromArray(Array.from(elements)), e = m.elements;
  const ndc: [number, number] = [((px + 0.5) / size.width) * 2 - 1, 1 - ((py + 0.5) / size.height) * 2];
  const t = Math.tan((cam.fov * Math.PI) / 360), a = size.width / size.height;
  // In camera space the ray goes through (x · tan · aspect, y · tan, −1); turn it into the world with the camera's axes.
  const local = new Vector3(ndc[0] * t * a, ndc[1] * t, -1);
  const right = new Vector3(e[0], e[1], e[2]).normalize(), up = new Vector3(e[4], e[5], e[6]).normalize(), back = new Vector3(e[8], e[9], e[10]).normalize();
  const d = right.multiplyScalar(local.x).add(up.multiplyScalar(local.y)).add(back.multiplyScalar(local.z)).normalize();
  return { origin: [e[12], e[13], e[14]], dir: [d.x, d.y, d.z], ndc };
}

/**
 * Möller–Trumbore: where the ray o + t·d meets triangle a, b, c, as t along the ray and barycentric u, v
 * (the hit is (1 − u − v)·a + u·b + v·c). null if it misses, is parallel, or is behind the origin.
 */
export function rayTriangle(ray: Ray, a: Vec3, b: Vec3, c: Vec3): TriangleHit | null {
  const e1 = sub(b, a), e2 = sub(c, a), p = cross(ray.dir, e2), det = dot(e1, p);
  if (Math.abs(det) < 1e-12) return null;
  const s = sub(ray.origin, a), u = dot(s, p) / det;
  if (u < 0 || u > 1) return null;
  const q = cross(s, e1), v = dot(ray.dir, q) / det;
  if (v < 0 || u + v > 1) return null;
  const t = dot(e2, q) / det;
  return t > 1e-9 ? { t, u, v } : null;
}

export interface Pickable { name: string; verts: Vec3[]; faces: number[][] }

/** The nearest hit of a ray among meshes given in world coordinates: which mesh, which face, how far. Traced. */
export function tracePick(ray: Ray, meshes: Pickable[], trace?: Trace): { name: string; face: number; t: number; point: Vec3; u: number; v: number } | null {
  const r = (x: number) => +(Math.abs(x) < 1e-12 ? 0 : x).toFixed(4);
  const v3 = (p: Vec3) => `(${p.map(r).join(', ')})`;
  if (trace) trace.step({ phase: 'Ray', label: `From ${v3(ray.origin)} along ${v3(ray.dir)}`, detail: 'The pixel was turned back into a direction: undo the pixel mapping to get NDC, undo the projection (x · tan · aspect, y · tan, −1 in camera space), then turn it into the world with the camera\'s axes.', values: [['origin (the eye)', v3(ray.origin)], ['direction', v3(ray.dir)]] });
  type Best = { name: string; face: number; t: number; point: Vec3; u: number; v: number; tri: [Vec3, Vec3, Vec3] };
  let best = null as Best | null;
  for (const m of meshes) {
    let tested = 0, hits = 0, near: number | null = null;
    for (const [fi, f] of m.faces.entries()) {
      for (const [i0, i1, i2] of faceTriangles(m.verts, f)) {
        tested++;
        const a = m.verts[f[i0]], b = m.verts[f[i1]], c = m.verts[f[i2]];
        const h = rayTriangle(ray, a, b, c);
        if (!h) continue;
        hits++;
        if (near === null || h.t < near) near = h.t;
        if (!best || h.t < best.t) best = { name: m.name, face: fi, t: h.t, u: h.u, v: h.v, point: [ray.origin[0] + h.t * ray.dir[0], ray.origin[1] + h.t * ray.dir[1], ray.origin[2] + h.t * ray.dir[2]], tri: [a, b, c] };
      }
    }
    trace?.step({ phase: 'Test', label: `${m.name}: ${tested} triangles tested, ${hits} hit${near !== null ? `; nearest at t = ${r(near)}` : ''}`, detail: 'Every triangle is tested (a real tool first skips objects whose bounding box the ray misses). A closed mesh is usually hit twice: going in and coming out.', values: [['triangles', String(tested)], ['hits', String(hits)]] });
  }
  if (trace && best) {
    const b = best;
    const [a, bb, c] = b.tri, e1 = sub(bb, a), e2 = sub(c, a), p = cross(ray.dir, e2), det = dot(e1, p);
    trace.step({
      phase: 'Möller–Trumbore', label: `${b.name}, face ${b.face}: det = ${r(det)}, u = ${r(b.u)}, v = ${r(b.v)}, t = ${r(b.t)}`,
      detail: 'Solve o + t·d = (1 − u − v)·a + u·b + v·c for t, u, v with Cramer\'s rule (the determinants are triple products). det near 0 means the ray runs along the triangle; u and v must be ≥ 0 with u + v ≤ 1 for the point to be inside; t > 0 for it to be in front.',
      values: [['edge 1 = b − a', v3(e1)], ['edge 2 = c − a', v3(e2)], ['det = edge1 · (d × edge2)', String(r(det))], ['u, v', `${r(b.u)}, ${r(b.v)}`], ['t', String(r(b.t))]],
      quiz: { prompt: `The ray starts at ${v3(ray.origin)}, going along ${v3(ray.dir)} (unit length). It hits ${b.name}. How far along the ray is the hit (t)?`, answer: [b.t], labels: ['t'], rule: 'Möller–Trumbore: t = (edge2 · q) / det, with q = (o − a) × edge1. For a unit direction, t is the distance.', tolerance: 0.01 },
    });
    trace.step({ phase: 'Nearest', label: `Picked ${b.name}, face ${b.face}, at ${v3(b.point)}`, detail: 'Of all the hits in front of the eye, the smallest t is the surface you see at that pixel: the same surface the depth test keeps (lesson 3.4).', values: [['object', b.name], ['face', String(b.face)], ['point', v3(b.point)]], quiz: { prompt: 'Where does the ray hit (o + t·d)?', answer: b.point, labels: ['x', 'y', 'z'], rule: 'The origin plus t times the direction.' } });
  } else trace?.step({ phase: 'Nearest', label: 'Nothing hit: the click selects nothing', detail: 'No triangle passed all three tests in front of the eye.', values: [] });
  if (!best) return null;
  return { name: best.name, face: best.face, t: best.t, point: best.point, u: best.u, v: best.v };
}
