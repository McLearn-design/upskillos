// Keyframe animation.
//
// A keyframe pins a transform channel (position, rotation or scale) to a value
// at a frame. Between two keys the value is interpolated:
//
//   t = (frame − f₀) / (f₁ − f₀)            how far through the gap, 0 → 1
//   s = ease(t)                             linear: s = t;  ease: s = 3t² − 2t³
//   value = v₀ + s · (v₁ − v₀)              position and scale, per component
//
// Rotation can be interpolated two ways, and seeing the difference is the point:
//
//   Euler     each angle separately, like position. Simple, but the path through
//             orientations is not the shortest and its speed is uneven.
//   slerp     both orientations as unit quaternions q₀, q₁, blended along the great
//             circle between them on the 4D unit sphere:
//               q(s) = sin((1 − s)θ)/sin θ · q₀ + sin(sθ)/sin θ · q₁,  cos θ = q₀·q₁
//             the shortest rotation, at constant angular speed. If q₀·q₁ < 0, q₁ is
//             negated first: q and −q are the same orientation, and this takes the short way.

import { Euler, Quaternion } from 'three';
import type { Vec3 } from './EditMesh';

export type Channel = 'position' | 'rotation' | 'scale';
export const CHANNELS: Channel[] = ['position', 'rotation', 'scale'];
/** How the value moves from this key to the next one. */
export type Interp = 'constant' | 'linear' | 'ease';
export interface Key { frame: number; value: Vec3; interp: Interp }
export interface Animation {
  position?: Key[]; rotation?: Key[]; scale?: Key[]; rotationMode?: 'euler' | 'quaternion';
  /** Pose rotation keys per bone (armatures). Bones always interpolate by slerp, as Blender's quaternion bones do. */
  bones?: Record<string, Key[]>;
}
export interface Timeline { start: number; end: number; fps: number; frame: number }
export const DEFAULT_TIMELINE: Timeline = { start: 1, end: 120, fps: 24, frame: 1 };

export type Quat = [number, number, number, number]; // x, y, z, w (three.js order)

export function ease(t: number, interp: Interp): number {
  if (interp === 'constant') return 0;
  if (interp === 'linear') return t;
  return t * t * (3 - 2 * t); // cubic Hermite with zero slope at both keys: starts and stops gently
}

export function eulerToQuat(e: Vec3): Quat {
  const q = new Quaternion().setFromEuler(new Euler(e[0], e[1], e[2], 'XYZ'));
  return [q.x, q.y, q.z, q.w];
}

export function quatToEuler(q: Quat): Vec3 {
  const e = new Euler().setFromQuaternion(new Quaternion(q[0], q[1], q[2], q[3]), 'XYZ');
  return [e.x, e.y, e.z];
}

const qdot = (a: Quat, b: Quat) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];

/** Spherical linear interpolation, written out. Returns the angle θ between the two as well. */
export function slerp(a: Quat, b0: Quat, s: number): { q: Quat; theta: number; flipped: boolean } {
  let d = qdot(a, b0);
  const flipped = d < 0;
  const b: Quat = flipped ? [-b0[0], -b0[1], -b0[2], -b0[3]] : b0;
  d = Math.min(1, Math.abs(d));
  const theta = Math.acos(d);
  let wa: number, wb: number;
  if (theta < 1e-6) { wa = 1 - s; wb = s; } // nearly equal: the straight blend is exact enough
  else { const st = Math.sin(theta); wa = Math.sin((1 - s) * theta) / st; wb = Math.sin(s * theta) / st; }
  const q: Quat = [wa * a[0] + wb * b[0], wa * a[1] + wb * b[1], wa * a[2] + wb * b[2], wa * a[3] + wb * b[3]];
  const l = Math.hypot(...q);
  return { q: [q[0] / l, q[1] / l, q[2] / l, q[3] / l], theta, flipped };
}

/**
 * The angle of the rotation that takes orientation a to orientation b (radians, 0 to π).
 * The quaternions are φ apart on the 4D sphere (cos φ = |a·b|) and the rotation angle is 2φ.
 * 2·acos|a·b| is the textbook form, but acos is inaccurate near 1 (small angles). With b's
 * sign chosen to match a, |a − b| = 2 sin(φ/2) and |a + b| = 2 cos(φ/2), so
 * 2φ = 4·atan2(|a − b|, |a + b|), which is accurate everywhere.
 */
export function angleBetween(a: Quat, b0: Quat): number {
  const b = qdot(a, b0) < 0 ? b0.map((c) => -c) : b0;
  const d = Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2], a[3] - b[3]);
  const s = Math.hypot(a[0] + b[0], a[1] + b[1], a[2] + b[2], a[3] + b[3]);
  return 4 * Math.atan2(d, s);
}

export interface Sample {
  value: Vec3;
  /** The keys either side of the frame, and where between them it is. */
  from?: Key; to?: Key; t?: number; s?: number;
  /** For slerp: the half-angle θ between the two quaternions, and the quaternion used. */
  theta?: number; quat?: Quat;
}

