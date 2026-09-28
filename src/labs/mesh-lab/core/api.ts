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
import { Scene, type SceneJSON, type SceneObject } from './Scene';
import { makePrimitive, type PrimitiveParams, type PrimitiveType } from './primitives';
import { defaultModifier, evaluate, onMirrorPlane, type Modifier } from './modifiers';
import { catmullClark } from './subdivision';
import { Trace } from './trace';
import { Recorder, brief, instrument, type Recording } from './recorder';
import { gaussianCurvature, heatGeodesic, meanCurvature, operators, smooth as smoothMesh } from './geometry';
import type { FieldSpec } from './fields';
import { CHANNELS, cloneAnimation, hasKeys, removeKey, setKey, transformAt, type Interp } from './animation';

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

function vec(v: ArrayLike<number> | Vec3Handle): Vec3 {
  const a = 'toArray' in v ? v.toArray() : Array.from(v as ArrayLike<number>);
  if (a.length !== 3 || a.some((x) => typeof x !== 'number' || !Number.isFinite(x))) throw new Error(`Expected three numbers, got ${JSON.stringify(a)}`);
  return [a[0], a[1], a[2]];
}

function assign(target: Vec3, v: ArrayLike<number> | Vec3Handle): void {
  const a = vec(v);
  target[0] = a[0]; target[1] = a[1]; target[2] = a[2];
}

