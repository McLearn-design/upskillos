// Importing maps from Tiled (mapeditor.org), the free map editor most 2D game art is made for.
//
// It reads Tiled's maps in either format, XML (.tmx) or JSON (.tmj), and their tilesets, inside
// the map or in their own files (.tsx, .tsj), and turns a map into Scene API code: a tileset for
// each Tiled tileset the map uses, and a TileMapLayer for each tile layer. The editor runs that
// code as one command, so an import is one undo step and GUI → code shows exactly what it made.
//
// What Tiled calls a gid (global tile id) is a tile's number across all of a map's tilesets: each
// tileset's tiles start at its firstgid. 0 is an empty cell. The top three bits are flip flags,
// kept as they are (core/tiles.ts says how to draw them).
//
// Solid tiles: a tile with collision shapes (drawn in Tiled's collision editor), or with a
// property "solid" or "collides" set to true.

import { parseXml, type XmlElement } from './xml';
import { lit } from './doc';
import { tileFlags, tileId, withFlags } from './tiles';

export interface TiledTileset {
  firstgid: number;
  /** Set when the tileset is in its own file: that file's path, as the map names it. */
  source?: string;
  name?: string;
  tilewidth?: number; tileheight?: number; margin?: number; spacing?: number; columns?: number; tilecount?: number;
  /** The image, as the tileset names it (a path relative to the tileset's file). */
  image?: string;
  /** Tile numbers (within the tileset) that are solid. */
  solid?: number[];
}

export interface TiledLayer { name: string; visible: boolean; offsetx: number; offsety: number; width: number; height: number; data?: number[]; chunks?: { x: number; y: number; width: number; height: number; data: number[] }[] }

export interface TiledMap {
  orientation: string; width: number; height: number; tilewidth: number; tileheight: number; infinite: boolean;
  tilesets: TiledTileset[];
  layers: TiledLayer[];
  /** Layers that are not tile layers (objects, images): not imported, but named in the notes. */
  skipped: string[];
}

const num = (v: unknown, d = 0) => (v === undefined || v === '' ? d : Number(v));
const truthy = (v: unknown) => v === true || v === 'true';

/** Tile layer data from text: CSV, or base64 of little-endian 32-bit numbers (uncompressed only). */
function decodeData(text: string, encoding: string | undefined, compression: string | undefined, layer: string): number[] {
  if (compression) throw new Error(`The layer "${layer}" is compressed (${compression}). In Tiled, open Map › Map Properties and set Tile Layer Format to CSV, then save again.`);
  if (encoding === 'csv') return text.split(',').map((s) => s.trim()).filter(Boolean).map(Number);
  if (encoding === 'base64') {
    const bin = atob(text.trim()), out: number[] = [];
    for (let i = 0; i + 3 < bin.length; i += 4) out.push((bin.charCodeAt(i) | (bin.charCodeAt(i + 1) << 8) | (bin.charCodeAt(i + 2) << 16)) + bin.charCodeAt(i + 3) * 2 ** 24);
    return out;
  }
  throw new Error(`The layer "${layer}" uses the old XML tile format. In Tiled, set Map › Map Properties › Tile Layer Format to CSV, then save again.`);
}

/** Solid tiles of a tileset, from its <tile> or "tiles" entries. */
function solidFromXml(ts: XmlElement): number[] {
  return ts.children.filter((c) => c.name === 'tile' && (c.children.some((x) => x.name === 'objectgroup' && x.children.length)
    || c.children.some((x) => x.name === 'properties' && x.children.some((p) => /^(solid|collides)$/i.test(p.attrs.name) && truthy(p.attrs.value)))))
    .map((c) => Number(c.attrs.id));
}
function solidFromJson(ts: Record<string, unknown>): number[] {
  return ((ts.tiles as Record<string, unknown>[]) ?? []).filter((t) => ((t.objectgroup as { objects?: unknown[] })?.objects?.length ?? 0) > 0
    || ((t.properties as { name: string; value: unknown }[]) ?? []).some((p) => /^(solid|collides)$/i.test(p.name) && truthy(p.value))).map((t) => Number(t.id));
}

function tilesetFromXml(el: XmlElement, firstgid: number): TiledTileset {
  if (el.attrs.source) return { firstgid, source: el.attrs.source };
  const img = el.children.find((c) => c.name === 'image');
  if (!img) throw new Error(`The tileset "${el.attrs.name}" is a collection of separate images; Game Studio imports tilesets made from one image (a sheet).`);
  return { firstgid, name: el.attrs.name, tilewidth: num(el.attrs.tilewidth), tileheight: num(el.attrs.tileheight), margin: num(el.attrs.margin), spacing: num(el.attrs.spacing), columns: num(el.attrs.columns), tilecount: num(el.attrs.tilecount), image: img.attrs.source, solid: solidFromXml(el) };
}
function tilesetFromJson(o: Record<string, unknown>, firstgid: number): TiledTileset {
  if (o.source) return { firstgid, source: String(o.source) };
  if (!o.image) throw new Error(`The tileset "${o.name}" is a collection of separate images; Game Studio imports tilesets made from one image (a sheet).`);
  return { firstgid, name: String(o.name ?? 'tileset'), tilewidth: num(o.tilewidth), tileheight: num(o.tileheight), margin: num(o.margin), spacing: num(o.spacing), columns: num(o.columns), tilecount: num(o.tilecount), image: String(o.image), solid: solidFromJson(o) };
}

