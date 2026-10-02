// The kinds of value a cell or formula can hold, and the rules for turning one
// kind into another (coercion). These rules follow Excel, because learners will
// meet them there, and each one is documented because each one surprises
// someone.
//
// A value is one of:
//   number            all numbers are 64-bit floats, as in Excel and JavaScript
//   string            text
//   boolean           TRUE / FALSE
//   null              an empty cell ("blank")
//   CellError         #DIV/0!, #VALUE!, … (see ERRORS)
//   Matrix            a 2D block of values: a range, or an array result

export class CellError {
  constructor(code, detail = '') {
    this.code = code
    this.detail = detail // a sentence for learners: what exactly went wrong
  }
  toString() { return this.code }
}

// Every error, with an explanation written for someone meeting it for the first time.
export const ERRORS = {
  '#DIV/0!': { title: 'Division by zero', why: 'A formula divided by zero, or by an empty cell (which counts as 0).', fix: 'Check the divisor. To show something else instead, wrap the formula: =IFERROR(A1/B1, "")' },
  '#VALUE!': { title: 'Wrong kind of value', why: 'An operation got a value of the wrong type, for example text where a number was needed: ="apple"+1.', fix: 'Check that the cells the formula uses contain numbers. VALUE() turns text that looks like a number into a number.' },
  '#NAME?': { title: 'Unknown name', why: 'The formula uses a function or name that does not exist, often a typo such as =SUMM(A1:A3), or text without quotes.', fix: 'Check the spelling. Text must be in double quotes: ="hello".' },
  '#REF!': { title: 'Invalid reference', why: 'The formula refers to a cell that does not exist, for example after the row it pointed at was deleted, or an index past the end of a range.', fix: 'Rewrite the reference, or check the row/column number given to INDEX or OFFSET.' },
  '#N/A': { title: 'Not available', why: 'A lookup (VLOOKUP, MATCH, XLOOKUP…) did not find the value it was looking for.', fix: 'Check the value really is in the lookup range, with the same type (the number 5 is not the text "5"). IFNA() can supply a fallback.' },
  '#NUM!': { title: 'Invalid number', why: 'A calculation produced a number that is not valid: the square root of a negative number, or a result too large to store.', fix: 'Check the inputs are in the range the function accepts.' },
  '#NULL!': { title: 'Empty intersection', why: 'Two ranges were combined with a space (the intersection operator) but do not overlap.', fix: 'Use a comma or colon between ranges, not a space.' },
  '#SPILL!': { title: 'Spill blocked', why: 'This formula returns several values, which "spill" into the cells beside and below it, but some of those cells are not empty.', fix: 'Clear the cells in the way, or move the formula somewhere with room.' },
  '#CYCLE!': { title: 'Circular reference', why: 'This cell depends on itself, directly or through other cells, so there is no order in which to calculate it. (Excel shows a warning and 0; this lab shows the error so it cannot be missed.)', fix: 'Follow the precedents (the cells the formula uses) and break the loop.' },
  '#CALC!': { title: 'Calculation problem', why: 'The function could not produce a result, for example FILTER with no matching rows.', fix: 'Give the function a fallback argument, such as FILTER(A1:A9, B1:B9>5, "none").' },
  '#BUSY!': { title: 'Still calculating', why: 'A Python, JavaScript or MATLAB cell is still running. The value appears when it finishes.', fix: 'Wait a moment. If it never finishes, the code may be stuck in a loop.' },
  '#CODE!': { title: 'Code error', why: 'A Python, JavaScript or MATLAB cell raised an error.', fix: 'Select the cell to see the error message from the language.' },
}

export const err = (code, detail) => new CellError(code, detail)
export const isError = (v) => v instanceof CellError

// Errors travel through calculations: =A1+1 where A1 is #N/A is #N/A. Functions
// throw this to stop immediately; the evaluator catches it and the cell shows it.
export class ErrorSignal extends Error {
  constructor(error) { super(error.code); this.error = error }
}
export const fail = (code, detail) => { throw new ErrorSignal(err(code, detail)) }
export const raise = (error) => { throw new ErrorSignal(error) }

