// Number format codes, as used by TEXT() and by cell formatting.
//
// A format code has up to four sections separated by semicolons:
//   positive ; negative ; zero ; text        e.g. "#,##0.00;[Red]-#,##0.00;-"
// Inside a section:
//   0    a digit, shown even when it is zero      "0.00" → 3.10
//   #    a digit, hidden when it is a leading or trailing zero
//   ,    thousands separator (between digits); a trailing comma divides by 1000
//   .    decimal point
//   %    multiply by 100 and show %
//   E+00 scientific notation
//   "…"  literal text;  \x  a literal character
//   y m d h s AM/PM   date and time parts (m means minutes after h or before s)
//   [Red] etc         colours (recognised, applied by the grid)
import { formatGeneral } from './values.js'
import { serialParts } from './functions/helpers.js'

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

// Ready-made formats offered in the toolbar, with a plain description for learners.
export const PRESET_FORMATS = [
  { code: 'General', label: 'General', learn: 'Shows the number as simply as possible.' },
  { code: '0', label: 'Whole number', learn: 'Rounds to a whole number for display. The stored value keeps its decimals.' },
  { code: '0.00', label: 'Two decimals', learn: 'Always shows exactly two decimal places.' },
  { code: '#,##0', label: 'Thousands', learn: 'Groups digits in thousands: 1,234,567.' },
  { code: '#,##0.00', label: 'Thousands, 2 dp', learn: 'Groups thousands and shows two decimals.' },
  { code: '0%', label: 'Percent', learn: 'Multiplies by 100 and adds %: 0.25 shows as 25%.' },
  { code: '0.0%', label: 'Percent, 1 dp', learn: 'Percent with one decimal place.' },
  { code: '$#,##0.00', label: 'Currency', learn: 'Money: a symbol, thousands separators and two decimals.' },
  { code: '0.00E+00', label: 'Scientific', learn: 'Scientific notation: 12345 shows as 1.23E+04.' },
  { code: 'yyyy-mm-dd', label: 'Date (ISO)', learn: 'The number is a date serial (days since 1900), shown as year-month-day.' },
  { code: 'd mmm yyyy', label: 'Date (long)', learn: 'Shows a date serial as 14 Mar 2025.' },
  { code: 'hh:mm', label: 'Time', learn: 'Shows the fraction of a day as hours and minutes.' },
  { code: '@', label: 'Text', learn: 'Treats the cell as text.' },
]

function splitSections(code) {
  const out = []
  let cur = '', inQuote = false
  for (let i = 0; i < code.length; i++) {
    const ch = code[i]
    if (ch === '"') inQuote = !inQuote
    if (ch === '\\' && !inQuote) { cur += ch + (code[++i] ?? ''); continue }
    if (ch === ';' && !inQuote) { out.push(cur); cur = ''; continue }
    cur += ch
  }
  out.push(cur)
  return out
}

const isDateCode = (s) => /[ydhs]|(?<![0#.,])m(?![0#])|AM\/PM/i.test(stripLiterals(s))
const stripLiterals = (s) => s.replace(/"[^"]*"/g, '').replace(/\\./g, '').replace(/\[[^\]]*\]/g, '')

// Returns { text, color } for a value and a format code.
export function formatValue(value, code = 'General') {
  if (typeof value !== 'number') {
    if (typeof value === 'string') {
      const sections = splitSections(code)
      if (sections.length >= 4) return { text: sections[3].replace(/"([^"]*)"/g, '$1').replace('@', value), color: null }
      return { text: value, color: null }
    }
    return { text: value === null || value === undefined ? '' : String(value), color: null }
  }
  if (!code || code === 'General') return { text: formatGeneral(value), color: null }
  if (code === '@') return { text: formatGeneral(value), color: null }
  const sections = splitSections(code)
  let section = sections[0]
  let v = value
  if (value < 0 && sections.length >= 2 && sections[1] !== '') { section = sections[1]; v = -value }
  else if (value === 0 && sections.length >= 3) section = sections[2]
  const colorMatch = /\[(Red|Blue|Green|Black|White|Yellow|Magenta|Cyan)\]/i.exec(section)
  const color = colorMatch ? colorMatch[1].toLowerCase() : null
  section = section.replace(/\[[^\]]*\]/g, '')
  const text = isDateCode(section) ? formatDate(v, section) : formatNumber(v, section)
  return { text, color }
}

export const formatText = (value, code) => formatValue(value, code).text

// Whether a format shows numbers as dates or times.
export const isDateFormat = (code) => !!code && code !== 'General' && isDateCode(splitSections(code)[0].replace(/\[[^\]]*\]/g, ''))

