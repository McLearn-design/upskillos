// Weight painting: change how much a bone moves each vertex with a brush.
//
// A dab at a point p changes the active bone's weight w at every vertex within the
// brush radius r, scaled by a smooth falloff f and the strength s:
//
//   f(d)      = (1 − (d/r)²)²                 1 at the centre, 0 at the rim, smooth at both
//   draw      w ← w + s·f·(value − w)          move toward the brush value
//   add       w ← w + s·f·value                (clamped to 1)
//   subtract  w ← w − s·f·value                (clamped to 0)
//   blur      w ← w + s·f·(w̄ − w)              toward the average of the neighbours
//
// With auto-normalise on (Blender's default for deforming bones) the painted bone's
// new weight is kept and the other bones at that vertex are scaled so all of them
// still sum to 1: painting the spine up paints the arm down.
//
// X-mirror paints the vertex on the other side too, with the bone of the other side
// (UpperArm.L ↔ UpperArm.R), so a character stays symmetric.

import type { Vec3 } from './EditMesh';
import type { Skin } from './armature';

export type Brush = 'draw' | 'add' | 'subtract' | 'blur';
export const BRUSHES: Brush[] = ['draw', 'add', 'subtract', 'blur'];

export interface PaintSettings {
  brush: Brush;
  /** Brush radius, in the mesh's own units. */
  radius: number;
  /** 0–1: how much one dab changes a weight at the brush centre. */
  strength: number;
  /** The weight the draw brush paints toward (and the amount add/subtract use). */
  value: number;
  normalize: boolean;
  mirror: boolean;
}

export const DEFAULT_PAINT: PaintSettings = { brush: 'draw', radius: 0.3, strength: 0.5, value: 1, normalize: true, mirror: false };

export const falloff = (d: number, r: number) => (d >= r ? 0 : (1 - (d / r) ** 2) ** 2);

/** The bone on the other side: .L ↔ .R, _L ↔ _R, Left ↔ Right. The same name if there is none. */
export function mirrorBoneName(n: string): string {
  const swaps: [RegExp, (m: string) => string][] = [
    [/([._-])([LR])$/, (m) => m[0] + (m[1] === 'L' ? 'R' : 'L')],
    [/([._-])([lr])$/, (m) => m[0] + (m[1] === 'l' ? 'r' : 'l')],
    [/Left/, () => 'Right'], [/Right/, () => 'Left'],
  ];
  for (const [re, f] of swaps) if (re.test(n)) return n.replace(re, (m) => f(m));
  return n;
}

/** Neighbouring vertices of each vertex, from faces. */
export function neighbourLists(n: number, faces: number[][]): number[][] {
  const nb: Set<number>[] = Array.from({ length: n }, () => new Set());
  for (const f of faces) f.forEach((a, i) => { const b = f[(i + 1) % f.length]; nb[a].add(b); nb[b].add(a); });
  return nb.map((s) => [...s]);
}

/** Set one bone's weight at a vertex, scaling the other bones to keep the sum at 1. */
export function setWeight(skin: Skin, b: number, v: number, w: number, normalize: boolean): void {
  w = Math.max(0, Math.min(1, w));
  skin.weights[b][v] = w;
  if (!normalize) return;
  let others = 0;
  for (let k = 0; k < skin.weights.length; k++) if (k !== b) others += skin.weights[k][v];
  // Nothing else to take the remainder: the vertex keeps what it has (the painted bone at w; skinning divides by the sum).
  if (others <= 1e-12) return;
  const scale = (1 - w) / others;
  for (let k = 0; k < skin.weights.length; k++) if (k !== b) skin.weights[k][v] *= scale;
}

/**
 * One dab of the brush at `center` on the bone named `bone`. `positions` are where
 * the vertices are drawn (the posed mesh), so the brush lands where you see it.
 * Returns the vertices it changed.
 */
export function dab(skin: Skin, bone: string, positions: Vec3[], neighbours: number[][], center: Vec3, s: PaintSettings): number[] {
  const changed: number[] = [];
  const apply = (b: number, c: Vec3) => {
    if (b < 0) return;
    const w = skin.weights[b];
    const before = s.brush === 'blur' ? [...w] : w;
    positions.forEach((p, v) => {
      const f = falloff(Math.hypot(p[0] - c[0], p[1] - c[1], p[2] - c[2]), s.radius) * s.strength;
      if (f <= 0) return;
      let nw = w[v];
      if (s.brush === 'draw') nw += f * (s.value - nw);
      else if (s.brush === 'add') nw += f * s.value;
      else if (s.brush === 'subtract') nw -= f * s.value;
      else if (neighbours[v].length) nw += f * (neighbours[v].reduce((t, u) => t + before[u], 0) / neighbours[v].length - nw);
      setWeight(skin, b, v, nw, s.normalize);
      changed.push(v);
    });
  };
  const b = skin.bones.indexOf(bone);
  if (b < 0) throw new Error(`The skin has no bone called "${bone}"`);
  apply(b, center);
  if (s.mirror) {
    const mb = skin.bones.indexOf(mirrorBoneName(bone));
    apply(mb, [-center[0], center[1], center[2]]);
  }
  return changed;
}
