import { describe, expect, it } from 'vitest'
import { describeRule, ruleEffect, ruleStats } from './conditional.js'

const marked = (rule, values) => {
  const stats = ruleStats(rule, values)
  return values.filter((v) => ruleEffect(rule, v, stats))
}
const scores = [55, 72, 91, 40, 88, 72, null, 'absent']

describe('conditional formatting rules', () => {
  it('highlights values passing a comparison', () => {
    expect(marked({ kind: 'compare', op: '>', value: 70 }, scores)).toEqual([72, 91, 88, 72])
    expect(marked({ kind: 'compare', op: 'between', value: 50, value2: 75 }, scores)).toEqual([55, 72, 72])
    expect(marked({ kind: 'compare', op: 'contains', value: 'ABS' }, scores)).toEqual(['absent'])
    expect(marked({ kind: 'compare', op: '=', value: 72 }, scores)).toEqual([72, 72])
  })

  it('marks the top and bottom N, ties included as in Excel', () => {
    expect(marked({ kind: 'top', count: 2 }, scores)).toEqual([91, 88])
    expect(marked({ kind: 'top', count: 3, bottom: true }, scores)).toEqual([55, 72, 40, 72]) // 40, 55, 72 and the tied 72
    expect(marked({ kind: 'top', count: 3 }, [5, 4, 4, 4, 1])).toEqual([5, 4, 4, 4])
    expect(marked({ kind: 'top', count: 50, percent: true }, [1, 2, 3, 4])).toEqual([3, 4])
  })

  it('compares with the average of the numbers', () => {
    // mean of 55, 72, 91, 40, 88, 72 = 69.67
    expect(marked({ kind: 'average' }, scores)).toEqual([72, 91, 88, 72])
    expect(marked({ kind: 'average', below: true }, scores)).toEqual([55, 40])
  })

  it('finds repeated values, ignoring case and blanks', () => {
    expect(marked({ kind: 'duplicate' }, ['Ann', 'ann', 'Bo', null, null, 3, 3])).toEqual(['Ann', 'ann', 3, 3])
    expect(marked({ kind: 'duplicate', unique: true }, ['Ann', 'ann', 'Bo', 3])).toEqual(['Bo', 3])
  })

  it('shades a scale from the lowest to the highest number', () => {
    const rule = { kind: 'scale' }
    const stats = ruleStats(rule, [0, 50, 100])
    const fills = [0, 50, 100].map((v) => ruleEffect(rule, v, stats).fill)
    expect(new Set(fills).size).toBe(3)
    expect(ruleEffect(rule, 'text', stats)).toBeNull()
  })

  it('sizes data bars by the share of the largest value', () => {
    const rule = { kind: 'bar' }
    const stats = ruleStats(rule, [10, 25, 50])
    expect([10, 25, 50].map((v) => ruleEffect(rule, v, stats).bar)).toEqual([0.2, 0.5, 1])
  })

  it('describes itself in words', () => {
    expect(describeRule({ kind: 'compare', op: '>', value: 70 })).toBe('Values greater than 70')
    expect(describeRule({ kind: 'top', count: 10, percent: true, bottom: true })).toBe('Bottom 10% values')
  })
})
