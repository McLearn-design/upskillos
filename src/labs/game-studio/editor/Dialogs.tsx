// Project dialogs: the project list (open, new, delete) and Project settings (name,
// size, background, main scene, and the input map with key capture).

import React, { useEffect, useState } from 'react';
import type { Store } from './store';
import { Btn, C, NumberField, Row, TextField, selectStyle, useStore } from './kit';
import * as storage from './storage';

function Modal({ title, onClose, children, width = 520, testid }: { title: string; onClose?: () => void; children: React.ReactNode; width?: number; testid?: string }) {
  return (
    <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: '#000a', display: 'grid', placeItems: 'center', zIndex: 50 }}>
      <div data-testid={testid} onClick={(e) => e.stopPropagation()} style={{ width, maxWidth: '94%', maxHeight: '86%', display: 'flex', flexDirection: 'column', background: C.panel, border: `1px solid ${C.border}`, borderRadius: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', padding: '10px 14px', borderBottom: `1px solid ${C.border}` }}>
          <b style={{ flex: 1, fontSize: 14 }}>{title}</b>{onClose && <Btn small onClick={onClose}>Close</Btn>}
        </div>
        <div style={{ overflowY: 'auto', padding: 14 }}>{children}</div>
      </div>
    </div>
  );
}

/** onClose: the Close button (absent when no project is open, so the list cannot be dismissed empty). onDone: after creating or opening one. */
export function ProjectsDialog({ store, onClose, onDone }: { store: Store; onClose?: () => void; onDone: () => void }) {
  const [list, setList] = useState<{ id: string; name: string; updatedAt: string }[] | null>(null);
  const [name, setName] = useState('My Game');
  const [err, setErr] = useState('');
  const refresh = () => { storage.listProjects().then(setList).catch((e) => setErr(String(e))); };
  useEffect(refresh, []);
  const guard = () => !store.dirty || confirm('The open project has unsaved changes. Leave it anyway?');
  return (
    <Modal title="Projects" onClose={onClose} testid="projects-dialog">
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 14 }}>
        <span style={{ color: C.dim, fontSize: 12 }}>New project</span>
        <input data-testid="new-project-name" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.stopPropagation()}
          style={{ flex: 1, background: C.bg, color: C.text, border: `1px solid ${C.border}`, borderRadius: 3, padding: '4px 6px', fontSize: 13 }} />
        <Btn testid="create-project" onClick={() => { if (!name.trim() || !guard()) return; store.newProject(name.trim()); onDone(); }}>Create</Btn>
      </div>
      <div style={{ color: C.faint, fontSize: 11, fontWeight: 700, marginBottom: 6 }}>SAVED IN THIS BROWSER</div>
      {err && <div style={{ color: C.bad, fontSize: 12 }}>{err}</div>}
      {list === null ? <div style={{ color: C.faint }}>Loading…</div> : list.length === 0 ? <div style={{ color: C.faint, fontSize: 12 }}>No saved projects yet.</div> : list.map((p) => (
        <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 4px', borderTop: `1px solid ${C.border}` }}>
          <span style={{ flex: 1, fontSize: 13 }}>{p.name}</span>
          <span style={{ color: C.faint, fontSize: 11 }}>{new Date(p.updatedAt).toLocaleString()}</span>
          <Btn small testid={`open-${p.name}`} onClick={async () => {
            if (!guard()) return;
            try { await store.openProject(p.id); onDone(); } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
          }}>Open</Btn>
          <Btn small onClick={async () => { if (confirm(`Delete "${p.name}" and its images from this browser? This cannot be undone.`)) { await storage.deleteProject(p.id); refresh(); } }}>Delete</Btn>
        </div>
      ))}
    </Modal>
  );
}

