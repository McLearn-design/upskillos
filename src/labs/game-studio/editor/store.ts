// The editor's state (ADR 2): the open project (a Doc, which owns the project and its
// history), plus what is only about editing: the scene on screen, the selection,
// unsaved script text, the running game and its output. React components read this
// and call its methods; none of them owns project data.

import { Doc } from '../core/doc';
import { newProject, pathOf, sceneAt, findNode } from '../core/project';
import type { AnimationClip, NodeData, Project, PropValue, SceneData, TilesetData } from '../core/types';
import { applyClip, setKey, trackPath } from '../core/animation';
import { applyEdits, tilesetGrid, type CellEdit } from '../core/tiles';
import { expandScene } from '../core/instances';
import { matchImage, planImport, readMap } from '../core/tiled';
import { isA, propValue } from '../core/registry';
import type { FromRuntime } from '../runtime/protocol';
import { runGame, type RunningGame } from './runner';
import { checkSyntax } from '../runtime/scripts';
import * as storage from './storage';
import { starterImage, type StarterMap } from './starterLibrary';
import type { GameExample } from '../examples/types';

export interface OutputLine { level: 'log' | 'info' | 'warn' | 'error' | 'system'; text: string; file?: string | null; line?: number | null; column?: number | null; node?: string | null }

export type Tab = { kind: 'scene' } | { kind: 'script'; path: string };

/** A class name from a node name: "player 1" → "Player1". */
export const className = (name: string): string => (name.replace(/[^A-Za-z0-9]+(.)?/g, (_m, c: string | undefined) => (c ? c.toUpperCase() : '')).replace(/^[^A-Za-z_]+/, '').replace(/^./, (c) => c.toUpperCase()) || 'MyNode');

/** A new script for a node: the lifecycle it will use, ready to fill in. */
export function scriptTemplate(nodeName: string, type: string): string {
  const cls = className(nodeName);
  if (isA(type, 'CharacterBody2D')) {
    return `export default class ${cls} extends ${type} {
  speed = 200;

  physicsUpdate(dt) {
    // A direction from four input actions (Project › Input map), length at most 1.
    const direction = input.vector('move_left', 'move_right', 'move_up', 'move_down');
    this.velocity = direction.scale(this.speed);
    this.moveAndSlide();
  }
}
`;
  }
  return `export default class ${cls} extends ${type} {
  ready() {
    // Runs once, when the node and its children are in the game.
  }

  update(dt) {
    // Runs every frame. dt is the time since the last frame, in seconds.
  }
}
`;
}

export class Store {
  projectId: string | null = null;
  doc: Doc | null = null;
  sceneId: string | null = null;
  selection: string[] = [];
  /** Asset bytes and loaded images, by asset id. */
  blobs = new Map<string, Blob>();
  images = new Map<string, HTMLImageElement>();
  /** Script text being edited but not yet saved, by path. */
  buffers = new Map<string, string>();
  tabs: Tab[] = [{ kind: 'scene' }];
  tab: Tab = { kind: 'scene' };
  running: { game: RunningGame; scene: string; paused: boolean; live: Record<string, unknown> | null } | null = null;
  output: OutputLine[] = [];
  snap = true;
  /** The viewport's tool: what dragging a node does (W, E, R). */
  tool: 'move' | 'rotate' | 'scale' = 'move';
  grid = 16;
  message = '';
  /** The line to show in the script editor, after clicking an error. */
  reveal: { path: string; line: number; column: number } | null = null;
  version = 0;
  private listeners = new Set<() => void>();
  private unsubDoc: (() => void) | null = null;
  private recoveryTimer: ReturnType<typeof setTimeout> | null = null;

  subscribe = (fn: () => void): (() => void) => { this.listeners.add(fn); return () => this.listeners.delete(fn); };
  getVersion = (): number => this.version;
  changed(): void { this.version++; for (const fn of this.listeners) fn(); }
  say(msg: string): void { this.message = msg; this.changed(); }

