// Traces of bones: the rest matrix built from a bone's head, tail and roll, and posing a chain of bones (the
// posed matrix walked down from the root, and the skin matrix that carries rest points to their posed places).
// Everything is in the armature object's space, as in armature.ts.

import { Euler, Matrix4, Vector3 } from 'three';
import type { Vec3 } from './EditMesh';
import { boneLength, boneMatrices, restMatrix, type Bone } from './armature';
import { Trace, fmt, fmtV } from './trace';

const v3 = (v: Vector3): Vec3 => [v.x, v.y, v.z];
const deg = (r: number) => (r * 180) / Math.PI;
/** The x, y and z axes (the first three columns) and the origin of a matrix. */
export function frameOf(m: Matrix4): { x: Vec3; y: Vec3; z: Vec3; o: Vec3 } {
  const e = m.elements;
  return { x: [e[0], e[1], e[2]], y: [e[4], e[5], e[6]], z: [e[8], e[9], e[10]], o: [e[12], e[13], e[14]] };
}
const rows = (m: Matrix4, d = 3): [string, string][] => {
  const e = m.elements;
  return [0, 1, 2, 3].map((r) => [`row ${r + 1}`, `[${[0, 1, 2, 3].map((c) => fmt(e[c * 4 + r], d)).join(', ')}]`] as [string, string]);
};
const axisArrows = (f: { x: Vec3; y: Vec3; z: Vec3; o: Vec3 }, len: number) =>
  (['x', 'y', 'z'] as const).map((k, i) => ({ from: f.o, to: f.o.map((c, j) => c + len * f[k][j]) as Vec3, label: k, color: ['#ef4444', '#22c55e', '#3b82f6'][i] }));

/**
 * The rest matrix B of one bone, step by step: the direction and length from head to tail, the shortest turn
 * that takes +y onto that direction, the roll about the bone's own y axis, and B with the axes as its columns.
 */
export function traceRestMatrix(b: Bone, trace?: Trace): { matrix: Matrix4; length: number; turn: number; axis: Vec3 } {
  const length = boneLength(b);
  const d = new Vector3(b.tail[0] - b.head[0], b.tail[1] - b.head[1], b.tail[2] - b.head[2]).normalize();
  const turn = Math.acos(Math.max(-1, Math.min(1, d.y)));
  const ax = new Vector3(0, 1, 0).cross(d);
  const axis: Vec3 = ax.lengthSq() > 1e-18 ? v3(ax.normalize()) : [1, 0, 0];
  const matrix = restMatrix(b);
  if (trace) {
    const noRoll = restMatrix({ ...b, roll: 0 }), f0 = frameOf(noRoll), f = frameOf(matrix);
    trace.step({
      phase: 'Direction', label: `${b.name}: tail − head = ${fmtV([b.tail[0] - b.head[0], b.tail[1] - b.head[1], b.tail[2] - b.head[2]])}`,
      detail: 'A bone is stored as two points: its head (where it pivots) and its tail. The difference is the bone\'s direction; its length is how long the bone is. The bone\'s own y axis will point this way.',
      points: [{ p: b.head, label: 'head' }, { p: b.tail, label: 'tail', color: '#f59e0b' }],
      quiz: { prompt: `Head ${fmtV(b.head)}, tail ${fmtV(b.tail)}. How long is the bone?`, answer: [length], labels: ['length'], rule: 'length = |tail − head|', tolerance: 1e-3 },
    });
    trace.step({
      phase: 'Turn', label: `The shortest turn from +y onto the bone: ${fmt(deg(turn), 2)}° about ${fmtV(axis)}`,
      detail: 'Start from the armature\'s own axes and turn them as little as possible so that +y lies along the bone: about the axis y × d, by the angle whose cosine is y · d. That turn carries x and z along with it.',
      arrows: axisArrows(f0, Math.min(0.5, length / 2)),
      quiz: { prompt: `The bone points along ${fmtV(v3(d))} (unit length). By how many degrees must +y turn to lie along it?`, answer: [deg(turn)], labels: ['degrees'], rule: 'cos θ = y · d = d_y', tolerance: 0.05 },
    });
    trace.step({
      phase: 'Roll', label: b.roll ? `Roll ${fmt(deg(b.roll), 2)}° about the bone's own y: x now ${fmtV(f.x)}` : 'Roll 0: x and z stay where the turn left them',
      detail: 'The direction fixes only y. Roll turns the bone\'s x and z axes about its length; the bone does not move, but a pose rotation about x now bends it in a different plane (lesson 11.3).',
      arrows: axisArrows(f, Math.min(0.5, length / 2)),
    });
    trace.step({
      phase: 'Matrix', label: `B: columns x ${fmtV(f.x)}, y ${fmtV(f.y)}, z ${fmtV(f.z)}, origin ${fmtV(f.o)}`,
      detail: 'The rest matrix B = T(head) · R(+y → bone) · R_y(roll). Its first three columns are the bone\'s axes in armature space and its last column is the head. B carries a point given in the bone\'s own frame to armature space; B⁻¹ carries it back.',
      values: rows(matrix),
      arrows: axisArrows(f, Math.min(0.5, length / 2)),
    });
  }
  return { matrix, length, turn, axis };
}

