// Data tools that rearrange whole rows of a table: sorting and removing
// duplicates. Each returns the cell changes to make (for Workbook.setCells, so
// one undo puts everything back) and a sentence saying what happened.
import { CellError, formatGeneral } from './values.js'
import { cellKey, indexToCol } from './address.js'
import { shiftFormula } from './rewrite.js'

// Excel's sort order: numbers, then text (ignoring case), then FALSE before
// TRUE, then errors. Blanks always go last, whichever direction.
const rank = (v) => (typeof v === 'number' ? 0 : typeof v === 'string' ? 1 : typeof v === 'boolean' ? 2 : v instanceof CellError ? 3 : 4)
const isBlank = (v) => v === null || v === undefined || v === ''

export function compareValues(a, b) {
  const ra = rank(a), rb = rank(b)
  if (ra !== rb) return ra - rb
  if (ra === 0) return a - b
  if (ra === 1) return a.localeCompare(b, undefined, { sensitivity: 'base', numeric: true })
  if (ra === 2) return Number(a) - Number(b)
  return 0
}

// A first row of headings: all text, above a row that is not all text.
export function looksLikeHeader(rows) {
  if (rows.length < 2) return false
  const [first, ...rest] = rows
  if (!first.every((v) => typeof v === 'string' && v.trim() !== '')) return false
  return rest.some((r) => r.some((v) => !isBlank(v) && typeof v !== 'string'))
}

// The contents of a cell as written into another row: a formula is moved the
// way copying would move it, so =B2*2 in row 2 becomes =B5*2 in row 5.
function moved(cell, dRows) {
  if (!cell) return { input: '', format: undefined, style: undefined }
  const input = cell.kind === 'formula' && dRows ? shiftFormula(cell.input, dRows, 0) : cell.input
  return { input, format: cell.format, style: cell.style, ...(cell.code ? { code: cell.code } : {}) }
}

// read(row, col) → the cell's value; cellAt(row, col) → the stored cell.
// keys: [{ col, descending }], the first deciding and the rest breaking ties.
export function sortRows({ sheetId, range, keys, header, read, cellAt }) {
  const first = header ? range.r1 + 1 : range.r1
  const rows = []
  for (let r = first; r <= range.r2; r++) rows.push(r)
  const order = [...rows].sort((ra, rb) => {
    for (const { col, descending } of keys) {
      const a = read(ra, col), b = read(rb, col)
      if (isBlank(a) || isBlank(b)) { if (isBlank(a) && isBlank(b)) continue; return isBlank(a) ? 1 : -1 }
      const c = compareValues(a, b)
      if (c) return descending ? -c : c
    }
    return ra - rb // stable: equal rows keep their order
  })
  const changes = []
  order.forEach((from, i) => {
    const to = first + i
    if (from === to) return
    for (let c = range.c1; c <= range.c2; c++) changes.push({ sheetId, row: to, col: c, ...moved(cellAt(from, c), to - from) })
  })
  const by = keys.map((k) => 'column ' + indexToCol(k.col) + (k.descending ? ' (largest to smallest, Z to A)' : ' (smallest to largest, A to Z)')).join(', then ')
  const message = rows.length < 2
    ? 'There is only one row to sort.'
    : 'Sorted rows ' + (first + 1) + '–' + (range.r2 + 1) + ' by ' + by + '.' + (header ? ' Row ' + (range.r1 + 1) + ' looks like headings, so it stayed at the top.' : '') + (changes.length ? '' : ' They were already in order.')
  return { changes, message }
}

// Keeps the first of each set of rows that are the same in every column
// (text compared ignoring case, as Excel does), moving the rest up.
export function removeDuplicates({ sheetId, range, header, read, cellAt }) {
  const first = header ? range.r1 + 1 : range.r1
  const seen = new Set()
  const keep = []
  for (let r = first; r <= range.r2; r++) {
    const key = []
    for (let c = range.c1; c <= range.c2; c++) {
      const v = read(r, c)
      key.push(isBlank(v) ? '' : typeof v === 'string' ? 's:' + v.toLowerCase() : rank(v) + ':' + String(v))
    }
    const k = JSON.stringify(key)
    if (!seen.has(k)) { seen.add(k); keep.push(r) }
  }
  const removed = range.r2 - first + 1 - keep.length
  const changes = []
  if (removed) {
    keep.forEach((from, i) => {
      const to = first + i
      if (from !== to) for (let c = range.c1; c <= range.c2; c++) changes.push({ sheetId, row: to, col: c, ...moved(cellAt(from, c), to - from) })
    })
    for (let r = first + keep.length; r <= range.r2; r++) for (let c = range.c1; c <= range.c2; c++) changes.push({ sheetId, row: r, col: c, input: '', format: undefined, style: undefined })
  }
  const message = removed
    ? 'Removed ' + removed + ' duplicate row' + (removed === 1 ? '' : 's') + '; ' + keep.length + ' unique row' + (keep.length === 1 ? '' : 's') + ' remain' + (keep.length === 1 ? 's' : '') + '. Rows count as duplicates when every column in ' + cellKey(range.r1, range.c1) + ':' + cellKey(range.r2, range.c2) + ' matches; the first one is kept.'
    : 'No duplicate rows: every row in the selection is different.'
  return { changes, message, removed }
}

// ── Filters ─────────────────────────────────────────────────────────────
// A filter is { source: 'A1:D20', hidden: { [column offset]: [value keys] } }:
// the first row of the range holds the headings, and a row below is hidden
// when its value in some column is one of that column's hidden keys.
export const BLANKS = '(Blanks)'

export function filterKey(v) {
  if (isBlank(v)) return BLANKS
  if (typeof v === 'number') return formatGeneral(v)
  if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE'
  if (v instanceof CellError) return v.code
  return String(v)
}

export function hiddenRows(filter, range, read) {
  const out = new Set()
  const columns = Object.entries(filter.hidden ?? {}).filter(([, keys]) => keys.length).map(([offset, keys]) => [range.c1 + Number(offset), new Set(keys)])
  if (!columns.length) return out
  for (let r = range.r1 + 1; r <= range.r2; r++) {
    if (columns.some(([c, keys]) => keys.has(filterKey(read(r, c))))) out.add(r)
  }
  return out
}

// The different values in one column of the filter, in sort order, with how
// many rows hold each, for the list of tick boxes.
export function columnValues(range, col, read) {
  const counts = new Map()
  const sample = new Map()
  for (let r = range.r1 + 1; r <= range.r2; r++) {
    const v = read(r, col)
    const k = filterKey(v)
    counts.set(k, (counts.get(k) ?? 0) + 1)
    if (!sample.has(k)) sample.set(k, v)
  }
  return [...counts.keys()]
    .sort((a, b) => (a === BLANKS ? 1 : b === BLANKS ? -1 : compareValues(sample.get(a), sample.get(b))))
    .map((key) => ({ key, count: counts.get(key) }))
}