  get project(): Project | null { return this.doc?.project ?? null; }
  get scene(): SceneData | null {
    if (!this.doc || !this.sceneId) return null;
    return this.doc.project.scenes.find((s) => s.id === this.sceneId) ?? null;
  }
  /** The scene with its instances expanded (core/instances.ts): what the tree, Inspector and viewport show. */
  get expanded(): SceneData | null {
    const s = this.scene;
    if (!s || !this.doc) return null;
    const key = `${this.version}|${s.id}`;
    if (this.expandedCache.key !== key) {
      let v: SceneData;
      try { v = expandScene(this.doc.project, s); } catch { v = s; }   // a loop: the problem report says so
      this.expandedCache = { key, value: v };
    }
    return this.expandedCache.value;
  }
  private expandedCache: { key: string; value: SceneData | null } = { key: '', value: null };

  /** The selected node as shown (a node inside an instance has an id with a ":"). */
  get selected(): NodeData | null {
    const s = this.expanded;
    return s && this.selection.length ? findNode(s, this.selection[this.selection.length - 1]) ?? null : null;
  }
  get dirty(): boolean { return !!this.doc?.dirty || [...this.buffers.keys()].some((p) => this.isScriptDirty(p)); }

  // ── projects ────────────────────────────────────────────────────────────

  private attach(id: string, doc: Doc): void {
    this.unsubDoc?.();
    this.projectId = id;
    this.doc = doc;
    this.sceneId = doc.project.settings.mainScene ? sceneAt(doc.project, doc.project.settings.mainScene)!.id : doc.project.scenes[0]?.id ?? null;
    this.selection = []; this.buffers.clear(); this.tabs = [{ kind: 'scene' }]; this.tab = { kind: 'scene' }; this.output = []; this.guide = null;
    this.unsubDoc = doc.subscribe(() => {
      // Undo can remove the scene on screen or selected nodes: keep the editor's view valid.
      const scenes = doc.project.scenes;
      if (!scenes.some((s) => s.id === this.sceneId)) this.sceneId = scenes[0]?.id ?? null;
      const s = this.scene;
      // A node inside an instance (its id has a ":") is found in the expanded scene.
      let view: SceneData | null = null;
      const shown = (id: string) => { if (!id.includes(':')) return !!findNode(s!, id); try { view ??= expandScene(doc.project, s!); } catch { return false; } return !!findNode(view, id); };
      this.selection = s ? this.selection.filter(shown) : [];
      this.tabs = this.tabs.filter((t) => t.kind === 'scene' || doc.project.scripts.some((x) => x.path === t.path));
      if (this.tab.kind === 'script' && !this.tabs.some((t) => t.kind === 'script' && t.path === (this.tab as { path: string }).path)) this.tab = { kind: 'scene' };
      this.scheduleRecovery();
      this.changed();
    });
    this.changed();
  }

  newProject(name: string): void {
    const doc = new Doc(newProject(name));
    doc.markSaved();
    this.blobs.clear(); this.images.clear();
    this.attach(storage.newProjectId(), doc);
    this.say(`New project "${name}"`);
  }

  /** The example whose guide is showing, if the project came from one. */
  guide: GameExample | null = null;

  /** The API reference entry showing beside the viewport: '' for its contents, null when it is closed. */
  reference: string | null = null;

  showReference(name = ''): void { this.reference = name; this.changed(); }

  /**
   * Start a new project from an example: its images come from the starter art, then its
   * code runs as one command, so GUI → code shows exactly how it was built.
   */
  async openExample(ex: GameExample): Promise<void> {
    this.newProject(ex.title);
    for (const path of ex.images) {
      const img = starterImage(path);
      if (!img) { this.say(`The example needs ${path}, which is not in the starter art`); return; }
      if (!(await this.importStarter(path, img.url))) return;
    }
    this.act((d) => d.runCode(`Build the example "${ex.title}"`, ex.code));
    const p = this.doc!.project;
    this.sceneId = p.scenes.find((x) => x.path === p.settings.mainScene)?.id ?? p.scenes[0]?.id ?? null;
    this.selection = [];
    this.guide = ex;
    this.say(`Opened the example "${ex.title}". It is a new project: Save keeps your own copy.`);
  }

