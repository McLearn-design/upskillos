// Python, JavaScript and MATLAB cells.
//
// A code cell reads the sheet with xl("A1:B5"), like Excel's Python cells, and
// the value of its last line goes into the cell. These are the rules for
// what crosses between the sheet and each language, shared by the workers that
// run the code and the tests that check them.
//
//   sheet → code   xl("C3")          a single value
//                  xl("A1:A10")      a flat list (one row or one column)
//                  xl("A1:C10")      a list of rows
//   code → sheet   a number, text, TRUE/FALSE, nothing (blank)
//                  a flat list       spills down a column
//                  a list of rows    spills as a block
//                  a table (pandas)  spills with its column names on top

export const LANGUAGES = {
  py: { label: 'Python', short: 'PY', starter: '# Read cells with xl("A1:B5"). The last line is the cell\'s value.\nvalues = xl("A1:A5")\nsum(values) / len(values)' },
  js: { label: 'JavaScript', short: 'JS', starter: '// Read cells with xl("A1:B5"). Return the cell\'s value.\nconst values = xl("A1:A5")\nreturn values.reduce((a, b) => a + b, 0) / values.length' },
  matlab: { label: 'MATLAB', short: 'M', starter: '% Read cells with xl("A1:B5"). The last line is the cell\'s value.\nv = xl("A1:A5");\nmean(v)' },
}

// Typing =PY(, =JS( or =MATLAB( turns a cell into a code cell (as =PY( does in Excel).
export function codeLanguageFromInput(text) {
  const m = /^=\s*(PY|PYTHON|JS|JAVASCRIPT|MATLAB)\s*\(/i.exec(text ?? '')
  if (!m) return null
  const word = m[1].toUpperCase()
  return word.startsWith('PY') ? 'py' : word.startsWith('J') ? 'js' : 'matlab'
}

// The code with its comments blanked out as spaces (same length, strings
// kept), so an xl("…") that only appears in a comment, such as an example, is
// not a real reference, and positions still match the original.
export function stripComments(source, lang) {
  let out = '', quote = null
  for (let i = 0; i < source.length; i++) {
    const ch = source[i]
    if (quote) {
      out += ch
      if (ch === '\\' && lang !== 'matlab') { i++; out += source[i] ?? ''; continue }
      if (ch === quote) quote = null
      continue
    }
    const lineComment = (lang === 'py' && ch === '#') || (lang === 'matlab' && ch === '%') || (lang === 'js' && ch === '/' && source[i + 1] === '/')
    if (lineComment) {
      while (i < source.length && source[i] !== '\n') { out += ' '; i++ }
      if (i < source.length) out += '\n'
      continue
    }
    if (lang === 'js' && ch === '/' && source[i + 1] === '*') {
      const end = source.indexOf('*/', i + 2)
      const stop = end < 0 ? source.length : end + 2
      out += source.slice(i, stop).replace(/[^\n]/g, ' ')
      i = stop - 1
      continue
    }
    // In MATLAB a ' after a name, number or bracket is the transpose operator (A'), not text.
    const transpose = lang === 'matlab' && ch === "'" && /[\w)\]}.']/.test(out.trimEnd().slice(-1)) && !/\s/.test(source[i - 1] ?? ' ')
    if (!transpose && (ch === '"' || ch === "'" || (lang === 'js' && ch === '`'))) quote = ch
    out += ch
  }
  return out
}

