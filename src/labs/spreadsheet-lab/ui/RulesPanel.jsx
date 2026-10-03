// Conditional formatting: add a rule for the selected cells, and see or
// remove the sheet's rules. Each kind says what it does, for learners.
import { useState } from 'react'
import { HIGHLIGHTS, RULE_KINDS, describeRule } from '../engine/conditional.js'

const OPS = [['>', 'greater than'], ['<', 'less than'], ['>=', 'at least (≥)'], ['<=', 'at most (≤)'], ['=', 'equal to'], ['<>', 'not equal to'], ['between', 'between'], ['contains', 'containing the text']]
const field = 'rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100'
const asValue = (t) => (t.trim() !== '' && Number.isFinite(Number(t)) ? Number(t) : t)

function Swatch({ rule }) {
  if (rule.kind === 'scale') return <span className="h-4 w-8 shrink-0 rounded" style={{ background: 'linear-gradient(90deg, #cde2fb, #184f95)' }} />
  if (rule.kind === 'bar') return <span className="flex h-4 w-8 shrink-0 items-center rounded border border-slate-300 dark:border-slate-600"><span className="h-2.5 w-5 rounded-sm" style={{ background: 'var(--ss-series-1)' }} /></span>
  const h = HIGHLIGHTS[rule.style] ?? HIGHLIGHTS.red
  return <span className="flex h-4 w-8 shrink-0 items-center justify-center rounded border border-slate-300 text-[10px] dark:border-slate-600" style={{ background: h.fill, color: h.color, fontWeight: h.bold ? 700 : 400 }}>Aa</span>
}