  async openProject(id: string): Promise<void> {
    const p = await storage.loadProject(id);
    const doc = new Doc(p);
    doc.markSaved();
    this.blobs.clear(); this.images.clear();
    await Promise.all(p.assets.map(async (a) => { const b = await storage.getAsset(id, a.id); if (b) this.blobs.set(a.id, b); }));
    await this.loadImages();
    this.attach(id, doc);
    this.say(`Opened "${p.name}"`);
  }

  async save(): Promise<void> {
    if (!this.doc || !this.projectId) return;
    for (const path of [...this.buffers.keys()]) if (this.isScriptDirty(path)) this.saveScript(path);
    await storage.saveProject(this.projectId, this.doc.project);
    this.doc.markSaved();
    this.say(`Saved "${this.doc.project.name}"`);
  }

  private scheduleRecovery(): void {
    if (this.recoveryTimer) clearTimeout(this.recoveryTimer);
    this.recoveryTimer = setTimeout(() => { if (this.doc && this.projectId && this.doc.dirty) void storage.saveRecovery(this.projectId, this.doc.project); }, 2000);
  }

  close(): void {
    this.stop();
    this.unsubDoc?.();
    this.doc = null; this.projectId = null; this.sceneId = null; this.selection = [];
    this.changed();
  }

  // ── scenes and nodes ────────────────────────────────────────────────────

  /** A command, with any error shown instead of thrown. */
  act<T>(fn: (doc: Doc) => T): T | undefined {
    if (!this.doc) return undefined;
    try { return fn(this.doc); }
    catch (e) { this.say(e instanceof Error ? e.message : String(e)); return undefined; }
  }

  createScene(path: string, rootType = 'Node2D'): void {
    const s = this.act((d) => d.createScene(path, rootType));
    if (s) { this.sceneId = s.id; this.selection = [s.root.id]; this.changed(); }
  }

  openScene(id: string): void { this.sceneId = id; this.selection = []; this.tab = { kind: 'scene' }; this.changed(); }

  select(ids: string[]): void {
    this.selection = ids;
    // Selecting an AnimationPlayer makes it the one the Animation panel edits.
    const n = this.selected;
    if (n?.type === 'AnimationPlayer' && this.anim.playerId !== n.id) {
      const clips = propValue(n.type, n.props, 'animations') as AnimationClip[];
      this.anim = { ...this.anim, playerId: n.id, clip: clips[0]?.name ?? '', time: 0, playing: false };
    }
    this.changed();
    if (this.running) this.inspectLive();
  }

  // ── the Animation panel ────────────────────────────────────────────────
  // While it shows an animation, the viewport and Inspector show the scene as it is at the
  // playhead, and editing a property that animation has a track for sets its key at the
  // playhead instead of the node's own value. So what you see is what you edit.

  /** The AnimationPlayer the panel edits, the animation, the playhead in seconds, and whether it is previewing. */
  anim: { open: boolean; playerId: string | null; clip: string; time: number; playing: boolean } = { open: false, playerId: null, clip: '', time: 0, playing: false };
  /** A drag of an animated property: its value while dragging, before it becomes a key. */
  animDrag: { id: string; prop: string; value: PropValue } | null = null;

  get animPlayer(): NodeData | null {
    const s = this.expanded;
    const n = s && this.anim.playerId ? findNode(s, this.anim.playerId) : undefined;
    return n?.type === 'AnimationPlayer' ? n : null;
  }
  get animClips(): AnimationClip[] { const n = this.animPlayer; return n ? propValue(n.type, n.props, 'animations') as AnimationClip[] : []; }
  /** The animation the panel is showing, when it is open and the game is not running. */
  get animClip(): AnimationClip | null {
    if (!this.anim.open || this.running) return null;
    return this.animClips.find((c) => c.name === this.anim.clip) ?? null;
  }

