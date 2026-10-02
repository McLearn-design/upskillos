// Runs JavaScript and MATLAB cells away from the page, so a slow or endless
// loop cannot freeze the spreadsheet: the page stops it by ending this worker.
import { executeScript } from '../../../engines/openmat/openmatEngine.js'
import { matlabResultName, substituteMatlab } from '../engine/code.js'

const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor
const OUTPUT_LIMIT = 20000

const show = (x) => {
  if (typeof x === 'string') return x
  try { return JSON.stringify(x) } catch { return String(x) }
}

// Values that cannot cross back to the page (functions, class instances)
// become text; typed arrays become plain arrays.
function plain(v, depth = 0) {
  if (v === null || v === undefined || typeof v === 'number' || typeof v === 'string' || typeof v === 'boolean') return v ?? null
  if (depth > 4) return String(v)
  if (ArrayBuffer.isView(v)) return Array.from(v)
  if (Array.isArray(v)) return v.map((x) => plain(x, depth + 1))
  if (v instanceof Date) return v.toISOString()
  if (v instanceof Map) return Object.fromEntries([...v].map(([k, x]) => [String(k), plain(x, depth + 1)]))
  if (typeof v === 'object' && v.constructor === Object) return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, plain(x, depth + 1)]))
  return String(v)
}

async function runJS(source, inputs) {
  const out = []
  const write = (...args) => { if (out.join('\n').length < OUTPUT_LIMIT) out.push(args.map(show).join(' ')) }
  const console = { log: write, info: write, warn: write, error: write, table: write }
  const xl = (ref) => {
    if (!(ref in inputs)) throw new Error('xl("' + ref + '") can only read an address written directly in quotes, such as xl("A1:B5").')
    return structuredClone(inputs[ref])
  }
  // The cell's code is the body of an async function: `return` gives the
  // cell its value, and `await` works.
  const fn = new AsyncFunction('xl', 'console', '"use strict";\n' + source)
  const value = await fn(xl, console)
  if (value === undefined) out.push('(The code did not return anything. End it with return … to put a value in the cell.)')
  return { value: plain(value), stdout: out.join('\n') }
}

function matlabValue(v) {
  if (v === null || v === undefined) return null
  if (typeof v === 'number' || typeof v === 'string' || typeof v === 'boolean') return v
  if (typeof v.toArray === 'function') {
    const a = v.toArray()
    // OpenMAT keeps vectors without a row/column direction, so a vector spills
    // down a column, the same rule as lists in Python and JavaScript cells.
    return Array.isArray(a[0]) ? a.map((r) => r.map(matlabValue)) : a.map(matlabValue)
  }
  if (Array.isArray(v)) return v.map(matlabValue)
  if (typeof v.re === 'number') return v.im === 0 ? v.re : String(v) // complex numbers show as text
  return String(v)
}

function runMatlab(source, inputs) {
  const code = substituteMatlab(source, inputs)
  const name = matlabResultName(source)
  const result = executeScript(code)
  const entry = result.workspace.find((w) => w.name === name)
  const stdout = [result.output && result.output !== 'No output.' ? result.output : '', ...result.compatibilityWarnings.map((w) => 'Note: ' + w)]
  if (result.figureJson) stdout.push('This cell drew a plot. Open the code in OpenMAT to see plots; the cell shows the value of the last line.')
  return { value: entry ? matlabValue(entry.value) : null, stdout: stdout.filter(Boolean).join('\n') }
}

self.onmessage = async ({ data }) => {
  const started = performance.now()
  try {
    const result = data.lang === 'js' ? await runJS(data.source, data.inputs) : runMatlab(data.source, data.inputs)
    self.postMessage({ job: data.job, ...result, ms: performance.now() - started })
  } catch (e) {
    if (data.lang === 'matlab') {
      // OpenMAT reports "Line n / Source: … / Normalized: … / message": keep
      // the message and the learner's line, not the internal translation.
      const text = String(e?.message ?? e)
      const line = /Line (\d+)/.exec(text)?.[1]
      const source = /Source: (.*)/.exec(text)?.[1]
      const message = text.split('\n').filter((l) => l && !/^(Line \d+|Source:|Normalized:)/.test(l)).join(' ') || text
      self.postMessage({ job: data.job, error: '#CODE!', detail: message + (line ? ' (line ' + line + (source ? ': ' + source.trim() : '') + ')' : ''), ms: performance.now() - started })
      return
    }
    const where = /<anonymous>:(\d+):(\d+)/.exec(e?.stack ?? '')
    const line = where ? ' (line ' + (Number(where[1]) - 3) + ')' : ''
    self.postMessage({ job: data.job, error: '#CODE!', detail: (e?.name ? e.name + ': ' : '') + (e?.message ?? String(e)) + line, ms: performance.now() - started })
  }
}
