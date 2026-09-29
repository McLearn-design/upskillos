import { describe, expect, it } from 'vitest'
import { SNIPPET_CATEGORIES } from '../../../labs/codelens/codelens/snippets'
import { buildProgramModel } from '../parser/jsParser.js'
import { run } from './interpreter.js'

const lessonModules = import.meta.glob(
  '../../../labs/dsa-patterns/lessons/lesson-*.js',
  { eager: true },
)

function codelensActivities() {
  return Object.entries(lessonModules).flatMap(([path, module]) =>
    (module.lesson?.segments ?? [])
      .filter(segment => segment.type === 'codelens')
      .map(segment => ({ path, ...segment })),
  )
}

describe('CodeLens JavaScript compatibility', () => {
  it('runs every example in the CodeLens library', () => {
    const failures = SNIPPET_CATEGORIES.flatMap(category =>
      category.items.flatMap(example => {
        const result = run(example.code)
        return result.error
          ? [`${category.group} / ${example.name}: ${result.error.message}`]
          : []
      }),
    )

    expect(failures).toEqual([])
  })

  it('runs every DSA course handoff', () => {
    const activities = codelensActivities()
    const failures = activities.flatMap(activity => {
      const result = run(activity.code ?? '')
      return result.error
        ? [`${activity.path} / ${activity.id}: ${result.error.message}`]
        : []
    })

    expect(activities.length).toBeGreaterThan(0)
    expect(failures).toEqual([])
  })

  it('supports standard helpers used by DSA examples', () => {
    const result = run(`
const rows = Array.from({ length: 3 }, (_, i) => ['k' + i, i + 1])
const object = Object.fromEntries(rows)
const map = new Map()
map.set('a', object.k0)
map.set('b', object.k1)
for (const [key, value] of map) console.log(key, value)
const initialized = new Map([['c', 3]])
const set = new Set(['x', 'y'])
console.log(initialized.get('c'), [...set].join(','))
`)

    expect(result.error).toBeNull()
    expect(result.output).toEqual(['a 1', 'b 2', '3 x,y'])
  })

  it('binds destructured callback parameters', () => {
    const result = run(`
const pairs = [['alpha', 1], ['beta', 2]]
const found = pairs.find(([key]) => key === 'beta')
console.log(found[1])
`)

    expect(result.error).toBeNull()
    expect(result.output).toEqual(['2'])
  })

  it('does not invent complexity labels from syntax', () => {
    const model = buildProgramModel(`
function binarySearch(values, target) {
  let low = 0
  let high = values.length - 1
  while (low <= high) {
    const middle = Math.floor((low + high) / 2)
    if (values[middle] === target) return middle
    if (values[middle] < target) low = middle + 1
    else high = middle - 1
  }
  return -1
}
`)

    expect(model.callGraph.nodes[0].complexity).toBeUndefined()
  })
})
