// Tile Mapper and Game Studio (src/labs/game-studio), handing maps over in the page
// (src/utils/artBridge.js). Game Studio asks for a new map or sends one of its maps to edit; Send to
// Game Studio hands it back: the layers as rows of tile numbers (−1 for none), the tileset's grid,
// and its picture. The document's `link` says which of Game Studio's nodes the layers repaint.

import { normalizeDoc } from './tilemapDoc.js'
import { buildTileset, fileToDataUrl } from './tileset.js'
import { dataUrlToBlob } from './render.js'

/** The map, in the shape both labs use (core/artMaps.ts, ArtMap in Game Studio). */
export function mapFromDoc(doc) {
  if (!doc.tileset) throw new Error('Choose a tileset first: Game Studio needs its picture')
  return {
    name: doc.name,
    cols: doc.cols,
    rows: doc.rows,
    tileWidth: doc.tileW,
    tileHeight: doc.tileH,
    margin: doc.tileset.margin ?? 0,
    spacing: doc.tileset.spacing ?? 0,
    layers: doc.layers.map((l) => ({ name: l.name, kind: l.kind, visible: l.visible, cells: Array.from(l.cells) })),
    // Where the map's top-left cell is in Game Studio's layers, when it came from there.
    origin: doc.link?.origin ?? { x: 0, y: 0 },
  }
}

/** A document for a map from Game Studio, with its tileset picture, linked back to where it came from. */
export async function docFromMap(map, tileset, link) {
  const dataUrl = await fileToDataUrl(tileset.blob)
  return normalizeDoc({
    name: map.name,
    cols: map.cols,
    rows: map.rows,
    tileW: map.tileWidth,
    tileH: map.tileHeight,
    tileset: buildTileset({ dataUrl, imageWidth: tileset.imageWidth, imageHeight: tileset.imageHeight, tileW: map.tileWidth, tileH: map.tileHeight, margin: map.margin, spacing: map.spacing, name: tileset.name }),
    layers: map.layers.map((l) => ({ name: l.name, kind: l.kind, visible: l.visible, cells: l.cells })),
    terrains: [],
    link: { ...link, origin: map.origin ?? { x: 0, y: 0 } },
  })
}

/** The message Send to Game Studio leaves for it. */
export function mapMessage(doc) {
  const map = mapFromDoc(doc)
  return {
    type: 'map',
    name: doc.name,
    doc: doc.id,
    map,
    tileset: { blob: dataUrlToBlob(doc.tileset.dataUrl), name: doc.tileset.name || 'tiles', imageWidth: doc.tileset.imageWidth, imageHeight: doc.tileset.imageHeight },
    link: doc.link ?? undefined,
  }
}
