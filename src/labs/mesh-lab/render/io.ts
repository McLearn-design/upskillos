// glTF in and out. glTF is the web's model format and Blender reads and writes
// it; it stores triangles, so for keeping quads to edit later use OBJ instead.

import * as THREE from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import type { Scene } from '../core/Scene';
import { EditMesh } from '../core/EditMesh';
import { evaluatedMesh } from '../core/evaluate';
import { toGeometry } from './Viewport';
import { eulerToQuat, hasKeys, posesAt, transformAt } from '../core/animation';
import { orderBones, restMatrix } from '../core/armature';
import { skinSource, skinState } from '../core/evaluate';

/** Build a plain three.js scene from the model: the hierarchy, transforms, modifiers applied. */
export function toThreeScene(scene: Scene): THREE.Scene {
  return buildThree(scene).out;
}

/**
 * The animation as one three.js clip, baked: every frame of the timeline sampled
 * (so easing and slerp come out exactly as MeshLab plays them), rotation as
 * quaternions. glTF stores animation this way, and Blender imports it as an action.
 */
/** Built alongside the three.js scene: each armature's bones, and each bone's rest rotation relative to its parent. */
interface Rigs { bones: Map<string, Map<string, THREE.Bone>>; restQ: Map<THREE.Bone, THREE.Quaternion> }

export function animationClip(scene: Scene, nodes: Map<string, THREE.Object3D>, rigs?: Rigs): THREE.AnimationClip | null {
  const { start, end, fps } = scene.timeline;
  const tracks: THREE.KeyframeTrack[] = [];
  const frames = Array.from({ length: end - start + 1 }, (_, i) => start + i);
  const times = frames.map((f) => (f - start) / fps);
  for (const o of scene.objects) {
    if (!hasKeys(o.anim)) continue;
    // A node's uuid names it in the track, since names like "Cube.001" contain the dot that separates name from property.
    const id = nodes.get(o.id)!.uuid;
    const at = frames.map((f) => transformAt(o, f));
    if (o.anim!.position?.length) tracks.push(new THREE.VectorKeyframeTrack(`${id}.position`, times, at.flatMap((x) => x.position)));
    if (o.anim!.scale?.length) tracks.push(new THREE.VectorKeyframeTrack(`${id}.scale`, times, at.flatMap((x) => x.scale)));
    if (o.anim!.rotation?.length) tracks.push(new THREE.QuaternionKeyframeTrack(`${id}.quaternion`, times, at.flatMap((x) => eulerToQuat(x.rotation))));
    // Bone keys: a bone node's rotation is its rest rotation on the parent times the pose.
    const bones = rigs?.bones.get(o.id);
    for (const name of Object.keys(o.anim!.bones ?? {})) {
      const bone = bones?.get(name);
      if (!bone) continue;
      const rq = rigs!.restQ.get(bone)!;
      const qs = frames.flatMap((f) => { const p = posesAt(o.anim, f).get(name)!; return rq.clone().multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(p[0], p[1], p[2], 'XYZ'))).toArray(); });
      tracks.push(new THREE.QuaternionKeyframeTrack(`${bone.uuid}.quaternion`, times, qs));
    }
  }
  return tracks.length ? new THREE.AnimationClip('MeshLab', (end - start) / fps, tracks) : null;
}

/**
 * The three.js scene for export. An armature becomes a tree of THREE.Bone; a mesh
 * bound to it becomes a SkinnedMesh of its skin source (the cage with mirror
 * applied: glTF has no subdivision modifier, so add it again in Blender) with the
 * four strongest weights per vertex, as glTF allows.
 */
