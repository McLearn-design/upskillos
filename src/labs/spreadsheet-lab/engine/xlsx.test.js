import { describe, expect, it } from 'vitest'
import { zipSync, strToU8, unzipSync, strFromU8 } from 'fflate'
import { Workbook } from './workbook.js'
import { importXlsx, parseXml, writeXlsx } from './xlsx.js'

function sample() {
  const wb = new Workbook()
  const s = wb.sheets[0]
  wb.renameSheet(s.id, 'Scores & notes')
  const set = (key, input, extra = {}) => {
    const col = key.charCodeAt(0) - 65, row = Number(key.slice(1)) - 1
    wb.setCells([{ sheetId: s.id, row, col, input, ...extra }])
  }
  set('A1', 'Name', { style: { bold: true, fill: '#dbeafe' } })
  set('B1', 'Score', { style: { bold: true, fill: '#dbeafe', align: 'center' } })
  set('A2', 'Ann'); set('B2', '72')
  set('A3', 'Bo'); set('B3', '91')
  set('A4', "'00123") // text that looks like a number
  set('B4', '0.25', { format: '0%' })
  set('C1', '2025-03-14') // a date
  set('C2', '=SUM(B2:B3)', { style: { italic: true, color: '#dc2626' } })
  set('C3', '=STDEV.S(B2:B3)')
  set('C4', '=A2&" <x>"')
  set('D1', '=SEQUENCE(3)')
  set('E1', 'TRUE'); set('E2', '=1/0')
  wb.setSize(s.id, 'col', 0, 160)
  wb.setSize(s.id, 'row', 1, 40)
  wb.setFilter(s.id, { source: 'A1:B3', hidden: { 0: ['Bo'] } })
  return wb
}

describe('Excel files', () => {
  it('reads back what it writes', () => {
    const wb = sample()
    const { bytes } = writeXlsx(wb)
    const { wb: back } = importXlsx(bytes)
    const s = back.sheets[0]
    const cell = (k) => back.getCell(s.id, Number(k.slice(1)) - 1, k.charCodeAt(0) - 65)
    expect(s.name).toBe('Scores & notes')
    expect(cell('A1')).toMatchObject({ input: 'Name', style: { bold: true, fill: '#dbeafe' } })
    expect(cell('B1').style).toEqual({ bold: true, fill: '#dbeafe', align: 'center' })
    expect(cell('A4').value).toBe('00123')
    expect(cell('B4')).toMatchObject({ value: 0.25, format: '0%' })
    expect(cell('C1').value).toBe(wb.getCell(wb.sheets[0].id, 0, 2).value)
    expect(cell('C1').format).toBe('yyyy-mm-dd')
    expect(cell('C1').input).toBe('2025-03-14') // as typed, so editing shows a date
    expect(cell('C2')).toMatchObject({ input: '=SUM(B2:B3)', value: 163, style: { italic: true, color: '#dc2626' } })
    expect(cell('C3').input).toBe('=STDEV.S(B2:B3)')
    expect(cell('C4').value).toBe('Ann <x>')
    expect(cell('D1').input).toBe('=SEQUENCE(3)')
    expect([0, 1, 2].map((r) => back.valueAt(s, r, 3))).toEqual([1, 2, 3]) // spills again, no #SPILL!
    expect(cell('E1').value).toBe(true)
    expect(cell('E2').value.code).toBe('#DIV/0!')
    expect(s.colWidths[0]).toBe(160)
    expect(s.rowHeights[1]).toBe(40)
    expect(s.filter).toEqual({ source: 'A1:B3', hidden: { 0: ['Bo'] } })
  })

  it('marks newer functions so Excel recognises them, and saves cached values', () => {
    const files = unzipSync(writeXlsx(sample()).bytes)
    const sheet = strFromU8(files['xl/worksheets/sheet1.xml'])
    expect(sheet).toContain('<f>_xlfn.STDEV.S(B2:B3)</f>')
    expect(sheet).toContain('<f t="array" ref="D1:D3">_xlfn.SEQUENCE(3)</f><v>1</v>')
    expect(sheet).toMatch(/<c r="C2" s="\d+"><f>SUM\(B2:B3\)<\/f><v>163<\/v><\/c>/)
    expect(sheet).toContain('<row r="3" hidden="1">')
    expect(sheet).toContain('A2&amp;&quot; &lt;x&gt;&quot;')
  })

  it('expands shared formulas and reads shared strings', () => {
    const xml = (s) => strToU8('<?xml version="1.0"?>' + s)
    const ns = 'xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"'
    const bytes = zipSync({
      'xl/workbook.xml': xml(`<workbook ${ns}><sheets><sheet name="Data" sheetId="1" r:id="rId1"/></sheets></workbook>`),
      'xl/_rels/workbook.xml.rels': xml('<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="worksheet" Target="worksheets/sheet1.xml"/></Relationships>'),
      'xl/sharedStrings.xml': xml(`<sst ${ns}><si><t>Price</t></si><si><r><t>Dou</t></r><r><t>bled</t></r></si></sst>`),
      'xl/worksheets/sheet1.xml': xml(`<worksheet ${ns}><sheetData>
        <row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c></row>
        <row r="2"><c r="A2"><v>3</v></c><c r="B2"><f t="shared" ref="B2:B4" si="0">A2*2</f><v>6</v></c></row>
        <row r="3"><c r="A3"><v>4</v></c><c r="B3"><f t="shared" si="0"/><v>8</v></c></row>
        <row r="4"><c r="A4"><v>5</v></c><c r="B4"><f t="shared" si="0"/><v>10</v></c></row>
      </sheetData></worksheet>`),
    })
    const { wb } = importXlsx(bytes)
    const s = wb.sheets[0]
    expect(s.name).toBe('Data')
    expect(wb.getCell(s.id, 0, 1).value).toBe('Doubled')
    expect(wb.getCell(s.id, 3, 1).input).toBe('=A4*2')
    expect(wb.valueAt(s, 3, 1)).toBe(10)
  })

  it('explains a file that is not a workbook', () => {
    expect(() => importXlsx(strToU8('hello'))).toThrow(/not an Excel workbook/)
  })

  it('parses XML with entities, CDATA and namespaces', () => {
    const root = parseXml('<?xml version="1.0"?><x:a k="1 &amp; 2"><b>&lt;hi&gt; &#65;</b><![CDATA[<raw>]]><c/></x:a>')
    const a = root.children[0]
    expect(a.name).toBe('a')
    expect(a.attrs.k).toBe('1 & 2')
    expect(a.children[0].text).toBe('<hi> A')
    expect(a.text).toBe('<raw>')
    expect(a.children[1].name).toBe('c')
  })
})