  /** The scene as the viewport shows it: with the panel's animation applied at the playhead, and a brush stroke in progress. */
  get viewScene(): SceneData | null {
    const s = this.expanded, c = this.animClip;
    if (!s || ((!c || !this.anim.playerId) && !this.tileStroke && !this.animDrag)) return s;
    let v = c && this.anim.playerId ? applyClip(s, this.anim.playerId, c, this.anim.time) : JSON.parse(JSON.stringify(s)) as SceneData;
    if (this.animDrag) { const n = findNode(v, this.animDrag.id); if (n) n.props[this.animDrag.prop] = this.animDrag.value; }
    if (this.tileStroke) { const n = findNode(v, this.tileStroke.layerId); if (n) n.props.cells = applyEdits(propValue(n.type, n.props, 'cells') as number[], this.tileStroke.edits); }
    return v;
  }

  // ── the TileMap panel ──────────────────────────────────────────────────
  // While it is open and a TileMapLayer is selected, the viewport paints that layer with the
  // tool and tile chosen here, instead of selecting and moving nodes.

  tile: { open: boolean; tool: 'paint' | 'erase' | 'rect' | 'bucket' | 'pick'; tileId: number; collision: boolean } = { open: false, tool: 'paint', tileId: 0, collision: false };
  /** A brush stroke being made: shown in the viewport, committed as one command when the button comes up. */
  tileStroke: { layerId: string; edits: CellEdit[] } | null = null;

  /** The layer being painted, when the panel is open and the game is not running. */
  get tileLayer(): NodeData | null {
    const n = this.selected;
    return this.tile.open && !this.running && n?.type === 'TileMapLayer' ? n : null;
  }

  /** A tileset and the grid its image makes, or null when there is no such tileset. */
  tilesetInfo(path: string | null): { data: TilesetData; columns: number; rows: number; count: number } | null {
    const p = this.project, ts = path ? p?.tilesets?.find((t) => t.path === path) : undefined;
    if (!p || !ts) return null;
    const a = p.assets.find((x) => x.path === ts.image);
    return { data: ts, ...(a ? tilesetGrid(ts, a.width, a.height) : { columns: 0, rows: 0, count: 0 }) };
  }

  /** End a brush stroke: its edits (the last for each cell wins) as one command. */
  commitStroke(label = 'Paint tiles'): void {
    const st = this.tileStroke, s = this.scene;
    this.tileStroke = null;
    if (!st || !s || !st.edits.length) { this.changed(); return; }
    const last = new Map<string, CellEdit>();
    for (const e of st.edits) last.set(`${e[0]},${e[1]}`, e);
    this.act((d) => d.paintCells(s.id, st.layerId, [...last.values()], label));
  }

  /** Whether the panel's animation has a track for this node's property. */
  isAnimated(nodeId: string, prop: string): boolean {
    const s = this.expanded, c = this.animClip;
    if (!s || !c || !this.anim.playerId) return false;
    const path = trackPath(s, this.anim.playerId, nodeId);
    return path !== null && c.tracks.some((t) => t.path === path && t.property === prop);
  }

  /** Set a key at the playhead for a node's property (adding the track if needed), as one command. */
  setKeyAt(nodeId: string, prop: string, value: PropValue, label?: string): void {
    const s = this.scene, player = this.animPlayer, c = this.animClip;
    if (!s || !player || !c) return;
    const path = trackPath(this.expanded!, player.id, nodeId);
    if (path === null) { this.say('Only nodes under the AnimationPlayer\u2019s parent can be animated by it'); return; }
    const time = +this.anim.time.toFixed(4);
    const clips = setKey(this.animClips, c.name, path, prop, time, value as never);
    this.act((d) => d.setProp(s.id, player.id, 'animations', clips, label ?? `Key ${path}.${prop} at ${time} s`));
  }

