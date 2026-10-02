import { describe, expect, it } from 'vitest'
import { Workbook } from './workbook.js'
import { parseCell } from './address.js'
import { isMatrix } from './values.js'

// A tiny helper: set cells by A1 address, read values by A1 address.
function book(cells = {}) {
  const wb = new Workbook()
  const s = wb.sheets[0].id
  const set = (map, sheetId = s) => wb.setCells(Object.entries(map).map(([a, input]) => ({ sheetId, ...pos(a), input })))
  const get = (a, sheetId = s) => { const v = wb.getValue(sheetId, pos(a).row, pos(a).col); return v?.code ?? v }
  set(cells)
  return { wb, s, set, get }
}
const pos = (a) => { const p = parseCell(a); return { row: p.row, col: p.col } }

describe('values and recalculation', () => {
  it('calculates formulas and updates them when their inputs change', () => {
    const { set, get } = book({ A1: '2', A2: '3', A3: '=A1+A2', A4: '=A3*10' })
    expect(get('A3')).toBe(5)
    expect(get('A4')).toBe(50)
    set({ A1: '10' })
    expect(get('A3')).toBe(13)
    expect(get('A4')).toBe(130)
  })

  it('updates a formula that reads a range when a cell inside it changes', () => {
    const { set, get } = book({ A1: '1', A2: '2', A3: '3', B1: '=SUM(A1:A3)', C1: '=SUM(A:A)' })
    expect(get('B1')).toBe(6)
    expect(get('C1')).toBe(6)
    set({ A2: '20', A7: '100' })
    expect(get('B1')).toBe(24)
    expect(get('C1')).toBe(124)
  })

  it('reads an empty cell as 0 in a formula, as Excel does', () => {
    const { get } = book({ A1: '=B1', A2: '=B1&"x"' })
    expect(get('A1')).toBe(0)
    expect(get('A2')).toBe('x')
  })

  it('calculates a 5,000-row running total without running out of stack', () => {
    const cells = { A1: '1', B1: '=A1' }
    for (let r = 2; r <= 5000; r++) { cells['A' + r] = '1'; cells['B' + r] = '=B' + (r - 1) + '+A' + r }
    const { set, get } = book(cells)
    expect(get('B5000')).toBe(5000)
    set({ A1: '2' })
    expect(get('B5000')).toBe(5001)
  })

  it('handles 5,000 cumulative SUM ranges quickly', () => {
    const cells = {}
    for (let r = 1; r <= 5000; r++) { cells['A' + r] = '1'; cells['B' + r] = '=SUM(A$1:A' + r + ')' }
    const started = performance.now()
    const { set, get } = book(cells)
    set({ A1: '2' })
    expect(get('B5000')).toBe(5001)
    expect(performance.now() - started).toBeLessThan(3000)
  })

  it('evaluates formulas in dependency order regardless of where they are on the sheet', () => {
    const { get } = book({ A1: '=A2*2', A2: '=A3+1', A3: '5' })
    expect(get('A1')).toBe(12)
  })
})

describe('circular references', () => {
  it('marks every cell in a loop, and formulas reading it, with #CYCLE!', () => {
    const { wb, s, set, get } = book({ A1: '=B1+1', B1: '=A1+1', C1: '=A1*2', D1: '=7' })
    expect(get('A1')).toBe('#CYCLE!')
    expect(get('B1')).toBe('#CYCLE!')
    expect(get('C1')).toBe('#CYCLE!')
    expect(get('D1')).toBe(7)
    expect(wb.getValue(s, 0, 0).detail).toMatch(/A1|B1/)
    set({ B1: '5' })
    expect(get('A1')).toBe(6)
    expect(get('C1')).toBe(12)
  })

  it('catches a cell that refers to itself', () => {
    const { get } = book({ A1: '=A1+1' })
    expect(get('A1')).toBe('#CYCLE!')
  })
})

describe('spilling', () => {
  it('spills an array result into the cells below and to the right', () => {
    const { get } = book({ A1: '=SEQUENCE(3, 2)', D1: '=SUM(A1#)', D2: '=B3*10' })
    expect([get('A1'), get('B1'), get('A2'), get('B3')]).toEqual([1, 2, 3, 6])
    expect(get('D1')).toBe(21)
    expect(get('D2')).toBe(60)
  })

  it('shows #SPILL! when a cell is in the way, and spills again once it is cleared', () => {
    const { set, get } = book({ A1: '=SEQUENCE(3)', A2: 'blocking', C1: '=A3' })
    expect(get('A1')).toBe('#SPILL!')
    expect(get('C1')).toBe(0)
    set({ A2: '' })
    expect(get('A1')).toBe(1)
    expect(get('C1')).toBe(3)
  })

  it('updates readers of cells that a spill grows into', () => {
    const { set, get } = book({ D1: '2', A1: '=SEQUENCE(D1)', C1: '=SUM(A1:A5)' })
    expect(get('C1')).toBe(3)
    set({ D1: '4' })
    expect(get('A4')).toBe(4)
    expect(get('C1')).toBe(10)
    set({ D1: '1' })
    expect(get('A4')).toBe(null)
    expect(get('C1')).toBe(1)
  })

  it('clears the spill and updates readers when the formula is replaced by a value', () => {
    const { set, get } = book({ A1: '=SEQUENCE(3)', B1: '=A3' })
    expect(get('B1')).toBe(3)
    set({ A1: '9' })
    expect(get('A3')).toBe(null)
    expect(get('B1')).toBe(0)
  })
})

