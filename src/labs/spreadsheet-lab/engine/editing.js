// Help while typing a formula: which function is being typed (autocomplete),
// which argument of which function the caret is in (the syntax hint), and
// where a clicked cell's address can be inserted ("point mode", as in Excel).

// Text up to the caret with string contents blanked out, so a "(" or "," in
// quotes is not mistaken for formula structure.
function code(text, caret) {
  let out = '', inString = false
  for (let i = 0; i < caret; i++) {
    const ch = text[i]
    if (ch === '"') inString = !inString
    out += inString && ch !== '"' ? ' ' : ch
  }
  return { text: out, inString }
}

// The function name being typed just before the caret, if any:
// "=SUM(A1)+AV|" → { prefix: 'AV', start: 9 }.
export function completionAt(text, caret) {
  if (!text.startsWith('=')) return null
  const { text: before, inString } = code(text, caret)
  if (inString) return null
  const m = /(^|[^A-Za-z0-9_.$!'])([A-Za-z][A-Za-z0-9.]*)$/.exec(before)
  if (!m) return null
  // "A1" or "B12" is a cell reference, not the start of a function name.
  if (/^[A-Za-z]{1,3}\d+$/.test(m[2])) return null
  return { prefix: m[2].toUpperCase(), start: caret - m[2].length }
}

// The functions learners reach for most, offered before rarer ones with the
// same first letters (AVERAGE before AVEDEV).
const POPULAR = ['SUM', 'AVERAGE', 'COUNT', 'COUNTA', 'COUNTIF', 'COUNTIFS', 'IF', 'IFS', 'IFERROR', 'MAX', 'MIN', 'ROUND', 'SUMIF', 'SUMIFS', 'AVERAGEIF',
  'VLOOKUP', 'XLOOKUP', 'INDEX', 'MATCH', 'FILTER', 'SORT', 'UNIQUE', 'SEQUENCE', 'LEN', 'LEFT', 'RIGHT', 'MID', 'TEXT', 'CONCAT', 'TEXTJOIN', 'TRIM',
  'DATE', 'TODAY', 'NOW', 'YEAR', 'MONTH', 'DAY', 'MEDIAN', 'STDEV.S', 'AND', 'OR', 'NOT', 'ABS', 'SQRT', 'POWER', 'PMT', 'RAND', 'RANDBETWEEN', 'LET']
const RANK = new Map(POPULAR.map((n, i) => [n, i]))

export function matchingFunctions(functions, prefix, limit = 8) {
  const names = Object.keys(functions).filter((n) => n.startsWith(prefix))
  const rank = (n) => RANK.get(n) ?? Infinity
  return names.sort((a, b) => rank(a) - rank(b) || a.length - b.length || a.localeCompare(b)).slice(0, limit)
}

// The innermost function call the caret is inside, and which argument:
// "=ROUND(SUM(A1, B1|" → { name: 'SUM', argIndex: 1 }.
export function callAt(text, caret) {
  if (!text.startsWith('=')) return null
  const { text: before } = code(text, caret)
  const stack = []
  for (let i = 0; i < before.length; i++) {
    const ch = before[i]
    if (ch === '(') {
      const m = /([A-Za-z][A-Za-z0-9.]*)\s*$/.exec(before.slice(0, i))
      stack.push({ name: m ? m[1].toUpperCase() : null, argIndex: 0 })
    } else if (ch === ')') stack.pop()
    else if (ch === ',' && stack.length) stack[stack.length - 1].argIndex++
    else if (ch === '{') stack.push({ name: null, argIndex: 0, array: true })
    else if (ch === '}') stack.pop()
  }
  for (let i = stack.length - 1; i >= 0; i--) if (stack[i].name) return stack[i]
  return null
}

// The arguments of a syntax line, for highlighting the current one:
// "ROUND(number, num_digits)" → ['number', 'num_digits'].
export function syntaxArgs(syntax) {
  const inner = /\((.*)\)/.exec(syntax)?.[1] ?? ''
  return inner.split(',').map((s) => s.trim()).filter(Boolean)
}

// Whether clicking a cell while editing should insert its address: after an
// operator, an opening bracket or a comma, as in Excel's point mode.
export function canInsertReference(text, caret) {
  if (!text.startsWith('=')) return false
  const { text: before, inString } = code(text, caret)
  if (inString) return false
  const last = before.trimEnd().slice(-1)
  return '=(,+-*/^&<>:;{'.includes(last)
}
