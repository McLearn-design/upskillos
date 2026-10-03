import { describe, expect, it } from 'vitest'
import { Workbook } from './workbook.js'
import { BLANKS, columnValues, compareValues, hiddenRows, looksLikeHeader, removeDuplicates, sortRows } from './data.js'
import { err } from './values.js'

function book(rows) {
  const wb = new Workbook()
  const sheet = wb.sheets[0]
  wb.setCells(rows.flatMap((r, i) => r.map((input, c) => ({ sheetId: sheet.id, row: i, col: c, input }))))
  const args = { sheetId: sheet.id, read: (r, c) => wb.valueAt(sheet, r, c), cellAt: (r, c) => wb.getCell(sheet.id, r, c) }
  const column = (c, n = rows.length) => Array.from({ length: n }, (_, r) => wb.getCell(sheet.id, r, c)?.input ?? '')
  return { wb, sheet, args, column }
}

describe('sort order', () => {
  it('puts numbers before text, text before logicals, then errors', () => {
    const values = ['b', true, 3, err('#N/A'), 'A', false, 1]
    expect([...values].sort(compareValues).map((v) => (typeof v === 'object' ? v.code : String(v)))).toEqual(['1', '3', 'A', 'b', 'false', 'true', '#N/A'])
  })

  it('spots a row of headings', () => {
    expect(looksLikeHeader([['Name', 'Score'], ['Ann', 9]])).toBe(true)
    expect(looksLikeHeader([['Ann', 'Bo'], ['Cy', 'Di']])).toBe(false)
    expect(looksLikeHeader([[1, 2], [3, 4]])).toBe(false)
  })
})

describe('sorting rows', () => {
  it('moves whole rows, keeps headings at the top and blanks at the bottom', () => {
    const { wb, args, column } = book([['Name', 'Score'], ['Cy', '7'], ['Ann', ''], ['Bo', '9']])
    const { changes, message } = sortRows({ ...args, range: { r1: 0, c1: 0, r2: 3, c2: 1 }, keys: [{ col: 1, descending: true }], header: true })
    wb.setCells(changes)
    expect(column(0)).toEqual(['Name', 'Bo', 'Cy', 'Ann'])
    expect(column(1)).toEqual(['Score', '9', '7', ''])
    expect(message).toMatch(/Row 1 looks like headings/)
    wb.undo()
    expect(column(0)).toEqual(['Name', 'Cy', 'Ann', 'Bo'])
  })

  it('moves a formula the way copying it would', () => {
    const { wb, args, column } = book([['3', '=A1*2'], ['1', '=A2*2'], ['2', '=A3*2']])
    wb.setCells(sortRows({ ...args, range: { r1: 0, c1: 0, r2: 2, c2: 1 }, keys: [{ col: 0 }], header: false }).changes)
    expect(column(1)).toEqual(['=A1*2', '=A2*2', '=A3*2'])
    expect([0, 1, 2].map((r) => wb.valueAt(wb.sheets[0], r, 1))).toEqual([2, 4, 6])
  })

  it('breaks ties with the next key, and keeps equal rows in order', () => {
    const { wb, args, column } = book([['x', '2'], ['y', '1'], ['x', '1'], ['y', '1']])
    wb.setCells(sortRows({ ...args, range: { r1: 0, c1: 0, r2: 3, c2: 1 }, keys: [{ col: 0 }, { col: 1 }], header: false }).changes)
    expect(column(0).map((x, i) => x + column(1)[i])).toEqual(['x1', 'x2', 'y1', 'y1'])
  })

  it('carries code cells with their row', () => {
    const { wb, sheet, args } = book([['2', ''], ['1', '']])
    wb.setCells([{ sheetId: sheet.id, row: 0, col: 1, code: { lang: 'js', source: 'return 1' } }])
    wb.setCells(sortRows({ ...args, range: { r1: 0, c1: 0, r2: 1, c2: 1 }, keys: [{ col: 0 }], header: false }).changes)
    expect(wb.getCell(sheet.id, 1, 1)?.code?.source).toBe('return 1')
    expect(wb.getCell(sheet.id, 0, 1)?.code).toBeUndefined()
  })
})

describe('removing duplicates', () => {
  it('keeps the first of each repeated row and closes the gaps', () => {
    const { wb, args, column } = book([['Name', 'City'], ['Ann', 'Leeds'], ['ann', 'LEEDS'], ['Bo', 'York'], ['Ann', 'York']])
    const r = removeDuplicates({ ...args, range: { r1: 0, c1: 0, r2: 4, c2: 1 }, header: true })
    wb.setCells(r.changes)
    expect(r.removed).toBe(1)
    expect(column(0)).toEqual(['Name', 'Ann', 'Bo', 'Ann', ''])
    expect(column(1)).toEqual(['City', 'Leeds', 'York', 'York', ''])
    expect(r.message).toMatch(/Removed 1 duplicate row; 3 unique rows remain/)
  })
})

describe('filters', () => {
  const rows = [['Name', 'City', 'Age'], ['Ann', 'Leeds', '31'], ['Bo', 'York', '25'], ['Cy', 'Leeds', ''], ['Di', 'Hull', '25']]
  const range = { r1: 0, c1: 0, r2: 4, c2: 2 }

  it('lists the different values in a column with their counts, blanks last', () => {
    const { args } = book(rows)
    expect(columnValues(range, 1, args.read)).toEqual([{ key: 'Hull', count: 1 }, { key: 'Leeds', count: 2 }, { key: 'York', count: 1 }])
    expect(columnValues(range, 2, args.read)).toEqual([{ key: '25', count: 2 }, { key: '31', count: 1 }, { key: BLANKS, count: 1 }])
  })

  it('hides rows whose value is unticked, combining columns', () => {
    const { args } = book(rows)
    expect([...hiddenRows({ hidden: { 1: ['Leeds'] } }, range, args.read)]).toEqual([1, 3])
    expect([...hiddenRows({ hidden: { 1: ['Leeds'], 2: ['25'] } }, range, args.read)]).toEqual([1, 2, 3, 4])
    expect(hiddenRows({ hidden: {} }, range, args.read).size).toBe(0)
  })
})
