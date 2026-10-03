// Sampling keyframes (Object › Trace sampling the keys) and building quaternions (Object › Trace the quaternion).
// A channel's value at a frame comes from the two keys around it: how far through the gap the frame is (t), eased
// (s = ease(t)), then blended. Rotation keys in quaternion mode are blended by slerp along the great circle between
// the two orientations; the trace shows the quaternions, the shortest-path sign, the weights and the angle.

import { Euler, Matrix4, Quaternion, Vector3 } from 'three';
import type { Vec3 } from './EditMesh';
import type { SceneObject } from './Scene';
import { ease, eulerToQuat, posesAt, quatToEuler, sampleKeys, slerp, transformAt, type Animation, type Channel, type Interp, type Quat } from './animation';
import { boneMatrices, posedEnds } from './armature';
import { Trace, fmt, fmtV } from './trace';

const EASE_RULE: Record<Interp, string> = {
  constant: 's = 0: the value holds until the next key',
  linear: 's = t',
  ease: 's = 3t² − 2t³: slow at both keys',
  'ease-in': 's = t²: starts slow, like falling from rest',
  'ease-out': 's = 1 − (1 − t)²: ends slow, like rising to rest',
};
const fq = (q: Quat) => `(${q.map((x) => fmt(x, 4)).join(', ')})`;
const deg = (v: Vec3) => `(${v.map((x) => fmt((x * 180) / Math.PI, 2)).join('°, ')}°)`;

