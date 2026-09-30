// 2D transforms, shared by the editor viewport and the engine so both put a node
// in exactly the same place.
//
// A transform is the affine map p ↦ M·p + t, stored as [a, b, c, d, tx, ty]:
//
//   | a  c  tx |      x' = a·x + c·y + tx
//   | b  d  ty |      y' = b·x + d·y + ty
//
// A node's local transform is translate(position) · rotate(rotation) · scale(scale):
// scaled first, then turned, then moved. Its world transform is its parent's world
// transform times its local one. With +y down, a positive rotation turns clockwise
// on screen.

import type { Vec2 } from './types';

export type Mat2D = [number, number, number, number, number, number];

export const IDENTITY: Mat2D = [1, 0, 0, 1, 0, 0];

export function local(position: Vec2, rotation: number, scale: Vec2): Mat2D {
  const c = Math.cos(rotation), s = Math.sin(rotation);
  return [c * scale.x, s * scale.x, -s * scale.y, c * scale.y, position.x, position.y];
}

/** m · n: apply n first, then m. */
export function multiply(m: Mat2D, n: Mat2D): Mat2D {
  return [
    m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1],
    m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3],
    m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5],
  ];
}

export function apply(m: Mat2D, p: Vec2): Vec2 {
  return { x: m[0] * p.x + m[2] * p.y + m[4], y: m[1] * p.x + m[3] * p.y + m[5] };
}

export function invert(m: Mat2D): Mat2D {
  const det = m[0] * m[3] - m[1] * m[2];
  if (Math.abs(det) < 1e-12) throw new Error('This transform squashes everything flat (a scale of 0), so it cannot be undone');
  const a = m[3] / det, b = -m[1] / det, c = -m[2] / det, d = m[0] / det;
  return [a, b, c, d, -(a * m[4] + c * m[5]), -(b * m[4] + d * m[5])];
}

/**
 * Split a transform back into position, rotation and scale. Exact when there is no
 * skew; a parent with a non-uniform scale and a turned child makes skew, which this
 * cannot represent, so the result is the nearest turn-and-stretch.
 */
export function decompose(m: Mat2D): { position: Vec2; rotation: number; scale: Vec2 } {
  const sx = Math.hypot(m[0], m[1]);
  const det = m[0] * m[3] - m[1] * m[2];
  const rotation = Math.atan2(m[1], m[0]);
  return { position: { x: m[4], y: m[5] }, rotation, scale: { x: sx, y: sx === 0 ? 0 : det / sx } };
}
