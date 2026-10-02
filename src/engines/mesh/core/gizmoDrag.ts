// Dragging along a gizmo axis (Object › Trace a gizmo drag): the mouse moves on a flat screen, but the object must
// move along one 3D axis. Each mouse position gives a pick ray (lesson 4.1); the point of the axis line closest to
// that ray is where the mouse "is" on the axis. The move is the difference between the start and the current
// closest points, rounded to the snap step if snapping is on. three.js's TransformControls, which MeshLab's
// gizmo uses, does the same with a plane through the axis; for one axis the two agree.

import type { Vec3 } from './EditMesh';
import type { Ray } from './pickRay';
import type { Trace } from './trace';

/** The Snap button's steps: moves round to 0.25, turns to 15°, scales to 0.1 (the viewport's gizmo uses these). */
export const SNAP = { move: 0.25, turnDeg: 15, scale: 0.1 };

const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/** The parameter s of the point o + s·u on the axis line closest to the ray (null if they are parallel). */
export function closestOnAxis(o: Vec3, u: Vec3, ray: Ray): number | null {
  const w = sub(o, ray.origin), a = dot(u, u), b = dot(u, ray.dir), c = dot(ray.dir, ray.dir), d = dot(u, w), e = dot(ray.dir, w);
  const den = a * c - b * b;
  if (Math.abs(den) < 1e-12) return null;
  return (b * e - c * d) / den;
}

/** A drag along an axis from one pick ray to another: the move, and the move snapped. Traced. */
export function traceAxisDrag(o: Vec3, u: Vec3, from: Ray, to: Ray, snap: number | null, trace?: Trace): { s0: number; s1: number; move: number; snapped: number } | null {
  const r = (x: number) => +(Math.abs(x) < 1e-12 ? 0 : x).toFixed(4);
  const v3 = (p: Vec3) => `(${p.map(r).join(', ')})`;
  const s0 = closestOnAxis(o, u, from), s1 = closestOnAxis(o, u, to);
  if (s0 === null || s1 === null) { trace?.step({ phase: 'Parallel', label: 'The axis points straight at the eye: every mouse position is the same point on it', detail: 'When the axis and the pick ray are parallel there is no closest point; gizmos hide or fade such an arrow.', values: [] }); return null; }
  const move = s1 - s0, snapped = snap ? Math.round(move / snap) * snap : move;
  if (trace) {
    const at = (s: number): Vec3 => [o[0] + s * u[0], o[1] + s * u[1], o[2] + s * u[2]];
    trace.step({ phase: 'Axis', label: `The axis: from ${v3(o)} along ${v3(u)}`, detail: 'The object may only move along this line. The arrow you grab is drawn along it.', values: [['origin', v3(o)], ['direction', v3(u)]] });
    trace.step({ phase: 'Grab', label: `The ray at the first mouse position passes closest to the axis at s = ${r(s0)}, the point ${v3(at(s0))}`, detail: 'Two lines in 3D usually do not meet. The closest points are where the segment joining them is at right angles to both: s = (b·e − c·d) / (a·c − b²) with a = u·u, b = u·d, c = d·d, d = u·w, e = d·w and w = o − eye.', values: [['ray', `${v3(from.origin)} along ${v3(from.dir)}`], ['s at the start', String(r(s0))]] });
    trace.step({
      phase: 'Drag', label: `At the current mouse position, s = ${r(s1)}: the object moves ${r(move)} along the axis`,
      detail: 'The same closest point for the ray under the mouse now. The difference is the move: the mouse\'s motion projected onto the axis, the way the axis is seen.',
      values: [['s now', String(r(s1))], ['move = s now − s at the start', String(r(move))]],
      quiz: { prompt: `The grab was at s = ${r(s0)} along the axis; now the ray passes closest at s = ${r(s1)}. How far does the object move along the axis?`, answer: [move], labels: ['move'], rule: 'The difference of the two closest-point parameters.', tolerance: 0.005 },
    });
    trace.step({
      phase: 'Snap', label: snap ? `Snap to ${snap}: ${r(move)} becomes ${r(snapped)}` : 'Snap is off: the move is used as it is',
      detail: snap ? 'Snapping rounds the move to the nearest multiple of the step, so drags land on round numbers.' : 'Turn on Snap (toolbar) to round moves to 0.25, turns to 15° and scales to 0.1.',
      values: [['snapped move', String(r(snapped))]],
      quiz: snap ? { prompt: `Snap step ${snap}. What does a move of ${r(move)} become?`, answer: [snapped], labels: ['snapped'], rule: 'Round to the nearest multiple of the step.', tolerance: 1e-6 } : undefined,
    });
  }
  return { s0, s1, move, snapped };
}
