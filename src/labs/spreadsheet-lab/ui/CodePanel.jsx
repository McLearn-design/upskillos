// The editor for a Python, JavaScript or MATLAB cell: the code, a Run button,
// and what the run printed or drew. Code runs only when Run (or Ctrl+Enter)
// is pressed, so editing does not restart Python on every key.
import { Fragment, useEffect, useRef, useState } from 'react'
import Editor from '@monaco-editor/react'
import { Play, Square } from 'lucide-react'
import { setupOpenCalcMonaco } from '../../../utils/monacoThemes.js'
import { LANGUAGES, codeReferences } from '../engine/code.js'
import { cellKey } from '../engine/address.js'
import { CellError, ERRORS } from '../engine/values.js'
import { useDarkMode } from './useDarkMode.js'

const MONACO_LANGUAGE = { py: 'python', js: 'javascript', matlab: 'openmat' }

const HOW = {
  py: [
    ['xl("A1")', 'one value'],
    ['xl("A1:A10")', 'a list'],
    ['xl("A1:C10")', 'a list of rows'],
    ['xl("A1:C10", headers=True)', 'a pandas table named by its first row'],
  ],
  js: [
    ['xl("A1")', 'one value'],
    ['xl("A1:A10")', 'an array'],
    ['xl("A1:C10")', 'an array of rows'],
  ],
  matlab: [
    ['xl("A1")', 'a scalar'],
    ['xl("A1:A10")', 'a column vector'],
    ['xl("A1:C10")', 'a matrix'],
  ],
}

const RESULT = {
  py: 'The value of the last line goes in the cell, as in a notebook. A list spills down a column; a list of rows or a pandas table spills as a block. print() output appears below.',
  js: 'The value you return goes in the cell. An array spills down a column; an array of rows spills as a block. console.log() output appears below.',
  matlab: 'The value of the last line goes in the cell: the variable it assigns, or ans. A vector spills down a column and a matrix as a block. Lines without a semicolon print below.',
}

