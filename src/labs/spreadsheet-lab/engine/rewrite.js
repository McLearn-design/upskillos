// Rewriting the references inside formula text.
//
// Copying =A1*2 from B1 to B2 gives =A2*2: references are relative, they
// describe "the cell one to my left" rather than "A1". A $ fixes a part:
// =$A$1 always means A1, =$A1 keeps the column, =A$1 keeps the row. The same
// machinery moves references when rows or columns are inserted or deleted.
import { tokenize } from './parser.js'
import { colToIndex, indexToCol, parseCell, quoteSheet, MAX_ROWS, MAX_COLS } from './address.js'

// A reference found in formula text, in a shape `map` can change:
//   { kind: 'cell' | 'range' | 'cols' | 'rows', sheet, r1, c1, r2, c2,
//     abs: { r1, c1, r2, c2 } }        (spill refs A1# are kind 'cell' with spill: true)
// map(ref) returns the new ref, or null when the reference no longer exists (#REF!).
export function transformFormula(input, map) {
  if (!input.startsWith('=')) return input
  const text = input.slice(1)
  let tokens
  try { tokens = tokenize(text) } catch { return input } // leave unreadable formulas alone
  let out = ''
  let pos = 0
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i]
    let sheet = null
    let start = t.start
    let j = i
    if (t.type === 'sheet') { sheet = t.value; j = i + 1 }
    const a = tokens[j]
    let ref = null, end = 0, consumed = j
    if (a?.type === 'cell' || a?.type === 'spillref') {
      const p = parseCell(a.value.replace(/#$/, ''))
      const b = tokens[j + 2]
      if (a.type === 'cell' && tokens[j + 1]?.type === 'op' && tokens[j + 1].value === ':' && b?.type === 'cell') {
        const q = parseCell(b.value)
        ref = { kind: 'range', r1: p.row, c1: p.col, r2: q.row, c2: q.col, abs: { r1: p.absRow, c1: p.absCol, r2: q.absRow, c2: q.absCol } }
        end = b.end; consumed = j + 2
      } else {
        ref = { kind: 'cell', spill: a.type === 'spillref', r1: p.row, c1: p.col, r2: p.row, c2: p.col, abs: { r1: p.absRow, c1: p.absCol, r2: p.absRow, c2: p.absCol } }
        end = a.end; consumed = j
      }
    } else if (a?.type === 'colrange') {
      const [x, y] = a.value.split(':')
      ref = { kind: 'cols', r1: 0, r2: MAX_ROWS - 1, c1: colToIndex(x.replace('$', '')), c2: colToIndex(y.replace('$', '')), abs: { c1: x.startsWith('$'), c2: y.startsWith('$'), r1: true, r2: true } }
      end = a.end; consumed = j
    } else if (a?.type === 'rowrange') {
      const [x, y] = a.value.split(':')
      ref = { kind: 'rows', c1: 0, c2: MAX_COLS - 1, r1: Number(x.replace('$', '')) - 1, r2: Number(y.replace('$', '')) - 1, abs: { r1: x.startsWith('$'), r2: y.startsWith('$'), c1: true, c2: true } }
      end = a.end; consumed = j
    }
    if (!ref) continue
    ref.sheet = sheet ? unquote(sheet) : null
    const mapped = map(ref)
    // A map may also change which sheet the reference names (sheet renamed).
    const prefix = !mapped ? '' : mapped.sheet === ref.sheet ? (sheet ?? '') : mapped.sheet ? quoteSheet(mapped.sheet) + '!' : ''
    out += text.slice(pos, start) + (mapped ? prefix + formatRef(mapped) : '#REF!')
    pos = end
    i = consumed
  }
  return '=' + out + text.slice(pos)
}

const unquote = (raw) => {
  const name = raw.slice(0, -1)
  return name.startsWith("'") ? name.slice(1, -1).replace(/''/g, "'") : name
}

function formatRef(ref) {
  const col = (c, abs) => (abs ? '$' : '') + indexToCol(c)
  const row = (r, abs) => (abs ? '$' : '') + (r + 1)
  if (ref.kind === 'cols') return col(ref.c1, ref.abs.c1) + ':' + col(ref.c2, ref.abs.c2)
  if (ref.kind === 'rows') return row(ref.r1, ref.abs.r1) + ':' + row(ref.r2, ref.abs.r2)
  const a = col(ref.c1, ref.abs.c1) + row(ref.r1, ref.abs.r1)
  if (ref.kind === 'cell') return a + (ref.spill ? '#' : '')
  return a + ':' + col(ref.c2, ref.abs.c2) + row(ref.r2, ref.abs.r2)
}

const inBounds = (r) => r.r1 >= 0 && r.c1 >= 0 && r.r2 < MAX_ROWS && r.c2 < MAX_COLS

// The formula as it reads when copied dRows down and dCols right.
export function shiftFormula(input, dRows, dCols) {
  return transformFormula(input, (ref) => {
    const next = {
      ...ref,
      r1: ref.abs.r1 ? ref.r1 : ref.r1 + dRows,
      r2: ref.abs.r2 ? ref.r2 : ref.r2 + dRows,
      c1: ref.abs.c1 ? ref.c1 : ref.c1 + dCols,
      c2: ref.abs.c2 ? ref.c2 : ref.c2 + dCols,
    }
    return inBounds(next) ? next : null
  })
}

// After inserting (count > 0) or deleting (count < 0) rows at `at` on the
// sheet named `sheetName`, every reference to that sheet moves with its cells,
// whether or not it has $ signs. A reference to a deleted cell becomes #REF!;
// a range losing some of its rows shrinks.
export function adjustForRows(input, { formulaSheet, sheetName, at, count }) {
  return adjust(input, { formulaSheet, sheetName, at, count, axis: 'r' })
}

export function adjustForCols(input, { formulaSheet, sheetName, at, count }) {
  return adjust(input, { formulaSheet, sheetName, at, count, axis: 'c' })
}

function adjust(input, { formulaSheet, sheetName, at, count, axis }) {
  const lo = axis + '1', hi = axis + '2'
  return transformFormula(input, (ref) => {
    const target = ref.sheet ?? formulaSheet
    if (target.toLowerCase() !== sheetName.toLowerCase()) return ref
    if ((axis === 'r' && ref.kind === 'cols') || (axis === 'c' && ref.kind === 'rows')) return ref
    const next = { ...ref }
    if (count > 0) {
      if (next[lo] >= at) next[lo] += count
      if (next[hi] >= at) next[hi] += count
      return inBounds(next) ? next : null
    }
    const gone = -count, end = at + gone - 1 // rows/cols at..end are deleted
    const move = (v) => (v > end ? v - gone : v)
    if (next[lo] >= at && next[hi] <= end) return null // entirely deleted
    next[lo] = next[lo] >= at && next[lo] <= end ? at : move(next[lo])
    next[hi] = next[hi] >= at && next[hi] <= end ? at - 1 : move(next[hi])
    if (next[hi] < next[lo]) return null
    return next
  })
}

// References to a renamed sheet follow the new name; references to a deleted
// sheet (newName null) become #REF!.
export function renameSheetRefs(input, oldName, newName) {
  return transformFormula(input, (ref) => {
    if (!ref.sheet || ref.sheet.toLowerCase() !== oldName.toLowerCase()) return ref
    return newName ? { ...ref, sheet: newName } : null
  })
}