export function traceSample(anim: Animation, channel: Channel, frame: number, trace?: Trace): { value: Vec3; t?: number; s?: number } {
  const keys = anim[channel] ?? [];
  if (!keys.length) throw new Error(`no ${channel} keys`);
  const useSlerp = channel === 'rotation' && anim.rotationMode === 'quaternion';
  const r = sampleKeys(keys, frame, useSlerp);
  const show = (v: Vec3) => (channel === 'rotation' ? deg(v) : fmtV(v));
  if (!trace) return { value: r.value, t: r.t, s: r.s };
  trace.step({
    phase: 'Keys', label: `${keys.length} ${channel} keys at frames ${keys.map((k) => k.frame).join(', ')}; frame ${frame} is ${r.from && r.to ? `between ${r.from.frame} and ${r.to.frame}` : r.to ? `before the first key` : 'after the last key'}`,
    detail: 'A key pins the channel to a value at one frame. Every other frame is computed from the two keys around it. Before the first key the first value holds; after the last, the last.',
    values: keys.slice(0, 10).map((k) => [`frame ${k.frame} (${k.interp})`, show(k.value)] as [string, string]),
  });
  if (!r.from || !r.to || r.t === undefined) {
    trace.step({ phase: 'Value', label: `${channel} = ${show(r.value)}`, detail: 'Outside the keys, the nearest key\'s value holds.' });
    return { value: r.value };
  }
  const { from: k0, to: k1, t, s = 0 } = r;
  trace.step({
    phase: 'How far', label: `t = (${frame} − ${k0.frame}) / (${k1.frame} − ${k0.frame}) = ${fmt(t, 4)}`,
    detail: 't is how far through the gap between the two keys the frame is: 0 at the first key, 1 at the second.',
  });
  trace.step({
    phase: 'Ease', label: `${k0.interp}: s = ${fmt(s, 4)}`,
    detail: `The first key's interpolation reshapes t: ${EASE_RULE[k0.interp]}. Easing changes how the time is spent, not where the value goes: s still runs from 0 to 1.`,
    ...(k0.interp !== 'linear' && k0.interp !== 'constant' ? { quiz: { prompt: `t = ${fmt(t, 4)} and the key's interpolation is ${k0.interp} (${EASE_RULE[k0.interp].split(':')[0]}). What is s?`, answer: [s], labels: ['s'], rule: EASE_RULE[k0.interp], tolerance: 0.002 } } : {}),
  });
  if (!useSlerp) {
    trace.step({
      phase: 'Blend', label: `${show(k0.value)} + ${fmt(s, 4)} × (${show(k1.value)} − ${show(k0.value)}) = ${show(r.value)}`,
      detail: 'Each component moves the fraction s of the way from the first key\'s value to the second\'s.' + (channel === 'rotation' ? ' For rotation this blends the three Euler angles separately: simple, but not the shortest turn (lesson 10.4).' : ''),
      ...(k0.interp === 'linear' && channel !== 'rotation' ? { quiz: { prompt: `Between ${fmtV(k0.value)} at frame ${k0.frame} and ${fmtV(k1.value)} at frame ${k1.frame}, linear. What is the ${channel} at frame ${frame}?`, answer: [...r.value], labels: ['x', 'y', 'z'], rule: 'value = v₀ + t (v₁ − v₀), t the fraction of the gap.', tolerance: 0.002 } } : {}),
    });
    return { value: r.value, t, s };
  }
  const q0 = eulerToQuat(k0.value), q1raw = eulerToQuat(k1.value), sl = slerp(q0, q1raw, s);
  const d = q0[0] * q1raw[0] + q0[1] * q1raw[1] + q0[2] * q1raw[2] + q0[3] * q1raw[3];
  trace.step({
    phase: 'Quaternions', label: `q₀ = ${fq(q0)}, q₁ = ${fq(q1raw)}`,
    detail: 'Each key\'s orientation as a unit quaternion (x, y, z, w): a point on the 4D unit sphere. Slerp blends the orientations, not the angles.',
  });
  trace.step({
    phase: 'Shortest path', label: `q₀·q₁ = ${fmt(d, 4)}${sl.flipped ? ': negative, so q₁ is negated (q and −q are the same orientation)' : ''}; θ = acos|q₀·q₁| = ${fmt((sl.theta * 180) / Math.PI, 2)}°`,
    detail: 'q and −q give the same rotation, so each orientation is two opposite points on the sphere. Choosing the one within 90° of q₀ makes the blend take the short way round. θ is the angle between them on the 4D sphere; the rotation itself turns by 2θ.',
  });
  const st = Math.sin(sl.theta), wa = st > 1e-6 ? Math.sin((1 - s) * sl.theta) / st : 1 - s, wb = st > 1e-6 ? Math.sin(s * sl.theta) / st : s;
  trace.step({
    phase: 'Weights', label: `q = ${fmt(wa, 4)} q₀ + ${fmt(wb, 4)} q₁ = ${fq(sl.q)}`,
    detail: 'Slerp weights sin((1 − s)θ)/sin θ and sin(sθ)/sin θ move along the great circle at a constant angular speed, so the object turns evenly. A straight blend of the quaternions would cut through the sphere and speed up in the middle.',
    quiz: { prompt: `θ = ${fmt((sl.theta * 180) / Math.PI, 2)}° and s = ${fmt(s, 4)}. What is the weight on q₁, sin(sθ)/sin θ?`, answer: [wb], labels: ['weight'], rule: 'sin(s·θ) / sin θ.', tolerance: 0.002 },
  });
  trace.step({ phase: 'Back to Euler', label: `rotation = ${show(r.value)}`, detail: 'The blended quaternion is turned back into Euler angles for the object\'s rotation, choosing the angles nearest the first key\'s so nothing jumps by 360°.' });
  return { value: r.value, t, s };
}

