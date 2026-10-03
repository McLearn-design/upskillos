// GROUPBY and PIVOTBY: Excel's formula pivot tables. They group the rows of
// a table by one or more fields and summarise a value field in each group
// with a function such as SUM or AVERAGE. As formulas, they update by
// themselves when the table changes, and the formula shows how the summary
// is made.
import { def, Matrix, fail, isError, isMatrix } from './helpers.js'
import { attempt } from '../evaluate.js'
import { compareValues } from '../data.js'

const C = 'Arrays'
const blank = (v) => v === null || v === undefined || v === ''
const groupKey = (vals) => JSON.stringify(vals.map((v) => (typeof v === 'string' ? 's' + v.toLowerCase() : blank(v) ? 'b' : typeof v + String(v))))

// The fields' rows, with or without a header row. Automatic (no field_headers)
// takes the first row as headers when it is text above a number, as Excel does.
function splitHeaders(fields, values, mode) {
  const firstText = (M) => M.rows[0].every((v) => typeof v === 'string')
  const auto = mode === null || mode === undefined
  const has = auto ? values.height > 1 && firstText(values) && values.rows.slice(1).some((r) => r.some((v) => typeof v === 'number')) : mode === 1 || mode === 3
  const show = auto ? has : mode === 2 || mode === 3
  const strip = (M) => (has ? new Matrix(M.rows.slice(1)) : M)
  const names = (M, base) => (has ? M.rows[0].map((v) => String(v ?? '')) : M.rows[0].map((_, i) => base + ' ' + (i + 1)))
  return { fields: fields.map(strip), values: strip(values), show, names: fields.map((F, i) => names(F, ['Row field', 'Column field'][i] ?? 'Field')), valueNames: names(values, 'Value') }
}

function apply(fn, column) {
  const v = attempt(() => fn(new Matrix(column.map((x) => [x]))))
  return isMatrix(v) ? v.get(0, 0) : v
}

function checkFunction(fn, name) {
  if (typeof fn !== 'function') fail('#VALUE!', name + ' needs a function to summarise each group with: a name such as SUM, AVERAGE or COUNT, or a LAMBDA.')
}

function checkRows(name, ...arrays) {
  const h = arrays[0].height
  if (arrays.some((M) => M.height !== h)) fail('#VALUE!', name + ': the fields and the values must have the same number of rows, because each row is one record.')
}

// Sorts output rows by a 1-based column (negative for descending); ties are
// broken by the other columns, left to right. Blanks go last.
function sortRows(list, sort, columns) {
  const by = Math.abs(sort) - 1, dir = sort < 0 ? -1 : 1
  return list.sort((a, b) => {
    for (const i of [by, ...columns(a).map((_, i) => i).filter((i) => i !== by)]) {
      const x = columns(a)[i], y = columns(b)[i]
      if (blank(x) || blank(y)) { if (blank(x) !== blank(y)) return blank(x) ? 1 : -1; continue }
      const c = compareValues(x, y)
      if (c) return c * (i === by ? dir : 1)
    }
    return 0
  })
}

// Groups of rows by their key, in sorted order. sort: 1-based column of the
// key to sort by (negative for descending).
function groups(keyRows, include, sort = 1) {
  const map = new Map()
  keyRows.forEach((key, i) => {
    if (!include(i)) return
    const k = groupKey(key)
    if (!map.has(k)) map.set(k, { key, rows: [] })
    map.get(k).rows.push(i)
  })
  return sortRows([...map.values()], sort, (g) => g.key)
}

const filterOf = (filter, n) => {
  if (filter === null || filter === undefined) return () => true
  const F = Matrix.of(filter)
  if (F.height !== n) fail('#VALUE!', 'The filter must have one TRUE or FALSE for each row of data.')
  return (i) => F.get(i, 0) === true || (typeof F.get(i, 0) === 'number' && F.get(i, 0) !== 0)
}

