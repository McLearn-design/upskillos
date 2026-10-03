// The settings of the selected chart, in the inspector: its type (with when
// to use each), the cells it draws, titles and the extras for each type.
import { useEffect, useMemo, useState } from 'react'
import { CHART_TYPES, chartAdvice, linearFit, readSeries } from '../engine/chart.js'
import { formatRange, parseRange } from '../engine/address.js'
import { MAX_SERIES, formatNumber } from './ChartView.jsx'

function Field({ label, children, hint }) {
  return (
    <label className="block text-xs">
      <span className="mb-0.5 block text-slate-500 dark:text-slate-400">{label}</span>
      {children}
      {hint && <span className="mt-0.5 block text-[11px] text-slate-400">{hint}</span>}
    </label>
  )
}

const inputClass = 'w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100'

// A text box that saves when it loses focus or Enter is pressed, so typing a
// title does not add an undo step per letter.
function LazyInput({ value, onCommit, ...rest }) {
  const [draft, setDraft] = useState(value ?? '')
  useEffect(() => setDraft(value ?? ''), [value])
  const commit = () => { if (draft !== (value ?? '')) onCommit(draft) }
  return <input {...rest} value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={commit} onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') setDraft(value ?? '') }} className={inputClass} />
}

export default function ChartPanel({ chart, values, onChange, onDelete }) {
  const data = useMemo(() => readSeries(values ?? [], chart.type), [values, chart.type])
  const advice = values ? chartAdvice(chart.type, data, MAX_SERIES) : ['"' + chart.source + '" is not a range of cells any more (its rows or columns were deleted). Type a new range below.']
  const [rangeProblem, setRangeProblem] = useState(null)
  const set = (patch) => onChange(patch)
  const fits = chart.trendline && (chart.type === 'scatter' || chart.type === 'line')
    ? data.series.slice(0, MAX_SERIES).map((s) => [s.name, linearFit(chart.type === 'scatter' ? data.categories : s.values.map((_, i) => i), s.values)]).filter(([, f]) => f)
    : []

  return (
    <div className="space-y-4 px-4 py-3">
      <section>
        <h3 className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Chart type</h3>
        <div className="grid grid-cols-3 gap-1" role="radiogroup" aria-label="Chart type">
          {Object.entries(CHART_TYPES).map(([id, t]) => (
            <button key={id} type="button" role="radio" aria-checked={chart.type === id} onClick={() => set({ type: id })}
              className={'rounded-md border px-2 py-1.5 text-xs ' + (chart.type === id ? 'border-sky-600 bg-sky-50 font-semibold text-sky-800 dark:border-sky-400 dark:bg-sky-900/40 dark:text-sky-100' : 'border-slate-200 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-900')}>
              {t.label}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-slate-600 dark:text-slate-300"><b>{CHART_TYPES[chart.type].label}:</b> {CHART_TYPES[chart.type].when}</p>
        {advice.length > 0 && (
          <ul className="mt-2 space-y-1 text-xs text-slate-600 dark:text-slate-300">
            {advice.map((a) => <li key={a} className="border-l-2 border-amber-400 pl-2">{a}</li>)}
          </ul>
        )}
      </section>

      <section className="space-y-2">
        <Field label="Data" hint={rangeProblem ?? 'A first row of text names the series; a first column of text labels the categories.'}>
          <LazyInput value={chart.source} aria-label="Chart data range" onCommit={(text) => {
            const r = parseRange(text.trim().toUpperCase().replace(/\$/g, ''))
            if (!r || r.r2 === Infinity || r.c2 === Infinity) { setRangeProblem('"' + text + '" is not a range. Write it like A1:C10.'); return }
            setRangeProblem(null)
            set({ source: formatRange(r) })
          }} />
        </Field>
        <Field label="Title">
          <LazyInput value={chart.title ?? ''} placeholder={data.series.length === 1 && chart.type !== 'histogram' ? data.series[0].name : 'No title'} aria-label="Chart title" onCommit={(t) => set({ title: t || undefined })} />
        </Field>
        {chart.type !== 'pie' && (
          <div className="grid grid-cols-2 gap-2">
            <Field label={chart.type === 'bar' ? 'Value axis title' : 'Horizontal axis title'}>
              <LazyInput value={chart.xTitle ?? ''} aria-label="Horizontal axis title" onCommit={(t) => set({ xTitle: t || undefined })} />
            </Field>
            <Field label={chart.type === 'bar' ? 'Category axis title' : 'Vertical axis title'}>
              <LazyInput value={chart.yTitle ?? ''} aria-label="Vertical axis title" onCommit={(t) => set({ yTitle: t || undefined })} />
            </Field>
          </div>
        )}
      </section>

      {(chart.type === 'scatter' || chart.type === 'line') && (
        <section>
          <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-200">
            <input type="checkbox" checked={!!chart.trendline} onChange={(e) => set({ trendline: e.target.checked || undefined })} />
            Best-fit line (linear trendline)
          </label>
          {fits.map(([name, f]) => (
            <p key={name} className="mt-1.5 text-xs text-slate-600 dark:text-slate-300">
              <b>{name}:</b> <span className="font-mono">y = {formatNumber(f.slope)}·{chart.type === 'scatter' ? 'x' : 'n'} {f.intercept < 0 ? '−' : '+'} {formatNumber(Math.abs(f.intercept))}</span>, R² = {f.r2.toFixed(3)}
            </p>
          ))}
          {chart.trendline && (
            <p className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400">
              The line is the one that makes the squared vertical distances to the points as small as possible (least squares). R² is the share of the ups and downs in y that the line explains: 1 is a perfect fit, 0 is none.
              {chart.type === 'line' && ' On a line chart, n counts the points 0, 1, 2…'} The same numbers come from =SLOPE, =INTERCEPT and =RSQ.
            </p>
          )}
        </section>
      )}

      {chart.type === 'histogram' && (
        <section>
          <Field label="Number of bins" hint="Blank chooses a width by Scott's rule, as Excel does. Too few bins hide the shape; too many make it noisy.">
            <LazyInput value={chart.bins ? String(chart.bins) : ''} placeholder="Automatic" inputMode="numeric" aria-label="Number of bins"
              onCommit={(t) => { const n = Math.round(Number(t)); set({ bins: t.trim() && n >= 1 && n <= 200 ? n : undefined }) }} />
          </Field>
        </section>
      )}

      <section className="flex items-center justify-between border-t border-slate-200 pt-3 dark:border-slate-800">
        <span className="text-[11px] text-slate-400">Drag the chart to move it; drag its corner to resize. It redraws when the cells change.</span>
        <button type="button" onClick={onDelete} className="ml-2 shrink-0 rounded-md border border-red-300 px-2.5 py-1 text-[11px] text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-950">Delete chart</button>
      </section>
    </div>
  )
}
