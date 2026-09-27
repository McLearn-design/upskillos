import { useEffect, useRef, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import Editor from '@monaco-editor/react'
import { setupOpenCalcMonaco } from '../../utils/monacoThemes.js'
import { SIM_TEMPLATES } from './simTemplates.js'
import { DEFAULT_SIM_SNIPPET, SIM_SNIPPETS as SNIPPET_LIBRARY } from './simSnippets.js'
import { Play, RotateCcw, ChevronDown, Terminal, Code2, X, Sun, Moon, ArrowLeft, Copy, Check } from 'lucide-react'
import { buildSandbox } from '../../utils/simSandbox.js'

// ── Group templates ───────────────────────────────────────────────────────────
function SnippetLibraryModal({ darkMode, onClose }) {
  const [selected, setSelected] = useState(DEFAULT_SIM_SNIPPET)
  const [previewReady, setPreviewReady] = useState(false)
  const [copied, setCopied] = useState(false)
  const previewRef = useRef(null)
  const previewSrcdoc = useRef(buildSandbox())
  const closeRef = useRef(null)

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

  async function copySnippet() {
    try {
      await navigator.clipboard.writeText(selected.code)
    } catch {
      const textarea = document.createElement('textarea')
      textarea.value = selected.code
      textarea.style.position = 'fixed'
      textarea.style.opacity = '0'
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      textarea.remove()
    }
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1600)
  }

  const surface = darkMode ? 'bg-[#0b1423] border-white/10 text-slate-100' : 'bg-white border-slate-200 text-slate-800'
  const panel = darkMode ? 'bg-[#07101d] border-white/10' : 'bg-slate-50 border-slate-200'
  const muted = darkMode ? 'text-slate-400' : 'text-slate-500'

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 p-3 sm:p-6 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="sim-snippet-title"
      onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}
    >
      <div className={`flex h-full max-h-[92vh] w-full max-w-[1500px] flex-col overflow-hidden rounded-2xl border shadow-2xl ${surface}`}>
        <header className={`flex shrink-0 items-center gap-3 border-b px-4 py-3 sm:px-5 ${darkMode ? 'border-white/10' : 'border-slate-200'}`}>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-violet-400">Snippet library</p>
            <h2 id="sim-snippet-title" className="truncate text-lg font-bold">Learn it, preview it, then copy it</h2>
          </div>
          <p className={`hidden max-w-xl text-right text-xs sm:block ${muted}`}>
            Snippets never overwrite the editor. Copy one and paste it exactly where it belongs in your file.
          </p>
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

        <div className={`shrink-0 overflow-x-auto border-b px-4 py-3 ${darkMode ? 'border-white/10 bg-[#08111f]' : 'border-slate-200 bg-slate-50'}`}>
          <div className="flex min-w-max gap-5">
            {SNIPPET_LIBRARY.map(category => (
              <div key={category.category}>
                <p className={`mb-1.5 text-[10px] font-black uppercase tracking-widest ${category.color}`}>{category.category}</p>
                <div className="flex gap-1.5">
                  {category.items.map(snippet => (
                    <button
                      key={snippet.key}
                      type="button"
                      onClick={() => { setSelected(snippet); setCopied(false) }}
                      className={`rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                        selected.key === snippet.key
                          ? 'border-violet-400 bg-violet-600 text-white'
                          : darkMode
                            ? 'border-white/10 bg-slate-800 text-slate-300 hover:bg-slate-700'
                            : 'border-slate-200 bg-white text-slate-600 hover:border-violet-300 hover:text-violet-700'
                      }`}
                    >
                      {snippet.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-1 overflow-y-auto lg:grid-cols-[minmax(0,1.05fr)_minmax(380px,0.95fr)] lg:overflow-hidden">
          <section className={`border-b p-4 sm:p-6 lg:min-h-0 lg:overflow-y-auto lg:border-b-0 lg:border-r ${darkMode ? 'border-white/10' : 'border-slate-200'}`}>
            <div className="mx-auto max-w-3xl select-text">
              <div className="mb-5">
                <div className="mb-1 flex items-center gap-2">
                  <span className="rounded-full bg-violet-500/15 px-2 py-0.5 text-[10px] font-black uppercase tracking-widest text-violet-400">{selected.mode} preview</span>
                  <span className={`text-xs ${muted}`}>{SNIPPET_LIBRARY.find(cat => cat.items.some(item => item.key === selected.key))?.category}</span>
                </div>
                <h3 className="text-2xl font-black">{selected.label}</h3>
                <p className={`mt-2 text-sm leading-6 ${muted}`}>{selected.summary}</p>
              </div>

              <div className={`mb-5 rounded-xl border p-4 ${panel}`}>
                <h4 className="mb-2 text-xs font-black uppercase tracking-widest text-sky-400">How it works</h4>
                <ul className={`space-y-2 text-sm leading-6 ${muted}`}>
                  {selected.explanation.map(point => (
                    <li key={point} className="flex gap-2">
                      <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-sky-400" />
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className={`overflow-hidden rounded-xl border ${darkMode ? 'border-white/10 bg-[#02060f]' : 'border-slate-200 bg-slate-950'}`}>
                <div className="flex items-center justify-between border-b border-white/10 px-3 py-2">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">JavaScript snippet</span>
                  <button
                    type="button"
                    onClick={copySnippet}
                    className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-bold text-white transition-colors ${copied ? 'bg-emerald-600' : 'bg-violet-600 hover:bg-violet-500'}`}
                  >
                    {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    {copied ? 'Copied' : 'Copy code'}
                  </button>
                </div>
                <pre className="max-h-[38vh] overflow-auto p-4 text-[12px] leading-5 text-slate-200"><code>{selected.code}</code></pre>
              </div>
            </div>
          </section>

          <section className={`flex min-h-[340px] flex-col p-4 sm:p-5 ${panel}`}>
            <div className="mb-3 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-emerald-400">Live preview</p>
                <p className={`mt-0.5 text-xs ${muted}`}>A runnable demonstration of the selected fragment</p>
              </div>
              <span className={`rounded-md px-2 py-1 font-mono text-[10px] uppercase ${darkMode ? 'bg-slate-800 text-slate-400' : 'bg-white text-slate-500'}`}>{selected.mode}</span>
            </div>
            <div className={`relative min-h-0 flex-1 overflow-hidden rounded-xl border ${darkMode ? 'border-white/10 bg-[#02060f]' : 'border-slate-300 bg-white'}`}>
              {!previewReady && (
                <div className={`absolute inset-0 z-10 flex items-center justify-center text-xs ${muted}`}>Loading preview…</div>
              )}
              <iframe
                ref={previewRef}
                srcDoc={previewSrcdoc.current}
                sandbox="allow-scripts"
                title={`${selected.label} snippet preview`}
                className="h-full w-full border-0"
              />
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}

const GROUPS = ['Starter', 'Applied', 'Physics']

// ── Component ─────────────────────────────────────────────────────────────────
export default function SimLabPage() {
  const navigate = useNavigate()
  const [code, setCode]               = useState(SIM_TEMPLATES[0].code)
  const [template, setTemplate]       = useState(SIM_TEMPLATES[0].key)
  const [logs, setLogs]               = useState([])
  const [consoleOpen, setConsoleOpen] = useState(false)
  const [snippetOpen, setSnippetOpen] = useState(false)
  const [templateOpen, setTemplateOpen] = useState(false)
  const [ready, setReady]             = useState(false)
  const [darkMode, setDarkMode]       = useState(true)

  const iframeRef  = useRef(null)
  const logsEndRef = useRef(null)
  const srcdoc     = useRef(buildSandbox())

  useEffect(() => {
    document.title = 'Sim Lab — UpSkillOS'
    return () => { document.title = 'UpSkillOS' }
  }, [])

  // Forward messages from sandbox
  useEffect(() => {
    function onMsg({ data, source }) {
      if (!iframeRef.current || source !== iframeRef.current.contentWindow) return
      if (data?.type === 'sim_ready') setReady(true)
      if (data?.type === 'log') {
        const color = data.level === 'error' ? '#ff6b6b' : data.level === 'warn' ? '#fbbf24' : '#a3e635'
        setLogs(prev => [...prev.slice(-199), { text: data.args.join(' '), color }])
      }
      if (data?.type === 'error') {
        setLogs(prev => [...prev.slice(-199), { text: data.message, color: '#ff6b6b' }])
        setConsoleOpen(true)
      }
    }
    window.addEventListener('message', onMsg)
    return () => window.removeEventListener('message', onMsg)
  }, [])

  // Sync theme to sandbox
  useEffect(() => {
    iframeRef.current?.contentWindow?.postMessage({ type: 'theme', dark: darkMode }, '*')
  }, [darkMode, ready])

  // Auto-scroll console
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs])

  const activeTpl = SIM_TEMPLATES.find(t => t.key === template) ?? SIM_TEMPLATES[0]

  const run = useCallback(() => {
    iframeRef.current?.contentWindow?.postMessage(
      { type: 'run', code, mode: activeTpl.mode || '3d' }, '*'
    )
  }, [code, activeTpl])

  const reset = useCallback(() => {
    iframeRef.current?.contentWindow?.postMessage({ type: 'reset' }, '*')
  }, [])

  function pickTemplate(key) {
    const t = SIM_TEMPLATES.find(t => t.key === key)
    if (!t) return
    setTemplate(key)
    setCode(t.code)
    setTemplateOpen(false)
    setTimeout(() => {
      iframeRef.current?.contentWindow?.postMessage(
        { type: 'run', code: t.code, mode: t.mode || '3d' }, '*'
      )
    }, 50)
  }

  // Colours vary by dark/light mode
  const bg       = darkMode ? 'bg-[#08111f]'    : 'bg-[#f0f4f8]'
  const headerBg = darkMode ? 'bg-[#0d1626]'    : 'bg-[#e0e8f0]'
  const border   = darkMode ? 'border-white/5'  : 'border-black/8'
  const text     = darkMode ? 'text-slate-200'  : 'text-slate-700'
  const muted    = darkMode ? 'text-slate-500'  : 'text-slate-400'
  const btnBase  = darkMode ? 'bg-slate-800 hover:bg-slate-700' : 'bg-white hover:bg-slate-100 border border-slate-300'

  return (
    <div className={`flex flex-col h-screen ${bg} ${text} overflow-hidden select-none`}>

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className={`flex items-center gap-2 px-3 py-2 ${headerBg} border-b ${border} shrink-0 flex-wrap`}>

        {/* Back to Labs */}
        <button
          onClick={() => navigate('/')}
          className={`flex items-center gap-1 px-2 py-1.5 rounded-md text-xs font-semibold transition-colors ${btnBase} ${muted} hover:${text}`}
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Labs
        </button>

        <div className={`w-px h-5 ${darkMode ? 'bg-white/10' : 'bg-black/10'} mx-0.5`} />

        <span className={`text-sm font-black tracking-wider ${darkMode ? 'text-slate-200' : 'text-slate-700'}`}>SIM LAB</span>

        {/* Mode badge */}
        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest ${
          activeTpl.mode === '2d'
            ? 'bg-emerald-900/50 text-emerald-300'
            : 'bg-sky-900/50 text-sky-300'
        }`}>
          {activeTpl.mode ?? '3d'}
        </span>

        {/* Template picker */}
        <div className="relative">
          <button
            onClick={() => setTemplateOpen(o => !o)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md ${btnBase} text-xs font-semibold transition-colors`}
          >
            <span>{activeTpl.icon}</span>
            <span>{activeTpl.label}</span>
            <ChevronDown className="h-3 w-3 opacity-50" />
          </button>
          {templateOpen && (
            <div className={`absolute top-full left-0 mt-1 w-64 ${darkMode ? 'bg-[#0d1626] border-white/10' : 'bg-white border-black/10'} border rounded-lg shadow-2xl z-50 py-1 overflow-y-auto max-h-80`}>
              {GROUPS.map(grp => {
                const items = SIM_TEMPLATES.filter(t => t.group === grp)
                return (
                  <div key={grp}>
                    <div className={`px-3 pt-2 pb-0.5 text-[10px] font-black uppercase tracking-widest ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>{grp}</div>
                    {items.map(t => (
                      <button
                        key={t.key}
                        onClick={() => pickTemplate(t.key)}
                        className={`w-full text-left px-3 py-2 text-xs transition-colors flex items-start gap-2 ${
                          t.key === template
                            ? darkMode ? 'text-sky-400 bg-sky-900/20' : 'text-sky-600 bg-sky-50'
                            : darkMode ? 'text-slate-300 hover:bg-white/5' : 'text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <span className="mt-0.5">{t.icon}</span>
                        <span>
                          <span className="font-semibold block">{t.label}</span>
                          <span className={`${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>{t.desc}</span>
                        </span>
                      </button>
                    ))}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Run */}
        <button
          onClick={run}
          disabled={!ready}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-sky-600 hover:bg-sky-500 disabled:opacity-40 text-xs font-bold text-white transition-colors"
        >
          <Play className="h-3.5 w-3.5" />
          Run
        </button>

        {/* Reset */}
        <button
          onClick={reset}
          className={`flex items-center gap-1.5 px-2 py-1.5 rounded-md ${btnBase} text-xs font-semibold transition-colors`}
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Reset
        </button>

        {/* Snippets */}
        <button
          onClick={() => setSnippetOpen(o => !o)}
          className={`flex items-center gap-1.5 px-2 py-1.5 rounded-md text-xs font-semibold transition-colors ${
            snippetOpen
              ? 'bg-violet-700 text-white'
              : `${btnBase} ${darkMode ? 'text-slate-200' : 'text-slate-600'}`
          }`}
        >
          <Code2 className="h-3.5 w-3.5" />
          Snippets
        </button>

        <div className="flex-1" />

        {/* Dark / light toggle */}
        <button
          onClick={() => setDarkMode(d => !d)}
          className={`p-1.5 rounded-md ${btnBase} transition-colors`}
          title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {darkMode
            ? <Sun className="h-4 w-4 text-amber-400" />
            : <Moon className="h-4 w-4 text-slate-500" />}
        </button>

        {/* Console toggle */}
        <button
          onClick={() => setConsoleOpen(o => !o)}
          className={`flex items-center gap-1.5 px-2 py-1.5 rounded-md text-xs font-semibold transition-colors ${
            consoleOpen
              ? darkMode ? 'bg-slate-600 text-white' : 'bg-slate-200 text-slate-700'
              : `${btnBase} ${muted}`
          }`}
        >
          <Terminal className="h-3.5 w-3.5" />
          Console
          {logs.length > 0 && (
            <span className="ml-1 rounded-full bg-sky-600 text-white text-[10px] w-4 h-4 flex items-center justify-center font-bold">
              {logs.length > 9 ? '9+' : logs.length}
            </span>
          )}
        </button>
      </div>

      {snippetOpen && <SnippetLibraryModal darkMode={darkMode} onClose={() => setSnippetOpen(false)} />}

      {/* ── Main split ─────────────────────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0">

        {/* Editor + console */}
        <div className={`flex flex-col w-1/2 border-r ${border} min-h-0`}>
          <div className="flex-1 min-h-0">
            <Editor
              height="100%"
              language="javascript"
              value={code}
              onChange={v => setCode(v ?? '')}
              theme={darkMode ? 'open-calc-dark' : 'open-calc-light'}
              beforeMount={setupOpenCalcMonaco}
              options={{
                fontSize: 13,
                lineHeight: 20,
                fontFamily: '"Fira Code", "JetBrains Mono", monospace',
                fontLigatures: true,
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                padding: { top: 12, bottom: 12 },
                tabSize: 2,
                wordWrap: 'on',
                renderLineHighlight: 'gutter',
                smoothScrolling: true,
              }}
            />
          </div>

          {/* Console panel */}
          {consoleOpen && (
            <div className={`h-40 shrink-0 border-t ${border} flex flex-col ${darkMode ? 'bg-[#040c14]' : 'bg-[#f8fafc]'}`}>
              <div className={`flex items-center justify-between px-3 py-1 border-b ${border}`}>
                <span className={`text-[10px] font-black uppercase tracking-widest ${muted}`}>Console</span>
                <div className="flex gap-2">
                  <button onClick={() => setLogs([])} className={`text-[10px] ${muted} hover:${text}`}>Clear</button>
                  <button onClick={() => setConsoleOpen(false)}><X className={`h-3 w-3 ${muted} hover:${text}`} /></button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto px-3 py-1 font-mono text-[11px] space-y-0.5">
                {logs.length === 0
                  ? <span className={muted}>No output yet — run a simulation to see logs.</span>
                  : logs.map((l, i) => <div key={i} style={{ color: l.color }}>{l.text}</div>)
                }
                <div ref={logsEndRef} />
              </div>
            </div>
          )}
        </div>

        {/* Sandbox iframe */}
        <div className={`flex-1 ${darkMode ? 'bg-[#02060f]' : 'bg-[#e8f0f8]'} relative`}>
          {!ready && (
            <div className="absolute inset-0 flex items-center justify-center z-10">
              <div className={`text-xs ${muted} animate-pulse`}>Loading Three.js engine…</div>
            </div>
          )}
          <iframe
            ref={iframeRef}
            srcDoc={srcdoc.current}
            sandbox="allow-scripts"
            className="w-full h-full border-0"
            title="Simulation sandbox"
          />
        </div>
      </div>
    </div>
  )
}
