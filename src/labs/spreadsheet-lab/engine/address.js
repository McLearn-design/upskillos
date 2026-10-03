// Cell addresses: A1-style references, column letters, and ranges.
//
// Internally rows and columns are 0-based numbers ({ row: 0, col: 0 } is A1).
// Everything the learner sees is 1-based A1 notation, as in Excel.

export const MAX_ROWS = 1048576
export const MAX_COLS = 16384 // XFD

// 'A' → 0, 'Z' → 25, 'AA' → 26. Column letters are bijective base 26:
// there is no zero digit, which is why 'Z' is followed by 'AA', not 'BA'.
export function colToIndex(letters) {
  let n = 0
  for (const ch of letters.toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64)
  return n - 1
}

export function indexToCol(index) {
  let n = index + 1
  let s = ''
  while (n > 0) {
    const r = (n - 1) % 26
    s = String.fromCharCode(65 + r) + s
    n = Math.floor((n - 1) / 26)
  }
  return s
}

const CELL_RE = /^(\$?)([A-Za-z]{1,3})(\$?)(\d+)$/

// 'B3' → { row: 2, col: 1, absRow: false, absCol: false }; null if not a cell.
export function parseCell(text) {
  const m = CELL_RE.exec(text)
  if (!m) return null
  const col = colToIndex(m[2])
  const row = Number(m[4]) - 1
  if (row < 0 || row >= MAX_ROWS || col >= MAX_COLS) return null
  return { row, col, absCol: m[1] === '$', absRow: m[3] === '$' }
}

export function formatCell({ row, col, absRow = false, absCol = false }) {
  return (absCol ? '$' : '') + indexToCol(col) + (absRow ? '$' : '') + (row + 1)
}

// The key used to store a cell in a sheet's map. Plain A1, no dollars.
export const cellKey = (row, col) => indexToCol(col) + (row + 1)

export function keyToPos(key) {
  const p = parseCell(key)
  return p ? { row: p.row, col: p.col } : null
}

// 'A1:C3' (or 'C3:A1') → normalised { r1, c1, r2, c2 } with r1 <= r2, c1 <= c2.
export function parseRange(text) {
  const [a, b = a] = text.split(':')
  const p = parseCell(a), q = parseCell(b)
  if (!p || !q) return null
  return normaliseRange({ r1: p.row, c1: p.col, r2: q.row, c2: q.col })
}

export function normaliseRange({ r1, c1, r2, c2 }) {
  return { r1: Math.min(r1, r2), c1: Math.min(c1, c2), r2: Math.max(r1, r2), c2: Math.max(c1, c2) }
}

export function formatRange({ r1, c1, r2, c2 }) {
  const a = cellKey(r1, c1), b = cellKey(r2, c2)
  return a === b ? a : a + ':' + b
}

export const rangeContains = (r, row, col) => row >= r.r1 && row <= r.r2 && col >= r.c1 && col <= r.c2
export const rangeSize = (r) => ({ rows: r.r2 - r.r1 + 1, cols: r.c2 - r.c1 + 1 })

// Sheet names need quotes in a reference when they are not plain identifiers:
// ='Sales 2025'!A1 but =Sheet1!A1.
export function quoteSheet(name) {
  return /^[A-Za-z_][A-Za-z0-9_.]*$/.test(name) && !parseCell(name) ? name : "'" + name.replace(/'/g, "''") + "'"
}
