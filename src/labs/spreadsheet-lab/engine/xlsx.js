// Reading and writing Excel workbooks (.xlsx). An .xlsx file is a zip of XML
// files: one per sheet, plus the shared text, the styles and a list of the
// sheets. This reads and writes the parts a learner's workbook uses:
// values, formulas, number formats, bold/italic/underline, text and fill
// colours, alignment, column widths, row heights and filters.
//
// Charts, colour rules and code cells are UpSkillOS features with no simple
// Excel equivalent; the notes returned say what was left out.
import { unzipSync, zipSync, strFromU8, strToU8 } from 'fflate'
import { cellKey, keyToPos, formatRange, parseRange, indexToCol } from './address.js'
import { parseInput } from './input.js'
import { shiftFormula } from './rewrite.js'
import { isError, isMatrix } from './values.js'
import { BLANKS, columnValues, filterKey } from './data.js'
import { isDateFormat } from './format.js'
import { parseDateText, serialParts } from './functions/helpers.js'
import { Workbook } from './workbook.js'

// ── A small XML reader ─────────────────────────────────────────────────
// Elements become { name, attrs, children, text }; namespace prefixes are
// dropped ("x:c" → "c"), since files from different programs use different ones.
const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }
const decode = (s) => s.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (m, e) => (e[0] === '#' ? String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : Number(e.slice(1))) : ENTITIES[e] ?? m))
const local = (name) => name.slice(name.indexOf(':') + 1)

