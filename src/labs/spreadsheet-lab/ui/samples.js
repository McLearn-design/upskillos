// Workbooks the lab can open: the first-visit tour, and practice data.
import { Workbook } from '../engine/workbook.js'

const bold = { bold: true }
const heading = { bold: true, fill: '#e0f2fe' }

function sheet(name, cells, colWidths = {}) {
  return {
    name,
    colWidths,
    cells: Object.fromEntries(Object.entries(cells).map(([k, v]) => [k, typeof v === 'string' ? { input: v } : v])),
  }
}

// The first thing a learner sees: a few live numbers and formulas, with
// things to try written beside them.
const TOUR = {
  version: 1,
  sheets: [
    sheet('Start here', {
      A1: { input: 'Welcome to the Spreadsheet Lab', style: { bold: true } },
      A2: 'Every cell holds a value or a formula. Formulas start with = and update by themselves.',
      A4: { input: 'Item', style: heading }, B4: { input: 'Price', style: heading }, C4: { input: 'Quantity', style: heading }, D4: { input: 'Total', style: heading },
      A5: 'Notebook', B5: { input: '4.5', format: '$#,##0.00' }, C5: '3', D5: { input: '=B5*C5', format: '$#,##0.00' },
      A6: 'Pens', B6: { input: '1.2', format: '$#,##0.00' }, C6: '10', D6: { input: '=B6*C6', format: '$#,##0.00' },
      A7: 'Folder', B7: { input: '2.75', format: '$#,##0.00' }, C7: '4', D7: { input: '=B7*C7', format: '$#,##0.00' },
      A10: { input: 'Total', style: bold }, C10: { input: '=SUM(C5:C9)', style: bold }, D10: { input: '=SUM(D5:D9)', format: '$#,##0.00', style: bold },
      F4: { input: 'Things to try', style: heading },
      F5: '1. Click D5. The formula bar above shows =B5*C5, the cell shows its result.',
      F6: '2. Change C5 to 5. D5 and the totals in row 10 update at once.',
      F7: '3. Fill in row 8 (an item, a price, a quantity). Click D7 and drag its small corner square down to D8: the formula is copied as =B8*C8.',
      F8: '4. In an empty cell type =AVERAGE( and watch the hint. Click B5, drag to B7, type ) and Enter.',
      F9: '5. Click the cell below. Errors are explained in the panel on the right.',
      F10: '=B5/0',
      F11: '6. One formula can fill many cells ("spill"). The cell below holds =SEQUENCE(4, 2):',
      F12: '=SEQUENCE(4, 2)',
      F17: '7. Open the "Practice data" sheet at the bottom to try SUMIF, AVERAGEIF and XLOOKUP.',
    }, { 0: 110 }),
    sheet('Practice data', {
      A1: { input: 'Month', style: heading }, B1: { input: 'Region', style: heading }, C1: { input: 'Units', style: heading }, D1: { input: 'Unit price', style: heading }, E1: { input: 'Revenue', style: heading },
      ...Object.fromEntries([
        ['2025-01-01', 'North', 120, 9.5], ['2025-01-01', 'South', 85, 9.5], ['2025-02-01', 'North', 132, 9.5], ['2025-02-01', 'South', 97, 9.5],
        ['2025-03-01', 'North', 128, 9.75], ['2025-03-01', 'South', 110, 9.75], ['2025-04-01', 'North', 150, 9.75], ['2025-04-01', 'South', 104, 9.75],
        ['2025-05-01', 'North', 161, 10], ['2025-05-01', 'South', 118, 10], ['2025-06-01', 'North', 155, 10], ['2025-06-01', 'South', 131, 10],
      ].flatMap(([m, region, units, price], i) => {
        const r = i + 2
        return [
          ['A' + r, { input: m, format: 'mmm yyyy' }], ['B' + r, region], ['C' + r, String(units)],
          ['D' + r, { input: String(price), format: '$#,##0.00' }], ['E' + r, { input: `=C${r}*D${r}`, format: '$#,##0.00' }],
        ]
      })),
      G1: { input: 'Questions to answer with formulas', style: heading },
      G2: 'Total revenue for the North region?  (try =SUMIF(B2:B13, "North", E2:E13))',
      G3: 'Average units sold in the South?  (AVERAGEIF)',
      G4: 'Which row sold the most units?  (MAX, then XLOOKUP or MATCH)',
      G5: 'How many months sold more than 120 units?  (COUNTIF)',
    }, { 0: 90, 6: 480 }),
  ],
}

export const SAMPLES = [
  { id: 'tour', title: 'Tour: first steps', description: 'Values, formulas, filling, errors and spills, with things to try.', data: TOUR },
]

export function sampleWorkbook(id = 'tour') {
  return Workbook.fromJSON(SAMPLES.find((s) => s.id === id)?.data ?? TOUR)
}
