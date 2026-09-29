// MeshLab: a small 3D modelling application and graphics laboratory.
//
// Layers (see docs/meshlab.md §35):
//   core/    the scene model, mesh operations, traces, scripting: plain TypeScript, tested headlessly
//   render/  the three.js viewport, built from the model and never the source of truth
//   ui/      panels that read the editor and send it commands
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Editor } from './core/Editor';
import type { SceneJSON } from './core/Scene';
import type { PrimitiveType } from './core/primitives';
import { exportOBJ, parseOBJ } from './core/formats';
import { EditMesh } from './core/EditMesh';
import { Viewport, type GizmoMode, type ViewOptions } from './render/Viewport';
import { exportGLB, importGLTF } from './render/io';
import { Btn, C, useEditorVersion } from './ui/kit';
import { FieldLegend } from './ui/FieldLegend';
import { Timeline } from './ui/Timeline';
import { ProjectGallery, ProjectGuide } from './ui/Projects';
import { PROJECTS, openProject, type ExampleProject } from './core/projects';
import type { PyodideLike } from './core/python';
import { getPyodide } from '../../utils/pyodideRuntime';
import type { IncomingScript } from './ui/ScriptPanel';
import { Outliner } from './ui/Outliner';
import { Inspector } from './ui/Inspector';
import { TracePanel } from './ui/TracePanel';
import { LogPanel, ScriptPanel } from './ui/ScriptPanel';

interface MeshLabProps { onBack?: () => void }

const AUTOSAVE = 'meshlab.autosave';
const PRIMS: [PrimitiveType, string][] = [['cube', 'Cube'], ['plane', 'Plane'], ['grid', 'Grid'], ['circle', 'Circle'], ['cylinder', 'Cylinder'], ['cone', 'Cone'], ['uvSphere', 'UV sphere'], ['torus', 'Torus']];

