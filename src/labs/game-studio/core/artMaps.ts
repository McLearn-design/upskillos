// Maps to and from Tile Mapper (src/labs/tile-mapper), which hands them over in the page
// (src/utils/artBridge.js), not as files.
//
// In Game Studio a map is TileMapLayers under one parent, usually a Node2D named after the map. A
// map from Tile Mapper is painted into that parent by layer name, so sending it again repaints the
// same nodes (their scripts and connections stay) instead of adding new ones. Tile Mapper's
// collision layers have no pictures, only "solid here"; they become hidden layers painted with a
// tileset whose tile 0 is solid, the "-collision" tileset.

import type { NodeData, Project, SceneData } from './types';
import { lit } from './doc';
import { cellMap, tileFlags, tileId } from './tiles';
import { findNode, parentOf } from './project';

/** A map as Tile Mapper and Game Studio hand it over: rows of cells, −1 for none. */
export interface ArtMap {
  name: string;
  cols: number;
  rows: number;
  tileWidth: number;
  tileHeight: number;
  margin: number;
  spacing: number;
  layers: { name: string; kind: 'tiles' | 'collision'; visible: boolean; cells: number[] }[];
  /** The cell of the map's top-left corner, in the layers' cells (0, 0 unless it came from a layer painted left of or above its origin). */
  origin?: { x: number; y: number };
}

const safe = (s: string, fallback: string) => s.replace(/[^A-Za-z0-9_-]+/g, '_').replace(/^_+|_+$/g, '') || fallback;
const MAX_DIM = 512;   // Tile Mapper's largest map side

/** Where a map goes: an existing parent's layers, or a new Node2D under the scene root. */
export type MapTarget = { scenePath: string; parentId: string | null };

/**
 * Scene API code that puts a map into a scene, as one command: the tilesets (reused when one with the
 * same picture and grid exists), then each layer, repainted when the parent has one of that name.
 * Layers the map no longer has are deleted only from a parent that holds nothing but tile layers.
 */
export function mapToSceneCode(p: Project, map: ArtMap, image: string, target: MapTarget): { code: string; parentId: string | null; notes: string[] } {
  const scene = p.scenes.find((s) => s.path === target.scenePath);
  if (!scene) throw new Error(`There is no scene "${target.scenePath}"`);
  const lines = [`// From Tile Mapper: ${map.name}, ${map.cols} × ${map.rows} tiles of ${map.tileWidth} × ${map.tileHeight} px.`, `scene = project.scene(${lit(scene.path)})`];
  const notes: string[] = [];
  const base = safe(map.name, 'map').toLowerCase();

  // A tileset for this picture and grid: an existing one if it matches, else a new file.
  const tileset = (suffix: string, solid: number[]) => {
    const same = (p.tilesets ?? []).find((t) => t.image === image && t.tileWidth === map.tileWidth && t.tileHeight === map.tileHeight && t.margin === map.margin && t.spacing === map.spacing
      && (suffix ? t.path.endsWith(`${suffix}.tileset`) : !t.path.endsWith('-collision.tileset')));
    if (same) return same.path;
    let path = `tilesets/${base}${suffix}.tileset`;
    for (let k = 2; (p.tilesets ?? []).some((t) => t.path === path); k++) path = `tilesets/${base}${suffix}${k}.tileset`;
    lines.push(`project.createTileset(${lit(path)}, ${lit({ image, tileWidth: map.tileWidth, tileHeight: map.tileHeight, margin: map.margin, spacing: map.spacing, solid })})`);
    notes.push(`tileset ${path}`);
    return path;
  };
  const art = map.layers.some((l) => l.kind === 'tiles') ? tileset('', []) : null;
  const solid = map.layers.some((l) => l.kind === 'collision') ? tileset('-collision', [0]) : null;

  // The parent: the one asked for, or a new Node2D named after the map.
  let parent = target.parentId ? findNode(scene, target.parentId) ?? null : null;
  if (target.parentId && !parent) throw new Error('The map’s node in Game Studio was deleted: send it again to add it as a new one.');
  let parentPath: string;
  if (parent) parentPath = parent === scene.root ? '.' : pathTo(scene, parent);
  else {
    const taken = new Set(scene.root.children.map((c) => c.name));
    let name = safe(map.name, 'Map');
    for (let k = 2; taken.has(name); k++) name = `${safe(map.name, 'Map')}${k}`;
    lines.push(`scene.add('Node2D', { name: ${lit(name)} })`);
    parentPath = name;
  }
  const at = (name: string) => (parentPath === '.' ? name : `${parentPath}/${name}`);
  const existing = new Map((parent?.children ?? []).filter((c) => c.type === 'TileMapLayer').map((c) => [c.name, c]));
  const ox = map.origin?.x ?? 0, oy = map.origin?.y ?? 0;

  const used = new Set<string>();
  for (const l of map.layers) {
    let name = safe(l.name, 'Layer');
    for (let k = 2; used.has(name); k++) name = `${safe(l.name, 'Layer')}${k}`;
    used.add(name);
    const cells: [number, number, number][] = [];
    l.cells.forEach((v, i) => { if (v >= 0) cells.push([ox + (i % map.cols), oy + Math.floor(i / map.cols), l.kind === 'collision' ? 0 : v]); });
    const props = { tileset: l.kind === 'collision' ? solid : art, visible: l.kind === 'collision' ? false : l.visible };
    if (existing.has(name)) {
      lines.push(`{ const l = scene.get(${lit(at(name))}); l.tileset = ${lit(props.tileset)}; l.visible = ${props.visible}; l.cells = []; l.paint(${lit(cells)}) }`);
      existing.delete(name);
    } else {
      lines.push(`scene.add('TileMapLayer', ${lit({ name, parent: parentPath, ...props })}).paint(${lit(cells)})`);
    }
    notes.push(`${name}: ${cells.length} cells${l.kind === 'collision' ? ' (solid, hidden)' : ''}`);
  }
  // In a parent of nothing but tile layers, a layer the map no longer has goes too.
  if (parent && parent !== scene.root && parent.children.every((c) => c.type === 'TileMapLayer'))
    for (const name of existing.keys()) { lines.push(`scene.get(${lit(at(name))}).delete()`); notes.push(`${name} removed`); }
  return { code: lines.join('\n'), parentId: parent?.id ?? null, notes };
}

