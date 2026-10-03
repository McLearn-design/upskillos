import { describe, expect, it } from 'vitest'
import { callAt, canInsertReference, completionAt, matchingFunctions, syntaxArgs } from './editing.js'
import { FUNCTIONS } from './functions/index.js'

const at = (s) => [s.replace('|', ''), s.indexOf('|')]

describe('autocomplete', () => {
  it('finds the function name being typed', () => {
    expect(completionAt(...at('=SUM(A1)+AV|'))).toEqual({ prefix: 'AV', start: 9 })
    expect(completionAt(...at('=vl|'))).toEqual({ prefix: 'VL', start: 1 })
  })

  it('does not treat cell references, text or values as function names', () => {
    expect(completionAt(...at('=A1|'))).toBe(null)
    expect(completionAt(...at('="hel|'))).toBe(null)
    expect(completionAt(...at('hello|'))).toBe(null)
  })

  it('suggests common functions first, then the shortest names', () => {
    expect(matchingFunctions(FUNCTIONS, 'SUM').slice(0, 4)).toEqual(['SUM', 'SUMIF', 'SUMIFS', 'SUMSQ'])
    expect(matchingFunctions(FUNCTIONS, 'AVE')[0]).toBe('AVERAGE')
  })
})

describe('the syntax hint', () => {
  it('knows which argument of which function the caret is in', () => {
    expect(callAt(...at('=ROUND(SUM(A1, B1|'))).toEqual({ name: 'SUM', argIndex: 1 })
    expect(callAt(...at('=ROUND(SUM(A1, B1), |'))).toEqual({ name: 'ROUND', argIndex: 1 })
    expect(callAt(...at('=IF(A1="a,b", |'))).toEqual({ name: 'IF', argIndex: 1 })
    expect(callAt(...at('=SUM({1,2,3}|'))).toEqual({ name: 'SUM', argIndex: 0 })
    expect(callAt(...at('=1+2|'))).toBe(null)
  })

  it('splits a syntax line into its arguments', () => {
    expect(syntaxArgs('ROUND(number, num_digits)')).toEqual(['number', 'num_digits'])
    expect(syntaxArgs('PI()')).toEqual([])
  })
})

describe('point mode', () => {
  it('allows inserting a reference after an operator, bracket or comma', () => {
    expect(canInsertReference(...at('=|'))).toBe(true)
    expect(canInsertReference(...at('=SUM(|'))).toBe(true)
    expect(canInsertReference(...at('=A1+ |'))).toBe(true)
    expect(canInsertReference(...at('=SUM(A1|'))).toBe(false)
    expect(canInsertReference(...at('="a+|'))).toBe(false)
    expect(canInsertReference(...at('abc|'))).toBe(false)
  })
})
