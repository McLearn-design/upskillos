// Projection (UV › Project from above, UV › Project around): the quickest UVs. A planar projection drops one
// coordinate, u and v are the other two, fitted to the unit square; a cylindrical one uses the angle round an axis
// for u and the height along it for v. No seams are needed, but the map can only be faithful where the surface faces
// the projection: a face tilted θ away from the projection plane is squashed by cos θ, so its angle distortion
// σ₁/σ₂ is 1/cos θ, and faces seen edge-on collapse to a line.

import type { EditMesh, Vec3 } from './EditMesh';
import { angleDistortion, planarUV, type UV, type UVLayer } from './uv';
import { Trace, fmt } from './trace';

export type Projection = 'planar' | 'cylinder';

/** "− 1.2" or "+ 1.2": subtracting x, written so a negative x does not print as "− −1.2". */
const minus = (x: number, d = 3) => (x < 0 ? `+ ${fmt(-x, d)}` : `− ${fmt(x, d)}`);

/** Cylindrical UVs round the y axis through the mesh's centre: u the angle, v the height, in matching units. */
export function cylinderUV(mesh: EditMesh): UVLayer {
  const V = mesh.verts;
  const cx = V.reduce((s, p) => s + p[0], 0) / V.length, cz = V.reduce((s, p) => s + p[2], 0) / V.length;
  const ys = V.map((p) => p[1]), y0 = Math.min(...ys), h = Math.max(...ys) - y0 || 1;
  const R = V.reduce((s, p) => s + Math.hypot(p[0] - cx, p[2] - cz), 0) / V.length || 1;
  const around = 2 * Math.PI * R, scale = Math.max(around, h);
  const t = (p: Vec3) => Math.atan2(p[2] - cz, p[0] - cx) / (2 * Math.PI) + 0.5;     // 0 … 1 round the axis
  return {
    faces: mesh.faces.map((f) => {
      let ts = f.map((v) => t(V[v]));
      // A face that straddles the line where the angle wraps from 1 back to 0 would stretch across the whole
      // texture: move its small values up by one turn so it stays narrow.
      if (Math.max(...ts) - Math.min(...ts) > 0.5) ts = ts.map((x) => (x < 0.5 ? x + 1 : x));
      return f.map((v, i) => [(ts[i] * around) / scale, (V[v][1] - y0) / scale] as UV);
    }),
  };
}

export interface ProjectionReport { layer: UVLayer; worst: number; mean: number; steep: number; wrapped: number }

