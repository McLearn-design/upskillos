// Tile maths shared by the model, the engine and the editor.
//
// A tileset cuts an image into a grid of tiles, numbered from 0 left to right, then top to bottom
// (tile id = row × columns + column). `margin` is the border round the whole image, `spacing` the
// gap between tiles, both in pixels.
//
// A TileMapLayer's cells are stored as one flat list of numbers, three per painted cell:
// [x, y, tile, x, y, tile, …], kept in order (by y, then x) so the same map always saves the same.
// x and y are cell coordinates: cell (2, 3) covers pixels 2·w to 3·w across and 3·h to 4·h down,
// from the layer's origin. A tile of −1 in an edit means "erase".
//
// A stored tile may also carry Tiled's flip flags in its top three bits, as Tiled stores them:
// 2³¹ mirrors it left to right, 2³⁰ top to bottom, 2²⁹ along its diagonal (which, with the
// others, makes the quarter turns). tileId() strips them; tileTransform() says how to draw them.

import type { TilesetData } from './types';

export type CellEdit = [x: number, y: number, tile: number];

const FLAG = 2 ** 29;
/** The tile number without flip flags. */
export const tileId = (stored: number): number => stored % FLAG;
/** The flip flags: 4 is horizontal, 2 vertical, 1 diagonal. */
export const tileFlags = (stored: number): number => Math.floor(stored / FLAG);
/** A tile number with flip flags. */
export const withFlags = (id: number, flags: number): number => id + flags * FLAG;

/**
 * How to draw a flipped tile: turn it by `rotation` (radians, clockwise on screen) about its centre,
 * then mirror it left to right if `flipX`. The same mapping Phaser uses for Tiled's flags.
 */
export function tileTransform(flags: number): { rotation: number; flipX: boolean } {
  const h = (flags & 4) !== 0, v = (flags & 2) !== 0, d = (flags & 1) !== 0;
  if (d) {
    if (h && v) return { rotation: Math.PI / 2, flipX: true };
    if (h) return { rotation: Math.PI / 2, flipX: false };
    if (v) return { rotation: (3 * Math.PI) / 2, flipX: false };
    return { rotation: Math.PI / 2, flipX: true };
  }
  if (h && v) return { rotation: Math.PI, flipX: false };
  if (h) return { rotation: 0, flipX: true };
  if (v) return { rotation: Math.PI, flipX: true };
  return { rotation: 0, flipX: false };
}

/** How many tiles across and down an image of this size makes. */
export function tilesetGrid(ts: Pick<TilesetData, 'tileWidth' | 'tileHeight' | 'margin' | 'spacing'>, imageWidth: number, imageHeight: number): { columns: number; rows: number; count: number } {
  const fit = (size: number, tile: number) => Math.max(0, Math.floor((size - 2 * ts.margin + ts.spacing) / (tile + ts.spacing)));
  const columns = fit(imageWidth, ts.tileWidth), rows = fit(imageHeight, ts.tileHeight);
  return { columns, rows, count: columns * rows };
}

/** Where tile `id` is in the tileset's image. */
export function tileRect(ts: Pick<TilesetData, 'tileWidth' | 'tileHeight' | 'margin' | 'spacing'>, columns: number, id: number): { x: number; y: number; w: number; h: number } {
  const col = id % columns, row = Math.floor(id / columns);
  return { x: ts.margin + col * (ts.tileWidth + ts.spacing), y: ts.margin + row * (ts.tileHeight + ts.spacing), w: ts.tileWidth, h: ts.tileHeight };
}

const key = (x: number, y: number) => `${x},${y}`;

/** The cells as a map from "x,y" to tile. */
export function cellMap(cells: number[]): Map<string, number> {
  const m = new Map<string, number>();
  for (let i = 0; i + 2 < cells.length; i += 3) m.set(key(cells[i], cells[i + 1]), cells[i + 2]);
  return m;
}

/** A map back to the stored list, in order: by y, then x. */
export function cellList(m: Map<string, number>): number[] {
  const out = [...m].map(([k, t]) => { const [x, y] = k.split(',').map(Number); return [x, y, t]; });
  out.sort((a, b) => a[1] - b[1] || a[0] - b[0]);
  return out.flat();
}

/** The cells after some edits (tile −1 erases). */
export function applyEdits(cells: number[], edits: CellEdit[]): number[] {
  const m = cellMap(cells);
  for (const [x, y, t] of edits) { if (t < 0) m.delete(key(x, y)); else m.set(key(x, y), t); }
  return cellList(m);
}

/** Every cell of a rectangle (corners included, in any order) set to one tile. */
export function rectEdits(x0: number, y0: number, x1: number, y1: number, tile: number): CellEdit[] {
  const out: CellEdit[] = [];
  for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) out.push([x, y, tile]);
  return out;
}

/**
 * Bucket fill: from (x, y), every cell joined to it (up, down, left, right) that holds the same tile
 * (or is empty, when it is empty) becomes `tile`. An empty area has no edge, so the fill stays inside
 * `bounds` (in cells, inclusive), which the editor sets to the painted area plus a margin.
 */
