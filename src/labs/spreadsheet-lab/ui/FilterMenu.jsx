// The menu under a filter button: sort by this column, or tick the values
// whose rows should show. Changes apply with OK, as in Excel.
import { useEffect, useMemo, useRef, useState } from 'react'
import { columnValues } from '../engine/data.js'

export default function FilterMenu({ anchor, bounds, heading, range, col, read, hidden, onApply, onSort, onClose }) {
  const values = useMemo(() => columnValues(range, col, read), [range, col, read])
  const [shown, setShown] = useState(() => new Set(values.map((v) => v.key).filter((k) => !hidden.includes(k))))
  const [query, setQuery] = useState('')
  const ref = useRef(null)
  const q = query.trim().toLowerCase()
  const listed = q ? values.filter((v) => v.key.toLowerCase().includes(q)) : values
  const allTicked = listed.every((v) => shown.has(v.key))

  useEffect(() => {
    ref.current?.querySelector('input')?.focus()
    const away = (e) => { if (!ref.current?.contains(e.target)) onClose() }
    document.addEventListener('pointerdown', away, true)
    return () => document.removeEventListener('pointerdown', away, true)
  }, [onClose])

  const toggle = (key) => setShown((s) => { const n = new Set(s); if (n.has(key)) n.delete(key); else n.add(key); return n })
  const toggleAll = () => setShown((s) => { const n = new Set(s); for (const v of listed) { if (allTicked) n.delete(v.key); else n.add(v.key) } return n })
  // With a search, OK shows only the matches, as Excel does.
  const apply = () => onApply(values.map((v) => v.key).filter((k) => !shown.has(k) || (q && !listed.some((v) => v.key === k))))

  const left = Math.max(4, Math.min(anchor.left, bounds.width - 250))
  const top = Math.max(4, Math.min(anchor.bottom + 4, bounds.height - 400))
  const button = 'w-full rounded px-2 py-1 text-left text-xs text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800'
  return (
    <div ref={ref} role="dialog" aria-label={'Filter ' + heading}
      className="absolute z-[70] w-60 rounded-md border border-slate-200 bg-white p-2 text-xs shadow-xl dark:border-slate-700 dark:bg-slate-900"
      style={{ left, top }}
      onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); onClose() } if (e.key === 'Enter') apply() }}>
      <button type="button" className={button} onClick={() => onSort(false)}>Sort smallest to largest (A → Z)</button>
      <button type="button" className={button} onClick={() => onSort(true)}>Sort largest to smallest (Z → A)</button>
      <div className="my-1.5 border-t border-slate-200 dark:border-slate-700" />
      <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search" aria-label="Search values"
        className="mb-1.5 w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-950" />
      <div className="max-h-56 overflow-y-auto rounded border border-slate-200 py-1 dark:border-slate-700">
        <label className="flex items-center gap-2 px-2 py-0.5 font-semibold text-slate-700 dark:text-slate-200">
          <input type="checkbox" checked={allTicked} onChange={toggleAll} /> {q ? '(Select all matches)' : '(Select all)'}
        </label>
        {listed.map((v) => (
          <label key={v.key} className="flex items-center gap-2 px-2 py-0.5 text-slate-700 dark:text-slate-200">
            <input type="checkbox" checked={shown.has(v.key)} onChange={() => toggle(v.key)} />
            <span className="min-w-0 flex-1 truncate">{v.key}</span>
            <span className="text-[11px] text-slate-400">{v.count}</span>
          </label>
        ))}
        {!listed.length && <p className="px-2 py-1 text-slate-400">No matches.</p>}
      </div>
      <p className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400">Ticked values show; the other rows are hidden, not deleted.</p>
      <div className="mt-2 flex items-center justify-between gap-2">
        <button type="button" onClick={() => onApply([])} disabled={!hidden.length}
          className="rounded px-2 py-1 text-[11px] text-sky-700 hover:underline disabled:opacity-40 dark:text-sky-300">Clear this filter</button>
        <div className="flex gap-1">
          <button type="button" onClick={onClose} className="rounded border border-slate-300 px-2.5 py-1 text-xs dark:border-slate-700">Cancel</button>
          <button type="button" onClick={apply} disabled={!values.some((v) => shown.has(v.key) && (!q || listed.includes(v)))}
            className="rounded bg-sky-600 px-3 py-1 text-xs font-semibold text-white hover:bg-sky-500 disabled:opacity-40">OK</button>
        </div>
      </div>
    </div>
  )
}