const INTERPS: Interp[] = ['constant', 'linear', 'ease'];
function interpOf(x: unknown): Interp | undefined {
  if (x === undefined) return undefined;
  if (!INTERPS.includes(x as Interp)) throw new Error(`Interpolation must be "constant", "linear" or "ease", not ${JSON.stringify(x)}`);
  return x as Interp;
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
      // Geometry processing: one number per vertex, as a plain array.
      curvature(kind: 'mean' | 'gaussian' = 'mean') { return Array.from(kind === 'gaussian' ? gaussianCurvature(m()) : meanCurvature(m())); },
      geodesic(from: number | number[]) { return Array.from(heatGeodesic(m(), Array.isArray(from) ? from : [from], trace('Heat method'))); },
      smooth(opts: { verts?: number[]; iterations?: number; lambda?: number; method?: 'uniform' | 'cotan' } = {}) { smoothMesh(m(), { iterations: opts.iterations ?? 5, lambda: opts.lambda ?? 0.5, method: opts.method ?? 'uniform', only: opts.verts }, trace('Smooth')); return api; },
      /** The cotan Laplacian as rows of [neighbour, weight] pairs, and each vertex's area (mass). */
      laplacian() { const { C, mass } = operators(m()); return { rows: C.rows.map((r) => [...r.entries()]), mass: Array.from(mass) }; },
      /** Colour the mesh by a field: "geodesic" (with from), "mean", "gaussian", "x", "y", "z", or your own values. */
      showField(what: string | number[], opts: { from?: number | number[]; source?: number | number[]; label?: string } = {}) {
        const from = opts.from ?? opts.source;
        const spec: FieldSpec = Array.isArray(what) ? { kind: 'custom', values: what.map(Number), label: opts.label }
          : what === 'geodesic' ? { kind: 'geodesic', sources: from === undefined ? [] : Array.isArray(from) ? from : [from] }
          : what === 'mean' || what === 'gaussian' ? { kind: what }
          : what === 'x' || what === 'y' || what === 'z' ? { kind: 'coord', axis: 'xyz'.indexOf(what) as 0 | 1 | 2 }
          : (() => { throw new Error(`showField: unknown field "${what}". Use "geodesic", "mean", "gaussian", "x", "y", "z" or an array of numbers`); })();
        if (!editor.showField(spec, o.id)) throw new Error(editor.message);
        return api;
      },
      toString: () => { const s = m().stats(); return `Mesh(${s.verts} verts, ${s.edges} edges, ${s.faces} faces)`; },
    };
    return api;
  }

  function objHandle(o: SceneObject) {
    const mesh = o.mesh || o.kind === 'mesh' ? meshHandle(o) : null;
    const pos = vecHandle(() => o.position), rot = vecHandle(() => o.rotation), scl = vecHandle(() => o.scale);
    const h = {
      get id() { return o.id; },
      get name() { return o.name; }, set name(v: string) { o.name = scene().uniqueName(String(v), o.id); },
      get kind() { return o.kind; },
      // Read a handle and change one axis (cube.position.x = 2), or assign all three: cube.position = [1, 2, 3].
      get position() { return pos; }, set position(v: ArrayLike<number> | Vec3Handle) { assign(o.position, v); },
      get rotation() { return rot; }, set rotation(v: ArrayLike<number> | Vec3Handle) { assign(o.rotation, v); },
      get scale() { return scl; }, set scale(v: ArrayLike<number> | Vec3Handle) { assign(o.scale, v); },
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
      // Animation: keys pin a channel to a value at a frame; frames in between are interpolated.
      keyframe(frame: number, values: { position?: Vec3 | Vec3Handle; rotation?: Vec3 | Vec3Handle; scale?: Vec3 | Vec3Handle; interp?: Interp } = {}) {
        if (!Number.isFinite(frame)) throw new Error('keyframe: the frame must be a number');
        const given = CHANNELS.filter((c) => values[c] !== undefined);
        o.anim ??= {};
        for (const c of given.length ? given : CHANNELS) setKey(o.anim, c, Math.round(frame), values[c] !== undefined ? vec(values[c]!) : o[c], interpOf(values.interp));
        return h;
      },
      deleteKeyframe(frame: number) { if (o.anim) { for (const c of CHANNELS) removeKey(o.anim, c, frame); if (!hasKeys(o.anim)) o.anim = undefined; } return h; },
      setInterpolation(frame: number, interp: Interp) { const i = interpOf(interp)!; for (const c of CHANNELS) for (const k of o.anim?.[c] ?? []) if (k.frame === frame) k.interp = i; return h; },
      get rotationMode() { return o.anim?.rotationMode ?? 'euler'; },
      set rotationMode(m: 'euler' | 'quaternion') { if (m !== 'euler' && m !== 'quaternion') throw new Error('rotationMode is "euler" or "quaternion"'); (o.anim ??= {}).rotationMode = m; },
      /** The keys, per channel. */
      get animation() { return cloneAnimation(o.anim) ?? null; },
      clearAnimation() { o.anim = undefined; return h; },
      /** The transform at a frame, without going there. */
      sample(frame: number) { const t = transformAt(o, frame); return { position: [...t.position], rotation: [...t.rotation], scale: [...t.scale] }; },
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
    /** Stop showing a heat map. */
    hideField() { editor.clearField(); },
    /** The current frame. Setting it moves every animated object to its keyed transform. */
    get frame() { return scene().timeline.frame; },
    set frame(f: number) { scene().timeline.frame = Math.round(f); editor.applyFrame(); },
    get timeline() { const t = scene().timeline; return { start: t.start, end: t.end, fps: t.fps }; },
    setTimeline(t: { start?: number; end?: number; fps?: number }) {
      const cur = scene().timeline;
      const start = Math.round(t.start ?? cur.start), end = Math.round(t.end ?? cur.end), fps = Math.round(t.fps ?? cur.fps);
      if (!(end > start) || !(fps >= 1)) throw new Error('setTimeline: need end > start and fps ≥ 1');
      scene().timeline = { start, end, fps, frame: Math.min(end, Math.max(start, cur.frame)) };
    },
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

/** Keep a script's changes as one undo step, unless it left a mesh that cannot be drawn. */
export function finishScript(editor: Editor, before: SceneJSON, label: string, code: string): void {
  // Objects whose keys the script changed take their transform for the current frame. Others keep
  // what the script set, even if animated, until the next frame change (as in Blender).
  const was = new Map(before.objects.map((o) => [o.id, JSON.stringify(o.anim ?? null)]));
  editor.applyFrame(new Set(editor.scene.objects.filter((o) => o.anim && was.get(o.id) !== JSON.stringify(o.anim)).map((o) => o.id)));
  const bad = editor.scene.objects.flatMap((o) => (o.mesh ? o.mesh.touch().validate().map((m) => `${o.name}: ${m}`) : []));
  if (bad.length) throw new Error(`The script left an invalid mesh:\n${bad.slice(0, 5).join('\n')}`);
  editor.scripting = false;
  editor.commitChange(label, before, code);
}

/** Put the scene back exactly as it was before the script. */
export function rollbackScript(editor: Editor, before: SceneJSON): void {
  editor.scripting = false;
  const s = Scene.fromJSON(before);
  editor.scene.objects = s.objects;
  editor.scene.nextId = s.nextId;
  editor.emit('scene');
}

/**
 * Run a script as one undoable step. On any error the scene is left exactly as it was.
 * With `record`, every statement reports its line and the variables in scope, and
 * the result carries a recording the step player can replay.
 */
export function runScript(editor: Editor, code: string, label = 'Run script', opts: { record?: boolean } = {}): ScriptResult & { recording?: Recording } {
  editor.endPreview();
  const output: string[] = [];
  const before = editor.scene.toJSON();
  const api = makeApi(editor, (s) => output.push(s));
  const rec = opts.record ? new Recorder(editor, () => output.length) : null;
  let line: number | null = null;
  const step = (l: number, vars: () => [string, unknown][]) => {
    line = l;
    if (rec && !rec.truncated) rec.event(l, vars().map(([k, v]) => [k, brief(v)]));
  };
  const recording = (error: { line: number | null; message: string } | null): Recording | undefined => rec
    ? { lang: 'js', code, events: rec.events, scenes: rec.scenes, truncated: rec.truncated, scenesCapped: rec.scenesCapped, output, error }
    : undefined;
  editor.scripting = true;
  try {
    let src = code;
    if (rec) {
      try { src = instrument(code); }
      catch (e) { const m = e instanceof Error ? e.message : String(e); throw new Error(`Syntax error: ${m}`); }
    }
    const fn = new Function('scene', 'log', 'print', 'console', '__step', `"use strict";\n${src}`);
    const r = fn(api.scene, api.log, api.print, api.console, step);
    if (r !== undefined) output.push(show(r));
    rec?.end();
    finishScript(editor, before, label, code);
    return { output, error: null, recording: recording(null) };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    rec?.end();
    rollbackScript(editor, before);
    return { output, error: message, recording: recording({ line, message }) };
  }
}