/** A tileset from its own file (.tsx or .tsj). Its firstgid comes from the map. */
export function readTileset(text: string, firstgid = 1): TiledTileset {
  const t = text.trimStart();
  return t.startsWith('<') ? tilesetFromXml(parseXml(t), firstgid) : tilesetFromJson(JSON.parse(t), firstgid);
}

/** A map file (.tmx or .tmj). */
export function readMap(text: string): TiledMap {
  const t = text.trimStart();
  if (t.startsWith('<')) {
    const m = parseXml(t);
    if (m.name !== 'map') throw new Error('This is not a Tiled map (its first element is not <map>)');
    const layers: TiledLayer[] = [], skipped: string[] = [];
    const visit = (el: XmlElement, dx: number, dy: number) => {
      for (const c of el.children) {
        const ox = dx + num(c.attrs.offsetx), oy = dy + num(c.attrs.offsety);
        if (c.name === 'group') visit(c, ox, oy);
        else if (c.name === 'layer') {
          const d = c.children.find((x) => x.name === 'data');
          if (!d) continue;
          const chunks = d.children.filter((x) => x.name === 'chunk');
          layers.push({ name: c.attrs.name, visible: c.attrs.visible !== '0', offsetx: ox, offsety: oy, width: num(c.attrs.width), height: num(c.attrs.height),
            ...(chunks.length
              ? { chunks: chunks.map((k) => ({ x: num(k.attrs.x), y: num(k.attrs.y), width: num(k.attrs.width), height: num(k.attrs.height), data: decodeData(k.text, d.attrs.encoding, d.attrs.compression, c.attrs.name) })) }
              : { data: decodeData(d.text, d.attrs.encoding, d.attrs.compression, c.attrs.name) }) });
        } else if (c.name === 'objectgroup' || c.name === 'imagelayer') skipped.push(`${c.attrs.name} (${c.name === 'objectgroup' ? 'objects' : 'an image'})`);
      }
    };
    visit(m, 0, 0);
    return { orientation: m.attrs.orientation, width: num(m.attrs.width), height: num(m.attrs.height), tilewidth: num(m.attrs.tilewidth), tileheight: num(m.attrs.tileheight), infinite: m.attrs.infinite === '1',
      tilesets: m.children.filter((c) => c.name === 'tileset').map((c) => tilesetFromXml(c, num(c.attrs.firstgid, 1))), layers, skipped };
  }
  const o = JSON.parse(t) as Record<string, unknown>;
  if (o.type !== 'map') throw new Error('This is not a Tiled map (its "type" is not "map")');
  const layers: TiledLayer[] = [], skipped: string[] = [];
  const data = (d: unknown, l: Record<string, unknown>) => (Array.isArray(d) ? d.map(Number) : decodeData(String(d), String(l.encoding ?? 'base64'), l.compression ? String(l.compression) : undefined, String(l.name)));
  const visit = (list: Record<string, unknown>[], dx: number, dy: number) => {
    for (const l of list) {
      const ox = dx + num(l.offsetx), oy = dy + num(l.offsety);
      if (l.type === 'group') visit(l.layers as Record<string, unknown>[], ox, oy);
      else if (l.type === 'tilelayer') layers.push({ name: String(l.name), visible: l.visible !== false, offsetx: ox, offsety: oy, width: num(l.width), height: num(l.height),
        ...(l.chunks ? { chunks: (l.chunks as Record<string, unknown>[]).map((k) => ({ x: num(k.x), y: num(k.y), width: num(k.width), height: num(k.height), data: data(k.data, l) })) } : { data: data(l.data, l) }) });
      else skipped.push(`${l.name} (${l.type === 'objectgroup' ? 'objects' : String(l.type)})`);
    }
  };
  visit((o.layers as Record<string, unknown>[]) ?? [], 0, 0);
  return { orientation: String(o.orientation), width: num(o.width), height: num(o.height), tilewidth: num(o.tilewidth), tileheight: num(o.tileheight), infinite: !!o.infinite,
    tilesets: ((o.tilesets as Record<string, unknown>[]) ?? []).map((ts) => tilesetFromJson(ts, num(ts.firstgid, 1))), layers, skipped };
}

/** The part of a path after its last slash. */
const base = (p: string) => p.split(/[\\/]/).pop()!;
const safe = (s: string) => s.replace(/[^A-Za-z0-9_-]+/g, '_').replace(/^_+|_+$/g, '') || 'tiles';

export interface ImportPlan {
  /** Scene API code that makes the tilesets and layers, for the current scene. */
  code: string;
  /** Things worth saying: layers left out, tilesets made. */
  notes: string[];
}

