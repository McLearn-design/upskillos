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

import { EditMesh, type Vec3 } from './EditMesh';
import { Scene, type SceneJSON, type SceneObject } from './Scene';
import { makePrimitive, type PrimitiveParams, type PrimitiveType } from './primitives';
import { defaultModifier, evaluate, onMirrorPlane, type Modifier } from './modifiers';
import { catmullClark } from './subdivision';
import { Trace } from './trace';

export type Mode = 'object' | 'edit';
export type SelectMode = 'vert' | 'edge' | 'face';
export type ChangeKind = 'scene' | 'live' | 'select' | 'mode' | 'trace';
export interface LogEntry { label: string; code: string | null }
export interface ScriptResult { output: string[]; error: string | null }

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
  undoStack: { label: string; before: SceneJSON; after: SceneJSON }[] = [];
  redoStack: { label: string; before: SceneJSON; after: SceneJSON }[] = [];
  log: LogEntry[] = [];
  traceEnabled = false;
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

  subscribe(fn: (k: ChangeKind) => void): () => void { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  emit(k: ChangeKind): void { this.version++; for (const fn of this.listeners) fn(k); }
  say(msg: string): void { this.message = msg; this.emit('select'); }

  get activeObject(): SceneObject | undefined { return this.active ? this.scene.get(this.active) : undefined; }
  get editObject(): SceneObject | undefined { return this.mode === 'edit' ? this.activeObject : undefined; }

  // ── the one path for changes ───────────────────────────────────────────

  run<T>(label: string, code: string | null, fn: (trace?: Trace) => T, traceOp?: string): T {
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
    this.undoStack.push({ label, before, after });
    if (this.undoStack.length > 200) this.undoStack.shift();
    this.redoStack = [];
    if (code && !this.scripting) this.log.push({ label, code });
    this.message = label;
    this.emit('scene');
  }

  /** Start a continuous change (a gizmo drag). Call liveUpdate while it runs and endLive at the end. */
  beginLive(): void { this.liveBefore = this.scene.toJSON(); }
  liveUpdate(): void { this.emit('live'); }
  endLive(label: string, code: string | null): void {
    if (!this.liveBefore) return;
    const before = this.liveBefore;
    this.liveBefore = null;
    this.commit(label, before, code);
  }
  get isLive(): boolean { return this.liveBefore !== null; }

  undo(): void {
    const e = this.undoStack.pop();
    if (!e) return;
    this.redoStack.push(e);
    this.restore(e.before);
    this.message = `Undo: ${e.label}`;
    this.emit('scene');
  }

  redo(): void {
    const e = this.redoStack.pop();
    if (!e) return;
    this.undoStack.push(e);
    this.restore(e.after);
    this.message = `Redo: ${e.label}`;
    this.emit('scene');
  }

  private restore(j: SceneJSON): void {
    this.scene = Scene.fromJSON(j);
    this.selected = new Set([...this.selected].filter((id) => this.scene.get(id)));
    if (this.active && !this.scene.get(this.active)) this.active = null;
    if (this.mode === 'edit' && !this.activeObject?.mesh) this.mode = 'object';
    this.clearElements(false);
  }

  // ── files ──────────────────────────────────────────────────────────────

  newScene(): void {
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

  setSmooth(id: string, smooth: boolean): void {
    const o = this.scene.get(id);
    if (!o) return;
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

  toggleEdit(): void { if (this.mode === 'edit') this.exitEdit(); else this.enterEdit(); }

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

  /** Select everything connected to the current selection (Ctrl+L). */
  selectLinked(): void {
    const mesh = this.editObject?.mesh;
    if (!mesh) return;
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
  private remember(label: string, params: Record<string, number>, again: (p: Record<string, number>) => boolean): void {
    const mode = this.selectMode, sel = { verts: new Set(this.sel.verts), edges: new Set(this.sel.edges), faces: new Set(this.sel.faces) };
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

  flip(): boolean {
    return this.meshOp('Flip normals', 'faces', (o, m, faces) => { m.flip(faces as number[]); return `${ref(o)}.mesh.flip(${lit(faces)})`; });
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
}
