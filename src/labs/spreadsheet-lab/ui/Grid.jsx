// The grid. Only the cells in view are drawn (virtualised), so a sheet can be
// as large as the workbook allows. Headers sit outside the scrolling area and
// follow it, the way Excel's frozen headers do.
import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { cellKey, indexToCol } from '../engine/address.js'
import { displayCell, FORMAT_COLORS, textOn } from './display.js'
import { MAX_GRID_COLS, MAX_GRID_ROWS, selectionRange } from './selection.js'

export const DEFAULT_COL_W = 96
export const DEFAULT_ROW_H = 24
export const HEAD_W = 46
export const HEAD_H = 24
const OVERSCAN = 3

// starts[i] is where row/column i begins; starts[count] is the total size.
function prefixSums(count, sizes, fallback) {
  const starts = new Float64Array(count + 1)
  for (let i = 0; i < count; i++) starts[i + 1] = starts[i] + (sizes[i] ?? fallback)
  return starts
}

// The row/column at a pixel position (binary search over the starts).
function indexAt(starts, pos) {
  let lo = 0, hi = starts.length - 2
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1
    if (starts[mid] <= pos) lo = mid
    else hi = mid - 1
  }
  return Math.max(0, lo)
}

export default function Grid({
  wb, sheet, version, sel, onSelect, editing, renderEditor, pointMode, onPoint,
  refHighlights = [], onStartEdit, onFill, onContextMenu, onKeyDown, gridRef,
}) {
  const scrollerRef = useRef(null)
  const [scroll, setScroll] = useState({ top: 0, left: 0 })
  const [viewport, setViewport] = useState({ w: 800, h: 500 })
  const [liveSize, setLiveSize] = useState(null) // { axis, index, size } while dragging a header edge
  const [fillTarget, setFillTarget] = useState(null)

  // How much of the sheet the scroll area covers: what is used plus room to
  // grow, extended as the learner scrolls towards the edge.
  const bounds = useMemo(() => sheet.bounds(), [sheet, version])
  const rowCount = Math.min(MAX_GRID_ROWS, Math.max(200, bounds.rows + 100, Math.ceil((scroll.top + viewport.h * 2) / DEFAULT_ROW_H)))
  const colCount = Math.min(MAX_GRID_COLS, Math.max(30, bounds.cols + 10, Math.ceil((scroll.left + viewport.w * 2) / DEFAULT_COL_W)))

  const colSizes = liveSize?.axis === 'col' ? { ...sheet.colWidths, [liveSize.index]: liveSize.size } : sheet.colWidths
  const rowSizes = liveSize?.axis === 'row' ? { ...sheet.rowHeights, [liveSize.index]: liveSize.size } : sheet.rowHeights
  const cols = useMemo(() => prefixSums(colCount, colSizes, DEFAULT_COL_W), [colCount, colSizes, version])
  const rows = useMemo(() => prefixSums(rowCount, rowSizes, DEFAULT_ROW_H), [rowCount, rowSizes, version])

  useLayoutEffect(() => {
    const el = scrollerRef.current
    if (!el) return undefined
    const measure = () => setViewport({ w: el.clientWidth, h: el.clientHeight })
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Keep the active cell in view when the keyboard moves it.
  useLayoutEffect(() => {
    const el = scrollerRef.current
    if (!el) return
    const { row, col } = sel.focus
    if (row >= rowCount || col >= colCount) return
    const top = rows[row], bottom = rows[row + 1], left = cols[col], right = cols[col + 1]
    if (top < el.scrollTop) el.scrollTop = top
    else if (bottom > el.scrollTop + el.clientHeight) el.scrollTop = bottom - el.clientHeight
    if (left < el.scrollLeft) el.scrollLeft = left
    else if (right > el.scrollLeft + el.clientWidth) el.scrollLeft = right - el.clientWidth
  }, [sel.focus.row, sel.focus.col]) // eslint-disable-line react-hooks/exhaustive-deps

  const frame = useRef(0)
  const handleScroll = (e) => {
    const { scrollTop, scrollLeft } = e.currentTarget
    cancelAnimationFrame(frame.current)
    frame.current = requestAnimationFrame(() => setScroll({ top: scrollTop, left: scrollLeft }))
  }

  const r0 = Math.max(0, indexAt(rows, scroll.top) - OVERSCAN)
  const r1 = Math.min(rowCount - 1, indexAt(rows, scroll.top + viewport.h) + OVERSCAN)
  const c0 = Math.max(0, indexAt(cols, scroll.left) - OVERSCAN)
  const c1 = Math.min(colCount - 1, indexAt(cols, scroll.left + viewport.w) + OVERSCAN)

  const cellAt = (clientX, clientY) => {
    const rect = scrollerRef.current.getBoundingClientRect()
    const x = clientX - rect.left + scrollerRef.current.scrollLeft
    const y = clientY - rect.top + scrollerRef.current.scrollTop
    return { row: indexAt(rows, y), col: indexAt(cols, x) }
  }

  // Dragging past the edge scrolls the sheet.
  const edgeScroll = (clientX, clientY) => {
    const el = scrollerRef.current
    const rect = el.getBoundingClientRect()
    if (clientY > rect.bottom - 12) el.scrollTop += 24
    else if (clientY < rect.top + 12) el.scrollTop -= 24
    if (clientX > rect.right - 12) el.scrollLeft += 48
    else if (clientX < rect.left + 12) el.scrollLeft -= 48
  }

  const drag = (onMove, onUp) => (down) => {
    const target = down.currentTarget
    target.setPointerCapture?.(down.pointerId)
    const move = (e) => { edgeScroll(e.clientX, e.clientY); onMove(e) }
    const up = (e) => {
      target.removeEventListener('pointermove', move)
      target.removeEventListener('pointerup', up)
      target.removeEventListener('pointercancel', up)
      onUp?.(e)
    }
    target.addEventListener('pointermove', move)
    target.addEventListener('pointerup', up)
    target.addEventListener('pointercancel', up)
  }

  const handleCellsDown = (e) => {
    if (e.button !== 0) return
    const start = cellAt(e.clientX, e.clientY)
    if (pointMode) {
      // Pointing at cells while writing a formula: the formula keeps the focus.
      e.preventDefault()
      onPoint({ r1: start.row, c1: start.col, r2: start.row, c2: start.col })
      drag((m) => {
        const p = cellAt(m.clientX, m.clientY)
        onPoint({ r1: Math.min(start.row, p.row), c1: Math.min(start.col, p.col), r2: Math.max(start.row, p.row), c2: Math.max(start.col, p.col) })
      })(e)
      return
    }
    gridRef?.current?.focus({ preventScroll: true })
    const anchor = e.shiftKey ? sel.anchor : start
    onSelect({ active: e.shiftKey ? sel.active : start, anchor, focus: start })
    drag((m) => onSelect({ active: e.shiftKey ? sel.active : start, anchor, focus: cellAt(m.clientX, m.clientY) }))(e)
  }

  const range = selectionRange(sel)

  const handleFillDown = (e) => {
    e.stopPropagation()
    e.preventDefault()
    let target = null
    drag((m) => {
      const p = cellAt(m.clientX, m.clientY)
      // Extend along whichever direction the pointer has moved further.
      const down = p.row > range.r2 ? p.row - range.r2 : p.row < range.r1 ? p.row - range.r1 : 0
      const right = p.col > range.c2 ? p.col - range.c2 : p.col < range.c1 ? p.col - range.c1 : 0
      if (!down && !right) target = null
      else if (Math.abs(down) >= Math.abs(right)) target = down > 0 ? { ...range, r2: p.row } : { ...range, r1: p.row }
      else target = right > 0 ? { ...range, c2: p.col } : { ...range, c1: p.col }
      setFillTarget(target)
    }, () => {
      setFillTarget(null)
      if (target) onFill(range, target)
    })(e)
  }

  const headerDown = (axis, index) => (e) => {
    if (e.button !== 0) return
    gridRef?.current?.focus({ preventScroll: true })
    const whole = (i, j) => (axis === 'col'
      ? { active: { row: 0, col: Math.min(i, j) }, anchor: { row: 0, col: i }, focus: { row: MAX_GRID_ROWS - 1, col: j } }
      : { active: { row: Math.min(i, j), col: 0 }, anchor: { row: i, col: 0 }, focus: { row: j, col: MAX_GRID_COLS - 1 } })
    const from = e.shiftKey ? (axis === 'col' ? sel.anchor.col : sel.anchor.row) : index
    onSelect(whole(from, index))
    drag((m) => {
      const p = cellAt(m.clientX, m.clientY)
      onSelect(whole(from, axis === 'col' ? p.col : p.row))
    })(e)
  }

  const resizeDown = (axis, index) => (e) => {
    e.stopPropagation()
    e.preventDefault()
    const startPos = axis === 'col' ? e.clientX : e.clientY
    const startSize = axis === 'col' ? cols[index + 1] - cols[index] : rows[index + 1] - rows[index]
    let size = startSize
    drag((m) => {
      size = Math.max(axis === 'col' ? 24 : 16, startSize + (axis === 'col' ? m.clientX : m.clientY) - startPos)
      setLiveSize({ axis, index, size })
    }, () => {
      setLiveSize(null)
      wb.setSize(sheet.id, axis, index, size)
    })(e)
  }

  // Double-clicking a column's edge fits it to its widest value.
  const autofit = (col) => {
    let widest = 0
    const canvas = autofit.canvas ?? (autofit.canvas = document.createElement('canvas'))
    const ctx = canvas.getContext('2d')
    ctx.font = '13px system-ui, sans-serif'
    for (let r = 0; r < bounds.rows; r++) {
      const cell = wb.getCell(sheet.id, r, col)
      const { text } = displayCell(wb.valueAt(sheet, r, col), cell?.format)
      if (text) widest = Math.max(widest, ctx.measureText(text).width)
    }
    wb.setSize(sheet.id, 'col', col, widest ? widest + 14 : null)
  }

  // ── Cells ────────────────────────────────────────────────────────────
  const cells = []
  for (let r = r0; r <= r1; r++) {
    for (let c = c0; c <= c1; c++) {
      const key = cellKey(r, c)
      const cell = sheet.cells.get(key)
      const value = wb.valueAt(sheet, r, c)
      if (value === null && !cell?.style?.fill) continue
      const shown = displayCell(value, cell?.format)
      const style = cell?.style ?? {}
      const align = style.align ?? shown.align
      let width = cols[c + 1] - cols[c]
      let overflow = false
      // Text spills over empty cells to its right, as in Excel.
      if (shown.kind === 'text' && align === 'left') {
        let k = c + 1
        while (k < colCount && k <= c1 + 10 && wb.valueAt(sheet, r, k) === null && !sheet.cells.get(cellKey(r, k))?.style?.fill) k++
        if (k > c + 1) { width = cols[k] - cols[c]; overflow = true }
      }
      const spilled = sheet.spillOwner.has(key) && sheet.spillOwner.get(key) !== key
      cells.push(
        <div
          key={key}
          className={'ss-cell' + (shown.kind === 'error' ? ' is-error' : '') + (overflow ? ' is-overflow' : '') + (spilled ? ' is-spilled' : '')}
          style={{
            left: cols[c], top: rows[r], width, height: rows[r + 1] - rows[r],
            textAlign: align,
            fontWeight: style.bold ? 700 : undefined,
            fontStyle: style.italic ? 'italic' : undefined,
            textDecoration: style.underline ? 'underline' : undefined,
            color: style.color ?? (shown.color ? FORMAT_COLORS[shown.color] : textOn(style.fill)),
            background: style.fill,
          }}
          title={shown.kind === 'error' ? value.detail || value.code : undefined}
        >
          {shown.text}
        </div>,
      )
    }
  }

  const rect = (rg) => {
    const rr2 = Math.min(rg.r2, rowCount - 1), cc2 = Math.min(rg.c2, colCount - 1)
    return { left: cols[rg.c1], top: rows[rg.r1], width: cols[cc2 + 1] - cols[rg.c1], height: rows[rr2 + 1] - rows[rg.r1] }
  }

  const activeKey = cellKey(sel.active.row, sel.active.col)
  const spillAnchor = sheet.spills.has(activeKey) ? activeKey : sheet.spillOwner.get(activeKey)
  const spillRegion = spillAnchor ? sheet.spills.get(spillAnchor) : null

  const headCols = []
  for (let c = c0; c <= c1; c++) {
    const active = c >= range.c1 && c <= range.c2
    headCols.push(
      <div key={c} className={'ss-head' + (active ? ' is-active' : '')} style={{ left: cols[c], top: 0, width: cols[c + 1] - cols[c], height: HEAD_H }}
        onPointerDown={headerDown('col', c)} onContextMenu={(e) => onContextMenu(e, { kind: 'col', index: c })}>
        {indexToCol(c)}
        <div className="ss-resize" onPointerDown={resizeDown('col', c)} onDoubleClick={() => autofit(c)} title="Drag to resize, double-click to fit" />
      </div>,
    )
  }
  const headRows = []
  for (let r = r0; r <= r1; r++) {
    const active = r >= range.r1 && r <= range.r2
    headRows.push(
      <div key={r} className={'ss-head' + (active ? ' is-active' : '')} style={{ left: 0, top: rows[r], width: HEAD_W, height: rows[r + 1] - rows[r] }}
        onPointerDown={headerDown('row', r)} onContextMenu={(e) => onContextMenu(e, { kind: 'row', index: r })}>
        {r + 1}
        <div className="ss-resize-row" onPointerDown={resizeDown('row', r)} />
      </div>,
    )
  }

  const editorBox = editing?.where === 'cell' ? rect({ r1: sel.active.row, c1: sel.active.col, r2: sel.active.row, c2: sel.active.col }) : null

  return (
    <div ref={gridRef} className="ss-grid h-full w-full" tabIndex={0} onKeyDown={onKeyDown}
      // A stray text selection elsewhere on the page would receive Ctrl+C.
      onFocus={(e) => { if (e.target === e.currentTarget) window.getSelection()?.removeAllRanges() }}
      role="grid" aria-label={'Sheet ' + sheet.name + '. Selected ' + indexToCol(sel.active.col) + (sel.active.row + 1)}>
      <div className="ss-corner" style={{ width: HEAD_W, height: HEAD_H }} title="Select all"
        onPointerDown={() => onSelect({ active: { row: 0, col: 0 }, anchor: { row: 0, col: 0 }, focus: { row: MAX_GRID_ROWS - 1, col: MAX_GRID_COLS - 1 } })} />
      <div className="ss-headers" style={{ left: HEAD_W, top: 0, right: 0, height: HEAD_H }}>
        <div style={{ position: 'absolute', left: 0, top: 0, transform: `translateX(${-scroll.left}px)` }}>{headCols}</div>
      </div>
      <div className="ss-headers" style={{ left: 0, top: HEAD_H, width: HEAD_W, bottom: 0 }}>
        <div style={{ position: 'absolute', left: 0, top: 0, transform: `translateY(${-scroll.top}px)` }}>{headRows}</div>
      </div>
      <div ref={scrollerRef} className="ss-scroller" style={{ left: HEAD_W, top: HEAD_H, right: 0, bottom: 0 }} onScroll={handleScroll}>
        <div style={{ position: 'relative', width: cols[colCount], height: rows[rowCount] }}
          onPointerDown={handleCellsDown}
          onDoubleClick={(e) => { const p = cellAt(e.clientX, e.clientY); onStartEdit(p.row, p.col, null, 'edit') }}
          onContextMenu={(e) => onContextMenu(e, { kind: 'cell', ...cellAt(e.clientX, e.clientY) })}>
          {cells}
          {spillRegion && <div className="ss-spill-outline" style={rect(spillRegion)} />}
          {refHighlights.map((h, i) => <div key={i} className="ss-ref-outline" style={{ ...rect(h.range), borderColor: h.color }} />)}
          <div className="ss-selection" style={rect(range)} />
          <div className="ss-active" style={rect({ r1: sel.active.row, c1: sel.active.col, r2: sel.active.row, c2: sel.active.col })} />
          {!editing && (() => {
            const b = rect(range)
            return <div className="ss-fill-handle" style={{ left: b.left + b.width - 4, top: b.top + b.height - 4 }} onPointerDown={handleFillDown} title="Drag to fill: copies formulas, continues series such as 1, 2, 3 or Jan, Feb" />
          })()}
          {fillTarget && <div className="ss-fill-preview" style={rect(fillTarget)} />}
          {editorBox && renderEditor({ ...editorBox, width: Math.max(editorBox.width, 180) })}
        </div>
      </div>
    </div>
  )
}