export default {
  GROUPBY: def(C, 'GROUPBY(row_fields, values, function, [field_headers], [total_depth], [sort_order], [filter_array])',
    'Groups rows by one or more fields and summarises the values in each group: a pivot table as a formula.',
    ([rowsIn, valuesIn, fn, headers, totalDepth, sortOrder, filter]) => {
      checkFunction(fn, 'GROUPBY')
      const raw = splitHeaders([Matrix.of(rowsIn)], Matrix.of(valuesIn), headers)
      const [R] = raw.fields, V = raw.values
      checkRows('GROUPBY', R, V)
      const include = filterOf(filter, R.height)
      const keep = (i) => include(i) && !(R.rows[i].every(blank) && V.rows[i].every(blank))
      const gs = groups(R.rows, keep)
      // sort_order counts the output's columns: the fields, then the results.
      const sort = typeof sortOrder === 'number' && sortOrder !== 0 ? Math.trunc(sortOrder) : 1
      if (Math.abs(sort) > R.width + V.width) fail('#VALUE!', 'sort_order ' + sort + ' is beyond the ' + (R.width + V.width) + ' columns of the result.')
      const lines = sortRows(gs.map((g) => [...g.key.map((v) => (blank(v) ? '' : v)), ...V.rows[0].map((_, c) => apply(fn, g.rows.map((i) => V.rows[i][c])))]), sort, (x) => x)
      const out = []
      if (raw.show) out.push([...raw.names[0], ...raw.valueNames])
      out.push(...lines)
      const depth = typeof totalDepth === 'number' ? totalDepth : 1
      if (depth !== 0 && gs.length) {
        const all = gs.flatMap((g) => g.rows)
        const total = ['Total', ...R.rows[0].slice(1).map(() => ''), ...V.rows[0].map((_, c) => apply(fn, all.map((i) => V.rows[i][c])))]
        if (depth < 0) out.splice(raw.show ? 1 : 0, 0, total)
        else out.push(total)
      }
      if (!out.length) fail('#CALC!', 'No rows to group: the table is empty, or the filter left nothing.')
      return new Matrix(out)
    }, {
      min: 3, returnsArray: true,
      example: ['=GROUPBY(A1:A20, C1:C20, SUM)', 'the total of column C for each different value in column A'],
      learn: 'This is "split, apply, combine": split the rows into groups that share a value, apply a function to each group, and combine the results into a table. It is what a pivot table, SQL\'s GROUP BY and pandas\' groupby() all do. A bare function name such as SUM is passed as a value here, without brackets.',
    }),

  PIVOTBY: def(C, 'PIVOTBY(row_fields, col_fields, values, function, [field_headers], [row_total_depth], [row_sort_order], [col_total_depth], [col_sort_order], [filter_array])',
    'Summarises values in a grid: one row per value of the row field, one column per value of the column field.',
    ([rowsIn, colsIn, valuesIn, fn, headers, rowTotal, rowSort, colTotal, colSort, filter]) => {
      checkFunction(fn, 'PIVOTBY')
      const raw = splitHeaders([Matrix.of(rowsIn), Matrix.of(colsIn)], Matrix.of(valuesIn), headers)
      const [R, K] = raw.fields, V = raw.values
      checkRows('PIVOTBY', R, K, V)
      if (V.width !== 1) fail('#VALUE!', 'PIVOTBY here summarises one column of values. Make one PIVOTBY for each value column.')
      const include = filterOf(filter, R.height)
      const keep = (i) => include(i) && !(R.rows[i].every(blank) && K.rows[i].every(blank) && blank(V.rows[i][0]))
      const rowGroups = groups(R.rows, keep, typeof rowSort === 'number' && rowSort !== 0 ? Math.trunc(rowSort) : 1)
      const colGroups = groups(K.rows, keep, typeof colSort === 'number' && colSort !== 0 ? Math.trunc(colSort) : 1)
      const colIndex = new Map(colGroups.map((g, j) => [groupKey(g.key), j]))
      const rowTotals = (typeof rowTotal === 'number' ? rowTotal : 1) !== 0
      const colTotals = (typeof colTotal === 'number' ? colTotal : 1) !== 0
      const lead = R.width
      const out = []
      // Header: the row field's name, then one column per column-field value.
      out.push([...Array.from({ length: lead }, (_, i) => (raw.show ? raw.names[0][i] : '')), ...colGroups.map((g) => g.key.map((v) => (blank(v) ? '(blank)' : v)).join(' / ')), ...(colTotals ? ['Total'] : [])])
      for (const g of rowGroups) {
        const cells = colGroups.map(() => [])
        for (const i of g.rows) cells[colIndex.get(groupKey(K.rows[i]))].push(V.rows[i][0])
        out.push([...g.key.map((v) => (blank(v) ? '' : v)), ...cells.map((list) => (list.length ? apply(fn, list) : '')), ...(colTotals ? [apply(fn, g.rows.map((i) => V.rows[i][0]))] : [])])
      }
      if (rowTotals && rowGroups.length) {
        const all = rowGroups.flatMap((g) => g.rows)
        out.push(['Total', ...Array.from({ length: lead - 1 }, () => ''), ...colGroups.map((g) => apply(fn, g.rows.filter((i) => all.includes(i)).map((i) => V.rows[i][0]))), ...(colTotals ? [apply(fn, all.map((i) => V.rows[i][0]))] : [])])
      }
      if (out.length === 1) fail('#CALC!', 'No rows to summarise: the table is empty, or the filter left nothing.')
      return new Matrix(out.map((r) => r.map((v) => (isError(v) ? v : v))))
    }, {
      min: 4, returnsArray: true,
      example: ['=PIVOTBY(A1:A20, B1:B20, C1:C20, SUM)', 'totals of column C by A down the side and B across the top'],
      learn: 'A cross-tabulation: each cell summarises the rows that have that row value and that column value. Totals add up each row and each column. pandas calls this pivot_table().',
    }),
}