/** The value of a channel at a frame. Before the first key it holds the first value, after the last the last. */
export function sampleKeys(keys: Key[], frame: number, slerpRotation = false): Sample {
  if (!keys.length) throw new Error('no keys');
  if (frame <= keys[0].frame) return { value: [...keys[0].value] as Vec3, to: keys[0] };
  const last = keys[keys.length - 1];
  if (frame >= last.frame) return { value: [...last.value] as Vec3, from: last };
  let i = 0;
  while (keys[i + 1].frame < frame) i++;
  const k0 = keys[i], k1 = keys[i + 1];
  const t = (frame - k0.frame) / (k1.frame - k0.frame), s = ease(t, k0.interp);
  if (slerpRotation) {
    const r = slerp(eulerToQuat(k0.value), eulerToQuat(k1.value), s);
    return { value: nearestEuler(quatToEuler(r.q), k0.value), from: k0, to: k1, t, s, theta: r.theta, quat: r.q };
  }
  const v = k0.value, w = k1.value;
  return { value: [v[0] + s * (w[0] - v[0]), v[1] + s * (w[1] - v[1]), v[2] + s * (w[2] - v[2])], from: k0, to: k1, t, s };
}

/** An Euler triple for a rotation, with each angle shifted by whole turns to be near a reference (no jumps of 2π). */
function nearestEuler(e: Vec3, ref: Vec3): Vec3 {
  return e.map((a, i) => a + 2 * Math.PI * Math.round((ref[i] - a) / (2 * Math.PI))) as Vec3;
}

/** Insert or replace the key at a frame, keeping keys in frame order. */
export function setKey(anim: Animation, ch: Channel, frame: number, value: Vec3, interp?: Interp): void {
  const keys = (anim[ch] ??= []);
  const i = keys.findIndex((k) => k.frame === frame);
  const k: Key = { frame, value: [value[0], value[1], value[2]], interp: interp ?? keys[i]?.interp ?? 'ease' };
  if (i >= 0) keys[i] = k; else { keys.push(k); keys.sort((a, b) => a.frame - b.frame); }
}

export function removeKey(anim: Animation, ch: Channel, frame: number): boolean {
  const keys = anim[ch];
  if (!keys) return false;
  const i = keys.findIndex((k) => k.frame === frame);
  if (i < 0) return false;
  keys.splice(i, 1);
  if (!keys.length) delete anim[ch];
  return true;
}

export function hasKeys(anim: Animation | undefined): boolean {
  return !!anim && (CHANNELS.some((c) => anim[c]?.length) || Object.values(anim.bones ?? {}).some((k) => k.length));
}

/** Every frame with a key on any channel, sorted. */
export function keyFrames(anim: Animation | undefined): number[] {
  if (!anim) return [];
  return [...new Set([...CHANNELS.flatMap((c) => anim[c]?.map((k) => k.frame) ?? []), ...Object.values(anim.bones ?? {}).flatMap((ks) => ks.map((k) => k.frame))])].sort((a, b) => a - b);
}

export function cloneAnimation(a: Animation | undefined): Animation | undefined {
  if (!a) return undefined;
  const out: Animation = {};
  for (const c of CHANNELS) if (a[c]) out[c] = a[c]!.map((k) => ({ frame: k.frame, value: [k.value[0], k.value[1], k.value[2]], interp: k.interp }));
  if (a.rotationMode) out.rotationMode = a.rotationMode;
  if (a.bones) out.bones = Object.fromEntries(Object.entries(a.bones).map(([n, ks]) => [n, ks.map((k) => ({ frame: k.frame, value: [k.value[0], k.value[1], k.value[2]] as Vec3, interp: k.interp }))]));
  return out;
}

/** Set or replace a bone's rotation key. */
export function setBoneKey(anim: Animation, bone: string, frame: number, value: Vec3, interp?: Interp): void {
  const tmp: Animation = { rotation: (anim.bones ??= {})[bone] ?? [] };
  setKey(tmp, 'rotation', frame, value, interp);
  anim.bones[bone] = tmp.rotation!;
}

export function removeBoneKey(anim: Animation, bone: string, frame: number): boolean {
  const ks = anim.bones?.[bone];
  if (!ks) return false;
  const i = ks.findIndex((k) => k.frame === frame);
  if (i < 0) return false;
  ks.splice(i, 1);
  if (!ks.length) delete anim.bones![bone];
  if (anim.bones && !Object.keys(anim.bones).length) delete anim.bones;
  return true;
}

/** Each keyed bone's pose rotation at a frame. */
export function posesAt(anim: Animation | undefined, frame: number): Map<string, Vec3> {
  const out = new Map<string, Vec3>();
  for (const [n, ks] of Object.entries(anim?.bones ?? {})) if (ks.length) out.set(n, sampleKeys(ks, frame, true).value);
  return out;
}

/** The transform an animated object has at a frame; channels without keys keep the current value. */
export function transformAt(o: { position: Vec3; rotation: Vec3; scale: Vec3; anim?: Animation }, frame: number): { position: Vec3; rotation: Vec3; scale: Vec3 } {
  const a = o.anim;
  return {
    position: a?.position?.length ? sampleKeys(a.position, frame).value : o.position,
    rotation: a?.rotation?.length ? sampleKeys(a.rotation, frame, a.rotationMode === 'quaternion').value : o.rotation,
    scale: a?.scale?.length ? sampleKeys(a.scale, frame).value : o.scale,
  };
}
