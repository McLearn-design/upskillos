// @vitest-environment happy-dom
// Runs every lesson's figure, starter code and solution through the real
// runtime. Lessons that draw with WebGL (three.js) are only parsed here:
// happy-dom has no WebGL, so those are checked in a real browser.
import { describe, expect, it, beforeAll } from 'vitest'
import * as acorn from 'acorn'
import { LESSONS, parseLesson } from './lessons.js'
import { runCode, sameValue, usesThree } from './runtime.js'
import { DATASETS, datasetCsv, rng } from './data.js'

beforeAll(() => {
  globalThis.requestAnimationFrame ??= (fn) => setTimeout(() => fn(performance.now()), 16)
  globalThis.cancelAnimationFrame ??= (id) => clearTimeout(id)
})

const parse = (code) => acorn.parse('(async function(){\n' + code + '\n})', { ecmaVersion: 'latest' })
const defaults = (lesson) => Object.fromEntries(lesson.controls.map((c) => [c.name, c.value]))

async function run(code, params) {
  const el = document.createElement('div')
  document.body.appendChild(el)
  const result = await runCode(code, { el, params })
  result.dispose()
  el.remove()
  return result
}

describe('lesson files', () => {
  it('have unique ids and titles', () => {
    expect(LESSONS.length).toBeGreaterThan(0)
    const ids = LESSONS.map((l) => l.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const l of LESSONS) {
      expect(l.id, l.file).toMatch(/^wds-\d\d-[a-z0-9-]+$/)
      expect(l.title, l.file).toBeTruthy()
    }
  })

  it('rejects a lesson without a learn section', () => {
    expect(() => parseLesson('---\nid: x\n---\n<!-- code -->\n```js\nreturn 1\n```\n')).toThrow(/learn/)
  })
})

describe('datasets', () => {
  it('are deterministic', () => {
    for (const name of Object.keys(DATASETS)) expect(DATASETS[name]()).toBe(datasetCsv(name))
    const a = rng(5), b = rng(5)
    expect([a(), a(), a()]).toEqual([b(), b(), b()])
  })
})

describe.each(LESSONS.map((l) => [l.file, l]))('%s', (_file, lesson) => {
  // happy-dom has no WebGL: parts that use three.js are checked in a browser instead.
  const webgl = (part) => Boolean(lesson[part] && usesThree(lesson[part]))

  it('code parses', () => {
    for (const part of ['explore', 'code', 'solution']) if (lesson[part]) expect(() => parse(lesson[part]), part).not.toThrow()
  })

  it.skipIf(!lesson.explore || webgl('explore'))('figure runs with default and extreme slider values', async () => {
    const r = await run(lesson.explore, defaults(lesson))
    expect(r.logs.filter((l) => l.level === 'error')).toEqual([])
    for (const c of lesson.controls) {
      if (c.options) {
        for (const v of c.options) {
          const r2 = await run(lesson.explore, { ...defaults(lesson), [c.name]: v })
          expect(r2.error, c.name + '=' + v + ': ' + r2.error?.message).toBeNull()
        }
        continue
      }
      for (const v of [c.min, c.max]) {
        const r2 = await run(lesson.explore, { ...defaults(lesson), [c.name]: v })
        expect(r2.error, c.name + '=' + v + ': ' + r2.error?.message).toBeNull()
      }
    }
  })

  it.skipIf(webgl('code'))('starter code runs', async () => {
    const starter = await run(lesson.code)
    expect(starter.error, starter.error?.message).toBeNull()
  })

  it.skipIf(!lesson.task || webgl('solution'))('the solution answers the task, and the starter does not', async () => {
    const solution = await run(lesson.solution)
    expect(solution.error, solution.error?.message).toBeNull()
    expect(solution.value).not.toBeUndefined()
    expect(solution.value).not.toBeNull()
    if (!webgl('code')) {
      const starter = await run(lesson.code)
      expect(sameValue(starter.value, solution.value, lesson.tolerance)).toBe(false)
    }
  })
})