export default function CodePanel({ wb, sheet, row, col, runtime, onApply }) {
  const cell = sheet.cells.get(cellKey(row, col))
  const code = cell?.code
  const [draft, setDraft] = useState(code?.source ?? '')
  const [status, setStatus] = useState(null)
  const dark = useDarkMode()
  const applyRef = useRef(null)
  const lang = code?.lang ?? 'py'

  // A different cell (or the code changed by undo): show its code.
  useEffect(() => { setDraft(code?.source ?? '') }, [sheet.id, row, col, code?.source])
  useEffect(() => (runtime ? (lang === 'py' ? runtime.python : runtime.light).subscribe(setStatus) : undefined), [runtime, lang])

  if (!code) return null
  const changed = draft !== code.source
  const output = cell.output ?? {}
  const value = wb.valueAt(sheet, row, col)
  const running = output.running || (value instanceof CellError && value.code === '#BUSY!')
  const apply = (source = draft) => { setDraft(source); onApply(source) }
  applyRef.current = apply
  const refs = codeReferences(draft, lang)

  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-2 dark:border-slate-800">
        <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[11px] font-bold text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200">{LANGUAGES[lang].label}</span>
        <span className="min-w-0 flex-1 truncate text-[11px] text-slate-500 dark:text-slate-400">{status?.text}</span>
        {running
          ? <button type="button" onClick={() => runtime?.[lang === 'py' ? 'python' : 'light'].stop()} className="flex items-center gap-1 rounded bg-red-600 px-2 py-1 text-xs font-semibold text-white hover:bg-red-700"><Square size={11} /> Stop</button>
          : <button type="button" onClick={() => apply()} title="Run (Ctrl+Enter)" className={'flex items-center gap-1 rounded px-2 py-1 text-xs font-semibold text-white ' + (changed ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-slate-500 hover:bg-slate-600')}><Play size={11} /> Run</button>}
      </div>
      <div className="h-56 border-b border-slate-200 dark:border-slate-800">
        <Editor
          height="100%"
          language={MONACO_LANGUAGE[lang]}
          theme={dark ? 'open-calc-dark' : 'open-calc-light'}
          beforeMount={setupOpenCalcMonaco}
          value={draft}
          onChange={(v) => setDraft(v ?? '')}
          // addAction rather than addCommand: commands are shared between editor
          // instances, so Ctrl+Enter could run a different editor's handler.
          onMount={(editor, monaco) => editor.addAction({ id: 'ss-run-cell', label: 'Run cell', keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter], run: (ed) => applyRef.current?.(ed.getValue()) })}
          options={{ minimap: { enabled: false }, fontSize: 13, lineNumbers: 'on', scrollBeyondLastLine: false, wordWrap: 'on', tabSize: lang === 'py' ? 4 : 2, automaticLayout: true }}
        />
      </div>
      {changed && <p className="border-b border-amber-200 bg-amber-50 px-4 py-1.5 text-[11px] text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">Edited but not run yet. Press Run or Ctrl+Enter to update the cell.</p>}

      {output.error && (
        <section className="border-b border-slate-200 px-4 py-3 dark:border-slate-800">
          <h3 className="mb-1 text-[11px] font-bold uppercase tracking-wider text-red-600 dark:text-red-400">Error</h3>
          <p className="text-xs text-slate-800 dark:text-slate-100">{output.error}</p>
          {output.traceback && <pre className="mt-2 max-h-40 overflow-auto rounded bg-slate-100 p-2 text-[11px] text-slate-700 dark:bg-slate-900 dark:text-slate-300">{output.traceback}</pre>}
          <p className="mt-2 text-[11px] text-slate-500">{ERRORS['#CODE!'].fix}</p>
        </section>
      )}
      {value instanceof CellError && value.code !== '#CODE!' && value.code !== '#BUSY!' && (
        <section className="border-b border-slate-200 px-4 py-3 text-xs text-slate-700 dark:border-slate-800 dark:text-slate-300">{value.detail || ERRORS[value.code]?.why}</section>
      )}
      {(output.stdout || output.figures?.length > 0) && (
        <section className="border-b border-slate-200 px-4 py-3 dark:border-slate-800">
          <h3 className="mb-1 text-[11px] font-bold uppercase tracking-wider text-slate-500">Output{typeof output.ms === 'number' && <span className="ml-2 font-normal normal-case tracking-normal">ran in {output.ms < 1 ? '<1' : Math.round(output.ms)} ms</span>}</h3>
          {output.stdout && <pre className="max-h-48 overflow-auto whitespace-pre-wrap rounded bg-slate-100 p-2 text-[11px] text-slate-800 dark:bg-slate-900 dark:text-slate-200">{output.stdout}</pre>}
          {output.figures?.map((png, i) => <img key={i} alt={'Figure ' + (i + 1) + ' drawn by the code'} src={'data:image/png;base64,' + png} className="mt-2 w-full rounded border border-slate-200 bg-white dark:border-slate-700" />)}
        </section>
      )}

      <section className="px-4 py-3 text-xs text-slate-600 dark:text-slate-300">
        <h3 className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500">Reading the sheet</h3>
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
          {HOW[lang].map(([call, gives]) => <Fragment key={call}><dt className="font-mono text-slate-800 dark:text-slate-100">{call}</dt><dd>{gives}</dd></Fragment>)}
        </dl>
        <p className="mt-2">{RESULT[lang]}</p>
        <p className="mt-2">This cell reads <span className="font-mono">{refs.length ? refs.join(', ') : 'no cells yet'}</span>, and runs again when any of them changes, like a formula.</p>
        {lang === 'matlab' && <p className="mt-2 text-slate-500">Runs on OpenMAT, a MATLAB-compatible engine in the browser. Most of the language works; cell arrays and structs are not supported yet.</p>}
        {lang === 'py' && <p className="mt-2 text-slate-500">Runs real Python (Pyodide) in your browser. numpy, pandas, scikit-learn and matplotlib download the first time you import them.</p>}
      </section>
    </div>
  )
}
