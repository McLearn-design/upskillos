// Scenes used inside other scenes (the specification's §41), as in Godot.
//
// A node with `instance: "scenes/coin.scene"` is an instance of that scene: its type, properties,
// script, groups, connections and children come from the source scene's root, so editing the
// source changes every instance. What is saved on the instance node is only what differs:
//   - its own props (overriding the source root's), name, groups and connections added to the source's;
//   - `overrides`: changed properties of nodes inside the instance, by their path from it
//     ("Sprite", "Body/Shape");
//   - children added under it in this scene, after the source's.
//
// expandScene builds the whole tree, instances replaced by their contents, as the engine runs it
// and the editor shows it. A node that comes from an instance gets the id "<instance id>:<id in
// the source>", so it is stable, and `inherited`, saying which instance and where in it. Those
// nodes are not saved; editing one writes an override on its instance.

import type { NodeData, Project, SceneData } from './types';

/** A scene's tree with every instance expanded. Throws if a scene contains itself, naming the loop. */
export function expandScene(p: Project, scene: SceneData): SceneData {
  return { ...scene, root: expandNode(p, scene.root, [scene.path]) };
}

/** A scene's root expanded as it would be when instanced: what scene.instantiate() makes. */
export function expandSceneRoot(p: Project, path: string): NodeData {
  const s = p.scenes.find((x) => x.path === path);
  if (!s) throw new Error(`There is no scene "${path}"`);
  return expandNode(p, s.root, [path]);
}

function expandNode(p: Project, n: NodeData, chain: string[]): NodeData {
  const kids = (list: NodeData[]) => list.map((c) => expandNode(p, c, chain));
  if (!n.instance) return { ...n, children: kids(n.children) };
  if (chain.includes(n.instance)) throw new Error(`Scenes inside each other in a loop: ${[...chain, n.instance].join(' → ')}`);
  const src = p.scenes.find((s) => s.path === n.instance);
  if (!src) return { ...n, children: kids(n.children) };   // the problem report names the missing scene
  const root = expandNode(p, src.root, [...chain, n.instance]);
  const remap = (id: string) => (id === root.id ? n.id : `${n.id}:${id}`);
  const inherit = (m: NodeData, path: string): NodeData => ({
    ...m,
    id: `${n.id}:${m.id}`,
    props: { ...m.props, ...(n.overrides?.[path] ?? {}) },
    ...(m.connections ? { connections: m.connections.map((c) => ({ ...c, target: remap(c.target) })) } : {}),
    inherited: { instance: n.id, path },
    children: m.children.map((c) => inherit(c, `${path}/${c.name}`)),
  });
  const groups = [...new Set([...(root.groups ?? []), ...(n.groups ?? [])])];
  const connections = [...(root.connections ?? []).map((c) => ({ ...c, target: remap(c.target) })), ...(n.connections ?? [])];
  return {
    ...n,
    type: root.type,
    props: { ...root.props, ...n.props },
    script: n.script ?? root.script,
    ...(groups.length ? { groups } : {}),
    ...(connections.length ? { connections } : {}),
    children: [...root.children.map((c) => inherit(c, c.name)), ...kids(n.children)],
  };
}

/** The scenes a scene uses as instances, directly or through others. */
export function scenesUsedBy(p: Project, path: string, seen = new Set<string>()): Set<string> {
  const s = p.scenes.find((x) => x.path === path);
  if (!s) return seen;
  const visit = (n: NodeData) => { if (n.instance && !seen.has(n.instance)) { seen.add(n.instance); scenesUsedBy(p, n.instance, seen); } n.children.forEach(visit); };
  visit(s.root);
  return seen;
}

/** Whether putting an instance of `source` into `target` would make a scene contain itself. */
export function wouldLoop(p: Project, target: string, source: string): boolean {
  return source === target || scenesUsedBy(p, source).has(target);
}
