// The Scene API at edit time: the calls the GUI → code log shows (ADR 8).
//
//   project.createScene('scenes/main.scene', 'Node2D', 'Main')
//   scene = project.scene('scenes/main.scene')
//   scene.add('Sprite2D', { name: 'Player', position: { x: 200, y: 150 }, texture: 'assets/player.png' })
//   scene.get('Player').position = { x: 240, y: 150 }
//
// The names and property paths are the runtime Game API's, so a line learned from
// the log works in a script. Every function here changes the project directly and
// checks its arguments; the editor's commands (core/doc.ts) call these same
// functions, which is why replaying the log gives the same project.

import type { AssetData, NodeData, Project, PropValue, SceneData, Vec2 } from './types';
import { checkProp, isNodeType, nodeType, propDef, propsOf, propValue } from './registry';
import { checkName, cloneWithNewIds, contains, findNode, newNode, nextId, nodeAt, parentOf, pathOf, sceneAt, uniqueName } from './project';

const same = (a: PropValue, b: PropValue) => JSON.stringify(a) === JSON.stringify(b);

// ── changes, by id (what commands use) ───────────────────────────────────

export function setProp(scene: SceneData, id: string, name: string, value: PropValue): void {
  const n = findNode(scene, id);
  if (!n) throw new Error(`No node ${id}`);
  const def = propDef(n.type, name);
  if (!def) throw new Error(`${n.type} has no property "${name}"`);
  const bad = checkProp(def, value);
  if (bad) throw new Error(bad);
  const v = value && typeof value === 'object' ? { ...(value as Vec2) } : value;
  if (same(v, def.default)) delete n.props[name]; else n.props[name] = v;
}

export function rename(scene: SceneData, id: string, wanted: string): string {
  const bad = checkName(wanted);
  if (bad) throw new Error(bad);
  const n = findNode(scene, id)!, parent = parentOf(scene, id);
  n.name = parent ? uniqueName(parent.children, wanted, id) : wanted;
  return n.name;
}

export function addNode(p: Project, scene: SceneData, type: string, opts: { name?: string; parent?: string; index?: number; script?: string | null; props?: Record<string, PropValue> } = {}): NodeData {
  if (!isNodeType(type) || !nodeType(type).addable) throw new Error(`Unknown node type "${type}"`);
  const parent = opts.parent === undefined ? scene.root : findNode(scene, opts.parent);
  if (!parent) throw new Error('No such parent');
  const n = newNode(p, type, uniqueName(parent.children, opts.name ?? type));
  const nameBad = checkName(n.name);
  if (nameBad) throw new Error(nameBad);
  parent.children.splice(opts.index ?? parent.children.length, 0, n);
  for (const [k, v] of Object.entries(opts.props ?? {})) setProp(scene, n.id, k, v);
  if (opts.script !== undefined) setScript(p, scene, n.id, opts.script);
  return n;
}

export function deleteNode(scene: SceneData, id: string): void {
  if (id === scene.root.id) throw new Error('The root of a scene cannot be deleted');
  const parent = parentOf(scene, id)!;
  parent.children = parent.children.filter((c) => c.id !== id);
}

export function reparent(scene: SceneData, id: string, newParentId: string, index?: number): void {
  if (id === scene.root.id) throw new Error('The root of a scene cannot be moved');
  const n = findNode(scene, id)!, to = findNode(scene, newParentId);
  if (!to) throw new Error('No such parent');
  if (contains(n, newParentId)) throw new Error('A node cannot become a child of itself or of its own children');
  const from = parentOf(scene, id)!;
  const at = from.children.indexOf(n);
  from.children.splice(at, 1);
  let i = index ?? to.children.length;
  if (from === to && index !== undefined && index > at) i--;
  n.name = uniqueName(to.children, n.name);
  to.children.splice(Math.max(0, Math.min(i, to.children.length)), 0, n);
}

export function duplicate(p: Project, scene: SceneData, id: string): NodeData {
  if (id === scene.root.id) throw new Error('The root of a scene cannot be duplicated');
  const n = findNode(scene, id)!, parent = parentOf(scene, id)!;
  const copy = cloneWithNewIds(p, n);
  copy.name = uniqueName(parent.children, n.name);
  parent.children.splice(parent.children.indexOf(n) + 1, 0, copy);
  return copy;
}

