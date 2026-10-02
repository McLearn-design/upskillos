// "How it's worked out": a formula evaluated one piece at a time, the way
// Excel's Evaluate Formula dialog shows it:
//   =SUM(A1:A3)*2  →  =SUM({1,2,3})*2  →  =6*2  →  12
// Each step replaces the piece just calculated with its value and keeps the
// rest of the formula exactly as it was typed.
import { evaluate } from './evaluate.js'
import { children } from './parser.js'
import { literal, isError } from './values.js'
import { FUNCTIONS } from './functions/index.js'

const LEAF_LITERALS = new Set(['number', 'string', 'bool', 'error', 'array', 'missing'])

// The formula with some nodes replaced by their values, as segments of text;
// the node calculated in this step is marked so it can be highlighted.
function render(node, source, replaced, current) {
  if (replaced.has(node)) return [{ text: literal(replaced.get(node), 4), highlight: node === current }]
  const kids = children(node).filter((k) => k && typeof k.start === 'number').sort((a, b) => a.start - b.start)
  if (!kids.length) return [{ text: source.slice(node.start, node.end) }]
  const out = []
  let pos = node.start
  for (const k of kids) {
    if (k.start > pos) out.push({ text: source.slice(pos, k.start) })
    out.push(...render(k, source, replaced, current))
    pos = Math.max(pos, k.end)
  }
  if (node.end > pos) out.push({ text: source.slice(pos, node.end) })
  return out
}

const COMPARE = new Set(['=', '<>', '<', '>', '<=', '>='])
const OP_TEXT = { '*': '×', '/': '÷', '<>': '≠', '<=': '≤', '>=': '≥' }

function describe(node, value, source, valueOf) {
  const shown = literal(value, 4)
  const text = source.slice(node.start, node.end)
  switch (node.type) {
    case 'cell': return text + ' holds ' + shown + '.'
    case 'range': return 'The range ' + text + ' holds ' + shown + '.'
    case 'spill': return text + ' is the block the formula in ' + text.slice(0, -1) + ' spilled: ' + shown + '.'
    case 'name': return node.name + ' is ' + shown + '.'
    case 'call': {
      const f = FUNCTIONS[node.name]
      return node.name + ' gives ' + shown + '.' + (f ? ' (' + f.summary + ')' : '')
    }
    case 'binary': {
      // With the values in: "14 + 2.5 = 16.5", "9 > 5 is TRUE".
      if (!valueOf.has(node.left) || !valueOf.has(node.right)) return 'Calculating ' + text.replace(/\s+/g, ' ') + ' gives ' + shown + '.'
      const sum = literal(valueOf.get(node.left), 4) + ' ' + (OP_TEXT[node.op] ?? node.op) + ' ' + literal(valueOf.get(node.right), 4)
      if (COMPARE.has(node.op)) return sum + ' is ' + shown + '.'
      if (node.op === '&') return 'Joining the text: ' + sum + ' gives ' + shown + '.'
      return sum + ' = ' + shown + '.'
    }
    case 'unary': return 'Negating gives ' + shown + '.'
    case 'percent': return text + ' means ' + text.slice(0, -1).trim() + ' ÷ 100 = ' + shown + '.'
    default: return 'That part gives ' + shown + '.'
  }
}

// formulaText is what follows the "=", tree its parse, ctx an evaluation
// context for the cell. Returns { steps: [{ segments, note }], value }.
export function explainFormula(formulaText, tree, ctx, { maxSteps = 60 } = {}) {
  const order = []
  const seen = new Set()
  const parent = new Map()
  const link = (n) => { for (const k of children(n)) if (k) { parent.set(k, n); link(k) } }
  link(tree)
  const value = evaluate(tree, {
    ...ctx,
    // Only the first evaluation of each piece: inside MAP or LAMBDA the same
    // piece runs once per element, which would repeat steps.
    trace: (node, v) => { if (!seen.has(node)) { seen.add(node); order.push([node, v]) } },
  })

  const valueOf = new Map(order)
  const replaced = new Map()
  const steps = [{ segments: render(tree, formulaText, replaced, null), note: 'The formula as you typed it.' }]
  for (const [node, v] of order) {
    if (LEAF_LITERALS.has(node.type) || node.type === 'group') continue
    if (node === tree) continue // the final value is the last step
    // A calculated piece in brackets replaces the brackets too: (2+3)*4 → 5*4.
    let target = node
    while (parent.get(target)?.type === 'group') target = parent.get(target)
    replaced.set(target, v)
    steps.push({ segments: render(tree, formulaText, replaced, target), note: describe(node, v, formulaText, valueOf) })
    if (steps.length >= maxSteps) { steps.push({ segments: [{ text: '…' }], note: 'More steps follow; the formula is long.' }); break }
  }
  const final = value
  steps.push({
    segments: [{ text: literal(final, 6), highlight: true }],
    note: isError(final)
      ? 'The result is the error ' + final.code + '.' + (final.detail ? ' ' + final.detail : '')
      : LEAF_LITERALS.has(tree.type) || tree.type === 'group' ? 'The result.' : describe(tree, final, formulaText, valueOf) + ' That is the result.',
  })
  return { steps, value: final }
}