function formatNumber(value, section) {
  // Split into literal text and the numeric pattern.
  const tokens = []
  for (let i = 0; i < section.length; i++) {
    const ch = section[i]
    if (ch === '"') { const j = section.indexOf('"', i + 1); tokens.push({ lit: section.slice(i + 1, j < 0 ? undefined : j) }); i = j < 0 ? section.length : j; continue }
    if (ch === '\\') { tokens.push({ lit: section[++i] ?? '' }); continue }
    if ('0#?.,%Ee+-'.includes(ch) && /[0#?.,%]|E[+-]/i.test(ch === 'E' || ch === 'e' ? section.slice(i, i + 2) : ch)) {
      if ((ch === 'E' || ch === 'e') && /[+-]/.test(section[i + 1])) { tokens.push({ pat: section.slice(i, i + 2) }); i++; continue }
      tokens.push({ pat: ch }); continue
    }
    if (ch === '_' ) { i++; tokens.push({ lit: ' ' }); continue }
    if (ch === '*') { i++; continue }
    tokens.push({ lit: ch })
  }
  const pattern = tokens.filter((t) => t.pat).map((t) => t.pat).join('')
  const percent = (pattern.match(/%/g) || []).length
  let v = value * 100 ** percent
  const sci = /E[+-]/i.exec(pattern)
  let numberText
  if (sci) {
    const [mant] = pattern.split(/E[+-]/i)
    const decimals = (mant.split('.')[1] || '').replace(/[^0#?]/g, '').length
    const expDigits = pattern.slice(sci.index + 2).replace(/[^0]/g, '').length || 2
    let exp = v === 0 ? 0 : Math.floor(Math.log10(Math.abs(v)))
    let m = v / 10 ** exp
    if (+Math.abs(m).toFixed(decimals) >= 10) { exp += 1; m = v / 10 ** exp }
    numberText = m.toFixed(decimals) + 'E' + (exp < 0 ? '-' : '+') + String(Math.abs(exp)).padStart(expDigits, '0')
  } else {
    const body = pattern.replace(/%/g, '')
    // Trailing commas scale by 1000 each: "#,##0," shows thousands.
    const scale = /,+$/.exec(body.replace(/\.$/, ''))
    if (scale) v /= 1000 ** scale[0].length
    const core = scale ? body.slice(0, body.length - scale[0].length) : body
    const [intPat, decPat = ''] = core.split('.')
    const grouping = intPat.includes(',')
    const minInt = (intPat.match(/0/g) || []).length
    const decRequired = (decPat.match(/0/g) || []).length
    const decMax = (decPat.match(/[0#?]/g) || []).length
    let s = Math.abs(v).toFixed(decMax)
    let [ip, dp = ''] = s.split('.')
    while (dp.length > decRequired && dp.endsWith('0')) dp = dp.slice(0, -1)
    if (ip === '0' && minInt === 0) ip = ''
    ip = ip.padStart(minInt, '0')
    if (grouping) ip = ip.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
    numberText = (v < 0 && +s !== 0 ? '-' : '') + ip + (core.includes('.') ? '.' + dp : '')
  }
  // Re-insert literals around the number: everything before the first pattern
  // character goes in front, everything after goes behind.
  const firstPat = tokens.findIndex((t) => t.pat && t.pat !== '%')
  let before = '', after = ''
  tokens.forEach((t, i) => {
    if (t.lit !== undefined) { if (firstPat < 0 || i < firstPat) before += t.lit; else after += t.lit }
    else if (t.pat === '%') after += '%'
  })
  return before + numberText + after
}

function formatDate(serial, section) {
  const p = serialParts(serial)
  const ampm = /AM\/PM/i.test(section)
  let out = ''
  const s = section
  let lastWasHour = false
  for (let i = 0; i < s.length;) {
    const rest = s.slice(i)
    if (rest[0] === '"') { const j = s.indexOf('"', i + 1); out += s.slice(i + 1, j); i = j + 1; continue }
    if (rest[0] === '\\') { out += s[i + 1] ?? ''; i += 2; continue }
    if (/^AM\/PM/i.test(rest)) { out += p.h < 12 ? 'AM' : 'PM'; i += 5; continue }
    const run = /^(y+|m+|d+|h+|s+)/i.exec(rest)
    if (run) {
      const t = run[0].toLowerCase(), n = t.length
      const nextIsSeconds = /^[^a-z]*s/i.test(s.slice(i + n))
      if (t[0] === 'y') out += n <= 2 ? String(p.y).slice(-2) : String(p.y)
      else if (t[0] === 'm' && (lastWasHour || nextIsSeconds)) out += n >= 2 ? String(p.mi).padStart(2, '0') : String(p.mi)
      else if (t[0] === 'm') out += n >= 4 ? MONTH_NAMES[p.m - 1] : n === 3 ? MONTH_NAMES[p.m - 1].slice(0, 3) : n === 2 ? String(p.m).padStart(2, '0') : String(p.m)
      else if (t[0] === 'd') out += n >= 4 ? DAY_NAMES[p.wd] : n === 3 ? DAY_NAMES[p.wd].slice(0, 3) : n === 2 ? String(p.d).padStart(2, '0') : String(p.d)
      else if (t[0] === 'h') { const h = ampm ? ((p.h + 11) % 12) + 1 : p.h; out += n >= 2 ? String(h).padStart(2, '0') : String(h) }
      else if (t[0] === 's') out += n >= 2 ? String(p.s).padStart(2, '0') : String(p.s)
      lastWasHour = t[0] === 'h'
      i += n
      continue
    }
    out += rest[0]
    i += 1
  }
  return out
}

// The toolbar's "more/fewer decimals" buttons: change how many decimal places
// a format code shows. General has no fixed decimals, so it starts from the
// decimals the value currently shows.
export function adjustDecimals(code, delta, value) {
  let c = code || 'General'
  if (c === 'General') {
    const shown = typeof value === 'number' ? formatGeneral(value) : '0'
    const d = /\.(\d+)/.exec(shown)?.[1].length ?? 0
    c = d ? '0.' + '0'.repeat(d) : '0'
  }
  return splitSections(c).map((section) => {
    if (/[ymdhs]/i.test(section.replace(/"[^"]*"/g, '').replace(/\[[^\]]*\]/g, ''))) return section // dates and times ([Red] is a colour, not a date)
    const m = /\.(0*)/.exec(section)
    if (m) {
      const n = Math.max(0, m[1].length + delta)
      return section.replace(/\.0*/, n ? '.' + '0'.repeat(n) : '')
    }
    if (delta <= 0) return section
    // No decimal point yet: add one after the last digit placeholder.
    const i = Math.max(section.lastIndexOf('0'), section.lastIndexOf('#'))
    return i < 0 ? section : section.slice(0, i + 1) + '.' + '0'.repeat(delta) + section.slice(i + 1)
  }).join(';')
}
