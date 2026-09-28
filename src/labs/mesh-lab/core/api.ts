// The scripting API: the same scene the GUI edits, as JavaScript objects.
//
//   const cube = scene.add.cube({ size: 2 })
//   cube.position.set(3, 0, 0)
//   cube.rotation.y = Math.PI / 4
//   for (const v of cube.mesh.verts) v.y += 0.2 * Math.sin(3 * v.x)
//   cube.mesh.extrude(cube.mesh.faces.facing([0, 1, 0]), 1)
//   cube.modifiers.add('subsurf', { levels: 2 })
//
// Every line the GUI writes to the log is valid here, so modelling by hand and
// replaying the log give the same scene. A whole script is one undo step, and a
// script that throws leaves the scene exactly as it was.

import { EditMesh, type Vec3 } from './EditMesh';
import type { Editor, ScriptResult } from './Editor';
import { Scene, type SceneObject } from './Scene';
import { makePrimitive, type PrimitiveParams, type PrimitiveType } from './primitives';
import { defaultModifier, evaluate, onMirrorPlane, type Modifier } from './modifiers';
import { catmullClark } from './subdivision';
import { Trace } from './trace';

type Vec3Handle = { x: number; y: number; z: number; set(x: number, y: number, z: number): Vec3Handle; toArray(): Vec3 };

function vecHandle(get: () => Vec3): Vec3Handle {
  const h = {
    get x() { return get()[0]; }, set x(v: number) { get()[0] = v; },
    get y() { return get()[1]; }, set y(v: number) { get()[1] = v; },
    get z() { return get()[2]; }, set z(v: number) { get()[2] = v; },
    set(x: number, y: number, z: number) { const a = get(); a[0] = x; a[1] = y; a[2] = z; return h; },
    toArray: () => [...get()] as Vec3,
    toString: () => `(${get().map((c) => +c.toFixed(4)).join(', ')})`,
  };
  return h;
}

const PRIMS: PrimitiveType[] = ['cube', 'plane', 'grid', 'circle', 'cylinder', 'cone', 'uvSphere', 'torus'];
const NAMES: Record<PrimitiveType, string> = { cube: 'Cube', plane: 'Plane', grid: 'Grid', circle: 'Circle', cylinder: 'Cylinder', cone: 'Cone', uvSphere: 'Sphere', torus: 'Torus' };

