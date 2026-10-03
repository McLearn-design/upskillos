// The selection: an active cell plus a rectangle stretched from an anchor to
// a focus cell (shift+arrows and dragging move the focus).
import { formatRange, normaliseRange } from '../engine/address.js'

export const MAX_GRID_ROWS = 1048576
export const MAX_GRID_COLS = 16384

export const cellSelection = (row, col) => ({ active: { row, col }, anchor: { row, col }, focus: { row, col } })

export function selectionRange(sel) {
  return normaliseRange({ r1: sel.anchor.row, c1: sel.anchor.col, r2: sel.focus.row, c2: sel.focus.col })
}

export const selectionLabel = (sel) => formatRange(selectionRange(sel))

export function clampPos(row, col) {
  return { row: Math.max(0, Math.min(MAX_GRID_ROWS - 1, row)), col: Math.max(0, Math.min(MAX_GRID_COLS - 1, col)) }
}

// isHidden(row): rows hidden by a filter are stepped over, as in Excel.
export function moveSelection(sel, dRow, dCol, extend, isHidden = null) {
  const from = extend ? sel.focus : sel.active
  let p = clampPos(from.row + dRow, from.col + dCol)
  if (isHidden && dRow) {
    const step = Math.sign(dRow)
    while (isHidden(p.row) && p.row + step >= 0 && p.row + step < MAX_GRID_ROWS) p = { ...p, row: p.row + step }
    if (isHidden(p.row)) p = clampPos(from.row, p.col) // nothing visible that way
  }
  if (extend) return { ...sel, focus: p }
  return cellSelection(p.row, p.col)
}

// Ctrl+arrow: jump to the edge of the block of data, as in Excel. From a
// filled cell next to a filled cell, go to the last filled cell in that
// direction; otherwise go to the next filled cell (or the sheet edge).
export function jumpTarget(hasValue, from, dRow, dCol, limits) {
  const step = (p) => ({ row: p.row + dRow, col: p.col + dCol })
  const inside = (p) => p.row >= 0 && p.col >= 0 && p.row < limits.rows && p.col < limits.cols
  let p = { ...from }
  const next = step(p)
  if (!inside(next)) return p
  if (hasValue(p.row, p.col) && hasValue(next.row, next.col)) {
    while (inside(step(p)) && hasValue(step(p).row, step(p).col)) p = step(p)
    return p
  }
  p = next
  while (inside(step(p)) && !hasValue(p.row, p.col)) p = step(p)
  return p
}
