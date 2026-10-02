import { useEffect, useMemo, useState } from 'react'
import MarkdownProse from '../../components/math/MarkdownProse.jsx'
import Explore from './Explore.jsx'
import Practice from './Practice.jsx'
import { LESSONS, PARTS } from './lessons.js'
import { GLOBALS } from './runtime.js'
import { DATASET_INFO } from './data.js'
import './wds.css'

const STORE = 'upskillos.web-data-science.v1'
function readStore() {
  try { return JSON.parse(localStorage.getItem(STORE)) || {} } catch { return {} }
}
function writeStore(state) {
  try { localStorage.setItem(STORE, JSON.stringify(state)) } catch { /* private mode: progress lasts this visit */ }
}

function Card({ title, tone = 'slate', children }) {
  const tones = {
    slate: 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900/60',
    violet: 'border-violet-200 bg-violet-50 dark:border-violet-900 dark:bg-violet-950/30',
  }
  return (
    <section className={'rounded-lg border p-4 sm:p-5 ' + tones[tone]}>
      {title && <h2 className="mb-2 text-lg font-semibold text-slate-900 dark:text-slate-100">{title}</h2>}
      {children}
    </section>
  )
}

function Reference({ onClose }) {
  return (
    <div className="space-y-4 text-sm text-slate-700 dark:text-slate-300">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">What your code can use</h2>
        <button type="button" onClick={onClose} className="rounded px-2 py-1 hover:bg-slate-200 dark:hover:bg-slate-800">Close</button>
      </div>
      <p>Your code runs as the body of an <code>async</code> function, so <code>await</code> works and <code>return</code> ends it. These names are already defined:</p>
      <dl className="grid grid-cols-[minmax(8rem,max-content)_1fr] gap-x-4 gap-y-1">
        {GLOBALS.map(([name, text]) => (
          <div key={name} className="contents"><dt className="font-mono text-sky-700 dark:text-sky-300">{name}</dt><dd>{text}</dd></div>
        ))}
      </dl>
      <h3 className="font-semibold text-slate-900 dark:text-slate-100">Datasets</h3>
      <p>All synthetic: generated from a fixed seed so everyone sees the same rows. Use <code>load(&quot;name&quot;)</code>.</p>
      <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1">
        {Object.entries(DATASET_INFO).map(([name, text]) => (
          <div key={name} className="contents"><dt className="font-mono text-sky-700 dark:text-sky-300">{name}</dt><dd>{text}</dd></div>
        ))}
      </dl>
      <p className="text-xs text-slate-500">Code runs in this page. An endless loop freezes the tab; reload to recover (your drafts are saved).</p>
    </div>
  )
}