export function traceUVProjection(mesh: EditMesh, kind: Projection, trace?: Trace): ProjectionReport {
  const V = mesh.verts;
  const layer = kind === 'planar' ? planarUV(mesh) : cylinderUV(mesh);
  const dist = angleDistortion(mesh, layer);
  let worst = 0, sum = 0;
  dist.forEach((d) => { worst = Math.max(worst, d); sum += d; });
  const mean = sum / (dist.length || 1);
  const centre = [V.reduce((s, p) => s + p[0], 0) / V.length, V.reduce((s, p) => s + p[2], 0) / V.length];
  // Faces tilted more than 60° from the projection's plane: stretched more than 2 : 1.
  const steep = mesh.faces.filter((_, fi) => {
    const n = mesh.faceNormal(fi), c = mesh.faceCenter(fi);
    if (kind === 'planar') return Math.abs(n[1]) < 0.5;
    const r = Math.hypot(c[0] - centre[0], c[2] - centre[1]) || 1;
    return Math.abs((n[0] * (c[0] - centre[0]) + n[2] * (c[2] - centre[1])) / r) < 0.5;
  }).length;
  // Faces that straddle the cylinder's wrap line (where the angle jumps from one turn back to zero).
  const turn = (p: Vec3) => Math.atan2(p[2] - centre[1], p[0] - centre[0]) / (2 * Math.PI) + 0.5;
  const straddle = kind === 'cylinder' ? mesh.faces.flatMap((f, fi) => { const t = f.map((v) => turn(V[v])); return Math.max(...t) - Math.min(...t) > 0.5 ? [fi] : []; }) : [];
  const wrapped = straddle.length;
  if (trace) {
    const xs = V.map((p) => p[0]), zs = V.map((p) => p[2]), ys = V.map((p) => p[1]);
    const v = V.reduce((b, p, i) => (p[1] > V[b][1] + 1e-9 || (Math.abs(p[1] - V[b][1]) < 1e-9 && p[0] > V[b][0]) ? i : b), 0);
    const fi = mesh.faces.findIndex((f) => f.includes(v)), ci = mesh.faces[fi].indexOf(v), uv = layer.faces[fi][ci];
    if (kind === 'planar') {
      const x0 = Math.min(...xs), z0 = Math.min(...zs), s = Math.max(Math.max(...xs) - x0, Math.max(...zs) - z0) || 1;
      trace.step({
        phase: 'Direction', label: `Project straight down (along y): u from x, v from z; fitted to the square with scale ${fmt(s, 4)}`,
        detail: `Every vertex keeps its x and z and loses its height: u = (x ${minus(x0)}) / ${fmt(s, 4)}, v = (z ${minus(z0)}) / ${fmt(s, 4)}. The larger of the two widths sets the scale, so squares stay square.`,
        values: [['x range', `${fmt(x0, 3)} … ${fmt(Math.max(...xs), 3)}`], ['z range', `${fmt(z0, 3)} … ${fmt(Math.max(...zs), 3)}`], ['scale', fmt(s, 4)]],
      }, V.length <= trace.snapshotLimit ? mesh : undefined);
      trace.step({
        phase: 'One vertex', label: `v${v} at (${V[v].map((x) => fmt(x, 3)).join(', ')}) → (${fmt(uv[0], 4)}, ${fmt(uv[1], 4)})`,
        detail: 'Its height plays no part: every point straight above or below it gets the same UV.',
        verts: [v], points: [{ p: V[v], label: `(${fmt(uv[0], 3)}, ${fmt(uv[1], 3)})`, color: '#facc15' }],
        quiz: { prompt: `v${v} is at (${V[v].map((x) => fmt(x, 3)).join(', ')}). With u = (x ${minus(x0)}) / ${fmt(s, 4)} and v = (z ${minus(z0)}) / ${fmt(s, 4)}, what is its UV?`, answer: [uv[0], uv[1]], labels: ['u', 'v'], rule: 'Drop y; shift x and z to start at 0; divide by the scale.', tolerance: 0.002 },
      });
    } else {
      const [cx, cz] = centre;
      const y0 = Math.min(...ys), h = Math.max(...ys) - y0 || 1, R = V.reduce((s, p) => s + Math.hypot(p[0] - cx, p[2] - cz), 0) / V.length || 1;
      const around = 2 * Math.PI * R, scale = Math.max(around, h);
      trace.step({
        phase: 'Direction', label: `Project around the y axis through (${fmt(cx, 3)}, ${fmt(cz, 3)}): u from the angle, v from the height`,
        detail: `u = (angle / 2π + ½) · 2πR / S and v = (y ${minus(y0)}) / S, with R = ${fmt(R, 4)} the mean radius and S = ${fmt(scale, 4)} the larger of the circumference 2πR = ${fmt(around, 4)} and the height ${fmt(h, 4)}. Measuring both in the same units keeps checker squares square on the sides.`,
        values: [['mean radius R', fmt(R, 4)], ['circumference', fmt(around, 4)], ['height', fmt(h, 4)]],
      }, V.length <= trace.snapshotLimit ? mesh : undefined);
      const ang = Math.atan2(V[v][2] - cz, V[v][0] - cx);
      trace.step({
        phase: 'One vertex', label: `v${v}: angle ${fmt((ang * 180) / Math.PI, 1)}°, height ${fmt(V[v][1], 3)} → (${fmt(uv[0], 4)}, ${fmt(uv[1], 4)})`,
        detail: 'Its distance from the axis plays no part: every point along the same ray from the axis gets the same UV.',
        verts: [v], points: [{ p: V[v], label: `(${fmt(uv[0], 3)}, ${fmt(uv[1], 3)})`, color: '#facc15' }],
        quiz: { prompt: `v${v} is at angle ${fmt(ang, 4)} rad round the axis and height ${fmt(V[v][1], 4)}. With u = (angle/2π + ½)·${fmt(around, 4)}/${fmt(scale, 4)} and v = (y ${minus(y0, 4)})/${fmt(scale, 4)}, what is its UV?`, answer: [uv[0], uv[1]], labels: ['u', 'v'], rule: 'The angle as a fraction of a turn, times the circumference over the scale; the height over the scale.', tolerance: 0.003 },
      });
      trace.step({
        phase: 'Wrap', label: `${wrapped} face${wrapped === 1 ? ' straddles' : 's straddle'} the line where the angle wraps round; ${wrapped === 1 ? 'its' : 'their'} small u values are moved up by one turn`,
        detail: 'Going round, the angle jumps from +π back to −π. A face across that line would have corners at both ends of the texture and smear across all of it; adding a whole turn to its low corners keeps it narrow. The texture repeats, so the moved corners read the right texels. The wrap line is a seam: its vertices get two UVs.',
        faces: straddle,
      });
    }
    trace.step({
      phase: 'Stretch', label: `Angle distortion σ₁/σ₂: mean ${fmt(mean, 3)}, worst ${fmt(worst, 3)}; ${steep} face${steep === 1 ? '' : 's'} tilted more than 60° from the projection`,
      detail: 'A face tilted θ away from the plane it is projected onto is squashed by cos θ in one direction and kept in the other, so σ₁/σ₂ = 1/cos θ: 1 for faces facing the projection, 2 at 60°, and unbounded for faces seen edge-on (they collapse to a line). Projection is the right tool only where the surface faces it.',
      field: Array.from(dist), fieldLabel: 'angle distortion σ₁/σ₂',
    });
  }
  return { layer, worst, mean, steep, wrapped };
}
