// Project dialogs: the project list (open, new, delete) and Project settings (name,
// size, background, main scene, and the input map with key capture).

import React, { useEffect, useState } from 'react';
import type { Store } from './store';
import { Btn, C, NumberField, Row, TextField, selectStyle, useStore } from './kit';
import * as storage from './storage';
import { EXAMPLES } from '../examples';
import { chains } from '../tasks';

export function Modal({ title, onClose, children, width = 520, testid }: { title: string; onClose?: () => void; children: React.ReactNode; width?: number; testid?: string }) {
  return (
    // Centred with flexbox: in a grid the row grows to fit the dialog, so its 86% height limit would limit nothing.
    <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: '#000a', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
      <div data-testid={testid} onClick={(e) => e.stopPropagation()} style={{ width, maxWidth: '94%', maxHeight: '86%', display: 'flex', flexDirection: 'column', background: C.panel, border: `1px solid ${C.border}`, borderRadius: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', padding: '10px 14px', borderBottom: `1px solid ${C.border}` }}>
          <b style={{ flex: 1, fontSize: 14 }}>{title}</b>{onClose && <Btn small testid="dialog-close" onClick={onClose}>Close</Btn>}
        </div>
        {/* minHeight 0 lets a long list (the tutorials, many projects) scroll inside the dialog instead of running off the screen. */}
        <div style={{ overflowY: 'auto', padding: 14, minHeight: 0 }}>{children}</div>
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
  const guard = () => store.leaveProject();
  return (
    <Modal title="Projects" onClose={onClose} testid="projects-dialog">
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 14 }}>
        <span style={{ color: C.dim, fontSize: 12 }}>New project</span>
        <input data-testid="new-project-name" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.stopPropagation()}
          style={{ flex: 1, background: C.bg, color: C.text, border: `1px solid ${C.border}`, borderRadius: 3, padding: '4px 6px', fontSize: 13 }} />
        <Btn testid="create-project" onClick={async () => { if (!name.trim() || !(await guard())) return; store.newProject(name.trim()); onDone(); }}>Create</Btn>
        <label title="Open a project exported from Game Studio (Project › Export project), from this browser or another" style={{ fontSize: 12, color: C.dim, cursor: 'pointer', border: `1px solid ${C.border}`, borderRadius: 3, padding: '3px 8px' }}>
          Import .zip…
          <input data-testid="projects-import" type="file" accept=".zip,application/zip" style={{ display: 'none' }}
            onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f && await store.importProject(f)) onDone(); }} />
        </label>
      </div>
      <div style={{ color: C.faint, fontSize: 11, fontWeight: 700, marginBottom: 6 }}>START FROM AN EXAMPLE</div>
      {EXAMPLES.map((ex) => (
        <div key={ex.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 4px', borderTop: `1px solid ${C.border}` }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, color: C.text }}>{ex.title}</div>
            <div style={{ fontSize: 11, color: C.dim, lineHeight: 1.4 }}>{ex.blurb} <span style={{ color: C.faint }}>Art: {ex.art}.</span></div>
          </div>
          <Btn small testid={`example-${ex.id}`} onClick={async () => { if (!(await guard())) return; await store.openExample(ex); onDone(); }}>Open</Btn>
        </div>
      ))}
      <div style={{ color: C.faint, fontSize: 11, fontWeight: 700, margin: '16px 0 6px' }}>SAVED IN THIS BROWSER</div>
      {err && <div style={{ color: C.bad, fontSize: 12 }}>{err}</div>}
      {list === null ? <div style={{ color: C.faint }}>Loading…</div> : list.length === 0 ? <div style={{ color: C.faint, fontSize: 12 }}>No saved projects yet.</div> : list.map((p) => (
        <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 4px', borderTop: `1px solid ${C.border}` }}>
          <span style={{ flex: 1, fontSize: 13 }}>{p.name}</span>
          <span style={{ color: C.faint, fontSize: 11 }}>{new Date(p.updatedAt).toLocaleString()}</span>
          <Btn small testid={`open-${p.name}`} onClick={async () => {
            if (!guard()) return;
            try { await store.openProject(p.id); onDone(); } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
          }}>Open</Btn>
          <Btn small onClick={async () => { if ((await store.ask(`Delete "${p.name}" and its images from this browser? This cannot be undone.`, [{ label: 'Delete', value: 'yes', primary: true }, { label: 'Cancel', value: 'cancel' }])) === 'yes') { await storage.deleteProject(p.id); refresh(); } }}>Delete</Btn>
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
      <Row label="Background"><input data-testid="setting-background" type="color" value={p.settings.background} onChange={(e) => store.act((d) => d.setSettings({ background: e.target.value }))} /></Row>
      <Row label="Pixel art" help="Scale images with hard edges, so pixel art stays crisp when the camera zooms. Turn off for smooth, painted art.">
        <input type="checkbox" checked={p.settings.pixelArt !== false} onChange={(e) => store.act((d) => d.setSettings({ pixelArt: e.target.checked }))} />
      </Row>
      <Row label="Gravity" help="How fast rigid bodies speed up falling, in pixels per second per second (downward). Scripts read it as physics.gravity. 0 for a top-down game.">
        <NumberField value={p.settings.gravity ?? 980} step={10} digits={1} onCommit={(v) => store.act((d) => d.setSettings({ gravity: v }))} /><span style={{ color: C.faint, fontSize: 11 }}>px/s²</span>
      </Row>
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

/** Help › Tutorials: the tasks, in chains (the course's chapters). Each starts a new project with its task panel. */
export function TutorialsDialog({ store, onClose }: { store: Store; onClose: () => void }) {
  return (
    <Modal title="Tutorials" onClose={onClose} width={560} testid="tutorials-dialog">
      <div style={{ color: C.dim, fontSize: 12, marginBottom: 8, lineHeight: 1.5 }}>
        Each task starts a new project and shows its steps beside the viewport, ticking them off as you go. The course
        &ldquo;Making Games with Game Studio&rdquo; explains each one, with the maths underneath; these are the same tasks.
      </div>
      {chains().map((c) => (
        <div key={c.name} style={{ marginBottom: 10 }}>
          <div style={{ color: C.text, fontWeight: 600, fontSize: 11, letterSpacing: 0.4, marginBottom: 4 }}>{c.name.toUpperCase()}</div>
          {c.tasks.map((t, i) => (
            <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '3px 0', borderBottom: `1px solid ${C.border}` }}>
              <span style={{ color: C.faint, width: 16 }}>{i + 1}</span>
              <div style={{ flex: 1 }}><div style={{ color: C.text }}>{t.title}</div><div style={{ color: C.faint, fontSize: 11 }}>{t.goal}</div></div>
              <Btn small testid={`tutorial-${t.id}`} onClick={async () => { onClose(); if (await store.leaveProject()) await store.startTask(t.id); }}>Start</Btn>
            </div>
          ))}
        </div>
      ))}
    </Modal>
  );
}

/** A question asked inside the editor (store.ask), on top of everything else. */
export function QuestionDialog({ store }: { store: Store }) {
  useStore(store);
  const q = store.question;
  useEffect(() => {
    if (!q) return;
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); q.resolve('cancel'); } };
    window.addEventListener('keydown', key, true);
    return () => window.removeEventListener('keydown', key, true);
  }, [q]);
  if (!q) return null;
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 60 }}>
      <Modal title="Game Studio" onClose={() => q.resolve('cancel')} width={440} testid="question">
        <div style={{ color: C.text, fontSize: 13, lineHeight: 1.5, marginBottom: 12 }}>{q.text}</div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          {q.choices.map((c) => <Btn key={c.value} testid={`answer-${c.value}`} active={c.primary} onClick={() => q.resolve(c.value)}>{c.label}</Btn>)}
        </div>
      </Modal>
    </div>
  );
}