/**
 * Posing a bone at the end of its chain: walk from the root, at each bone multiply the parent's posed matrix by
 * the offset O = B_parent⁻¹ · B (where the bone sits on its parent) and the bone's own pose rotation; then the
 * skin matrix S = P · B⁻¹, and where it carries the bone's rest tail.
 */
export function tracePose(bones: Bone[], name: string, trace?: Trace): { posed: Matrix4; skin: Matrix4; tail: Vec3; chain: string[] } {
  const byName = new Map(bones.map((b) => [b.name, b]));
  const target = byName.get(name);
  if (!target) throw new Error(`No bone called "${name}"`);
  const chain: Bone[] = [];
  for (let b: Bone | undefined = target; b; b = b.parent ? byName.get(b.parent) : undefined) chain.unshift(b);
  const mats = boneMatrices(bones);
  const { posed, skin } = mats.get(name)!;
  const tail = v3(new Vector3(...target.tail).applyMatrix4(skin));
  if (trace) {
    trace.step({
      phase: 'Chain', label: chain.map((b) => b.name).join(' → '),
      detail: 'A bone is posed after its parent: its posed matrix starts from the parent\'s. So walk down from the root. (MeshLab sorts all bones parents-first once and poses them in that order.)',
    });
    let P: Matrix4 | null = null, parentRest: Matrix4 | null = null;
    for (const b of chain) {
      const B = restMatrix(b), R = new Matrix4().makeRotationFromEuler(new Euler(b.pose[0], b.pose[1], b.pose[2], 'XYZ'));
      const O = parentRest ? parentRest.clone().invert().multiply(B) : B.clone();
      P = P ? P.clone().multiply(O).multiply(R) : O.clone().multiply(R);
      const f = frameOf(P), head = f.o, tip = v3(new Vector3(0, boneLength(b), 0).applyMatrix4(P));
      const posedRot = b.pose.some((x) => Math.abs(x) > 1e-12);
      trace.step({
        phase: 'Pose', label: `${b.name}: pose ${posedRot ? `(${b.pose.map((x) => fmt(deg(x), 1)).join('°, ')}°)` : 'none'}; posed head ${fmtV(head)}, tail ${fmtV(tip)}`,
        detail: chain[0] === b
          ? 'The root: P = B · R(pose). The pose turns the bone about its own head, in its own frame (x, y, z of B).'
          : 'P = P_parent · O · R(pose), with O = B_parent⁻¹ · B, where this bone sits in its parent\'s frame. Whatever the parent did carries the child along; then the child adds its own turn about its own head.',
        points: [{ p: head, label: b.name }, { p: tip, color: '#f59e0b' }],
        arrows: axisArrows(f, Math.min(0.4, boneLength(b) / 2)),
        values: [['O (offset) origin', fmtV(frameOf(O).o)], ['posed y axis', fmtV(f.y)]],
        ...(b === target ? { quiz: { prompt: `Where is ${b.name}'s tail once posed (armature space)?`, answer: tip, labels: ['x', 'y', 'z'], rule: 'tail = P · (0, length, 0)', tolerance: 1e-3 } } : {}),
      });
      parentRest = B;
    }
    trace.step({
      phase: 'Skin matrix', label: `S = P · B⁻¹ carries the rest tail ${fmtV(target.tail)} to ${fmtV(tail)}`,
      detail: 'A mesh is modelled in the rest pose, in armature space. B⁻¹ takes a rest point into the bone\'s own frame; P takes it from there to where the posed bone is. So S = P · B⁻¹ moves any rest point the way the bone moved: the identity in the rest pose. Skinning (lesson 11.4) blends these matrices.',
      values: rows(skin),
      points: [{ p: target.tail, label: 'rest tail' }, { p: tail, label: 'posed tail', color: '#f59e0b' }],
    });
  }
  return { posed, skin, tail, chain: chain.map((b) => b.name) };
}
