// Formatting and file actions. Every button has a label that says what it
// does, because learners hover to find out.
import { useState } from 'react'
import {
  AlignCenter, AlignLeft, AlignRight, Baseline, Bold, BookOpen, Code2, DecimalsArrowLeft, DecimalsArrowRight, Download,
  Eraser, FilePlus2, Italic, PaintBucket, PanelRight, Redo2, Underline, Undo2, Upload, Waypoints,
} from 'lucide-react'
import { PRESET_FORMATS } from '../engine/format.js'

const COLORS = ['#0f172a', '#dc2626', '#ea580c', '#ca8a04', '#16a34a', '#0891b2', '#2563eb', '#7c3aed', '#db2777', '#64748b']
const FILLS = ['#fee2e2', '#ffedd5', '#fef9c3', '#dcfce7', '#cffafe', '#dbeafe', '#ede9fe', '#fce7f3', '#f1f5f9', '#e2e8f0']

function Button({ label, onClick, active, disabled, children }) {
  return (
    <button type="button" title={label} aria-label={label} aria-pressed={active} disabled={disabled} onClick={onClick}
      onPointerDown={(e) => e.preventDefault() /* keep focus in the grid */}
      className={'flex h-7 min-w-7 items-center justify-center rounded px-1.5 text-slate-600 hover:bg-slate-200 disabled:opacity-35 disabled:hover:bg-transparent dark:text-slate-300 dark:hover:bg-slate-800 '
        + (active ? 'bg-sky-100 text-sky-800 dark:bg-sky-900/60 dark:text-sky-200' : '')}>
      {children}
    </button>
  )
}

function Palette({ label, icon, colors, onPick, onClear }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative">
      <Button label={label} onClick={() => setOpen((o) => !o)}>{icon}</Button>
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-40 rounded-md border border-slate-200 bg-white p-2 shadow-lg dark:border-slate-700 dark:bg-slate-900"
          onPointerDown={(e) => e.preventDefault()}>
          <div className="grid grid-cols-5 gap-1">
            {colors.map((c) => <button key={c} type="button" aria-label={c} title={c} onClick={() => { onPick(c); setOpen(false) }} className="h-6 w-6 rounded border border-slate-300 dark:border-slate-600" style={{ background: c }} />)}
          </div>
          <button type="button" onClick={() => { onClear(); setOpen(false) }} className="mt-2 w-full rounded px-2 py-1 text-left text-xs text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800">None</button>
        </div>
      )}
    </div>
  )
}

const Divider = () => <div className="mx-1 h-5 w-px bg-slate-200 dark:bg-slate-700" />