/**
 * Plan an import. `tilesetFiles` holds the text of tileset files the map refers to, by file name.
 * `findImage` finds the project asset for an image path as Tiled names it (null when there is
 * none: import the image first). `existing` is the tileset paths already in the project.
 * Throws with a sentence saying what to do when the map cannot be imported.
 */
export function planImport(map: TiledMap, mapName: string, opts: { tilesetFiles: Map<string, string>; findImage: (tiledPath: string) => string | null; existing: Set<string>; scenePath: string }): ImportPlan {
  if (map.orientation !== 'orthogonal') throw new Error(`${mapName} is ${map.orientation}; Game Studio imports orthogonal (square-grid) maps only.`);
  const notes: string[] = [];
  const tilesets = map.tilesets.map((ts) => {
    if (!ts.source) return ts;
    const text = opts.tilesetFiles.get(base(ts.source));
    if (text === undefined) throw new Error(`${mapName} uses the tileset file ${base(ts.source)}: choose it too when you import (select the map and its tileset files together).`);
    return readTileset(text, ts.firstgid);
  }).sort((a, b) => a.firstgid - b.firstgid);

  const lines = [`// Imported from ${mapName} (Tiled): ${map.width} × ${map.height} tiles of ${map.tilewidth} × ${map.tileheight} px.`, `scene = project.scene(${lit(opts.scenePath)})`];
  const tsPath = new Map<TiledTileset, string>();
  const taken = new Set(opts.existing);
  for (const ts of tilesets) {
    const image = opts.findImage(ts.image!);
    if (!image) throw new Error(`The tileset "${ts.name}" uses the image ${base(ts.image!)}: import that image first (it may be in the starter art), then import the map again.`);
    let path = `tilesets/${safe(ts.name ?? base(ts.image!))}.tileset`;
    for (let k = 2; taken.has(path); k++) path = `tilesets/${safe(ts.name ?? 'tiles')}${k}.tileset`;
    taken.add(path);
    tsPath.set(ts, path);
    lines.push(`project.createTileset(${lit(path)}, ${lit({ image, tileWidth: ts.tilewidth, tileHeight: ts.tileheight, margin: ts.margin ?? 0, spacing: ts.spacing ?? 0, solid: [...(ts.solid ?? [])].sort((a, b) => a - b) })})`);
    notes.push(`tileset ${path}${ts.solid?.length ? ` (${ts.solid.length} solid tiles)` : ''}`);
  }
  const owner = (gid: number) => { let found: TiledTileset | undefined; for (const ts of tilesets) if (ts.firstgid <= gid) found = ts; return found; };

  let layerNo = 0;
  for (const l of map.layers) {
    layerNo++;
    // The cells of each tileset this layer uses: [x, y, tile], with flip flags kept.
    const byTileset = new Map<TiledTileset, [number, number, number][]>();
    const put = (x: number, y: number, raw: number) => {
      const gid = tileId(raw);   // without the flip flags; gids count from 1, and 0 is empty
      if (gid === 0) return;
      const ts = owner(gid);
      if (!ts) return;
      const list = byTileset.get(ts) ?? [];
      list.push([x, y, withFlags(gid - ts.firstgid, tileFlags(raw))]);
      byTileset.set(ts, list);
    };
    if (l.data) l.data.forEach((raw, i) => put(i % l.width, Math.floor(i / l.width), raw));
    for (const c of l.chunks ?? []) c.data.forEach((raw, i) => put(c.x + (i % c.width), c.y + Math.floor(i / c.width), raw));
    let part = 0;
    for (const [ts, cells] of byTileset) {
      const name = safe(l.name || `Layer${layerNo}`) + (byTileset.size > 1 ? `_${++part}` : '');
      const props: Record<string, unknown> = { name, tileset: tsPath.get(ts) };
      if (l.offsetx || l.offsety) props.position = { x: l.offsetx, y: l.offsety };
      if (!l.visible) props.visible = false;
      lines.push(`scene.add('TileMapLayer', ${lit(props)}).paint(${lit(cells)})`);
      notes.push(`layer ${name}: ${cells.length} cells`);
    }
  }
  if (map.skipped.length) notes.push(`not imported: ${map.skipped.join(', ')} (Game Studio imports tile layers)`);
  return { code: lines.join('\n'), notes };
}

/** The project asset an image path from Tiled most likely means: the one whose path ends with the most of the same folders and name. */
export function matchImage(tiledPath: string, assets: string[]): string | null {
  const want = tiledPath.toLowerCase().split(/[\\/]/).filter((p) => p && p !== '.' && p !== '..');
  let best: string | null = null, bestScore = 0;
  for (const a of assets) {
    const have = a.toLowerCase().split('/');
    let score = 0;
    while (score < want.length && score < have.length && want[want.length - 1 - score] === have[have.length - 1 - score]) score++;
    if (score > bestScore) { best = a; bestScore = score; }
  }
  return bestScore >= 1 ? best : null;
}
