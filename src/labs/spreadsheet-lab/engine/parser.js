// Formula text → tokens → syntax tree.
//
// The tree is what the evaluator runs, and also what the "Explain" panel shows
// learners, so every node keeps its position in the source text (start, end).
//
// Operator precedence, highest first (as in Excel):
//   :          range               A1:B3
//   -  +      negation (prefix)   -A1         ← binds tighter than ^, so -2^2 = 4
//   %          percent (postfix)   50%
//   ^          power               2^3        ← left to right: 2^3^2 = 64
//   *  /       multiply, divide
//   +  -       add, subtract
//   &          join text
//   = <> < > <= >=  comparison

import { colToIndex, parseCell } from './address.js'

export class ParseError extends Error {
  constructor(message, pos) { super(message); this.pos = pos }
}

const ERROR_LITERALS = ['#DIV/0!', '#VALUE!', '#NAME?', '#REF!', '#N/A', '#NUM!', '#NULL!', '#SPILL!', '#CALC!']

// ── Lexer ─────────────────────────────────────────────────────────────────
const RULES = [
  ['space', /^\s+/],
  ['string', /^"(?:[^"]|"")*"/],
  ['sheet', /^'(?:[^']|'')+'!/],
  ['sheet', /^[A-Za-z_][A-Za-z0-9_.]*!/],
  ['colrange', /^\$?[A-Za-z]{1,3}:\$?[A-Za-z]{1,3}(?![A-Za-z0-9_.(!])/],
  ['rowrange', /^\$?\d+:\$?\d+(?![0-9.])/],
  ['number', /^(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?/],
  ['spillref', /^\$?[A-Za-z]{1,3}\$?\d+#/],
  ['cell', /^\$?[A-Za-z]{1,3}\$?\d+(?![A-Za-z0-9_.(!])/],
  ['bool', /^(TRUE|FALSE)(?![A-Za-z0-9_.(])/i],
  ['name', /^[A-Za-z_\\][A-Za-z0-9_.]*/],
  ['op', /^(<=|>=|<>|[-+*/^&=<>%:(),;{}])/],
]

export function tokenize(text) {
  const tokens = []
  let pos = 0
  while (pos < text.length) {
    const rest = text.slice(pos)
    if (rest[0] === '#') {
      const lit = ERROR_LITERALS.find((e) => rest.toUpperCase().startsWith(e))
      if (!lit) throw new ParseError('Unknown error value starting "' + rest.slice(0, 8) + '"', pos)
      tokens.push({ type: 'error', value: lit, start: pos, end: pos + lit.length })
      pos += lit.length
      continue
    }
    let matched = false
    for (const [type, re] of RULES) {
      const m = re.exec(rest)
      if (!m) continue
      matched = true
      const raw = m[0]
      if (type !== 'space') tokens.push({ type, value: raw, start: pos, end: pos + raw.length })
      pos += raw.length
      break
    }
    if (!matched) throw new ParseError('Unexpected character "' + text[pos] + '"', pos)
  }
  tokens.push({ type: 'eof', value: '', start: text.length, end: text.length })
  return tokens
}

// ── Parser (Pratt / precedence climbing) ─────────────────────────────────
const INFIX = {
  '=': 10, '<>': 10, '<': 10, '>': 10, '<=': 10, '>=': 10,
  '&': 20,
  '+': 30, '-': 30,
  '*': 40, '/': 40,
  '^': 50,
}
const PREFIX_POWER = 60
const POSTFIX_POWER = 70

function unquoteSheet(raw) {
  const name = raw.slice(0, -1)
  return name.startsWith("'") ? name.slice(1, -1).replace(/''/g, "'") : name
}

export function parse(text) {
  const tokens = tokenize(text)
  let i = 0
  const peek = () => tokens[i]
  const next = () => tokens[i++]
  const expectOp = (value) => {
    const t = next()
    if (t.type !== 'op' || t.value !== value) throw new ParseError('Expected "' + value + '" but found ' + (t.type === 'eof' ? 'the end of the formula' : '"' + t.value + '"'), t.start)
    return t
  }

  function expression(minPower = 0) {
    let left = prefix()
    for (;;) {
      const t = peek()
      if (t.type !== 'op') break
      if (t.value === '%' && POSTFIX_POWER >= minPower) {
        next()
        left = { type: 'percent', arg: left, start: left.start, end: t.end }
        continue
      }
      const power = INFIX[t.value]
      if (power === undefined || power <= minPower) break
      next()
      const right = expression(power) // left-associative: the right side must bind tighter
      left = { type: 'binary', op: t.value, left, right, start: left.start, end: right.end }
    }
    return left
  }

  function prefix() {
    const t = peek()
    if (t.type === 'op' && (t.value === '-' || t.value === '+')) {
      next()
      const arg = expression(PREFIX_POWER - 1)
      // Fold a minus sign directly into a number literal: -5 is a number, not an operation.
      if (t.value === '-' && arg.type === 'number' && arg.start === t.end) return { type: 'number', value: -arg.value, start: t.start, end: arg.end }
      return { type: 'unary', op: t.value, arg, start: t.start, end: arg.end }
    }
    return primary()
  }

  function reference(sheet, start) {
    const t = next()
    if (t.type === 'spillref') {
      // A1# means "the whole block of values that the formula in A1 spilled".
      const a = parseCell(t.value.slice(0, -1))
      return { type: 'spill', sheet, row: a.row, col: a.col, text: t.value, start, end: t.end }
    }
    if (t.type === 'cell') {
      const a = parseCell(t.value)
      if (!a) throw new ParseError('"' + t.value + '" is outside the sheet', t.start)
      if (peek().type === 'op' && peek().value === ':' && tokens[i + 1]?.type === 'cell') {
        next()
        const u = next()
        const b = parseCell(u.value)
        if (!b) throw new ParseError('"' + u.value + '" is outside the sheet', u.start)
        return {
          type: 'range', kind: 'cells', sheet,
          r1: Math.min(a.row, b.row), c1: Math.min(a.col, b.col), r2: Math.max(a.row, b.row), c2: Math.max(a.col, b.col),
          text: t.value + ':' + u.value, start, end: u.end,
        }
      }
      return { type: 'cell', sheet, row: a.row, col: a.col, absRow: a.absRow, absCol: a.absCol, text: t.value, start, end: t.end }
    }
    if (t.type === 'colrange') {
      const [a, b] = t.value.replace(/\$/g, '').split(':').map(colToIndex)
      return { type: 'range', kind: 'cols', sheet, r1: 0, c1: Math.min(a, b), r2: Infinity, c2: Math.max(a, b), text: t.value, start, end: t.end }
    }
    if (t.type === 'rowrange') {
      const [a, b] = t.value.replace(/\$/g, '').split(':').map((n) => Number(n) - 1)
      return { type: 'range', kind: 'rows', sheet, r1: Math.min(a, b), c1: 0, r2: Math.max(a, b), c2: Infinity, text: t.value, start, end: t.end }
    }
    throw new ParseError('Expected a cell reference after the sheet name', t.start)
  }

  function primary() {
    const t = peek()
    switch (t.type) {
      case 'number': next(); return { type: 'number', value: Number(t.value), start: t.start, end: t.end }
      case 'string': next(); return { type: 'string', value: t.value.slice(1, -1).replace(/""/g, '"'), start: t.start, end: t.end }
      case 'bool': next(); return { type: 'bool', value: t.value.toUpperCase() === 'TRUE', start: t.start, end: t.end }
      case 'error': next(); return { type: 'error', value: t.value, start: t.start, end: t.end }
      case 'sheet': next(); return reference(unquoteSheet(t.value), t.start)
      case 'cell': case 'colrange': case 'rowrange': case 'spillref': return reference(null, t.start)
      case 'name': {
        next()
        if (peek().type === 'op' && peek().value === '(') return call(t)
        return { type: 'name', name: t.value.toUpperCase(), start: t.start, end: t.end }
      }
      case 'op':
        if (t.value === '(') {
          next()
          const inner = expression()
          const close = expectOp(')')
          return { type: 'group', arg: inner, start: t.start, end: close.end }
        }
        if (t.value === '{') return arrayLiteral()
        break
      default:
    }
    throw new ParseError(t.type === 'eof' ? 'The formula ends too early' : 'Unexpected "' + t.value + '"', t.start)
  }

  function call(nameToken) {
    expectOp('(')
    const args = []
    if (!(peek().type === 'op' && peek().value === ')')) {
      for (;;) {
        // An empty argument, as in =IF(A1,,2), is allowed and means "missing".
        if (peek().type === 'op' && (peek().value === ',' || peek().value === ')')) args.push({ type: 'missing', start: peek().start, end: peek().start })
        else args.push(expression())
        if (peek().type === 'op' && peek().value === ',') { next(); continue }
        break
      }
    }
    const close = expectOp(')')
    return { type: 'call', name: nameToken.value.toUpperCase(), args, start: nameToken.start, end: close.end }
  }

  // {1,2,3;4,5,6}: commas separate columns, semicolons separate rows.
  function arrayLiteral() {
    const open = next()
    const rows = [[]]
    for (;;) {
      const t = next()
      let value
      if (t.type === 'number') value = Number(t.value)
      else if (t.type === 'op' && t.value === '-' && peek().type === 'number') value = -Number(next().value)
      else if (t.type === 'string') value = t.value.slice(1, -1).replace(/""/g, '"')
      else if (t.type === 'bool') value = t.value.toUpperCase() === 'TRUE'
      else if (t.type === 'error') value = { error: t.value }
      else throw new ParseError('Array constants may only contain numbers, text, TRUE/FALSE or errors', t.start)
      rows.at(-1).push(value)
      const sep = next()
      if (sep.type === 'op' && sep.value === ',') continue
      if (sep.type === 'op' && sep.value === ';') { rows.push([]); continue }
      if (sep.type === 'op' && sep.value === '}') {
        if (rows.some((r) => r.length !== rows[0].length)) throw new ParseError('Every row of an array constant must have the same number of values', open.start)
        return { type: 'array', rows, start: open.start, end: sep.end }
      }
      throw new ParseError('Expected "," ";" or "}" in the array constant', sep.start)
    }
  }

  const tree = expression()
  if (peek().type !== 'eof') {
    const t = peek()
    throw new ParseError('Unexpected "' + t.value + '" after the end of the expression', t.start)
  }
  return tree
}

// Walk every node of a tree (depth first, children before the parent's exit).
export function walk(node, visit) {
  visit(node)
  for (const child of children(node)) walk(child, visit)
}

export function children(node) {
  switch (node.type) {
    case 'binary': return [node.left, node.right]
    case 'unary': case 'percent': case 'group': return [node.arg]
    case 'call': return node.args
    default: return []
  }
}

// Every cell and range a formula reads directly (its precedents).
export function references(tree) {
  const refs = []
  walk(tree, (n) => { if (n.type === 'cell' || n.type === 'range' || n.type === 'spill') refs.push(n) })
  return refs
}
