// Tile Mapper's side of the hand-over to Game Studio (gameStudio.js): the map in the shape both labs use.
import { describe, expect, it } from 'vitest'
import { createDoc, normalizeDoc } from './tilemapDoc.js'
import { buildTileset } from './tileset.js'
import { mapFromDoc } from './gameStudio.js'

describe('maps for Game Studio', () => {
  it('layers as rows of tile numbers (−1 for none), the tileset grid, and where it goes back to', () => {
    const doc = { ...createDoc({ cols: 3, rows: 2, tileW: 16, tileH: 16, name: 'Cave' }),
      tileset: buildTileset({ dataUrl: 'data:image/png;base64,', imageWidth: 64, imageHeight: 32, tileW: 16, tileH: 16, margin: 1, spacing: 2, name: 'cave.png' }),
      link: { project: 'p1', scene: 'scenes/main.scene', node: 'n4', origin: { x: -2, y: 0 } } }
    doc.layers[0].cells[4] = 7
    doc.layers[1].cells[5] = 0
    const map = mapFromDoc(doc)
    expect(map).toMatchObject({ name: 'Cave', cols: 3, rows: 2, tileWidth: 16, tileHeight: 16, margin: 1, spacing: 2, origin: { x: -2, y: 0 } })
    expect(map.layers).toEqual([
      { name: 'Ground', kind: 'tiles', visible: true, cells: [-1, -1, -1, -1, 7, -1] },
      { name: 'Collision', kind: 'collision', visible: true, cells: [-1, -1, -1, -1, -1, 0] },
    ])
  })

  it('needs a tileset, and a saved map keeps its link', () => {
    expect(() => mapFromDoc(createDoc())).toThrow(/tileset/)
    const back = normalizeDoc(JSON.parse(JSON.stringify({ ...createDoc(), link: { project: 'p1', node: 'n4' } })))
    expect(back.link).toEqual({ project: 'p1', node: 'n4' })
    expect(normalizeDoc(createDoc()).link).toBe(null)
  })
})
