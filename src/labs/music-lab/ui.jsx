// Small UI primitives shared by the Music Lab rooms.
import { useState } from 'react'
import Katex from '../../components/concept-explorer/Katex.jsx'
import { useMusic } from './model.jsx'

export function Panel({ title, right, children, className = '' }) {
  return (
    <section className={`rounded-xl border border-zinc-800 bg-zinc-900/70 p-4 ${className}`}>
      {(title || right) && (
        <div className="mb-3 flex items-center justify-between gap-2">
          {title && <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">{title}</h3>}
          {right}
        </div>
      )}
      {children}
    </section>
  )
}

export function Btn({ children, onClick, active = false, tone = 'default', className = '', ...rest }) {
  const tones = {
    default: active ? 'bg-violet-500 text-white border-violet-400' : 'bg-zinc-800 text-zinc-200 border-zinc-700 hover:bg-zinc-700',
    play: 'bg-emerald-600 text-white border-emerald-500 hover:bg-emerald-500',
    stop: 'bg-rose-600 text-white border-rose-500 hover:bg-rose-500',
    ghost: 'bg-transparent text-zinc-300 border-zinc-700 hover:bg-zinc-800',
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-40 ${tones[tone]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  )
}

export function Seg({ options, value, onChange, size = 'sm' }) {
  return (
    <div className="inline-flex flex-wrap overflow-hidden rounded-lg border border-zinc-700">
      {options.map((o) => {
        const v = typeof o === 'object' ? o.value : o
        const label = typeof o === 'object' ? o.label : o
        return (
          <button
            key={String(v)}
            type="button"
            onClick={() => onChange(v)}
            className={`px-2.5 ${size === 'xs' ? 'py-0.5 text-xs' : 'py-1 text-sm'} ${v === value ? 'bg-violet-500 text-white' : 'bg-zinc-900 text-zinc-300 hover:bg-zinc-800'}`}
          >
            {label}
          </button>
        )
      })}
    </div>
  )
}

export function Slider({ label, value, min, max, step = 1, onChange, format = (v) => v, log = false }) {
  // Log sliders map position → value exponentially, which is how pitch is heard.
  const toPos = (v) => (log ? Math.log(v / min) / Math.log(max / min) : (v - min) / (max - min))
  const fromPos = (p) => (log ? min * Math.pow(max / min, p) : min + p * (max - min))
  return (
    <label className="block text-sm">
      <div className="mb-1 flex justify-between text-zinc-400">
        <span>{label}</span>
        <span className="font-mono text-zinc-100">{format(value)}</span>
      </div>
      <input
        type="range"
        className="w-full accent-violet-500"
        min={0}
        max={1000}
        value={Math.round(toPos(value) * 1000)}
        onChange={(e) => {
          let v = fromPos(Number(e.target.value) / 1000)
          if (!log) v = Math.round(v / step) * step
          onChange(v)
        }}
      />
    </label>
  )
}

export function Stat({ label, value, sub, accent = 'text-zinc-100' }) {
  return (
    <div className="rounded-lg bg-zinc-950/60 px-3 py-2">
      <div className="text-[11px] uppercase tracking-wider text-zinc-500">{label}</div>
      <div className={`font-mono text-lg ${accent}`}>{value}</div>
      {sub && <div className="text-xs text-zinc-500">{sub}</div>}
    </div>
  )
}

/** Shown only in "Music + Math" mode. */
export function MathOnly({ children }) {
  const { model } = useMusic()
  return model.mathMode ? children : null
}

export function Tex({ children, display = false }) {
  return <Katex latex={children} display={display} />
}

/** The "Explain this" drawer: explains whatever is currently on screen. */
export function Explain({ children, title = 'Explain this' }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="rounded-xl border border-amber-500/30 bg-amber-500/5">
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between px-4 py-2 text-left text-sm font-semibold text-amber-300">
        <span>💡 {title}</span>
        <span>{open ? '−' : '+'}</span>
      </button>
      {open && <div className="space-y-2 px-4 pb-4 text-sm leading-relaxed text-zinc-300">{children}</div>}
    </div>
  )
}

/** A small check-yourself task. `check(input)` returns true when solved. */
export function Challenge({ id, prompt, placeholder = 'Your answer', check, hint, onSolved }) {
  const [value, setValue] = useState('')
  const [state, setState] = useState(null)
  const submit = (e) => {
    e.preventDefault()
    const ok = check(value.trim())
    setState(ok ? 'right' : 'wrong')
    if (ok) onSolved?.(id)
  }
  return (
    <form onSubmit={submit} className="rounded-xl border border-sky-500/30 bg-sky-500/5 p-3 text-sm">
      <div className="mb-2 font-semibold text-sky-300">🎯 Challenge</div>
      <div className="mb-2 text-zinc-300">{prompt}</div>
      <div className="flex gap-2">
        <input value={value} onChange={(e) => { setValue(e.target.value); setState(null) }} placeholder={placeholder}
          className="min-w-0 flex-1 rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1 font-mono text-zinc-100" />
        <Btn tone="ghost" type="submit">Check</Btn>
      </div>
      {state === 'right' && <div className="mt-2 text-emerald-400">✓ Correct.</div>}
      {state === 'wrong' && <div className="mt-2 text-rose-400">Not quite.{hint ? ` Hint: ${hint}` : ''}</div>}
    </form>
  )
}

export const fmtHz = (f) => `${f >= 1000 ? f.toFixed(1) : f.toFixed(2)} Hz`
export const fmtCents = (c) => `${c >= 0 ? '+' : ''}${c.toFixed(1)}¢`