function pathTo(scene: SceneData, n: NodeData): string {
  const names: string[] = [];
  for (let x: NodeData | undefined = n; x && x !== scene.root; x = parentOf(scene, x.id)) names.unshift(x.name);
  return names.join('/');
}

/** The layers a node stands for: a parent of tile layers (the map), or one tile layer on its own. */
export function mapNodeOf(scene: SceneData, id: string): { parent: NodeData; layers: NodeData[]; whole: boolean } | null {
  const n = findNode(scene, id);
  if (!n) return null;
  const tileKids = (x: NodeData) => x.children.filter((c) => c.type === 'TileMapLayer');
  const isMap = (x: NodeData) => x !== scene.root && x.children.length > 0 && x.children.every((c) => c.type === 'TileMapLayer');
  if (isMap(n)) return { parent: n, layers: tileKids(n), whole: true };
  if (n.type === 'TileMapLayer') {
    const up = parentOf(scene, n.id)!;
    return isMap(up) ? { parent: up, layers: tileKids(up), whole: true } : { parent: up, layers: [n], whole: false };
  }
  return null;
}

/**
 * A scene's map as Tile Mapper edits it: one tileset for the pictures (and the "-collision" one for
 * solid layers), cells in rows. Says why not when it cannot be (two picture tilesets, say).
 */
export function sceneToMap(p: Project, scene: SceneData, id: string): { map: ArtMap; image: string; parentId: string; notes: string[] } {
  const m = mapNodeOf(scene, id);
  if (!m) throw new Error('Select a TileMapLayer, or the node that holds a map’s layers.');
  const notes: string[] = [];
  const tilesetOf = (n: NodeData) => (p.tilesets ?? []).find((t) => t.path === (n.props.tileset as string | undefined)) ?? null;
  const isSolid = (n: NodeData) => !!tilesetOf(n)?.path.endsWith('-collision.tileset');
  const art = [...new Set(m.layers.filter((l) => !isSolid(l)).map((l) => tilesetOf(l)).filter((t) => t))];
  if (art.length > 1) throw new Error(`These layers use ${art.length} tilesets (${art.map((t) => t!.path).join(', ')}): Tile Mapper edits a map with one.`);
  const ts = art[0] ?? m.layers.map(tilesetOf).find((t) => t) ?? null;
  if (!ts) throw new Error('Give the layer a tileset first (the TileMap panel).');

  // The cells of every layer, and the rectangle round them all.
  const lists = m.layers.map((l) => [...cellMap((l.props.cells as number[] | undefined) ?? [])].map(([k, v]) => { const [x, y] = k.split(',').map(Number); return { x, y, v }; }));
  const all = lists.flat();
  let flipped = false;
  const ox = Math.min(0, ...all.map((c) => c.x)), oy = Math.min(0, ...all.map((c) => c.y));
  const cols = Math.min(MAX_DIM, Math.max(Math.ceil(p.settings.width / ts.tileWidth), ...all.map((c) => c.x - ox + 1)));
  const rows = Math.min(MAX_DIM, Math.max(Math.ceil(p.settings.height / ts.tileHeight), ...all.map((c) => c.y - oy + 1)));
  const layers = m.layers.map((l, i) => {
    const cells = new Array(cols * rows).fill(-1);
    for (const c of lists[i]) {
      const x = c.x - ox, y = c.y - oy;
      if (x >= cols || y >= rows) continue;
      if (tileFlags(c.v)) flipped = true;
      cells[y * cols + x] = tileId(c.v);
    }
    return { name: l.name, kind: isSolid(l) ? 'collision' as const : 'tiles' as const, visible: l.props.visible !== false, cells };
  });
  if (flipped) notes.push('flipped and turned tiles come back unflipped (Tile Mapper has no flips)');
  if (all.some((c) => c.x - ox >= MAX_DIM || c.y - oy >= MAX_DIM)) notes.push(`only the first ${MAX_DIM} × ${MAX_DIM} cells`);
  return {
    map: { name: m.whole ? m.parent.name : m.layers[0].name, cols, rows, tileWidth: ts.tileWidth, tileHeight: ts.tileHeight, margin: ts.margin, spacing: ts.spacing, layers, origin: { x: ox, y: oy } },
    image: ts.image, parentId: m.parent.id, notes,
  };
}
