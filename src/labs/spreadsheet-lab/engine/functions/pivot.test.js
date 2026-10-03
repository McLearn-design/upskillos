import { describe, expect, it } from 'vitest'
import { Workbook } from '../workbook.js'
import { literal } from '../values.js'

const TABLE = [
  ['Region', 'Item', 'Units'],
  ['North', 'Pens', '10'],
  ['South', 'Pens', '4'],
  ['North', 'Ink', '3'],
  ['south', 'Ink', '6'],
  ['North', 'Pens', '5'],
]

function run(formula) {
  const wb = new Workbook()
  const s = wb.sheets[0]
  wb.setCells(TABLE.flatMap((r, i) => r.map((input, c) => ({ sheetId: s.id, row: i, col: c, input }))))
  wb.setCells([{ sheetId: s.id, row: 0, col: 5, input: formula }])
  const v = wb.getCell(s.id, 0, 5).value
  return v?.rows ? v.rows.map((r) => r.map((x) => (typeof x === 'object' && x ? literal(x) : x))) : literal(v)
}

describe('GROUPBY', () => {
  it('totals each group, with headers and a grand total', () => {
    expect(run('=GROUPBY(A1:A6, C1:C6, SUM)')).toEqual([['Region', 'Units'], ['North', 18], ['South', 10], ['Total', 28]])
  })

  it('takes AVERAGE, COUNT or a LAMBDA, and sorts by the value when asked', () => {
    expect(run('=GROUPBY(A2:A6, C2:C6, AVERAGE, 0, 0)')).toEqual([['North', 6], ['South', 5]])
    expect(run('=GROUPBY(B2:B6, C2:C6, COUNT, 0, 0)')).toEqual([['Ink', 2], ['Pens', 3]])
    expect(run('=GROUPBY(A2:A6, C2:C6, LAMBDA(x, MAX(x) - MIN(x)), 0, 0)')).toEqual([['North', 7], ['South', 2]])
    expect(run('=GROUPBY(B2:B6, C2:C6, SUM, 0, 0, -2)')).toEqual([['Pens', 19], ['Ink', 9]])
  })

  it('groups by two fields', () => {
    // Text is grouped ignoring case; a group shows the spelling it first met ("south" in row 5).
    expect(run('=GROUPBY(A2:B6, C2:C6, SUM, 0, 0)')).toEqual([['North', 'Ink', 3], ['North', 'Pens', 15], ['south', 'Ink', 6], ['South', 'Pens', 4]])
  })

  it('keeps only the rows a filter allows', () => {
    expect(run('=GROUPBY(A2:A6, C2:C6, SUM, 0, 0, , B2:B6="Pens")')).toEqual([['North', 15], ['South', 4]])
  })

  it('explains a missing function', () => {
    expect(run('=GROUPBY(A2:A6, C2:C6, 5)')).toBe('#VALUE!')
  })
})

describe('PIVOTBY', () => {
  it('cross-tabulates with row and column totals', () => {
    expect(run('=PIVOTBY(A1:A6, B1:B6, C1:C6, SUM)')).toEqual([
      ['Region', 'Ink', 'Pens', 'Total'],
      ['North', 3, 15, 18],
      ['South', 6, 4, 10],
      ['Total', 9, 19, 28],
    ])
  })

  it('leaves a cell empty where no rows meet', () => {
    expect(run('=PIVOTBY(A2:A5, B2:B5, C2:C5, SUM, 0, 0, , 0)')).toEqual([['', 'Ink', 'Pens'], ['North', 3, 10], ['South', 6, 4]])
  })
})

describe('functions as values', () => {
  it('passes a bare function name to MAP and BYROW', () => {
    expect(run('=MAP(C2:C3, SQRT)')).toEqual([[Math.sqrt(10)], [2]])
    expect(run('=BYROW(C2:C3, SUM)')).toEqual([[10], [4]])
  })
})

describe('a function on its own in a cell', () => {
  it('is #CALC!, with a hint to add brackets', () => {
    expect(run('=SUM')).toBe('#CALC!')
  })
})