/** Wait for one key press and give its KeyboardEvent.code. */
function KeyCapture({ onKey, onCancel }: { onKey: (code: string) => void; onCancel: () => void }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { e.preventDefault(); e.stopPropagation(); if (e.code === 'Escape') onCancel(); else onKey(e.code); };
    window.addEventListener('keydown', h, true);
    return () => window.removeEventListener('keydown', h, true);
  }, [onKey, onCancel]);
  return <span style={{ color: C.warn, fontSize: 12 }}>Press a key… (Esc cancels)</span>;
}

export function SettingsDialog({ store, onClose }: { store: Store; onClose: () => void }) {
  useStore(store);
  const p = store.project;
  const [capture, setCapture] = useState<string | null>(null);
  const [newAction, setNewAction] = useState('');
  if (!p) return null;
  return (
    <Modal title="Project settings" onClose={onClose} width={560} testid="settings-dialog">
      <Row label="Name"><TextField value={p.name} onCommit={(v) => store.act((d) => d.setProjectName(v))} /></Row>
      <Row label="Game size">
        <NumberField value={p.settings.width} step={16} digits={0} onCommit={(v) => store.act((d) => d.setSettings({ width: Math.round(v) }))} />
        <span style={{ color: C.faint }}>×</span>
        <NumberField value={p.settings.height} step={16} digits={0} onCommit={(v) => store.act((d) => d.setSettings({ height: Math.round(v) }))} />
      </Row>
      <Row label="Background"><input type="color" value={p.settings.background} onChange={(e) => store.act((d) => d.setSettings({ background: e.target.value }))} /></Row>
      <Row label="Main scene">
        <select value={p.settings.mainScene ?? ''} onChange={(e) => e.target.value && store.act((d) => d.setMainScene(e.target.value))} style={selectStyle}>
          {!p.settings.mainScene && <option value="">(none)</option>}
          {p.scenes.map((s) => <option key={s.id} value={s.path}>{s.path}</option>)}
        </select>
      </Row>
      <div style={{ color: C.faint, fontSize: 11, fontWeight: 700, margin: '16px 0 6px' }}>INPUT MAP</div>
      <div style={{ color: C.dim, fontSize: 12, marginBottom: 8 }}>Scripts ask about actions, never keys: <code style={{ fontFamily: C.mono }}>input.isPressed(&apos;jump&apos;)</code>. Bind any keys to each action here.</div>
      {p.input.map((a) => (
        <div key={a.name} data-testid={`action-${a.name}`} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 0', borderTop: `1px solid ${C.border}`, flexWrap: 'wrap' }}>
          <span style={{ width: 110, fontFamily: C.mono, fontSize: 12 }}>{a.name}</span>
          {a.keys.map((k) => (
            <span key={k} style={{ background: C.raised, border: `1px solid ${C.border}`, borderRadius: 3, padding: '0 5px', fontSize: 11, fontFamily: C.mono }}>
              {k} <span title="Remove this key" onClick={() => store.act((d) => d.setActionKeys(a.name, a.keys.filter((x) => x !== k)))} style={{ cursor: 'pointer', color: C.faint }}>×</span>
            </span>
          ))}
          {capture === a.name
            ? <KeyCapture onKey={(code) => { setCapture(null); if (!a.keys.includes(code)) store.act((d) => d.setActionKeys(a.name, [...a.keys, code])); }} onCancel={() => setCapture(null)} />
            : <Btn small onClick={() => setCapture(a.name)}>+ key</Btn>}
          <span style={{ flex: 1 }} />
          <Btn small onClick={() => store.act((d) => d.removeAction(a.name))} title="Remove this action">Remove</Btn>
        </div>
      ))}
      <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
        <input value={newAction} onChange={(e) => setNewAction(e.target.value)} placeholder="new_action" onKeyDown={(e) => e.stopPropagation()}
          style={{ background: C.bg, color: C.text, border: `1px solid ${C.border}`, borderRadius: 3, padding: '2px 6px', fontFamily: C.mono, fontSize: 12 }} />
        <Btn small onClick={() => { if (newAction) { store.act((d) => d.addAction(newAction, [])); setNewAction(''); } }}>Add action</Btn>
      </div>
    </Modal>
  );
}