  /** Change a node's property from the editor: its key at the playhead if the panel's animation animates it, else the node's own value. */
  setNodeProp(nodeId: string, prop: string, value: PropValue, label?: string): void {
    const s = this.scene;
    if (!s) return;
    if (this.isAnimated(nodeId, prop)) this.setKeyAt(nodeId, prop, value, label);
    else this.act((d) => d.setProp(s.id, nodeId, prop, value, label));
  }

  /** A drag in the viewport, as it goes: an animated property is held aside until the drag ends. */
  liveEdit(nodeId: string, prop: string, value: PropValue): void {
    if (this.isAnimated(nodeId, prop)) { this.animDrag = { id: nodeId, prop, value }; this.changed(); return; }
    this.doc!.beginLive();
    this.doc!.liveProp(this.sceneId!, nodeId, prop, value);
  }

  /** The end of a drag: one command, a key or the node's own value. */
  endLiveEdit(label: string, nodeId: string, prop: string): void {
    const held = this.animDrag;
    if (held) { this.animDrag = null; this.setKeyAt(nodeId, prop, held.value, label); this.changed(); return; }
    if (this.doc && this.sceneId) this.doc.endLive(label, this.sceneId, nodeId, [prop]);
  }

  /** Put an instance of another scene under the selected node (or the root), and select it. */
  addInstance(source: string): void {
    const s = this.scene;
    if (!s) return;
    const sel = this.selected, parent = sel && !sel.inherited ? sel.id : s.root.id;
    const n = this.act((d) => d.addInstance(s.id, source, parent));
    if (n) { this.select([n.id]); this.say(`Added an instance of ${source}`); }
  }

  /** Add a node under the selected one (or the root). */
  addNode(type: string, opts: { parentId?: string; name?: string; props?: Record<string, unknown> } = {}): NodeData | undefined {
    const s = this.scene;
    if (!s) { this.say('Create a scene first'); return undefined; }
    const parentId = opts.parentId ?? this.selected?.id ?? s.root.id;
    const n = this.act((d) => d.addNode(s.id, type, parentId, { name: opts.name, props: opts.props as never }));
    if (n) this.select([n.id]);
    return n;
  }

  // ── assets ──────────────────────────────────────────────────────────────