export default function WebDataScienceLab() {
  const [store, setStore] = useState(readStore)
  const [showRef, setShowRef] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const current = useMemo(() => LESSONS.find((l) => l.id === store.current) ?? LESSONS[0], [store.current])
  const done = store.done ?? {}
  const drafts = store.drafts ?? {}
  const index = LESSONS.indexOf(current)

  useEffect(() => { writeStore(store) }, [store])
  useEffect(() => {
    document.title = current.title + ' · Data Science on the Web'
    return () => { document.title = 'UpSkillOS' }
  }, [current])

  const go = (lesson) => {
    setStore((s) => ({ ...s, current: lesson.id }))
    setMenuOpen(false)
    document.getElementById('wds-main')?.scrollTo({ top: 0 })
  }
  const setDraft = (code) => setStore((s) => ({ ...s, drafts: { ...s.drafts, [current.id]: code } }))
  const markDone = () => setStore((s) => ({ ...s, done: { ...s.done, [current.id]: true } }))
  const doneCount = LESSONS.filter((l) => done[l.id]).length

  return (
    <div className="wds-lab fixed inset-0 flex bg-slate-100 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <nav aria-label="Lessons" className={'wds-nav ' + (menuOpen ? 'is-open ' : '') + 'absolute inset-y-0 left-0 z-20 w-72 shrink-0 flex-col border-r border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900'}>
        <div className="border-b border-slate-200 p-4 dark:border-slate-800">
          <div className="text-xl font-bold">📈 Data Science on the Web</div>
          <div className="mt-1 text-xs text-slate-500">{doneCount} of {LESSONS.length} tasks done</div>
          <div className="mt-2 h-1.5 overflow-hidden rounded bg-slate-200 dark:bg-slate-800">
            <div className="h-full bg-sky-500" style={{ width: (100 * doneCount) / LESSONS.length + '%' }} />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {PARTS.map((part) => (
            <div key={part.title} className="mb-3">
              <div className="px-2 py-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{part.title}</div>
              {part.lessons.map((l) => (
                <button key={l.id} type="button" onClick={() => go(l)} aria-current={l.id === current.id ? 'page' : undefined}
                  className={'flex w-full items-start gap-2 rounded px-2 py-1.5 text-left text-sm ' + (l.id === current.id ? 'bg-sky-100 text-sky-900 dark:bg-sky-900/40 dark:text-sky-100' : 'hover:bg-slate-100 dark:hover:bg-slate-800')}>
                  <span className="w-6 shrink-0 text-right font-mono text-xs leading-5 text-slate-400">{String(l.number).padStart(2, '0')}</span>
                  <span className="flex-1">{l.title}</span>
                  {done[l.id] && <span className="text-emerald-600 dark:text-emerald-400" aria-label="done">✓</span>}
                </button>
              ))}
            </div>
          ))}
        </div>
        <button type="button" onClick={() => setShowRef(true)} className="m-2 rounded border border-slate-300 px-3 py-2 text-sm hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800">
          Reference: libraries, helpers, datasets
        </button>
      </nav>

      <main id="wds-main" className="flex-1 overflow-y-auto">
        <div className="wds-menubar sticky top-0 z-10 flex items-center gap-2 border-b border-slate-200 bg-slate-100/90 px-4 py-2 backdrop-blur dark:border-slate-800 dark:bg-slate-950/90">
          <button type="button" onClick={() => setMenuOpen((o) => !o)} className="rounded border border-slate-300 px-2 py-1 text-sm dark:border-slate-700">☰ Lessons</button>
          <span className="truncate text-sm">{current.title}</span>
        </div>
        <article key={current.id} className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6 lg:p-8">
          <header>
            <div className="text-sm text-slate-500">{current.part} · Lesson {current.number}</div>
            <h1 className="mt-1 text-3xl font-bold tracking-tight">{current.title}</h1>
            {current.summary && <p className="mt-2 max-w-3xl text-slate-600 dark:text-slate-400">{current.summary}</p>}
            {current.js && (
              <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-900 dark:bg-amber-900/30 dark:text-amber-200">
                JavaScript in this lesson: {current.js}
              </p>
            )}
          </header>

          {current.explore && <Explore lesson={current} />}

          <Card title="Understand"><MarkdownProse text={current.learn} className="wds-prose" /></Card>

          {current.javascript && (
            <Card title={'JavaScript: ' + (current.js || 'the technique')}><MarkdownProse text={current.javascript} className="wds-prose" /></Card>
          )}

          {current.maths && (
            <details className="group rounded-lg border border-violet-200 bg-violet-50 p-4 sm:p-5 dark:border-violet-900 dark:bg-violet-950/30">
              <summary className="cursor-pointer select-none text-lg font-semibold text-violet-900 dark:text-violet-200">
                The maths <span className="ml-2 rounded bg-violet-200 px-2 py-0.5 text-xs font-medium uppercase tracking-wide dark:bg-violet-900">optional</span>
              </summary>
              <div className="mt-3"><MarkdownProse text={current.maths} className="wds-prose" /></div>
            </details>
          )}

          <Practice key={current.id} lesson={current} draft={drafts[current.id]} onDraft={setDraft} done={!!done[current.id]} onDone={markDone} />

          <nav aria-label="Lesson navigation" className="flex justify-between border-t border-slate-200 pt-4 dark:border-slate-800">
            {index > 0 ? <button type="button" onClick={() => go(LESSONS[index - 1])} className="text-sky-700 hover:underline dark:text-sky-300">← {LESSONS[index - 1].title}</button> : <span />}
            {index < LESSONS.length - 1 && <button type="button" onClick={() => go(LESSONS[index + 1])} className="text-sky-700 hover:underline dark:text-sky-300">{LESSONS[index + 1].title} →</button>}
          </nav>
        </article>
      </main>

      {showRef && (
        <div className="absolute inset-0 z-30 flex justify-end bg-black/40" onClick={() => setShowRef(false)}>
          <aside className="h-full w-full max-w-lg overflow-y-auto bg-white p-5 shadow-xl dark:bg-slate-900" onClick={(e) => e.stopPropagation()}>
            <Reference onClose={() => setShowRef(false)} />
          </aside>
        </div>
      )}
    </div>
  )
}
