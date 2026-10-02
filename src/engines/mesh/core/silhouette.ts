// The silhouette: the outline of a mesh as seen from an eye. A face is front-facing if its normal points towards
// the eye, (eye − centre) · n > 0. An edge is on the silhouette when one of its faces is front-facing and the other
// is not; an open edge of a front-facing face is on it too. Modellers judge a shape by its silhouette first, and
// renderers draw outlines and shadows from it.

import type { EditMesh, Vec3 } from './EditMesh';
import { Trace, fmt, fmtV } from './trace';

const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/** Classify faces as front or back facing from `eye` (in the mesh's own coordinates) and find the silhouette edges. */
export function traceSilhouette(mesh: EditMesh, eye: Vec3, trace?: Trace): { front: number[]; edges: [number, number][] } {
  const facing = mesh.faces.map((_, fi) => dot(sub(eye, mesh.faceCenter(fi)), mesh.faceNormal(fi)) > 0);
  const front = facing.flatMap((f, i) => (f ? [i] : []));
  if (trace) {
    // Ask about the face whose answer is least obvious: the one seen most nearly edge-on.
    let ask = 0, best = Infinity;
    mesh.faces.forEach((_, fi) => {
      const d = sub(eye, mesh.faceCenter(fi)), l = Math.hypot(...d) || 1;
      const c = Math.abs(dot(d, mesh.faceNormal(fi)) / l);
      if (c < best && c > 0.05) { best = c; ask = fi; }
    });
    const c = mesh.faceCenter(ask), n = mesh.faceNormal(ask);
    trace.step({
      phase: 'Facing', label: `${front.length} of ${mesh.faces.length} faces face the eye at ${fmtV(eye)}`,
      detail: 'A face is front-facing if the direction from it to the eye is on the same side as its normal: (eye − centre) · n > 0. Back-facing faces are hidden behind the front ones (on a closed mesh), and renderers often skip them.',
      faces: front,
      values: [['face', String(ask)], ['centre', fmtV(c)], ['normal', fmtV(n)], ['(eye − centre) · n', fmt(dot(sub(eye, c), n))]],
      quiz: { prompt: `Face ${ask} has centre ${fmtV(c)} and normal ${fmtV(n)}; the eye is at ${fmtV(eye)}. Does it face the eye? Answer 1 for yes, 0 for no.`, answer: [facing[ask] ? 1 : 0], labels: ['faces the eye'], rule: 'Front-facing when (eye − centre) · n > 0.', tolerance: 0 },
    }, mesh.verts.length <= trace.snapshotLimit ? mesh : undefined);
  }
  const edges: [number, number][] = [];
  for (const e of mesh.edges().values()) {
    const f = e.faces.map((fi) => facing[fi]);
    if ((f.length === 2 && f[0] !== f[1]) || (f.length === 1 && f[0])) edges.push([e.a, e.b]);
  }
  trace?.step({
    phase: 'Silhouette', label: `${edges.length} silhouette edges: a front face on one side, a back face (or nothing) on the other`,
    detail: 'Where the surface turns away from the eye, front and back faces meet: those edges are the outline you see. Changing the view changes which edges they are; the shape you model is judged by them first.',
    edges,
  }, trace && mesh.verts.length <= trace.snapshotLimit ? mesh : undefined);
  return { front, edges };
}