function buildThree(scene: Scene): { out: THREE.Scene; nodes: Map<string, THREE.Object3D>; rigs: Rigs } {
  const out = new THREE.Scene();
  const nodes = new Map<string, THREE.Object3D>();
  const rigs: Rigs = { bones: new Map(), restQ: new Map() };
  const skinned: { o: (typeof scene.objects)[number]; mesh: THREE.SkinnedMesh }[] = [];
  for (const o of scene.objects) {
    let node: THREE.Object3D;
    const material = new THREE.MeshStandardMaterial({ color: o.material.color, roughness: o.material.roughness, metalness: o.material.metalness });
    if (o.mesh && skinState(scene, o) === 'ok') {
      const { geo } = toGeometry(skinSource(o));
      const n = geo.attributes.position.count, idx = new Uint16Array(n * 4), wts = new Float32Array(n * 4);
      for (let i = 0; i < n; i++) {
        const top = o.skin!.bones.map((_, b) => [b, o.skin!.weights[b][i]] as const).filter(([, w]) => w > 0).sort((a, b) => b[1] - a[1]).slice(0, 4);
        const sum = top.reduce((s2, [, w]) => s2 + w, 0) || 1;
        top.forEach(([b, w], k) => { idx[i * 4 + k] = b; wts[i * 4 + k] = w / sum; });
        if (!top.length) wts[i * 4] = 1;
      }
      geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(idx, 4));
      geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(wts, 4));
      const g = o.smooth ? geo : geo.toNonIndexed();
      if (!o.smooth) g.computeVertexNormals();
      const mesh = new THREE.SkinnedMesh(g, material);
      skinned.push({ o, mesh });
      node = mesh;
    } else if (o.mesh) {
      const { geo } = toGeometry(evaluatedMesh(scene, o));
      if (!o.smooth) { const flat = geo.toNonIndexed(); flat.computeVertexNormals(); node = new THREE.Mesh(flat, material); }
      else node = new THREE.Mesh(geo, material);
    } else if (o.kind === 'light') {
      node = new THREE.DirectionalLight(o.light?.color ?? '#ffffff', o.light?.intensity ?? 2);
    } else node = new THREE.Object3D();
    node.name = o.name;
    node.position.set(...o.position);
    node.rotation.set(o.rotation[0], o.rotation[1], o.rotation[2], 'XYZ');
    node.scale.set(...o.scale);
    node.visible = o.visible;
    nodes.set(o.id, node);
    if (o.bones) {
      // Each bone's local matrix is its rest offset on its parent, O = B_parent⁻¹ · B (a root: B).
      const map = new Map<string, THREE.Bone>();
      for (const b of orderBones(o.bones)) {
        const bone = new THREE.Bone();
        bone.name = b.name;
        const B = restMatrix(b), parent = b.parent ? o.bones.find((x) => x.name === b.parent)! : null;
        const O = parent ? restMatrix(parent).invert().multiply(B) : B;
        O.decompose(bone.position, bone.quaternion, bone.scale);
        rigs.restQ.set(bone, bone.quaternion.clone());
        (b.parent ? map.get(b.parent)! : node).add(bone);
        map.set(b.name, bone);
      }
      rigs.bones.set(o.id, map);
    }
  }
  for (const o of scene.objects) (o.parent ? nodes.get(o.parent)! : out).add(nodes.get(o.id)!);
  // Bind in the rest pose, then pose the bones.
  out.updateMatrixWorld(true);
  for (const { o, mesh } of skinned) {
    const map = rigs.bones.get(o.skin!.armature)!;
    mesh.bind(new THREE.Skeleton(o.skin!.bones.map((nm) => map.get(nm)!)), mesh.matrixWorld);
  }
  for (const o of scene.objects) {
    const map = rigs.bones.get(o.id);
    if (map) for (const b of o.bones!) {
      const bone = map.get(b.name)!;
      bone.quaternion.copy(rigs.restQ.get(bone)!).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(b.pose[0], b.pose[1], b.pose[2], 'XYZ')));
    }
  }
  out.updateMatrixWorld(true);
  return { out, nodes, rigs };
}

export function exportGLB(scene: Scene): Promise<ArrayBuffer> {
  const { out, nodes, rigs } = buildThree(scene);
  const clip = animationClip(scene, nodes, rigs);
  return new Promise((resolve, reject) => {
    new GLTFExporter().parse(out, (r) => resolve(r as ArrayBuffer), (e) => reject(e), { binary: true, onlyVisible: true, animations: clip ? [clip] : [] });
  });
}

/**
 * Read a .glb/.gltf file into editable meshes. Each mesh is baked into world
 * coordinates and welded: glTF splits vertices wherever normals or UVs differ,
 * and without the weld a cube would arrive as six separate squares.
 */
export async function importGLTF(data: ArrayBuffer): Promise<{ name: string; mesh: EditMesh }[]> {
  const gltf = await new GLTFLoader().parseAsync(data, '');
  gltf.scene.updateMatrixWorld(true);
  const out: { name: string; mesh: EditMesh }[] = [];
  gltf.scene.traverse((node) => {
    const m = node as THREE.Mesh;
    if (!m.isMesh || !m.geometry?.attributes.position) return;
    const geo = m.geometry.clone().applyMatrix4(m.matrixWorld);
    const pos = geo.attributes.position.array as ArrayLike<number>;
    const mesh = EditMesh.fromTriangles(pos, geo.index ? (geo.index.array as ArrayLike<number>) : undefined).weld(1e-6).compact();
    out.push({ name: m.name || 'Imported', mesh });
    geo.dispose();
  });
  return out;
}
