// The scene model: the single source of truth for MeshLab.
//
// The viewport draws it, the GUI edits it, scripts edit it, undo snapshots it,
// files save it. Three.js objects are built FROM it and never read back into it
// (except while a gizmo drag is in progress, which the editor commits at the
// end). Three's Matrix4/Quaternion are used only as maths.

import { Euler, Matrix4, Quaternion, Vector3 } from 'three';
import { EditMesh, type MeshSnapshot, type Vec3 } from './EditMesh';
import type { Modifier } from './modifiers';
import { DEFAULT_TIMELINE, cloneAnimation, transformAt, type Animation, type Timeline } from './animation';
import { cloneBones, cloneSkin, type Bone, type Skin } from './armature';

export type ObjectKind = 'mesh' | 'empty' | 'light' | 'armature';
export interface Material { color: string; roughness: number; metalness: number }

export interface SceneObject {
  id: string;
  name: string;
  kind: ObjectKind;
  parent: string | null;
  position: Vec3;
  /** Euler angles in radians, applied in XYZ order (three.js's default). */
  rotation: Vec3;
  scale: Vec3;
  visible: boolean;
  mesh: EditMesh | null;
  material: Material;
  modifiers: Modifier[];
  /** Smooth shading (averaged vertex normals) instead of flat faces. */
  smooth: boolean;
  light?: { type: 'point' | 'sun'; intensity: number; color: string };
  /** Keyframes on the transform channels, if the object is animated. */
  anim?: Animation;
  /** An armature's bones (rest positions and current pose). */
  bones?: Bone[];
  /** A mesh bound to an armature: its weights. */
  skin?: Skin;
}

export interface SceneJSON {
  format: 'meshlab-scene';
  version: 1;
  nextId: number;
  objects: (Omit<SceneObject, 'mesh'> & { mesh: MeshSnapshot | null })[];
  /** Frame range, speed and current frame. Missing in files written before animation existed. */
  timeline?: Timeline;
}

const v3 = (v: Vec3): Vec3 => [v[0], v[1], v[2]];

export class Scene {
  objects: SceneObject[] = [];
  nextId = 1;
  timeline: Timeline = { ...DEFAULT_TIMELINE };

  get(idOrName: string): SceneObject | undefined {
    return this.objects.find((o) => o.id === idOrName) ?? this.objects.find((o) => o.name === idOrName);
  }

  children(id: string | null): SceneObject[] {
    return this.objects.filter((o) => o.parent === id);
  }

  /** Blender-style unique names: Cube, Cube.001, Cube.002 … */
  uniqueName(base: string, except?: string): string {
    const taken = new Set(this.objects.filter((o) => o.id !== except).map((o) => o.name));
    if (!taken.has(base)) return base;
    const stem = base.replace(/\.\d{3}$/, '');
    for (let i = 1; ; i++) { const n = `${stem}.${String(i).padStart(3, '0')}`; if (!taken.has(n)) return n; }
  }

  add(init: Partial<SceneObject> & { name: string; kind?: ObjectKind }): SceneObject {
    const o: SceneObject = {
      id: `o${this.nextId++}`,
      name: this.uniqueName(init.name),
      kind: init.kind ?? 'mesh',
      parent: init.parent ?? null,
      position: init.position ? v3(init.position) : [0, 0, 0],
      rotation: init.rotation ? v3(init.rotation) : [0, 0, 0],
      scale: init.scale ? v3(init.scale) : [1, 1, 1],
      visible: init.visible ?? true,
      mesh: init.mesh ?? null,
      material: init.material ?? { color: '#b8c0cc', roughness: 0.5, metalness: 0 },
      modifiers: init.modifiers ?? [],
      smooth: init.smooth ?? false,
      light: init.light,
      anim: cloneAnimation(init.anim),
      bones: init.bones ? cloneBones(init.bones) : undefined,
      skin: cloneSkin(init.skin),
    };
    if (o.parent && !this.get(o.parent)) o.parent = null;
    this.objects.push(o);
    return o;
  }

  /** Remove an object. Its children move up to its parent and keep their place in the world. */
  remove(id: string): void {
    const o = this.get(id);
    if (!o) return;
    for (const c of this.children(o.id)) this.setParent(c.id, o.parent, true);
    this.objects = this.objects.filter((x) => x.id !== o.id);
  }