export function setScript(p: Project, scene: SceneData, id: string, path: string | null): void {
  if (path !== null && !p.scripts.some((s) => s.path === path)) throw new Error(`No script "${path}" in the project`);
  findNode(scene, id)!.script = path;
}

// ── handles: the API as the log and a script write it ────────────────────

export interface NodeHandle {
  readonly id: string;
  readonly type: string;
  readonly path: string;
  name: string;
  script: string | null;
  readonly children: NodeHandle[];
  get(path: string): NodeHandle;
  reparent(parentPath: string, index?: number): void;
  delete(): void;
  duplicate(): NodeHandle;
  [prop: string]: unknown;
}

function nodeHandle(p: Project, scene: SceneData, id: string): NodeHandle {
  const n = () => { const x = findNode(scene, id); if (!x) throw new Error(`That node was deleted`); return x; };
  const h: Record<string, unknown> = {};
  Object.defineProperties(h, {
    id: { get: () => id, enumerable: true },
    type: { get: () => n().type, enumerable: true },
    path: { get: () => pathOf(scene, id), enumerable: true },
    name: { get: () => n().name, set: (v: string) => { rename(scene, id, String(v)); }, enumerable: true },
    script: { get: () => n().script, set: (v: string | null) => setScript(p, scene, id, v), enumerable: true },
    children: { get: () => n().children.map((c) => nodeHandle(p, scene, c.id)) },
    get: { value: (path: string) => sceneHandle(p, scene).get(pathOf(scene, id) === '.' ? path : `${pathOf(scene, id)}/${path}`) },
    reparent: { value: (parentPath: string, index?: number) => { const to = nodeAt(scene, parentPath); if (!to) throw new Error(`No node at "${parentPath}"`); reparent(scene, id, to.id, index); } },
    delete: { value: () => deleteNode(scene, id) },
    duplicate: { value: () => nodeHandle(p, scene, duplicate(p, scene, id).id) },
  });
  for (const def of propsOf(n().type)) {
    Object.defineProperty(h, def.name, {
      get: () => propValue(n().type, n().props, def.name),
      set: (v: PropValue) => setProp(scene, id, def.name, v),
      enumerable: true,
    });
  }
  return h as NodeHandle;
}

export interface SceneHandle {
  readonly path: string;
  readonly root: NodeHandle;
  get(path: string): NodeHandle;
  add(type: string, opts?: Record<string, unknown>): NodeHandle;
}

function sceneHandle(p: Project, scene: SceneData): SceneHandle {
  return {
    get path() { return scene.path; },
    get root() { return nodeHandle(p, scene, scene.root.id); },
    get(path: string) {
      const n = nodeAt(scene, path);
      if (!n) throw new Error(`No node at "${path}" in ${scene.path}`);
      return nodeHandle(p, scene, n.id);
    },
    /** add(type, { name, parent: 'Path/To/Parent', index, script, ...properties }) */
    add(type: string, opts: Record<string, unknown> = {}) {
      const { name, parent, index, script, ...props } = opts;
      const parentNode = parent === undefined || parent === '.' ? scene.root : nodeAt(scene, String(parent));
      if (!parentNode) throw new Error(`No node at "${parent}"`);
      const n = addNode(p, scene, type, { name: name as string | undefined, parent: parentNode.id, index: index as number | undefined, script: script as string | null | undefined, props: props as Record<string, PropValue> });
      return nodeHandle(p, scene, n.id);
    },
  };
}

export interface SettingsPatch { width?: number; height?: number; background?: string; pixelArt?: boolean }

export interface ProjectApi {
  name: string;
  /** Change the game's size or background: setSettings({ width: 640, height: 360 }). */
  setSettings(patch: SettingsPatch): void;
  createScene(path: string, rootType?: string, rootName?: string): SceneHandle;
  scene(path: string): SceneHandle;
  setMainScene(path: string): void;
  writeScript(path: string, source: string): void;
  addAction(name: string, keys: string[]): void;
  setActionKeys(name: string, keys: string[]): void;
  removeAction(name: string): void;
  /** Records an imported file. Its bytes are stored separately, under the returned id. */
  importAsset(path: string, info: { kind?: 'image'; mime: string; width: number; height: number }): string;
}