function download(name: string, data: BlobPart, type: string) {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const a = document.createElement('a'); a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function MeshLab({ onBack }: MeshLabProps) {
  const editor = useMemo(() => {
    const e = new Editor();
    e.traceEnabled = true;
    let restored = false;
    try {
      const saved = localStorage.getItem(AUTOSAVE);
      if (saved) { e.newScene(); e.load(JSON.parse(saved) as SceneJSON, 'Restore last session'); e.undoStack = []; e.log = []; e.message = 'Restored your last session (File › New for a fresh scene)'; restored = true; }
    } catch { /* ignore a damaged autosave */ }
    if (!restored) e.newScene();
    return e;
  }, []);
  useEditorVersion(editor);
  const viewRef = useRef<HTMLDivElement>(null);
  const [vp, setVp] = useState<Viewport | null>(null);
  const [gizmo, setGizmo] = useState<GizmoMode>('translate');
  const [space, setSpace] = useState<'local' | 'world'>('local');
  const [snap, setSnap] = useState(false);
  const [opts, setOpts] = useState<ViewOptions>({ grid: true, axes: true, localAxes: true, normals: false, wire: false, xray: false });
  const [boxArmed, setBoxArmed] = useState(false);
  const [tab, setTab] = useState<'trace' | 'script' | 'timeline' | 'log'>('trace');
  const [bottomH, setBottomH] = useState(270);
  const [menu, setMenu] = useState<string | null>(null);
  const [help, setHelp] = useState(false);
  const [gallery, setGallery] = useState(false);
  const [project, setProject] = useState<ExampleProject | null>(null);
  const [opening, setOpening] = useState<string | null>(null);
  const [incoming, setIncoming] = useState<IncomingScript | null>(null);
  const [scriptSeen, setScriptSeen] = useState(false);
  useEffect(() => { if (tab === 'script') setScriptSeen(true); }, [tab]);
  const fileRef = useRef<HTMLInputElement>(null);
  const importRef = useRef<HTMLInputElement>(null);

  // The viewport lives as long as the component.
  useEffect(() => {
    if (!viewRef.current) return;
    let v: Viewport;
    try { v = new Viewport(viewRef.current, editor); }
    catch (e) { editor.say(`3D view unavailable: ${e instanceof Error ? e.message : e}`); return; }
    v.onBoxChange = setBoxArmed;
    setVp(v);
    // A handle for debugging and browser tests, in development only.
    if (import.meta.env?.DEV) (window as unknown as { __meshlab?: unknown }).__meshlab = { editor, viewport: v };
    return () => { v.dispose(); setVp(null); };
  }, [editor]);
  useEffect(() => { vp?.setGizmoMode(gizmo); }, [vp, gizmo]);
  useEffect(() => { vp?.setSpace(space); }, [vp, space]);
  useEffect(() => { vp?.setSnap(snap); }, [vp, snap]);
  useEffect(() => { vp?.setOptions(opts); }, [vp, opts]);

  // Autosave, a moment after each change.
  useEffect(() => {
    let t = 0;
    const off = editor.subscribe((k) => {
      if (k !== 'scene') return;
      clearTimeout(t);
      t = window.setTimeout(() => { try { localStorage.setItem(AUTOSAVE, JSON.stringify(editor.modelScene.toJSON())); } catch { /* full or unavailable */ } }, 700);
    });
    return () => { off(); clearTimeout(t); };
  }, [editor]);

  // Animation playback: advance at the timeline's fps, looping over the frame range.
  useEffect(() => {
    let raf = 0, last = 0, acc = 0;
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      if (!editor.playing) { last = 0; return; }
      if (!last) { last = now; return; }
      const t = editor.scene.timeline;
      acc += ((now - last) / 1000) * t.fps; last = now;
      if (acc < 1) return;
      const n = Math.floor(acc); acc -= n;
      const span = t.end - t.start + 1;
      editor.setFrame(t.start + ((((t.frame - t.start + n) % span) + span) % span));
    };
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); editor.playing = false; };
  }, [editor]);

  // A new trace: bring the trace tab forward.
  useEffect(() => editor.subscribe((k) => { if (k === 'trace') setTab('trace'); }), [editor]);

  const loopCut = useCallback(() => {
    const e = vp?.hoveredEdge() ?? editor.selectedEdges()[0];
    if (e) editor.loopCut(e[0], e[1]); else editor.say('Loop cut: point at an edge (or select one) that crosses the ring of quads to cut');
  }, [vp, editor]);

  // Blender-style keys.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (typeof t?.closest === 'function' && t.closest('input, textarea, select, .monaco-editor, [contenteditable="true"]')) return;
      const k = e.key.toLowerCase(), mod = e.ctrlKey || e.metaKey, ed = editor, edit = ed.mode === 'edit';
      const act = (fn: () => void) => { e.preventDefault(); fn(); };
      if (mod && k === 'z') return act(() => (e.shiftKey ? ed.redo() : ed.undo()));
      if (mod && k === 'y') return act(() => ed.redo());
      if (mod && k === 's') return act(() => saveFile());
      if (mod && k === 'r') return act(() => loopCut());
      if (mod && k === 'l') return act(() => ed.selectLinked());
      if (mod && k === 'p') return act(() => ed.bindToArmature());
      if (mod) return;
      if (e.key === 'Tab') return act(() => ed.toggleEdit());
      if (ed.mode === 'pose' && e.altKey && k === 'r') return act(() => ed.resetPose());
      if (e.key === '?') return act(() => setHelp((h) => !h));
      if (e.key === 'Escape') { setHelp(false); setMenu(null); return; }
      if (edit && ['1', '2', '3'].includes(k)) return act(() => ed.setSelectMode((['vert', 'edge', 'face'] as const)[+k - 1]));
      if (k === 'g') return act(() => setGizmo('translate'));
      if (k === 'r') return act(() => setGizmo('rotate'));
      if (k === 's') return act(() => setGizmo('scale'));
      if (k === 'a') return act(() => (edit ? ed.selectAllElements(!e.altKey) : ed.selectAllObjects(!e.altKey)));
      if (k === 'b') return act(() => vp?.armBoxSelect());
      if (k === 'f' || k === '.') return act(() => vp?.frameSelected());
      if (e.key === 'Home') return act(() => vp?.frameAll());
      if (k === 'x' || e.key === 'Delete') return act(() => (edit ? ed.deleteElements() : ed.deleteObjects()));
      if (edit && k === 'e') return act(() => { ed.extrude(0.5); setGizmo('translate'); });
      if (edit && k === 'i') return act(() => ed.inset(0.25));
      if (!edit && k === 'i') return act(() => { ed.insertKey(); setTab('timeline'); });
      if (e.key === ' ') return act(() => { ed.setPlaying(!ed.playing); setTab('timeline'); });
      if (e.key === 'ArrowRight' && !e.shiftKey) return act(() => ed.setFrame(Math.min(ed.scene.timeline.end, ed.frame + 1)));
      if (e.key === 'ArrowLeft' && !e.shiftKey) return act(() => ed.setFrame(Math.max(ed.scene.timeline.start, ed.frame - 1)));
      if (edit && k === 'm') return act(() => ed.merge());
      if (!edit && e.shiftKey && k === 'd') return act(() => ed.duplicate());
      if (!edit && k === 'h') return act(() => ed.active && ed.setVisible(ed.active, false));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // ── files ─────────────────────────────────────────────────────────────
  const saveFile = () => download('scene.meshlab.json', JSON.stringify(editor.modelScene.toJSON(), null, 1), 'application/json');
  const openFile = async (f: File) => {
    try { editor.load(JSON.parse(await f.text()) as SceneJSON); vp?.frameAll(); }
    catch (err) { editor.say(`Could not open ${f.name}: ${err instanceof Error ? err.message : err}`); }
  };
  const importFile = async (f: File) => {
    try {
      const ext = f.name.split('.').pop()?.toLowerCase();
      const items = ext === 'obj'
        ? parseOBJ(await f.text()).map((o) => ({ name: o.name, mesh: new EditMesh(o.verts, o.faces) }))
        : await importGLTF(await f.arrayBuffer());
      if (!items.length) { editor.say(`${f.name}: no meshes found`); return; }
      editor.exitEdit();
      editor.run(`Import ${f.name}`, null, () => { for (const it of items) editor.scene.add({ name: it.name, mesh: it.mesh }); });
      editor.say(`Imported ${items.length} object${items.length > 1 ? 's' : ''} from ${f.name}${ext === 'obj' ? '' : ' (triangles, welded)'}`);
      vp?.frameAll();
    } catch (err) { editor.say(`Could not import ${f.name}: ${err instanceof Error ? err.message : err}`); }
  };
  const exportGlb = async () => {
    try { download('scene.glb', await exportGLB(editor.modelScene), 'model/gltf-binary'); }
    catch (err) { editor.say(`GLB export failed: ${err instanceof Error ? err.message : err}`); }
  };

  /** Open a finished example: build it on a new scene, apply its setup, show its guide and script. */
  const openExample = async (p: ExampleProject) => {
    if (editor.undoStack.length && !confirm(`Open "${p.title}"? It replaces the current scene (save first to keep it).`)) return;
    setOpening(p.id);
    let py: PyodideLike | undefined;
    if (p.lang === 'python') {
      try { py = (await getPyodide()) as unknown as PyodideLike; }
      catch (err) { setOpening(null); editor.say(`Python could not start: ${err instanceof Error ? err.message : err}`); return; }
    }
    const r = openProject(editor, p, py);
    setOpening(null); setGallery(false);
    if (r.error) { editor.say(`Could not open ${p.title}: ${r.error}`); return; }
    setProject(p);
    setIncoming({ code: p.code, lang: p.lang, n: Date.now() });
    setTab(p.setup.tab ?? 'trace');
    requestAnimationFrame(() => {
      if (p.setup.view === 'selected') vp?.frameSelected(); else vp?.frameAll();
      if (p.setup.play) editor.setPlaying(true);
    });
  };

  const edit = editor.mode === 'edit';
  const o = editor.activeObject;
  const menus: Record<string, [string, (() => void) | null, string?][]> = {
    File: [
      ['New scene', () => { if (confirm('Start a new scene? (Undo history is cleared; save first if you want to keep this one.)')) { editor.newScene(); vp?.frameAll(); } }],
      ['Open… (.meshlab.json)', () => fileRef.current?.click()],
      ['Save (download)', saveFile, 'Ctrl+S'],
      ['Import OBJ / glTF / GLB…', () => importRef.current?.click()],
      ['Export OBJ (keeps quads, for Blender)', () => download('scene.obj', exportOBJ(editor.modelScene), 'text/plain')],
      ['Export GLB', exportGlb],
    ],
    Edit: [['Undo', () => editor.undo(), 'Ctrl+Z'], ['Redo', () => editor.redo(), 'Ctrl+Shift+Z'], ['Duplicate', () => editor.duplicate(), 'Shift+D'], ['Delete', () => (edit ? editor.deleteElements() : editor.deleteObjects()), 'X'], ['Select all', () => (edit ? editor.selectAllElements() : editor.selectAllObjects()), 'A'], ['Select linked', () => editor.selectLinked(), 'Ctrl+L']],
    Add: [...PRIMS.map(([t, label]) => [label, () => editor.addPrimitive(t)] as [string, () => void]), ['Empty', () => editor.addEmpty()], ['Armature (one bone)', () => editor.addArmature()]],
    Mesh: [
      ['Extrude', () => editor.extrude(0.5), 'E'], ['Inset', () => editor.inset(0.25), 'I'], ['Loop cut', loopCut, 'Ctrl+R'],
      ['Subdivide faces', () => editor.split()], ['Subdivide smooth (Catmull–Clark)', () => editor.smoothSubdivide()],
      ['Merge at centre', () => editor.merge(), 'M'], ['Smooth vertices', () => editor.smoothVerts(5, 0.5)], ['Flip normals', () => editor.flip()], ['Delete', () => editor.deleteElements(), 'X'],
    ],
    'Heat map': [
      ['Distance from selected vertices', () => editor.showDistanceFromSelection()],
      ['Mean curvature (H)', () => editor.showField({ kind: 'mean' })], ['Gaussian curvature (K)', () => editor.showField({ kind: 'gaussian' })],
      ['Height (y)', () => editor.showField({ kind: 'coord', axis: 1 })],
      ['Bone weights (skinned mesh)', () => { const sk = o?.skin; if (!sk) { editor.say('Select a mesh bound to an armature'); return; } editor.showField({ kind: 'weight', bone: sk.bones.includes(editor.activeBone ?? '') ? editor.activeBone! : sk.bones[0] }); }],
      [editor.showContours ? 'Hide iso-lines' : 'Show iso-lines', () => { editor.showContours = !editor.showContours; editor.emit('select'); }],
      ['Hide heat map', () => editor.clearField()],
    ],
    Object: [
      ['Edit mode', () => editor.toggleEdit(), 'Tab'],
      ['Shade smooth', () => o && editor.setSmooth(o.id, true)], ['Shade flat', () => o && editor.setSmooth(o.id, false)],
      ['Add mirror modifier', () => o && editor.addModifier(o.id, 'mirror')], ['Add subdivision modifier', () => o && editor.addModifier(o.id, 'subsurf')],
      ['Apply modifiers', () => o && editor.applyModifiers(o.id)], ['Clear parent', () => o && editor.setParent(o.id, null)],
      ['Insert keyframe', () => { editor.insertKey(); setTab('timeline'); }, 'I'], ['Clear animation', () => o && editor.clearAnimation(o.id)],
      ['Bind to armature (automatic weights)', () => editor.bindToArmature(), 'Ctrl+P'], ['Unbind from armature', () => o?.skin && editor.unbind(o.id)],
      ['Pose mode (armature)', () => editor.enterPose(), 'Tab'], ['Clear pose', () => editor.resetPose(), 'Alt+R'],
    ],
    View: [['Frame selected', () => vp?.frameSelected(), 'F'], ['Frame all', () => vp?.frameAll(), 'Home'], ['Front', () => vp?.view('front')], ['Right', () => vp?.view('right')], ['Top', () => vp?.view('top')], ['Perspective', () => vp?.view('persp')]],
    Script: [['Open script panel', () => setTab('script')], ['Show the GUI → code log', () => setTab('log')]],
    Examples: [['Browse example projects…', () => setGallery(true)], ...PROJECTS.map((p) => [`${p.icon}  ${p.title}`, () => openExample(p)] as [string, () => void])],
    Help: [['Keyboard shortcuts', () => setHelp(true), '?']],
  };

  const stats = (() => {
    let v = 0, f = 0;
    for (const x of editor.scene.objects) if (x.mesh) { v += x.mesh.verts.length; f += x.mesh.faces.length; }
    return `${editor.scene.objects.length} objects · ${v} verts · ${f} faces`;
  })();

  const toggle = (k: keyof ViewOptions) => setOpts((p) => ({ ...p, [k]: !p[k] }));
  const sep = <span style={{ width: 1, height: 18, background: C.border, margin: '0 4px' }} />;

  return (
    <div style={{ display: 'grid', gridTemplateRows: `30px 36px 1fr ${bottomH}px 22px`, gridTemplateColumns: '220px 1fr 310px', height: '100%', width: '100%', background: C.bg, color: C.text, fontFamily: 'system-ui, -apple-system, Segoe UI, sans-serif', overflow: 'hidden' }} onClick={() => menu && setMenu(null)}>
      <input ref={fileRef} type="file" accept=".json" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; if (f) openFile(f); e.target.value = ''; }} />
      <input ref={importRef} type="file" accept=".obj,.glb,.gltf" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; if (f) importFile(f); e.target.value = ''; }} />

      {/* Menu bar */}
      <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: 2, padding: '0 8px', background: C.panel2, borderBottom: `1px solid ${C.border}`, fontSize: 12, position: 'relative', zIndex: 20 }}>
        {onBack && <button onClick={onBack} title="Back" style={{ background: 'none', border: 'none', color: C.dim, cursor: 'pointer', fontSize: 14, marginRight: 4 }}>←</button>}
        <b style={{ marginRight: 10, letterSpacing: 0.5 }}>MeshLab</b>
        {Object.entries(menus).map(([name, items]) => (
          <div key={name} style={{ position: 'relative' }}>
            <button onClick={(e) => { e.stopPropagation(); setMenu(menu === name ? null : name); }} onMouseEnter={() => menu && setMenu(name)}
              style={{ background: menu === name ? C.raised : 'none', border: 'none', color: C.text, padding: '4px 9px', cursor: 'pointer', fontSize: 12, borderRadius: 3 }}>{name}</button>
            {menu === name && (
              <div style={{ position: 'absolute', top: '100%', left: 0, minWidth: 250, background: C.panel, border: `1px solid ${C.border}`, borderRadius: 4, boxShadow: '0 8px 24px #0008', padding: 4 }}>
                {items.map(([label, fn, key]) => (
                  <div key={label} onClick={() => { setMenu(null); fn?.(); }} style={{ display: 'flex', justifyContent: 'space-between', gap: 16, padding: '5px 10px', cursor: 'pointer', borderRadius: 3 }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = C.raised)} onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
                    <span>{label}</span>{key && <span style={{ color: C.faint }}>{key}</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
        <span style={{ flex: 1 }} />
        <span style={{ color: C.faint, fontSize: 11 }}>Press ? for shortcuts</span>
      </div>

      {/* Toolbar */}
      <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: 4, padding: '0 8px', background: C.panel, borderBottom: `1px solid ${C.border}`, overflowX: 'auto' }}>
        <Btn small active={!edit} onClick={() => editor.exitEdit()} title="Object mode (Tab)">Object</Btn>
        {o?.bones
          ? <Btn small active={editor.mode === 'pose'} onClick={() => editor.enterPose()} title="Pose mode (Tab): rotate bones">Pose</Btn>
          : <Btn small active={edit} onClick={() => editor.enterEdit()} title="Edit mode (Tab)">Edit</Btn>}
        {edit && <>{sep}{(['vert', 'edge', 'face'] as const).map((m, i) => <Btn key={m} small active={editor.selectMode === m} onClick={() => editor.setSelectMode(m)} title={`${m} select (${i + 1})`}>{['Vertex', 'Edge', 'Face'][i]}</Btn>)}</>}
        {sep}
        <Btn small active={gizmo === 'translate'} onClick={() => setGizmo('translate')} title="Move (G)">Move</Btn>
        <Btn small active={gizmo === 'rotate'} onClick={() => setGizmo('rotate')} title="Rotate (R)">Rotate</Btn>
        <Btn small active={gizmo === 'scale'} onClick={() => setGizmo('scale')} title="Scale (S)">Scale</Btn>
        <Btn small active={space === 'world'} onClick={() => setSpace(space === 'local' ? 'world' : 'local')} title="Gizmo axes: the object's own (local) or the world's">{space === 'local' ? 'Local axes' : 'World axes'}</Btn>
        <Btn small active={snap} onClick={() => setSnap(!snap)} title="Snap: 0.25 units, 15°, 0.1 scale">Snap</Btn>
        <Btn small active={boxArmed} onClick={() => vp?.armBoxSelect()} title="Box select (B), then drag">Box</Btn>
        {edit && <>{sep}<Btn small onClick={() => { editor.extrude(0.5); setGizmo('translate'); }} title="Extrude (E)">Extrude</Btn><Btn small onClick={() => editor.inset(0.25)} title="Inset (I)">Inset</Btn><Btn small onClick={loopCut} title="Loop cut (Ctrl+R): point at an edge">Loop cut</Btn><Btn small onClick={() => editor.smoothSubdivide()} title="Catmull–Clark">Smooth ×1</Btn></>}
        {sep}
        {(['grid', 'axes', 'normals', 'wire', 'xray'] as const).map((k) => <Btn key={k} small active={opts[k]} onClick={() => toggle(k)} title={k === 'xray' ? 'See through surfaces' : `Show ${k}`}>{k === 'xray' ? 'X-ray' : k[0].toUpperCase() + k.slice(1)}</Btn>)}
        {sep}
        <Btn small active={editor.traceEnabled} onClick={() => { editor.traceEnabled = !editor.traceEnabled; editor.emit('select'); }} title="Record a step-by-step trace of each mesh operation">● Record traces</Btn>
        {sep}
        <Btn small disabled={!editor.undoStack.length} onClick={() => editor.undo()} title={`Undo ${editor.undoStack.at(-1)?.label ?? ''} (Ctrl+Z)`}>↶</Btn>
        <Btn small disabled={!editor.redoStack.length} onClick={() => editor.redo()} title="Redo (Ctrl+Shift+Z)">↷</Btn>
        {sep}
        <Btn small active onClick={() => setGallery(true)} title="Finished example projects to open and take apart">📂 Examples</Btn>
      </div>

      <div style={{ gridColumn: 1, gridRow: 3, borderRight: `1px solid ${C.border}`, minHeight: 0 }}><Outliner editor={editor} /></div>
      <div ref={viewRef} style={{ gridColumn: 2, gridRow: 3, position: 'relative', minHeight: 0, minWidth: 0, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', left: 10, top: 8, fontSize: 11, color: C.dim, pointerEvents: 'none', zIndex: 1, lineHeight: 1.5, textShadow: '0 1px 2px #000' }}>
          <div style={{ color: edit ? C.accent : editor.mode === 'pose' ? C.blue : C.text, fontWeight: 600 }}>{edit ? `Edit mode · ${editor.selectMode === 'vert' ? 'vertices' : editor.selectMode === 'edge' ? 'edges' : 'faces'}` : editor.mode === 'pose' ? `Pose mode · ${editor.activeBone ?? 'click a bone'}` : 'Object mode'}</div>
          <div>Left-drag orbit · right-drag pan · wheel zoom · click select</div>
        </div>
        <FieldLegend editor={editor} />
        {project && <ProjectGuide project={project} onClose={() => setProject(null)} onShowScript={() => { setIncoming({ code: project.code, lang: project.lang, n: Date.now() }); setTab('script'); }} />}
      </div>
      <div style={{ gridColumn: 3, gridRow: 3, borderLeft: `1px solid ${C.border}`, minHeight: 0 }}><Inspector editor={editor} /></div>

      {/* Bottom panel */}
      <div style={{ gridColumn: '1 / -1', gridRow: 4, display: 'flex', flexDirection: 'column', borderTop: `1px solid ${C.border}`, background: C.panel, minHeight: 0, position: 'relative' }}>
        <div onPointerDown={(e) => {
          const y0 = e.clientY, h0 = bottomH;
          const move = (ev: PointerEvent) => setBottomH(Math.max(120, Math.min(window.innerHeight - 200, h0 - (ev.clientY - y0))));
          const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
          window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
        }} style={{ position: 'absolute', top: -3, left: 0, right: 0, height: 6, cursor: 'ns-resize', zIndex: 5 }} />
        <div style={{ display: 'flex', gap: 2, padding: '3px 6px 0', background: C.panel2, borderBottom: `1px solid ${C.border}` }}>
          {([['trace', 'Algorithm trace'], ['script', 'Script'], ['timeline', `Timeline · ${editor.scene.timeline.frame}`], ['log', `GUI → code (${editor.log.length})`]] as const).map(([k, label]) => (
            <button key={k} onClick={() => setTab(k)} style={{ background: tab === k ? C.panel : 'transparent', color: tab === k ? C.text : C.dim, borderTop: `1px solid ${tab === k ? C.border : 'transparent'}`, borderLeft: `1px solid ${tab === k ? C.border : 'transparent'}`, borderRight: `1px solid ${tab === k ? C.border : 'transparent'}`, borderBottom: 'none', borderRadius: '4px 4px 0 0', padding: '4px 12px', fontSize: 12, cursor: 'pointer' }}>{label}</button>
          ))}
        </div>
        <div style={{ flex: 1, minHeight: 0, display: tab === 'trace' ? 'block' : 'none' }}><TracePanel editor={editor} viewport={vp} /></div>
        <div style={{ flex: 1, minHeight: 0, display: tab === 'script' ? 'block' : 'none' }}>{scriptSeen ? <ScriptPanel editor={editor} onRun={() => vp?.sync()} incoming={incoming} /> : null}</div>
        <div style={{ flex: 1, minHeight: 0, display: tab === 'timeline' ? 'block' : 'none' }}>{tab === 'timeline' ? <Timeline editor={editor} /> : null}</div>
        <div style={{ flex: 1, minHeight: 0, display: tab === 'log' ? 'block' : 'none' }}><LogPanel editor={editor} /></div>
      </div>

      {/* Status bar */}
      <div style={{ gridColumn: '1 / -1', gridRow: 5, display: 'flex', alignItems: 'center', gap: 12, padding: '0 10px', background: C.panel2, borderTop: `1px solid ${C.border}`, fontSize: 11, color: C.dim }}>
        <span style={{ color: C.text }}>{editor.message}</span>
        <span style={{ flex: 1 }} />
        {boxArmed && <span style={{ color: C.accent }}>Drag a box to select</span>}
        <span>{stats}</span>
      </div>

      {help && <Help onClose={() => setHelp(false)} />}
      {gallery && <ProjectGallery onOpen={openExample} onClose={() => setGallery(false)} busy={opening} />}
    </div>
  );
}

function Help({ onClose }: { onClose: () => void }) {
  const keys: [string, string][] = [
    ['Tab', 'Object / Edit mode'], ['1 2 3', 'Vertex / edge / face select (edit mode)'], ['Click, Shift+click', 'Select, add to selection'],
    ['B then drag', 'Box select'], ['A, Alt+A', 'Select all, none'], ['Ctrl+L', 'Select linked'], ['G R S', 'Move / rotate / scale gizmo'],
    ['E', 'Extrude faces'], ['I', 'Inset faces (edit mode); insert keyframe (object mode)'], ['Space', 'Play / pause the animation'], ['← →', 'Previous / next frame'], ['Ctrl+R', 'Loop cut at the edge under the pointer'], ['M', 'Merge vertices at centre'],
    ['X, Delete', 'Delete'], ['Shift+D', 'Duplicate object'], ['H', 'Hide object'], ['F, Home', 'Frame selected, frame all'],
    ['Tab on an armature', 'Pose mode: click a bone, rotate it'], ['Ctrl+P', 'Bind the selected mesh to the active armature'], ['Alt+R (pose mode)', 'Clear the pose'],
    ['Ctrl+Z, Ctrl+Shift+Z', 'Undo, redo'], ['Ctrl+S', 'Save the scene file'], ['Ctrl+Enter', 'Run the script'],
  ];
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: '#0009', display: 'grid', placeItems: 'center', zIndex: 100 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 8, padding: 20, width: 460, maxWidth: '90vw', fontSize: 13 }}>
        <div style={{ display: 'flex', marginBottom: 12 }}><b style={{ flex: 1 }}>Keyboard shortcuts</b><Btn small onClick={onClose}>Close</Btn></div>
        {keys.map(([k, d]) => <div key={k} style={{ display: 'flex', padding: '4px 0', borderBottom: `1px solid ${C.panel2}` }}><span style={{ width: 170, fontFamily: C.mono, color: C.accent }}>{k}</span><span style={{ color: C.text }}>{d}</span></div>)}
        <div style={{ color: C.faint, fontSize: 12, marginTop: 10, lineHeight: 1.5 }}>Keys follow Blender where they can. G, R and S pick the gizmo rather than starting a free move.</div>
      </div>
    </div>
  );
}
