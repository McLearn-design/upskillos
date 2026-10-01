// The example maps run on the map API and make what they say.
import { describe, expect, it } from 'vitest'
import { createDoc } from './tilemapDoc.js'
import { buildTileset } from './tileset.js'
import { runMapCode } from './mapApi.js'
import { EXAMPLES } from './examples.js'

const tileset = buildTileset({ dataUrl: 'data:image/png;base64,', imageWidth: 192, imageHeight: 176, tileW: 16, tileH: 16, name: 'tilemap_packed.png' })
const make = (ex) => runMapCode({ ...createDoc({ cols: ex.cols, rows: ex.rows, name: ex.title }), tileset }, ex.code)
const at = (doc, layer, x, y) => doc.layers.find((l) => l.name === layer).cells[y * doc.cols + x]

describe('example maps', () => {
  it('the dungeon room: floor, a wall all round with a doorway, and the walls solid', () => {
    const d = make(EXAMPLES.find((e) => e.id === 'dungeon-room'))
    expect(d.layers.map((l) => l.name)).toEqual(['Ground', 'Walls', 'Collision'])
    expect(at(d, 'Ground', 5, 5)).toBe(48)
    expect(at(d, 'Walls', 0, 0)).toBe(40)
    expect(at(d, 'Walls', 5, 5)).toBe(-1)
    expect(at(d, 'Walls', 10, 11)).toBe(-1)   // the doorway
    expect(at(d, 'Collision', 0, 5)).toBe(0)
    expect(at(d, 'Collision', 10, 11)).toBe(-1)
  })

  it('the maze: every room reached, by exactly one path (a tree: open cells − 1 joins)', () => {
    const d = make(EXAMPLES.find((e) => e.id === 'maze'))
    const open = (x, y) => at(d, 'Ground', x, y) === 48
    let rooms = 0, cellsOpen = 0, joins = 0
    for (let y = 0; y < d.rows; y++) for (let x = 0; x < d.cols; x++) {
      if (!open(x, y)) { expect(at(d, 'Collision', x, y)).toBe(0); continue }
      cellsOpen++
      if (x % 2 && y % 2) rooms++
      if (x + 1 < d.cols && open(x + 1, y)) joins++
      if (y + 1 < d.rows && open(x, y + 1)) joins++
    }
    expect(rooms).toBe(((d.cols - 1) / 2) * ((d.rows - 1) / 2))   // all 60 rooms
    expect(joins).toBe(cellsOpen - 1)                             // connected with no loops
  })
})
