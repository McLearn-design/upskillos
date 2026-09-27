import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, Copy, Search, X } from 'lucide-react'
import { buildSandbox } from '../../utils/simSandbox.js'
import { DEFAULT_SIM_SNIPPET, SIM_SNIPPETS } from './simSnippets.js'

function excerpt(code, range) {
  const [startText, endText] = String(range).split(/[–-]/)
  const start = Number.parseInt(startText, 10)
  const end = Number.parseInt(endText || startText, 10)
  if (!Number.isFinite(start)) return []
  return code.split('\n').slice(start - 1, end).map((line, index) => ({
    number: start + index,
    text: line,
  }))
}

const levelColor = {
  Beginner: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  Intermediate: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
  Advanced: 'text-rose-400 bg-rose-500/10 border-rose-500/20',
}

export default function SnippetLibraryModal({ darkMode, onClose }) {
  const [selected, setSelected] = useState(DEFAULT_SIM_SNIPPET)
  const [query, setQuery] = useState('')
  const [previewReady, setPreviewReady] = useState(false)
  const [copyState, setCopyState] = useState('idle')
  const previewRef = useRef(null)
  const previewSrcdoc = useRef(buildSandbox())
  const closeRef = useRef(null)

  const total = useMemo(
    () => SIM_SNIPPETS.reduce((sum, category) => sum + category.items.length, 0),
    []
  )

  const filteredCategories = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return SIM_SNIPPETS
    return SIM_SNIPPETS.map(category => ({
      ...category,
      items: category.items.filter(item => [
        item.label,
        item.summary,
        item.level,
        item.kind,
        category.category,
        ...(item.concepts || []),
      ].join(' ').toLowerCase().includes(needle)),
    })).filter(category => category.items.length)
  }, [query])

  const selectedCategory = SIM_SNIPPETS.find(category =>
    category.items.some(item => item.key === selected.key)
  )

  useEffect(() => {
    closeRef.current?.focus()
    function onKeyDown(event) {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  useEffect(() => {
    function onMessage({ data, source }) {
      if (source === previewRef.current?.contentWindow && data?.type === 'sim_ready') {
        setPreviewReady(true)
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [])

  useEffect(() => {
    if (!previewReady) return
    const target = previewRef.current?.contentWindow
    target?.postMessage({ type: 'theme', dark: darkMode }, '*')
    target?.postMessage({ type: 'run', code: selected.previewCode, mode: selected.mode }, '*')
  }, [selected, darkMode, previewReady])

  useEffect(() => setCopyState('idle'), [selected])

  async function copySnippet() {
    let copied = false
    try {
      await navigator.clipboard.writeText(selected.code)
      copied = true
    } catch {
      try {
        const textarea = document.createElement('textarea')
        textarea.value = selected.code
        textarea.style.position = 'fixed'
        textarea.style.opacity = '0'
        document.body.appendChild(textarea)
        textarea.select()
        copied = document.execCommand('copy')
        textarea.remove()
      } catch {
        copied = false
      }
    }
    setCopyState(copied ? 'copied' : 'failed')
    window.setTimeout(() => setCopyState('idle'), 1800)
  }

  const surface = darkMode ? 'bg-[#0b1423] border-white/10 text-slate-100' : 'bg-white border-slate-200 text-slate-800'
  const panel = darkMode ? 'bg-[#07101d] border-white/10' : 'bg-slate-50 border-slate-200'
  const muted = darkMode ? 'text-slate-400' : 'text-slate-500'

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 p-3 sm:p-5 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="sim-snippet-title"
      onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}
    >
      <div className={`flex h-full max-h-[94vh] w-full max-w-[1680px] flex-col overflow-hidden rounded-2xl border shadow-2xl ${surface}`}>
        <header className={`flex shrink-0 items-center gap-3 border-b px-4 py-3 sm:px-5 ${darkMode ? 'border-white/10' : 'border-slate-200'}`}>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-violet-400">Simulation learning playground</p>
            <h2 id="sim-snippet-title" className="truncate text-lg font-bold">Explore the code, understand each step, preview it, then copy it</h2>
          </div>
          <div className={`hidden rounded-full border px-3 py-1 text-xs font-semibold sm:block ${darkMode ? 'border-white/10 text-slate-400' : 'border-slate-200 text-slate-500'}`}>
            {total} lessons · {SIM_SNIPPETS.length} topics
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close snippet library"
            className={`rounded-lg p-2 transition-colors ${darkMode ? 'hover:bg-white/10' : 'hover:bg-slate-100'}`}
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="grid min-h-0 flex-1 grid-cols-1 overflow-y-auto lg:grid-cols-[250px_minmax(360px,1.05fr)_minmax(340px,0.95fr)] lg:overflow-hidden">
          <aside className={`max-h-64 border-b lg:max-h-none lg:min-h-0 lg:overflow-y-auto lg:border-b-0 lg:border-r ${panel}`}>
            <div className={`sticky top-0 z-10 border-b p-3 ${darkMode ? 'border-white/10 bg-[#07101d]' : 'border-slate-200 bg-slate-50'}`}>
              <label className={`flex items-center gap-2 rounded-lg border px-2.5 py-2 ${darkMode ? 'border-white/10 bg-slate-900' : 'border-slate-200 bg-white'}`}>
                <Search className={`h-4 w-4 ${muted}`} />
                <input
                  value={query}
                  onChange={event => setQuery(event.target.value)}
                  placeholder="Search lessons…"
                  aria-label="Search simulation lessons"
                  className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-500"
                />
                {query && (
                  <button type="button" onClick={() => setQuery('')} aria-label="Clear lesson search" className={muted}>
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </label>
            </div>

            <nav aria-label="Simulation lesson library" className="p-2.5">
              {filteredCategories.map(category => (
                <section key={category.category} className="mb-4 last:mb-0">
                  <div className="mb-1 flex items-center justify-between px-2">
                    <h3 className={`text-[10px] font-black uppercase tracking-widest ${category.color}`}>{category.category}</h3>
                    <span className={`text-[10px] ${muted}`}>{category.items.length}</span>
                  </div>
                  <div className="space-y-1">
                    {category.items.map(item => (
                      <button
                        key={item.key}
                        type="button"
                        aria-current={selected.key === item.key ? 'true' : undefined}
                        onClick={() => setSelected(item)}
                        className={`w-full rounded-lg border px-2.5 py-2 text-left transition-colors ${
                          selected.key === item.key
                            ? 'border-violet-400/60 bg-violet-600 text-white shadow-sm'
                            : darkMode
                              ? 'border-transparent text-slate-300 hover:border-white/10 hover:bg-white/5'
                              : 'border-transparent text-slate-600 hover:border-slate-200 hover:bg-white'
                        }`}
                      >
                        <span className="block truncate text-xs font-bold">{item.label}</span>
                        <span className={`mt-0.5 block truncate text-[10px] ${selected.key === item.key ? 'text-violet-100' : muted}`}>
                          {item.level} · {item.kind}
                        </span>
                      </button>
                    ))}
                  </div>
                </section>
              ))}
              {!filteredCategories.length && (
                <p className={`px-3 py-8 text-center text-sm ${muted}`}>No lessons match “{query}”.</p>
              )}
            </nav>
          </aside>

          <main className={`border-b p-4 sm:p-6 lg:min-h-0 lg:overflow-y-auto lg:border-b-0 lg:border-r ${darkMode ? 'border-white/10' : 'border-slate-200'}`}>
            <article className="mx-auto max-w-3xl select-text">
              <div className="mb-5">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className={`rounded-full border px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ${levelColor[selected.level] || levelColor.Beginner}`}>{selected.level}</span>
                  <span className="rounded-full bg-violet-500/15 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-violet-400">{selected.kind}</span>
                  <span className={`text-xs ${muted}`}>{selectedCategory?.category} · {selected.mode.toUpperCase()}</span>
                </div>
                <h3 className="text-2xl font-black sm:text-3xl">{selected.label}</h3>
                <p className={`mt-2 text-sm leading-6 ${muted}`}>{selected.summary}</p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {(selected.concepts || []).map(concept => (
                    <span key={concept} className={`rounded-md border px-2 py-1 text-[10px] font-semibold ${darkMode ? 'border-white/10 bg-white/5 text-slate-400' : 'border-slate-200 bg-slate-50 text-slate-500'}`}>{concept}</span>
                  ))}
                </div>
              </div>

              <section className={`mb-5 rounded-xl border p-4 ${panel}`}>
                <h4 className="mb-2 text-xs font-black uppercase tracking-widest text-sky-400">Core idea</h4>
                <ul className={`space-y-2 text-sm leading-6 ${muted}`}>
                  {selected.explanation.map(point => (
                    <li key={point} className="flex gap-2">
                      <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-sky-400" />
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              </section>

              <section className="mb-5">
                <div className="mb-2 flex items-end justify-between gap-3">
                  <div>
                    <h4 className="text-xs font-black uppercase tracking-widest text-fuchsia-400">Code walkthrough</h4>
                    <p className={`mt-1 text-xs ${muted}`}>Read the actual lines, then see what they calculate and why.</p>
                  </div>
                </div>
                <div className="space-y-2.5">
                  {selected.walkthrough.map(step => (
                    <div key={`${step.lines}-${step.title}`} className={`overflow-hidden rounded-xl border ${panel}`}>
                      <div className="p-3.5">
                        <p className="text-[10px] font-black uppercase tracking-widest text-fuchsia-400">Lines {step.lines}</p>
                        <h5 className="mt-1 text-sm font-bold">{step.title}</h5>
                        <p className={`mt-1.5 text-xs leading-5 ${muted}`}>{step.detail}</p>
                      </div>
                      <pre className={`overflow-x-auto border-t p-3 text-[11px] leading-5 ${darkMode ? 'border-white/10 bg-[#02060f] text-slate-300' : 'border-slate-200 bg-slate-950 text-slate-200'}`}>
                        {excerpt(selected.code, step.lines).map(line => (
                          <div key={line.number} className="flex">
                            <span className="mr-3 w-5 shrink-0 select-none text-right text-slate-600">{line.number}</span>
                            <code>{line.text || ' '}</code>
                          </div>
                        ))}
                      </pre>
                    </div>
                  ))}
                </div>
              </section>

              <section className={`overflow-hidden rounded-xl border ${darkMode ? 'border-white/10 bg-[#02060f]' : 'border-slate-200 bg-slate-950'}`}>
                <div className="flex items-center justify-between border-b border-white/10 px-3 py-2">
                  <div>
                    <span className="block text-[10px] font-black uppercase tracking-widest text-slate-400">Copyable JavaScript</span>
                    <span className="block text-[9px] text-slate-600">Paste it where you want in the editor</span>
                  </div>
                  <button
                    type="button"
                    onClick={copySnippet}
                    className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-bold text-white transition-colors ${
                      copyState === 'copied' ? 'bg-emerald-600' : copyState === 'failed' ? 'bg-rose-600' : 'bg-violet-600 hover:bg-violet-500'
                    }`}
                  >
                    {copyState === 'copied' ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    {copyState === 'copied' ? 'Copied' : copyState === 'failed' ? 'Copy failed' : 'Copy code'}
                  </button>
                </div>
                <pre className="max-h-[44vh] overflow-auto p-4 text-[12px] leading-5 text-slate-200"><code>{selected.code}</code></pre>
              </section>
            </article>
          </main>

          <section className={`flex min-h-[360px] flex-col p-4 sm:p-5 lg:min-h-0 ${panel}`}>
            <div className="mb-3 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-emerald-400">Live preview</p>
                <p className={`mt-0.5 text-xs ${muted}`}>A runnable demonstration of the selected lesson</p>
              </div>
              <span className={`rounded-md px-2 py-1 font-mono text-[10px] uppercase ${darkMode ? 'bg-slate-800 text-slate-400' : 'bg-white text-slate-500'}`}>{selected.mode}</span>
            </div>
            <div className={`relative min-h-[300px] flex-1 overflow-hidden rounded-xl border lg:min-h-0 ${darkMode ? 'border-white/10 bg-[#02060f]' : 'border-slate-300 bg-white'}`}>
              {!previewReady && (
                <div className={`absolute inset-0 z-10 flex items-center justify-center text-xs ${muted}`}>Loading preview…</div>
              )}
              <iframe
                ref={previewRef}
                srcDoc={previewSrcdoc.current}
                sandbox="allow-scripts"
                title={`${selected.label} lesson preview`}
                className="h-full w-full border-0"
              />
            </div>
            <p className={`mt-3 text-[10px] leading-4 ${muted}`}>
              The preview runs a complete demonstration. The copy button copies the focused technique so you can place it deliberately in your own file.
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}
