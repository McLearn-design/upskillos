// Conditional formatting: rules that colour cells by their values, worked out
// again whenever the values change. A rule is
//   { id, source: 'B2:B20', kind, …settings, style }
// kinds:
//   compare   op: '>' '<' '>=' '<=' '=' '<>' 'between' 'contains', value, value2
//   top       count, bottom (true for the lowest), percent (count is a %)
//   average   below (true for below the average)
//   duplicate unique (true to mark values that appear once)
//   scale     colours from the lowest to the highest number
//   bar       a bar in each cell, as long as its share of the largest number
import { CellError } from './values.js'

export const RULE_KINDS = {
  compare: { label: 'Highlight cells that…', learn: 'Colours each cell that passes a test, such as "greater than 50". The test is checked again whenever the value changes.' },
  top: { label: 'Top or bottom values', learn: 'Colours the highest (or lowest) values in the range, such as the top 3 scores.' },
  average: { label: 'Above or below average', learn: 'Works out the average (mean) of the range and colours the values above it (or below).' },
  duplicate: { label: 'Duplicate or unique values', learn: 'Colours values that appear more than once, which is a quick way to find repeated entries.' },
  scale: { label: 'Colour scale', learn: 'Shades every number from light (lowest) to dark (highest), so patterns stand out like a heat map.' },
  bar: { label: 'Data bars', learn: 'Draws a bar inside each cell, as long as the value\'s share of the largest one: a chart inside the table.' },
}

// Fill and text colours for highlights, readable in light and dark mode.
export const HIGHLIGHTS = {
  red: { label: 'Light red fill', fill: '#fee2e2', color: '#991b1b' },
  yellow: { label: 'Yellow fill', fill: '#fef3c7', color: '#854d0e' },
  green: { label: 'Green fill', fill: '#dcfce7', color: '#166534' },
  blue: { label: 'Blue fill', fill: '#dbeafe', color: '#1e40af' },
  bold: { label: 'Bold red text', color: '#dc2626', bold: true },
}

// A one-hue scale, light to dark (from the chart palette's blue ramp).
const SCALE = ['#cde2fb', '#9ec5f4', '#6da7ec', '#3987e5', '#256abf', '#184f95']

const isNum = (v) => typeof v === 'number' && Number.isFinite(v)
const key = (v) => (typeof v === 'string' ? 's:' + v.toLowerCase() : typeof v + ':' + String(v))

// What a rule needs to know about its whole range before it can judge one
// cell: the smallest and largest numbers, the average, the cut-off for the
// top N, which values repeat. values: every value in the range.
export function ruleStats(rule, values) {
  const nums = values.filter(isNum)
  const stats = { min: nums.length ? Math.min(...nums) : 0, max: nums.length ? Math.max(...nums) : 0 }
  if (rule.kind === 'average') stats.mean = nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0
  if (rule.kind === 'top') {
    const sorted = [...nums].sort((a, b) => (rule.bottom ? a - b : b - a))
    const n = rule.percent ? Math.max(1, Math.floor((sorted.length * (rule.count ?? 10)) / 100)) : (rule.count ?? 10)
    stats.cutoff = sorted.length ? sorted[Math.min(n, sorted.length) - 1] : null
  }
  if (rule.kind === 'duplicate') {
    const counts = new Map()
    for (const v of values) if (v !== null && v !== '' && !(v instanceof CellError)) counts.set(key(v), (counts.get(key(v)) ?? 0) + 1)
    stats.counts = counts
  }
  return stats
}

function compare(op, v, a, b) {
  if (op === 'contains') return v !== null && String(v).toLowerCase().includes(String(a ?? '').toLowerCase())
  const n = typeof a === 'number' && typeof v === 'number'
  if (op === '=') return n ? v === a : String(v ?? '').toLowerCase() === String(a ?? '').toLowerCase()
  if (op === '<>') return n ? v !== a : String(v ?? '').toLowerCase() !== String(a ?? '').toLowerCase()
  if (!isNum(v) || !isNum(a)) return false
  switch (op) {
    case '>': return v > a
    case '<': return v < a
    case '>=': return v >= a
    case '<=': return v <= a
    case 'between': return isNum(b) && v >= Math.min(a, b) && v <= Math.max(a, b)
    default: return false
  }
}

// The effect of one rule on one value: { fill, color, bold } for a highlight,
// { fill } for a colour scale, { bar: 0..1 } for a data bar, or null.
export function ruleEffect(rule, value, stats) {
  const style = HIGHLIGHTS[rule.style] ?? HIGHLIGHTS.red
  switch (rule.kind) {
    case 'compare': return compare(rule.op, value, rule.value, rule.value2) ? style : null
    case 'top': return isNum(value) && stats.cutoff !== null && (rule.bottom ? value <= stats.cutoff : value >= stats.cutoff) ? style : null
    case 'average': return isNum(value) && (rule.below ? value < stats.mean : value > stats.mean) ? style : null
    case 'duplicate': {
      if (value === null || value === '' || value instanceof CellError) return null
      const n = stats.counts.get(key(value)) ?? 0
      return (rule.unique ? n === 1 : n > 1) ? style : null
    }
    case 'scale': {
      if (!isNum(value)) return null
      const t = stats.max === stats.min ? 0.5 : (value - stats.min) / (stats.max - stats.min)
      const fill = SCALE[Math.min(SCALE.length - 1, Math.floor(t * SCALE.length))]
      return { fill, color: t >= 0.5 ? '#ffffff' : '#0f172a' }
    }
    case 'bar': {
      if (!isNum(value)) return null
      // Bars grow from zero; with negatives, from the smallest value.
      const lo = Math.min(0, stats.min), hi = Math.max(0, stats.max)
      return { bar: hi === lo ? 0 : (value - lo) / (hi - lo) }
    }
    default: return null
  }
}

// A sentence describing the rule, for the list of rules.
export function describeRule(rule) {
  const ops = { '>': 'greater than', '<': 'less than', '>=': 'at least', '<=': 'at most', '=': 'equal to', '<>': 'not equal to', contains: 'containing' }
  switch (rule.kind) {
    case 'compare': return rule.op === 'between' ? 'Values between ' + rule.value + ' and ' + rule.value2 : 'Values ' + ops[rule.op] + ' ' + (typeof rule.value === 'string' ? '"' + rule.value + '"' : rule.value)
    case 'top': return (rule.bottom ? 'Bottom ' : 'Top ') + (rule.count ?? 10) + (rule.percent ? '%' : '') + ' values'
    case 'average': return (rule.below ? 'Below' : 'Above') + ' the average'
    case 'duplicate': return rule.unique ? 'Values that appear once' : 'Values that appear more than once'
    case 'scale': return 'Colour scale, light (lowest) to dark (highest)'
    case 'bar': return 'Data bars'
    default: return rule.kind
  }
}
