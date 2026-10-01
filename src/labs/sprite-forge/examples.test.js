// The example sprites run on the sprite API and draw what they say.
import { describe, expect, it } from 'vitest'
import { createDoc } from './pixelDoc.js'
import { runSpriteCode } from './spriteApi.js'
import { EXAMPLES } from './examples.js'

const make = (id) => { const ex = EXAMPLES.find((e) => e.id === id); return runSpriteCode(createDoc({ width: ex.width, height: ex.height, name: ex.title }), ex.code) }
const px = (d, f, x, y) => d.frames[f].pixels[y * d.width + x]

describe('example sprites', () => {
  it('the heart: red inside, outlined, empty corners, symmetric left to right but for the shine', () => {
    const d = make('heart')
    expect(px(d, 0, 8, 8)).toBe(9)
    expect(px(d, 0, 0, 0)).toBe(0)
    expect(px(d, 0, 15, 15)).toBe(0)
    const values = new Set(d.frames[0].pixels)
    expect([...values].sort()).toEqual([0, 3, 8, 9])
    for (let y = 6; y < 16; y++) for (let x = 0; x < 8; x++) expect(px(d, 0, x, y)).toBe(px(d, 0, 15 - x, y))
  })

  it('the coin: four frames, narrowest when nearly edge-on, tagged "spin"', () => {
    const d = make('coin')
    expect(d.frames).toHaveLength(4)
    const width = (f) => [...Array(16).keys()].filter((x) => px(d, f, x, 8) !== 0).length
    expect(width(0)).toBe(14)
    expect(width(2)).toBeLessThan(width(1))
    expect(width(1)).toBe(width(3))   // |cos 45°| = |cos 135°|
    expect(d.tags).toEqual([{ name: 'spin', from: 0, to: 3 }])
    expect(d.frames.every((f) => f.duration === 120)).toBe(true)
  })
})