export function makeApi(editor: Editor, print: (s: string) => void) {
  const scene = () => editor.scene;
  const trace = (op: string) => {
    if (!editor.traceEnabled) return undefined;
    const t = new Trace(op);
    editor.trace = t;
    return t;
  };

  function meshHandle(o: SceneObject) {
    const m = () => {
      if (!o.mesh) throw new Error(`${o.name} has no mesh`);
      return o.mesh;
    };
    const vert = (i: number) => {
      const h = vecHandle(() => m().verts[i]) as Vec3Handle & { index: number; normal: Vec3 };
      Object.defineProperty(h, 'index', { value: i, enumerable: true });
      Object.defineProperty(h, 'normal', { get: () => m().vertexNormal(i) });
      return h;
    };
    const facesList = () => {
      const mesh = m();
      const list = mesh.faces.map((f, i) => ({ index: i, verts: [...f], get normal() { return mesh.faceNormal(i); }, get center() { return mesh.faceCenter(i); }, get area() { return mesh.faceArea(i); } }));
      // Helpers for choosing faces in scripts.
      const facing = (d: Vec3, tol = 0.9) => { const l = Math.hypot(...d); return list.filter((f) => { const n = f.normal; return (n[0] * d[0] + n[1] * d[1] + n[2] * d[2]) / l > tol; }).map((f) => f.index); };
      Object.defineProperties(list, {
        facing: { value: facing },
        top: { value: () => facing([0, 1, 0]) },
        bottom: { value: () => facing([0, -1, 0]) },
        where: { value: (pred: (f: typeof list[number]) => boolean) => list.filter(pred).map((f) => f.index) },
      });
      return list as typeof list & { facing: typeof facing; top(): number[]; bottom(): number[]; where(p: (f: typeof list[number]) => boolean): number[] };
    };
    const api = {
      get verts() { return m().verts.map((_, i) => vert(i)); },
      get vertices() { return api.verts; },
      get faces() { return facesList(); },
      get edges() { return [...m().edges().values()].map((e) => ({ a: e.a, b: e.b, faces: [...e.faces], get length() { const p = m().verts[e.a], q = m().verts[e.b]; return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]); } })); },
      stats: () => m().stats(),
      /** The index of the vertex nearest a point (local coordinates). */
      nearest(p: Vec3) {
        let best = -1, bd = Infinity;
        m().verts.forEach((v, i) => { const d = (v[0] - p[0]) ** 2 + (v[1] - p[1]) ** 2 + (v[2] - p[2]) ** 2; if (d < bd) { bd = d; best = i; } });
        return best;
      },
      /** The render form: flat typed arrays, exactly what goes to the GPU. */
      buffer: () => { const t = m().triangulate(); return { positions: t.positions, indices: t.indices }; },
      extrude(faces: number[], distance = 1) { m().extrudeFaces(faces, distance, trace('Extrude'), { skipWall: onMirrorPlane(m(), o.modifiers) }); return api; },
      inset(faces: number[], amount = 0.25) { m().insetFaces(faces, amount, trace('Inset')); return api; },
      loopCut(a: number, b: number, t = 0.5) { m().loopCut(a, b, t, trace('Loop cut')); return api; },
      split(faces?: number[]) { m().subdivideFaces(faces); return api; },
      subdivide(levels = 1) { for (let i = 0; i < levels; i++) o.mesh = catmullClark(m(), i === 0 ? trace('Catmull–Clark') : undefined); return api; },
      delete(what: { faces?: number[]; verts?: number[]; edges?: [number, number][] }) {
        if (what.faces) m().deleteFaces(what.faces);
        if (what.edges) m().deleteEdges(what.edges);
        if (what.verts) m().deleteVerts(what.verts);
        return api;
      },
      merge(verts: number[], at?: Vec3) { m().mergeVerts(verts, at, trace('Merge')); return api; },
      flip(faces?: number[]) { m().flip(faces); return api; },
      weld(tol = 0) { m().weld(tol); return api; },
      translate(verts: number[], d: Vec3) { m().translateVerts(verts, d); return api; },
      setVerts(map: Record<number, Vec3>) { for (const [i, p] of Object.entries(map)) m().verts[Number(i)] = [p[0], p[1], p[2]]; m().touch(); return api; },
      toString: () => { const s = m().stats(); return `Mesh(${s.verts} verts, ${s.edges} edges, ${s.faces} faces)`; },
    };
    return api;
  }

  function objHandle(o: SceneObject) {
    const mesh = o.mesh || o.kind === 'mesh' ? meshHandle(o) : null;
    const h = {
      get id() { return o.id; },
      get name() { return o.name; }, set name(v: string) { o.name = scene().uniqueName(String(v), o.id); },
      get kind() { return o.kind; },
      position: vecHandle(() => o.position),
      rotation: vecHandle(() => o.rotation),
      scale: vecHandle(() => o.scale),
      get visible() { return o.visible; }, set visible(v: boolean) { o.visible = !!v; },
      get smooth() { return o.smooth; }, set smooth(v: boolean) { o.smooth = !!v; },
      material: {
        get color() { return o.material.color; }, set color(v: string) { o.material.color = String(v); },
        get roughness() { return o.material.roughness; }, set roughness(v: number) { o.material.roughness = v; },
        get metalness() { return o.material.metalness; }, set metalness(v: number) { o.material.metalness = v; },
      },
      get parent(): ReturnType<typeof objHandle> | null { return o.parent ? objHandle(scene().get(o.parent)!) : null; },
      set parent(p: { id: string } | null) { if (!scene().setParent(o.id, p ? p.id : null, true)) throw new Error(`Cannot parent ${o.name} there`); },
      get children() { return scene().children(o.id).map(objHandle); },
      get mesh() { return mesh; },
      /** Alias for mesh, matching three.js's naming. */
      get geometry() { return mesh; },
      /** 4×4 matrices as 16 numbers in column-major order, like three.js's Matrix4.elements. */
      get localMatrix() { return scene().localMatrix(o).elements.slice(); },
      get worldMatrix() { return scene().worldMatrix(o).elements.slice(); },
      modifiers: {
        add(type: Modifier['type'], opts: Record<string, unknown> = {}) { o.modifiers.push({ ...defaultModifier(type), ...opts } as Modifier); if (type === 'subsurf') o.smooth = true; return h; },
        set(i: number, patch: Partial<Modifier>) { Object.assign(o.modifiers[i], patch); return h; },
        remove(i: number) { o.modifiers.splice(i, 1); return h; },
        apply() { if (o.mesh) o.mesh = evaluate(o.mesh, o.modifiers); o.modifiers = []; return h; },
        get list() { return o.modifiers.map((m) => ({ ...m })); },
      },
      delete() { scene().remove(o.id); },
      duplicate() { return objHandle(editor.duplicateOne(o)); },
      toString: () => `${o.kind === 'mesh' ? 'Mesh' : o.kind === 'light' ? 'Light' : 'Empty'} "${o.name}"`,
    };
    return h;
  }

  const add: Record<string, (p?: Record<string, unknown>) => ReturnType<typeof objHandle>> = {};
  for (const type of PRIMS) {
    add[type] = (p: Record<string, unknown> = {}) => {
      const { name, position, rotation, scale, parent, ...params } = p as PrimitiveParams & { name?: string; position?: Vec3; rotation?: Vec3; scale?: Vec3; parent?: { id: string } };
      const o = scene().add({ name: name ?? NAMES[type], mesh: makePrimitive(type, params), position, rotation, scale, parent: parent?.id ?? null });
      return objHandle(o);
    };
  }
  add.empty = (p: Record<string, unknown> = {}) => objHandle(scene().add({ name: String(p.name ?? 'Empty'), kind: 'empty', position: p.position as Vec3 }));
  add.mesh = (p: Record<string, unknown> = {}) => objHandle(scene().add({ name: String(p.name ?? 'Mesh'), mesh: new EditMesh((p.verts as Vec3[]) ?? [], (p.faces as number[][]) ?? []), position: p.position as Vec3 }));

  const sceneApi = {
    add,
    // Short forms, matching the spec's example: scene.addCube({ size: 10 }).
    addCube: (p?: Record<string, unknown>) => add.cube(p),
    addSphere: (p?: Record<string, unknown>) => add.uvSphere(p),
    get(nameOrId: string) { const o = scene().get(nameOrId); if (!o) throw new Error(`No object called "${nameOrId}"`); return objHandle(o); },
    find(nameOrId: string) { const o = scene().get(nameOrId); return o ? objHandle(o) : null; },
    get objects() { return scene().objects.map(objHandle); },
    get selected() { return [...editor.selected].map((id) => scene().get(id)).filter(Boolean).map((o) => objHandle(o!)); },
    get active() { const o = editor.activeObject; return o ? objHandle(o) : null; },
    delete(h: { id: string }) { scene().remove(h.id); },
    clear() { scene().objects = []; },
  };

  const console = { log: (...a: unknown[]) => print(a.map(show).join(' ')), warn: (...a: unknown[]) => print(a.map(show).join(' ')), error: (...a: unknown[]) => print(a.map(show).join(' ')) };
  return { scene: sceneApi, log: console.log, print: console.log, console };
}

