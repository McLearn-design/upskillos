// What a learner types into a cell → what the cell holds.
//
// Like Excel, the sheet guesses the type of plain input:
//   =A1+1        a formula (anything starting with =)
//   42  -3.5     a number
//   12%          the number 0.12, shown as a percentage
//   TRUE         a logical
//   2025-03-14   a date (stored as its serial number, shown as a date)
//   '42          text, even though it looks like a number (the ' is not stored)
//   anything else is text
import { parse, ParseError } from './parser.js'
import { textToNumber, err } from './values.js'
import { parseDateText } from './functions/helpers.js'

export function parseInput(text) {
  if (text === null || text === undefined || text === '') return { kind: 'blank', value: null }
  const s = String(text)
  if (s.startsWith('=') && s.length > 1) {
    try {
      return { kind: 'formula', tree: parse(s.slice(1)), value: null }
    } catch (e) {
      if (!(e instanceof ParseError)) throw e
      // The text stays in the cell so it can be fixed; the cell shows the problem.
      return { kind: 'formula', tree: null, parseError: e, value: err('#NAME?', 'The formula could not be read: ' + e.message + ' (at character ' + (e.pos + 2) + ').') }
    }
  }
  if (s.startsWith("'")) return { kind: 'text', value: s.slice(1) }
  const trimmed = s.trim()
  if (/^(TRUE|FALSE)$/i.test(trimmed)) return { kind: 'value', value: trimmed.toUpperCase() === 'TRUE' }
  const n = textToNumber(trimmed.replace(/,(?=\d{3}\b)/g, ''))
  if (n !== null) return { kind: 'value', value: n, format: trimmed.endsWith('%') ? (Number.isInteger(n * 100) ? '0%' : '0.0%') : undefined }
  const d = /\d/.test(trimmed) ? parseDateText(trimmed) : null
  if (d !== null) return { kind: 'value', value: d, format: d >= 1 ? (d % 1 ? 'yyyy-mm-dd hh:mm' : 'yyyy-mm-dd') : 'hh:mm' }
  return { kind: 'text', value: s }
}
