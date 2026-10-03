import { describe, expect, it } from 'vitest'
import { codeLanguageFromInput, codeReferences, matlabResultName, sheetValue, shapeForCode, substituteMatlab } from './code.js'

describe('code cells', () => {
  it('recognises =PY(, =JS( and =MATLAB( as the start of a code cell', () => {
    expect(codeLanguageFromInput('=PY(')).toBe('py')
    expect(codeLanguageFromInput('=py(')).toBe('py')
    expect(codeLanguageFromInput('=JS(')).toBe('js')
    expect(codeLanguageFromInput('=MATLAB(')).toBe('matlab')
    expect(codeLanguageFromInput('=PMT(')).toBe(null)
    expect(codeLanguageFromInput('PY(')).toBe(null)
  })

  it('finds the cells a piece of code reads', () => {
    expect(codeReferences('a = xl("A1:B5")\nb = xl(\'C3\') + xl("Data!D2")')).toEqual(['A1:B5', 'C3', 'Data!D2'])
    expect(codeReferences("x = xl(\"'My data'!A1:A3\")")).toEqual(["'My data'!A1:A3"])
    expect(codeReferences('xl(name)')).toEqual([])
  })

  it('ignores xl() in comments, so an example in a comment is not a reference', () => {
    expect(codeReferences('# like xl("A1:B5")\nx = xl("C1")  # not xl("D1")', 'py')).toEqual(['C1'])
    expect(codeReferences('// xl("A1")\n/* xl("B1") */ return xl("C1") // xl("D1")', 'js')).toEqual(['C1'])
    expect(codeReferences('% xl("A1")\nv = xl("C1"); % xl("D1")', 'matlab')).toEqual(['C1'])
    expect(codeReferences('s = "# not a comment"\nv = xl("C1")', 'py')).toEqual(['C1'])
  })

  it('gives code a single value, a flat list or a list of rows', () => {
    expect(shapeForCode([[5]])).toBe(5)
    expect(shapeForCode([[1, 2, 3]])).toEqual([1, 2, 3])
    expect(shapeForCode([[1], [2], [3]])).toEqual([1, 2, 3])
    expect(shapeForCode([[1, 2], [3, 4]])).toEqual([[1, 2], [3, 4]])
  })

  it('turns what code returns into sheet values', () => {
    expect(sheetValue(42)).toEqual({ value: 42 })
    expect(sheetValue('hi')).toEqual({ value: 'hi' })
    expect(sheetValue(null)).toEqual({ value: null })
    expect(sheetValue(Infinity).error).toBe('#NUM!')
    expect(sheetValue([1, 2, 3])).toEqual({ rows: [[1], [2], [3]] }) // a flat list spills down
    expect(sheetValue([[1, 2], [3]])).toEqual({ rows: [[1, 2], [3, null]] })
    expect(sheetValue({ __table__: true, columns: ['x', 'y'], rows: [[1, 2]] })).toEqual({ rows: [['x', 'y'], [1, 2]] })
    expect(sheetValue({ a: 1, b: 'two' })).toEqual({ rows: [['a', 1], ['b', 'two']] })
  })
})

describe('MATLAB cells', () => {
  it('replaces xl("…") with MATLAB literals', () => {
    const inputs = { 'A1:B2': [[1, 2], [3, 4]], 'C1:C3': [1, 2, 3], D1: 7, 'E1:E2': ['a', 'b'] }
    expect(substituteMatlab('m = xl("A1:B2");', inputs)).toBe('m = [1 2; 3 4];')
    expect(substituteMatlab('v = xl("C1:C3")', inputs)).toBe('v = [1; 2; 3]')
    expect(substituteMatlab("x = xl('D1') * 2", inputs)).toBe('x = 7 * 2')
    expect(substituteMatlab('n = xl("E1:E2")', inputs)).toBe('n = ["a"; "b"]')
  })

  it('leaves xl() in comments alone, and is not confused by the transpose operator', () => {
    expect(substituteMatlab('% example: xl("Z9")\nv = xl("C1:C3")\'; % xl("Q1")', { 'C1:C3': [1, 2, 3] })).toBe('% example: xl("Z9")\nv = [1; 2; 3]\'; % xl("Q1")')
    expect(substituteMatlab("A = B'; x = xl('D1') % it's fine", { D1: 7 })).toBe("A = B'; x = 7 % it's fine")
  })

  it('explains a range that mixes numbers and text', () => {
    expect(() => substituteMatlab('x = xl("A1:A2")', { 'A1:A2': [1, 'a'] })).toThrow(/one type/)
  })

  it('takes the value of the last line', () => {
    expect(matlabResultName('x = 1;\ny = x + 1;')).toBe('y')
    expect(matlabResultName('x = 1;\nx * 2')).toBe('ans')
    expect(matlabResultName('[m, i] = max(v)')).toBe('m')
    expect(matlabResultName('a = 3\nif a == 3 % comment\nend')).toBe('ans')
    expect(matlabResultName('v = 1:3;\nv(2) = 9;')).toBe('v')
  })
})
