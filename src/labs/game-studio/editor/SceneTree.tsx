// The scene tree: the scene's real hierarchy (the specification's §9). Click to select
// (Shift adds), double-click to rename, drag a node onto another to make it a child,
// or onto the gap above a node to put it before that node.

import React, { useState } from 'react';
import type { Store } from './store';
import { Btn, C, PanelTitle, selectStyle, useStore } from './kit';
import { nodeType, nodeTypes } from '../core/registry';
import type { NodeData } from '../core/types';
import { contains, findNode, parentOf } from '../core/project';

const DRAG = 'application/x-game-studio-node';

export function AddNodeMenu({ store, onDone }: { store: Store; onDone?: () => void }) {
  return (
    <select data-testid="add-node" value="" onChange={(e) => { if (e.target.value) { store.addNode(e.target.value); onDone?.(); } }} style={{ ...selectStyle, width: 74, fontSize: 11, padding: '1px 2px' }} title="Add a node as a child of the selected one">
      <option value="">+ Add…</option>
      {nodeTypes().filter((t) => t.addable).map((t) => <option key={t.type} value={t.type}>{t.icon} {t.type}</option>)}
    </select>
  );
}

export function SceneTree({ store }: { store: Store }) {
  useStore(store);
  const s = store.scene;
  const [renaming, setRenaming] = useState<string | null>(null);
  const [over, setOver] = useState<{ id: string; where: 'into' | 'before' } | null>(null);
  /** Which branches are open. A branch with more than 20 children (a floor of tiles) starts closed. */
  const [openState, setOpenState] = useState<Record<string, boolean>>({});
  if (!store.project) return null;
  const sel = new Set(store.selection);

  const drop = (target: NodeData, where: 'into' | 'before', e: React.DragEvent) => {
    e.preventDefault(); setOver(null);
    const id = e.dataTransfer.getData(DRAG);
    if (!s || !id || id === target.id) return;
    const moving = findNode(s, id);
    if (!moving || contains(moving, target.id)) { store.say('A node cannot go inside itself or its own children'); return; }
    if (where === 'into') store.act((d) => d.reparent(s.id, id, target.id));
    else {
      const parent = parentOf(s, target.id);
      if (!parent) return;
      store.act((d) => d.reparent(s.id, id, parent.id, parent.children.findIndex((c) => c.id === target.id)));
    }
  };

  const row = (n: NodeData, depth: number): React.ReactNode => {
    const isRoot = n.id === s!.root.id, active = sel.has(n.id);
    const isOpen = openState[n.id] ?? n.children.length <= 20;
    return (
      <div key={n.id}>
        {!isRoot && (
          <div onDragOver={(e) => { if (e.dataTransfer.types.includes(DRAG)) { e.preventDefault(); setOver({ id: n.id, where: 'before' }); } }} onDragLeave={() => setOver(null)} onDrop={(e) => drop(n, 'before', e)}
            style={{ height: 4, marginLeft: 8 + depth * 14, background: over?.id === n.id && over.where === 'before' ? C.accent : 'transparent' }} />
        )}
        <div
          data-testid={`tree-${n.name}`}
          draggable={!isRoot && renaming !== n.id}
          onDragStart={(e) => { e.dataTransfer.setData(DRAG, n.id); e.dataTransfer.effectAllowed = 'move'; }}
          onDragOver={(e) => { if (e.dataTransfer.types.includes(DRAG)) { e.preventDefault(); setOver({ id: n.id, where: 'into' }); } }}
          onDragLeave={() => setOver(null)}
          onDrop={(e) => drop(n, 'into', e)}
          onClick={(e) => store.select(e.shiftKey ? [...store.selection.filter((x) => x !== n.id), n.id] : [n.id])}
          onDoubleClick={() => setRenaming(n.id)}
          title={nodeType(n.type).help}
          style={{
            display: 'flex', alignItems: 'center', gap: 5, padding: `2px 6px 2px ${8 + depth * 14}px`, cursor: 'default', fontSize: 12,
            background: active ? '#2b4a6e' : over?.id === n.id && over.where === 'into' ? '#26384f' : 'transparent', color: active ? '#fff' : C.text, whiteSpace: 'nowrap',
          }}>
          <span data-testid={`toggle-${n.name}`} onClick={(e) => { e.stopPropagation(); if (n.children.length) setOpenState((o) => ({ ...o, [n.id]: !isOpen })); }}
            style={{ width: 10, color: C.faint, fontSize: 9, cursor: n.children.length ? 'pointer' : 'default' }}>{n.children.length ? (isOpen ? '▾' : '▸') : ''}</span>
          <span style={{ width: 16, textAlign: 'center', opacity: 0.85 }}>{nodeType(n.type).icon}</span>
          {renaming === n.id ? (
            <input autoFocus defaultValue={n.name} data-testid="rename-input"
              onBlur={(e) => { const v = e.target.value.trim(); setRenaming(null); if (v && v !== n.name) store.act((d) => d.rename(s!.id, n.id, v)); }}
              onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') setRenaming(null); }}
              style={{ background: C.bg, color: C.text, border: `1px solid ${C.accent}`, fontSize: 12, padding: '0 3px', width: 130 }} />
          ) : <span>{n.name}</span>}
          {!isOpen && n.children.length > 0 && <span style={{ color: C.faint, fontSize: 11 }}>({n.children.length})</span>}
          <span style={{ flex: 1 }} />
          {n.script && <span title={`Script: ${n.script}`} onClick={(e) => { e.stopPropagation(); store.openScript(n.script!); }} style={{ color: C.warn, cursor: 'pointer', fontSize: 11 }}>{'</>'}</span>}
        </div>
        {isOpen && n.children.map((c) => row(c, depth + 1))}
      </div>
    );
  };

  const selected = store.selected;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0, height: '100%' }}>
      <PanelTitle right={s && <AddNodeMenu store={store} />}>SCENE{s ? ` · ${s.path.replace(/^scenes\//, '')}` : ''}</PanelTitle>
      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 6 }} onClick={(e) => { if (e.target === e.currentTarget) store.select([]); }}>
        {s ? row(s.root, 0) : <div style={{ padding: 10, color: C.faint, fontSize: 12 }}>No scene open.</div>}
      </div>
      {s && selected && selected.id !== s.root.id && (
        <div style={{ display: 'flex', gap: 4, padding: 6, borderTop: `1px solid ${C.border}` }}>
          <Btn small onClick={() => setRenaming(selected.id)} title="Rename (double-click)">Rename</Btn>
          <Btn small onClick={() => { const c = store.act((d) => d.duplicate(s.id, selected.id)); if (c) store.select([c.id]); }} title="Duplicate (Ctrl+D)">Duplicate</Btn>
          <Btn small onClick={() => store.act((d) => d.deleteNode(s.id, selected.id))} title="Delete (Delete key)">Delete</Btn>
        </div>
      )}
    </div>
  );
}