  localMatrix(o: SceneObject): Matrix4 {
    const q = new Quaternion().setFromEuler(new Euler(o.rotation[0], o.rotation[1], o.rotation[2], 'XYZ'));
    return new Matrix4().compose(new Vector3(...o.position), q, new Vector3(...o.scale));
  }

  /** World = parent's world × local, all the way up the chain. */
  worldMatrix(o: SceneObject): Matrix4 {
    const m = this.localMatrix(o);
    let p = o.parent ? this.get(o.parent) : undefined;
    while (p) { m.premultiply(this.localMatrix(p)); p = p.parent ? this.get(p.parent) : undefined; }
    return m;
  }

  /** The world matrix an object will have at a frame, its parents' animation included. Changes nothing. */
  worldMatrixAt(o: SceneObject, frame: number): Matrix4 {
    const local = (x: SceneObject) => {
      const t = transformAt(x, frame);
      const q = new Quaternion().setFromEuler(new Euler(t.rotation[0], t.rotation[1], t.rotation[2], 'XYZ'));
      return new Matrix4().compose(new Vector3(...t.position), q, new Vector3(...t.scale));
    };
    const m = local(o);
    let p = o.parent ? this.get(o.parent) : undefined;
    while (p) { m.premultiply(local(p)); p = p.parent ? this.get(p.parent) : undefined; }
    return m;
  }

  /** The chain from the root down to this object. */
  ancestry(o: SceneObject): SceneObject[] {
    const out = [o];
    let p = o.parent ? this.get(o.parent) : undefined;
    while (p) { out.unshift(p); p = p.parent ? this.get(p.parent) : undefined; }
    return out;
  }

  isAncestor(maybe: string, of: string): boolean {
    let p = this.get(of)?.parent;
    while (p) { if (p === maybe) return true; p = this.get(p)?.parent ?? null; }
    return false;
  }

  /**
   * Re-parent. With keepWorld the object stays where it is on screen: its new
   * local transform is inverse(new parent's world) × its world.
   */
  setParent(id: string, parentId: string | null, keepWorld = true): boolean {
    const o = this.get(id);
    if (!o || parentId === id || (parentId && this.isAncestor(id, parentId))) return false;
    if (parentId && !this.get(parentId)) return false;
    if (keepWorld) {
      const world = this.worldMatrix(o);
      const parentWorld = parentId ? this.worldMatrix(this.get(parentId)!) : new Matrix4();
      const local = parentWorld.invert().multiply(world);
      const pos = new Vector3(), q = new Quaternion(), s = new Vector3();
      local.decompose(pos, q, s);
      const e = new Euler().setFromQuaternion(q, 'XYZ');
      o.position = [pos.x, pos.y, pos.z]; o.rotation = [e.x, e.y, e.z]; o.scale = [s.x, s.y, s.z];
    }
    o.parent = parentId;
    return true;
  }

  toJSON(): SceneJSON {
    return {
      format: 'meshlab-scene', version: 1, nextId: this.nextId, timeline: { ...this.timeline },
      objects: this.objects.map((o) => ({
        ...o, position: v3(o.position), rotation: v3(o.rotation), scale: v3(o.scale),
        material: { ...o.material }, modifiers: o.modifiers.map((m) => ({ ...m })), light: o.light ? { ...o.light } : undefined,
        mesh: o.mesh ? o.mesh.toSnapshot() : null, anim: cloneAnimation(o.anim),
        bones: o.bones ? cloneBones(o.bones) : undefined, skin: cloneSkin(o.skin),
      })),
    };
  }

  static fromJSON(j: SceneJSON): Scene {
    if (j?.format !== 'meshlab-scene') throw new Error('Not a MeshLab scene file');
    const s = new Scene();
    s.nextId = j.nextId;
    s.timeline = { ...DEFAULT_TIMELINE, ...j.timeline };
    s.objects = j.objects.map((o) => ({
      ...o, position: v3(o.position), rotation: v3(o.rotation), scale: v3(o.scale),
      material: { ...o.material }, modifiers: o.modifiers.map((m) => ({ ...m })), light: o.light ? { ...o.light } : undefined,
      mesh: o.mesh ? EditMesh.fromSnapshot(o.mesh) : null, anim: cloneAnimation(o.anim),
      bones: o.bones ? cloneBones(o.bones) : undefined, skin: cloneSkin(o.skin),
    }));
    return s;
  }
}
