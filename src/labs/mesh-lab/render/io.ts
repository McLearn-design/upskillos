// glTF in and out. glTF is the web's model format and Blender reads and writes
// it; it stores triangles, so for keeping quads to edit later use OBJ instead.

import * as THREE from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import type { Scene } from '../core/Scene';
import { EditMesh } from '../core/EditMesh';
import { evaluate } from '../core/modifiers';
import { toGeometry } from './Viewport';
import { eulerToQuat, hasKeys, transformAt } from '../core/animation';

/** Build a plain three.js scene from the model: the hierarchy, transforms, modifiers applied. */
export function toThreeScene(scene: Scene): THREE.Scene {
  return buildThree(scene).out;
}

/**
 * The animation as one three.js clip, baked: every frame of the timeline sampled
 * (so easing and slerp come out exactly as MeshLab plays them), rotation as
 * quaternions. glTF stores animation this way, and Blender imports it as an action.
 */
export function animationClip(scene: Scene, nodes: Map<string, THREE.Object3D>): THREE.AnimationClip | null {
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
  }
  return tracks.length ? new THREE.AnimationClip('MeshLab', (end - start) / fps, tracks) : null;
}

function buildThree(scene: Scene): { out: THREE.Scene; nodes: Map<string, THREE.Object3D> } {
  const out = new THREE.Scene();
  const nodes = new Map<string, THREE.Object3D>();
  for (const o of scene.objects) {
    let node: THREE.Object3D;
    if (o.mesh) {
      const { geo } = toGeometry(o.modifiers.length ? evaluate(o.mesh, o.modifiers) : o.mesh);
      if (!o.smooth) { const flat = geo.toNonIndexed(); flat.computeVertexNormals(); node = new THREE.Mesh(flat); }
      else node = new THREE.Mesh(geo);
      (node as THREE.Mesh).material = new THREE.MeshStandardMaterial({ color: o.material.color, roughness: o.material.roughness, metalness: o.material.metalness });
    } else if (o.kind === 'light') {
      node = new THREE.DirectionalLight(o.light?.color ?? '#ffffff', o.light?.intensity ?? 2);
    } else node = new THREE.Object3D();
    node.name = o.name;
    node.position.set(...o.position);
    node.rotation.set(o.rotation[0], o.rotation[1], o.rotation[2], 'XYZ');
    node.scale.set(...o.scale);
    node.visible = o.visible;
    nodes.set(o.id, node);
  }
  for (const o of scene.objects) (o.parent ? nodes.get(o.parent)! : out).add(nodes.get(o.id)!);
  return { out, nodes };
}

export function exportGLB(scene: Scene): Promise<ArrayBuffer> {
  const { out, nodes } = buildThree(scene);
  const clip = animationClip(scene, nodes);
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
