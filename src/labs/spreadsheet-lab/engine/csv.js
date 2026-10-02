// CSV (comma-separated values): the plain-text table format almost every
// tool can read and write. A value containing a comma, a quote or a line break
// is wrapped in double quotes, and a quote inside it is doubled: "say ""hi""".

export function parseCSV(text, delimiter = guessDelimiter(text)) {
  const rows = []
  let row = [], field = '', inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i++ }
      else if (ch === '"') inQuotes = false
      else field += ch
    } else if (ch === '"' && field === '') inQuotes = true
    else if (ch === delimiter) { row.push(field); field = '' }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++
      row.push(field); rows.push(row); row = []; field = ''
    } else field += ch
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row) }
  return rows
}

// Comma unless the first line has more tabs or semicolons (common in
// spreadsheets saved in countries that write decimals with a comma).
export function guessDelimiter(text) {
  const first = text.split(/\r?\n/, 1)[0] ?? ''
  const count = (ch) => first.split(ch).length - 1
  const options = [[',', count(',')], ['\t', count('\t')], [';', count(';')]]
  return options.sort((a, b) => b[1] - a[1])[0][1] > 0 ? options[0][0] : ','
}

export function toCSV(rows, delimiter = ',') {
  return rows.map((row) => row.map((v) => {
    const s = v === null || v === undefined ? '' : String(v)
    return /[",\r\n]/.test(s) || s.includes(delimiter) ? '"' + s.replace(/"/g, '""') + '"' : s
  }).join(delimiter)).join('\r\n')
}