// A rectangular block of values. `ref` remembers where it came from when it is
// a range on a sheet (functions such as ROW() and INDEX use it).
export class Matrix {
  constructor(rows, ref = null) {
    this.rows = rows
    this.ref = ref
  }
  get height() { return this.rows.length }
  get width() { return this.rows[0]?.length ?? 0 }
  get(r, c) { return this.rows[r]?.[c] ?? null }
  // Every value in row order. A plain array, not a generator: SUM and friends
  // loop over this for every cell of every range, and a generator was several
  // times slower.
  values() {
    const out = []
    for (const row of this.rows) for (const v of row) out.push(v)
    return out
  }
  map(fn) { return new Matrix(this.rows.map((row, r) => row.map((v, c) => fn(v, r, c)))) }
  static of(value) { return value instanceof Matrix ? value : new Matrix([[value]]) }
  static fill(h, w, fn) { return new Matrix(Array.from({ length: h }, (_, r) => Array.from({ length: w }, (_, c) => fn(r, c)))) }
}
export const isMatrix = (v) => v instanceof Matrix

// ── Coercion ──────────────────────────────────────────────────────────────
// Excel's rules, which differ from JavaScript's in places learners notice:
//   blank → 0 in arithmetic, "" in text;   TRUE → 1;   "12" → 12 in arithmetic;
//   "abc" in arithmetic → #VALUE!  (JavaScript would give NaN).

const NUMERIC_TEXT = /^\s*[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?\s*%?\s*$/

export function textToNumber(s) {
  if (!NUMERIC_TEXT.test(s)) return null
  const t = s.trim()
  return t.endsWith('%') ? Number(t.slice(0, -1)) / 100 : Number(t)
}

export function toNumber(v) {
  if (typeof v === 'number') return v
  if (v === null || v === undefined) return 0
  if (typeof v === 'boolean') return v ? 1 : 0
  if (v instanceof CellError) raise(v)
  if (v instanceof Matrix) return toNumber(v.get(0, 0))
  const n = textToNumber(String(v))
  if (n === null) fail('#VALUE!', 'Expected a number but got the text "' + v + '".')
  return n
}

export function toText(v) {
  if (v === null || v === undefined) return ''
  if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE'
  if (typeof v === 'number') return formatGeneral(v)
  if (v instanceof CellError) raise(v)
  if (v instanceof Matrix) return toText(v.get(0, 0))
  return String(v)
}

export function toBoolean(v) {
  if (typeof v === 'boolean') return v
  if (v === null || v === undefined) return false
  if (typeof v === 'number') return v !== 0
  if (v instanceof CellError) raise(v)
  if (v instanceof Matrix) return toBoolean(v.get(0, 0))
  const s = String(v).toUpperCase()
  if (s === 'TRUE') return true
  if (s === 'FALSE') return false
  fail('#VALUE!', 'Expected TRUE or FALSE but got the text "' + v + '".')
}

// A finished number must be finite: Infinity and NaN become #NUM! / #DIV/0!.
export function checkNumber(n) {
  if (Number.isNaN(n)) fail('#NUM!', 'The result is not a number.')
  if (!Number.isFinite(n)) fail('#NUM!', 'The result is too large.')
  return n
}

// How a number appears in a cell with the "General" format: up to 11
// significant characters, switching to scientific notation when needed.
export function formatGeneral(n) {
  if (Number.isInteger(n) && Math.abs(n) < 1e11) return String(n)
  if (n === 0) return '0'
  const abs = Math.abs(n)
  if (abs >= 1e11 || abs < 1e-9) return n.toExponential(5).replace(/\.?0+e/, 'E').replace('e', 'E').replace(/E\+?/, 'E+').replace('E+-', 'E-')
  const digits = Math.max(0, 10 - Math.floor(Math.log10(abs)))
  return String(+n.toFixed(Math.min(digits, 10)))
}

export function typeName(v) {
  if (v === null || v === undefined) return 'blank'
  if (typeof v === 'number') return 'number'
  if (typeof v === 'string') return 'text'
  if (typeof v === 'boolean') return 'logical'
  if (v instanceof CellError) return 'error'
  if (v instanceof Matrix) return 'array'
  return 'unknown'
}

// Values as a learner would type them into a formula: 3, "text", TRUE, #N/A, {1,2;3,4}.
export function literal(v, limit = 6) {
  if (v === null || v === undefined) return '(blank)'
  if (typeof v === 'string') return '"' + v.replace(/"/g, '""') + '"'
  if (typeof v === 'number') return formatGeneral(v)
  if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE'
  if (v instanceof CellError) return v.code
  if (v instanceof Matrix) {
    const rows = v.rows.slice(0, limit).map((row) => row.slice(0, limit).map((x) => literal(x)).join(',') + (row.length > limit ? ',…' : ''))
    return '{' + rows.join(';') + (v.rows.length > limit ? ';…' : '') + '}'
  }
  return String(v)
}
