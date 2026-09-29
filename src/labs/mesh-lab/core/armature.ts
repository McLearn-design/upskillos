// Bones and skinning.
//
// An armature is a tree of bones. Each bone has a rest position (head, tail) and
// a pose: a rotation about its head, in its own frame. Blender's convention:
// a bone's y axis runs from head to tail.
//
//   rest matrix      B  = T(head) · R(y axis → tail − head)     armature space, rest pose
//   offset           O  = B_parent⁻¹ · B                        where the bone sits on its parent
//   posed matrix     P  = P_parent · O · R(pose)                a root bone: P = B · R(pose)
//   skin matrix      S  = P · B⁻¹                               takes a rest point to its posed place
//
// Linear blend skinning moves each vertex by a weighted average of its bones' skin
// matrices:  v' = Σ_b w_b · S_b · v,  with Σ_b w_b = 1. In the rest pose every
// S is the identity and the mesh does not move.
//
// Weights come from "bone heat" (Baran & Popović 2007, Blender's automatic
// weights): treat each bone as a heater and let heat spread over the surface.
//   −Δw_b + H w_b = H p_b     H_j = 1/d_j², d_j the distance from vertex j to the
//                             nearest bone; p_b(j) = 1 where b is that nearest bone
// Multiplied by the mass matrix, with −Δ = M⁻¹C: (C + M H) w_b = M H p_b, one
// symmetric positive definite solve per bone, the same solver the heat maps use.
// The weights are then scaled to sum to 1 at every vertex.

import { Euler, Matrix4, Quaternion, Vector3 } from 'three';
import type { EditMesh, Vec3 } from './EditMesh';
import { operators, solveCG } from './geometry';
import { Trace, fmt, fmtV } from './trace';

export interface Bone {
  name: string;
  parent: string | null;
  /** Rest position, in the armature object's space. */
  head: Vec3;
  tail: Vec3;
  /** Pose rotation: Euler XYZ radians, in the bone's own rest frame. Zero is the rest pose. */
  pose: Vec3;
}

/** A mesh bound to an armature: one weight per vertex per bone, for the mesh the armature deforms. */
export interface Skin { armature: string; bones: string[]; weights: number[][]; verts: number }

export const cloneBones = (b: Bone[]): Bone[] => b.map((x) => ({ name: x.name, parent: x.parent, head: [...x.head] as Vec3, tail: [...x.tail] as Vec3, pose: [...x.pose] as Vec3 }));
export const cloneSkin = (s: Skin | undefined): Skin | undefined => s && { armature: s.armature, bones: [...s.bones], weights: s.weights.map((w) => [...w]), verts: s.verts };

const Y = new Vector3(0, 1, 0);

export function boneLength(b: Bone): number {
  return Math.hypot(b.tail[0] - b.head[0], b.tail[1] - b.head[1], b.tail[2] - b.head[2]);
}

/** The rest matrix B: origin at the head, y axis along the bone (the shortest turn from +y). */
export function restMatrix(b: Bone): Matrix4 {
  const dir = new Vector3(b.tail[0] - b.head[0], b.tail[1] - b.head[1], b.tail[2] - b.head[2]);
  const q = dir.lengthSq() > 1e-18 ? new Quaternion().setFromUnitVectors(Y, dir.normalize()) : new Quaternion();
  return new Matrix4().compose(new Vector3(...b.head), q, new Vector3(1, 1, 1));
}

/** Parents before children, so each bone's parent is posed first. Throws on a cycle or a missing parent. */
export function orderBones(bones: Bone[]): Bone[] {
  const byName = new Map(bones.map((b) => [b.name, b]));
  const out: Bone[] = [], state = new Map<string, 1 | 2>();
  const visit = (b: Bone) => {
    if (state.get(b.name) === 2) return;
    if (state.get(b.name) === 1) throw new Error(`Bone "${b.name}" is its own ancestor`);
    state.set(b.name, 1);
    if (b.parent) { const p = byName.get(b.parent); if (!p) throw new Error(`Bone "${b.name}" has a missing parent "${b.parent}"`); visit(p); }
    state.set(b.name, 2); out.push(b);
  };
  bones.forEach(visit);
  return out;
}

export interface BoneMatrices { rest: Matrix4; posed: Matrix4; skin: Matrix4 }

/** Rest, posed and skin matrices of every bone (armature space). `poses` overrides bone.pose (for sampling frames). */
export function boneMatrices(bones: Bone[], poses?: Map<string, Vec3>): Map<string, BoneMatrices> {
  const out = new Map<string, BoneMatrices>();
  for (const b of orderBones(bones)) {
    const rest = restMatrix(b);
    const p = poses?.get(b.name) ?? b.pose;
    const R = new Matrix4().makeRotationFromEuler(new Euler(p[0], p[1], p[2], 'XYZ'));
    const par = b.parent ? out.get(b.parent)! : null;
    // P = P_parent · (B_parent⁻¹ · B) · R(pose)
    const posed = par ? par.posed.clone().multiply(par.rest.clone().invert().multiply(rest)).multiply(R) : rest.clone().multiply(R);
    out.set(b.name, { rest, posed, skin: posed.clone().multiply(rest.clone().invert()) });
  }
  return out;
}

