// The scene hierarchy. Click to select (Shift adds), double-click to rename,
// drag one object onto another to make it a child, drag onto the empty area to
// clear its parent. Children keep their place in the world when re-parented.
import React, { useState } from 'react';
import type { Editor } from '../core/Editor';
import type { SceneObject } from '../core/Scene';
import { C, useEditorVersion } from './kit';

const ICON: Record<string, string> = { mesh: '▲', empty: '✛', light: '☀', camera: '🎥' };

export function Outliner({ editor }: { editor: Editor }) {
  useEditorVersion(editor);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const drop = (target: string | null, e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation(); setDragOver(null);
    const id = e.dataTransfer.getData('text/meshlab-id');
    if (id && id !== target) editor.setParent(id, target);
  };

  const row = (o: SceneObject, depth: number): React.ReactNode => {
    const kids = editor.scene.children(o.id);
    const sel = editor.selected.has(o.id), active = editor.active === o.id;
    return (
      <React.Fragment key={o.id}>
        <div
          draggable
          onDragStart={(e) => e.dataTransfer.setData('text/meshlab-id', o.id)}
          onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setDragOver(o.id); }}
          onDragLeave={() => setDragOver(null)}
          onDrop={(e) => drop(o.id, e)}
          onClick={(e) => editor.selectObject(o.id, e.shiftKey)}
          onDoubleClick={() => setRenaming(o.id)}
          style={{
            display: 'flex', alignItems: 'center', gap: 5, padding: `3px 8px 3px ${8 + depth * 14}px`, fontSize: 12, cursor: 'pointer',
            background: dragOver === o.id ? '#3b4a60' : sel ? (active ? '#4a3a22' : '#3a3226') : 'transparent',
            color: o.visible ? C.text : C.faint, borderLeft: `2px solid ${active ? C.accent : 'transparent'}`,
          }}
        >
          <span onClick={(e) => { e.stopPropagation(); const s = new Set(collapsed); s.has(o.id) ? s.delete(o.id) : s.add(o.id); setCollapsed(s); }} style={{ width: 10, color: C.faint }}>{kids.length ? (collapsed.has(o.id) ? '▸' : '▾') : ''}</span>
          <span style={{ color: o.kind === 'light' ? '#ffe08a' : o.kind === 'empty' ? C.dim : o.material.color, fontSize: 10 }}>{ICON[o.kind]}</span>
          {renaming === o.id ? (
            <input
              autoFocus defaultValue={o.name}
              onClick={(e) => e.stopPropagation()}
              onBlur={(e) => { editor.rename(o.id, e.target.value); setRenaming(null); }}
              onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') setRenaming(null); }}
              style={{ flex: 1, minWidth: 0, background: C.bg, color: C.text, border: `1px solid ${C.accent}`, fontSize: 12, padding: '1px 4px' }}
            />
          ) : <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.name}</span>}
          {o.modifiers.length > 0 && <span title={o.modifiers.map((m) => m.type).join(', ')} style={{ color: C.blue, fontSize: 10 }}>🔧</span>}
          <span title={o.visible ? 'Hide' : 'Show'} onClick={(e) => { e.stopPropagation(); editor.setVisible(o.id, !o.visible); }} style={{ color: o.visible ? C.dim : C.faint, fontSize: 11 }}>{o.visible ? '◉' : '○'}</span>
        </div>
        {!collapsed.has(o.id) && kids.map((k) => row(k, depth + 1))}
      </React.Fragment>
    );
  };

  return (
    <div
      style={{ height: '100%', overflowY: 'auto', background: C.panel }}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => drop(null, e)}
      onClick={(e) => { if (e.target === e.currentTarget) editor.selectObject(null); }}
    >
      <div style={{ padding: '7px 10px', fontSize: 11, color: C.dim, fontWeight: 600, letterSpacing: 0.4, background: C.panel2, borderBottom: `1px solid ${C.border}` }}>SCENE</div>
      {editor.scene.children(null).map((o) => row(o, 0))}
      <div style={{ padding: '10px', color: C.faint, fontSize: 11, lineHeight: 1.5 }}>Drag onto an object to parent it; drag here to clear the parent. Double-click to rename.</div>
    </div>
  );
}
