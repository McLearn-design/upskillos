// The editor: selection, modes, commands, undo/redo, the GUI → code log and the
// latest algorithm trace. Every change to the scene goes through `run`, which
//
//   1. snapshots the scene (for undo),
//   2. performs the change, recording a trace if tracing is on,
//   3. snapshots again and pushes the pair onto the undo stack,
//   4. appends the equivalent script line to the log,
//   5. notifies the viewport and panels.
//
// The GUI and scripts share this path, so undo, the log and traces behave the
// same however a change was made.

import { Matrix3, Vector3 } from 'three';
import { EditMesh, type Vec3 } from './EditMesh';
import { Scene, type SceneJSON, type SceneObject } from './Scene';
import { makePrimitive, type PrimitiveParams, type PrimitiveType } from './primitives';
import { defaultModifier, evaluate, mirror, onMirrorPlane, type Modifier } from './modifiers';
import { applyBonePatch, bindSkin, evaluatedMesh, removeBone, skinnedSource, skinSource, skinState } from './evaluate';
import { catmullClark } from './subdivision';
import { Trace, fmt, fmtV } from './trace';
import { traceAxes, traceDecompose, traceEuler, traceDeterminant, traceTransform, traceWorld } from './transformTrace';
import { computeField, traceColourMap, type FieldResult, type FieldSpec } from './fields';
import { smooth as smoothMesh, smoothImplicit as smoothMeshImplicit } from './geometry';
import { traceVertexNormal } from './normals';
import { rayFromPixel, tracePick, type Pickable } from './pickRay';
import { traceScreenPick, type ScreenPoint } from './screenPick';
import { traceSilhouette } from './silhouette';
import { traceValence } from './valence';
import { limitPosition } from './limit';
import { traceVertexLaplacian } from './laplacianTrace';
import { traceHeatSolve } from './sparseTrace';
import { traceContour } from './contourTrace';
import { traceUVLookup } from './uvLookup';
import { traceCharts } from './chartTrace';
import { traceUVProjection } from './projection';
import { traceDistortion } from './distortionTrace';
import { hexToLinear, shadePoint } from './shadingTrace';
import { traceTexture } from './textureTrace';
import { traceShaderAssembly } from './shaderTrace';
import { tracePose, traceRestMatrix } from './boneTrace';
import { traceBake, traceClip, traceFootSlide, traceQuaternion, traceSample } from './animTrace';
import { SNAP, traceAxisDrag } from './gizmoDrag';
import { CHANNELS, hasKeys, posesAt, removeBoneKey, removeKey, setBoneKey, setKey, transformAt, type Channel, type Interp } from './animation';
import { cloneBones, limitWeights, moveJoint, orderBones, type Bone, type JointSel } from './armature';
import { DEFAULT_PAINT, dab, neighbourLists, type PaintSettings } from './weightPaint';
import { angleDistortion, sharpEdges, traceUVSubdivision, unwrap as unwrapMesh, uvFits } from './uv';
import { faceTriangles } from './triangulate';
import { bevelEdges, dissolveEdges, dissolveFaces, dissolveVerts, insetRegion } from './modelling';
import { DEFAULT_CAMERA, lookAtRotation, traceDepth, traceLookAt, traceOutline, traceProjection, traceView } from './camera';
import { knife as knifeCut, knifeFaces } from './knife';

export type Mode = 'object' | 'edit' | 'pose' | 'weight' | 'bones';
export type SelectMode = 'vert' | 'edge' | 'face';
export type ChangeKind = 'scene' | 'live' | 'select' | 'mode' | 'trace' | 'frame';
export interface LogEntry { label: string; code: string | null }
export interface ScriptResult { output: string[]; error: string | null }
/** A heat map shown on one object: what was asked for, the mesh it was computed on, and the values. */
export interface FieldView { objectId: string; spec: FieldSpec; mesh: EditMesh; result: FieldResult }

/** A value as source code: numbers trimmed to 6 decimals, everything else as JSON. */
export function lit(x: unknown): string {
  if (typeof x === 'number') return String(Math.abs(x) < 5e-7 ? 0 : +x.toFixed(6));
  if (Array.isArray(x)) return `[${x.map(lit).join(', ')}]`;
  if (x && typeof x === 'object') return `{ ${Object.entries(x).map(([k, v]) => `${/^[A-Za-z_]\w*$/.test(k) ? k : JSON.stringify(k)}: ${lit(v)}`).join(', ')} }`;
  return JSON.stringify(x);
}
export const ref = (o: SceneObject) => `scene.get(${JSON.stringify(o.name)})`;

export class Editor {
  scene = new Scene();
  mode: Mode = 'object';
  selectMode: SelectMode = 'face';
  selected = new Set<string>();
  active: string | null = null;
  sel = { verts: new Set<number>(), edges: new Set<string>(), faces: new Set<number>() };
  /** Each step keeps the log line it wrote, so undo takes the line back out and redo puts it back. */
  undoStack: { label: string; before: SceneJSON; after: SceneJSON; log?: LogEntry }[] = [];
  redoStack: { label: string; before: SceneJSON; after: SceneJSON; log?: LogEntry }[] = [];
  log: LogEntry[] = [];
  traceEnabled = false;
  /** Learning mode: the trace player stops before each quiz step for a prediction. */
  predict = false;
  trace: Trace | null = null;
  /** The object the current trace was recorded on. */
  traceTarget: string | null = null;
  /** The last adjustable operation, for the "Adjust last operation" panel. */
  lastOp: { label: string; params: Record<string, number>; depth: number; rerun: (p: Record<string, number>) => void } | null = null;
  message = '';
  version = 0;
  private listeners = new Set<(k: ChangeKind) => void>();
  private liveBefore: SceneJSON | null = null;
  /** Set by the script API so a script's own operations do not also log lines. */
  scripting = false;
  /** The heat map being shown, if any. It is a view, not part of the scene: not saved, not undone. */
  field: FieldView | null = null;
  showContours = true;
  /** Where the viewport's camera is (the viewport sets it every frame): the eye the shading trace looks from. */
  viewEye: Vec3 | null = null;
  /** The bone being posed (pose mode) or shown in the inspector. */
  activeBone: string | null = null;
  /** Animation playback is running (the loop lives in the UI; this is the switch). */
  playing = false;
  /** While a past state of a script is shown: the real scene, kept aside. */
  private realScene: Scene | null = null;