/** Where each bone's head and tail are in the current pose. */
export function posedEnds(bones: Bone[], mats = boneMatrices(bones)): Map<string, { head: Vec3; tail: Vec3 }> {
  const out = new Map<string, { head: Vec3; tail: Vec3 }>();
  for (const b of bones) {
    const P = mats.get(b.name)!.posed;
    const h = new Vector3(0, 0, 0).applyMatrix4(P), t = new Vector3(0, boneLength(b), 0).applyMatrix4(P);
    out.set(b.name, { head: [h.x, h.y, h.z], tail: [t.x, t.y, t.z] });
  }
  return out;
}

/** Distance from a point to the segment a–b, and where along it (0 at a, 1 at b) the nearest point is. */
export function segmentDistance(p: Vec3, a: Vec3, b: Vec3): { d: number; t: number } {
  const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], ap = [p[0] - a[0], p[1] - a[1], p[2] - a[2]];
  const L2 = ab[0] ** 2 + ab[1] ** 2 + ab[2] ** 2;
  const t = L2 > 0 ? Math.max(0, Math.min(1, (ap[0] * ab[0] + ap[1] * ab[1] + ap[2] * ab[2]) / L2)) : 0;
  return { d: Math.hypot(ap[0] - t * ab[0], ap[1] - t * ab[1], ap[2] - t * ab[2]), t };
}

/**
 * Linear blend skinning. `toArm` takes the mesh's coordinates into the armature's
 * space (and back with its inverse). With a trace, one vertex (`explain`) is
 * worked through: each bone's candidate position and the weighted blend.
 */
export function deform(mesh: EditMesh, skin: Skin, bones: Bone[], toArm = new Matrix4(), trace?: Trace, explain?: number, poses?: Map<string, Vec3>): EditMesh {
  const out = mesh.clone();
  if (skin.verts !== mesh.verts.length) return out; // weights are for a different mesh: leave it undeformed
  const mats = boneMatrices(bones, poses);
  const fromArm = toArm.clone().invert();
  const S = skin.bones.map((n) => mats.get(n)?.skin ?? new Matrix4());
  // Everything in one matrix per bone: mesh → armature → skin → mesh.
  const K = S.map((s) => fromArm.clone().multiply(s).multiply(toArm).elements);
  for (let i = 0; i < mesh.verts.length; i++) {
    const [x, y, z] = mesh.verts[i];
    let ox = 0, oy = 0, oz = 0, ws = 0;
    for (let b = 0; b < K.length; b++) {
      const w = skin.weights[b][i];
      if (!w) continue;
      const e = K[b];
      ox += w * (e[0] * x + e[4] * y + e[8] * z + e[12]);
      oy += w * (e[1] * x + e[5] * y + e[9] * z + e[13]);
      oz += w * (e[2] * x + e[6] * y + e[10] * z + e[14]);
      ws += w;
    }
    // Divide by the sum, so weights that do not add up to 1 (a bone was deleted, or a
    // script set them) still average; a vertex with no weight at all stays where it is.
    out.verts[i] = ws > 1e-12 ? [ox / ws, oy / ws, oz / ws] : [x, y, z];
  }
  if (trace && explain !== undefined && explain < mesh.verts.length) {
    const v = mesh.verts[explain];
    const parts = skin.bones.map((n, b) => ({ n, w: skin.weights[b][explain], p: new Vector3(...v).applyMatrix4(new Matrix4().fromArray(K[b])) })).filter((x) => x.w > 0);
    for (const x of parts) {
      trace.step({
        phase: 'Each bone moves the vertex', label: `${x.n}: S·v = ${fmtV([x.p.x, x.p.y, x.p.z])}, weight ${fmt(x.w)}`,
        detail: `Where vertex ${explain} would go if only bone "${x.n}" moved it: its skin matrix S = P·B⁻¹ applied to the rest position.`,
        verts: [explain], points: [{ p: [x.p.x, x.p.y, x.p.z], label: `${x.n} ×${fmt(x.w, 2)}`, color: '#38bdf8' }], values: [['weight', fmt(x.w)]],
      });
    }
    const r = out.verts[explain];
    trace.step({
      phase: 'Blend', label: `v' = Σ w·S·v = ${fmtV(r)}`,
      detail: 'The weighted average of the candidates. Averaging points (not rotations) is what makes it linear, and why a twisted joint loses volume: the "candy wrapper".',
      verts: [explain], points: [...parts.map((x) => ({ p: [x.p.x, x.p.y, x.p.z] as Vec3, color: '#38bdf8' })), { p: r, label: 'blend', color: '#f59e0b' }],
      arrows: [{ from: v, to: r, color: '#f59e0b' }],
    }, out);
  }
  return out;
}

/**
 * Automatic weights by bone heat. `mesh` must already be in the armature's space.
 * Returns weights[b][v] for the bones in the order given.
 */
