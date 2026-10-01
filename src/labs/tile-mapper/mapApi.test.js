// @vitest-environment happy-dom
// GUI → code in Tile Mapper (mapApi.js, useTilemapDoc.js): every edit is a line of code, and running the
// logged lines on the map the session started from makes the same map, through undo and redo too.
import { act as reactAct, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { createDoc, createTerrain } from './tilemapDoc.js'
import { buildTileset } from './tileset.js'
import { cmd, runMapCode } from './mapApi.js'
import { useTilemapDoc } from './useTilemapDoc.js'

const IMAGE = 'data:image/png;base64,AAAA'
const TILESET = buildTileset({ dataUrl: IMAGE, imageWidth: 64, imageHeight: 64, tileW: 16, tileH: 16, name: 'tiles.png' })
/** What matters about a map: everything but generated ids and times. */
const content = (d) => JSON.stringify({ ...d, id: 0, updatedAt: 0, layers: d.layers.map((l) => ({ ...l, id: 0, cells: Array.from(l.cells) })), terrains: d.terrains.map((t) => ({ ...t, id: 0 })) })
const paintAt = (d, i, cells) => { const c = d.layers[i].cells.slice(); for (const [x, y, t] of cells) c[y * d.cols + x] = t; return c }

describe('every edit is a line of code', () => {
  it('replaying the log on the starting map makes the same map', () => {
    const start = createDoc({ cols: 8, rows: 6, name: 'Room' })
    let doc = start
    const log = []
    const edit = (make) => { const c = make(doc); doc = c.run(doc); log.push(c.code) }
    edit((d) => cmd.tileset(d, TILESET))
    edit((d) => cmd.paint(d, 0, paintAt(d, 0, [[0, 5, 1], [1, 5, 1], [2, 5, 2]])))
    edit((d) => cmd.addLayer(d, 'tiles'))
    edit((d) => cmd.layer(d, 2, { name: 'Decor', opacity: 0.5 }))
    edit((d) => cmd.paint(d, 2, paintAt(d, 2, [[3, 3, 7]])))
    edit((d) => cmd.duplicateLayer(d, 2))
    edit((d) => cmd.moveLayer(d, 3, 0))
    edit((d) => cmd.clearLayer(d, 0))
    edit((d) => cmd.removeLayer(d, 0))
    edit((d) => cmd.paint(d, 1, paintAt(d, 1, [[0, 5, 0], [1, 5, 0]])))   // the collision layer: solid cells
    edit((d) => cmd.resize(d, 10, 7))
    edit((d) => cmd.shift(d, 1, 0))
    edit((d) => cmd.addTerrain(d, createTerrain(0, 0, 'Grass')))
    edit((d) => cmd.terrain(d, d.terrains[0].id, { name: 'Meadow' }))
    expect(log.every((line) => line.startsWith('map.'))).toBe(true)
    expect(log[1]).toBe('map.paint("Ground", [[0,5,1],[1,5,1],[2,5,2]])')
    const replayed = runMapCode(start, log.join('\n'), { image: IMAGE })
    expect(content(replayed)).toBe(content(doc))
  })

  it('names a layer by index when two share a name, and says what is wrong with bad code', () => {
    let doc = createDoc({ cols: 4, rows: 4 })
    doc = cmd.layer(doc, 1, { name: 'Ground' }).run(doc)   // now two layers are called Ground
    expect(cmd.paint(doc, 1, paintAt(doc, 1, [[0, 0, 3]])).code).toBe('map.paint(1, [[0,0,3]])')
    expect(() => runMapCode(doc, 'map.paint("Nope", [[0, 0, 1]])')).toThrow(/no layer "Nope"/)
    expect(() => runMapCode(doc, 'map.paint(0, [[9, 9, 1]])')).toThrow(/outside the 4 × 4 map/)
    expect(() => runMapCode(createDoc(), 'map.tileset({ name: "a", tileW: 16, tileH: 16, imageWidth: 32, imageHeight: 32 })')).toThrow(/needs a picture/)
  })

  it('code typed by hand uses the same calls: a loop paints a floor', () => {
    const doc = runMapCode({ ...createDoc({ cols: 6, rows: 4 }), tileset: TILESET }, 'for (let x = 0; x < map.cols; x++) map.paint("Ground", [[x, 3, 5]])')
    expect(Array.from(doc.layers[0].cells.slice(18, 24))).toEqual([5, 5, 5, 5, 5, 5])
  })
})

describe('the editor\'s log follows undo and redo', () => {
  it('act logs each edit; undo takes the line off, redo puts it back; replaying gives the map on screen', () => {
    const start = { ...createDoc({ cols: 5, rows: 5 }), tileset: TILESET }
    const { result } = renderHook(() => useTilemapDoc(start))
    const act = (make) => reactAct(() => { expect(result.current.act(make)).toBe(null) })
    act((d) => cmd.paint(d, 0, paintAt(d, 0, [[1, 1, 4]])))
    act((d) => cmd.addLayer(d, 'tiles'))
    act((d) => cmd.paint(d, 2, paintAt(d, 2, [[2, 2, 6]])))
    expect(result.current.log.map((e) => e.code)).toEqual(['map.paint("Ground", [[1,1,4]])', 'map.addLayer("tiles")', 'map.paint("Layer 3", [[2,2,6]])'])
    reactAct(() => { result.current.undo(); result.current.undo() })
    expect(result.current.log).toHaveLength(1)
    expect(result.current.doc.layers).toHaveLength(2)
    reactAct(() => result.current.redo())
    expect(result.current.log.map((e) => e.code)).toEqual(['map.paint("Ground", [[1,1,4]])', 'map.addLayer("tiles")'])
    expect(content(runMapCode(start, result.current.log.map((e) => e.code).join('\n')))).toBe(content(result.current.doc))
    // A new edit after undo drops what was undone, from the map and from the log.
    reactAct(() => result.current.undo())
    act((d) => cmd.layer(d, 0, { visible: false }))
    expect(result.current.log.map((e) => e.code)).toEqual(['map.paint("Ground", [[1,1,4]])', 'map.layer("Ground", {"visible":false})'])
    reactAct(() => result.current.redo())
    expect(result.current.log).toHaveLength(2)
    expect(result.current.act(() => { throw new Error('no such layer') })).toBe('no such layer')
  })
})
