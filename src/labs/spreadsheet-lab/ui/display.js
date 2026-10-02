// How a value appears in a grid cell: its text, alignment and colour.
import { formatValue } from '../engine/format.js'
import { CellError } from '../engine/values.js'

// Excel's default alignment: numbers right, text left, logicals and errors centred.
export function displayCell(value, format) {
  if (value === null || value === undefined) return { text: '', align: 'left', kind: 'blank' }
  if (value instanceof CellError) return { text: value.code, align: 'center', kind: 'error' }
  if (typeof value === 'boolean') return { text: value ? 'TRUE' : 'FALSE', align: 'center', kind: 'logical' }
  if (typeof value === 'number') {
    const { text, color } = formatValue(value, format || 'General')
    return { text, align: 'right', kind: 'number', color }
  }
  const { text, color } = formatValue(String(value), format || 'General')
  return { text, align: 'left', kind: 'text', color }
}

export const FORMAT_COLORS = { red: '#dc2626', blue: '#2563eb', green: '#16a34a', black: '#000', white: '#fff', yellow: '#ca8a04', magenta: '#c026d3', cyan: '#0891b2' }

// Text on a coloured fill: dark on light fills, light on dark ones, so a fill
// chosen in light mode stays readable in dark mode (and the other way round).
export function textOn(fill) {
  const m = /^#?([0-9a-f]{6})$/i.exec(fill ?? '')
  if (!m) return undefined
  const n = parseInt(m[1], 16)
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => { const x = v / 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4 })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.4 ? '#0f172a' : '#f8fafc'
}
