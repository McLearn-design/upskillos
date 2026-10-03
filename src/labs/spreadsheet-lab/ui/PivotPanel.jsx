// Builds a pivot table as a formula (GROUPBY or PIVOTBY) from the table
// around the selected cell: pick the fields, see the result and the formula,
// then insert it. Because it is a formula, it updates when the table does,
// and learners can read how it is made.
import { useMemo, useState } from 'react'
import { formatRange, indexToCol } from '../engine/address.js'
import { isError, isMatrix, literal } from '../engine/values.js'

const SUMMARIES = [
  ['SUM', 'Total', 'adds the values in each group'],
  ['AVERAGE', 'Average', 'the mean of each group'],
  ['COUNT', 'Count of numbers', 'how many numbers each group has'],
  ['COUNTA', 'Count of rows', 'how many filled cells each group has'],
  ['MIN', 'Smallest', 'the lowest value in each group'],
  ['MAX', 'Largest', 'the highest value in each group'],
  ['MEDIAN', 'Median', 'the middle value of each group'],
  ['STDEV.S', 'Standard deviation', 'how spread out each group is'],
]
const field = 'w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100'

// table: { range, headers: [names], numeric: [bool] } or null; evaluate(text) → value.
export function buildPivotFormula(range, { rows, cols, values, summary, totals }) {
  const col = (c) => formatRange({ r1: range.r1, c1: range.c1 + c, r2: range.r2, c2: range.c1 + c })
  if (cols === null || cols === undefined) return `=GROUPBY(${col(rows)}, ${col(values)}, ${summary}${totals ? '' : ', 3, 0'})`
  return `=PIVOTBY(${col(rows)}, ${col(cols)}, ${col(values)}, ${summary}${totals ? '' : ', 3, 0, , 0'})`
}

export default function PivotPanel({ table, evaluate, onInsert }) {
  const firstNumeric = table ? Math.max(0, table.numeric.findIndex(Boolean)) : 0
  const firstText = table ? Math.max(0, table.numeric.findIndex((n) => !n)) : 0
  const [rows, setRows] = useState(firstText)
  const [cols, setCols] = useState(null)
  const [values, setValues] = useState(firstNumeric)
  const [summary, setSummary] = useState('SUM')
  const [totals, setTotals] = useState(true)
  const formula = table ? buildPivotFormula(table.range, { rows, cols, values, summary, totals }) : ''
  const preview = useMemo(() => (table ? evaluate(formula) : null), [table, formula, evaluate])

  if (!table) {
    return <p className="px-4 py-3 text-xs text-slate-600 dark:text-slate-300">Click a cell inside a table that has a row of headings, then open this again. A pivot table summarises such a table: for example the total sales for each region.</p>
  }
  const name = (c) => table.headers[c] || 'Column ' + indexToCol(table.range.c1 + c)
  const options = table.headers.map((_, c) => <option key={c} value={c}>{name(c)}</option>)
  const what = SUMMARIES.find((s) => s[0] === summary)

  return (
    <div className="space-y-3 px-4 py-3 text-xs">
      <p className="text-slate-600 dark:text-slate-300">Summarising the table <span className="font-mono">{formatRange(table.range)}</span> ({table.range.r2 - table.range.r1} rows).</p>
      <label className="block"><span className="mb-0.5 block text-slate-500 dark:text-slate-400">Rows: one row for each different…</span>
        <select value={rows} onChange={(e) => setRows(Number(e.target.value))} className={field} aria-label="Row field">{options}</select>
      </label>
      <label className="block"><span className="mb-0.5 block text-slate-500 dark:text-slate-400">Columns: one column for each different… (optional)</span>
        <select value={cols ?? ''} onChange={(e) => setCols(e.target.value === '' ? null : Number(e.target.value))} className={field} aria-label="Column field">
          <option value="">(none: a simple list)</option>{options}
        </select>
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className="block"><span className="mb-0.5 block text-slate-500 dark:text-slate-400">Values</span>
          <select value={values} onChange={(e) => setValues(Number(e.target.value))} className={field} aria-label="Value field">{options}</select>
        </label>
        <label className="block"><span className="mb-0.5 block text-slate-500 dark:text-slate-400">Summarised as</span>
          <select value={summary} onChange={(e) => setSummary(e.target.value)} className={field} aria-label="Summary">
            {SUMMARIES.map(([fn, label]) => <option key={fn} value={fn}>{label}</option>)}
          </select>
        </label>
      </div>
      <label className="flex items-center gap-2 text-slate-700 dark:text-slate-200"><input type="checkbox" checked={totals} onChange={(e) => setTotals(e.target.checked)} /> Show totals</label>

      <section>
        <h3 className="mb-1 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Preview</h3>
        {isMatrix(preview) ? (
          <div className="max-h-56 overflow-auto rounded border border-slate-200 dark:border-slate-700">
            <table className="w-full border-collapse text-[11px]">
              <tbody>
                {preview.rows.slice(0, 30).map((r, i) => (
                  <tr key={i} className={i === 0 || r[0] === 'Total' ? 'font-semibold' : ''}>
                    {r.map((v, j) => <td key={j} className={'border-b border-slate-100 px-1.5 py-0.5 dark:border-slate-800 ' + (typeof v === 'number' ? 'text-right tabular-nums' : '')}>{typeof v === 'number' ? Number(v.toPrecision(10)).toLocaleString('en-US', { maximumFractionDigits: 4 }) : isError(v) ? v.code : literal(v).replace(/^"|"$/g, '')}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
            {preview.height > 30 && <p className="px-1.5 py-1 text-slate-400">…and {preview.height - 30} more rows.</p>}
          </div>
        ) : (
          <p className="text-red-700 dark:text-red-300">{isError(preview) ? preview.code + ': ' + preview.detail : 'No result.'}</p>
        )}
      </section>

      <section>
        <h3 className="mb-1 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">The formula</h3>
        <code className="block break-all rounded bg-slate-50 px-1.5 py-1 font-mono text-[12px] text-slate-800 dark:bg-slate-900 dark:text-slate-100">{formula}</code>
        <p className="mt-1.5 text-slate-600 dark:text-slate-300">
          {cols === null ? 'GROUPBY' : 'PIVOTBY'} splits the rows into groups by <b>{name(rows)}</b>{cols !== null && <> (down the side) and <b>{name(cols)}</b> (across the top)</>}, then applies <b>{summary}</b> to the <b>{name(values)}</b> of each group: {what[2]}. Because it is a formula, it updates when the table changes.
        </p>
      </section>

      <button type="button" onClick={() => onInsert(formula)} disabled={!isMatrix(preview)}
        className="rounded-md bg-sky-600 px-3 py-1 text-xs font-semibold text-white hover:bg-sky-500 disabled:opacity-40">Insert beside the table</button>
    </div>
  )
}
