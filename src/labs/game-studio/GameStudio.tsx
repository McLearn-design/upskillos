// Game Studio: a browser game engine in the spirit of Godot, built on the rules in
// docs/game-studio-architecture.md. The layout follows the specification's §4: menus
// and a toolbar, the scene tree and files on the left, the viewport (or a script, or
// the running game) in the middle, the Inspector on the right, Output and GUI → code
// below.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Store } from './editor/store';
import { Btn, C, useStore } from './editor/kit';
import { Viewport } from './editor/Viewport';
import { SceneTree } from './editor/SceneTree';
import { Files } from './editor/Files';
import { StarterArt } from './editor/StarterArt';
import { Guide } from './editor/Guide';
import { Inspector } from './editor/Inspector';
import { ScriptEditor } from './editor/ScriptEditor';
import { BottomPanel } from './editor/BottomPanel';
import { ProjectsDialog, SettingsDialog } from './editor/Dialogs';
import * as storage from './editor/storage';

type MenuItem = [label: string, action: () => void, shortcut?: string, disabled?: boolean];

function MenuBar({ menus }: { menus: Record<string, MenuItem[]> }) {
  const [open, setOpen] = useState<string | null>(null);
  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(null);
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, [open]);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 2, padding: '0 6px', background: C.panel, borderBottom: `1px solid ${C.border}`, fontSize: 12 }}>
      <b style={{ padding: '0 8px 0 2px', color: C.text }}>▶ Game Studio</b>
      {Object.entries(menus).map(([name, items]) => (
        <div key={name} style={{ position: 'relative' }}>
          <button type="button" data-testid={`menu-${name}`} onClick={(e) => { e.stopPropagation(); setOpen(open === name ? null : name); }} onMouseEnter={() => open && setOpen(name)}
            style={{ background: open === name ? C.raised : 'none', border: 'none', color: C.text, padding: '5px 9px', fontSize: 12, cursor: 'pointer', borderRadius: 3 }}>{name}</button>
          {open === name && (
            <div style={{ position: 'absolute', top: '100%', left: 0, zIndex: 40, minWidth: 230, background: C.panel2, border: `1px solid ${C.border}`, borderRadius: 4, padding: 3, boxShadow: '0 8px 24px #0008' }}>
              {items.map(([label, fn, key, disabled]) => (
                <div key={label} data-testid={`item-${label}`} onClick={() => { if (!disabled) { setOpen(null); fn(); } }}
                  style={{ display: 'flex', gap: 16, padding: '5px 10px', cursor: disabled ? 'default' : 'pointer', color: disabled ? C.faint : C.text, borderRadius: 3 }}
                  onMouseEnter={(e) => { if (!disabled) e.currentTarget.style.background = C.raised; }} onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}>
                  <span style={{ flex: 1 }}>{label}</span><span style={{ color: C.faint }}>{key}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export default function GameStudio({ onBack }: { onBack?: () => void }) {
  const store = useMemo(() => new Store(), []);
  useStore(store);
  const gameBox = useRef<HTMLDivElement>(null);
  const frameFns = useRef<{ frameAll: () => void; frameSelected: () => void; frameGameArea: () => void } | null>(null);
  const [dialog, setDialog] = useState<'projects' | 'settings' | null>(null);
  const [booting, setBooting] = useState(true);
  const [left, setLeft] = useState<'files' | 'art'>('files');

  // A handle for debugging and browser tests, in development only.
  useEffect(() => { if (import.meta.env?.DEV) (window as unknown as { __gameStudio?: unknown }).__gameStudio = { store }; }, [store]);

  // Open the last project, or show the project list.
  useEffect(() => {
    (async () => {
      try { const id = await storage.lastProjectId(); if (id) await store.openProject(id); }
      catch (e) { store.say(e instanceof Error ? e.message : String(e)); }
      finally { setBooting(false); if (!store.project) setDialog('projects'); }
    })();
    return () => store.stop();
  }, [store]);

  // Warn before losing unsaved work.
  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => { if (store.dirty) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [store]);

  const s = store.scene, sel = store.selected, running = store.running;
  const run = (which: 'project' | 'scene') => { if (gameBox.current) void store.run(which, gameBox.current); };
  const del = () => { if (s && sel && sel.id !== s.root.id) store.act((d) => d.deleteNode(s.id, sel.id)); };
  const dup = () => { if (s && sel && sel.id !== s.root.id) { const c = store.act((d) => d.duplicate(s.id, sel.id)); if (c) store.select([c.id]); } };
  const closeProject = () => { if (!store.dirty || confirm('Close without saving?')) { store.close(); setDialog('projects'); } };

  // Keyboard shortcuts (the specification's §53). Keys typed into fields and the script editor are theirs.
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const typing = !!(e.target as HTMLElement).closest?.('input, textarea, select, .monaco-editor');
      const mod = e.ctrlKey || e.metaKey, k = e.key.toLowerCase();
      if (mod && k === 's') { e.preventDefault(); void store.save(); return; }
      if (e.key === 'F5') { e.preventDefault(); run('project'); return; }
      if (e.key === 'F6') { e.preventDefault(); run('scene'); return; }
      if (e.key === 'F8') { e.preventDefault(); store.stop(); return; }
      if (typing || dialog) return;
      if (mod && k === 'z') { e.preventDefault(); if (e.shiftKey) store.doc?.redo(); else store.doc?.undo(); return; }
      if (mod && k === 'y') { e.preventDefault(); store.doc?.redo(); return; }
      if (mod && k === 'd') { e.preventDefault(); dup(); return; }
      if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); del(); return; }
      if (k === 'f' && store.tab.kind === 'scene') frameFns.current?.frameSelected();
      if (!mod && (k === 'w' || k === 'e' || k === 'r')) { store.tool = k === 'w' ? 'move' : k === 'e' ? 'rotate' : 'scale'; store.changed(); }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  });

  const noProject = !store.project;
  const menus: Record<string, MenuItem[]> = {
    Project: [
      ['Projects and examples…', () => setDialog('projects')],
      ['Save', () => void store.save(), 'Ctrl+S', noProject],
      ['Project settings…', () => setDialog('settings'), '', noProject],
      ['Close project', closeProject, '', noProject],
    ],
    Edit: [
      ['Undo', () => store.doc?.undo(), 'Ctrl+Z', !store.doc?.undoStack.length],
      ['Redo', () => store.doc?.redo(), 'Ctrl+Shift+Z', !store.doc?.redoStack.length],
      ['Duplicate', dup, 'Ctrl+D', !sel],
      ['Delete', del, 'Delete', !sel],
    ],
    Scene: [
      ['New scene', () => { const n = store.project!.scenes.length; store.createScene(n ? `scenes/scene_${n + 1}.scene` : 'scenes/main.scene'); }, '', noProject],
      ['Frame selected', () => frameFns.current?.frameSelected(), 'F'],
      ['Frame all', () => frameFns.current?.frameAll()],
      ['Frame the game area', () => frameFns.current?.frameGameArea()],
    ],
    Run: [
      ['Run project', () => run('project'), 'F5', noProject],
      ['Run this scene', () => run('scene'), 'F6', !s],
      [running?.paused ? 'Resume' : 'Pause', () => store.pause(), '', !running],
      ['Restart', () => store.restart(), '', !running],
      ['Stop', () => store.stop(), 'F8', !running],
    ],
  };

  const tabs = store.tabs;
  return (
    <div style={{ position: 'relative', display: 'grid', gridTemplateRows: '28px 34px 1fr 190px 22px', gridTemplateColumns: '240px 1fr 300px', height: '100%', width: '100%', background: C.bg, color: C.text, fontFamily: 'system-ui, -apple-system, Segoe UI, sans-serif', overflow: 'hidden' }}>
      <div style={{ gridColumn: '1 / 4' }}><MenuBar menus={menus} /></div>

      {/* Toolbar */}
      <div style={{ gridColumn: '1 / 4', display: 'flex', alignItems: 'center', gap: 6, padding: '0 8px', background: C.panel, borderBottom: `1px solid ${C.border}` }}>
        {onBack && <Btn small onClick={onBack} title="Back to the labs">←</Btn>}
        <Btn small onClick={() => store.doc?.undo()} disabled={!store.doc?.undoStack.length} title="Undo (Ctrl+Z)">↶</Btn>
        <Btn small onClick={() => store.doc?.redo()} disabled={!store.doc?.redoStack.length} title="Redo (Ctrl+Shift+Z)">↷</Btn>
        <span style={{ width: 1, height: 18, background: C.border }} />
        {([['move', 'Move', 'W'], ['rotate', 'Rotate', 'E'], ['scale', 'Scale', 'R']] as const).map(([t, label, key]) => (
          <Btn key={t} small testid={`tool-${t}`} active={store.tool === t} onClick={() => { store.tool = t; store.changed(); }} title={`${label} (${key}): drag a node in the viewport`}>{label}</Btn>
        ))}
        <span style={{ width: 1, height: 18, background: C.border }} />
        <Btn small active={store.snap} onClick={() => { store.snap = !store.snap; store.changed(); }} title="Snap: moves to the grid, turns to 15°, scales to 0.1">Snap</Btn>
        <select value={store.grid} onChange={(e) => { store.grid = Number(e.target.value); store.changed(); }} title="Grid size, in pixels" style={{ background: C.bg, color: C.text, border: `1px solid ${C.border}`, borderRadius: 3, fontSize: 12 }}>
          {[4, 8, 16, 32, 64].map((g) => <option key={g} value={g}>{g} px</option>)}
        </select>
        <span style={{ flex: 1 }} />
        <Btn testid="run-project" onClick={() => run('project')} disabled={noProject} active={!!running} title="Run the main scene (F5)">▶ Run</Btn>
        <Btn testid="run-scene" small onClick={() => run('scene')} disabled={!s} title="Run the scene you are editing (F6)">Run scene</Btn>
        <Btn testid="pause" small onClick={() => store.pause()} disabled={!running} title="Pause or resume">{running?.paused ? '▶ Resume' : '❚❚ Pause'}</Btn>
        <Btn small onClick={() => store.restart()} disabled={!running} title="Start the game again">↻</Btn>
        <Btn testid="stop" small onClick={() => store.stop()} disabled={!running} title="Stop (F8)">■ Stop</Btn>
        <span style={{ flex: 1 }} />
        <span data-testid="save-state" style={{ fontSize: 11, color: store.dirty ? C.warn : C.faint }}>{store.project ? (store.dirty ? '● Unsaved' : 'Saved') : ''}</span>
        <Btn small testid="save" onClick={() => void store.save()} disabled={noProject} title="Save (Ctrl+S)">Save</Btn>
      </div>

      {/* Left: scene tree over files */}
      <div style={{ gridColumn: 1, gridRow: 3, display: 'grid', gridTemplateRows: '1fr 1fr', borderRight: `1px solid ${C.border}`, background: C.panel, minHeight: 0 }}>
        <div style={{ minHeight: 0, borderBottom: `1px solid ${C.border}` }}><SceneTree store={store} /></div>
        <div style={{ minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', background: C.panel2, borderBottom: `1px solid ${C.border}` }}>
            {(['files', 'art'] as const).map((k) => (
              <button key={k} type="button" data-testid={`left-${k}`} onClick={() => setLeft(k)} style={{ flex: 1, background: 'none', border: 'none', borderBottom: `2px solid ${left === k ? C.accent : 'transparent'}`, color: left === k ? C.text : C.dim, padding: '5px 0', fontSize: 11, fontWeight: 700, letterSpacing: 0.4, cursor: 'pointer' }}>
                {k === 'files' ? 'FILES' : 'STARTER ART'}
              </button>
            ))}
          </div>
          <div style={{ flex: 1, minHeight: 0 }}>{left === 'files' ? <Files store={store} /> : <StarterArt store={store} />}</div>
        </div>
      </div>

      {/* Middle: tabs, then the viewport, a script, or the running game */}
      <div style={{ gridColumn: 2, gridRow: 3, display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0 }}>
        <div style={{ display: 'flex', gap: 1, background: C.panel2, borderBottom: `1px solid ${C.border}`, overflowX: 'auto' }}>
          {tabs.map((t) => {
            const active = running ? false : t.kind === store.tab.kind && (t.kind === 'scene' || (store.tab.kind === 'script' && t.path === store.tab.path));
            const label = t.kind === 'scene' ? `🎬 ${s ? s.path.replace(/^scenes\//, '') : '2D'}` : `${t.path.replace(/^scripts\//, '')}${store.isScriptDirty(t.path) ? ' ●' : ''}`;
            return (
              <div key={t.kind === 'scene' ? 'scene' : t.path} onClick={() => { store.tab = t; store.changed(); }}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px', fontSize: 12, cursor: 'pointer', background: active ? C.bg : 'transparent', color: active ? C.text : C.dim, borderRight: `1px solid ${C.border}`, whiteSpace: 'nowrap' }}>
                {label}
                {t.kind === 'script' && <span onClick={(e) => { e.stopPropagation(); store.closeTab(t.path); }} style={{ color: C.faint }}>×</span>}
              </div>
            );
          })}
          {running && <div style={{ padding: '5px 10px', fontSize: 12, background: C.bg, color: C.ok, whiteSpace: 'nowrap' }}>▶ {running.scene}{running.paused ? ' (paused)' : ''}</div>}
        </div>
        <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
          <div style={{ position: 'absolute', inset: 0, visibility: !running && store.tab.kind === 'scene' ? 'visible' : 'hidden' }}>
            <Viewport store={store} onFrameRef={(f) => { frameFns.current = f; }} />
          </div>
          {!running && <Guide store={store} />}
          {!running && store.tab.kind === 'script' && <div style={{ position: 'absolute', inset: 0 }}><ScriptEditor key={store.tab.path} store={store} path={store.tab.path} /></div>}
          <div ref={gameBox} data-testid="game-box" style={{ position: 'absolute', inset: 0, display: running ? 'block' : 'none', background: '#000' }} />
        </div>
      </div>

      {/* Right: Inspector */}
      <div style={{ gridColumn: 3, gridRow: 3, borderLeft: `1px solid ${C.border}`, background: C.panel, overflowY: 'auto', minHeight: 0 }}><Inspector store={store} /></div>

      {/* Bottom */}
      <div style={{ gridColumn: '1 / 4', gridRow: 4, borderTop: `1px solid ${C.border}`, background: C.panel, minHeight: 0 }}><BottomPanel store={store} /></div>

      {/* Status */}
      <div data-testid="status" style={{ gridColumn: '1 / 4', gridRow: 5, display: 'flex', alignItems: 'center', gap: 12, padding: '0 10px', fontSize: 11, color: C.dim, background: C.panel, borderTop: `1px solid ${C.border}` }}>
        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{booting ? 'Loading…' : store.message}</span>
        {store.project && <span>{store.project.name} · {store.project.scenes.length} scene{store.project.scenes.length === 1 ? '' : 's'} · {store.project.settings.width} × {store.project.settings.height}</span>}
      </div>

      {dialog === 'projects' && <ProjectsDialog store={store} onClose={store.project ? () => setDialog(null) : undefined} onDone={() => setDialog(null)} />}
      {dialog === 'settings' && <SettingsDialog store={store} onClose={() => setDialog(null)} />}
    </div>
  );
}
