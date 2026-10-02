// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { runCode, sameValue, usesMath, usesThree } from './runtime.js'

const run = (code, opts = {}) => runCode(code, { el: document.createElement('div'), ...opts })

describe('runCode', () => {
  it('returns the value of a top-level return, and supports await', async () => {
    const r = await run('await new Promise(r => setTimeout(r, 5)); return 6 * 7')
    expect(r.error).toBeNull()
    expect(r.value).toBe(42)
  })

  it('captures log and table output', async () => {
    const r = await run("log('n', 3); table([{ a: 1, b: 'x' }])")
    expect(r.logs[0]).toEqual({ level: 'log', text: 'n 3' })
    expect(r.logs[1].level).toBe('table')
    expect(r.logs[1].text).toContain('a')
  })

  it('reports syntax and runtime errors instead of throwing', async () => {
    const syntax = await run('return (')
    expect(syntax.error).toBeInstanceOf(SyntaxError)
    expect(syntax.logs.at(-1).level).toBe('error')
    const runtime = await run('null.x')
    expect(runtime.error).toBeInstanceOf(TypeError)
  })

  it('lets lesson code reuse helper names such as table and width', async () => {
    const r = await run('const table = 1; const width = 2; return table + width')
    expect(r.error).toBeNull()
    expect(r.value).toBe(3)
  })

  it('passes slider values in as params and draws into el', async () => {
    const el = document.createElement('div')
    const r = await runCode("frame(); return params.n", { el, params: { n: 5 } })
    expect(r.value).toBe(5)
    expect(el.querySelector('svg')).not.toBeNull()
  })

  it('runs cleanup callbacks and stops animation on dispose', async () => {
    const calls = []
    globalThis.__wdsCalls = calls
    const r = await run('onCleanup(() => globalThis.__wdsCalls.push("cleaned"))')
    r.dispose()
    r.dispose()
    expect(calls).toEqual(['cleaned'])
    delete globalThis.__wdsCalls
  })

  it('gives every run a fresh copy of the data', async () => {
    await run("load('students')[0].score = -1")
    const r = await run("return load('students')[0].score")
    expect(r.value).not.toBe(-1)
  })
})

describe('library detection', () => {
  it('loads three.js and math.js only when the code uses them', () => {
    expect(usesThree('const s = new THREE.Scene()')).toBe(true)
    expect(usesThree('const threeThings = 3')).toBe(false)
    expect(usesMath('math.multiply(a, b)')).toBe(true)
    expect(usesMath('Math.max(1, 2)')).toBe(false)
  })
})

describe('sameValue', () => {
  it('compares numbers with a relative tolerance', () => {
    expect(sameValue(100.00001, 100, 1e-6)).toBe(true)
    expect(sameValue(101, 100, 1e-6)).toBe(false)
    expect(sameValue(103, 100, 0.05)).toBe(true)
    expect(sameValue('100', 100)).toBe(false)
    expect(sameValue(NaN, 100)).toBe(false)
  })

  it('compares arrays and objects deeply, including nulls', () => {
    expect(sameValue([[1, null], [3, 4]], [[1, null], [3, 4]])).toBe(true)
    expect(sameValue([1, 2], [1, 2, 3])).toBe(false)
    expect(sameValue({ a: 1, b: [2] }, { a: 1, b: [2] })).toBe(true)
    expect(sameValue({ a: 1 }, { a: 1, b: 2 })).toBe(false)
    expect(sameValue(null, { a: 1 })).toBe(false)
  })
})

describe('overlapping runs', () => {
  it('a superseded run does not clear or interrupt the newer one', async () => {
    const el = document.createElement('div')
    const first = runCode('await new Promise(r => setTimeout(r, 20)); el.append("old")', { el })
    const second = await runCode('el.append("new")', { el })
    const late = await first
    late.dispose()
    expect(el.textContent).toBe('new')
    second.dispose()
  })
})