/** Euler angles (radians, XYZ) to a quaternion, step by step: one quaternion per axis, then their product. */
export function traceQuaternion(e: Vec3, trace?: Trace): Quat {
  const q = eulerToQuat(e);
  if (!trace) return q;
  const axisQ = (i: number): Quat => { const h = e[i] / 2, v: Quat = [0, 0, 0, Math.cos(h)]; v[i] = Math.sin(h); return v; };
  const qs = [0, 1, 2].map(axisQ);
  trace.step({
    phase: 'One axis each', label: `qx = ${fq(qs[0])}, qy = ${fq(qs[1])}, qz = ${fq(qs[2])}`,
    detail: 'A turn by angle θ about a unit axis a is the quaternion (a sin(θ/2), cos(θ/2)): half the angle, which is why a full turn of 360° gives −1, not 1.',
    quiz: { prompt: `The x angle is ${fmt((e[0] * 180) / Math.PI, 2)}°. What is the w part of its quaternion, cos(θ/2)?`, answer: [qs[0][3]], labels: ['w'], rule: 'w = cos(half the angle).', tolerance: 0.002 },
  });
  trace.step({
    phase: 'Product', label: `q = qx · qy · qz = ${fq(q)}`,
    detail: 'Rotations combine by multiplying quaternions, in the same order as the matrices Rx·Ry·Rz (lesson 2.7). The product of unit quaternions is a unit quaternion.',
    values: [['|q|', fmt(Math.hypot(...q), 6)], ['−q (the same rotation)', fq(q.map((x) => -x) as Quat)]],
  });
  const ang = 2 * Math.acos(Math.min(1, Math.abs(q[3]))), sh = Math.sin(ang / 2), axis: Vec3 = sh > 1e-9 ? [q[0] / sh, q[1] / sh, q[2] / sh].map((x) => x * Math.sign(q[3] || 1)) as Vec3 : [1, 0, 0];
  trace.step({
    phase: 'Axis and angle', label: `one turn of ${fmt((ang * 180) / Math.PI, 2)}° about ${fmtV(axis)}`,
    detail: 'Any orientation is one turn about one axis (Euler\'s rotation theorem). The quaternion stores exactly that: its w is cos of half the angle, its x, y, z the axis times sin of half the angle. Back to Euler: ' + deg(quatToEuler(q)) + '.',
  });
  return q;
}

// ── motion through a hierarchy ────────────────────────────────────────────


interface ChainSource { get(id: string): SceneObject | undefined; timeline: { start: number; end: number } }

/** An object's world matrix at any frame: each object up the chain at its own animated transform for that frame. */
export function worldAt(scene: ChainSource, o: SceneObject, frame: number): Matrix4 {
  const m = new Matrix4();
  for (let n: SceneObject | undefined = o; n; n = n.parent ? scene.get(n.parent) : undefined) {
    const x = transformAt(n, frame);
    const local = new Matrix4().compose(new Vector3(...x.position), new Quaternion().setFromEuler(new Euler(x.rotation[0], x.rotation[1], x.rotation[2], 'XYZ')), new Vector3(...x.scale));
    m.premultiply(local);
  }
  return m;
}

/**
 * Baking: sample an object's world position every `every` frames and keep the samples as position keys on an
 * object with no parent. Between the keys the baked motion is a straight line, so it only follows the true
 * (curved) world path as closely as the step allows: the check measures the worst gap on every frame in between.
 */
