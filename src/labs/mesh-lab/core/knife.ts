// The knife (K): cut faces along a line drawn across the view.
//
// A line on the screen is not a line in the scene. Every point that lands on it
// lies on one plane: the plane through the eye and the line's two ends. So the
// knife is that plane, and the cut is where the plane meets the faces, kept to
// the wedge between the rays through the line's two ends (the line has ends; the
// plane does not).
//
// Written without a view: `eye` is the viewpoint, and `from` and `to` are any
// points on the rays through the line's ends, all in the mesh's own coordinates.
// That is what gets logged, so a cut can be replayed and tested.
//
//   1. For each face, walk its edges. An edge whose ends are on opposite sides of
//      the plane is crossed at p = a + t(b − a), t = d(a) / (d(a) − d(b)), where
//      d(x) = (x − eye) · n is the signed distance times |n|. A vertex on the plane
//      is crossed where it is. Crossings outside the wedge do not count.
//   2. A face crossed at exactly two places, not already joined by one of its
//      edges, is split in two along the segment between them. (A concave face
//      crossed four times is left whole.)
//   3. A new vertex on an edge is shared by both faces beside that edge: it is put
//      into the neighbour's ring too, even when the neighbour is not split, so no
//      crack opens along the edge.

import { EditMesh, type Vec3 } from './EditMesh';
import type { Trace } from './trace';

export interface KnifeLine { eye: Vec3; from: Vec3; to: Vec3 }

const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (u: Vec3, v: Vec3): Vec3 => [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
const dot = (u: Vec3, v: Vec3) => u[0] * v[0] + u[1] * v[1] + u[2] * v[2];

type Crossing = { vert: number } | { edge: string; a: number; b: number; p: Vec3; after: number };

/**
 * Cut `faces` (all faces if omitted) along a knife line. Returns the new edges
 * (the cut inside each split face). Changes nothing if the line crosses no face.
 */
export function knife(mesh: EditMesh, line: KnifeLine, faces?: number[], trace?: Trace): [number, number][] {
  const { eye } = line, u = sub(line.from, eye), w = sub(line.to, eye);
  const n = cross(u, w), nl = Math.hypot(...n);
  if (nl < 1e-12) return [];
  const V = mesh.verts;
  const size = Math.max(1, ...V.map((p) => Math.hypot(...sub(p, eye))));
  const eps = 1e-9 * nl * size;
  const d = (p: Vec3) => dot(sub(p, eye), n);
  // Between the two rays, and in front of the eye.
  const inWedge = (p: Vec3) => { const r = sub(p, eye); return dot(cross(u, r), n) >= -eps && dot(cross(r, w), n) >= -eps && dot(r, [u[0] + w[0], u[1] + w[1], u[2] + w[2]]) > 0; };
  const on = (v: number) => Math.abs(d(V[v])) <= eps;

  // 1. Where each candidate face is crossed.
  const plans: { face: number; cuts: Crossing[] }[] = [];
  for (const fi of faces ?? mesh.faces.map((_, i) => i)) {
    const f = mesh.faces[fi];
    if (!f) continue;
    const cuts: Crossing[] = [];
    for (let i = 0; i < f.length; i++) {
      const a = f[i], b = f[(i + 1) % f.length];
      if (on(a)) { if (inWedge(V[a])) cuts.push({ vert: a }); continue; }
      if (on(b)) continue;
      const da = d(V[a]), db = d(V[b]);
      if ((da < 0) === (db < 0)) continue;
      const t = da / (da - db), p: Vec3 = [V[a][0] + t * (V[b][0] - V[a][0]), V[a][1] + t * (V[b][1] - V[a][1]), V[a][2] + t * (V[b][2] - V[a][2])];
      if (inWedge(p)) cuts.push({ edge: EditMesh.edgeKey(a, b), a, b, p, after: i });
    }
    // 2. Exactly two crossings, and not two corners already joined by an edge of the face.
    if (cuts.length !== 2) continue;
    if ('vert' in cuts[0] && 'vert' in cuts[1]) {
      const i = f.indexOf(cuts[0].vert), j = f.indexOf(cuts[1].vert);
      if (Math.abs(i - j) === 1 || Math.abs(i - j) === f.length - 1) continue;
    }
    plans.push({ face: fi, cuts });
  }
  if (!plans.length) return [];

  // New vertices on crossed edges, one per edge, shared by the faces on both sides.
  const edgeVert = new Map<string, number>();
  for (const pl of plans) for (const c of pl.cuts) if ('edge' in c && !edgeVert.has(c.edge)) { edgeVert.set(c.edge, V.length); V.push(c.p); }

  // Split the planned faces; put the new vertices into every other face that has those edges.
  const split = new Map(plans.map((pl) => [pl.face, pl]));
  const out: number[][] = [], cutEdges: [number, number][] = [];
  mesh.faces.forEach((f, fi) => {
    const ring: number[] = [];
    f.forEach((a, i) => {
      ring.push(a);
      const nv = edgeVert.get(EditMesh.edgeKey(a, f[(i + 1) % f.length]));
      if (nv !== undefined) ring.push(nv);
    });
    const pl = split.get(fi);
    if (!pl) { out.push(ring); return; }
    const ends = pl.cuts.map((c) => ('vert' in c ? c.vert : edgeVert.get(c.edge)!));
    const i = ring.indexOf(ends[0]), j = ring.indexOf(ends[1]);
    const [lo, hi] = i < j ? [i, j] : [j, i];
    out.push(ring.slice(lo, hi + 1), [...ring.slice(hi), ...ring.slice(0, lo + 1)]);
    cutEdges.push([ring[lo], ring[hi]]);
  });
  mesh.faces = out;
  mesh.touch();
  trace?.step({
    phase: 'Knife', label: `${plans.length} face${plans.length === 1 ? '' : 's'} cut, ${edgeVert.size} new vertices on edges`,
    detail: 'The knife is the plane through the eye and the line’s two ends. Each crossed edge gets a vertex at p = a + t(b − a), t = d(a) / (d(a) − d(b)); each face crossed twice is split between the two.',
    points: [...edgeVert.values()].map((v) => ({ p: V[v], color: '#f59e0b' })),
  }, mesh);
  return cutEdges;
}

/** The faces a knife cuts: those facing the eye, or all of them when it cuts through (X-ray). */
export function knifeFaces(mesh: EditMesh, eye: Vec3, through = false): number[] {
  return mesh.faces.map((_, i) => i).filter((i) => through || dot(mesh.faceNormal(i), sub(eye, mesh.faceCenter(i))) > 0);
}
