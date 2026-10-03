// The sheet tabs along the bottom: switch, add, rename (double-click) and
// delete (right-click).
import { useState } from 'react'
import { Plus } from 'lucide-react'

export default function SheetTabs({ wb, activeId, onActivate, onAdd, onRename, onDelete, children }) {
  const [renaming, setRenaming] = useState(null) // { id, name, problem }
  const [menu, setMenu] = useState(null) // { id, x, y }

  const finish = () => {
    if (!renaming) return
    const problem = renaming.name.trim() === wb.sheet(renaming.id)?.name ? null : onRename(renaming.id, renaming.name)
    if (problem) setRenaming({ ...renaming, problem })
    else setRenaming(null)
  }

  return (
    <div data-sheet-tabs className="relative flex h-8 shrink-0 items-stretch border-t border-slate-200 bg-slate-50 text-xs dark:border-slate-800 dark:bg-slate-900">
      <div className="flex min-w-0 items-stretch overflow-x-auto" role="tablist" aria-label="Sheets">
        {wb.sheets.map((s) => (
          renaming?.id === s.id ? (
            <div key={s.id} className="relative flex items-center px-1">
              <input autoFocus value={renaming.name} aria-label="Sheet name"
                onChange={(e) => setRenaming({ ...renaming, name: e.target.value, problem: null })}
                onBlur={finish}
                onKeyDown={(e) => { if (e.key === 'Enter') finish(); if (e.key === 'Escape') setRenaming(null) }}
                className="h-6 w-36 rounded border border-sky-500 bg-white px-1.5 dark:bg-slate-950" />
              {renaming.problem && <div className="absolute bottom-full left-0 mb-1 w-64 rounded bg-red-600 px-2 py-1 text-white shadow">{renaming.problem}</div>}
            </div>
          ) : (
            <button key={s.id} type="button" role="tab" aria-selected={s.id === activeId}
              onClick={() => onActivate(s.id)}
              onDoubleClick={() => setRenaming({ id: s.id, name: s.name, problem: null })}
              onContextMenu={(e) => { e.preventDefault(); setMenu({ id: s.id, x: e.clientX - e.currentTarget.closest('[data-sheet-tabs]').getBoundingClientRect().left }) }}
              title="Double-click to rename, right-click for more"
              className={'whitespace-nowrap border-r border-slate-200 px-4 dark:border-slate-800 ' + (s.id === activeId
                ? 'bg-white font-semibold text-sky-800 shadow-[inset_0_2px_0_#0284c7] dark:bg-slate-950 dark:text-sky-200'
                : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800')}>
              {s.name}
            </button>
          )
        ))}
      </div>
      <button type="button" title="Add a sheet" aria-label="Add a sheet" onClick={onAdd} className="flex w-8 shrink-0 items-center justify-center text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800">
        <Plus size={14} />
      </button>
      <div className="min-w-0 flex-1">{children}</div>
      {menu && (
        <>
          <div className="fixed inset-0 z-40" onPointerDown={() => setMenu(null)} />
          {/* Placed against the tab bar, not the screen: the window around the lab may be moved by a transform. */}
          <div className="absolute bottom-full z-50 mb-1 w-40 rounded-md border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-700 dark:bg-slate-900" style={{ left: menu.x }}>
            <button type="button" className="block w-full px-3 py-1.5 text-left hover:bg-slate-100 dark:hover:bg-slate-800"
              onClick={() => { setRenaming({ id: menu.id, name: wb.sheet(menu.id).name, problem: null }); setMenu(null) }}>Rename</button>
            <button type="button" className="block w-full px-3 py-1.5 text-left text-red-700 hover:bg-slate-100 disabled:opacity-40 dark:text-red-300 dark:hover:bg-slate-800"
              disabled={wb.sheets.length <= 1}
              onClick={() => { onDelete(menu.id); setMenu(null) }}>Delete sheet</button>
          </div>
        </>
      )}
    </div>
  )
}
