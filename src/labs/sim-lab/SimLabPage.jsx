import { useEffect, useRef, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import Editor from '@monaco-editor/react'
import { setupOpenCalcMonaco } from '../../utils/monacoThemes.js'
import { SIM_TEMPLATES } from './simTemplates.js'
import SnippetLibraryModal from './SnippetLibraryModal.jsx'
import { Play, RotateCcw, ChevronDown, Terminal, Code2, X, Sun, Moon, ArrowLeft } from 'lucide-react'
import { buildSandbox } from '../../utils/simSandbox.js'

// ── Group templates ───────────────────────────────────────────────────────────
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