  /** Import an image file the user chose. */
  async importImage(file: File): Promise<string | undefined> {
    if (!this.doc) return undefined;
    const base = file.name.toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+/, '') || 'image.png';
    let path = `assets/${base}`, k = 2;
    while (this.doc.project.assets.some((a) => a.path === path)) path = `assets/${base.replace(/(\.[^.]+)$/, `-${k++}$1`)}`;
    return this.addImage(path, file);
  }

  /**
   * Import files chosen together: images first, then Tiled maps (.tmx, .tmj), each using any
   * tileset files (.tsx, .tsj) chosen with it. A map becomes one command in the scene being edited.
   */
  async importFiles(files: File[]): Promise<void> {
    const isMap = (f: File) => /\.(tmx|tmj)$/i.test(f.name), isTileset = (f: File) => /\.(tsx|tsj)$/i.test(f.name);
    for (const f of files) if (!isMap(f) && !isTileset(f)) await this.importImage(f);
    const tilesets = new Map<string, string>();
    for (const f of files.filter(isTileset)) tilesets.set(f.name, await f.text());
    for (const f of files.filter(isMap)) this.importTiledMap(f.name, await f.text(), tilesets);
  }

  /** Import a Tiled map into the scene being edited (or a new scene named after it). Says what it made, or what to do. */
  importTiledMap(name: string, text: string, tilesetFiles: Map<string, string>): boolean {
    if (!this.doc) return false;
    try {
      const map = readMap(text);
      if (!this.scene) this.createScene(`scenes/${name.replace(/\.[^.]+$/, '').replace(/[^A-Za-z0-9_-]+/g, '_') || 'map'}.scene`);
      const s = this.scene!, before = new Set(s.root.children.map((c) => c.id));
      const p = this.doc.project;
      const plan = planImport(map, name, { tilesetFiles, findImage: (img) => matchImage(img, p.assets.map((a) => a.path)), existing: new Set((p.tilesets ?? []).map((t) => t.path)), scenePath: s.path });
      this.doc.runCode(`Import ${name}`, plan.code);
      const added = this.scene!.root.children.filter((c) => !before.has(c.id)).map((c) => c.id);
      if (added.length) this.select([added[0]]);
      this.say(`Imported ${name}: ${plan.notes.join('; ')}`);
      return true;
    } catch (e) {
      this.say(`Could not import ${name}: ${e instanceof Error ? e.message : String(e)}`);
      return false;
    }
  }

  /** Open a Tiled sample map from the starter art: its images are added first, then the map is imported. */
  async importStarterMap(map: StarterMap): Promise<boolean> {
    for (const img of map.images) if (!(await this.importStarter(img.path, img.url))) return false;
    return this.importTiledMap(map.name, map.text, map.tilesets);
  }

  /** Add an image from the starter art. If the project already has it, that is used. */
  async importStarter(path: string, url: string): Promise<string | undefined> {
    if (!this.doc) return undefined;
    if (this.doc.project.assets.some((a) => a.path === path)) return path;
    try { return await this.addImage(path, await (await fetch(url)).blob()); }
    catch (e) { this.say(e instanceof Error ? e.message : String(e)); return undefined; }
  }

  /** Check an image loads, record it in the project (a command), and store its bytes. */
  private async addImage(path: string, blob: Blob): Promise<string | undefined> {
    if (!this.doc || !this.projectId) return undefined;
    const url = URL.createObjectURL(blob);
    try {
      const img = await new Promise<HTMLImageElement>((ok, bad) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => bad(new Error(`${path} is not an image this browser can read`)); i.src = url; });
      const id = this.act((d) => d.importAsset(path, { mime: blob.type || 'image/png', width: img.naturalWidth, height: img.naturalHeight }));
      if (!id) { URL.revokeObjectURL(url); return undefined; }
      this.blobs.set(id, blob);
      this.images.set(id, img);
      await storage.putAsset(this.projectId, id, blob);
      this.say(`Imported ${path} (${img.naturalWidth} × ${img.naturalHeight})`);
      return path;
    } catch (e) {
      URL.revokeObjectURL(url);
      this.say(e instanceof Error ? e.message : String(e));
      return undefined;
    }
  }

  private async loadImages(): Promise<void> {
    await Promise.all([...this.blobs].map(([id, blob]) => new Promise<void>((ok) => {
      const i = new Image(); i.onload = () => { this.images.set(id, i); ok(); }; i.onerror = () => ok(); i.src = URL.createObjectURL(blob);
    })));
  }

  imageFor(path: string | null): HTMLImageElement | undefined {
    const a = path ? this.doc?.project.assets.find((x) => x.path === path) : undefined;
    return a ? this.images.get(a.id) : undefined;
  }

  // ── scripts ─────────────────────────────────────────────────────────────

  scriptText(path: string): string { return this.buffers.get(path) ?? this.doc?.project.scripts.find((s) => s.path === path)?.source ?? ''; }
  isScriptDirty(path: string): boolean {
    const b = this.buffers.get(path);
    return b !== undefined && b !== this.doc?.project.scripts.find((s) => s.path === path)?.source;
  }
  editScript(path: string, text: string): void { this.buffers.set(path, text); this.changed(); }
  saveScript(path: string): void {
    const b = this.buffers.get(path);
    if (b === undefined || !this.isScriptDirty(path)) return;
    this.act((d) => d.writeScript(path, b));
    this.buffers.delete(path);
    this.changed();
  }

  openScript(path: string, reveal?: { line: number; column: number }): void {
    if (!this.tabs.some((t) => t.kind === 'script' && t.path === path)) this.tabs.push({ kind: 'script', path });
    this.tab = { kind: 'script', path };
    this.reveal = reveal ? { path, ...reveal } : null;
    this.changed();
  }
  closeTab(path: string): void {
    this.tabs = this.tabs.filter((t) => !(t.kind === 'script' && t.path === path));
    if (this.tab.kind === 'script' && this.tab.path === path) this.tab = { kind: 'scene' };
    this.changed();
  }

  /** Make a new script for the selected node from the template, attach it, and open it. */
  newScriptFor(nodeId: string): void {
    const s = this.scene, n = s && findNode(s, nodeId);
    if (!s || !n || !this.doc) return;
    const stem = n.name.replace(/([a-z])([A-Z])/g, '$1_$2').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'script';
    let path = `scripts/${stem}.js`, k = 2;
    while (this.doc.project.scripts.some((x) => x.path === path)) path = `scripts/${stem}_${k++}.js`;
    this.act((d) => { d.writeScript(path, scriptTemplate(n.name, n.type), `New script ${path}`); d.setScript(s.id, nodeId, path); });
    this.openScript(path);
  }

  // ── running ─────────────────────────────────────────────────────────────

  async run(which: 'project' | 'scene', container: HTMLElement): Promise<void> {
    if (!this.doc) return;
    // Scripts are saved into the project before running, so the game runs what you see.
    for (const path of [...this.buffers.keys()]) if (this.isScriptDirty(path)) this.saveScript(path);
    const p = this.doc.project;
    const scene = which === 'project' ? p.settings.mainScene : this.scene?.path;
    if (!scene) { this.say(which === 'project' ? 'Set a main scene first (Project settings)' : 'Open a scene first'); return; }
    this.stop();
    // A script that does not parse would stop the game from loading: say where, and do not start.
    const syntax = checkSyntax(p.scripts);
    if (syntax.length) {
      this.output = [{ level: 'system', text: `Not running: ${syntax.length} script${syntax.length === 1 ? ' has a' : 's have'} syntax error${syntax.length === 1 ? '' : 's'}` },
        ...syntax.map((e) => ({ level: 'error' as const, text: e.message, file: e.file, line: e.line, column: e.column }))];
      this.say('Fix the syntax error first: click it in Output to go to it');
      return;
    }
    this.output = [{ level: 'system', text: `▶ Running ${scene}` }];
    const assets = await Promise.all(p.assets.map(async (a) => ({ path: a.path, mime: a.mime, bytes: await (this.blobs.get(a.id) ?? new Blob()).arrayBuffer() })));
    const game = await runGame({ project: p, scene, assets, container, onMessage: (m) => this.onRuntime(m) });
    this.running = { game, scene, paused: false, live: null };
    this.changed();
    game.frame.focus();
  }

  private onRuntime(m: FromRuntime): void {
    if (!this.running) return;
    if (m.type === 'log') this.output.push({ level: m.level, text: m.text });
    else if (m.type === 'error') this.output.push({ level: 'error', text: m.message, file: m.file, line: m.line, column: m.column, node: m.node });
    else if (m.type === 'paused') this.running.paused = m.paused;
    else if (m.type === 'state') this.running.live = m.props;
    else if (m.type === 'running') this.inspectLive();
    if (this.output.length > 500) this.output.splice(0, this.output.length - 500);
    this.changed();
  }

  private inspectLive(): void {
    const s = this.expanded, n = this.selected;   // the running game's tree has instances expanded too
    if (this.running && s && n) this.running.game.send({ type: 'inspect', path: pathOf(s, n.id) });
  }
  /** Ask the running game for the selected node's live values (the Inspector polls this). */
  refreshLive(): void { this.inspectLive(); }

  pause(): void { if (this.running) this.running.game.send({ type: this.running.paused ? 'resume' : 'pause' }); }
  restart(): void { if (this.running) { this.output.push({ level: 'system', text: '↻ Restart' }); this.running.game.send({ type: 'restart' }); this.changed(); } }
  stop(): void {
    if (!this.running) return;
    this.running.game.stop();
    this.running = null;
    this.output.push({ level: 'system', text: '■ Stopped' });
    this.changed();
  }
}
