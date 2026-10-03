// Every translation is run for real (Python on Pyodide, JavaScript directly,
// MATLAB on OpenMAT) and must give the same answer as the formula.
import { beforeAll, describe, expect, it } from 'vitest'
import { loadPyodide } from 'pyodide'
import { executeScript } from '../../../engines/openmat/openmatEngine.js'
import { Workbook } from './workbook.js'
import { translateFormula } from './translate.js'
import { codeReferences, matlabResultName, plainValue, shapeForCode, substituteMatlab } from './code.js'
import { parse } from './parser.js'
import { evalNode } from './evaluate.js'
import { isMatrix } from './values.js'

let py
beforeAll(async () => { py = await loadPyodide() }, 120000)

const DATA = { A1: '3', A2: '1', A3: '4', A4: '1', A5: '5', B1: '2.5', B2: '-3', C1: 'Hello World', C2: '  padded   text ' }

function setup(formula) {
  const wb = new Workbook()
  const sheet = wb.sheets[0]
  wb.setCells(Object.entries(DATA).map(([a, input]) => ({ sheetId: sheet.id, row: Number(a.slice(1)) - 1, col: a.charCodeAt(0) - 65, input })))
  wb.setCells([{ sheetId: sheet.id, row: 9, col: 9, input: formula }])
  const cell = wb.getCell(sheet.id, 9, 9)
  const v = cell.value
  const expected = isMatrix(v) ? v.rows.flat() : v
  const t = translateFormula(cell.tree)
  const ctx = wb.context(sheet, 9, 9)
  const inputs = {}
  for (const code of [t.py, t.js, t.matlab].filter(Boolean)) {
    for (const ref of codeReferences(code)) {
      const x = evalNode(parse(ref), ctx)
      inputs[ref] = shapeForCode(isMatrix(x) ? x.rows.map((r) => r.map(plainValue)) : [[plainValue(x)]])
    }
  }
  return { t, expected, inputs }
}

const NO_MATLAB = new Set(['=IF(A1>2, "big", "small")', '=COUNT(A1:A5, C1)', '=LEN(C1)', '=LEFT(C1, 5)', '=RIGHT(C1, 5)', '=MID(C1, 7, 5)'])

const flat = (v) => (Array.isArray(v) ? v.flat(2) : v)

async function runJS(code, inputs) {
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor
  return flat(await new AsyncFunction('xl', code)((ref) => inputs[ref]))
}

function runPython(code, inputs) {
  py.runPython('import json\n_inputs = json.loads(' + JSON.stringify(JSON.stringify(inputs)) + ')\ndef xl(ref): return _inputs[ref]')
  const v = py.runPython(code)
  return flat(v?.toJs ? v.toJs() : v)
}

function runMatlab(code, inputs) {
  const r = executeScript(substituteMatlab(code, inputs))
  const entry = r.workspace.find((w) => w.name === matlabResultName(code))
  const v = entry?.value
  return flat(v?.toArray ? v.toArray() : v)
}

const same = (actual, expected) => {
  if (typeof expected === 'number') expect(actual).toBeCloseTo(expected, 9)
  else if (Array.isArray(expected)) expect(actual).toEqual(expected)
  else expect(actual).toBe(expected)
}

describe('formulas translated to code give the same answer', () => {
  it.each([
    '=SUM(A1:A5)', '=AVERAGE(A1:A5)', '=MAX(A1:A5)-MIN(A1:A5)', '=MEDIAN(A1:A5)', '=STDEV.S(A1:A5)', '=VAR.S(A1:A5)',
    '=SUM(A1:A5, B1, 10)', '=PRODUCT(A1:A3)', '=COUNT(A1:A5, C1)', '=SQRT(A3)+ABS(B2)', '=A1^2', '=(A1+A2)*B1', '=MOD(B2, 2)',
    '=ROUND(B1*3.1, 2)', '=A1:A3*2', '=A1:A3+A3:A5', '=AND(A1>1, A2<2)', '=OR(A1>10, NOT(A2>2))', '=INT(B2/2)', '=EXP(1)', '=LN(A5)', '=PI()*2',
    '=IF(A1>2, "big", "small")', '=LEN(C1)', '=UPPER(C1)', '=LOWER(C1)', '=TRIM(C2)', '=LEFT(C1, 5)', '=RIGHT(C1, 5)', '=MID(C1, 7, 5)', '=C1&"!"', '=CONCAT(C1, "!", A1)',
    '=SUM(A1:B2)', '=MEDIAN(A1:B2, 10)', '=SUM(A1:A3)+SUM(A1:A3)', '=C1&" "&A1',
  ])('%s', async (formula) => {
    const { t, expected, inputs } = setup(formula)
    expect(t.unsupported).toBeUndefined()
    same(await runJS(t.js, inputs), expected)
    same(runPython(t.py, inputs), expected)
    // MATLAB is left out only where a reason says why, never silently.
    if (NO_MATLAB.has(formula)) expect(t.missing.matlab).toBeTruthy()
    else same(runMatlab(t.matlab, inputs), expected)
  })
})

describe('notes about real differences', () => {
  it('Python rounds halves to even, as the ROUND note says', () => {
    const { t, expected, inputs } = setup('=ROUND(2.5, 0)')
    expect(expected).toBe(3)
    expect(runPython(t.py, inputs)).toBe(2)
    expect(t.notes.join(' ')).toMatch(/round\(2\.5\) is 2/)
  })

  it('MATLAB has no inline if, and says how to write one', () => {
    const { t } = setup('=IF(A1>2, 1, 0)')
    expect(t.matlab).toBe(null)
    expect(t.missing.matlab).toMatch(/if condition/)
  })

  it('reads each range into a MATLAB variable once', () => {
    expect(setup('=SUM(A1:A3)+MAX(A1:A3, B1:B2)').t.matlab).toBe('data = xl("A1:A3");\ndata2 = xl("B1:B2");\nsum(data) + max([data; data2])')
  })

  it('says how MATLAB itself would do what OpenMAT cannot yet', () => {
    expect(setup('=LEFT(C1, 5)').t.missing.matlab).toMatch(/extractBefore/)
  })

  it('reports functions with no translation rather than guessing', () => {
    expect(setup('=VLOOKUP(1, A1:B5, 2, FALSE)').t.unsupported).toBe('VLOOKUP')
  })
})