export default function RulesPanel({ rules, target, onAdd, onRemove, onSelect }) {
  const [kind, setKind] = useState('compare')
  const [op, setOp] = useState('>')
  const [value, setValue] = useState('')
  const [value2, setValue2] = useState('')
  const [count, setCount] = useState('10')
  const [flip, setFlip] = useState(false) // bottom / below / unique
  const [percent, setPercent] = useState(false)
  const [style, setStyle] = useState('red')
  const highlight = kind !== 'scale' && kind !== 'bar'
  const missingValue = kind === 'compare' && (value.trim() === '' || (op === 'between' && value2.trim() === ''))

  const add = () => {
    const rule = { kind, ...(highlight ? { style } : {}) }
    if (kind === 'compare') Object.assign(rule, { op, value: op === 'contains' ? value : asValue(value), ...(op === 'between' ? { value2: asValue(value2) } : {}) })
    if (kind === 'top') Object.assign(rule, { count: Math.max(1, Math.round(Number(count)) || 10), ...(flip ? { bottom: true } : {}), ...(percent ? { percent: true } : {}) })
    if (kind === 'average' && flip) rule.below = true
    if (kind === 'duplicate' && flip) rule.unique = true
    onAdd(rule)
  }

  return (
    <div className="space-y-4 px-4 py-3">
      <section>
        <h3 className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">New rule for {target}</h3>
        <div className="space-y-1" role="radiogroup" aria-label="Kind of rule">
          {Object.entries(RULE_KINDS).map(([id, k]) => (
            <label key={id} className={'flex cursor-pointer gap-2 rounded-md border px-2 py-1.5 text-xs ' + (kind === id ? 'border-sky-600 bg-sky-50 dark:border-sky-400 dark:bg-sky-900/30' : 'border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-900')}>
              <input type="radio" name="rule-kind" checked={kind === id} onChange={() => { setKind(id); setFlip(false) }} className="mt-0.5" />
              <span>
                <span className="font-semibold text-slate-800 dark:text-slate-100">{k.label}</span>
                {kind === id && <span className="mt-0.5 block text-slate-600 dark:text-slate-300">{k.learn}</span>}
              </span>
            </label>
          ))}
        </div>

        <div className="mt-2 space-y-2">
          {kind === 'compare' && (
            <div className="flex flex-wrap items-center gap-1.5">
              <select value={op} onChange={(e) => setOp(e.target.value)} className={field} aria-label="Test">
                {OPS.map(([o, l]) => <option key={o} value={o}>{l}</option>)}
              </select>
              <input value={value} onChange={(e) => setValue(e.target.value)} placeholder={op === 'contains' ? 'text' : 'value'} aria-label="Value" className={field + ' w-20'} />
              {op === 'between' && <><span className="text-xs text-slate-500">and</span><input value={value2} onChange={(e) => setValue2(e.target.value)} placeholder="value" aria-label="Second value" className={field + ' w-20'} /></>}
            </div>
          )}
          {kind === 'top' && (
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <select value={flip ? 'bottom' : 'top'} onChange={(e) => setFlip(e.target.value === 'bottom')} className={field} aria-label="Top or bottom">
                <option value="top">Top</option><option value="bottom">Bottom</option>
              </select>
              <input value={count} onChange={(e) => setCount(e.target.value)} inputMode="numeric" aria-label="How many" className={field + ' w-14'} />
              <label className="flex items-center gap-1 text-slate-700 dark:text-slate-200"><input type="checkbox" checked={percent} onChange={(e) => setPercent(e.target.checked)} /> as a percentage</label>
            </div>
          )}
          {kind === 'average' && (
            <select value={flip ? 'below' : 'above'} onChange={(e) => setFlip(e.target.value === 'below')} className={field} aria-label="Above or below">
              <option value="above">Above the average</option><option value="below">Below the average</option>
            </select>
          )}
          {kind === 'duplicate' && (
            <select value={flip ? 'unique' : 'duplicate'} onChange={(e) => setFlip(e.target.value === 'unique')} className={field} aria-label="Duplicate or unique">
              <option value="duplicate">Values that repeat</option><option value="unique">Values that appear once</option>
            </select>
          )}
          {highlight && (
            <div className="flex flex-wrap gap-1" role="radiogroup" aria-label="Highlight style">
              {Object.entries(HIGHLIGHTS).map(([id, h]) => (
                <button key={id} type="button" role="radio" aria-checked={style === id} title={h.label} onClick={() => setStyle(id)}
                  className={'rounded border px-2 py-0.5 text-[11px] ' + (style === id ? 'ring-2 ring-sky-500' : '')}
                  style={{ background: h.fill ?? 'transparent', color: h.color, fontWeight: h.bold ? 700 : 400, borderColor: h.fill ?? '#cbd5e1' }}>{h.label}</button>
              ))}
            </div>
          )}
          <button type="button" onClick={add} disabled={missingValue}
            className="rounded-md bg-sky-600 px-3 py-1 text-xs font-semibold text-white hover:bg-sky-500 disabled:opacity-40">Add rule to {target}</button>
        </div>
      </section>

      <section>
        <h3 className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Rules on this sheet</h3>
        {!rules.length && <p className="text-xs text-slate-500 dark:text-slate-400">None yet. Rules colour cells by their values and update by themselves when the values change.</p>}
        <ul className="space-y-1">
          {rules.map((r) => (
            <li key={r.id} className="flex items-center gap-2 rounded-md border border-slate-200 px-2 py-1.5 text-xs dark:border-slate-700">
              <Swatch rule={r} />
              <button type="button" onClick={() => onSelect(r)} className="min-w-0 flex-1 text-left" title="Select these cells">
                <span className="block truncate text-slate-800 dark:text-slate-100">{describeRule(r)}</span>
                <span className="font-mono text-[11px] text-slate-500">{r.source}</span>
              </button>
              <button type="button" onClick={() => onRemove(r.id)} aria-label={'Remove rule: ' + describeRule(r)} className="rounded px-1.5 text-slate-400 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950 dark:hover:text-red-300">✕</button>
            </li>
          ))}
        </ul>
        {rules.length > 1 && <p className="mt-1.5 text-[11px] text-slate-400">Where rules overlap, the one higher in the list decides the colour.</p>}
      </section>
    </div>
  )
}
