// Runs lesson code (the "explore" figures, the starter code and the solutions)
// against the libraries the app already ships: d3, three.js and math.js.
//
// Code runs in the page as an async function, not in an iframe, so it can use
// the bundled libraries directly and draw into a real element. It is the
// learner's own code in their own browser, so the only thing to protect
// against is mess: every run gets a fresh element, its animation frames and
// cleanup callbacks are cancelled before the next run, and errors are caught.
import { DATASETS, datasetCsv, loadDataset, rng } from './data.js'

let d3Promise = null
let threePromise = null
let mathPromise = null

const loadD3 = () => (d3Promise ??= import('d3'))
const loadThree = () => (threePromise ??= Promise.all([
  import('three'),
  import('three/examples/jsm/controls/OrbitControls.js'),
]).then(([THREE, controls]) => ({ THREE, OrbitControls: controls.OrbitControls })))
const loadMath = () => (mathPromise ??= import('mathjs').then((m) => m.create(m.all)))

export const usesThree = (code) => /\bTHREE\b|\bOrbitControls\b/.test(code)
export const usesMath = (code) => /\bmath\s*\./.test(code)

// Colours the figures use, so the same code reads well in light and dark mode.
export function themeColors(dark) {
  return dark
    ? { dark, text: '#e2e8f0', muted: '#94a3b8', grid: '#334155', bg: '#0f172a', accent: '#38bdf8', accent2: '#f472b6', good: '#34d399', bad: '#f87171',
        palette: ['#38bdf8', '#f472b6', '#facc15', '#34d399', '#a78bfa', '#fb923c'] }
    : { dark, text: '#0f172a', muted: '#475569', grid: '#e2e8f0', bg: '#ffffff', accent: '#0284c7', accent2: '#db2777', good: '#059669', bad: '#dc2626',
        palette: ['#0284c7', '#db2777', '#ca8a04', '#059669', '#7c3aed', '#ea580c'] }
}

function formatValue(value) {
  if (typeof value === 'string') return value
  if (value instanceof Error) return value.message
  if (typeof value === 'number') return Number.isInteger(value) ? String(value) : String(+value.toPrecision(6))
  try {
    return JSON.stringify(value, (_k, v) => (typeof v === 'number' && !Number.isInteger(v) ? +v.toPrecision(6) : v), 2)
  } catch {
    return String(value)
  }
}

const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor

// Names a lesson's code can use. Kept in one list so the reference panel and
// the runner cannot drift apart.
export const GLOBALS = [
  ['d3', 'the whole d3 library (arrays, scales, axes, shapes, selections, dsv)'],
  ['THREE', 'three.js, loaded when the code mentions it'],
  ['OrbitControls', 'three.js camera controls (drag to rotate, scroll to zoom)'],
  ['math', 'math.js (matrices, linear algebra), loaded when the code uses math.'],
  ['el', 'the output element; draw into it'],
  ['width, height', 'the output size in pixels'],
  ['frame(opts)', 'adds an SVG with margins; returns { svg, g, w, h } (inner size)'],
  ['load(name)', 'a dataset as an array of row objects (parsed with d3.autoType)'],
  ['datasets', 'the raw CSV text of every dataset, by name'],
  ['params', 'the current values of the figure\'s sliders'],
  ['log(...values), table(rows, n)', 'print to the console below the output'],
  ['rng(seed)', 'a seeded random number generator: same seed, same numbers'],
  ['animate(fn)', 'call fn(timeMs) every frame until the next run'],
  ['onCleanup(fn)', 'run fn before the next run (dispose renderers, timers)'],
  ['theme', 'colours: text, muted, grid, bg, accent, accent2, good, bad, palette'],
  ['return value', 'what the task checker compares with the solution'],
]

