// The mesh an object shows: its cage with the modifier stack and, if it is
// bound to an armature, the skinning applied.
//
// A skinned mesh is evaluated in the order Blender recommends for a rigged
// character: mirror first (so both halves exist to be weighted), then the
// armature, then subdivision (so the smooth surface follows the posed cage).
// The weights index the mesh after mirroring: `skinSource`.

import { Matrix4 } from 'three';
import type { EditMesh } from './EditMesh';
import { boneHeatWeights, deform, orderBones, type Bone } from './armature';
import type { Vec3 } from './EditMesh';
import { evaluate, mirror } from './modifiers';
import { subdivide } from './subdivision';
import type { Scene, SceneObject } from './Scene';
import type { Trace } from './trace';

/** The mesh the armature deforms: the cage with its mirror modifiers applied. */
export function skinSource(o: SceneObject): EditMesh {
  let m = o.mesh!;
  for (const mod of o.modifiers) if (mod.enabled && mod.type === 'mirror') m = mirror(m, mod.axis, mod.merge);
  return m;
}

/** Mesh coordinates → the armature object's coordinates: A_world⁻¹ · M_world. */
export function toArmatureSpace(scene: Scene, o: SceneObject, arm: SceneObject): Matrix4 {
  return scene.worldMatrix(arm).invert().multiply(scene.worldMatrix(o));
}

/** Whether the object's skin can deform it now (its armature exists and the weights fit the mesh). */
export function skinState(scene: Scene, o: SceneObject): 'none' | 'ok' | 'no-armature' | 'stale' {
  if (!o.skin || !o.mesh) return 'none';
  const arm = scene.get(o.skin.armature);
  if (!arm?.bones) return 'no-armature';
  return skinSource(o).verts.length === o.skin.verts ? 'ok' : 'stale';
}

/** The skinned source mesh (mirror applied, posed), before subdivision. */
export function skinnedSource(scene: Scene, o: SceneObject, trace?: Trace, explain?: number): EditMesh {
  const src = skinSource(o);
  if (skinState(scene, o) !== 'ok') return src;
  const arm = scene.get(o.skin!.armature)!;
  if (scene.restPose === arm.id) return src; // its bones are being edited: show the rest pose, as Blender does
  return deform(src, o.skin!, arm.bones!, toArmatureSpace(scene, o, arm), trace, explain);
}

/** The mesh as drawn. `maxLevels` caps subdivision (the viewport uses 3). */
export function evaluatedMesh(scene: Scene, o: SceneObject, maxLevels = 4): EditMesh {
  if (!o.mesh) throw new Error(`${o.name} has no mesh`);
  if (!o.skin) return o.modifiers.length ? evaluate(o.mesh, o.modifiers, maxLevels) : o.mesh;
  let m = skinnedSource(scene, o);
  for (const mod of o.modifiers) if (mod.enabled && mod.type === 'subsurf') m = subdivide(m, Math.min(maxLevels, Math.max(0, Math.round(mod.levels))));
  return m;
}

/** A short string that changes whenever the skinning result would: the pose and where mesh and armature are. */
export function skinSignature(scene: Scene, o: SceneObject): string {
  if (!o.skin) return '';
  const arm = scene.get(o.skin.armature);
  if (!arm?.bones) return 'no-armature';
  const m = toArmatureSpace(scene, o, arm).elements.map((x) => x.toFixed(6)).join(',');
  return `${m}|${JSON.stringify(arm.bones)}|${o.skin.verts}|${o.skin.bones.join(',')}|${o.skin.method ?? ''}|${scene.restPose === arm.id}`;
}

/**
 * Bind a mesh to an armature with automatic (bone heat) weights, as Blender's
 * Ctrl+P › With Automatic Weights: the weights are computed in the rest pose, in
 * the armature's space, and the mesh is parented to the armature so it moves with it.
 */
export function bindSkin(scene: Scene, o: SceneObject, arm: SceneObject, trace?: Trace): void {
  if (!o.mesh) throw new Error(`${o.name} has no mesh to bind`);
  if (!arm.bones?.length) throw new Error(`${arm.name} is not an armature with bones`);
  if (o.id === arm.id) throw new Error('An armature cannot be bound to itself');
  const src = skinSource(o);
  const m = toArmatureSpace(scene, o, arm);
  const inArm = src.clone();
  inArm.verts = src.verts.map((v) => { const e = m.elements; return [e[0] * v[0] + e[4] * v[1] + e[8] * v[2] + e[12], e[1] * v[0] + e[5] * v[1] + e[9] * v[2] + e[13], e[2] * v[0] + e[6] * v[1] + e[10] * v[2] + e[14]]; });
  inArm.touch();
  if (trace && src.verts.length <= trace.snapshotLimit) trace.before = src.toSnapshot();
  const weights = boneHeatWeights(inArm, arm.bones, trace);
  o.skin = { armature: arm.id, bones: arm.bones.map((b) => b.name), weights, verts: src.verts.length };
  if (o.parent !== arm.id) scene.setParent(o.id, arm.id, true);
}

/** Apply a bone edit, following a rename through children, skins and keys. */
export function applyBonePatch(scene: Scene, o: SceneObject, b: Bone, patch: { name?: string; head?: Vec3; tail?: Vec3; parent?: string | null; roll?: number }): void {
  if (patch.roll !== undefined) { if (patch.roll) b.roll = patch.roll; else delete b.roll; }
  if (patch.head) b.head = [patch.head[0], patch.head[1], patch.head[2]];
  if (patch.tail) b.tail = [patch.tail[0], patch.tail[1], patch.tail[2]];
  if (patch.parent !== undefined) b.parent = patch.parent;
  if (patch.name && patch.name !== b.name) {
    const old = b.name, nu = patch.name;
    b.name = nu;
    for (const x of o.bones!) if (x.parent === old) x.parent = nu;
    for (const m of scene.objects) if (m.skin?.armature === o.id) m.skin.bones = m.skin.bones.map((n) => (n === old ? nu : n));
    if (o.anim?.bones?.[old]) { o.anim.bones[nu] = o.anim.bones[old]; delete o.anim.bones[old]; }
  }
  orderBones(o.bones!);
}

export function removeBone(scene: Scene, o: SceneObject, name: string): void {
  const b = o.bones!.find((x) => x.name === name);
  if (!b) throw new Error(`No bone called "${name}"`);
  for (const x of o.bones!) if (x.parent === name) x.parent = b.parent;
  o.bones = o.bones!.filter((x) => x !== b);
  for (const m of scene.objects) if (m.skin?.armature === o.id) {
    const i = m.skin.bones.indexOf(name);
    if (i >= 0) { m.skin.bones.splice(i, 1); m.skin.weights.splice(i, 1); }
  }
  if (o.anim?.bones) {
    delete o.anim.bones[name];
    if (!Object.keys(o.anim.bones).length) delete o.anim.bones;
    if (!o.anim.bones && !o.anim.position?.length && !o.anim.rotation?.length && !o.anim.scale?.length) o.anim = undefined;
  }
}