export function parseXml(text) {
  const root = { name: '#root', attrs: {}, children: [], text: '' }
  const stack = [root]
  const re = /<!\[CDATA\[([\s\S]*?)\]\]>|<!--[\s\S]*?-->|<\?[\s\S]*?\?>|<!DOCTYPE[^>]*>|<\/([^\s>]+)\s*>|<([^\s/>]+)((?:\s+[^\s=]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*(\/?)>|([^<]+)/g
  let m
  while ((m = re.exec(text))) {
    const top = stack[stack.length - 1]
    if (m[1] !== undefined) top.text += m[1]
    else if (m[2]) { if (stack.length > 1) stack.pop() }
    else if (m[3]) {
      const attrs = {}
      for (const a of m[4].matchAll(/([^\s=]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) attrs[local(a[1])] = decode(a[2] ?? a[3])
      const el = { name: local(m[3]), attrs, children: [], text: '' }
      top.children.push(el)
      if (!m[5]) stack.push(el)
    } else if (m[6] !== undefined) top.text += decode(m[6])
  }
  return root
}
const kids = (el, name) => (el?.children ?? []).filter((c) => c.name === name)
const kid = (el, name) => el?.children.find((c) => c.name === name)
const textOf = (el) => (el ? el.text + el.children.map(textOf).join('') : '')
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

// ── Number formats ─────────────────────────────────────────────────────
// Excel's built-in formats are stored by number, not written out.
const BUILTIN_FORMATS = {
  1: '0', 2: '0.00', 3: '#,##0', 4: '#,##0.00', 9: '0%', 10: '0.00%', 11: '0.00E+00', 12: '# ?/?', 13: '# ??/??',
  14: 'yyyy-mm-dd', 15: 'd-mmm-yy', 16: 'd-mmm', 17: 'mmm-yy', 18: 'h:mm AM/PM', 19: 'h:mm:ss AM/PM', 20: 'h:mm', 21: 'h:mm:ss', 22: 'yyyy-mm-dd h:mm',
  37: '#,##0 ;(#,##0)', 38: '#,##0 ;[Red](#,##0)', 39: '#,##0.00;(#,##0.00)', 40: '#,##0.00;[Red](#,##0.00)', 45: 'mm:ss', 46: '[h]:mm:ss', 47: 'mm:ss.0', 48: '##0.0E+0', 49: '@',
}
const BUILTIN_IDS = Object.fromEntries(Object.entries(BUILTIN_FORMATS).filter(([id]) => id !== '14' && id !== '22').map(([id, code]) => [code, Number(id)]))

// Functions added to Excel after 2007 are stored with a "_xlfn." prefix, so
// older versions know they do not have them.
const NEWER_FUNCTIONS = new Set(('CONCAT TEXTJOIN IFS SWITCH MAXIFS MINIFS XLOOKUP XMATCH FILTER SORT SORTBY UNIQUE SEQUENCE RANDARRAY LET LAMBDA MAP REDUCE SCAN BYROW BYCOL MAKEARRAY ISOMITTED ' +
  'TEXTBEFORE TEXTAFTER TEXTSPLIT VSTACK HSTACK TAKE DROP CHOOSEROWS CHOOSECOLS TOCOL TOROW WRAPROWS WRAPCOLS EXPAND STDEV.S STDEV.P VAR.S VAR.P MODE.SNGL MODE.MULT ' +
  'NORM.DIST NORM.INV NORM.S.DIST NORM.S.INV PERCENTILE.INC PERCENTILE.EXC QUARTILE.INC QUARTILE.EXC RANK.EQ RANK.AVG T.DIST T.DIST.2T T.DIST.RT T.INV T.INV.2T T.TEST ' +
  'CHISQ.DIST CHISQ.DIST.RT CHISQ.INV CHISQ.INV.RT CHISQ.TEST F.DIST F.DIST.RT F.INV F.INV.RT F.TEST BINOM.DIST BINOM.INV POISSON.DIST EXPON.DIST GAMMA.DIST GAMMA.INV LOGNORM.DIST LOGNORM.INV WEIBULL.DIST ' +
  'CONFIDENCE.NORM CONFIDENCE.T COVARIANCE.P COVARIANCE.S CEILING.MATH FLOOR.MATH IFNA XOR DAYS ISOWEEKNUM NUMBERVALUE UNICHAR UNICODE SHEET SHEETS FORMULATEXT ARABIC BASE DECIMAL ' +
  'COT COTH CSC CSCH SEC SECH ACOT ACOTH NETWORKDAYS.INTL WORKDAY.INTL AGGREGATE GAMMA GAUSS PHI SKEW.P PERMUTATIONA COMBINA RRI PDURATION').split(' '))

function prefixNewer(formula) {
  // Function names outside text literals: NAME( → _xlfn.NAME(
  return formula.replace(/("(?:[^"]|"")*")|(?<![\w.])([A-Z][A-Z0-9.]*)(?=\()/g, (m, str, name) => (str ? str : NEWER_FUNCTIONS.has(name) ? '_xlfn.' + name : name))
}
const unprefix = (formula) => formula.replace(/_xl(?:fn|ws|pm)\./g, '')

// Text that would be read back as a number, a date or a formula keeps a
// leading apostrophe, as when typed.
const asTextInput = (s) => (parseInput(s).kind === 'text' && !s.startsWith("'") ? s : "'" + s)

// A date is entered as text such as 2025-03-14 (as if typed), so editing the
// cell shows a date; a number that would not come back exactly stays a number.
function dateInput(n) {
  if (!Number.isFinite(n) || n < 0 || (n >= 1 && n < 61)) return String(n) // early 1900 has Excel's phantom 29 Feb
  try {
    const p = serialParts(n)
    const two = (x) => String(x).padStart(2, '0')
    const day = p.y + '-' + two(p.m) + '-' + two(p.d)
    const time = two(p.h) + ':' + two(p.mi) + (p.s ? ':' + two(p.s) : '')
    const text = n < 1 ? time : Number.isInteger(n) ? day : day + ' ' + time
    return Math.abs(parseDateText(text) - n) < 1e-9 ? text : String(n)
  } catch { return String(n) }
}

// ── Reading ────────────────────────────────────────────────────────────
// Returns { sheets: [{ name, cells, colWidths, rowHeights, filter, filterShown }], notes }
// in the shape Workbook.fromJSON takes (plus the filter's shown values).
export function readXlsx(bytes) {
  let files
  try { files = unzipSync(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)) } catch { throw new Error('This file is not an Excel workbook (.xlsx): it could not be opened as one. Older .xls files need saving as .xlsx first.') }
  const read = (path) => (files[path] ? parseXml(strFromU8(files[path])) : null)
  const book = read('xl/workbook.xml')
  if (!book) throw new Error('This file has no workbook inside, so it is not an .xlsx file.')
  const notes = []

  const rels = {}
  for (const r of kids(kid(read('xl/_rels/workbook.xml.rels'), 'Relationships'), 'Relationship')) rels[r.attrs.Id] = r.attrs.Target
  const shared = kids(kid(read('xl/sharedStrings.xml'), 'sst'), 'si').map((si) => (kid(si, 't') ? textOf(kid(si, 't')) : kids(si, 'r').map((r) => textOf(kid(r, 't'))).join('')))

  // Styles: each cell's "s" picks an entry of cellXfs, which points at a
  // number format, a font and a fill.
  const styles = kid(read('xl/styles.xml'), 'styleSheet')
  const numFmts = { ...BUILTIN_FORMATS }
  for (const f of kids(kid(styles, 'numFmts'), 'numFmt')) numFmts[f.attrs.numFmtId] = f.attrs.formatCode
  const color = (el) => (el?.attrs.rgb && /^[0-9A-F]{8}$/i.test(el.attrs.rgb) ? '#' + el.attrs.rgb.slice(2).toLowerCase() : undefined)
  const fonts = kids(kid(styles, 'fonts'), 'font').map((f) => ({
    bold: kid(f, 'b') && kid(f, 'b').attrs.val !== '0' ? true : undefined,
    italic: kid(f, 'i') && kid(f, 'i').attrs.val !== '0' ? true : undefined,
    underline: kid(f, 'u') && kid(f, 'u').attrs.val !== 'none' ? true : undefined,
    color: color(kid(f, 'color')),
  }))
  const fills = kids(kid(styles, 'fills'), 'fill').map((f) => {
    const p = kid(f, 'patternFill')
    return p?.attrs.patternType === 'solid' ? color(kid(p, 'fgColor')) : undefined
  })
  const xfs = kids(kid(styles, 'cellXfs'), 'xf').map((xf) => {
    const code = numFmts[xf.attrs.numFmtId ?? 0]
    const font = fonts[Number(xf.attrs.fontId ?? 0)] ?? {}
    const fill = fills[Number(xf.attrs.fillId ?? 0)]
    const align = kid(xf, 'alignment')?.attrs.horizontal
    const style = Object.fromEntries(Object.entries({ ...font, color: font.color && font.color !== '#000000' ? font.color : undefined, fill, align: ['left', 'center', 'right'].includes(align) ? align : undefined }).filter(([, v]) => v !== undefined))
    return { format: code && code !== 'General' ? code : undefined, style: Object.keys(style).length ? style : undefined }
  })

  const sheets = []
  for (const s of kids(kid(kid(book, 'workbook'), 'sheets'), 'sheet')) {
    const target = rels[s.attrs.id]
    if (!target) continue
    const path = target.startsWith('/') ? target.slice(1) : 'xl/' + target.replace(/^\.\//, '')
    const ws = kid(read(path), 'worksheet')
    if (!ws) continue // a chart sheet or dialog sheet
    const cells = {}
    const sharedFormulas = {}
    const spilledBy = [] // ranges a dynamic array formula fills: their cached values are not cells
    const rowHeights = {}
    for (const row of kids(kid(ws, 'sheetData'), 'row')) {
      const r = Number(row.attrs.r) - 1
      if (row.attrs.customHeight === '1' && row.attrs.ht) rowHeights[r] = Math.round(Number(row.attrs.ht) * 4 / 3)
      for (const c of kids(row, 'c')) {
        const p = keyToPos(c.attrs.r)
        if (!p) continue
        const key = cellKey(p.row, p.col)
        const xf = xfs[Number(c.attrs.s ?? 0)] ?? {}
        const f = kid(c, 'f')
        const v = kid(c, 'v')
        let input = ''
        if (f) {
          let text = textOf(f)
          if (f.attrs.t === 'shared') {
            const si = f.attrs.si
            if (text) sharedFormulas[si] = { text, row: p.row, col: p.col }
            else if (sharedFormulas[si]) {
              const m = sharedFormulas[si]
              text = shiftFormula('=' + m.text, p.row - m.row, p.col - m.col).slice(1)
            }
          }
          if (f.attrs.t === 'array' && f.attrs.ref && f.attrs.ref.includes(':')) {
            const rg = parseRange(f.attrs.ref)
            if (rg) spilledBy.push({ ...rg, anchor: key })
          }
          if (text) input = '=' + unprefix(text)
        } else if (c.attrs.t === 'inlineStr') input = asTextInput(textOf(kid(c, 'is')))
        else if (v) {
          const raw = textOf(v)
          if (c.attrs.t === 's') input = asTextInput(shared[Number(raw)] ?? '')
          else if (c.attrs.t === 'str') input = asTextInput(raw)
          else if (c.attrs.t === 'b') input = raw === '1' ? 'TRUE' : 'FALSE'
          else if (c.attrs.t === 'e') input = '=' + raw
          else input = xf.format && isDateFormat(xf.format) ? dateInput(Number(raw)) : String(Number(raw))
        }
        if (!input && !xf.format && !xf.style) continue
        cells[key] = Object.fromEntries(Object.entries({ input: input || undefined, format: xf.format, style: xf.style }).filter(([, x]) => x !== undefined))
      }
    }
    // Values Excel saved for the cells a formula spilled into are recomputed here.
    for (const rg of spilledBy) {
      for (let r = rg.r1; r <= rg.r2; r++) for (let c = rg.c1; c <= rg.c2; c++) {
        const key = cellKey(r, c)
        if (key !== rg.anchor && cells[key] && !cells[key].input?.startsWith('=')) delete cells[key].input
      }
    }

    const colWidths = {}
    for (const col of kids(kid(ws, 'cols'), 'col')) {
      if (!col.attrs.width || col.attrs.customWidth === '0') continue
      const px = Math.round(Number(col.attrs.width) * 7 + 5)
      for (let i = Number(col.attrs.min); i <= Math.min(Number(col.attrs.max), Number(col.attrs.min) + 200); i++) colWidths[i - 1] = px
    }

    let filter = null, filterShown = null
    const af = kid(ws, 'autoFilter')
    if (af?.attrs.ref && parseRange(af.attrs.ref)) {
      filter = { source: formatRange(parseRange(af.attrs.ref)), hidden: {} }
      for (const fc of kids(af, 'filterColumn')) {
        const list = kid(fc, 'filters')
        if (list) (filterShown ??= {})[fc.attrs.colId] = kids(list, 'filter').map((x) => x.attrs.val).concat(list.attrs.blank === '1' ? ['(Blanks)'] : [])
        else notes.push('A filter on sheet "' + s.attrs.name + '" uses a condition rather than a list of values, so it was left off.')
      }
    }
    if (kid(ws, 'conditionalFormatting')) notes.push('Sheet "' + s.attrs.name + '" has conditional formatting, which was not brought in: add colour rules again with the highlighter button.')
    if (kid(ws, 'drawing')) notes.push('Sheet "' + s.attrs.name + '" has charts or pictures, which were not brought in.')
    sheets.push({ name: s.attrs.name, cells, colWidths, rowHeights, filter, filterShown })
  }
  if (!sheets.length) throw new Error('The workbook has no worksheets to open.')
  return { sheets, notes: [...new Set(notes)] }
}

// ── Writing ────────────────────────────────────────────────────────────
const argb = (hex) => 'FF' + hex.replace('#', '').toUpperCase().padStart(6, '0')

function cellXml(ref, s, value, formula, spillRef) {
  const sAttr = s ? ` s="${s}"` : ''
  const f = formula ? `<f${spillRef ? ` t="array" ref="${spillRef}"` : ''}>${esc(prefixNewer(formula))}</f>` : ''
  if (value === null || value === undefined || value === '') return formula ? `<c r="${ref}"${sAttr}>${f}</c>` : s ? `<c r="${ref}"${sAttr}/>` : ''
  if (typeof value === 'number') return Number.isFinite(value) ? `<c r="${ref}"${sAttr}>${f}<v>${value}</v></c>` : `<c r="${ref}"${sAttr} t="e">${f}<v>#NUM!</v></c>`
  if (typeof value === 'boolean') return `<c r="${ref}"${sAttr} t="b">${f}<v>${value ? 1 : 0}</v></c>`
  if (isError(value)) return `<c r="${ref}"${sAttr} t="e">${f}<v>${esc(value.code)}</v></c>`
  if (formula) return `<c r="${ref}"${sAttr} t="str">${f}<v>${esc(value)}</v></c>`
  return `<c r="${ref}"${sAttr} t="inlineStr"><is><t xml:space="preserve">${esc(value)}</t></is></c>`
}

// wb: a Workbook. Returns { bytes, notes }.
export function writeXlsx(wb) {
  const notes = new Set()
  // Styles are shared: each different combination of format and style is one entry.
  const numFmts = new Map() // code → id
  const fonts = ['<font><sz val="11"/><name val="Calibri"/></font>']
  const fontIds = new Map([['', 0]])
  const fills = ['<fill><patternFill patternType="none"/></fill>', '<fill><patternFill patternType="gray125"/></fill>']
  const fillIds = new Map([['', 0]])
  const xfs = ['<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>']
  const xfIds = new Map([['', 0]])
  const styleId = (format, style = {}) => {
    const key = JSON.stringify([format ?? '', style])
    if (xfIds.has(key)) return xfIds.get(key)
    let numFmtId = 0
    if (format && format !== 'General') {
      numFmtId = BUILTIN_IDS[format] ?? numFmts.get(format)
      if (numFmtId === undefined) { numFmtId = 164 + numFmts.size; numFmts.set(format, numFmtId) }
    }
    const fontKey = JSON.stringify([style.bold, style.italic, style.underline, style.color])
    let fontId = style.bold || style.italic || style.underline || style.color ? fontIds.get(fontKey) : 0
    if (fontId === undefined) {
      fontId = fonts.length
      fonts.push('<font>' + (style.bold ? '<b/>' : '') + (style.italic ? '<i/>' : '') + (style.underline ? '<u/>' : '') + '<sz val="11"/>' + (style.color ? `<color rgb="${argb(style.color)}"/>` : '') + '<name val="Calibri"/></font>')
      fontIds.set(fontKey, fontId)
    }
    let fillId = style.fill ? fillIds.get(style.fill) : 0
    if (fillId === undefined) {
      fillId = fills.length
      fills.push(`<fill><patternFill patternType="solid"><fgColor rgb="${argb(style.fill)}"/><bgColor indexed="64"/></patternFill></fill>`)
      fillIds.set(style.fill, fillId)
    }
    const align = style.align ? `<alignment horizontal="${style.align}"/>` : ''
    const id = xfs.length
    xfs.push(`<xf numFmtId="${numFmtId}" fontId="${fontId}" fillId="${fillId}" borderId="0" xfId="0"${numFmtId ? ' applyNumberFormat="1"' : ''}${fontId ? ' applyFont="1"' : ''}${fillId ? ' applyFill="1"' : ''}${align ? ' applyAlignment="1">' + align + '</xf>' : '/>'}`)
    xfIds.set(key, id)
    return id
  }

  const sheetFiles = wb.sheets.map((sheet) => {
    const rows = new Map() // row → [[col, xml]]
    const put = (r, c, xml) => { if (!xml) return; if (!rows.has(r)) rows.set(r, []); rows.get(r).push([c, xml]) }
    const written = new Set()
    for (const [key, cell] of sheet.cells) {
      const { row, col } = keyToPos(key)
      const s = cell.format || cell.style ? styleId(cell.format, cell.style) : 0
      if (cell.kind === 'formula') {
        const v = cell.value
        const spill = sheet.spills.get(key)
        const top = isMatrix(v) ? v.get(0, 0) : v
        put(row, col, cellXml(key, s, top, cell.input.slice(1), spill && (spill.r2 > spill.r1 || spill.c2 > spill.c1) ? formatRange(spill) : null))
      } else if (cell.kind === 'code') {
        notes.add('Python, JavaScript and MATLAB cells were saved as the values they show: Excel cannot run their code.')
        const v = isMatrix(cell.value) ? cell.value.get(0, 0) : cell.value
        put(row, col, cellXml(key, s, v, null))
      } else if (cell.input?.startsWith("'")) put(row, col, cellXml(key, s, cell.input.slice(1), null))
      else put(row, col, cellXml(key, s, cell.value, null))
      written.add(key)
    }
    // The values in cells a formula spilled into, as Excel saves them.
    for (const [anchor, rg] of sheet.spills) {
      for (let r = rg.r1; r <= rg.r2; r++) for (let c = rg.c1; c <= rg.c2; c++) {
        const key = cellKey(r, c)
        if (key === anchor || written.has(key)) continue
        put(r, c, cellXml(key, 0, wb.valueAt(sheet, r, c), null))
      }
    }
    const filterRange = sheet.filter ? parseRange(sheet.filter.source) : null
    const hiddenRows = new Set()
    if (filterRange) {
      // Rows the filter hides are saved hidden, so Excel shows the same rows.
      const read = (r, c) => wb.valueAt(sheet, r, c)
      for (const [offset, keys] of Object.entries(sheet.filter.hidden ?? {})) {
        const k = new Set(keys)
        for (let r = filterRange.r1 + 1; r <= filterRange.r2; r++) {
          if (k.has(filterKey(read(r, filterRange.c1 + Number(offset))))) hiddenRows.add(r)
        }
      }
      for (const r of hiddenRows) if (!rows.has(r)) rows.set(r, [])
    }
    for (const r of Object.keys(sheet.rowHeights)) if (!rows.has(Number(r))) rows.set(Number(r), [])
    const rowXml = [...rows.keys()].sort((a, b) => a - b).map((r) => {
      const h = sheet.rowHeights[r]
      const attrs = (h ? ` ht="${(h * 3 / 4).toFixed(2)}" customHeight="1"` : '') + (hiddenRows.has(r) ? ' hidden="1"' : '')
      const cells = rows.get(r).sort((a, b) => a[0] - b[0]).map((x) => x[1]).join('')
      return `<row r="${r + 1}"${attrs}>${cells}</row>`
    }).join('')
    const colXml = Object.entries(sheet.colWidths).sort((a, b) => a[0] - b[0]).map(([c, px]) => `<col min="${Number(c) + 1}" max="${Number(c) + 1}" width="${Math.max(0, (px - 5) / 7).toFixed(2)}" customWidth="1"/>`).join('')
    let filterXml = ''
    if (filterRange) {
      const cols = Object.entries(sheet.filter.hidden ?? {}).filter(([, k]) => k.length).map(([offset, keys]) => {
        const shownVals = columnValues(filterRange, filterRange.c1 + Number(offset), (r, c) => wb.valueAt(sheet, r, c)).map((v) => v.key).filter((x) => !keys.includes(x))
        return `<filterColumn colId="${offset}"><filters${shownVals.includes(BLANKS) ? ' blank="1"' : ''}>${shownVals.filter((x) => x !== BLANKS).map((x) => `<filter val="${esc(x)}"/>`).join('')}</filters></filterColumn>`
      }).join('')
      filterXml = `<autoFilter ref="${formatRange(filterRange)}">${cols}</autoFilter>`
    }
    if (sheet.charts.length) notes.add('Charts are not saved in the Excel file; they stay in this workbook in UpSkillOS.')
    if (sheet.rules.length) notes.add('Colour rules (conditional formatting) are not saved in the Excel file.')
    const b = sheet.bounds()
    const dim = b.rows && b.cols ? 'A1:' + indexToCol(b.cols - 1) + b.rows : 'A1'
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
      + '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
      + `<dimension ref="${dim}"/>` + (colXml ? `<cols>${colXml}</cols>` : '') + `<sheetData>${rowXml}</sheetData>` + filterXml + '</worksheet>'
  })

  const numFmtXml = numFmts.size ? `<numFmts count="${numFmts.size}">${[...numFmts].map(([code, id]) => `<numFmt numFmtId="${id}" formatCode="${esc(code)}"/>`).join('')}</numFmts>` : ''
  const stylesXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
    + numFmtXml + `<fonts count="${fonts.length}">${fonts.join('')}</fonts><fills count="${fills.length}">${fills.join('')}</fills>`
    + '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>'
    + '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'
    + `<cellXfs count="${xfs.length}">${xfs.join('')}</cellXfs>`
    + '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>'
  const definedNames = wb.sheets.map((s, i) => (s.filter ? `<definedName name="_xlnm._FilterDatabase" localSheetId="${i}" hidden="1">${esc(quoteName(s.name))}!${absolute(parseRange(s.filter.source))}</definedName>` : '')).join('')
  const workbookXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
    + `<sheets>${wb.sheets.map((s, i) => `<sheet name="${esc(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets>`
    + (definedNames ? `<definedNames>${definedNames}</definedNames>` : '') + '<calcPr calcId="191029" fullCalcOnLoad="1"/></workbook>'
  const rel = (id, type, target) => `<Relationship Id="${id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/${type}" Target="${target}"/>`
  const workbookRels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
    + wb.sheets.map((_, i) => rel('rId' + (i + 1), 'worksheet', `worksheets/sheet${i + 1}.xml`)).join('') + rel('rId' + (wb.sheets.length + 1), 'styles', 'styles.xml') + '</Relationships>'
  const contentTypes = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
    + '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>'
    + '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
    + wb.sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')
    + '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>'
  const rootRels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
    + rel('rId1', 'officeDocument', 'xl/workbook.xml') + '</Relationships>'

  const files = {
    '[Content_Types].xml': strToU8(contentTypes),
    '_rels/.rels': strToU8(rootRels),
    'xl/workbook.xml': strToU8(workbookXml),
    'xl/_rels/workbook.xml.rels': strToU8(workbookRels),
    'xl/styles.xml': strToU8(stylesXml),
  }
  sheetFiles.forEach((xml, i) => { files[`xl/worksheets/sheet${i + 1}.xml`] = strToU8(xml) })
  return { bytes: zipSync(files, { level: 6 }), notes: [...notes] }
}

const quoteName = (name) => (/^[A-Za-z_][\w.]*$/.test(name) ? name : "'" + name.replace(/'/g, "''") + "'")
const absolute = (rg) => '$' + indexToCol(rg.c1) + '$' + (rg.r1 + 1) + ':$' + indexToCol(rg.c2) + '$' + (rg.r2 + 1)

// An .xlsx file as a Workbook, with notes on anything left out.
export function importXlsx(bytes) {
  const { sheets, notes } = readXlsx(bytes)
  const wb = Workbook.fromJSON({ sheets: sheets.map(({ filterShown, ...s }) => s) })
  // Excel stores which values a filter shows; this workbook stores which it hides.
  sheets.forEach((s, i) => {
    const sheet = wb.sheets[i]
    if (!sheet.filter || !s.filterShown) return
    const rg = parseRange(sheet.filter.source)
    const hidden = {}
    for (const [offset, shown] of Object.entries(s.filterShown)) {
      const keep = new Set(shown)
      const keys = columnValues(rg, rg.c1 + Number(offset), (r, c) => wb.valueAt(sheet, r, c)).map((v) => v.key).filter((k) => !keep.has(k))
      if (keys.length) hidden[offset] = keys
    }
    sheet.filter = { ...sheet.filter, hidden }
  })
  wb.undoStack = []
  return { wb, notes }
}
