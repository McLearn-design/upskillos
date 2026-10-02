import { describe, expect, it } from 'vitest'
import { adjustForCols, adjustForRows, shiftFormula } from './rewrite.js'

describe('copying a formula moves its relative references', () => {
  it.each([
    ['=A1*2', 1, 0, '=A2*2'],
    ['=A1*2', 0, 1, '=B1*2'],
    ['=$A$1*2', 5, 5, '=$A$1*2'],
    ['=$A1+A$1', 2, 3, '=$A3+D$1'],
    ['=SUM(A1:B2)', 1, 1, '=SUM(B2:C3)'],
    ['=SUM($A$1:A1)', 4, 0, '=SUM($A$1:A5)'], // the running-total pattern
    ['=Sheet2!A1+1', 1, 0, '=Sheet2!A2+1'],
    ["='My Data'!B2", 0, 1, "='My Data'!C2"],
    ['=SUM(A:A)', 3, 1, '=SUM(B:B)'],
    ['=SUM(1:1)', 2, 3, '=SUM(3:3)'],
    ['=A1#', 1, 0, '=A2#'],
    ['="A1"&A1', 1, 0, '="A1"&A2'], // text that looks like a reference is left alone
    ['=LOG10(A1)', 1, 0, '=LOG10(A2)'], // a function name that looks like a cell is left alone
  ])('%s moved (%i, %i) is %s', (input, dr, dc, expected) => {
    expect(shiftFormula(input, dr, dc)).toBe(expected)
  })

  it('gives #REF! when a reference would move off the sheet', () => {
    expect(shiftFormula('=A1+1', -1, 0)).toBe('=#REF!+1')
    expect(shiftFormula('=SUM(A1:A3)', 0, -1)).toBe('=SUM(#REF!)')
  })

  it('leaves plain values alone, and still moves references in an unfinished formula', () => {
    expect(shiftFormula('42', 1, 1)).toBe('42')
    expect(shiftFormula('=SUM(A1', 1, 0)).toBe('=SUM(A2')
  })
})

describe('inserting and deleting rows and columns', () => {
  const rows = (input, at, count, sheetName = 'Sheet1', formulaSheet = 'Sheet1') => adjustForRows(input, { formulaSheet, sheetName, at, count })

  it('moves references below an inserted row, even absolute ones', () => {
    expect(rows('=A1+A5+$A$5', 2, 1)).toBe('=A1+A6+$A$6')
    expect(rows('=SUM(A1:A5)', 2, 3)).toBe('=SUM(A1:A8)') // a range grows when rows go inside it
  })

  it('turns references to deleted rows into #REF! and shrinks ranges', () => {
    expect(rows('=A3', 2, -1)).toBe('=#REF!')
    expect(rows('=A5', 2, -1)).toBe('=A4')
    expect(rows('=SUM(A1:A10)', 4, -3)).toBe('=SUM(A1:A7)')
    expect(rows('=SUM(A3:A5)', 2, -3)).toBe('=SUM(#REF!)')
    expect(rows('=SUM(A2:A10)', 0, -3)).toBe('=SUM(A1:A7)')
  })

  it('only changes references to the sheet that changed', () => {
    expect(rows('=Data!A5+A5', 2, 1, 'Data')).toBe('=Data!A6+A5')
    expect(rows('=A5', 2, 1, 'Data')).toBe('=A5')
  })

  it('does the same for columns', () => {
    expect(adjustForCols('=C1+A1', { formulaSheet: 'Sheet1', sheetName: 'Sheet1', at: 1, count: 1 })).toBe('=D1+A1')
    expect(adjustForCols('=SUM(A1:D1)', { formulaSheet: 'Sheet1', sheetName: 'Sheet1', at: 1, count: -2 })).toBe('=SUM(A1:B1)')
  })
})
