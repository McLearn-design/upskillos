// The Code panel of the art labs: GUI → code, as in Game Studio. Every edit appears here as the line of code
// that makes it (Tile Mapper's mapApi.js, Sprite Forge's spriteApi.js); running them all on the document
// the session started from makes the one on screen. Code typed below runs the same way, as one edit (one
// undo step).
//
//   run         (doc, code) => doc: the lab's code runner
//   placeholder what to suggest in the box; help: the API, for its tooltip; testid: a prefix for tests
import { useEffect, useState } from 'react'

export default function CodePanel({ log, start, onRun, onClose, run: runCode, placeholder, help, testid }) {
  const [text, setText] = useState('')
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  // An old error is about code that is no longer the latest: clear it when the log changes.
  useEffect(() => setError(''), [log])
  const all = [`// ${start}`, ...log.map((e) => e.code)].join('\n')
  const run = () => {
    setError('')
    const code = text.trim()
    if (!code) return
    const err = onRun({ label: 'Run code', code, run: (d) => runCode(d, code) })
    if (err) setError(err)
    else setText('')
  }
  return (
    <div data-testid={testid} className="flex h-56 shrink-0 flex-col border-t border-slate-200 bg-slate-50 font-mono text-[11px] dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center gap-2 border-b border-slate-200 px-3 py-1 font-sans text-xs dark:border-slate-800">
        <b className="text-slate-700 dark:text-slate-200">GUI → code</b>
        <span className="text-slate-400">each edit as the line that makes it · {log.length} line{log.length === 1 ? '' : 's'}</span>
        <span className="flex-1" />
        <button type="button" className="rounded px-2 py-0.5 hover:bg-slate-200 dark:hover:bg-slate-800"
          onClick={() => navigator.clipboard?.writeText(all).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1200) })}>
          {copied ? 'Copied' : 'Copy all'}
        </button>
        <button type="button" className="rounded px-2 py-0.5 hover:bg-slate-200 dark:hover:bg-slate-800" onClick={onClose}>Close</button>
      </div>
      <ol data-testid={`${testid}-lines`} className="min-h-0 flex-1 overflow-auto px-3 py-1">
        <li className="text-slate-400">{`// ${start}`}</li>
        {log.map((e, i) => (
          <li key={i} title={e.label} className={`flex text-slate-700 dark:text-slate-200 ${e.code.includes('\n') ? '' : 'truncate'}`}>
            <span className="mr-2 w-5 shrink-0 select-none text-right text-slate-400">{i + 1}</span>
            {e.code.includes('\n')
              ? <pre className="max-h-40 min-w-0 flex-1 overflow-auto whitespace-pre border-l-2 border-emerald-400/60 pl-2">{e.code}</pre>
              : <span className="truncate">{e.code}</span>}
          </li>
        ))}
        {!log.length && <li className="font-sans text-slate-400">Make an edit, and its code appears here.</li>}
      </ol>
      <div className="flex items-start gap-2 border-t border-slate-200 px-3 py-1.5 dark:border-slate-800">
        <textarea data-testid={`${testid}-input`} value={text} onChange={(e) => setText(e.target.value)} rows={2} spellCheck={false}
          onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); run() } }}
          placeholder={placeholder}
          title={`${help} Ctrl+Enter runs it.`}
          className="min-w-0 flex-1 resize-none rounded border border-slate-300 bg-white px-2 py-1 dark:border-slate-700 dark:bg-slate-950" />
        <button type="button" data-testid={`${testid}-run`} onClick={run} className="rounded bg-emerald-600 px-3 py-1 font-sans text-xs font-semibold text-white hover:bg-emerald-500">Run</button>
      </div>
      {error && <div data-testid={`${testid}-error`} className="px-3 pb-1 font-sans text-xs text-rose-600">{error}</div>}
    </div>
  )
}