export default function Toolbar({ wb, cell, onStyle, onFormat, onDecimals, onClearFormat, onUndo, onRedo, inspectorOpen, onToggleInspector, onNew, onOpenTour, onImport, onExport, onInsertCode, tracing, onToggleTracing }) {
  const [codeMenu, setCodeMenu] = useState(false)
  const style = cell?.style ?? {}
  const format = cell?.format ?? 'General'
  const known = PRESET_FORMATS.some((p) => p.code === format)
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-0.5 border-b border-slate-200 bg-slate-50 px-2 py-1 dark:border-slate-800 dark:bg-slate-900" role="toolbar" aria-label="Formatting">
      <Button label="Undo (Ctrl+Z)" onClick={onUndo} disabled={!wb.undoStack.length}><Undo2 size={15} /></Button>
      <Button label="Redo (Ctrl+Y)" onClick={onRedo} disabled={!wb.redoStack.length}><Redo2 size={15} /></Button>
      <Divider />
      <label className="sr-only" htmlFor="ss-format">Number format</label>
      <select id="ss-format" value={known ? format : '__custom'} onChange={(e) => onFormat(e.target.value)}
        title={PRESET_FORMATS.find((p) => p.code === format)?.learn ?? 'Custom format: ' + format}
        className="h-7 rounded border border-slate-300 bg-white px-1 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200">
        {PRESET_FORMATS.map((p) => <option key={p.code} value={p.code}>{p.label}</option>)}
        {!known && <option value="__custom">Custom: {format}</option>}
      </select>
      <Button label="Fewer decimal places" onClick={() => onDecimals(-1)}><DecimalsArrowLeft size={15} /></Button>
      <Button label="More decimal places" onClick={() => onDecimals(1)}><DecimalsArrowRight size={15} /></Button>
      <Divider />
      <Button label="Bold (Ctrl+B)" active={!!style.bold} onClick={() => onStyle({ bold: !style.bold })}><Bold size={15} /></Button>
      <Button label="Italic (Ctrl+I)" active={!!style.italic} onClick={() => onStyle({ italic: !style.italic })}><Italic size={15} /></Button>
      <Button label="Underline (Ctrl+U)" active={!!style.underline} onClick={() => onStyle({ underline: !style.underline })}><Underline size={15} /></Button>
      <Palette label="Text colour" icon={<Baseline size={15} />} colors={COLORS} onPick={(c) => onStyle({ color: c })} onClear={() => onStyle({ color: undefined })} />
      <Palette label="Fill colour" icon={<PaintBucket size={15} />} colors={FILLS} onPick={(c) => onStyle({ fill: c })} onClear={() => onStyle({ fill: undefined })} />
      <Divider />
      <Button label="Align left" active={style.align === 'left'} onClick={() => onStyle({ align: style.align === 'left' ? undefined : 'left' })}><AlignLeft size={15} /></Button>
      <Button label="Align centre" active={style.align === 'center'} onClick={() => onStyle({ align: style.align === 'center' ? undefined : 'center' })}><AlignCenter size={15} /></Button>
      <Button label="Align right" active={style.align === 'right'} onClick={() => onStyle({ align: style.align === 'right' ? undefined : 'right' })}><AlignRight size={15} /></Button>
      <Button label="Clear formatting" onClick={onClearFormat}><Eraser size={15} /></Button>
      <Divider />
      <div className="relative">
        <button type="button" onClick={() => setCodeMenu((o) => !o)} onPointerDown={(e) => e.preventDefault()}
          title="Put Python, JavaScript or MATLAB code in the selected cell (or type =PY(, =JS( or =MATLAB( in it)"
          className="flex h-7 items-center gap-1 rounded px-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-emerald-900/30">
          <Code2 size={15} /> Code
        </button>
        {codeMenu && (
          <div className="absolute left-0 top-full z-50 mt-1 w-56 rounded-md border border-slate-200 bg-white py-1 text-xs shadow-lg dark:border-slate-700 dark:bg-slate-900" onPointerDown={(e) => e.preventDefault()}>
            {[['py', 'Python', 'numpy, pandas, scikit-learn, matplotlib'], ['js', 'JavaScript', 'the language of the web'], ['matlab', 'MATLAB', 'matrices and numerical maths']].map(([id, label, note]) => (
              <button key={id} type="button" onClick={() => { setCodeMenu(false); onInsertCode(id) }} className="block w-full px-3 py-1.5 text-left hover:bg-slate-100 dark:hover:bg-slate-800">
                <span className="font-semibold">{label} cell</span>
                <span className="block text-[11px] text-slate-500">{note}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      <Divider />
      <Button label="New blank workbook" onClick={onNew}><FilePlus2 size={15} /></Button>
      <Button label="Open the tour workbook" onClick={onOpenTour}><BookOpen size={15} /></Button>
      <Button label="Import a CSV file as a new sheet" onClick={onImport}><Upload size={15} /></Button>
      <Button label="Download this sheet as CSV" onClick={onExport}><Download size={15} /></Button>
      <div className="flex-1" />
      <Button label={tracing ? 'Hide the arrows' : 'Trace: draw arrows from the cells the selected cell reads (blue) and to the cells that read it (green)'} active={tracing} onClick={onToggleTracing}><Waypoints size={15} /></Button>
      <Button label={inspectorOpen ? 'Hide the inspector' : 'Show the inspector'} active={inspectorOpen} onClick={onToggleInspector}><PanelRight size={15} /></Button>
    </div>
  )
}