export function traceBake(scene: ChainSource, o: SceneObject, every = 3, trace?: Trace): { keys: { frame: number; value: Vec3 }[]; maxError: number; worstFrame: number } {
  const { start, end } = scene.timeline, step = Math.max(1, Math.round(every));
  const frames: number[] = [];
  for (let f = start; f < end; f += step) frames.push(f);
  frames.push(end);
  const pos = (f: number): Vec3 => { const e = worldAt(scene, o, f).elements; return [e[12], e[13], e[14]]; };
  const keys = frames.map((frame) => ({ frame, value: pos(frame) }));
  let maxError = 0, worstFrame = start;
  for (let f = start; f <= end; f++) {
    const i = Math.min(keys.length - 2, Math.max(0, keys.findIndex((k, j) => j + 1 < keys.length && keys[j + 1].frame >= f)));
    const k0 = keys[i], k1 = keys[i + 1], t = k1.frame > k0.frame ? (f - k0.frame) / (k1.frame - k0.frame) : 0;
    const p = pos(f), b = k0.value.map((v, c) => v + t * (k1.value[c] - v));
    const err = Math.hypot(p[0] - b[0], p[1] - b[1], p[2] - b[2]);
    if (err > maxError) { maxError = err; worstFrame = f; }
  }
  if (trace) {
    const chain: SceneObject[] = [];
    for (let n: SceneObject | undefined = o; n; n = n.parent ? scene.get(n.parent) : undefined) chain.unshift(n);
    const moving = chain.filter((n) => n.anim && (n.anim.position?.length || n.anim.rotation?.length || n.anim.scale?.length));
    trace.step({
      phase: 'Chain', label: `${chain.map((n) => n.name).join(' → ')}: ${moving.length ? `${moving.map((n) => n.name).join(', ')} ${moving.length === 1 ? 'is' : 'are'} animated` : 'nothing is animated'}`,
      detail: `${o.name} may have no keys of its own: it moves because the objects above it move. Its world matrix at a frame is the product of every local matrix up the chain, each at its own animated transform for that frame.`,
    });
    trace.step({
      phase: 'Sample', label: `Every ${step} frame${step === 1 ? '' : 's'} from ${start} to ${end}: ${keys.length} world positions`,
      detail: 'At each sampled frame, compose the chain (lesson 2.5) and read the world position off the matrix\'s last column. Each sample becomes a key on an object with no parent: the motion is "baked" and no longer needs the hierarchy.',
      values: keys.slice(0, 4).map((k) => [`frame ${k.frame}`, fmtV(k.value)] as [string, string]),
      quiz: { prompt: `The timeline runs from frame ${start} to ${end}. Sampling every ${step} frames (and always the last frame), how many keys does baking make?`, answer: [keys.length], labels: ['keys'], rule: 'Frames start, start + step, … below the end, plus the end itself.', tolerance: 0 },
    });
    trace.step({
      phase: 'Check', label: `Between the keys, the baked path is off by at most ${fmt(maxError, 4)} (at frame ${worstFrame})`,
      detail: 'The true path curves (a turning arm sweeps an arc); straight lines between baked keys cut across the curve. Halving the step cuts the worst gap to about a quarter: the error of a chord grows with the square of its length.',
    });
  }
  return { keys, maxError, worstFrame };
}

// ── a walk cycle: foot sliding and the loop ───────────────────────────────

/**
 * Where a bone's tail (say the ankle, the tail of a shin) is in the world on every frame, when it is on the ground
 * (within `ground` of its lowest point), and how far it slides along the ground while it is: in a good walk the
 * planted foot stays put while the body moves over it. Also checks that the pose at start + cycle matches the start.
 */
