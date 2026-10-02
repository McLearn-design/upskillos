import { useState } from 'react'
import { Output } from './Output.jsx'
import StaticCodeBlock from '../../components/markdown/StaticCodeBlock.jsx'

const initialParams = (controls) => Object.fromEntries(controls.map((c) => [c.name, c.value]))

// The figure at the top of each lesson: play with the sliders first, read
// why it behaves that way after. Its source is one click away, because it is
// the same kind of code the learner writes below.
export default function Explore({ lesson }) {
  const [params, setParams] = useState(() => initialParams(lesson.controls))
  const [showCode, setShowCode] = useState(false)
  const set = (name, value) => setParams((p) => ({ ...p, [name]: value }))

  return (
    <section aria-labelledby="wds-explore" className="space-y-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="wds-explore" className="text-lg font-semibold text-slate-900 dark:text-slate-100">Explore</h2>
        <button type="button" onClick={() => setShowCode((s) => !s)} className="text-sm text-sky-700 hover:underline dark:text-sky-300">
          {showCode ? 'Hide how it is built' : 'How is this built?'}
        </button>
      </div>
      {lesson.controls.length > 0 && (
        <div className="wds-controls">
          {lesson.controls.map((c) => (
            <label key={c.name} className="flex items-center gap-3 text-sm text-slate-700 dark:text-slate-300">
              <span className="w-36 shrink-0">{c.label}</span>
              {c.options ? (
                <select value={params[c.name]} onChange={(e) => set(c.name, e.target.value)}
                  className="flex-1 rounded border border-slate-300 bg-white px-2 py-1 dark:border-slate-600 dark:bg-slate-900">
                  {c.options.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              ) : (
                <>
                  <input type="range" min={c.min} max={c.max} step={c.step ?? 1} value={params[c.name]}
                    onChange={(e) => set(c.name, Number(e.target.value))} className="min-w-0 flex-1 accent-sky-600" />
                  <output className="w-12 shrink-0 text-right font-mono tabular-nums">{params[c.name]}</output>
                </>
              )}
            </label>
          ))}
        </div>
      )}
      <Output code={lesson.explore} params={params} height={lesson.height} label={'Interactive figure: ' + lesson.title} />
      {showCode && <StaticCodeBlock code={lesson.explore} language="javascript" />}
    </section>
  )
}
