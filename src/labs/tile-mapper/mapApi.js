// The map API: every edit Tile Mapper makes, as a line of code you could write yourself (GUI → code, as
// in Game Studio). The editor turns each edit into a command, { label, code, run }: `run` makes the
// edit, and `code` is the same edit as a call on `map`, shown in the Code panel. Running the logged
// lines on the map the session started from, with the same tileset picture, makes the same map
// (mapApi.test.js), and code typed into the panel runs the same way.
//
//   map.tileset({ name: 'tilemap_packed.png', tileW: 16, tileH: 16, imageWidth: 192, imageHeight: 176 })
//   map.addLayer('tiles')                      // a new layer at the front: "Layer 3"
//   map.paint('Ground', [[3, 4, 12], [4, 4, 12]])   // [x, y, tile]; tile −1 erases
//   map.layer('Ground', { visible: false })
//
// A layer is named by its name, or by its index (0 is at the back) when two share a name.

import { createTerrain } from './tilemapDoc.js'
import { buildTileset } from './tileset.js'
import {
  addLayer,
  addTerrain,
  clearLayer,
  duplicateLayer,
  moveLayer,
  refreshTerrains,
  removeLayer,
  removeTerrain,
  resizeDoc,
  shiftDoc,
  updateLayer,
  updateTerrain,
  withLayerCells,
} from './useTilemapDoc.js'

const lit = (v) => JSON.stringify(v)

/** A layer's index from its name (or an index given as a number). */
function layerIndex(doc, layer) {
  const i = typeof layer === 'number' ? layer : doc.layers.findIndex((l) => l.name === layer)
  if (i < 0 || i >= doc.layers.length) throw new Error(`There is no layer ${lit(layer)}`)
  return i
}

/** How code names a layer: its name, or its index when another layer has the same name. */
function layerRef(doc, index) {
  const name = doc.layers[index].name
  return doc.layers.filter((l) => l.name === name).length === 1 ? name : index
}

/** The edits that turn one layer's cells into another's: [x, y, tile] for each cell that changed. */
export function cellEdits(before, after, cols) {
  const edits = []
  for (let i = 0; i < after.length; i++) if (before[i] !== after[i]) edits.push([i % cols, Math.floor(i / cols), after[i]])
  return edits
}

function paintCells(doc, index, edits) {
  const cells = doc.layers[index].cells.slice()
  for (const [x, y, t] of edits) {
    if (x < 0 || y < 0 || x >= doc.cols || y >= doc.rows) throw new Error(`Cell ${x}, ${y} is outside the ${doc.cols} × ${doc.rows} map`)
    cells[y * doc.cols + x] = t
  }
  return withLayerCells(doc, index, cells)
}

const TILESET_FIELDS = ['name', 'tileW', 'tileH', 'imageWidth', 'imageHeight', 'margin', 'spacing']

/**
 * The calls, as functions of the map: map.<name>(...args) runs METHODS[name](doc, ...args, context).
 * The context carries the tileset picture, which code leaves out (it is the picture you chose).
 */
const METHODS = {
  resize: (doc, cols, rows) => resizeDoc(doc, cols, rows),
  shift: (doc, dx, dy) => shiftDoc(doc, dx, dy),
  tileset: (doc, opts, ctx) => {
    const dataUrl = ctx.image ?? doc.tileset?.dataUrl
    if (!dataUrl) throw new Error('map.tileset needs a picture: choose one with Tileset… first')
    const tileset = buildTileset({ ...opts, margin: opts.margin ?? 0, spacing: opts.spacing ?? 0, dataUrl })
    return { ...doc, tileset, tileW: tileset.tileW, tileH: tileset.tileH, updatedAt: Date.now() }
  },
  addLayer: (doc, kind = 'tiles') => addLayer(doc, kind),
  removeLayer: (doc, layer) => removeLayer(doc, layerIndex(doc, layer)),
  duplicateLayer: (doc, layer) => duplicateLayer(doc, layerIndex(doc, layer)),
  moveLayer: (doc, layer, to) => moveLayer(doc, layerIndex(doc, layer), to),
  clearLayer: (doc, layer) => clearLayer(doc, layerIndex(doc, layer)),
  layer: (doc, layer, patch) => updateLayer(doc, layerIndex(doc, layer), patch),
  paint: (doc, layer, edits) => paintCells(doc, layerIndex(doc, layer), edits),
  addTerrain: (doc, { name, col, row }, ctx) => addTerrain(doc, { ...createTerrain(col, row, name), ...(ctx.terrainId ? { id: ctx.terrainId } : {}) }),
  removeTerrain: (doc, index) => { const t = doc.terrains[index]; if (!t) throw new Error(`There is no terrain ${index}`); return removeTerrain(doc, t.id) },
  terrain: (doc, index, patch) => { const t = doc.terrains[index]; if (!t) throw new Error(`There is no terrain ${index}`); return updateTerrain(doc, t.id, patch) },
  refreshAutotiles: (doc) => refreshTerrains(doc),
}