// The references a piece of code reads: every xl("…") with a literal address
// (outside comments).
export function codeReferences(source, lang = 'py') {
  source = stripComments(source, lang)
  const out = []
  const re = /\bxl\(\s*(["'])((?:'[^']+'|[A-Za-z0-9_. ]+)?!?\$?[A-Za-z]{1,3}\$?\d+(?::\$?[A-Za-z]{1,3}\$?\d+)?)\1/g
  let m
  while ((m = re.exec(source))) out.push(m[2])
  return out
}

// A sheet value as plain data a worker can receive. An error stays an error.
export function plainValue(v) {
  if (v === null || v === undefined) return null
  if (typeof v === 'object' && 'code' in v) return { error: v.code }
  return v
}

// The shape xl() returns for a range of rows (already plain values).
export function shapeForCode(rows) {
  if (rows.length === 1 && rows[0].length === 1) return rows[0][0]
  if (rows.length === 1) return rows[0]
  if (rows.every((r) => r.length === 1)) return rows.map((r) => r[0])
  return rows
}

// A value a language produced → sheet rows ([[…]]) or a single value.
// Plain JSON in, so the same rules apply to all three languages.
export function sheetValue(v) {
  if (v === undefined || v === null) return { value: null }
  if (typeof v === 'number') return Number.isFinite(v) ? { value: v } : { error: '#NUM!', detail: 'The code returned ' + v + ', which is not a finite number.' }
  if (typeof v === 'string' || typeof v === 'boolean') return { value: v }
  if (Array.isArray(v)) {
    if (!v.length) return { value: null }
    const rows = v.every(Array.isArray) ? v : v.map((x) => [x])
    const width = Math.max(...rows.map((r) => r.length))
    const cell = (x) => {
      if (x === null || x === undefined) return null
      if (typeof x === 'number') return Number.isFinite(x) ? x : { error: '#NUM!' }
      if (typeof x === 'string' || typeof x === 'boolean') return x
      return JSON.stringify(x)
    }
    return { rows: rows.map((r) => Array.from({ length: width }, (_, i) => cell(r[i]))) }
  }
  if (typeof v === 'object') {
    if (v.__table__) return { rows: [v.columns, ...v.rows].map((r) => r.map((x) => sheetValue(x).value ?? null)) }
    // A plain object: two columns, key and value.
    return { rows: Object.entries(v).map(([k, x]) => [k, sheetValue(x).value ?? JSON.stringify(x)]) }
  }
  return { value: String(v) }
}

// MATLAB has no xl() function, so each xl("…") is replaced by the values as a
// MATLAB literal before the code runs: numbers become a matrix [1 2; 3 4],
// text becomes a string array ["a" "b"].
export function matlabLiteral(value) {
  const scalar = (x) => {
    if (x === null || x === undefined) return 'NaN'
    if (typeof x === 'number') return Number.isFinite(x) ? String(x) : (Number.isNaN(x) ? 'NaN' : x > 0 ? 'Inf' : '-Inf')
    if (typeof x === 'boolean') return x ? 'true' : 'false'
    return '"' + String(x).replace(/"/g, '""') + '"'
  }
  if (!Array.isArray(value)) return scalar(value)
  const rows = value.every(Array.isArray) ? value : value.map((x) => [x]) // a flat list is a column, as in the sheet
  const kinds = new Set(rows.flat().map((x) => (typeof x === 'string' ? 'text' : 'number')))
  if (kinds.size > 1) throw new Error('This range mixes numbers and text. A MATLAB matrix holds one type: read the numbers and the text as separate ranges.')
  return '[' + rows.map((r) => r.map(scalar).join(' ')).join('; ') + ']'
}

export function substituteMatlab(source, inputs) {
  // Find the calls in the code with comments blanked out, then replace them
  // in the original (same positions), so comments stay as they were.
  const code = stripComments(source, 'matlab')
  const re = /\bxl\(\s*(["'])([^"']+)\1\s*\)/g
  const found = []
  let m
  while ((m = re.exec(code))) found.push({ start: m.index, end: m.index + m[0].length, ref: m[2] })
  let out = source
  for (const { start, end, ref } of found.reverse()) {
    if (!(ref in inputs)) throw new Error('xl("' + ref + '") is not a cell or range this lab can read.')
    out = out.slice(0, start) + matlabLiteral(inputs[ref]) + out.slice(end)
  }
  return out
}

// Which MATLAB variable is the cell's value: the one assigned on the last
// line, or ans when the last line is an expression (as MATLAB itself shows).
export function matlabResultName(source) {
  const lines = source.split('\n').map((l) => l.replace(/%.*$/, '').trim()).filter(Boolean)
  const last = lines.at(-1) ?? ''
  const multi = /^\[\s*([A-Za-z]\w*)/.exec(last)
  if (multi && /\]\s*=(?!=)/.test(last)) return multi[1]
  const single = /^([A-Za-z]\w*)\s*(\([^)]*\))?\s*=(?!=)/.exec(last)
  return single ? single[1] : 'ans'
}