function show(x: unknown): string {
  if (typeof x === 'string') return x;
  if (x && typeof (x as { toString?: unknown }).toString === 'function' && (x as object).toString !== Object.prototype.toString && !Array.isArray(x)) return String(x);
  try { return JSON.stringify(x, (_k, v) => (typeof v === 'number' ? +v.toFixed(6) : v instanceof Float32Array || v instanceof Uint32Array ? Array.from(v) : v)); } catch { return String(x); }
}

/** Run a script as one undoable step. On any error the scene is left exactly as it was. */
export function runScript(editor: Editor, code: string, label = 'Run script'): ScriptResult {
  const output: string[] = [];
  const before = editor.scene.toJSON();
  const api = makeApi(editor, (s) => output.push(s));
  editor.scripting = true;
  try {
    const fn = new Function('scene', 'log', 'print', 'console', `"use strict";\n${code}`);
    const r = fn(api.scene, api.log, api.print, api.console);
    if (r !== undefined) output.push(show(r));
    const bad = editor.scene.objects.flatMap((o) => (o.mesh ? o.mesh.touch().validate().map((m) => `${o.name}: ${m}`) : []));
    if (bad.length) throw new Error(`The script left an invalid mesh:\n${bad.slice(0, 5).join('\n')}`);
    editor.scripting = false;
    editor.commitChange(label, before, code);
    return { output, error: null };
  } catch (e) {
    editor.scripting = false;
    const s = Scene.fromJSON(before);
    editor.scene.objects = s.objects;
    editor.scene.nextId = s.nextId;
    editor.emit('scene');
    return { output, error: e instanceof Error ? e.message : String(e) };
  }
}