  subscribe(fn: (k: ChangeKind) => void): () => void { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  emit(k: ChangeKind): void {
    if (this.field && (k === 'scene' || (k === 'live' && this.field.mesh.verts.length <= 3000))) this.refreshField();
    this.version++; for (const fn of this.listeners) fn(k);
  }
  say(msg: string): void { this.message = msg; this.emit('select'); }

  // ── showing a past state (the script step player) ──────────────────────

  get previewing(): boolean { return this.realScene !== null; }
  /** The scene to save: the real one, even while a past state is shown. */
  get modelScene(): Scene { return this.realScene ?? this.scene; }

  /** Show a recorded state of the scene. Nothing is changed or undone; any real edit ends the preview first. */
  preview(j: SceneJSON): void {
    if (!this.realScene) {
      this.realScene = this.scene;
      if (this.mode === 'edit') { this.mode = 'object'; this.clearElements(false); }
    }
    this.scene = Scene.fromJSON(j);
    this.emit('scene');
  }

  endPreview(): void {
    if (!this.realScene) return;
    this.scene = this.realScene;
    this.realScene = null;
    this.emit('scene');
  }

  get activeObject(): SceneObject | undefined { return this.active ? this.scene.get(this.active) : undefined; }
  get editObject(): SceneObject | undefined { return this.mode === 'edit' ? this.activeObject : undefined; }

  // ── the one path for changes ───────────────────────────────────────────

  run<T>(label: string, code: string | null, fn: (trace?: Trace) => T, traceOp?: string): T {
    this.endPreview();
    const before = this.scene.toJSON();
    const trace = this.traceEnabled && traceOp ? new Trace(traceOp) : undefined;
    const result = fn(trace);
    if (trace && trace.steps.length) { this.trace = trace; this.traceTarget = this.active; this.emit('trace'); }
    this.commit(label, before, code);
    return result;
  }

  /** Record a change made since `before` as one undo step (and a log line if code is given). */
  commitChange(label: string, before: SceneJSON, code: string | null): void { this.commit(label, before, code); }

  private commit(label: string, before: SceneJSON, code: string | null) {
    const after = this.scene.toJSON();
    if (JSON.stringify(before) === JSON.stringify(after)) { this.emit('scene'); return; }
    const entry = code && !this.scripting ? { label, code } : undefined;
    this.undoStack.push({ label, before, after, log: entry });
    if (this.undoStack.length > 200) this.undoStack.shift();
    this.redoStack = [];
    if (entry) this.log.push(entry);
    this.message = label;
    this.emit('scene');
  }

  /** Start a continuous change (a gizmo drag). Call liveUpdate while it runs and endLive at the end. */
  beginLive(): void { this.endPreview(); this.liveBefore = this.scene.toJSON(); }
  liveUpdate(): void { this.emit('live'); }
  endLive(label: string, code: string | null): void {
    if (!this.liveBefore) return;
    const before = this.liveBefore;
    this.liveBefore = null;
    this.commit(label, before, code);
  }
  get isLive(): boolean { return this.liveBefore !== null; }

  undo(): void {
    this.endPreview();
    const e = this.undoStack.pop();
    if (!e) return;
    this.redoStack.push(e);
    this.restore(e.before);
    // The log is how to rebuild the scene; an undone step is no longer part of it.
    if (e.log && this.log.at(-1) === e.log) this.log.pop();
    this.message = `Undo: ${e.label}`;
    this.emit('scene');
  }

  redo(): void {
    this.endPreview();
    const e = this.redoStack.pop();
    if (!e) return;
    this.undoStack.push(e);
    this.restore(e.after);
    if (e.log) this.log.push(e.log);
    this.message = `Redo: ${e.label}`;
    this.emit('scene');
  }

  /**
   * Trace the undo history (Edit › Trace the undo stack): every step is a pair of whole-scene snapshots (before and
   * after), so undo restores "before" and redo restores "after". A new change empties the redo stack. Predict
   * questions on what is left after two undos, and on whether redo survives a new change.
   */
  traceUndo(): boolean {
    const trace = new Trace('Undo stack');
    const size = (e: { before: SceneJSON; after: SceneJSON }) => JSON.stringify(e.before).length + JSON.stringify(e.after).length;
    const n = this.undoStack.length, total = this.undoStack.reduce((s, e) => s + size(e), 0);
    const kb = (x: number) => `${(x / 1024).toFixed(1)} KB`;
    trace.step({
      phase: 'Stack', label: n ? `${n} step${n === 1 ? '' : 's'} can be undone, oldest first: ${this.undoStack.map((e) => e.label).join(', ')}` : 'Nothing to undo yet: make a change first',
      detail: 'Every change goes through one path (run): snapshot the scene, change it, snapshot again, push the pair. So every kind of change can be undone the same way.',
      values: this.undoStack.slice(-8).map((e, i) => [`${n - Math.min(8, n) + i + 1}. ${e.label}`, kb(size(e))] as [string, string]),
    });
    if (n) trace.step({
      phase: 'Undo', label: `Undo puts back the scene from before "${this.undoStack[n - 1].label}" and moves that step to the redo stack`,
      detail: 'Undo pops the newest step, restores its "before" snapshot, and pushes the step onto the redo stack, so redo can restore its "after" snapshot.',
      values: [['undo stack after one undo', String(n - 1)], ['redo stack after one undo', String(this.redoStack.length + 1)]],
      quiz: { prompt: `There are ${n} steps on the undo stack. How many are left after pressing Ctrl+Z twice?`, answer: [Math.max(0, n - 2)], labels: ['steps'], rule: 'Each undo pops one step (none if the stack is empty).', tolerance: 0 },
    });
    trace.step({
      phase: 'Redo', label: `${this.redoStack.length} step${this.redoStack.length === 1 ? '' : 's'} can be redone`,
      detail: 'Redo pops from the redo stack, restores the "after" snapshot and pushes the step back onto the undo stack. Any new change empties the redo stack: the undone future is gone.',
      values: this.redoStack.map((e) => ['redo', e.label] as [string, string]),
      quiz: { prompt: 'You undo twice, then move an object. How many steps can now be redone?', answer: [0], labels: ['steps'], rule: 'A new change clears the redo stack.', tolerance: 0 },
    });
    trace.step({ phase: 'Memory', label: `The undo stack holds ${kb(total)} of snapshots (at most 200 steps are kept)`, detail: 'Snapshots are simple and always correct, but each step stores the whole scene twice. The command pattern stores only what changed, at the cost of writing an undo for every command.', values: [['total', kb(total)], ['steps', String(n)]] });
    this.trace = trace; this.traceTarget = this.active; this.emit('trace');
    this.message = `Undo stack: ${n} steps, redo stack: ${this.redoStack.length}`;
    this.emit('select');
    return true;
  }

  private restore(j: SceneJSON): void {
    this.scene = Scene.fromJSON(j);
    this.selected = new Set([...this.selected].filter((id) => this.scene.get(id)));
    if (this.active && !this.scene.get(this.active)) this.active = null;
    if (this.mode === 'edit' && !this.activeObject?.mesh) this.mode = 'object';
    if (this.mode === 'pose' && !this.activeObject?.bones) this.mode = 'object';
    if (this.mode === 'weight' && !this.activeObject?.skin) this.mode = 'object';
    if (this.mode === 'bones' && !this.activeObject?.bones) this.mode = 'object';
    this.scene.restPose = this.mode === 'bones' ? this.active : null;
    if (this.boneSel && !this.activeObject?.bones?.some((b) => b.name === this.boneSel!.bone)) this.boneSel = null;
    this.clearElements(false);
  }

  // ── files ──────────────────────────────────────────────────────────────

  newScene(): void {
    this.realScene = null;
    this.scene = new Scene();
    this.mode = 'object';
    this.selected.clear(); this.active = null; this.clearElements(false);
    this.undoStack = []; this.redoStack = []; this.log = []; this.trace = null;
    const cube = this.scene.add({ name: 'Cube', mesh: makePrimitive('cube'), material: { color: '#b8c0cc', roughness: 0.5, metalness: 0 } });
    this.scene.add({ name: 'Light', kind: 'light', position: [4, 6, 3], light: { type: 'sun', intensity: 2.5, color: '#ffffff' } });
    this.selectObject(cube.id);
    this.emit('scene');
  }

  load(j: SceneJSON, label = 'Open file'): void {
    this.exitEdit();
    this.run(label, null, () => {
      const s = Scene.fromJSON(j);
      this.scene.objects = s.objects;
      this.scene.nextId = s.nextId;
    });
    this.selected.clear(); this.active = null;
  }

  // ── object selection ───────────────────────────────────────────────────

  selectObject(id: string | null, additive = false): void {
    if (this.mode === 'edit') return;
    if (!additive) this.selected.clear();
    if (id) {
      if (additive && this.selected.has(id) && this.active === id) { this.selected.delete(id); this.active = [...this.selected].pop() ?? null; }
      else { this.selected.add(id); this.active = id; }
    } else this.active = null;
    this.emit('select');
  }

  selectAllObjects(on = true): void {
    this.selected = new Set(on ? this.scene.objects.map((o) => o.id) : []);
    if (!on) this.active = null; else if (!this.active) this.active = this.scene.objects[0]?.id ?? null;
    this.emit('select');
  }

  // ── object commands ────────────────────────────────────────────────────

  addPrimitive(type: PrimitiveType, params: PrimitiveParams = {}, opts: { name?: string; position?: Vec3; parent?: string | null } = {}): SceneObject {
    if (this.mode === 'edit') this.exitEdit();
    const name = opts.name ?? { cube: 'Cube', plane: 'Plane', grid: 'Grid', circle: 'Circle', cylinder: 'Cylinder', cone: 'Cone', uvSphere: 'Sphere', torus: 'Torus' }[type];
    const unique = this.scene.uniqueName(name);
    const args: Record<string, unknown> = { ...params, name: unique };
    if (opts.position) args.position = opts.position;
    const o = this.run(`Add ${type}`, `scene.add.${type}(${lit(args)})`, () =>
      this.scene.add({ name: unique, mesh: makePrimitive(type, params), position: opts.position, parent: opts.parent ?? null }));
    this.selectObject(o.id);
    return o;
  }

  addEmpty(name = 'Empty'): SceneObject {
    const unique = this.scene.uniqueName(name);
    const o = this.run('Add empty', `scene.add.empty(${lit({ name: unique })})`, () => this.scene.add({ name: unique, kind: 'empty' }));
    this.selectObject(o.id);
    return o;
  }

  /**
   * Add a camera. With no pose it stands 8 m out, 2 m up, looking at the origin;
   * the viewport passes its own view instead ("add a camera where I am looking").
   * The first camera becomes the scene's camera.
   */
  addCamera(pose?: { position: Vec3; rotation: Vec3 }, name = 'Camera'): SceneObject {
    if (this.mode === 'edit') this.exitEdit();
    const unique = this.scene.uniqueName(name);
    const position = pose?.position ?? [0, 2, 8];
    const rotation = pose?.rotation ?? lookAtRotation(position, [0, 0.5, 0]);
    const o = this.run('Add camera', `scene.add.camera(${lit({ name: unique, position, rotation })})`, () => {
      const c = this.scene.add({ name: unique, kind: 'camera', camera: { ...DEFAULT_CAMERA }, position, rotation });
      if (!this.scene.activeCamera) this.scene.activeCamera = c.id;
      return c;
    });
    this.selectObject(o.id);
    return o;
  }

  /** Make a camera the one stills are rendered from. */
  setActiveCamera(id: string): boolean {
    const o = this.scene.get(id);
    if (o?.kind !== 'camera') { this.say('Select a camera first'); return false; }
    this.run('Set scene camera', `scene.camera = ${ref(o)}`, () => { this.scene.activeCamera = o.id; });
    return true;
  }

  /** Move the scene's camera to a view (Blender's Ctrl+Alt+Numpad 0). */
  alignCamera(position: Vec3, rotation: Vec3): boolean {
    const o = this.scene.activeCamera ? this.scene.get(this.scene.activeCamera) : undefined;
    if (!o) { this.say('There is no scene camera: Add › Camera first'); return false; }
    const r: Vec3 = rotation.map((x) => +x.toFixed(6)) as Vec3, p: Vec3 = position.map((x) => +x.toFixed(6)) as Vec3;
    this.run('Align camera to view', `${ref(o)}.position = ${lit(p)}\n${ref(o)}.rotation = ${lit(r)}`, () => { o.position = p; o.rotation = r; });
    return true;
  }

  /** A camera's field of view, in degrees. */
  setCameraFov(id: string, fov: number): void {
    const o = this.scene.get(id);
    if (!o?.camera || !(fov > 1 && fov < 179)) return;
    this.run('Camera setting', `${ref(o)}.fov = ${lit(fov)}`, () => { o.camera = { ...o.camera!, fov }; });
  }

  /** A camera's near or far plane: nothing nearer than near or further than far is drawn; near must stay above 0 and below far. */
  setCameraClip(id: string, which: 'near' | 'far', value: number): void {
    const o = this.scene.get(id);
    if (!o?.camera || !(value > 0)) return;
    const next = { ...o.camera, [which]: value };
    if (!(next.near < next.far)) { this.say('The near plane must be closer than the far plane'); return; }
    this.run('Camera setting', `${ref(o)}.${which} = ${lit(value)}`, () => { o.camera = next; });
  }

  deleteObjects(ids = [...this.selected]): void {
    if (this.mode === 'edit' || !ids.length) return;
    const objs = ids.map((id) => this.scene.get(id)).filter(Boolean) as SceneObject[];
    this.run(`Delete ${objs.map((o) => o.name).join(', ')}`, objs.map((o) => `${ref(o)}.delete()`).join('\n'), () => objs.forEach((o) => this.scene.remove(o.id)));
    this.selected.clear(); this.active = null;
    this.emit('select');
  }

  duplicate(ids = [...this.selected]): void {
    if (this.mode === 'edit' || !ids.length) return;
    const objs = ids.map((id) => this.scene.get(id)).filter(Boolean) as SceneObject[];
    const made: SceneObject[] = [];
    this.run('Duplicate', objs.map((o) => `${ref(o)}.duplicate()`).join('\n'), () => {
      for (const o of objs) made.push(this.duplicateOne(o));
    });
    this.selected = new Set(made.map((o) => o.id)); this.active = made.at(-1)?.id ?? null;
    this.emit('select');
  }

  duplicateOne(o: SceneObject): SceneObject {
    return this.scene.add({
      ...o, name: o.name, mesh: o.mesh?.clone() ?? null, material: { ...o.material },
      modifiers: o.modifiers.map((m) => ({ ...m })), light: o.light ? { ...o.light } : undefined,
    });
  }

  setTransform(id: string, field: 'position' | 'rotation' | 'scale', axis: 0 | 1 | 2, value: number): void {
    const o = this.scene.get(id);
    if (!o || !Number.isFinite(value)) return;
    const ax = 'xyz'[axis];
    this.run(`Set ${field}.${ax}`, `${ref(o)}.${field}.${ax} = ${lit(value)}`, () => { o[field][axis] = value; });
  }

  /** Commit a finished gizmo drag of whole objects (their transforms already changed live). */
  endObjectDrag(ids: string[], kind: 'move' | 'rotate' | 'scale'): void {
    const field = kind === 'move' ? 'position' : kind === 'rotate' ? 'rotation' : 'scale';
    const lines = ids.map((id) => this.scene.get(id)).filter(Boolean).map((o) => `${ref(o!)}.${field}.set(${o![field].map(lit).join(', ')})`);
    this.endLive(`${kind[0].toUpperCase()}${kind.slice(1)}`, lines.join('\n'));
  }

  rename(id: string, name: string): void {
    const o = this.scene.get(id);
    if (!o || !name.trim() || name === o.name) return;
    const unique = this.scene.uniqueName(name.trim(), id);
    this.run('Rename', `${ref(o)}.name = ${JSON.stringify(unique)}`, () => { o.name = unique; });
  }

  setParent(id: string, parentId: string | null): boolean {
    const o = this.scene.get(id), p = parentId ? this.scene.get(parentId) : null;
    if (!o || (parentId && !p) || o.parent === parentId) return false;
    if (parentId && (parentId === id || this.scene.isAncestor(id, parentId))) { this.say(`Cannot parent ${o.name} to its own descendant`); return false; }
    this.run(p ? `Parent ${o.name} to ${p.name}` : `Clear parent of ${o.name}`, `${ref(o)}.parent = ${p ? ref(p) : 'null'}`, () => this.scene.setParent(id, parentId, true));
    return true;
  }

  setMaterial(id: string, patch: Partial<SceneObject['material']>): void {
    const o = this.scene.get(id);
    if (!o) return;
    this.run('Material', Object.entries(patch).map(([k, v]) => `${ref(o)}.material.${k} = ${lit(v)}`).join('\n'), () => Object.assign(o.material, patch));
  }

  /** Auto smooth: smooth shading that keeps edges sharper than `degrees` hard (null: smooth everywhere). */
  setAutoSmooth(id: string, degrees: number | null): void {
    const o = this.scene.get(id);
    if (!o?.mesh || (degrees !== null && !(degrees >= 0 && degrees <= 180))) return;
    this.run(degrees === null ? 'Shade smooth' : `Shade auto smooth ${degrees}°`, `${ref(o)}.autoSmooth = ${degrees === null ? 'null' : lit(degrees)}`, () => { o.autoSmooth = degrees; o.smooth = true; });
  }

  /** Trace how the one selected vertex's smooth normal is built (Mesh › Trace the vertex normal). */
  traceNormalOf(weight: 'area' | 'angle' = 'area'): boolean {
    const o = this.editObject;
    const verts = this.mode === 'edit' ? this.selectedVerts() : [];
    if (!o?.mesh || verts.length !== 1) { this.say('Trace the vertex normal: Tab into edit mode and select one vertex'); return false; }
    const trace = new Trace('Trace the vertex normal');
    if (o.mesh.verts.length <= trace.snapshotLimit) trace.before = o.mesh.toSnapshot();
    const t = traceVertexNormal(o.mesh, verts[0], { weight, sharp: o.autoSmooth ?? null }, trace);
    this.trace = trace; this.traceTarget = o.id; this.emit('trace');
    this.message = `Vertex ${verts[0]}: ${t.faces.length} faces, normal (${t.normal.map((x) => +x.toFixed(3)).join(', ')})${t.groups > 1 ? `, ${t.groups} normals with auto smooth` : ''}`;
    this.emit('select');
    return true;
  }

  /** Trace subdividing the active object's UVs (its subdivision modifier's levels, or 2), and the distortion saved. */
  traceUVSubdivisionOf(): boolean {
    const o = this.activeObject;
    if (!o?.mesh || !o.uv || !uvFits(o.mesh, o.uv)) { this.say('Trace subdividing the UVs: select an object with UVs (UV › Unwrap first)'); return false; }
    const mod = o.modifiers.find((m) => m.type === 'subsurf' && m.enabled);
    const levels = mod && mod.type === 'subsurf' ? Math.max(1, Math.min(3, Math.round(mod.levels))) : 2;
    const trace = new Trace('Trace subdividing the UVs');
    if (o.mesh.verts.length <= trace.snapshotLimit) trace.before = o.mesh.toSnapshot();
    const r = traceUVSubdivision(o.mesh, o.uv, levels, trace);
    this.trace = trace; this.traceTarget = o.id; this.emit('trace');
    this.message = `UVs subdivided ${levels}×: distortion ${r.linear.mean.toFixed(2)} linear, ${r.smooth.mean.toFixed(2)} smooth`;
    this.emit('select');
    return true;
  }

  /** The inputs of shade() at one vertex of an object, in world space: the vertex, its normal, the sun, the eye. */
  shadingInputs(o: SceneObject, v: number, eyeAt?: Vec3) {
    const m = o.mesh!, W = this.scene.worldMatrix(o);
    const P = new Vector3(...m.verts[v]).applyMatrix4(W);
    // Smooth objects use the vertex normal; flat ones the normal of the first face at the vertex (what the shader sees there).
    const f = m.faces.findIndex((face) => face.includes(v));
    const n0 = o.smooth || f < 0 ? m.vertexNormal(v) : m.faceNormal(f);
    const N = new Vector3(...n0).applyMatrix3(new Matrix3().setFromMatrix4(W)).normalize();
    const sun = this.scene.objects.find((x) => x.kind === 'light');
    const sp = sun ? new Vector3().setFromMatrixPosition(this.scene.worldMatrix(sun)) : new Vector3(0, 1, 0);
    const L = sp.lengthSq() > 0 ? sp.normalize() : new Vector3(0, 1, 0);
    const light = hexToLinear(sun?.light?.color ?? '#ffffff').map((x) => x * (sun?.light?.intensity ?? 2.5) * 0.4) as [number, number, number];
    const cam = this.scene.objects.find((x) => x.kind === 'camera');
    const eye: Vec3 = eyeAt ?? this.viewEye ?? (cam ? new Vector3().setFromMatrixPosition(this.scene.worldMatrix(cam)).toArray() as Vec3 : [4, 3, 5]);
    const mat = o.material, corner = f >= 0 ? m.faces[f].indexOf(v) : -1;
    const uv = o.uv && uvFits(m, o.uv) && f >= 0 ? o.uv.faces[f][corner].map((x) => x * (mat.textureScale ?? 1)) as [number, number] : null;
    return {
      model: mat.shader ?? 'pbr', P: P.toArray() as Vec3, N: N.toArray() as Vec3, eye, L: L.toArray() as Vec3, light, base: hexToLinear(mat.color),
      uv, shininess: mat.shininess ?? 40, specular: 0.9 * (1 - mat.roughness), bands: 3, roughness: mat.roughness, metalness: mat.metalness,
    };
  }

  /** Trace how the active object's keys give its value at the current frame (the first channel with keys, or the one given). */
  traceSampleOf(channel?: Channel): boolean {
    const o = this.activeObject;
    const ch = channel ?? CHANNELS.find((c) => (o?.anim?.[c]?.length ?? 0) > 0);
    if (!o?.anim || !ch || !o.anim[ch]?.length) { this.say('Trace sampling the keys: select an object with keyframes (I inserts one)'); return false; }
    const trace = new Trace('Trace sampling the keys');
    const r = traceSample(o.anim, ch, this.frame, trace);
    this.trace = trace; this.traceTarget = o.id; this.emit('trace');
    this.message = `${ch} at frame ${this.frame}: (${r.value.map((x) => fmt(x, 3)).join(', ')})`;
    this.emit('select');
    return true;
  }

  /** Trace baking the active object's world motion into keys every few frames (read-only: nothing is changed). */
  traceBakeOf(every = 3): boolean {
    const o = this.activeObject;
    if (!o) { this.say('Trace baking world motion: select an object'); return false; }
    const trace = new Trace('Trace baking world motion');
    const r = traceBake(this.scene, o, every, trace);
    this.trace = trace; this.traceTarget = o.id; this.emit('trace');
    this.message = `${r.keys.length} keys every ${every} frames; worst gap ${fmt(r.maxError, 4)} at frame ${r.worstFrame}`;
    this.emit('select');
    return true;
  }

  /** Trace foot sliding for the active bone's tail (default Shin.L) on the active armature, over a cycle of `cycle` frames. */
  traceFootSlideOf(cycle = 24): boolean {
    const o = this.activeObject;
    if (!o?.bones?.length) { this.say('Trace foot sliding: select an armature (a rig with bones)'); return false; }
    const bone = this.activeBone && o.bones.some((b) => b.name === this.activeBone) ? this.activeBone : o.bones.some((b) => b.name === 'Shin.L') ? 'Shin.L' : o.bones[0].name;
    const trace = new Trace('Trace foot sliding');
    const r = traceFootSlide(this.scene, o, bone, cycle, 0.05, trace);
    this.trace = trace; this.traceTarget = o.id; this.emit('trace');
    this.message = `${bone}: worst slide ${fmt(r.maxSlide, 4)} while planted; loop error ${fmt(r.loopError, 4)}`;
    this.emit('select');
    return true;
  }

  /** The active armature and its active bone (or its first), for the bone traces. */
  private tracedBone(what: string): { o: SceneObject; bone: Bone } | undefined {
    const o = this.activeObject;
    if (!o?.bones?.length) { this.say(`${what}: select an armature (Add › Armature)`); return undefined; }
    return { o, bone: o.bones.find((b) => b.name === this.activeBone) ?? o.bones[0] };
  }

  /** Trace building the active bone's rest matrix from its head, tail and roll. */
  traceRestMatrixOf(): boolean {
    const t = this.tracedBone('Trace the rest matrix');
    if (!t) return false;
    const trace = new Trace('Trace the rest matrix');
    const r = traceRestMatrix(t.bone, trace);
    this.trace = trace; this.traceTarget = t.o.id; this.emit('trace');
    this.message = `${t.bone.name}: length ${fmt(r.length, 4)}, turned ${fmt((r.turn * 180) / Math.PI, 2)}° from +y`;
    this.emit('select');
    return true;
  }

  /** Trace posing the active bone: its chain from the root, then its skin matrix. */
  tracePoseOf(): boolean {
    const t = this.tracedBone('Trace posing the bone');
    if (!t) return false;
    const trace = new Trace('Trace posing the bone');
    const r = tracePose(t.o.bones!, t.bone.name, trace);
    this.trace = trace; this.traceTarget = t.o.id; this.emit('trace');
    this.message = `${t.bone.name}: posed tail ${fmtV(r.tail)} (chain ${r.chain.join(' → ')})`;
    this.emit('select');
    return true;
  }

  /** Trace what Export GLB writes for the animation: channels, samplers, times, bytes. */
  traceClipOf(): boolean {
    const trace = new Trace('Trace the glTF clip');
    const r = traceClip(this.modelScene, trace);
    this.trace = trace; this.traceTarget = null; this.emit('trace');
    this.message = r.channels.length ? `glTF clip: ${r.channels.length} channels, ${r.frames} keys each, ${r.bytes} bytes` : 'glTF clip: nothing is keyed';
    this.emit('select');
    return true;
  }

  /** Trace turning the active object's Euler rotation into a quaternion. */
  traceQuaternionOf(): boolean {
    const o = this.activeObject;
    if (!o) { this.say('Trace the quaternion: select an object'); return false; }
    const trace = new Trace('Trace the quaternion');
    const q = traceQuaternion(o.rotation, trace);
    this.trace = trace; this.traceTarget = o.id; this.emit('trace');
    this.message = `q = (${q.map((x) => fmt(x, 3)).join(', ')})`;
    this.emit('select');
    return true;
  }

  /** Trace how the active object's shader is assembled: the frame, where its shade() body lands, main(), and checks. */
  traceShaderOf(): boolean {
    const o = this.activeObject;
    if (!o?.mesh) { this.say('Trace assembling the shader: select a mesh'); return false; }
    const model = o.material.shader ?? 'pbr';
    if (model === 'pbr') { this.say('PBR is three.js\'s own shader: choose Lambert, Blinn–Phong, Toon, Normals, UV or Custom in the Inspector'); return false; }
    const trace = new Trace('Trace assembling the shader');
    const r = traceShaderAssembly(model, o.material.glsl || undefined, !o.smooth, trace);
    this.trace = trace; this.traceTarget = o.id; this.emit('trace');
    this.message = `shade() is lines ${r.bodyStart}–${r.bodyEnd} of ${r.lines}; ${r.lint.length ? `${r.lint.length} problem${r.lint.length === 1 ? '' : 's'} found` : 'no problems found'}`;
    this.emit('select');
    return true;
  }

  /** Trace the texture formula at the centre of the one selected face (its UV, the repeat, the formula, the colour). */
  traceTextureOf(): boolean {
    const o = this.editObject;
    const faces = this.mode === 'edit' ? this.selectedFaces() : [];
    if (!o?.mesh || faces.length !== 1) { this.say('Trace the texture formula: Tab into edit mode and select one face (3 for face select)'); return false; }
    if (!uvFits(o.mesh, o.uv)) { this.say(`${o.name} has no UVs that fit its mesh: UV › Unwrap first`); return false; }
    const tex = o.material.texture;
    if (!tex || tex === 'none') { this.say(`${o.name} has no texture: choose one in the Inspector`); return false; }
    const f = o.uv!.faces[faces[0]], uv: [number, number] = [f.reduce((s, p) => s + p[0], 0) / f.length, f.reduce((s, p) => s + p[1], 0) / f.length];
    const trace = new Trace('Trace the texture formula');
    const r = traceTexture(tex, uv, o.material.textureScale ?? 1, trace);
    this.trace = trace; this.traceTarget = o.id; this.emit('trace');
    this.message = `${tex} at (${fmt(r.u, 3)}, ${fmt(r.v, 3)}): (${r.color.join(', ')})`;
    this.emit('select');
    return true;
  }

  /** Trace the shading at the one selected vertex, with the object's shader model. */
  traceShadingOf(): boolean {
    const o = this.editObject;
    const verts = this.mode === 'edit' ? this.selectedVerts() : [];
    if (!o?.mesh || verts.length !== 1) { this.say('Trace the shading: Tab into edit mode and select one vertex (1 for vertex select)'); return false; }
    const trace = new Trace('Trace the shading');
    if (o.mesh.verts.length <= trace.snapshotLimit) trace.before = o.mesh.toSnapshot();
    // The overlay is drawn in the object's own space: map world points back into it.
    const inv = this.scene.worldMatrix(o).clone().invert();
    const r = shadePoint(this.shadingInputs(o, verts[0]), trace, { draw: (p) => new Vector3(...p).applyMatrix4(inv).toArray() as Vec3 });
    this.trace = trace; this.traceTarget = o.id; this.emit('trace');
    this.message = `${o.material.shader ?? 'pbr'} at v${verts[0]}: screen colour (${r.srgb.join(', ')})`;
    this.emit('select');
    return true;
  }

  /** Trace the UV distortion of the one selected face (its first triangle), then of the whole mesh. */
  traceDistortionOf(): boolean {
    const o = this.editObject;
    const faces = this.mode === 'edit' ? this.selectedFaces() : [];
    if (!o?.mesh || faces.length !== 1) { this.say('Trace the distortion: Tab into edit mode and select one face (3 for face select)'); return false; }
    if (!uvFits(o.mesh, o.uv)) { this.say(`${o.name} has no UVs that fit its mesh: UV › Unwrap first`); return false; }
    const trace = new Trace('Trace the distortion');
    if (o.mesh.verts.length <= trace.snapshotLimit) trace.before = o.mesh.toSnapshot();
    const r = traceDistortion(o.mesh, o.uv!, faces[0], trace);
    this.trace = trace; this.traceTarget = o.id; this.emit('trace');
    this.message = `Face ${faces[0]}: σ₁/σ₂ = ${Number.isFinite(r.ratio) ? fmt(r.ratio, 3) : '∞'}, area scale ${fmt(r.area, 4)}; mesh mean ${fmt(r.meanRatio, 3)}`;
    this.emit('select');
    return true;
  }

  /** Trace cutting the active mesh into charts along its seams, and test each chart for being a disc. */
  traceChartsOf(): boolean {
    const o = this.activeObject;
    if (!o?.mesh) { this.say('Trace the charts: select a mesh'); return false; }
    const trace = new Trace('Trace the charts');
    if (o.mesh.verts.length <= trace.snapshotLimit) trace.before = o.mesh.toSnapshot();
    const r = traceCharts(o.mesh, new Set(o.seams ?? []), trace);
    this.trace = trace; this.traceTarget = o.id; this.emit('trace');
    const bad = r.filter((c) => !c.disc).length;
    this.message = `${r.length} chart${r.length === 1 ? '' : 's'}; ${bad ? `${bad} not a disc: cut again` : 'all discs'}`;
    this.emit('select');
    return true;
  }

  /** Trace a texture lookup at the centre of the one selected face: its corners' UVs, wedges, interpolation, texel. */
  traceUVLookupOf(): boolean {
    const o = this.editObject;
    const faces = this.mode === 'edit' ? this.selectedFaces() : [];
    if (!o?.mesh || faces.length !== 1) { this.say('Trace a texture lookup: Tab into edit mode and select one face (3 for face select)'); return false; }
    if (!uvFits(o.mesh, o.uv)) { this.say(`${o.name} has no UVs that fit its mesh: UV › Unwrap first`); return false; }
    const trace = new Trace('Trace a texture lookup');
    if (o.mesh.verts.length <= trace.snapshotLimit) trace.before = o.mesh.toSnapshot();
    const r = traceUVLookup(o.mesh, o.uv!, faces[0], o.material?.textureScale ?? 1, trace);
    this.trace = trace; this.traceTarget = o.id; this.emit('trace');
    this.message = `Face ${faces[0]}: UV (${fmt(r.uv[0], 3)}, ${fmt(r.uv[1], 3)}), texel (${r.texel.join(', ')}); ${r.verts} vertices, ${r.wedges} wedges`;
    this.emit('select');
    return true;
  }

  /** Trace solving one heat step from the selected vertex: the sparse SPD matrix, conjugate gradients, Jacobi. */
  traceSolveOf(): boolean {
    const o = this.editObject;
    const verts = this.mode === 'edit' ? this.selectedVerts() : [];
    if (!o?.mesh || verts.length !== 1) { this.say('Trace the heat solve: Tab into edit mode and select one vertex (the heat source)'); return false; }
    const trace = new Trace('Trace the heat solve');
    if (o.mesh.verts.length <= trace.snapshotLimit) trace.before = o.mesh.toSnapshot();
    const r = traceHeatSolve(o.mesh, verts[0], trace);
    this.trace = trace; this.traceTarget = o.id; this.emit('trace');
    this.message = `${r.n} unknowns, ${r.nonZeros} non-zeros: CG ${r.cgIterations} iterations, Jacobi ${r.jacobiIterations}`;
    this.emit('select');
    return true;
  }

  /** Trace the Laplacian at the one selected vertex: umbrella, cotan weights, area, and the result on positions. */
  traceLaplacianOf(): boolean {
    const o = this.editObject;
    const verts = this.mode === 'edit' ? this.selectedVerts() : [];
    if (!o?.mesh || verts.length !== 1) { this.say('Trace the Laplacian: Tab into edit mode and select one vertex'); return false; }
    const trace = new Trace('Trace the Laplacian');
    if (o.mesh.verts.length <= trace.snapshotLimit) trace.before = o.mesh.toSnapshot();
    const r = traceVertexLaplacian(o.mesh, verts[0], trace);
    if (typeof r === 'string') { this.say(r); return false; }
    this.trace = trace; this.traceTarget = o.id; this.emit('trace');
    this.message = `Vertex ${verts[0]}: ${r.neighbours.length} neighbours, area ${r.area.toFixed(4)}, mean curvature ≈ ${r.H.toFixed(4)}`;
    this.emit('select');
    return true;
  }

  /** Trace the selected vertex's Catmull–Clark limit position, and how fast the ring round it shrinks. */
  traceLimitOf(): boolean {
    const o = this.editObject;
    const verts = this.mode === 'edit' ? this.selectedVerts() : [];
    if (!o?.mesh || verts.length !== 1) { this.say('Trace the limit position: Tab into edit mode and select one vertex'); return false; }
    const trace = new Trace('Trace the limit position');
    if (o.mesh.verts.length <= trace.snapshotLimit) trace.before = o.mesh.toSnapshot();
    const r = limitPosition(o.mesh, verts[0], trace);
    if (typeof r === 'string') { this.say(r); return false; }
    this.trace = trace; this.traceTarget = o.id; this.emit('trace');
    this.message = `Vertex ${verts[0]} (n = ${r.n}): limit (${r.limit.map((x) => +x.toFixed(4)).join(', ')})`;
    this.emit('select');
    return true;
  }

  /** Trace the active object's topology: valence at every vertex, poles, face kinds and the pole budget. */
  traceValenceOf(): boolean {
    const o = this.activeObject;
    if (!o?.mesh) { this.say('Trace clean topology: select an object with a mesh'); return false; }
    const trace = new Trace('Trace clean topology');
    if (o.mesh.verts.length <= trace.snapshotLimit) trace.before = o.mesh.toSnapshot();
    const r = traceValence(o.mesh, trace);
    this.trace = trace; this.traceTarget = o.id; this.emit('trace');
    this.message = `${o.name}: ${r.poles} pole${r.poles === 1 ? '' : 's'}; ${r.quads} quads, ${r.tris} triangles, ${r.ngons} n-gons`;
    this.emit('select');
    return true;
  }

  /** Trace the active object's silhouette (modifiers applied) as seen from the scene camera: facing, then outline edges. */
  traceSilhouetteOf(): boolean {
    const o = this.activeObject, cam = this.scene.activeCamera ? this.scene.get(this.scene.activeCamera) : undefined;
    if (!o?.mesh) { this.say('Trace the silhouette: select an object with a mesh'); return false; }
    if (!cam?.camera) { this.say('Trace the silhouette: add a scene camera first (Add › Camera)'); return false; }
    const shown = evaluatedMesh(this.scene, o);
    const c = this.scene.worldMatrix(cam).elements;
    const local = new Vector3(c[12], c[13], c[14]).applyMatrix4(this.scene.worldMatrix(o).clone().invert());
    const trace = new Trace('Trace the silhouette');
    const r = traceSilhouette(shown, [local.x, local.y, local.z], trace);
    this.trace = trace; this.traceTarget = o.id; this.emit('trace');
    this.message = `${o.name} from ${cam.name}: ${r.front.length} of ${shown.faces.length} faces face the camera, ${r.edges.length} silhouette edges`;
    this.emit('select');
    return true;
  }

  /** Trace the active object's (first enabled) mirror modifier on its cage: reflection, shared vertices, winding. */
  traceMirrorOf(): boolean {
    const o = this.activeObject;
    const mod = o?.modifiers.find((m) => m.type === 'mirror' && m.enabled);
    if (!o?.mesh || !mod || mod.type !== 'mirror') { this.say('Trace the mirror modifier: select an object with a mirror modifier switched on'); return false; }
    const trace = new Trace('Trace the mirror modifier');
    if (o.mesh.verts.length <= trace.snapshotLimit) trace.before = o.mesh.toSnapshot();
    const out = mirror(o.mesh, mod.axis, mod.merge, trace);
    this.trace = trace; this.traceTarget = o.id; this.emit('trace');
    this.message = `Mirror in ${mod.axis} = 0: cage ${o.mesh.verts.length} vertices, ${o.mesh.faces.length} faces → ${out.verts.length} vertices, ${out.faces.length} faces`;
    this.emit('select');
    return true;
  }

  /** Trace how the one selected face is cut into triangles for drawing: a fan if convex, ear clipping if not. */
  traceTriangulateOf(): boolean {
    const o = this.editObject;
    const faces = this.mode === 'edit' ? this.selectedFaces() : [];
    if (!o?.mesh || faces.length !== 1) { this.say('Trace drawing a face: Tab into edit mode and select one face'); return false; }
    const trace = new Trace('Trace drawing the face');
    if (o.mesh.verts.length <= trace.snapshotLimit) trace.before = o.mesh.toSnapshot();
    const f = o.mesh.faces[faces[0]];
    const tris = faceTriangles(o.mesh.verts, f, trace);
    this.trace = trace; this.traceTarget = o.id; this.emit('trace');
    this.message = `Face ${faces[0]}: ${f.length} corners, ${tris.length} triangles`;
    this.emit('select');
    return true;
  }

  setSmooth(id: string, smooth: boolean): void {
    const o = this.scene.get(id);
    if (!o) return;
    // Shade smooth after auto smooth smooths everywhere again, as in Blender.
    if (smooth && o.autoSmooth != null) { this.run('Shade smooth', `${ref(o)}.autoSmooth = null`, () => { o.smooth = true; o.autoSmooth = null; }); return; }
    this.run(smooth ? 'Shade smooth' : 'Shade flat', `${ref(o)}.smooth = ${smooth}`, () => { o.smooth = smooth; });
  }

  setVisible(id: string, visible: boolean): void {
    const o = this.scene.get(id);
    if (!o) return;
    this.run(visible ? 'Show' : 'Hide', `${ref(o)}.visible = ${visible}`, () => { o.visible = visible; });
  }

  addModifier(id: string, type: Modifier['type']): void {
    const o = this.scene.get(id);
    if (!o?.mesh) return;
    const m = defaultModifier(type);
    const { type: _t, enabled: _e, ...opts } = m as Modifier & Record<string, unknown>;
    this.run(`Add ${type} modifier`, `${ref(o)}.modifiers.add(${JSON.stringify(type)}, ${lit(opts)})`, () => { o.modifiers.push(m); if (type === 'subsurf') o.smooth = true; });
  }

  updateModifier(id: string, index: number, patch: Partial<Modifier>): void {
    const o = this.scene.get(id);
    if (!o?.modifiers[index]) return;
    this.run('Modifier setting', `${ref(o)}.modifiers.set(${index}, ${lit(patch)})`, () => { Object.assign(o.modifiers[index], patch); });
  }

  removeModifier(id: string, index: number): void {
    const o = this.scene.get(id);
    if (!o?.modifiers[index]) return;
    this.run('Remove modifier', `${ref(o)}.modifiers.remove(${index})`, () => { o.modifiers.splice(index, 1); });
  }

  applyModifiers(id: string): void {
    const o = this.scene.get(id);
    if (!o?.mesh || !o.modifiers.length) return;
    this.run('Apply modifiers', `${ref(o)}.modifiers.apply()`, () => { o.mesh = evaluate(o.mesh!, o.modifiers); o.modifiers = []; });
    this.clearElements();
  }

  // ── edit mode ──────────────────────────────────────────────────────────

  enterEdit(): boolean {
    this.endPreview();
    const o = this.activeObject;
    if (!o?.mesh) { this.say('Select a mesh object to edit'); return false; }
    this.mode = 'edit';
    this.selected = new Set([o.id]);
    this.clearElements(false);
    this.emit('mode');
    return true;
  }

  exitEdit(): void {
    if (this.mode !== 'edit') return;
    this.mode = 'object';
    this.clearElements(false);
    this.emit('mode');
  }

  /** Tab: edit mode for a mesh, pose mode for an armature. */
  /** Tab, as in Blender: edit mode for a mesh, bone edit mode for an armature (Ctrl+Tab poses it). */
  toggleEdit(): void {
    if (this.mode === 'weight') this.exitWeightPaint();
    else if (this.mode === 'edit') this.exitEdit();
    else if (this.mode === 'bones') this.exitBoneEdit();
    else if (this.mode === 'pose') this.exitPose();
    else if (this.activeObject?.bones) this.enterBoneEdit();
    else this.enterEdit();
  }

  // ── bone edit mode ────────────────────────────────────────────────────

  /** In bone edit mode: the selected joint (a bone's head or tail) or the whole bone. */
  boneSel: JointSel | null = null;
  private jointStart: Bone[] | null = null;

  /** Edit the armature's rest bones: click a joint, drag it; E extrudes a new bone from a tail. */
  enterBoneEdit(): boolean {
    this.endPreview();
    const o = this.activeObject;
    if (!o?.bones) { this.say('Select an armature to edit its bones'); return false; }
    this.mode = 'bones';
    this.scene.restPose = o.id;
    this.selected = new Set([o.id]);
    if (!o.bones.some((b) => b.name === this.activeBone)) this.activeBone = o.bones[0]?.name ?? null;
    this.boneSel = this.activeBone ? { bone: this.activeBone, part: 'tail' } : null;
    this.message = 'Edit bones: click a joint and drag it (G); E extrudes a new bone from the selected tail';
    this.emit('mode');
    return true;
  }

  exitBoneEdit(): void {
    if (this.mode !== 'bones') return;
    this.mode = 'object';
    this.scene.restPose = null;
    this.boneSel = null;
    this.emit('mode');
  }

  selectJoint(sel: JointSel | null): void {
    this.boneSel = sel;
    if (sel) this.activeBone = sel.bone;
    this.emit('select');
  }

  /** Called when a joint drag starts (the gizmo has already begun the live change). */
  beginJointDrag(): void { const o = this.activeObject; this.jointStart = o?.bones ? cloneBones(o.bones) : null; }

  /** Move the selected joint by d (armature space) from where the drag began. */
  jointDrag(d: Vec3): void {
    const o = this.activeObject;
    if (!o?.bones || !this.jointStart || !this.boneSel) return;
    moveJoint(o.bones, this.jointStart, this.boneSel, d);
    this.liveUpdate();
  }

  endJointDrag(): void {
    const o = this.activeObject, start = this.jointStart;
    this.jointStart = null;
    if (!o?.bones || !start) { this.endLive('Move bone', null); return; }
    const changed = o.bones.filter((b) => { const s = start.find((x) => x.name === b.name)!; return b.head.some((v, i) => v !== s.head[i]) || b.tail.some((v, i) => v !== s.tail[i]); });
    this.endLive(changed.length === 1 ? 'Move bone' : 'Move joint', changed.map((b) => `${ref(o)}.bone(${lit(b.name)}).set(${lit({ head: b.head, tail: b.tail })})`).join('\n') || null);
  }

  /** E in bone edit mode: a new bone from the selected bone's tail, with its tail selected to drag. */
  extrudeBone(): boolean {
    if (!this.addBone(this.activeBone)) return false;
    this.boneSel = { bone: this.activeBone!, part: 'tail' };
    this.emit('select');
    return true;
  }

  get poseObject(): SceneObject | undefined { return this.mode === 'pose' ? this.activeObject : undefined; }

  enterPose(): boolean {
    this.endPreview();
    const o = this.activeObject;
    if (!o?.bones) { this.say('Select an armature to pose'); return false; }
    this.mode = 'pose';
    this.selected = new Set([o.id]);
    if (!o.bones.some((b) => b.name === this.activeBone)) this.activeBone = o.bones[0]?.name ?? null;
    this.message = 'Pose mode: click a bone, rotate it (R); I keys the pose';
    this.emit('mode');
    return true;
  }

  exitPose(): void {
    if (this.mode !== 'pose') return;
    this.mode = 'object';
    this.emit('mode');
  }

  selectBone(name: string | null): void {
    this.activeBone = name;
    if (this.mode === 'weight' && name) this.showWeightsQuietly(name);
    this.emit('select');
  }

  // ── weight paint mode ─────────────────────────────────────────────────

  /** Brush settings (not part of the scene). */
  paint: PaintSettings = { ...DEFAULT_PAINT };
  private stroke: { o: SceneObject; bone: string; points: Vec3[]; positions: Vec3[]; neighbours: number[][] } | null = null;

  private showWeightsQuietly(bone: string): void {
    const s = this.scripting; this.scripting = true;
    this.showField({ kind: 'weight', bone });
    this.scripting = s;
  }

  /** Weight paint mode (Blender: Ctrl+Tab on a skinned mesh): the active bone's weights as a heat map, and a brush. */
  enterWeightPaint(): boolean {
    this.endPreview();
    const o = this.activeObject;
    if (!o?.skin) { this.say('Weight paint: select a mesh bound to an armature (Object › Bind to armature)'); return false; }
    if (skinState(this.scene, o) !== 'ok') { this.say('Weight paint: the mesh changed since it was bound; bind again first'); return false; }
    this.mode = 'weight';
    this.selected = new Set([o.id]);
    if (!o.skin.bones.includes(this.activeBone ?? '')) this.activeBone = o.skin.bones[0];
    this.showWeightsQuietly(this.activeBone!);
    this.message = `Weight paint · ${this.activeBone}: drag over the mesh to paint`;
    this.emit('mode');
    return true;
  }

  exitWeightPaint(): void {
    if (this.mode !== 'weight') return;
    this.mode = 'object';
    this.field = null;
    this.emit('mode');
  }

  /** Start a brush stroke: one undo step, however many dabs. */
  beginStroke(): boolean {
    const o = this.activeObject;
    if (this.mode !== 'weight' || !o?.skin || !this.activeBone) return false;
    this.beginLive();
    const src = skinSource(o);
    this.stroke = { o, bone: this.activeBone, points: [], positions: skinnedSource(this.scene, o).verts, neighbours: neighbourLists(src.verts.length, src.faces) };
    return true;
  }

  /** One dab at a point in the mesh's own coordinates (on the surface as drawn). */
  strokeDab(p: Vec3): void {
    const st = this.stroke;
    if (!st) return;
    dab(st.o.skin!, st.bone, st.positions, st.neighbours, p, this.paint);
    st.points.push([+p[0].toFixed(4), +p[1].toFixed(4), +p[2].toFixed(4)]);
    this.liveUpdate();
  }

  endStroke(): void {
    const st = this.stroke;
    this.stroke = null;
    if (!st) return;
    if (!st.points.length) { this.endLive('Paint weights', null); return; }
    const { brush, radius, strength, value, normalize, mirror } = this.paint;
    this.endLive(`Paint ${st.bone}`, `${ref(st.o)}.paintWeights(${lit(st.bone)}, ${lit({ brush, radius, strength, value, normalize, mirror, points: st.points })})`);
  }

  /**
   * Alt+click: select the loop through an edge. Vertex and edge modes take the edge
   * loop; face mode takes the ring of faces the edge crosses. Shift adds to the selection.
   */
  selectLoop(a: number, b: number, additive = false): boolean {
    const m = this.editObject?.mesh;
    if (!m) return false;
    if (!additive) this.clearElements(false);
    if (this.selectMode === 'face') {
      const ring = m.edgeRing(a, b);
      ring.faces.forEach((f) => this.sel.faces.add(f));
      this.say(`Face loop: ${ring.faces.length} faces${ring.closed ? ', all the way round' : ''}`);
    } else {
      // With Record traces on, the walk is traced vertex by vertex.
      const trace = this.traceEnabled ? new Trace('Edge loop') : undefined;
      if (trace && m.verts.length <= trace.snapshotLimit) trace.before = m.toSnapshot();
      const loop = m.edgeLoop(a, b, trace);
      if (trace) { this.trace = trace; this.traceTarget = this.editObject!.id; this.emit('trace'); }
      for (const [x, y] of loop.edges) {
        if (this.selectMode === 'edge') this.sel.edges.add(EditMesh.edgeKey(x, y));
        else { this.sel.verts.add(x); this.sel.verts.add(y); }
      }
      this.say(`Edge loop: ${loop.edges.length} edges${loop.closed ? ', all the way round' : ''}`);
    }
    this.emit('select');
    return true;
  }

  setSelectMode(m: SelectMode): void {
    const mesh = this.editObject?.mesh;
    if (mesh) {
      // Carry the selection across, the way Blender does: going up (verts → faces)
      // keeps only elements whose corners were all selected.
      const verts = new Set(this.selectedVerts());
      this.sel.verts = verts;
      this.sel.edges = new Set([...mesh.edges().values()].filter((e) => verts.has(e.a) && verts.has(e.b)).map((e) => EditMesh.edgeKey(e.a, e.b)));
      this.sel.faces = new Set(mesh.faces.map((f, i) => [f, i] as const).filter(([f]) => f.every((v) => verts.has(v))).map(([, i]) => i));
    }
    this.selectMode = m;
    this.emit('select');
  }

  clearElements(emit = true): void {
    this.sel = { verts: new Set(), edges: new Set(), faces: new Set() };
    if (emit) this.emit('select');
  }

  /** Select one element (index for verts/faces, "a-b" key for edges). */
  selectElement(key: number | string | null, additive = false): void {
    if (!additive) this.clearElements(false);
    if (key !== null) {
      const set = (this.selectMode === 'vert' ? this.sel.verts : this.selectMode === 'edge' ? this.sel.edges : this.sel.faces) as Set<number | string>;
      if (additive && set.has(key)) set.delete(key); else set.add(key);
    }
    this.emit('select');
  }

  setElements(keys: (number | string)[], additive = false): void {
    if (!additive) this.clearElements(false);
    const set = (this.selectMode === 'vert' ? this.sel.verts : this.selectMode === 'edge' ? this.sel.edges : this.sel.faces) as Set<number | string>;
    keys.forEach((k) => set.add(k));
    this.emit('select');
  }

  selectAllElements(on = true): void {
    const mesh = this.editObject?.mesh;
    if (!mesh) return;
    this.clearElements(false);
    if (on) {
      if (this.selectMode === 'vert') mesh.verts.forEach((_, i) => this.sel.verts.add(i));
      else if (this.selectMode === 'edge') for (const k of mesh.edges().keys()) this.sel.edges.add(k);
      else mesh.faces.forEach((_, i) => this.sel.faces.add(i));
    }
    this.emit('select');
  }

  /**
   * Select the edges that are not on exactly two faces (edit mode, edge select): the open ones, on one face,
   * and the non-manifold ones, on three or more. Traced: building the edge table that finds them.
   */
  selectNonManifold(): boolean {
    const o = this.activeObject;
    if (!o?.mesh) { this.say('Select a mesh object first'); return false; }
    if (this.mode !== 'edit' && !this.enterEdit()) return false;
    const trace = this.traceEnabled ? new Trace('Edge table') : undefined;
    if (trace && o.mesh.verts.length <= trace.snapshotLimit) trace.before = o.mesh.toSnapshot();
    const r = o.mesh.edgeTable(trace);
    if (trace && trace.steps.length) { this.trace = trace; this.traceTarget = o.id; this.emit('trace'); }
    this.selectMode = 'edge';
    this.clearElements(false);
    for (const [a, b] of [...r.open, ...r.nonManifold]) this.sel.edges.add(EditMesh.edgeKey(a, b));
    const n = (k: number, one: string, many: string) => `${k} ${k === 1 ? one : many}`;
    this.message = r.open.length + r.nonManifold.length
      ? `${n(r.open.length, 'open edge', 'open edges')}, ${n(r.nonManifold.length, 'edge', 'edges')} on three or more faces`
      : `Every one of the ${r.edges} edges is on exactly two faces: the surface is closed`;
    this.emit('select');
    return true;
  }

  /** Trace how the active object's matrix M = T·R·S moves its vertices (Object › Trace the transform). */
  traceTransformOf(): boolean {
    const o = this.activeObject;
    if (!o?.mesh) { this.say('Trace the transform: select a mesh object first'); return false; }
    const trace = new Trace('Trace the transform');
    if (o.mesh.verts.length <= trace.snapshotLimit) trace.before = o.mesh.toSnapshot();
    traceTransform(o, trace);
    this.trace = trace; this.traceTarget = o.id; this.emit('trace');
    this.message = `${o.name}: M = T·R·S, traced in the Algorithm trace`;
    this.emit('select');
    return true;
  }

  /** Decompose the active object's world matrix, traced (Object › Decompose the matrix). */
  decomposeOf(): boolean {
    const o = this.activeObject;
    if (!o) { this.say('Decompose the matrix: select an object first'); return false; }
    const trace = new Trace('Decompose the matrix');
    if (o.mesh && o.mesh.verts.length <= trace.snapshotLimit) trace.before = o.mesh.toSnapshot();
    const d = traceDecompose(this.scene.worldMatrix(o).elements, trace);
    this.trace = trace; this.traceTarget = o.id; this.emit('trace');
    this.message = `${o.name}: position (${d.position.map((x) => +x.toFixed(3)).join(', ')}), scale (${d.scale.map((x) => +x.toFixed(3)).join(', ')})${d.shearDeg > 1e-6 ? `, shear ${d.shearDeg.toFixed(2)}°` : ''}`;
    this.emit('select');
    return true;
  }

  /** Work out the active object's world determinant, traced (Object › Determinant of the matrix). */
  determinantOf(): boolean {
    const o = this.activeObject;
    if (!o) { this.say('Determinant: select an object first'); return false; }
    const trace = new Trace('Determinant');
    if (o.mesh && o.mesh.verts.length <= trace.snapshotLimit) trace.before = o.mesh.toSnapshot();
    const d = traceDeterminant(this.scene.worldMatrix(o).elements, o.mesh?.stats().closed ? o.mesh.volume() : null, trace);
    this.trace = trace; this.traceTarget = o.id; this.emit('trace');
    this.message = `${o.name}: det = ${+d.det.toFixed(4)}${d.det < 0 ? ' (mirrored)' : ''}`;
    this.emit('select');
    return true;
  }

  /** Trace how the active object's world matrix is built up its parent chain (Object › Trace the world matrix). */
  traceWorldOf(): boolean {
    const o = this.activeObject;
    if (!o) { this.say('Trace the world matrix: select an object first'); return false; }
    const trace = new Trace('Trace the world matrix');
    if (o.mesh && o.mesh.verts.length <= trace.snapshotLimit) trace.before = o.mesh.toSnapshot();
    const w = traceWorld(this.scene, o, trace);
    this.trace = trace; this.traceTarget = o.id; this.emit('trace');
    this.message = `${o.name}: ${w.chain.join(' → ')}; origin at (${w.origins.at(-1)!.map((x) => +x.toFixed(3)).join(', ')})`;
    this.emit('select');
    return true;
  }

  /** Trace the active object's own axes, read from its world matrix, and where the world origin is in its coordinates (Object › Trace the local axes). */
  traceAxesOf(): boolean {
    const o = this.activeObject;
    if (!o) { this.say('Trace the local axes: select an object first'); return false; }
    const trace = new Trace('Trace the local axes');
    if (o.mesh && o.mesh.verts.length <= trace.snapshotLimit) trace.before = o.mesh.toSnapshot();
    const a = traceAxes(this.scene.worldMatrix(o).elements, [0, 0, 0], trace);
    this.trace = trace; this.traceTarget = o.id; this.emit('trace');
    const f = (v: number[]) => v.map((x) => +x.toFixed(3)).join(', ');
    this.message = `${o.name}: local x (${f(a.axes[0])}), y (${f(a.axes[1])}), z (${f(a.axes[2])})${a.square ? '' : ', not at right angles'}`;
    this.emit('select');
    return true;
  }

  /** Trace the active object's Euler angles into a matrix and back, and say if they are in gimbal lock (Object › Trace the Euler angles). */
  traceEulerOf(): boolean {
    const o = this.activeObject;
    if (!o) { this.say('Trace the Euler angles: select an object first'); return false; }
    const trace = new Trace('Trace the Euler angles');
    if (o.mesh && o.mesh.verts.length <= trace.snapshotLimit) trace.before = o.mesh.toSnapshot();
    const t = traceEuler(o.rotation, trace);
    this.trace = trace; this.traceTarget = o.id; this.emit('trace');
    this.message = `${o.name}: decodes to (${t.decoded.join('°, ')}°)${t.locked ? ', gimbal lock' : ''}`;
    this.emit('select');
    return true;
  }

  /** Trace the active camera's view matrix, and where the world origin (or the first other object) lands in its camera space (Object › Trace the view matrix). */
  traceViewOf(): boolean {
    const o = this.activeObject;
    if (!o || o.kind !== 'camera') { this.say('Trace the view matrix: select a camera first (Add › Camera)'); return false; }
    const target = this.scene.objects.find((x) => x.kind === 'mesh');
    const p = target ? this.scene.worldMatrix(target).elements : null;
    const point: Vec3 = p ? [p[12], p[13], p[14]] : [0, 0, 0];
    const trace = new Trace('Trace the view matrix');
    const v = traceView(this.scene.worldMatrix(o).elements, point, trace);
    this.trace = trace; this.traceTarget = o.id; this.emit('trace');
    this.message = `${o.name}: ${target ? target.name : 'the world origin'} is at (${v.camera.map((x) => +x.toFixed(3)).join(', ')}) in camera space`;
    this.emit('select');
    return true;
  }

  /** Whether the toolbar's Snap is on; MeshLab keeps it in step, for the drag trace. */
  snap = false;

  /** The image size the projection trace assumes; MeshLab keeps it in step with the render size. */
  renderSize = { width: 1280, height: 720 };

  /** Trace how the first mesh's origin reaches the active camera's image (Object › Trace the projection). */
  traceProjectionOf(): boolean {
    const o = this.activeObject;
    if (!o?.camera) { this.say('Trace the projection: select a camera first (Add › Camera)'); return false; }
    const target = this.scene.objects.find((x) => x.kind === 'mesh');
    const p = target ? this.scene.worldMatrix(target).elements : null;
    const point: Vec3 = p ? [p[12], p[13], p[14]] : [0, 0, 0];
    const trace = new Trace('Trace the projection');
    const t = traceProjection(this.scene.worldMatrix(o).elements, o.camera, this.renderSize, point, trace);
    this.trace = trace; this.traceTarget = o.id; this.emit('trace');
    this.message = `${o.name}: ${target ? target.name : 'the world origin'} lands at pixel (${t.pixel.map((x) => Math.round(x)).join(', ')})${t.inside ? '' : ', outside the image'}`;
    this.emit('select');
    return true;
  }

  /** Trace the first two meshes' origins through the active camera's depth buffer (Object › Trace the depth buffer). */
  traceDepthOf(): boolean {
    const o = this.activeObject;
    if (!o?.camera) { this.say('Trace the depth buffer: select a camera first (Add › Camera)'); return false; }
    const meshes = this.scene.objects.filter((x) => x.kind === 'mesh').slice(0, 2);
    if (meshes.length < 2) { this.say('Trace the depth buffer: it compares two meshes, and there is only ' + meshes.length); return false; }
    const at = (m: SceneObject): Vec3 => { const e = this.scene.worldMatrix(m).elements; return [e[12], e[13], e[14]]; };
    const trace = new Trace('Trace the depth buffer');
    const t = traceDepth(this.scene.worldMatrix(o).elements, o.camera, at(meshes[0]), at(meshes[1]), 24, trace);
    this.trace = trace; this.traceTarget = o.id; this.emit('trace');
    this.message = `${o.name}: ${meshes[0].name} and ${meshes[1].name} store ${t.stored.join(' and ')}${t.fight ? ': they fight' : ''}`;
    this.emit('select');
    return true;
  }

  /** Trace how wide the selection outline of the first mesh is on the active camera's image (Object › Trace the outline width). */
  traceOutlineOf(): boolean {
    const o = this.activeObject;
    if (!o?.camera) { this.say('Trace the outline width: select a camera first (Add › Camera)'); return false; }
    const target = this.scene.objects.find((x) => x.kind === 'mesh');
    if (!target) { this.say('Trace the outline width: there is no mesh to outline'); return false; }
    const e = this.scene.worldMatrix(target).elements;
    const trace = new Trace('Trace the outline width');
    const t = traceOutline(this.scene.worldMatrix(o).elements, o.camera, this.renderSize, [e[12], e[13], e[14]], undefined, trace);
    this.trace = trace; this.traceTarget = o.id; this.emit('trace');
    this.message = `${o.name}: ${target.name}'s outline is ${t.pixels.toFixed(2)} pixels wide on a ${this.renderSize.height}-pixel-tall image`;
    this.emit('select');
    return true;
  }

  /** Aim the active camera at the first mesh with look-at, traced (Object › Trace look-at). */
  traceLookAtOf(): boolean {
    const o = this.activeObject;
    if (!o?.camera || o.parent) { this.say('Trace look-at: select a camera with no parent first'); return false; }
    const target = this.scene.objects.find((x) => x.kind === 'mesh');
    if (!target) { this.say('Trace look-at: there is no mesh to look at'); return false; }
    const w = this.scene.worldMatrix(target).elements, at: Vec3 = [w[12], w[13], w[14]];
    const trace = new Trace('Trace look-at');
    let t;
    try { t = traceLookAt(o.position, at, trace); } catch (e) { this.say(e instanceof Error ? e.message : String(e)); return false; }
    const rad = t.rotationDeg.map((a) => (a * Math.PI) / 180) as Vec3;
    this.run('Look at', `${ref(o)}.lookAt(${lit(at)})`, () => { o.rotation = rad; });
    this.trace = trace; this.traceTarget = o.id; this.emit('trace');
    this.message = `${o.name} now looks at ${target.name}: rotation (${t.rotationDeg.map((a) => +a.toFixed(1)).join('°, ')}°)`;
    this.emit('select');
    return true;
  }

  /** Every visible mesh in world coordinates, for picking. */
  pickables(): Pickable[] {
    return this.scene.objects.filter((o) => o.kind === 'mesh' && o.mesh && o.visible).map((o) => {
      const w = this.scene.worldMatrix(o).elements;
      return { name: o.name, faces: o.mesh!.faces, verts: o.mesh!.verts.map(([x, y, z]) => [w[0] * x + w[4] * y + w[8] * z + w[12], w[1] * x + w[5] * y + w[9] * z + w[13], w[2] * x + w[6] * y + w[10] * z + w[14]] as Vec3) };
    });
  }

  /** Trace the pick ray through a pixel of the active camera's image (default: the centre), and select what it hits (Object › Trace picking). */
  tracePickOf(px?: number, py?: number): boolean {
    const o = this.activeObject;
    if (!o?.camera) { this.say('Trace picking: select a camera first (Add › Camera)'); return false; }
    const { width, height } = this.renderSize;
    const ray = rayFromPixel(this.scene.worldMatrix(o).elements, o.camera, this.renderSize, px ?? width / 2 - 0.5, py ?? height / 2 - 0.5);
    const trace = new Trace('Trace picking');
    const hit = tracePick(ray, this.pickables(), trace);
    this.trace = trace; this.traceTarget = o.id; this.emit('trace');
    this.message = hit ? `${o.name}: the ray hits ${hit.name}, face ${hit.face}, ${hit.t.toFixed(3)} away` : `${o.name}: the ray hits nothing`;
    this.emit('select');
    return true;
  }

  /** The edit mesh's vertices on the scene camera's image (null behind it), for screen-space picking. */
  screenPointsOf(o: SceneObject, cam: SceneObject): (ScreenPoint | null)[] {
    const w = this.scene.worldMatrix(o).elements, cw = this.scene.worldMatrix(cam).elements;
    return o.mesh!.verts.map(([x, y, z]) => {
      const p: Vec3 = [w[0] * x + w[4] * y + w[8] * z + w[12], w[1] * x + w[5] * y + w[9] * z + w[13], w[2] * x + w[6] * y + w[10] * z + w[14]];
      const t = traceProjection(cw, cam.camera!, this.renderSize, p);
      return t.clip[3] > 0 ? { x: t.pixel[0], y: t.pixel[1], z: t.ndc[2] } : null;
    });
  }

  /** Trace picking the vertex or edge nearest a point of the scene camera's image (default: its centre), and select it (Mesh › Trace screen picking). */
  traceScreenPickOf(px?: number, py?: number): boolean {
    const o = this.editObject, cam = this.scene.activeCamera ? this.scene.get(this.scene.activeCamera) : undefined;
    if (this.mode !== 'edit' || !o?.mesh || (this.selectMode !== 'vert' && this.selectMode !== 'edge')) { this.say('Trace screen picking: Tab into edit mode, vertex (1) or edge (2) select'); return false; }
    if (!cam?.camera) { this.say('Trace screen picking: add a scene camera first (Add › Camera)'); return false; }
    const trace = new Trace('Trace screen picking');
    if (o.mesh.verts.length <= trace.snapshotLimit) trace.before = o.mesh.toSnapshot();
    const edges = [...o.mesh.edges().values()].map((e) => [e.a, e.b] as [number, number]);
    const r = traceScreenPick(this.selectMode, this.screenPointsOf(o, cam), edges, px ?? this.renderSize.width / 2, py ?? this.renderSize.height / 2, trace);
    this.trace = trace; this.traceTarget = o.id; this.emit('trace');
    if (this.selectMode === 'vert') this.selectElement(r.index, false); else this.selectElement(r.key, false);
    this.message = r.d === null ? 'Nothing within reach of the pointer' : `Picked ${r.index !== null ? 'vertex ' + r.index : 'edge ' + r.key}, ${r.d.toFixed(1)} px from the pointer`;
    this.emit('select');
    return true;
  }

  /** Trace dragging the active object's X arrow 120 px to the right on the scene camera's image (Object › Trace a gizmo drag). */
  traceDragOf(axis: 0 | 1 | 2 = 0, dx = 120, dy = 0): boolean {
    const o = this.activeObject, cam = this.scene.activeCamera ? this.scene.get(this.scene.activeCamera) : undefined;
    if (!o || o.kind === 'camera') { this.say('Trace a gizmo drag: select an object (not the camera)'); return false; }
    if (!cam?.camera) { this.say('Trace a gizmo drag: add a scene camera first (Add › Camera)'); return false; }
    const w = this.scene.worldMatrix(o).elements, origin: Vec3 = [w[12], w[13], w[14]], cw = this.scene.worldMatrix(cam).elements;
    const at = traceProjection(cw, cam.camera, this.renderSize, origin).pixel;
    const u: Vec3 = [0, 0, 0]; u[axis] = 1;
    const ray = (px: number, py: number) => rayFromPixel(cw, cam.camera!, this.renderSize, px - 0.5, py - 0.5);
    const trace = new Trace('Trace a gizmo drag');
    const t = traceAxisDrag(origin, u, ray(at[0], at[1]), ray(at[0] + dx, at[1] + dy), this.snap ? SNAP.move : null, trace);
    this.trace = trace; this.traceTarget = o.id; this.emit('trace');
    this.message = t ? `${o.name}: dragging ${dx} px moves it ${t.move.toFixed(3)} along ${'xyz'[axis]}${this.snap ? `, snapped to ${t.snapped}` : ''}` : `${o.name}: that axis points at the camera`;
    this.emit('select');
    return true;
  }

  /** The last Mesh › Measure angle result, for the interface and guide steps. */
  lastMeasure: { object: string; corner: number; degrees: number; dot: number } | null = null;

  /** Measure the angle between two selected edges that share a vertex (edit mode, edge select). Traced. */
  measureAngle(): boolean {
    const o = this.editObject;
    if (!o?.mesh) { this.say('Measure angle: Tab into edit mode on a mesh first'); return false; }
    const es = this.selectedEdges();
    if (es.length !== 2) { this.say('Measure angle: select exactly two edges that meet at a corner (press 2 for edge select)'); return false; }
    const corner = es[0].find((v) => es[1].includes(v));
    if (corner === undefined) { this.say('Measure angle: the two edges must share a vertex'); return false; }
    const a = es[0][0] === corner ? es[0][1] : es[0][0], c = es[1][0] === corner ? es[1][1] : es[1][0];
    const trace = this.traceEnabled ? new Trace('Measure angle') : undefined;
    if (trace && o.mesh.verts.length <= trace.snapshotLimit) trace.before = o.mesh.toSnapshot();
    const m = o.mesh.measure(a, corner, c, trace);
    if (trace && trace.steps.length) { this.trace = trace; this.traceTarget = o.id; this.emit('trace'); }
    this.lastMeasure = { object: o.name, corner, degrees: m.degrees, dot: m.dot };
    this.message = `Angle at v${corner}: ${m.degrees.toFixed(2)}° (u · v = ${+m.dot.toFixed(4)}, |u| = ${+m.lu.toFixed(4)}, |v| = ${+m.lv.toFixed(4)})`;
    this.emit('select');
    return true;
  }

  /**
   * Select everything connected to the current selection (Ctrl+L). In face select it follows shared edges, by
   * breadth-first search over the face graph (traced); in vertex and edge select it follows faces through any
   * shared vertex.
   */
  selectLinked(): void {
    const mesh = this.editObject?.mesh;
    if (!mesh) return;
    if (this.selectMode === 'face') {
      const from = this.selectedFaces();
      if (!from.length) { this.say('Select linked: select a face first'); return; }
      const trace = this.traceEnabled ? new Trace('Select linked') : undefined;
      if (trace && mesh.verts.length <= trace.snapshotLimit) trace.before = mesh.toSnapshot();
      const pieces = mesh.pieces(trace, from);
      if (trace && trace.steps.length) { this.trace = trace; this.traceTarget = this.active; this.emit('trace'); }
      this.sel.faces = new Set(pieces.flat());
      this.message = `${this.sel.faces.size} face${this.sel.faces.size === 1 ? '' : 's'} linked by shared edges`;
      this.emit('select');
      return;
    }
    const verts = new Set(this.selectedVerts());
    let grew = true;
    while (grew) {
      grew = false;
      for (const f of mesh.faces) if (f.some((v) => verts.has(v)) && !f.every((v) => verts.has(v))) { f.forEach((v) => verts.add(v)); grew = true; }
    }
    this.sel.verts = verts;
    this.setSelectMode(this.selectMode);
  }

  selectedVerts(): number[] {
    const mesh = this.editObject?.mesh;
    if (!mesh) return [];
    if (this.selectMode === 'vert') return [...this.sel.verts].filter((v) => v < mesh.verts.length);
    const out = new Set<number>();
    if (this.selectMode === 'edge') for (const k of this.sel.edges) k.split('-').map(Number).forEach((v) => out.add(v));
    else for (const f of this.sel.faces) mesh.faces[f]?.forEach((v) => out.add(v));
    return [...out];
  }

  selectedFaces(): number[] {
    const mesh = this.editObject?.mesh;
    if (!mesh) return [];
    if (this.selectMode === 'face') return [...this.sel.faces].filter((f) => f < mesh.faces.length);
    const verts = new Set(this.selectedVerts());
    return mesh.faces.map((f, i) => [f, i] as const).filter(([f]) => f.every((v) => verts.has(v))).map(([, i]) => i);
  }

  selectedEdges(): [number, number][] {
    const mesh = this.editObject?.mesh;
    if (!mesh) return [];
    if (this.selectMode === 'edge') return [...this.sel.edges].filter((k) => mesh.edges().has(k)).map((k) => k.split('-').map(Number) as [number, number]);
    const verts = new Set(this.selectedVerts());
    return [...mesh.edges().values()].filter((e) => verts.has(e.a) && verts.has(e.b)).map((e) => [e.a, e.b] as [number, number]);
  }

  // ── mesh commands (edit mode) ──────────────────────────────────────────

  private meshOp(label: string, needs: 'faces' | 'verts' | 'edges' | 'none', make: (o: SceneObject, mesh: EditMesh, items: number[] | [number, number][], trace?: Trace) => string | null, traceOp?: string): boolean {
    const o = this.editObject;
    this.endPreview();
    if (!o?.mesh) { this.say('Enter edit mode (Tab) on a mesh first'); return false; }
    const items = needs === 'faces' ? this.selectedFaces() : needs === 'verts' ? this.selectedVerts() : needs === 'edges' ? this.selectedEdges() : [];
    if (needs !== 'none' && !items.length) { this.say(`${label}: select some ${needs === 'faces' ? 'faces' : needs === 'edges' ? 'edges' : 'vertices'} first`); return false; }
    const before = this.scene.toJSON();
    const trace = this.traceEnabled && traceOp ? new Trace(traceOp) : undefined;
    if (trace && o.mesh.verts.length <= trace.snapshotLimit) trace.before = o.mesh.toSnapshot();
    const code = make(o, o.mesh, items, trace);
    if (trace && trace.steps.length) { this.trace = trace; this.traceTarget = o.id; this.emit('trace'); }
    this.commit(label, before, code);
    return true;
  }

  /** Remember an operation so its parameters can be changed afterwards (undo, then redo with new values). */
  private snapshotSel() { return { mode: this.selectMode, sel: { verts: new Set(this.sel.verts), edges: new Set(this.sel.edges), faces: new Set(this.sel.faces) } }; }

  /** `before` is the selection as it was before the operation, for operations that change it. */
  private remember(label: string, params: Record<string, number>, again: (p: Record<string, number>) => boolean, before = this.snapshotSel()): void {
    const { mode, sel } = before;
    const depth = this.undoStack.length;
    this.lastOp = {
      label, params, depth,
      rerun: (p) => {
        if (this.undoStack.length !== depth || this.undoStack.at(-1)?.label !== label) return;
        this.undo();
        this.selectMode = mode;
        this.sel = { verts: new Set(sel.verts), edges: new Set(sel.edges), faces: new Set(sel.faces) };
        again(p);
      },
    };
  }

  /** Change the parameters of the operation just done. */
  adjustLast(params: Record<string, number>): void { this.lastOp?.rerun({ ...this.lastOp.params, ...params }); }

  /** Whether the remembered operation is still the latest change. */
  get lastOpLive(): boolean { return !!this.lastOp && this.undoStack.length === this.lastOp.depth && this.undoStack.at(-1)?.label === this.lastOp.label; }

  extrude(distance = 0.5): boolean {
    const faces = this.selectedFaces();
    const ok = this.extrudeRaw(distance);
    if (ok && faces.length) this.remember('Extrude', { distance }, (p) => this.extrude(p.distance));
    return ok;
  }

  private extrudeRaw(distance: number): boolean {
    return this.meshOp('Extrude', 'faces', (o, m, faces, t) => { m.extrudeFaces(faces as number[], distance, t, { skipWall: onMirrorPlane(m, o.modifiers) }); return `${ref(o)}.mesh.extrude(${lit(faces)}, ${lit(distance)})`; }, 'Extrude');
  }

  inset(amount = 0.25): boolean {
    const ok = this.insetRaw(amount);
    if (ok) this.remember('Inset', { amount }, (p) => this.inset(p.amount));
    return ok;
  }

  /** Inset the selected faces as one region by a distance (Blender's I). Adjustable afterwards. */
  insetRegion(thickness = 0.1): boolean {
    const faces = this.selectedFaces();
    const ok = this.meshOp('Inset', 'faces', (o, m, fs, t) => { insetRegion(m, fs as number[], thickness, t); return `${ref(o)}.mesh.insetRegion(${lit(fs)}, ${lit(thickness)})`; }, 'Inset (region)');
    if (ok && faces.length) this.remember('Inset', { thickness }, (p) => this.insetRegion(Math.max(0, p.thickness)));
    return ok;
  }

  /** Bevel the selected edges (Blender's Ctrl+B): width along the neighbouring edges, and segments across. */
  bevel(width = 0.1, segments = 1): boolean {
    const n = Math.max(1, Math.min(12, Math.round(segments)));
    const before = this.snapshotSel();
    const ok = this.meshOp('Bevel', 'edges', (o, m, es, t) => {
      bevelEdges(m, es as [number, number][], width, n, t);
      this.clearElements(false);
      return `${ref(o)}.mesh.bevel(${lit(es)}, ${lit(width)}${n > 1 ? `, ${n}` : ''})`;
    }, 'Bevel');
    if (ok) this.remember('Bevel', { width, segments: n }, (p) => this.bevel(Math.max(0, p.width), p.segments), before);
    return ok;
  }

  /** Dissolve what is selected (Blender's Ctrl+X): vertices, edges or faces, keeping the shape. */
  dissolve(): boolean {
    const kind = this.selectMode;
    return this.meshOp('Dissolve', kind === 'face' ? 'faces' : kind === 'edge' ? 'edges' : 'verts', (o, m, items, t) => {
      this.clearElements(false);
      if (kind === 'face') { dissolveFaces(m, items as number[], t); return `${ref(o)}.mesh.dissolve({ faces: ${lit(items)} })`; }
      if (kind === 'edge') { dissolveEdges(m, items as [number, number][], t); return `${ref(o)}.mesh.dissolve({ edges: ${lit(items)} })`; }
      dissolveVerts(m, items as number[], t); return `${ref(o)}.mesh.dissolve({ verts: ${lit(items)} })`;
    }, 'Dissolve');
  }

  private insetRaw(amount: number): boolean {
    return this.meshOp('Inset', 'faces', (o, m, faces, t) => { m.insetFaces(faces as number[], amount, t); return `${ref(o)}.mesh.inset(${lit(faces)}, ${lit(amount)})`; }, 'Inset');
  }

  loopCut(a?: number, b?: number, t = 0.5): boolean {
    const edge = a !== undefined && b !== undefined ? [a, b] as [number, number] : this.selectedEdges()[0];
    if (!edge) { this.say('Loop cut: select an edge that crosses the ring you want to cut'); return false; }
    const ok = this.loopCutRaw(edge, t);
    if (ok) this.remember('Loop cut', { position: t }, (p) => this.loopCut(edge[0], edge[1], Math.min(0.99, Math.max(0.01, p.position))));
    return ok;
  }

  private loopCutRaw(edge: [number, number], t: number): boolean {
    return this.meshOp('Loop cut', 'none', (o, m, _i, tr) => {
      const before = m.verts.length;
      m.loopCut(edge[0], edge[1], t, tr);
      const fresh = new Set(Array.from({ length: m.verts.length - before }, (_, i) => before + i));
      this.clearElements(false);
      if (this.selectMode === 'vert') this.sel.verts = fresh;
      else if (this.selectMode === 'edge') this.sel.edges = new Set([...m.edges().values()].filter((e) => fresh.has(e.a) && fresh.has(e.b)).map((e) => EditMesh.edgeKey(e.a, e.b)));
      return `${ref(o)}.mesh.loopCut(${edge[0]}, ${edge[1]}, ${lit(t)})`;
    }, 'Loop cut');
  }

  split(): boolean {
    return this.meshOp('Subdivide faces', 'faces', (o, m, faces) => { m.subdivideFaces(faces as number[]); return `${ref(o)}.mesh.split(${lit(faces)})`; });
  }

  smoothSubdivide(): boolean {
    return this.meshOp('Subdivide smooth', 'none', (o, _m, _i, t) => { o.mesh = catmullClark(o.mesh!, t); this.clearElements(false); return `${ref(o)}.mesh.subdivide(1)`; }, 'Catmull–Clark');
  }

  deleteElements(): boolean {
    const kind = this.selectMode;
    return this.meshOp('Delete', kind === 'face' ? 'faces' : kind === 'edge' ? 'edges' : 'verts', (o, m, items) => {
      this.clearElements(false);
      if (kind === 'face') { m.deleteFaces(items as number[]); return `${ref(o)}.mesh.delete({ faces: ${lit(items)} })`; }
      if (kind === 'edge') { m.deleteEdges(items as [number, number][]); return `${ref(o)}.mesh.delete({ edges: ${lit(items)} })`; }
      m.deleteVerts(items as number[]); return `${ref(o)}.mesh.delete({ verts: ${lit(items)} })`;
    });
  }

  merge(): boolean {
    return this.meshOp('Merge at centre', 'verts', (o, m, verts, t) => {
      const vs = verts as number[];
      if (vs.length < 2) return null;
      const keep = vs[0], below = vs.slice(1).filter((v) => v < keep).length;
      m.mergeVerts(vs, undefined, t);
      this.clearElements(false);
      if (this.selectMode === 'vert') this.sel.verts.add(keep - below);
      return `${ref(o)}.mesh.merge(${lit(vs)})`;
    }, 'Merge');
  }

  /** The knife (K): cut the edited mesh along a line (see core/knife.ts). Selects the new edges. */
  knife(line: { eye: Vec3; from: Vec3; to: Vec3 }, through = false): boolean {
    const o = this.editObject;
    if (!o?.mesh) { this.say('Knife: enter edit mode (Tab) on a mesh first'); return false; }
    const r = (v: Vec3): Vec3 => v.map((x) => +x.toFixed(6)) as Vec3;
    const l = { eye: r(line.eye), from: r(line.from), to: r(line.to) };
    if (!knifeCut(o.mesh.clone(), l, knifeFaces(o.mesh, l.eye, through)).length) { this.say('Knife: the line crosses no face'); return false; }
    return this.meshOp('Knife', 'none', (o, m, _items, t) => {
      const cut = knifeCut(m, l, knifeFaces(m, l.eye, through), t);
      this.clearElements(false);
      for (const [a, b] of cut) {
        if (this.selectMode === 'edge') this.sel.edges.add(EditMesh.edgeKey(a, b));
        else if (this.selectMode === 'vert') { this.sel.verts.add(a); this.sel.verts.add(b); }
      }
      this.say(`Knife: ${cut.length} face${cut.length === 1 ? '' : 's'} cut`);
      return `${ref(o)}.mesh.knife(${lit({ ...l, ...(through ? { through } : {}) })})`;
    }, 'Knife');
  }

  /** Close the hole round the selected vertices with one face (F in edit mode). */
  fill(): boolean {
    const o = this.editObject;
    if (o?.mesh) {
      const plan = o.mesh.fillPlan(this.selectedVerts());
      if (typeof plan === 'string') { this.say(`Fill: ${plan}`); return false; }
    }
    return this.meshOp('Fill', 'verts', (o, m, verts, t) => {
      const f = m.fill(verts as number[], t);
      if (this.selectMode === 'face') { this.sel.faces.clear(); this.sel.faces.add(f); }
      return `${ref(o)}.mesh.fill(${lit(verts)})`;
    }, 'Fill');
  }

  /**
   * Merge vertices closer than a distance (Blender's Merge by Distance): the whole mesh in edit mode. Traced: the
   * spatial hash that finds each match. The distance can be changed afterwards in Adjust.
   */
  mergeByDistance(distance = 0.001): boolean {
    let merged = 0;
    const ok = this.meshOp('Merge by distance', 'none', (o, m, _items, t) => {
      const before = m.verts.length;
      m.weld(distance, t);
      merged = before - m.verts.length;
      this.clearElements(false);
      return `${ref(o)}.mesh.weld(${distance})`;
    }, 'Merge by distance');
    if (ok) { this.message = `Merge by distance (${distance}): ${merged} vert${merged === 1 ? 'ex' : 'ices'} merged`; this.remember('Merge by distance', { distance }, (p) => this.mergeByDistance(Math.max(0, p.distance))); this.emit('select'); }
    return ok;
  }

  flip(): boolean {
    return this.meshOp('Flip normals', 'faces', (o, m, faces, t) => { m.flip(faces as number[], t); return `${ref(o)}.mesh.flip(${lit(faces)})`; }, 'Flip normals');
  }

  /** Set vertex positions (local coordinates). Used by the inspector and by a finished drag. */
  setVerts(positions: Record<number, Vec3>, label = 'Move vertices'): void {
    const o = this.editObject ?? this.activeObject;
    if (!o?.mesh) return;
    this.run(label, `${ref(o)}.mesh.setVerts(${lit(positions)})`, () => { for (const [i, p] of Object.entries(positions)) o.mesh!.verts[Number(i)] = [p[0], p[1], p[2]]; o.mesh!.touch(); });
  }

  /** Commit a finished gizmo drag of vertices (already moved live). */
  endVertexDrag(verts: number[]): void {
    const o = this.editObject;
    if (!o?.mesh) { this.endLive('Move vertices', null); return; }
    const pos: Record<number, Vec3> = {};
    for (const v of verts) pos[v] = o.mesh.verts[v];
    this.endLive('Transform vertices', `${ref(o)}.mesh.setVerts(${lit(pos)})`);
  }

  /** Mirror clipping: vertices that started on the mirror plane stay on it. */
  clipToMirror(o: SceneObject, start: Vec3[], verts: number[]): void {
    const mir = o.modifiers.find((m) => m.type === 'mirror' && m.enabled && m.clip);
    if (!mir || mir.type !== 'mirror' || !o.mesh) return;
    const k = { x: 0, y: 1, z: 2 }[mir.axis];
    for (const v of verts) if (Math.abs(start[v][k]) <= mir.merge) o.mesh.verts[v][k] = 0;
  }

  // ── heat maps ──────────────────────────────────────────────────────────

  /** The mesh a field is computed on: what the viewport draws (modifiers applied), or the cage for script values. */
  private fieldMesh(o: SceneObject, spec: FieldSpec): EditMesh {
    if (spec.kind === 'custom' || spec.kind === 'uv') return o.mesh!.clone();
    // Weights belong to the mesh the armature deforms (mirrored, not subdivided): show them on that, posed.
    if (spec.kind === 'weight') return skinnedSource(this.scene, o);
    return evaluatedMesh(this.scene, o, 3);
  }

  /** Show a per-vertex field on an object. Returns false (with a message) when it cannot. */
  showField(spec: FieldSpec, objectId = this.active): boolean {
    const o = objectId ? this.scene.get(objectId) : undefined;
    if (!o?.mesh) { this.say('Select a mesh object to show a heat map on'); return false; }
    if (spec.kind === 'geodesic' && !spec.sources.length) { this.say('Distance: select one or more vertices in edit mode to measure from'); return false; }
    if (spec.kind === 'custom' && spec.values.length !== o.mesh.verts.length) { this.say(`Script values: need ${o.mesh.verts.length} values, one per vertex, got ${spec.values.length}`); return false; }
    if (spec.kind === 'weight') {
      const i = o.skin?.bones.indexOf(spec.bone) ?? -1;
      if (!o.skin || i < 0) { this.say(o.skin ? `${o.name} has no weights for bone "${spec.bone}"` : `${o.name} is not bound to an armature`); return false; }
      spec = { kind: 'weight', bone: spec.bone, values: o.skin.weights[i] };
    }
    if (spec.kind === 'uv') {
      if (!uvFits(o.mesh, o.uv)) { this.say(o.uv ? `${o.name}'s UVs no longer fit its mesh: unwrap again` : `${o.name} has no UVs yet: UV › Unwrap`); return false; }
      spec = { kind: 'uv', values: Array.from(angleDistortion(o.mesh, o.uv)) };
    }
    const mesh = this.fieldMesh(o, spec);
    const trace = this.traceEnabled && spec.kind === 'geodesic' ? new Trace('Heat method') : this.traceEnabled && spec.kind === 'mean' ? new Trace('Mean curvature') : this.traceEnabled && spec.kind === 'gaussian' ? new Trace('Gaussian curvature') : undefined;
    if (trace && mesh.verts.length <= trace.snapshotLimit) trace.before = mesh.toSnapshot();
    this.field = { objectId: o.id, spec, mesh, result: computeField(mesh, spec, trace) };
    if (trace && trace.steps.length) { this.trace = trace; this.traceTarget = o.id; this.emit('trace'); }
    if (!this.scripting && spec.kind !== 'custom') {
      const args = spec.kind === 'geodesic' ? `"geodesic", { from: ${lit(spec.sources)} }` : spec.kind === 'coord' ? `"${'xyz'[spec.axis]}"` : spec.kind === 'weight' ? `"weight", { bone: ${lit(spec.bone)} }` : spec.kind === 'uv' ? '"uv"' : `"${spec.kind}"`;
      this.log.push({ label: `Show ${this.field.result.label}`, code: `${ref(o)}.mesh.showField(${args})` });
    }
    this.message = this.field.result.label;
    this.emit('select');
    return true;
  }

  /** Trace how the heat map now showing becomes colours: range, t, colour, and blending between vertices. */
  traceColourMapOf(): boolean {
    if (!this.field) { this.say('Trace the colour mapping: show a heat map first (Heat map menu)'); return false; }
    const trace = new Trace('Trace the colour mapping');
    traceColourMap(this.field.mesh, this.field.result, trace);
    this.trace = trace; this.traceTarget = this.field.objectId; this.emit('trace');
    this.message = `${this.field.result.label}: traced from value to colour`;
    this.emit('select');
    return true;
  }

  /** Trace one iso-line of the heat map shown: by default at the middle of its colour range (0 for curvature). */
  traceContourOf(level?: number): boolean {
    if (!this.field) { this.say('Trace the iso-line: show a heat map first (Heat map menu)'); return false; }
    const { mesh, result } = this.field, L = level ?? (result.range[0] + result.range[1]) / 2;
    const trace = new Trace('Trace the iso-line');
    if (mesh.verts.length <= trace.snapshotLimit) trace.before = mesh.toSnapshot();
    const r = traceContour(mesh, result.values, L, trace);
    this.trace = trace; this.traceTarget = this.field.objectId; this.emit('trace');
    this.message = `${result.label} = ${fmt(L, 4)}: ${r.loops} closed loop(s), ${r.open} open chain(s), length ${fmt(r.length, 4)}`;
    this.emit('select');
    return true;
  }

  /** Distance along the surface from the selected vertices (edit mode). */
  showDistanceFromSelection(): boolean {
    const sources = this.mode === 'edit' ? this.selectedVerts() : [];
    return this.showField({ kind: 'geodesic', sources });
  }

  clearField(): void { if (!this.field) return; this.field = null; this.emit('select'); }

  /** Recompute the field after the mesh changed; drop it when it no longer applies. */
  private refreshField(): void {
    const f = this.field!;
    const o = this.scene.get(f.objectId);
    // A past state shown by the step player may not have the object yet: keep the field for when it returns.
    if (!o?.mesh && this.previewing) return;
    if (!o?.mesh || (f.spec.kind === 'custom' && f.spec.values.length !== o.mesh.verts.length)) { this.field = null; return; }
    const mesh = this.fieldMesh(o, f.spec);
    let spec = f.spec;
    if (spec.kind === 'weight') {
      const i = o.skin?.bones.indexOf(spec.bone) ?? -1;
      if (!o.skin || i < 0) { this.field = null; return; }
      spec = { kind: 'weight', bone: spec.bone, values: o.skin.weights[i] };
    }
    if (spec.kind === 'uv') {
      if (!uvFits(o.mesh!, o.uv)) { this.field = null; return; }
      spec = { kind: 'uv', values: Array.from(angleDistortion(o.mesh!, o.uv)) };
    }
    if (spec.kind === 'geodesic') {
      spec = { kind: 'geodesic', sources: spec.sources.filter((s) => s < mesh.verts.length) };
      if (!spec.sources.length) { this.field = null; return; }
    }
    try { this.field = { objectId: o.id, spec, mesh, result: computeField(mesh, spec) }; } catch { this.field = null; }
  }

  /** Laplacian smoothing of the selected vertices: each moves toward the average of its neighbours. */
  smoothVerts(iterations = 5, lambda = 0.5): boolean {
    const n = Math.max(1, Math.min(200, Math.round(iterations))), l = Math.max(0, Math.min(1, lambda));
    const ok = this.meshOp('Smooth vertices', 'verts', (o, m, verts, t) => {
      smoothMesh(m, { iterations: n, lambda: l, only: verts as number[] }, t);
      return `${ref(o)}.mesh.smooth({ verts: ${lit(verts)}, iterations: ${n}, lambda: ${lit(l)} })`;
    }, 'Smooth');
    if (ok) this.remember('Smooth vertices', { iterations: n, lambda: l }, (p) => this.smoothVerts(p.iterations, p.lambda));
    return ok;
  }

  /** Implicit smoothing of the selected vertices: one backward heat step, (M + tC) x' = M x, t = strength · h². */
  smoothImplicit(strength = 1, iterations = 1): boolean {
    const n = Math.max(1, Math.min(20, Math.round(iterations))), s = Math.max(0, Math.min(100, strength));
    const ok = this.meshOp('Smooth vertices (implicit)', 'verts', (o, m, verts, t) => {
      smoothMeshImplicit(m, { strength: s, iterations: n, only: verts as number[] }, t);
      return `${ref(o)}.mesh.smoothImplicit({ verts: ${lit(verts)}, strength: ${lit(s)}, iterations: ${n} })`;
    }, 'Implicit smoothing');
    if (ok) this.remember('Smooth vertices (implicit)', { strength: s, iterations: n }, (p) => this.smoothImplicit(p.strength, p.iterations));
    return ok;
  }

  // ── animation ──────────────────────────────────────────────────────────

  get frame(): number { return this.scene.timeline.frame; }

  /**
   * Go to a frame: every animated object takes its keyed transform. As in Blender,
   * changing frame is not an undo step, and an unkeyed change to an animated
   * channel is overwritten at the next frame change: insert a key (I) to keep it.
   */
  setFrame(f: number): void {
    const t = this.scene.timeline;
    t.frame = Math.round(f);
    this.applyFrame();
    this.emit('frame');
  }

  /** Put animated objects (all, or those listed) at their transform for the current frame. */
  applyFrame(only?: Set<string>): void {
    for (const o of this.scene.objects) {
      if (!hasKeys(o.anim) || (only && !only.has(o.id))) continue;
      const x = transformAt(o, this.scene.timeline.frame);
      o.position = [...x.position] as Vec3; o.rotation = [...x.rotation] as Vec3; o.scale = [...x.scale] as Vec3;
      if (o.bones) for (const [n, p] of posesAt(o.anim, this.scene.timeline.frame)) { const b = o.bones.find((x) => x.name === n); if (b) b.pose = [...p] as Vec3; }
    }
  }

  setPlaying(on: boolean): void { this.playing = on; this.emit('select'); }

  private keyTargets(): SceneObject[] {
    const ids = this.selected.size ? [...this.selected] : this.active ? [this.active] : [];
    return ids.map((id) => this.scene.get(id)).filter((o): o is SceneObject => !!o);
  }

  /** Key the selected objects' current transforms at the current frame (Blender: I). */
  insertKey(channels: Channel[] = CHANNELS): boolean {
    const po = this.poseObject;
    if (po?.bones) {
      const bones = this.keyBones(po);
      const f = this.frame;
      this.run(`Key pose at frame ${f}`, bones.map((b) => `${ref(po)}.bone(${lit(b.name)}).keyframe(${f}, { rotation: ${lit(b.pose)} })`).join('\n'), () => {
        po.anim ??= {};
        for (const b of bones) setBoneKey(po.anim, b.name, f, b.pose);
      });
      return true;
    }
    const objs = this.keyTargets();
    if (!objs.length) { this.say('Insert keyframe: select an object first'); return false; }
    const f = this.frame;
    const code = objs.map((o) => `${ref(o)}.keyframe(${f}, { ${channels.map((c) => `${c}: ${lit(o[c])}`).join(', ')} })`).join('\n');
    this.run(`Insert keyframe at frame ${f}`, code, () => { for (const o of objs) { o.anim ??= {}; for (const c of channels) setKey(o.anim, c, f, o[c]); } });
    return true;
  }

  /** Remove the selected objects' keys at the current frame. */
  deleteKey(): boolean {
    const f = this.frame;
    const po = this.poseObject;
    if (po?.bones) {
      const bones = this.keyBones(po).filter((b) => po.anim?.bones?.[b.name]?.some((k) => k.frame === f));
      if (!bones.length) { this.say(`No bone key at frame ${f}`); return false; }
      this.run(`Delete bone keys at frame ${f}`, bones.map((b) => `${ref(po)}.bone(${lit(b.name)}).deleteKeyframe(${f})`).join('\n'), () => {
        for (const b of bones) removeBoneKey(po.anim!, b.name, f);
        if (!hasKeys(po.anim)) po.anim = undefined;
      });
      return true;
    }
    const objs = this.keyTargets().filter((o) => CHANNELS.some((c) => o.anim?.[c]?.some((k) => k.frame === f)));
    if (!objs.length) { this.say(`No keyframe at frame ${f} on the selection`); return false; }
    this.run(`Delete keyframe at frame ${f}`, objs.map((o) => `${ref(o)}.deleteKeyframe(${f})`).join('\n'), () => {
      for (const o of objs) { for (const c of CHANNELS) removeKey(o.anim!, c, f); if (!hasKeys(o.anim)) o.anim = undefined; }
    });
    return true;
  }

  /** How the value leaves the keys at the current frame: constant, linear or eased. */
  setInterpolation(interp: Interp): boolean {
    const f = this.frame;
    const po = this.poseObject;
    if (po?.bones) {
      const bones = this.keyBones(po).filter((b) => po.anim?.bones?.[b.name]?.some((k) => k.frame === f));
      if (!bones.length) { this.say(`Interpolation: frame ${f} has no bone key`); return false; }
      this.run(`Interpolation ${interp}`, bones.map((b) => `${ref(po)}.bone(${lit(b.name)}).keyframe(${f}, { rotation: ${lit(po.anim!.bones![b.name].find((k) => k.frame === f)!.value)}, interp: ${lit(interp)} })`).join('\n'), () => {
        for (const b of bones) for (const k of po.anim!.bones![b.name]) if (k.frame === f) k.interp = interp;
        this.applyFrame();
      });
      return true;
    }
    const objs = this.keyTargets().filter((o) => CHANNELS.some((c) => o.anim?.[c]?.some((k) => k.frame === f)));
    if (!objs.length) { this.say(`Interpolation: go to a frame with a keyframe (frame ${f} has none)`); return false; }
    this.run(`Interpolation ${interp}`, objs.map((o) => `${ref(o)}.setInterpolation(${f}, ${lit(interp)})`).join('\n'), () => {
      for (const o of objs) for (const c of CHANNELS) for (const k of o.anim?.[c] ?? []) if (k.frame === f) k.interp = interp;
      this.applyFrame();
    });
    return true;
  }

  setRotationMode(id: string, mode: 'euler' | 'quaternion'): void {
    const o = this.scene.get(id);
    if (!o) return;
    this.run(mode === 'quaternion' ? 'Rotation: quaternion slerp' : 'Rotation: Euler', `${ref(o)}.rotationMode = ${lit(mode)}`, () => { (o.anim ??= {}).rotationMode = mode; this.applyFrame(); });
  }

  setTimeline(patch: Partial<{ start: number; end: number; fps: number }>): void {
    const t = { ...this.scene.timeline, ...patch };
    t.start = Math.round(t.start); t.end = Math.max(t.start + 1, Math.round(t.end)); t.fps = Math.max(1, Math.min(240, Math.round(t.fps)));
    this.run('Timeline', `scene.setTimeline(${lit({ start: t.start, end: t.end, fps: t.fps })})`, () => { this.scene.timeline = { ...t, frame: Math.min(t.end, Math.max(t.start, t.frame)) }; this.applyFrame(); });
  }

  clearAnimation(id: string): void {
    const o = this.scene.get(id);
    if (!o?.anim) return;
    this.run('Clear animation', `${ref(o)}.clearAnimation()`, () => { o.anim = undefined; });
  }

  // ── armatures ──────────────────────────────────────────────────────────

  /** In pose mode, the bones I and Delete key act on: the active bone, or all of them if none is active. */
  private keyBones(o: SceneObject): Bone[] {
    const b = o.bones!.find((x) => x.name === this.activeBone);
    return b ? [b] : o.bones!;
  }

  private armature(): SceneObject | undefined {
    const o = this.activeObject;
    if (!o?.bones) { this.say('Select an armature first'); return undefined; }
    return o;
  }

  private uniqueBone(o: SceneObject, base: string): string {
    const taken = new Set(o.bones!.map((b) => b.name));
    if (!taken.has(base)) return base;
    const stem = base.replace(/\.\d{3}$/, '');
    for (let i = 1; ; i++) { const n = `${stem}.${String(i).padStart(3, '0')}`; if (!taken.has(n)) return n; }
  }

  addArmature(bones?: (Omit<Bone, 'pose'>)[], name = 'Armature'): SceneObject {
    const list: Bone[] = (bones ?? [{ name: 'Bone', parent: null, head: [0, 0, 0], tail: [0, 1, 0] }]).map((b) => ({ ...b, head: [...b.head] as Vec3, tail: [...b.tail] as Vec3, pose: [0, 0, 0] }));
    orderBones(list);
    let o!: SceneObject;
    this.run('Add armature', `scene.add.armature(${lit({ name, bones: list.map(({ name: n, parent, head, tail, roll }) => ({ name: n, parent, head, tail, ...(roll ? { roll } : {}) })) })})`, () => {
      o = this.scene.add({ name, kind: 'armature', bones: list, material: { color: '#c9ced6', roughness: 0.6, metalness: 0 } });
      this.selected = new Set([o.id]); this.active = o.id; this.activeBone = list[0]?.name ?? null;
    });
    return o;
  }

  /** A new bone continuing from the tail of `parent` (default: the active bone), same direction and length. */
  addBone(parent = this.activeBone): boolean {
    const o = this.armature();
    if (!o) return false;
    const p = o.bones!.find((b) => b.name === parent) ?? o.bones!.at(-1);
    const head: Vec3 = p ? [...p.tail] as Vec3 : [0, 0, 0];
    const dir: Vec3 = p ? [p.tail[0] - p.head[0], p.tail[1] - p.head[1], p.tail[2] - p.head[2]] : [0, 1, 0];
    const bone: Bone = { name: this.uniqueBone(o, p?.name ?? 'Bone'), parent: p?.name ?? null, head, tail: [head[0] + dir[0], head[1] + dir[1], head[2] + dir[2]], pose: [0, 0, 0] };
    this.run('Add bone', `${ref(o)}.addBone(${lit({ name: bone.name, parent: bone.parent, head: bone.head, tail: bone.tail })})`, () => { o.bones!.push(bone); this.activeBone = bone.name; });
    return true;
  }

  /** Change a bone's rest head/tail, name or parent. A rename follows through to skins and keys. */
  setBone(name: string, patch: { name?: string; head?: Vec3; tail?: Vec3; parent?: string | null; roll?: number }): boolean {
    const o = this.armature();
    const b = o?.bones!.find((x) => x.name === name);
    if (!o || !b) return false;
    if (patch.name !== undefined && patch.name !== name && o.bones!.some((x) => x.name === patch.name)) { this.say(`There is already a bone called "${patch.name}"`); return false; }
    try { orderBones(o.bones!.map((x) => (x === b ? { ...x, parent: patch.parent !== undefined ? patch.parent : x.parent } : x))); }
    catch (e) { this.say(e instanceof Error ? e.message : String(e)); return false; }
    this.run(patch.name && patch.name !== name ? 'Rename bone' : 'Edit bone', `${ref(o)}.bone(${lit(name)}).set(${lit(patch)})`, () => {
      applyBonePatch(this.scene, o, b, patch);
      if (this.activeBone === name && patch.name) this.activeBone = patch.name;
    });
    return true;
  }

  /** Delete a bone: its children move up to its parent; skins lose its weights, keys go with it. */
  deleteBone(name = this.activeBone ?? ''): boolean {
    const o = this.armature();
    if (!o || !o.bones!.some((b) => b.name === name)) return false;
    if (o.bones!.length === 1) { this.say('An armature needs at least one bone'); return false; }
    this.run('Delete bone', `${ref(o)}.removeBone(${lit(name)})`, () => { removeBone(this.scene, o, name); this.activeBone = o.bones![0].name; });
    return true;
  }

  /** Set a bone's pose rotation (radians, XYZ, in the bone's own frame). */
  setBonePose(name: string, pose: Vec3): void {
    const o = this.armature();
    const b = o?.bones!.find((x) => x.name === name);
    if (!o || !b) return;
    this.run('Pose bone', `${ref(o)}.bone(${lit(name)}).pose = ${lit(pose)}`, () => { b.pose = [pose[0], pose[1], pose[2]]; });
  }

  /** Commit a finished gizmo drag of a bone (already posed live). */
  endBoneDrag(name: string): void {
    const o = this.activeObject, b = o?.bones?.find((x) => x.name === name);
    this.endLive('Pose bone', o && b ? `${ref(o)}.bone(${lit(name)}).pose = ${lit(b.pose)}` : null);
  }

  /** Back to the rest pose (Blender: Alt+R). */
  resetPose(): void {
    const o = this.armature();
    if (!o) return;
    this.run('Clear pose', `${ref(o)}.resetPose()`, () => { for (const b of o.bones!) b.pose = [0, 0, 0]; });
  }

  /**
   * Bind the selected meshes to an armature with automatic weights (Blender: Ctrl+P).
   * The armature is the active object if it is one, otherwise the only one in the scene.
   */
  bindToArmature(): boolean {
    const act = this.activeObject;
    const arm = act?.bones ? act : this.scene.objects.filter((x) => x.bones).length === 1 ? this.scene.objects.find((x) => x.bones) : undefined;
    const meshes = [...this.selected].map((id) => this.scene.get(id)).filter((x): x is SceneObject => !!x?.mesh);
    if (!arm) { this.say('Bind: select the mesh, then Shift-click the armature (so the armature is active)'); return false; }
    if (!meshes.length) { this.say('Bind: select a mesh too (Shift-click it), then the armature'); return false; }
    const trace = this.traceEnabled ? new Trace('Automatic weights') : undefined;
    this.run(`Bind to ${arm.name}`, meshes.map((m) => `${ref(m)}.bindTo(${ref(arm)})`).join('\n'), () => { meshes.forEach((m, i) => bindSkin(this.scene, m, arm, i === 0 ? trace : undefined)); });
    if (trace && trace.steps.length) { this.trace = trace; this.traceTarget = meshes[0].id; this.emit('trace'); }
    this.say(`Bound ${meshes.map((m) => m.name).join(', ')} to ${arm.name}: automatic weights for ${arm.bones!.length} bones. Pose mode (Ctrl+Tab on the armature) to try it.`);
    return true;
  }

  /** At most `k` bones per vertex, as glTF and game engines require. */
  limitInfluences(id: string, k = 4): void {
    const o = this.scene.get(id);
    if (!o?.skin) return;
    let n = 0;
    this.run(`Limit to ${k} bones per vertex`, `${ref(o)}.limitWeights(${k})`, () => { n = limitWeights(o.skin!, k); });
    this.say(`${n} vertices had more than ${k} bones; their weakest weights were dropped.`);
  }

  /** Linear blending (averages points) or dual quaternions (averages rigid motions). */
  setSkinMethod(id: string, method: 'linear' | 'dual-quaternion'): void {
    const o = this.scene.get(id);
    if (!o?.skin) return;
    this.run(method === 'linear' ? 'Linear blend skinning' : 'Dual-quaternion skinning', `${ref(o)}.skinning = ${lit(method)}`, () => { o.skin!.method = method; });
  }

  unbind(id: string): void {
    const o = this.scene.get(id);
    if (!o?.skin) return;
    this.run('Unbind', `${ref(o)}.unbind()`, () => { o.skin = undefined; });
  }

  /** Record a trace of linear blend skinning at one vertex of a skinned mesh. */
  explainSkinning(id: string, vertex: number): boolean {
    const o = this.scene.get(id);
    if (!o?.skin) return false;
    const trace = new Trace('Linear blend skinning');
    trace.before = skinnedSource(this.scene, { ...o, skin: undefined }).toSnapshot();
    skinnedSource(this.scene, o, trace, vertex);
    if (!trace.steps.length) { this.say('This vertex has no weights (or the mesh changed since binding: rebind)'); return false; }
    this.trace = trace; this.traceTarget = o.id; this.emit('trace');
    return true;
  }

  // ── UVs ────────────────────────────────────────────────────────────────

  private uvObject(): SceneObject | undefined {
    const o = this.editObject ?? this.activeObject;
    if (!o?.mesh) { this.say('Select a mesh first'); return undefined; }
    return o;
  }

  /** Mark (or clear) the selected edges as UV seams: where the surface is cut to lie flat. */
  markSeams(on = true): boolean {
    const o = this.editObject;
    const edges = this.selectedEdges();
    if (!o?.mesh || !edges.length) { this.say('Seams: in edit mode, select the edges to cut along (edge select, 2)'); return false; }
    const keys = edges.map(([a, b]) => EditMesh.edgeKey(a, b));
    this.run(on ? 'Mark seams' : 'Clear seams', `${ref(o)}.mesh.${on ? 'markSeams' : 'clearSeams'}(${lit(edges)})`, () => {
      const s = new Set(o.seams ?? []);
      for (const k of keys) if (on) s.add(k); else s.delete(k);
      o.seams = s.size ? [...s] : undefined;
    });
    return true;
  }

  /** Mark every edge sharper than `degrees` as a seam (a cube's twelve edges): the usual start for hard-surface models. */
  seamsFromSharp(degrees = 60): void {
    const o = this.uvObject();
    if (!o) return;
    this.run('Seams from sharp edges', `${ref(o)}.mesh.seamsFromSharp(${lit(degrees)})`, () => { o.seams = [...new Set([...(o.seams ?? []), ...sharpEdges(o.mesh!, degrees)])]; });
  }

  /** Unwrap: LSCM on each chart cut by the seams (or a flat projection from above). Adds a checker texture if there is none. */
  unwrap(method: 'lscm' | 'planar' | 'cylinder' = 'lscm'): boolean {
    const o = this.uvObject();
    if (!o) return false;
    const trace = this.traceEnabled ? new Trace(method === 'lscm' ? 'Unwrap (LSCM)' : method === 'planar' ? 'Project from above' : 'Project around') : undefined;
    if (trace && o.mesh!.verts.length <= trace.snapshotLimit) trace.before = o.mesh!.toSnapshot();
    let layer;
    try { layer = method === 'lscm' ? unwrapMesh(o.mesh!, new Set(o.seams ?? []), trace) : traceUVProjection(o.mesh!, method, trace).layer; }
    catch (e) { this.say(e instanceof Error ? e.message : String(e)); return false; }
    const addTexture = !o.material.texture || o.material.texture === 'none';
    this.run('Unwrap', `${ref(o)}.mesh.unwrap(${method !== 'lscm' ? `{ method: "${method}" }` : ''})${addTexture ? `\n${ref(o)}.material.texture = "checker"` : ''}`, () => {
      o.uv = layer;
      if (addTexture) o.material = { ...o.material, texture: 'checker' };
    });
    if (trace && trace.steps.length) { this.trace = trace; this.traceTarget = o.id; this.emit('trace'); }
    return true;
  }
}
