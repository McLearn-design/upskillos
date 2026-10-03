// The text box for editing a cell, used both in the cell and in the formula
// bar. While a formula is typed it offers matching functions and shows the
// syntax of the function the caret is in, with the current argument in bold.
import { useLayoutEffect, useRef, useState } from 'react'
import { callAt, completionAt, matchingFunctions, syntaxArgs } from '../engine/editing.js'

export default function FormulaInput({
  value, onChange, onKeyDown, inputRef, functions, className = '', style, wrapperClassName = '', wrapperStyle,
  ariaLabel, autoFocus, onFocus, popupAbove = false, caretRequest,
}) {
  const ownRef = useRef(null)
  const ref = inputRef ?? ownRef
  const [caret, setCaret] = useState(value.length)
  const [pick, setPick] = useState(0)
  const [dismissed, setDismissed] = useState(null)
  // Suggestions and syntax help only while typing here: the formula bar shows
  // the selected cell's formula without being edited, and a pop-up then would
  // cover the sheet.
  const [focused, setFocused] = useState(false)
  const pendingCaret = useRef(null)

  // The parent moves the caret when it inserts text itself (a clicked cell's
  // address in point mode): caretRequest is a new { pos } object each time,
  // given only to the box being edited.
  useLayoutEffect(() => {
    if (caretRequest && ref.current) {
      ref.current.focus({ preventScroll: true })
      ref.current.setSelectionRange(caretRequest.pos, caretRequest.pos)
      setCaret(caretRequest.pos)
    }
  }, [caretRequest]) // eslint-disable-line react-hooks/exhaustive-deps

  useLayoutEffect(() => {
    if (pendingCaret.current !== null && ref.current) {
      ref.current.setSelectionRange(pendingCaret.current, pendingCaret.current)
      setCaret(pendingCaret.current)
      pendingCaret.current = null
    }
  })

  const completion = completionAt(value, caret)
  const options = completion ? matchingFunctions(functions, completion.prefix) : []
  const open = focused && options.length > 0 && dismissed !== value
  const call = focused ? callAt(value, caret) : null
  const hint = call ? functions[call.name] : null

  const report = (el) => {
    setCaret(el.selectionStart ?? el.value.length)
    onChange(el.value, el.selectionStart ?? el.value.length)
  }

  const accept = (name) => {
    const before = value.slice(0, completion.start) + name + '('
    const next = before + value.slice(caret)
    pendingCaret.current = before.length
    onChange(next, before.length)
    setPick(0)
  }

  const handleKeyDown = (e) => {
    if (open) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setPick((p) => (p + 1) % options.length); return }
      if (e.key === 'ArrowUp') { e.preventDefault(); setPick((p) => (p - 1 + options.length) % options.length); return }
      if (e.key === 'Tab' || (e.key === 'Enter' && !e.ctrlKey)) { e.preventDefault(); accept(options[Math.min(pick, options.length - 1)]); return }
      if (e.key === 'Escape') { e.preventDefault(); setDismissed(value); return }
    }
    onKeyDown?.(e, ref.current)
  }

  return (
    <div className={'relative ' + wrapperClassName} style={wrapperStyle}>
      <input
        ref={ref}
        value={value}
        autoFocus={autoFocus}
        spellCheck={false}
        autoComplete="off"
        aria-label={ariaLabel}
        className={className}
        style={style}
        onFocus={(e) => { setFocused(true); onFocus?.(e) }}
        onBlur={() => setFocused(false)}
        onChange={(e) => { setPick(0); report(e.target) }}
        onKeyDown={handleKeyDown}
        onKeyUp={(e) => setCaret(e.currentTarget.selectionStart ?? 0)}
        onClick={(e) => { setCaret(e.currentTarget.selectionStart ?? 0); onChange(value, e.currentTarget.selectionStart ?? 0) }}
        onSelect={(e) => setCaret(e.currentTarget.selectionStart ?? 0)}
      />
      {(open || hint) && (
        <div className={'absolute left-0 z-50 min-w-[18rem] max-w-[28rem] rounded-md border border-slate-200 bg-white text-xs shadow-lg dark:border-slate-700 dark:bg-slate-900 ' + (popupAbove ? 'bottom-full mb-1' : 'top-full mt-1')}
          onPointerDown={(e) => e.preventDefault()}>
          {hint && (
            <div className="border-b border-slate-200 px-3 py-2 dark:border-slate-700">
              <div className="font-mono text-[12px] text-slate-800 dark:text-slate-100">
                {call.name}(
                {syntaxArgs(hint.syntax).map((arg, i, all) => {
                  // A repeated last argument ("…") stays highlighted for every extra argument.
                  const current = i === call.argIndex || (arg === '…' && call.argIndex >= i) || (i === all.length - 1 && call.argIndex >= all.length && all.at(-1) === '…')
                  return <span key={i}>{i > 0 && ', '}<span className={current ? 'font-bold text-sky-700 dark:text-sky-300' : ''}>{arg}</span></span>
                })}
                )
              </div>
              <div className="mt-1 text-slate-500 dark:text-slate-400">{hint.summary}</div>
            </div>
          )}
          {open && (
            <ul role="listbox" aria-label="Matching functions">
              {options.map((name, i) => (
                <li key={name} role="option" aria-selected={i === pick}
                  className={'flex cursor-pointer gap-2 px-3 py-1.5 ' + (i === pick ? 'bg-sky-50 dark:bg-sky-900/40' : '')}
                  onPointerDown={(e) => { e.preventDefault(); accept(name) }}>
                  <span className="w-28 shrink-0 font-mono font-semibold text-slate-800 dark:text-slate-100">{name}</span>
                  <span className="truncate text-slate-500 dark:text-slate-400">{functions[name].summary}</span>
                </li>
              ))}
              <li className="px-3 py-1 text-[11px] text-slate-400">Tab or Enter to insert · Esc to close</li>
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
