// @vitest-environment happy-dom
// GUI → code in Sprite Forge (spriteApi.js, src/utils/useCommandHistory.js): every edit is a line of code,
// and running the logged lines on the sprite the session started from makes the same sprite.
import { act as reactAct, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { createDoc } from './pixelDoc.js'
import { cmd, runSpriteCode } from './spriteApi.js'
import { useSpriteDoc } from './useSpriteDoc.js'

const content = (d) => JSON.stringify({ ...d, id: 0, updatedAt: 0, frames: d.frames.map((f) => ({ ...f, id: 0, name: f.name.replace(/ copy$/, ''), pixels: Array.from(f.pixels) })) })
const painted = (d, frame, edits) => { const px = d.frames[frame].pixels.slice(); for (const [x, y, v] of edits) px[y * d.width + x] = v; return px }

describe('every edit is a line of code', () => {
  it('replaying the log on the starting sprite makes the same sprite', () => {
    const start = createDoc({ width: 8, height: 8, name: 'Hero' })
    let doc = start
    const log = []
    const edit = (make) => { const c = make(doc); doc = c.run(doc); log.push(c.code) }
    edit((d) => cmd.paint(d, 0, painted(d, 0, [[1, 1, 2], [2, 1, 2], [3, 6, 5]])))
    edit((d) => cmd.addFrame(d, 0, { copy: true }))
    edit((d) => cmd.flipH(d, 1))
    edit((d) => cmd.nudge(d, 0, 1, 'all'))
    edit((d) => cmd.rotate(d, 0))
    edit((d) => cmd.color(d, 1, '#ff004d'))
    edit((d) => cmd.addColor(d, '#123456'))
    edit((d) => cmd.frame(d, 1, { duration: 150 }))
    edit((d) => cmd.addFrame(d, 1))
    edit((d) => cmd.moveFrame(d, 2, 0))
    edit((d) => cmd.tags(d, [{ name: 'walk', from: 1, to: 2 }]))
    edit((d) => cmd.removeColor(d, 4))
    edit((d) => cmd.resize(d, 10, 9))
    edit((d) => cmd.importFrames(d, 'append', [new Uint8Array(90).fill(3)], null))
    edit((d) => cmd.clear(d, 0))
    expect(log[0]).toBe('sprite.paint(0, [[1,1,2],[2,1,2],[3,6,5]])')
    expect(content(runSpriteCode(start, log.join('\n')))).toBe(content(doc))
  })

  it('says what is wrong with bad code, and a loop is code too', () => {
    const doc = createDoc({ width: 4, height: 4 })
    expect(() => runSpriteCode(doc, 'sprite.paint(3, [[0, 0, 1]])')).toThrow(/no frame 3/)
    expect(() => runSpriteCode(doc, 'sprite.paint(0, [[9, 0, 1]])')).toThrow(/outside the 4 × 4/)
    expect(() => runSpriteCode(doc, 'sprite.paint(0, [[0, 0, 99]])')).toThrow(/no colour 99/)
    const lined = runSpriteCode(doc, 'for (let x = 0; x < sprite.width; x++) sprite.paint(0, [[x, sprite.height - 1, 2]])')
    expect(Array.from(lined.frames[0].pixels.slice(12))).toEqual([2, 2, 2, 2])
  })
})

describe('the editor\'s log follows undo and redo', () => {
  it('act logs; undo and redo move the line; the log replays to the sprite on screen', () => {
    const start = createDoc({ width: 6, height: 6 })
    const { result } = renderHook(() => useSpriteDoc(start))
    const act = (make) => reactAct(() => { expect(result.current.act(make)).toBe(null) })
    act((d) => cmd.paint(d, 0, painted(d, 0, [[2, 2, 3]])))
    act((d) => cmd.flipV(d, 'all'))
    reactAct(() => result.current.undo())
    expect(result.current.log.map((e) => e.code)).toEqual(['sprite.paint(0, [[2,2,3]])'])
    reactAct(() => result.current.redo())
    expect(result.current.log.map((e) => e.code)).toEqual(['sprite.paint(0, [[2,2,3]])', 'sprite.flipV("all")'])
    expect(content(runSpriteCode(start, result.current.log.map((e) => e.code).join('\n')))).toBe(content(result.current.doc))
  })
})