export function checkProjectPath(path: string, folder: string, ext: RegExp): string | null {
  if (!path.startsWith(`${folder}/`)) return `"${path}" must be in ${folder}/`;
  if (!ext.test(path)) return `"${path}" has the wrong extension`;
  if (/[^A-Za-z0-9_\-./]/.test(path) || path.includes('..') || path.includes('//')) return `"${path}": use letters, digits, - _ . and / only`;
  return null;
}

export function projectApi(p: Project): ProjectApi {
  return {
    get name() { return p.name; },
    set name(v: string) { if (!String(v).trim()) throw new Error('A project needs a name'); p.name = String(v).trim(); },
    setSettings(patch) {
      for (const k of Object.keys(patch)) if (!['width', 'height', 'background', 'pixelArt'].includes(k)) throw new Error(`There is no setting "${k}"`);
      for (const k of ['width', 'height'] as const) {
        const v = patch[k];
        if (v !== undefined && !(Number.isInteger(v) && v >= 64 && v <= 4096)) throw new Error(`${k} must be a whole number of pixels from 64 to 4096`);
      }
      if (patch.background !== undefined && !/^#[0-9a-f]{6}$/i.test(patch.background)) throw new Error('background must be a colour like "#1d2330"');
      if (patch.pixelArt !== undefined && typeof patch.pixelArt !== 'boolean') throw new Error('pixelArt must be true or false');
      Object.assign(p.settings, patch);
    },
    createScene(path, rootType = 'Node2D', rootName) {
      const bad = checkProjectPath(path, 'scenes', /\.scene$/);
      if (bad) throw new Error(bad);
      if (sceneAt(p, path)) throw new Error(`There is already a scene at "${path}"`);
      const name = rootName ?? path.split('/').pop()!.replace(/\.scene$/, '').replace(/^./, (c) => c.toUpperCase());
      const scene: SceneData = { id: nextId(p, 's'), path, root: newNode(p, rootType, name) };
      p.scenes.push(scene);
      if (!p.settings.mainScene) p.settings.mainScene = path;
      return sceneHandle(p, scene);
    },
    scene(path) {
      const s = sceneAt(p, path);
      if (!s) throw new Error(`No scene at "${path}"`);
      return sceneHandle(p, s);
    },
    setMainScene(path) {
      if (!sceneAt(p, path)) throw new Error(`No scene at "${path}"`);
      p.settings.mainScene = path;
    },
    writeScript(path, source) {
      const bad = checkProjectPath(path, 'scripts', /\.js$/);
      if (bad) throw new Error(bad);
      const s = p.scripts.find((x) => x.path === path);
      if (s) s.source = String(source); else p.scripts.push({ path, source: String(source) });
    },
    addAction(name, keys) {
      if (!/^[a-z][a-z0-9_]*$/.test(name)) throw new Error('Action names are lower_case_with_underscores');
      if (p.input.some((a) => a.name === name)) throw new Error(`There is already an action "${name}"`);
      p.input.push({ name, keys: [...keys] });
    },
    setActionKeys(name, keys) {
      const a = p.input.find((x) => x.name === name);
      if (!a) throw new Error(`No action "${name}"`);
      a.keys = [...keys];
    },
    removeAction(name) {
      p.input = p.input.filter((a) => a.name !== name);
    },
    importAsset(path, info) {
      const bad = checkProjectPath(path, 'assets', /\.(png|jpe?g|webp|gif)$/i);
      if (bad) throw new Error(bad);
      if (p.assets.some((a) => a.path === path)) throw new Error(`There is already an asset at "${path}"`);
      const a: AssetData = { id: nextId(p, 'a'), path, kind: info.kind ?? 'image', mime: info.mime, width: info.width, height: info.height };
      p.assets.push(a);
      return a.id;
    },
  };
}

/**
 * Run code written against the Scene API (the GUI → code log, or a user's
 * snippet) on a project. `scene` starts as the main scene, if there is one.
 */
export function runSceneCode(p: Project, code: string): void {
  const project = projectApi(p);
  // eslint-disable-next-line no-new-func
  new Function('project', 'initialScene', `"use strict";\nlet scene = initialScene;\n${code}`)(project, p.settings.mainScene ? project.scene(p.settings.mainScene) : undefined);
}