/** A command: its label (for undo), its code, and the edit itself. */
function command(label, name, args, ctx = {}) {
  return { label, code: `map.${name}(${args.map(lit).join(', ')})`, run: (doc) => METHODS[name](doc, ...args, ctx) }
}

/** The editor's edits as commands, each built from the map as it is now (so layers are named as they are). */
export const cmd = {
  resize: (doc, cols, rows) => command(`Resize to ${cols} × ${rows}`, 'resize', [Number(cols), Number(rows)]),
  shift: (doc, dx, dy) => command('Shift the map', 'shift', [dx, dy]),
  tileset: (doc, tileset) => command(`Tileset ${tileset.name}`, 'tileset', [Object.fromEntries(TILESET_FIELDS.map((k) => [k, tileset[k] ?? 0]))], { image: tileset.dataUrl }),
  addLayer: (doc, kind) => command(kind === 'collision' ? 'Add a collision layer' : 'Add a layer', 'addLayer', [kind]),
  removeLayer: (doc, i) => command(`Delete ${doc.layers[i].name}`, 'removeLayer', [layerRef(doc, i)]),
  duplicateLayer: (doc, i) => command(`Duplicate ${doc.layers[i].name}`, 'duplicateLayer', [layerRef(doc, i)]),
  moveLayer: (doc, from, to) => command(`Move ${doc.layers[from].name}`, 'moveLayer', [layerRef(doc, from), to]),
  clearLayer: (doc, i) => command(`Clear ${doc.layers[i].name}`, 'clearLayer', [layerRef(doc, i)]),
  layer: (doc, i, patch) => command(`${doc.layers[i].name}: ${Object.keys(patch).join(', ')}`, 'layer', [layerRef(doc, i), patch]),
  /** A brush stroke (or fill): the cells it changed. */
  paint: (doc, i, cells) => command(`Paint ${doc.layers[i].name}`, 'paint', [layerRef(doc, i), cellEdits(doc.layers[i].cells, cells, doc.cols)]),
  addTerrain: (doc, terrain) => command(`Add terrain ${terrain.name}`, 'addTerrain', [{ name: terrain.name, col: terrain.col, row: terrain.row }], { terrainId: terrain.id }),
  removeTerrain: (doc, id) => command('Delete a terrain', 'removeTerrain', [doc.terrains.findIndex((t) => t.id === id)]),
  terrain: (doc, id, patch) => command('Edit a terrain', 'terrain', [doc.terrains.findIndex((t) => t.id === id), patch]),
  refreshAutotiles: () => command('Refresh autotiles', 'refreshAutotiles', []),
}

/**
 * Run code written against the map API on a map: the Code panel's Run, and the replay test. Returns the
 * edited map; throws with the error's message if the code fails (the map is then unchanged).
 */
export function runMapCode(doc, code, ctx = {}) {
  let current = doc
  const map = Object.fromEntries(Object.keys(METHODS).map((name) => [name, (...args) => { current = METHODS[name](current, ...args, ctx) }]))
  Object.defineProperty(map, 'layers', { get: () => current.layers.map((l) => l.name) })
  Object.defineProperty(map, 'cols', { get: () => current.cols })
  Object.defineProperty(map, 'rows', { get: () => current.rows })
  new Function('map', `"use strict";\n${code}`)(map)
  return current
}

export const MAP_API_NAMES = Object.keys(METHODS)
