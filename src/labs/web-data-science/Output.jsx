import { useEffect, useRef, useState } from 'react'
import { runCode } from './runtime.js'

// Whether the app is in dark mode. The app toggles a `dark` class on <html>.
export function useIsDark() {
  const read = () => typeof document !== 'undefined' && document.documentElement.classList.contains('dark')
  const [dark, setDark] = useState(read)
  useEffect(() => {
    const obs = new MutationObserver(() => setDark(read()))
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => obs.disconnect()
  }, [])
  return dark
}

const LEVEL_CLASS = {
  log: 'text-slate-700 dark:text-slate-200',
  table: 'text-slate-700 dark:text-slate-200',
  warn: 'text-amber-700 dark:text-amber-300',
  error: 'text-red-700 dark:text-red-300',
}

export function Console({ logs }) {
  if (!logs.length) return null
  return (
    <div className="max-h-56 overflow-auto border-t border-slate-200 bg-slate-50 px-3 py-2 font-mono text-xs dark:border-slate-700 dark:bg-slate-900/70" aria-label="Console output">
      {logs.map((entry, i) => (
        <pre key={i} className={'whitespace-pre-wrap break-words py-0.5 ' + LEVEL_CLASS[entry.level]}>
          {entry.level === 'error' ? '✖ ' : entry.level === 'warn' ? '⚠ ' : ''}{entry.text}
        </pre>
      ))}
    </div>
  )
}

// Runs `code` whenever `runKey` changes (and on mount), into its own element.
// Returns the latest result to the parent through onResult.
export function Output({ code, params, runKey, height = 360, onResult, label = 'Output' }) {
  const elRef = useRef(null)
  const dark = useIsDark()
  const [logs, setLogs] = useState([])
  const [busy, setBusy] = useState(false)
  const [sizeKey, setSizeKey] = useState(0)
  const onResultRef = useRef(onResult)
  onResultRef.current = onResult

  // Charts are drawn for the width they have, so draw again when it changes
  // (a window resized or maximised, the sidebar opening). Debounced: a drag
  // fires many resize events.
  useEffect(() => {
    const el = elRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    let last = el.clientWidth
    let timer
    const observer = new ResizeObserver(() => {
      const w = el.clientWidth
      if (Math.abs(w - last) < 2) return
      last = w
      clearTimeout(timer)
      timer = setTimeout(() => setSizeKey((k) => k + 1), 200)
    })
    observer.observe(el)
    return () => { clearTimeout(timer); observer.disconnect() }
  }, [])

  useEffect(() => {
    let cancelled = false
    let dispose = () => {}
    setBusy(true)
    runCode(code, { el: elRef.current, params, dark }).then((result) => {
      dispose = result.dispose
      if (cancelled) { dispose(); return }
      setLogs(result.logs)
      setBusy(false)
      onResultRef.current?.(result)
    })
    return () => { cancelled = true; dispose() }
    // `params` is compared by value so a re-render with equal sliders does not re-run.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, JSON.stringify(params), runKey, dark, sizeKey])

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-950">
      <div className="relative">
        <div ref={elRef} role="figure" aria-label={label} className="wds-output w-full overflow-hidden text-slate-900 dark:text-slate-100" style={{ height }} />
        {busy && <div className="absolute right-2 top-2 rounded bg-slate-900/70 px-2 py-0.5 text-xs text-white">running…</div>}
      </div>
      <Console logs={logs} />
    </div>
  )
}