export function traceFootSlide(scene: ChainSource, rig: SceneObject, bone: string, cycle: number, ground = 0.02, trace?: Trace): { contacts: [number, number][]; maxSlide: number; worstContact: [number, number] | null; loopError: number } {
  const bones = rig.bones ?? [];
  if (!bones.some((b) => b.name === bone)) throw new Error(`${rig.name} has no bone "${bone}"`);
  const { start, end } = scene.timeline;
  const at = (f: number): Vec3 => {
    const ends = posedEnds(bones, boneMatrices(bones, posesAt(rig.anim, f))), t = ends.get(bone)!.tail;
    const p = new Vector3(...t).applyMatrix4(worldAt(scene, rig, f));
    return [p.x, p.y, p.z];
  };
  const path: Vec3[] = [];
  for (let f = start; f <= end; f++) path.push(at(f));
  const low = Math.min(...path.map((p) => p[1])), high = Math.max(...path.map((p) => p[1]));
  // Contact: runs of consecutive frames with the tail within `ground` of its lowest height.
  const contacts: [number, number][] = [];
  path.forEach((p, k) => {
    const f = start + k;
    if (p[1] > low + ground) return;
    const last = contacts[contacts.length - 1];
    if (last && last[1] === f - 1) last[1] = f; else contacts.push([f, f]);
  });
  let maxSlide = 0, worstContact: [number, number] | null = null;
  for (const c of contacts) {
    const a = path[c[0] - start];
    let slide = 0;
    for (let f = c[0]; f <= c[1]; f++) { const p = path[f - start]; slide = Math.max(slide, Math.hypot(p[0] - a[0], p[2] - a[2])); }
    if (slide > maxSlide) { maxSlide = slide; worstContact = c; }
  }
  // The loop: every bone's pose at start + cycle against start.
  const p0 = posesAt(rig.anim, start), p1 = posesAt(rig.anim, start + cycle);
  let loopError = 0;
  for (const [n, v] of p0) { const w = p1.get(n) ?? v; loopError = Math.max(loopError, ...v.map((x, i) => Math.abs(x - w[i]))); }
  if (trace) {
    trace.step({
      phase: 'Path', label: `${bone}'s tail over frames ${start}–${end}: height from ${fmt(low, 3)} to ${fmt(high, 3)}`,
      detail: `Each frame: pose the skeleton from its bone keys (lesson 11.2 explains the bone matrices), find the tail of ${bone}, and carry it into the world with the rig object's own animated transform (lesson 10.5).`,
      points: [path[0], path[Math.floor(path.length / 2)]].map((p) => ({ p, color: '#facc15' })),
    });
    trace.step({
      phase: 'Contact', label: `On the ground (within ${fmt(ground)} of the lowest point) on ${contacts.length} run${contacts.length === 1 ? '' : 's'}: ${contacts.slice(0, 6).map((c) => `${c[0]}–${c[1]}`).join(', ')}`,
      detail: 'A foot is planted while it is at its lowest. Those frames are when it must not move along the ground: the body passes over it.',
    });
    trace.step({
      phase: 'Slide', label: worstContact ? `The worst slide: ${fmt(maxSlide, 4)} along the ground during frames ${worstContact[0]}–${worstContact[1]}` : 'Never on the ground: nothing to slide',
      detail: 'If the hips move forward at one speed and the leg swings back at another, the planted foot drifts: "foot sliding", the commonest walk-cycle fault. The fix is to match the leg\'s backward sweep to the body\'s forward speed while the foot is down (or to pin the foot with inverse kinematics).',
    });
    trace.step({
      phase: 'Loop', label: `Pose at frame ${start + cycle} against frame ${start}: largest difference ${fmt(loopError, 4)} rad`,
      detail: 'A cycle loops cleanly only if the pose at the end of one cycle equals the pose at its start: then playing it again continues the motion with no jump. The body\'s forward position is the exception: it keeps going.',
      quiz: { prompt: `A ${cycle}-frame cycle starts at frame ${start}. At which frame must the pose be the same as at frame ${start}?`, answer: [start + cycle], labels: ['frame'], rule: 'Start + cycle length: the first frame of the next cycle.', tolerance: 0 },
    });
  }
  return { contacts, maxSlide, worstContact, loopError };
}

// ── animation in files: the glTF clip ─────────────────────────────────────

/** One glTF animation channel and its sampler, as MeshLab's GLB export writes it. */
/** `first` is the value at the first frame, for an object (a bone's stored rotation also includes its rest rotation). */
export interface ClipChannel { node: string; path: 'translation' | 'rotation' | 'scale'; components: 3 | 4; first?: number[] }

/**
 * What Export GLB writes for the scene's animation: one channel per animated property (an object's translation,
 * rotation or scale, or a keyed bone's rotation), each with a sampler of every frame baked (input: times in seconds;
 * output: the values, rotations as quaternions x, y, z, w) and LINEAR interpolation. Bytes count the float data.
 */