// Run `code` into `el`. Returns { logs, value, error, dispose }.
// Always call dispose() before running again into the same element.
export async function runCode(code, { el, params = {}, dark = false, onLog } = {}) {
  const logs = []
  const cleanups = []
  let frames = []
  let disposed = false
  let d3ref = null
  // Which run currently owns `el`. A superseded run that finishes late must
  // not touch what the newer run has drawn.
  const token = {}
  if (el) el.__wdsRun = token
  const ownsEl = () => el && el.__wdsRun === token
  const push = (entry) => { logs.push(entry); onLog?.(entry) }
  const log = (...values) => push({ level: 'log', text: values.map(formatValue).join(' ') })
  const warn = (...values) => push({ level: 'warn', text: values.map(formatValue).join(' ') })
  const dispose = () => {
    if (disposed) return
    disposed = true
    frames.forEach((id) => cancelAnimationFrame(id))
    frames = []
    // Stop transitions still running on the old output's nodes.
    if (ownsEl() && d3ref) d3ref.select(el).selectAll('*').interrupt()
    for (const fn of cleanups.splice(0)) { try { fn() } catch { /* keep disposing */ } }
  }

  try {
    const d3 = await loadD3()
    d3ref = d3
    const three = usesThree(code) ? await loadThree() : { THREE: undefined, OrbitControls: undefined }
    const math = usesMath(code) ? await loadMath() : undefined
    if (!ownsEl() && el) throw new Error('superseded by a newer run')
    if (el) el.innerHTML = ''
    const width = Math.max(240, el?.clientWidth || 640)
    const height = Math.max(200, el?.clientHeight || 360)
    const theme = themeColors(dark)

    const frame = ({ margin = {}, w = width, h = height } = {}) => {
      const m = { top: 16, right: 16, bottom: 36, left: 48, ...margin }
      const svg = d3.select(el).append('svg')
        .attr('viewBox', [0, 0, w, h]).attr('width', '100%').attr('height', h)
        .style('display', 'block').style('color', theme.text).style('font', '12px system-ui, sans-serif')
      const g = svg.append('g').attr('transform', 'translate(' + m.left + ',' + m.top + ')')
      return { svg, g, w: w - m.left - m.right, h: h - m.top - m.bottom, margin: m }
    }
    const table = (rows, n = 10) => {
      const list = Array.from(rows ?? []).slice(0, n)
      if (!list.length) { log('(no rows)'); return }
      const cols = Object.keys(list[0])
      const cell = (v) => (v instanceof Date ? v.toISOString().slice(0, 10) : v == null ? '·' : formatValue(v))
      const widths = cols.map((c) => Math.max(c.length, ...list.map((r) => cell(r[c]).length)))
      const line = (vals) => vals.map((v, i) => String(v).padEnd(widths[i])).join('  ')
      push({ level: 'table', text: [line(cols), line(widths.map((w) => '─'.repeat(w))), ...list.map((r) => line(cols.map((c) => cell(r[c]))))].join('\n') })
    }
    const animate = (fn) => {
      const start = performance.now()
      const step = (t) => {
        if (disposed) return
        try { fn(t - start) } catch (err) { push({ level: 'error', text: String(err?.message ?? err) }); return }
        frames = [requestAnimationFrame(step)]
      }
      frames = [requestAnimationFrame(step)]
    }
    const onCleanup = (fn) => { cleanups.push(fn) }
    const datasets = Object.fromEntries(Object.keys(DATASETS).map((k) => [k, datasetCsv(k)]))
    const load = (name) => loadDataset(name, d3)

    const fn = new AsyncFunction(
      'd3', 'THREE', 'OrbitControls', 'math', 'el', 'width', 'height', 'frame', 'load', 'datasets',
      'params', 'log', 'warn', 'table', 'rng', 'animate', 'onCleanup', 'theme',
      // The extra block lets lesson code declare its own `table`, `width`, … without
      // a "has already been declared" error from clashing with the parameters.
      '"use strict";\n{\n' + code + '\n}',
    )
    const value = await fn(
      d3, three.THREE, three.OrbitControls, math, el, width, height, frame, load, datasets,
      params, log, warn, table, rng, animate, onCleanup, theme,
    )
    return { logs, value, error: null, dispose }
  } catch (err) {
    push({ level: 'error', text: describeError(err) })
    return { logs, value: undefined, error: err, dispose }
  }
}

function describeError(err) {
  if (!err) return 'Unknown error'
  if (err instanceof SyntaxError) return 'Syntax error: ' + err.message
  return (err.name && err.name !== 'Error' ? err.name + ': ' : '') + (err.message ?? String(err))
}

// Compare a learner's return value with the solution's. Numbers match within a
// relative tolerance; arrays and objects match element by element.
export function sameValue(got, want, tol = 1e-6) {
  if (typeof want === 'number') {
    if (typeof got !== 'number' || Number.isNaN(got)) return false
    return Math.abs(got - want) <= tol * Math.max(1, Math.abs(want))
  }
  if (want instanceof Date) return got instanceof Date && got.getTime() === want.getTime()
  if (Array.isArray(want)) return Array.isArray(got) && got.length === want.length && want.every((w, i) => sameValue(got[i], w, tol))
  if (want && typeof want === 'object') {
    if (!got || typeof got !== 'object') return false
    const keys = Object.keys(want)
    return keys.length === Object.keys(got).length && keys.every((k) => sameValue(got[k], want[k], tol))
  }
  return got === want
}

export { formatValue }
