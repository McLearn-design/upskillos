// The editor's state (ADR 2): the open project (a Doc, which owns the project and its
// history), plus what is only about editing: the scene on screen, the selection,
// unsaved script text, the running game and its output. React components read this
// and call its methods; none of them owns project data.

import { Doc } from '../core/doc';
import { newProject, pathOf, sceneAt, findNode } from '../core/project';
import type { NodeData, Project, SceneData } from '../core/types';
import { isA } from '../core/registry';
import type { FromRuntime } from '../runtime/protocol';
import { runGame, type RunningGame } from './runner';
import { checkSyntax } from '../runtime/scripts';
import * as storage from './storage';

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
  get selected(): NodeData | null {
    const s = this.scene;
    return s && this.selection.length ? findNode(s, this.selection[this.selection.length - 1]) ?? null : null;
  }
  get dirty(): boolean { return !!this.doc?.dirty || [...this.buffers.keys()].some((p) => this.isScriptDirty(p)); }

  // ── projects ────────────────────────────────────────────────────────────

  private attach(id: string, doc: Doc): void {
    this.unsubDoc?.();
    this.projectId = id;
    this.doc = doc;
    this.sceneId = doc.project.settings.mainScene ? sceneAt(doc.project, doc.project.settings.mainScene)!.id : doc.project.scenes[0]?.id ?? null;
    this.selection = []; this.buffers.clear(); this.tabs = [{ kind: 'scene' }]; this.tab = { kind: 'scene' }; this.output = [];
    this.unsubDoc = doc.subscribe(() => {
      // Undo can remove the scene on screen or selected nodes: keep the editor's view valid.
      const scenes = doc.project.scenes;
      if (!scenes.some((s) => s.id === this.sceneId)) this.sceneId = scenes[0]?.id ?? null;
      const s = this.scene;
      this.selection = s ? this.selection.filter((id) => findNode(s, id)) : [];
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

  select(ids: string[]): void { this.selection = ids; this.changed(); if (this.running) this.inspectLive(); }

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
    const s = this.scene, n = this.selected;
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