describe('sheets', () => {
  it('reads cells on other sheets, including sheets added after the formula', () => {
    const { wb, s, get, set } = book({ A1: "='Data 2025'!B2*2" })
    expect(get('A1')).toBe('#REF!')
    const data = wb.addSheet('Data 2025')
    set({ B2: '21' }, data.id)
    expect(get('A1')).toBe(42)
    expect(wb.sheets.map((x) => x.name)).toEqual(['Sheet1', 'Data 2025'])
    expect(s).toBe(wb.sheets[0].id)
  })
})

describe('typing into cells', () => {
  it('recognises numbers, percentages, logicals, dates and text', () => {
    const { wb, s, get } = book({ A1: '42', A2: '12%', A3: 'true', A4: '2025-03-14', A5: "'007", A6: '1,234', A7: 'hello' })
    expect(get('A1')).toBe(42)
    expect(get('A2')).toBeCloseTo(0.12)
    expect(wb.getCell(s, 1, 0).format).toBe('0%')
    expect(get('A3')).toBe(true)
    expect(get('A4')).toBe(45730)
    expect(wb.getCell(s, 3, 0).format).toBe('yyyy-mm-dd')
    expect(get('A5')).toBe('007')
    expect(get('A6')).toBe(1234)
    expect(get('A7')).toBe('hello')
  })

  it('keeps a formula that does not parse, and explains the problem', () => {
    const { wb, s, get } = book({ A1: '=SUM(1,' })
    expect(get('A1')).toBe('#NAME?')
    expect(wb.getValue(s, 0, 0).detail).toMatch(/could not be read/)
    expect(wb.getCell(s, 0, 0).input).toBe('=SUM(1,')
  })
})

describe('undo and redo', () => {
  it('undoes and redoes a change, recalculating dependents each time', () => {
    const { wb, set, get } = book({ A1: '1', B1: '=A1*2' })
    set({ A1: '5' })
    expect(get('B1')).toBe(10)
    wb.undo()
    expect(get('B1')).toBe(2)
    wb.redo()
    expect(get('B1')).toBe(10)
  })

  it('treats a multi-cell change as one step', () => {
    const { wb, set, get } = book({})
    set({ A1: '1', A2: '2', A3: '=A1+A2' })
    expect(get('A3')).toBe(3)
    wb.undo()
    expect([get('A1'), get('A2'), get('A3')]).toEqual([null, null, null])
  })
})

describe('volatile functions and INDIRECT', () => {
  it('recalculates RAND on every change', () => {
    const { wb, set, get } = book({})
    let n = 0
    wb.random = () => (n++ % 10) / 10
    set({ A1: '=RAND()' })
    const first = get('A1')
    set({ B1: 'anything' })
    expect(get('A1')).not.toBe(first)
  })

  it('follows a reference built from text, and updates when its target changes', () => {
    const { set, get } = book({ A1: '3', B3: 'third', C1: '="B"&A1', D1: '=INDIRECT(C1)' })
    expect(get('D1')).toBe('third')
    set({ B3: 'changed' })
    expect(get('D1')).toBe('changed')
  })
})

describe('saving', () => {
  it('round-trips through JSON', () => {
    const { wb } = book({ A1: '2', A2: '=A1^10', B1: '=SEQUENCE(2)' })
    wb.setCells([{ sheetId: wb.sheets[0].id, row: 0, col: 0, format: '0.00' }])
    const copy = Workbook.fromJSON(JSON.parse(JSON.stringify(wb.toJSON())))
    const s = copy.sheets[0].id
    expect(copy.getValue(s, 1, 0)).toBe(1024)
    expect(copy.getValue(s, 1, 1)).toBe(2)
    expect(copy.getCell(s, 0, 0).format).toBe('0.00')
  })
})

describe('array results', () => {
  it('stores a single-value array as a plain value', () => {
    const { wb, s } = book({ A1: '=SEQUENCE(1)' })
    expect(isMatrix(wb.getCell(s, 0, 0).value)).toBe(false)
  })
})
