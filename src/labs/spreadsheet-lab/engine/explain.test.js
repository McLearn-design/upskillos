import { describe, expect, it } from 'vitest'
import { Workbook } from './workbook.js'
import { explainFormula } from './explain.js'

function stepsFor(formula, cells = {}) {
  const wb = new Workbook()
  const sheet = wb.sheets[0]
  wb.setCells(Object.entries(cells).map(([a, input]) => ({ sheetId: sheet.id, row: Number(a.slice(1)) - 1, col: a.charCodeAt(0) - 65, input })))
  wb.setCells([{ sheetId: sheet.id, row: 9, col: 9, input: formula }])
  const cell = wb.getCell(sheet.id, 9, 9)
  const { steps } = explainFormula(formula.slice(1), cell.tree, wb.context(sheet, 9, 9))
  return steps.map((s) => s.segments.map((x) => x.text).join(''))
}

describe('step-by-step evaluation', () => {
  it('replaces one piece at a time, keeping the formula as typed', () => {
    expect(stepsFor('=SUM(A1:A3)*2', { A1: '1', A2: '2', A3: '3' })).toEqual([
      'SUM(A1:A3)*2',
      'SUM({1;2;3})*2',
      '6*2',
      '12',
    ])
  })

  it('drops brackets once what is inside them is calculated', () => {
    expect(stepsFor('=(B1+3) * 4', { B1: '2' })).toEqual(['(B1+3) * 4', '(2+3) * 4', '5 * 4', '20'])
  })

  it('shows that IF only works out the branch it needs', () => {
    const steps = stepsFor('=IF(A1>5, "big", A1/0)', { A1: '9' })
    expect(steps).toEqual(['IF(A1>5, "big", A1/0)', 'IF(9>5, "big", A1/0)', 'IF(TRUE, "big", A1/0)', '"big"'])
  })

  it('ends with the error and its reason when the formula fails', () => {
    const wb = new Workbook()
    const sheet = wb.sheets[0]
    wb.setInput(sheet.id, 0, 0, '=1/0')
    const { steps } = explainFormula('1/0', wb.getCell(sheet.id, 0, 0).tree, wb.context(sheet, 0, 0))
    expect(steps.at(-1).segments[0].text).toBe('#DIV/0!')
    expect(steps.at(-1).note).toMatch(/divides by zero/)
  })

  it('says each calculation with its numbers', () => {
    const wb = new Workbook()
    const sheet = wb.sheets[0]
    wb.setInput(sheet.id, 0, 0, '=(2+3)*4>10')
    const { steps } = explainFormula('(2+3)*4>10', wb.getCell(sheet.id, 0, 0).tree, wb.context(sheet, 0, 0))
    expect(steps.map((s) => s.note).slice(1)).toEqual(['2 + 3 = 5.', '5 × 4 = 20.', '20 > 10 is TRUE. That is the result.'])
  })

  it('highlights the piece calculated in each step', () => {
    const wb = new Workbook()
    const sheet = wb.sheets[0]
    wb.setInput(sheet.id, 0, 0, '=2+3*4')
    const { steps } = explainFormula('2+3*4', wb.getCell(sheet.id, 0, 0).tree, wb.context(sheet, 0, 0))
    expect(steps[1].segments.find((s) => s.highlight).text).toBe('12') // 3*4 first: * before +
  })
})