export function bucketEdits(cells: number[], x: number, y: number, tile: number, bounds: { x0: number; y0: number; x1: number; y1: number }): CellEdit[] {
  const m = cellMap(cells), from = m.get(key(x, y)) ?? -1;
  if (from === tile) return [];
  const out: CellEdit[] = [], seen = new Set<string>(), todo: [number, number][] = [[x, y]];
  while (todo.length) {
    const [cx, cy] = todo.pop()!;
    const k = key(cx, cy);
    if (seen.has(k) || cx < bounds.x0 || cx > bounds.x1 || cy < bounds.y0 || cy > bounds.y1 || (m.get(k) ?? -1) !== from) continue;
    seen.add(k);
    out.push([cx, cy, tile]);
    todo.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]);
  }
  return out;
}

/** The smallest rectangle of cells holding every painted cell, or null when there are none. */
export function usedRect(cells: number[]): { x0: number; y0: number; x1: number; y1: number } | null {
  if (cells.length < 3) return null;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (let i = 0; i + 2 < cells.length; i += 3) { x0 = Math.min(x0, cells[i]); x1 = Math.max(x1, cells[i]); y0 = Math.min(y0, cells[i + 1]); y1 = Math.max(y1, cells[i + 1]); }
  return { x0, y0, x1, y1 };
}

/**
 * The solid cells as few rectangles as a simple greedy pass finds (in cells): runs along each row,
 * then runs stacked on identical runs below. Bodies collide with these instead of with one square
 * per tile, so a body sliding along a floor of many tiles meets one flat edge and cannot catch on
 * the seams between tiles.
 */
export function solidRects(cells: number[], solid: Set<number>): { x: number; y: number; w: number; h: number }[] {
  const rows = new Map<number, number[]>();
  for (let i = 0; i + 2 < cells.length; i += 3) if (solid.has(tileId(cells[i + 2]))) { const r = rows.get(cells[i + 1]) ?? []; r.push(cells[i]); rows.set(cells[i + 1], r); }
  // Runs per row.
  const runs: { x: number; y: number; w: number }[] = [];
  for (const [y, xs] of [...rows].sort((a, b) => a[0] - b[0])) {
    xs.sort((a, b) => a - b);
    let start = xs[0], prev = xs[0];
    for (const x of xs.slice(1).concat([Infinity])) { if (x !== prev + 1) { runs.push({ x: start, y, w: prev - start + 1 }); start = x; } prev = x; }
  }
  // Stack identical runs on consecutive rows.
  const open = new Map<string, { x: number; y: number; w: number; h: number }>(), out: { x: number; y: number; w: number; h: number }[] = [];
  for (const r of runs) {
    const above = open.get(`${r.x},${r.w},${r.y - 1}`);
    if (above) { open.delete(`${r.x},${r.w},${r.y - 1}`); above.h++; open.set(`${r.x},${r.w},${r.y}`, above); }
    else { const rect = { x: r.x, y: r.y, w: r.w, h: 1 }; out.push(rect); open.set(`${r.x},${r.w},${r.y}`, rect); }
  }
  return out;
}

/**
 * A map drawn as text: each character is a cell, `legend` says which tile it is (a character not in
 * the legend, such as a space, leaves its cell alone; −1 erases). Row 0 is the first string.
 */
export function textEdits(rows: string[], legend: Record<string, number>, at: { x: number; y: number } = { x: 0, y: 0 }): CellEdit[] {
  const out: CellEdit[] = [];
  rows.forEach((row, y) => [...row].forEach((ch, x) => { if (ch in legend) out.push([at.x + x, at.y + y, legend[ch]]); }));
  return out;
}

/** What is wrong with a tileset's own fields, or null. (Whether its image exists is the problem report's job.) */
export function tilesetProblem(ts: unknown): string | null {
  const t = ts as Record<string, unknown>;
  if (!t || typeof t !== 'object') return 'A tileset must be { path, image, tileWidth, tileHeight, margin, spacing, solid }';
  const whole = (v: unknown, lo: number, hi: number) => Number.isInteger(v) && (v as number) >= lo && (v as number) <= hi;
  if (typeof t.path !== 'string' || !/^tilesets\/[A-Za-z0-9_\-./]+\.tileset$/.test(t.path) || t.path.includes('..')) return `A tileset's path must be in tilesets/ and end in .tileset (letters, digits, - _ . /)`;
  if (typeof t.image !== 'string' || !t.image) return `${t.path}: image must be an image path`;
  if (!whole(t.tileWidth, 1, 1024) || !whole(t.tileHeight, 1, 1024)) return `${t.path}: tileWidth and tileHeight must be whole numbers of pixels from 1 to 1024`;
  if (!whole(t.margin, 0, 256) || !whole(t.spacing, 0, 256)) return `${t.path}: margin and spacing must be whole numbers of pixels from 0 to 256`;
  if (!Array.isArray(t.solid) || t.solid.some((x) => !whole(x, 0, 1e6)) || new Set(t.solid).size !== t.solid.length) return `${t.path}: solid must be a list of different tile numbers`;
  if (Object.keys(t).some((k) => !['path', 'image', 'tileWidth', 'tileHeight', 'margin', 'spacing', 'solid'].includes(k))) return `${t.path} has something other than path, image, tileWidth, tileHeight, margin, spacing and solid`;
  return null;
}