export function boneHeatWeights(mesh: EditMesh, bones: Bone[], trace?: Trace, { low = 0.025, high = 0.05 } = {}): number[][] {
  const n = mesh.verts.length, B = bones.length;
  if (!B) throw new Error('The armature has no bones');
  const { C, mass } = operators(mesh);
  // Nearest bone(s) and the heat each vertex receives.
  const H = new Float64Array(n), nearest: number[][] = [], dmin = new Float64Array(n);
  for (let j = 0; j < n; j++) {
    const ds = bones.map((b) => segmentDistance(mesh.verts[j], b.head, b.tail).d);
    const m = Math.max(1e-4, Math.min(...ds));
    dmin[j] = m;
    H[j] = 1 / (m * m);
    nearest.push(ds.map((d, b) => [d, b]).filter(([d]) => d <= m * 1.0001 + 1e-9).map(([, b]) => b));
  }
  trace?.step({
    phase: 'Nearest bone', label: `Each of ${n} vertices finds its nearest bone; heat H = 1/d²`,
    detail: 'A vertex close to a bone is strongly heated by it (H large); a far one weakly. Only the nearest bone heats a vertex: which vertices each bone reaches beyond that is decided by the heat spreading.',
    field: Array.from(dmin), fieldLabel: 'distance to the nearest bone',
  });
  const A = C.plusDiag(Float64Array.from(mass, (m, j) => m * H[j]));
  const raw: Float64Array[] = [];
  bones.forEach((bone, b) => {
    const rhs = Float64Array.from({ length: n }, (_, j) => (nearest[j].includes(b) ? (mass[j] * H[j]) / nearest[j].length : 0));
    const r = solveCG(A, rhs, { tol: 1e-9 });
    raw.push(r.x);
    if (trace && trace.detailed(1)) {
      trace.step({
        phase: 'Heat from each bone', label: `"${bone.name}": solve (C + M·H) w = M·H·p in ${r.iterations} CG iterations`,
        detail: 'p is 1 where this bone is the nearest, 0 elsewhere. The Laplacian term C smooths w along the surface, so a vertex gets some weight from a bone that is close along the skin even if another bone is nearer through the air.',
        field: Array.from(r.x), fieldLabel: `heat from ${bone.name}`,
      });
    }
  });
  // Heat never quite reaches zero: a hip vertex still gets a few percent from the shin.
  // As Blender does, weights below `low` are dropped and those up to `high` fade in
  // (w · (w − low)/(high − low)), then each vertex's weights are scaled to sum to 1.
  const w = raw.map((x) => Array.from(x, (v) => Math.max(0, Math.min(1, v))));
  const sums = new Float64Array(n);
  for (let j = 0; j < n; j++) {
    let s = 0;
    for (let b = 0; b < B; b++) s += w[b][j];
    sums[j] = s;
    for (let b = 0; b < B; b++) w[b][j] = s > 0 ? w[b][j] / s : 0;
    let s2 = 0;
    for (let b = 0; b < B; b++) {
      const x = w[b][j];
      w[b][j] = x <= low ? 0 : x < high ? (x * (x - low)) / (high - low) : x;
      s2 += w[b][j];
    }
    if (s2 > 0) for (let b = 0; b < B; b++) w[b][j] /= s2;
    else for (const b of nearest[j]) w[b][j] = 1 / nearest[j].length;
  }
  trace?.step({
    phase: 'Normalise', label: `Weights scaled to sum to 1 at every vertex; below ${low} dropped, up to ${high} faded`,
    detail: 'Linear blend skinning averages the bones\' motions, so the weights must add up to 1: otherwise a vertex would shrink toward (or swell away from) the origin when all bones move together.',
    field: Array.from(sums), fieldLabel: 'sum of raw weights',
  });
  return w;
}

/**
 * Keep only each vertex's `k` strongest weights, scaled to sum to 1. glTF, three.js
 * and game engines skin with four bones per vertex; limiting here makes what
 * MeshLab shows match what they will show. Returns how many vertices changed.
 */
export function limitWeights(skin: Skin, k: number): number {
  let changed = 0;
  for (let i = 0; i < skin.verts; i++) {
    const nz = skin.weights.map((w, b) => [b, w[i]] as const).filter(([, w]) => w > 0);
    if (nz.length <= k) continue;
    changed++;
    const keep = new Set(nz.sort((a, b) => b[1] - a[1]).slice(0, k).map(([b]) => b));
    const sum = nz.filter(([b]) => keep.has(b)).reduce((s, [, w]) => s + w, 0);
    skin.weights.forEach((w, b) => { w[i] = keep.has(b) ? w[i] / sum : 0; });
  }
  return changed;
}

/** Bones of a simple chain from a list of joint positions: Bone, Bone.001 … each parented to the one before. */
export function chain(names: string[], joints: Vec3[], parent: string | null = null): Bone[] {
  return names.map((name, i) => ({ name, parent: i ? names[i - 1] : parent, head: joints[i], tail: joints[i + 1], pose: [0, 0, 0] }));
}