export function traceClip(scene: { objects: SceneObject[]; timeline: { start: number; end: number; fps: number } }, trace?: Trace): { channels: ClipChannel[]; frames: number; duration: number; bytes: number } {
  const { start, end, fps } = scene.timeline;
  const frames = end - start + 1, duration = (end - start) / fps;
  const channels: ClipChannel[] = [];
  for (const o of scene.objects) {
    const a = o.anim;
    if (!a) continue;
    const t0 = transformAt(o, start);
    if (a.position?.length) channels.push({ node: o.name, path: 'translation', components: 3, first: [...t0.position] });
    if (a.rotation?.length) channels.push({ node: o.name, path: 'rotation', components: 4, first: [...eulerToQuat(t0.rotation)] });
    if (a.scale?.length) channels.push({ node: o.name, path: 'scale', components: 3, first: [...t0.scale] });
    for (const name of Object.keys(a.bones ?? {})) {
      if (!a.bones![name].length || !o.bones?.some((b) => b.name === name)) continue;
      channels.push({ node: `${o.name}/${name}`, path: 'rotation', components: 4 });
    }
  }
  const bytes = channels.reduce((s, c) => s + 4 * frames * (1 + c.components), 0);
  if (trace) {
    const mid = start + Math.floor((end - start) / 2);
    trace.step({
      phase: 'Channels', label: channels.length ? `${channels.length} channel${channels.length === 1 ? '' : 's'}: ${channels.slice(0, 4).map((c) => `${c.node}.${c.path}`).join(', ')}${channels.length > 4 ? ', …' : ''}` : 'Nothing is keyed: the file has no animation',
      detail: 'A glTF animation is a list of channels. Each channel targets one node and one property (translation, rotation or scale; a bone is a node too) and names a sampler that says how the value changes over time.',
      values: channels.slice(0, 8).map((c) => [`${c.node}.${c.path}`, `${c.components} floats per key`] as [string, string]),
    });
    trace.step({
      phase: 'Times', label: `Input: frames ${start}–${end} as seconds, 0 to ${fmt(duration, 4)} (${frames} keys per sampler)`,
      detail: `A sampler\'s input is its key times in seconds, not frames: t = (frame − ${start}) / ${fps}. MeshLab bakes every frame, so any player, which only knows glTF\'s own interpolations, reproduces its easing exactly.`,
      quiz: { prompt: `At ${fps} frames per second with the clip starting at frame ${start}, what time in seconds does frame ${mid} get?`, answer: [(mid - start) / fps], labels: ['seconds'], rule: 't = (frame − start) / fps', tolerance: 1e-3 },
    });
    const shown = channels.find((c) => c.first);
    trace.step({
      phase: 'Values', label: shown ? `Output: ${shown.node}.${shown.path} starts at (${shown.first!.map((x) => fmt(x, 4)).join(', ')})` : `Output: ${channels.length} bone rotation${channels.length === 1 ? '' : 's'}`,
      detail: 'A sampler\'s output holds one value per input time: 3 floats for translation and scale, 4 for rotation, a unit quaternion (x, y, z, w). glTF never stores Euler angles, so each frame\'s rotation is converted (lesson 10.3). A bone\'s rotation is stored relative to its parent bone, its rest rotation times its pose.',
    });
    trace.step({
      phase: 'Interpolation', label: 'LINEAR on every sampler: lerp for translation and scale, slerp for rotation',
      detail: 'glTF offers STEP, LINEAR and CUBICSPLINE. MeshLab\'s easings are none of them, so it bakes every frame and lets LINEAR fill the gaps between frames. For a rotation, LINEAR in glTF means slerp along the shorter arc (lesson 10.4).',
    });
    trace.step({
      phase: 'Bytes', label: `${channels.length} samplers × ${frames} keys: ${bytes} bytes of float data`,
      detail: 'Each sampler stores its own input (4 bytes per time) and output (4 bytes per float). A key on every frame costs memory; a player\'s clip compressor would remove keys that the straight line already predicts.',
      quiz: channels.length ? { prompt: `${channels.length} samplers of ${frames} keys each (${channels.map((c) => c.components).join(' + ')} floats per key across them, plus one time per key each). How many bytes of float data, at 4 bytes per float?`, answer: [bytes], labels: ['bytes'], rule: 'Σ 4 × keys × (1 + floats per key)', tolerance: 0 } : undefined,
    });
  }
  return { channels, frames, duration, bytes };
}
