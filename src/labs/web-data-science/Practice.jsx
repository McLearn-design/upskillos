import { useCallback, useRef, useState } from 'react'
import Editor from '@monaco-editor/react'
import { setupOpenCalcMonaco } from '../../utils/monacoThemes.js'
import MarkdownProse from '../../components/math/MarkdownProse.jsx'
import { Output, useIsDark } from './Output.jsx'
import { runCode, sameValue, formatValue } from './runtime.js'

// The answer key is the solution's return value, computed by running the
// solution itself. Nothing is written down twice, so it cannot go stale.
const answerCache = new Map()
async function answerFor(lesson) {
  if (!answerCache.has(lesson.id)) {
    const el = document.createElement('div')
    answerCache.set(lesson.id, runCode(lesson.solution, { el }).then((r) => { r.dispose(); return r }))
  }
  return answerCache.get(lesson.id)
}

export default function Practice({ lesson, draft, onDraft, done, onDone }) {
  const dark = useIsDark()
  const [code, setCode] = useState(draft ?? lesson.code)
  const [ran, setRan] = useState({ code: draft ?? lesson.code, key: 0 })
  const [result, setResult] = useState(null)
  const [check, setCheck] = useState(null)
  const [showSolution, setShowSolution] = useState(false)
  const [checks, setChecks] = useState(0)
  const codeRef = useRef(code)
  codeRef.current = code

  const run = useCallback(() => {
    setRan((r) => ({ code: codeRef.current, key: r.key + 1 }))
    setCheck(null)
  }, [])

  const edit = (value = '') => { setCode(value); onDraft(value) }
  const reset = () => { edit(lesson.code); setRan((r) => ({ code: lesson.code, key: r.key + 1 })); setCheck(null) }

  const runCheck = async () => {
    setChecks((n) => n + 1)
    const el = document.createElement('div')
    const mine = await runCode(codeRef.current, { el })
    mine.dispose()
    const key = await answerFor(lesson)
    if (key.error) { setCheck({ ok: false, text: 'The answer key failed to run: ' + key.error.message }); return }
    if (mine.error) { setCheck({ ok: false, text: 'Your code stopped with an error: ' + mine.error.message }); return }
    if (mine.value === undefined) { setCheck({ ok: false, text: 'Your code does not return anything yet. End it with `return` and your answer.' }); return }
    const ok = sameValue(mine.value, key.value, lesson.tolerance)
    setCheck({ ok, text: ok ? 'Correct.' : 'Not yet. You returned ' + formatValue(mine.value).slice(0, 300) + '.' })
    if (ok) onDone()
  }

  return (
    <section aria-labelledby="wds-practice" className="space-y-3">
      <h2 id="wds-practice" className="text-lg font-semibold text-slate-900 dark:text-slate-100">Your turn</h2>
      {lesson.task && (
        <div className="rounded-lg border border-sky-200 bg-sky-50 p-4 text-slate-800 dark:border-sky-900 dark:bg-sky-950/40 dark:text-slate-200">
          <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-sky-700 dark:text-sky-300">Task {done && '· done ✓'}</div>
          <MarkdownProse text={lesson.task} className="wds-prose" />
        </div>
      )}
      <div className="wds-split">
        <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700">
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-slate-50 px-2 py-1.5 dark:border-slate-700 dark:bg-slate-900">
            <button type="button" onClick={run} className="rounded bg-sky-600 px-3 py-1 text-sm font-medium text-white hover:bg-sky-500">▶ Run</button>
            {lesson.task && <button type="button" onClick={runCheck} className="rounded bg-emerald-600 px-3 py-1 text-sm font-medium text-white hover:bg-emerald-500">Check answer</button>}
            <button type="button" onClick={reset} className="rounded px-2 py-1 text-sm text-slate-600 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-800">Reset</button>
            {lesson.solution && (checks >= 2 || done) && (
              <button type="button" onClick={() => setShowSolution((s) => !s)} className="rounded px-2 py-1 text-sm text-slate-600 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-800">
                {showSolution ? 'Hide solution' : 'Show solution'}
              </button>
            )}
            <span className="ml-auto text-xs text-slate-500">Ctrl/⌘ + Enter runs</span>
          </div>
          <Editor
            height="460px"
            language="javascript"
            value={code}
            onChange={edit}
            theme={dark ? 'open-calc-dark' : 'open-calc-light'}
            beforeMount={setupOpenCalcMonaco}
            onMount={(editor, monaco) => editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, run)}
            options={{ minimap: { enabled: false }, fontSize: 13, tabSize: 2, scrollBeyondLastLine: false, wordWrap: 'on', automaticLayout: true }}
          />
        </div>
        <div className="space-y-2">
          <Output code={ran.code} runKey={ran.key} height={lesson.height} onResult={setResult} label={'Your output: ' + lesson.title} />
          {result && result.value !== undefined && !result.error && (
            <p className="text-sm text-slate-600 dark:text-slate-400">Returned: <code className="font-mono">{formatValue(result.value).slice(0, 200)}</code></p>
          )}
          {check && (
            <p role="status" className={'rounded px-3 py-2 text-sm ' + (check.ok ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300' : 'bg-amber-50 text-amber-900 dark:bg-amber-950/50 dark:text-amber-200')}>
              {check.text}
            </p>
          )}
          {lesson.task && checks < 2 && !done && <p className="text-xs text-slate-500">The solution unlocks after two checks.</p>}
        </div>
      </div>
      {showSolution && (
        <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700">
          <div className="bg-slate-50 px-3 py-1.5 text-sm font-medium text-slate-700 dark:bg-slate-900 dark:text-slate-300">Solution (your code is unchanged)</div>
          <Editor height="320px" language="javascript" value={lesson.solution} theme={dark ? 'open-calc-dark' : 'open-calc-light'}
            beforeMount={setupOpenCalcMonaco} options={{ readOnly: true, minimap: { enabled: false }, fontSize: 13, scrollBeyondLastLine: false, wordWrap: 'on' }} />
        </div>
      )}
    </section>
  )
}
