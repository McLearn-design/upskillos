// Building and walking the project model.

import { FORMAT_VERSION, type NodeData, type Project, type SceneData } from './types';
import { isNodeType } from './registry';

export function newProject(name = 'My Game'): Project {
  return {
    formatVersion: FORMAT_VERSION,
    name,
    nextId: 1,
    settings: { width: 960, height: 540, background: '#1d2330', mainScene: null },
    input: [
      { name: 'move_left', keys: ['ArrowLeft', 'KeyA'] },
      { name: 'move_right', keys: ['ArrowRight', 'KeyD'] },
      { name: 'move_up', keys: ['ArrowUp', 'KeyW'] },
      { name: 'move_down', keys: ['ArrowDown', 'KeyS'] },
      { name: 'jump', keys: ['Space'] },
    ],
    scenes: [],
    scripts: [],
    assets: [],
  };
}

/** A fresh id. Ids come from a counter in the project, so replaying the same commands gives the same ids. */
export function nextId(p: Project, prefix: string): string {
  return `${prefix}${p.nextId++}`;
}

export function newNode(p: Project, type: string, name: string): NodeData {
  if (!isNodeType(type)) throw new Error(`Unknown node type "${type}"`);
  return { id: nextId(p, 'n'), type, name, props: {}, script: null, children: [] };
}

// ── names and paths ──────────────────────────────────────────────────────

/** A name a node can have: not empty, no "/", not "." (those mean something in paths). */
export function checkName(name: string): string | null {
  if (!name.trim()) return 'A name cannot be empty';
  if (name.includes('/')) return 'A name cannot contain "/": it separates names in a path';
  if (name === '.' || name === '..') return `"${name}" is reserved for paths`;
  return null;
}

/** `wanted`, or `wanted2`, `wanted3`… so it differs from every sibling's name. */
export function uniqueName(siblings: NodeData[], wanted: string, except?: string): string {
  const taken = new Set(siblings.filter((s) => s.id !== except).map((s) => s.name));
  if (!taken.has(wanted)) return wanted;
  const base = wanted.replace(/\d+$/, '') || wanted;
  for (let i = 2; ; i++) if (!taken.has(`${base}${i}`)) return `${base}${i}`;
}

// ── walking the tree ─────────────────────────────────────────────────────

export function* walk(node: NodeData): Generator<NodeData> {
  yield node;
  for (const c of node.children) yield* walk(c);
}

export function findNode(scene: SceneData, id: string): NodeData | undefined {
  for (const n of walk(scene.root)) if (n.id === id) return n;
  return undefined;
}

export function parentOf(scene: SceneData, id: string): NodeData | undefined {
  for (const n of walk(scene.root)) if (n.children.some((c) => c.id === id)) return n;
  return undefined;
}

/** The path from the scene's root: "." is the root, "Player/Sprite" is a grandchild. */
export function pathOf(scene: SceneData, id: string): string {
  if (scene.root.id === id) return '.';
  const names: string[] = [];
  let cur = findNode(scene, id);
  while (cur && cur.id !== scene.root.id) {
    names.unshift(cur.name);
    cur = parentOf(scene, cur.id);
  }
  if (!cur) throw new Error(`No node ${id} in ${scene.path}`);
  return names.join('/');
}

export function nodeAt(scene: SceneData, path: string): NodeData | undefined {
  if (path === '.' || path === '') return scene.root;
  let cur: NodeData | undefined = scene.root;
  for (const name of path.split('/')) {
    cur = cur?.children.find((c) => c.name === name);
    if (!cur) return undefined;
  }
  return cur;
}

/** Whether `ancestor` is `node` or contains it: a node cannot become a child of itself or of its own descendants. */
export function contains(ancestor: NodeData, nodeId: string): boolean {
  for (const n of walk(ancestor)) if (n.id === nodeId) return true;
  return false;
}

export function sceneAt(p: Project, path: string): SceneData | undefined {
  return p.scenes.find((s) => s.path === path);
}

/** A deep copy with fresh ids for every node, for duplicating and pasting. */
export function cloneWithNewIds(p: Project, node: NodeData): NodeData {
  return { ...node, id: nextId(p, 'n'), props: structuredClone(node.props), children: node.children.map((c) => cloneWithNewIds(p, c)) };
}
