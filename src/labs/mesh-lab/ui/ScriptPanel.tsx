// The script editor and the GUI → code log.
import React, { useEffect, useRef, useState } from 'react';
import MonacoEditor, { type OnMount } from '@monaco-editor/react';
import type { Editor, ScriptResult } from '../../../engines/mesh/core/Editor';
import { runScript } from '../../../engines/mesh/core/api';
import { EXAMPLES, PY_EXAMPLES } from '../core/examples';
import { runPython, type PyodideLike } from '../../../engines/mesh/core/python';
import type { Recording } from '../../../engines/mesh/core/recorder';
import { getPyodide } from '../../../utils/pyodideRuntime';
import { CODE_SPEEDS, usePlaybackTicker } from '../../../utils/playback';
import { Btn, C, useEditorVersion } from '../../../engines/mesh/ui/kit';

// Type declarations so the editor autocompletes the scene API.
const API_DTS = `
type Vec3 = [number, number, number];
interface Vec3Handle { x: number; y: number; z: number; set(x: number, y: number, z: number): Vec3Handle; toArray(): Vec3 }
interface Vertex extends Vec3Handle { readonly index: number; readonly normal: Vec3 }
interface Face { index: number; verts: number[]; readonly normal: Vec3; readonly center: Vec3; readonly area: number }
interface FaceList extends Array<Face> { facing(dir: Vec3, tol?: number): number[]; top(): number[]; bottom(): number[]; where(pred: (f: Face) => boolean): number[] }
interface MeshStats { verts: number; edges: number; faces: number; tris: number; euler: number; closed: boolean; components: number; volume: number; area: number }
interface Mesh {
  /** Vertex handles: read or assign x, y, z. */ readonly verts: Vertex[]; readonly vertices: Vertex[];
  readonly faces: FaceList; readonly edges: { a: number; b: number; faces: number[]; length: number }[];
  stats(): MeshStats; nearest(p: Vec3): number;
  /** Flat typed arrays, as sent to the GPU. */ buffer(): { positions: Float32Array; indices: Uint32Array };
  extrude(faces: number[], distance?: number): Mesh; inset(faces: number[], amount?: number): Mesh;
  /** Inset faces as one region by a distance (Blender's I). */ insetRegion(faces: number[], thickness?: number): Mesh;
  /** Bevel edges: width along the neighbouring edges; segments across (more = rounder). */ bevel(edges: [number, number][], width?: number, segments?: number): Mesh;
  /** Remove vertices, edges or faces, keeping the shape. */ dissolve(what: { verts?: number[]; edges?: [number, number][]; faces?: number[] }): Mesh;
  loopCut(a: number, b: number, t?: number): Mesh; split(faces?: number[]): Mesh;
  /** Catmull–Clark subdivision. */ subdivide(levels?: number): Mesh;
  delete(what: { faces?: number[]; verts?: number[]; edges?: [number, number][] }): Mesh;
  merge(verts: number[], at?: Vec3): Mesh; flip(faces?: number[]): Mesh; weld(tol?: number): Mesh;
  translate(verts: number[], d: Vec3): Mesh; setVerts(map: Record<number, Vec3>): Mesh;
  /** Mean curvature H (1/r on a sphere of radius r) or Gaussian K (angle defect ÷ area), one per vertex. */ curvature(kind?: 'mean' | 'gaussian'): number[];
  /** Distance along the surface from the given vertices, by the heat method. */ geodesic(from: number | number[]): number[];
  /** Laplacian smoothing: move each vertex λ of the way to its neighbours' average, repeatedly. Boundary stays. */ smooth(opts?: { verts?: number[]; iterations?: number; lambda?: number; method?: 'uniform' | 'cotan' }): Mesh;
  /** The pieces the seams cut the surface into (traced): faces, V, E, F, χ, boundary loops, and whether each is a disc. */ charts(): { faces: number; V: number; E: number; F: number; chi: number; boundaries: number; disc: boolean }[];
  /** The iso-line where a per-vertex field equals level (traced): how many triangles it crosses, closed loops, open chains, total length. */ isoLine(values: number[], level: number): { crossed: number; loops: number; open: number; length: number };
  /** Implicit smoothing: one backward heat step (M + tC) x' = M x, t = strength · h²; stable for any strength. Boundary stays. */ smoothImplicit(opts?: { verts?: number[]; strength?: number; iterations?: number }): Mesh;
  /** The cotan Laplacian: per vertex, [neighbour, weight] pairs (the diagonal is the vertex itself), and its area. */ laplacian(): { rows: [number, number][][]; mass: number[] };
  /** UV seams: edges where the surface is cut to lie flat. */ markSeams(edges: [number, number][]): Mesh; clearSeams(edges?: [number, number][]): Mesh; readonly seams: [number, number][];
  /** Mark every edge sharper than this angle as a seam. */ seamsFromSharp(degrees?: number): Mesh;
  /** Flatten onto the UV square: LSCM per chart (default), a projection from above (planar) or around the y axis (cylinder). */ unwrap(opts?: { method?: 'lscm' | 'planar' | 'cylinder' }): Mesh;
  /** [u, v] per face corner, or null. */ readonly uv: [number, number][][] | null; uvDistortion(): number[];
  /** Colour the mesh as a heat map. */ showField(what: 'geodesic' | 'mean' | 'gaussian' | 'x' | 'y' | 'z' | 'weight' | 'uv' | number[], opts?: { from?: number | number[]; /** Same as from (from is a keyword in Python). */ source?: number | number[]; label?: string }): Mesh;
}
interface SceneObject {
  readonly id: string; name: string; readonly kind: 'mesh' | 'empty' | 'light';
  position: Vec3Handle; /** Radians, XYZ order. */ rotation: Vec3Handle; scale: Vec3Handle;
  visible: boolean; smooth: boolean; material: { color: string; roughness: number; metalness: number; shader: 'pbr' | 'lambert' | 'blinn-phong' | 'toon' | 'normals' | 'uv' | 'custom'; texture: 'none' | 'checker' | 'grid' | 'bricks' | 'wood' | 'stripes' | 'grass'; textureScale: number; shininess: number; /** GLSL body of shade(N, L, V, uv, base, light) */ glsl: string };
  parent: SceneObject | null; readonly children: SceneObject[];
  readonly mesh: Mesh | null; readonly geometry: Mesh | null;
  /** Column-major 4×4, like three.js Matrix4.elements. */ readonly localMatrix: number[]; readonly worldMatrix: number[];
  modifiers: { add(type: 'mirror' | 'subsurf', opts?: object): SceneObject; set(i: number, patch: object): SceneObject; remove(i: number): SceneObject; apply(): SceneObject; readonly list: object[] };
  delete(): void; duplicate(): SceneObject;
  /** Stats of the mesh as shown, modifiers applied (mesh.stats() is the cage). */ evaluatedStats(): MeshStats;
  /** How bone motions are blended on a bound mesh: averaging points, or averaging rigid motions (no candy wrapper). */ skinning: 'linear' | 'dual-quaternion';
  /** Weight paint by script: brush dabs at points (the mesh's own space) on one bone. */
  paintWeights(bone: string, opts: { points: Vec3[]; brush?: 'draw' | 'add' | 'subtract' | 'blur'; radius?: number; strength?: number; value?: number; normalize?: boolean; mirror?: boolean }): SceneObject;
  /** Pin channels to values at a frame (no values: key the current position, rotation and scale). interp is how it leaves this key. */
  keyframe(frame: number, values?: { position?: Vec3 | Vec3Handle; rotation?: Vec3 | Vec3Handle; scale?: Vec3 | Vec3Handle; interp?: 'constant' | 'linear' | 'ease' | 'ease-in' | 'ease-out' }): SceneObject;
  deleteKeyframe(frame: number): SceneObject; setInterpolation(frame: number, interp: 'constant' | 'linear' | 'ease' | 'ease-in' | 'ease-out'): SceneObject;
  /** How rotation is interpolated between keys: each Euler angle separately, or quaternion slerp (shortest path, even speed). */ rotationMode: 'euler' | 'quaternion';
  readonly animation: { position?: Key[]; rotation?: Key[]; scale?: Key[]; rotationMode?: string } | null;
  clearAnimation(): SceneObject;
  /** The transform at a frame, without going there. */ sample(frame: number): { position: Vec3; rotation: Vec3; scale: Vec3 };
}
interface Key { frame: number; value: Vec3; interp: 'constant' | 'linear' | 'ease' | 'ease-in' | 'ease-out' }
interface PrimOpts { name?: string; position?: Vec3; rotation?: Vec3; scale?: Vec3; parent?: SceneObject; size?: number; radius?: number; height?: number; segments?: number; rings?: number; subdivisions?: number; tube?: number; tubeSegments?: number }
declare const scene: {
  add: { cube(o?: PrimOpts): SceneObject; plane(o?: PrimOpts): SceneObject; grid(o?: PrimOpts): SceneObject; circle(o?: PrimOpts): SceneObject; cylinder(o?: PrimOpts): SceneObject; cone(o?: PrimOpts): SceneObject; uvSphere(o?: PrimOpts): SceneObject; torus(o?: PrimOpts): SceneObject; empty(o?: { name?: string; position?: Vec3; rotation?: Vec3; scale?: Vec3; parent?: SceneObject }): SceneObject; mesh(o: { name?: string; verts: Vec3[]; faces: number[][]; position?: Vec3; rotation?: Vec3; scale?: Vec3; parent?: SceneObject }): SceneObject };
  addCube(o?: PrimOpts): SceneObject; addSphere(o?: PrimOpts): SceneObject;
  get(nameOrId: string): SceneObject; find(nameOrId: string): SceneObject | null;
  readonly objects: SceneObject[]; readonly selected: SceneObject[]; readonly active: SceneObject | null;
  delete(o: SceneObject): void; clear(): void;
  /** Stop showing a heat map. */ hideField(): void;
  /** The current frame; setting it moves animated objects. */ frame: number;
  readonly timeline: { start: number; end: number; fps: number }; setTimeline(t: { start?: number; end?: number; fps?: number }): void;
};
/** Print to the output panel. */ declare function log(...args: unknown[]): void;
declare function print(...args: unknown[]): void;
`;

type Lang = 'js' | 'python';
const STORE: Record<Lang, string> = { js: 'meshlab.script', python: 'meshlab.script.py' };
const LANG_STORE = 'meshlab.script.lang';
const read = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const write = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* storage unavailable */ } };

const STEP_CSS = `.ml-step-line { background: rgba(255,159,28,0.22); } .ml-step-glyph { background: #ff9f1c; width: 4px !important; margin-left: 4px; }
.ml-err-line { background: rgba(248,113,113,0.22); }`;

type Line = { text: string; error?: boolean; note?: boolean };

/** Code to load into the editor from outside (an example project); a new `n` loads it again. */
export interface IncomingScript { code: string; lang: 'js' | 'python'; n: number }

export function ScriptPanel({ editor, onRun, incoming }: { editor: Editor; onRun?: () => void; incoming?: IncomingScript | null }) {
  useEditorVersion(editor);
  const [lang, setLang] = useState<Lang>(() => (read(LANG_STORE) === 'python' ? 'python' : 'js'));
  const [codes, setCodes] = useState<Record<Lang, string>>(() => ({ js: read(STORE.js) ?? EXAMPLES[0].code, python: read(STORE.python) ?? PY_EXAMPLES[0].code }));
  const code = codes[lang];
  const [out, setOut] = useState<Line[]>([]);
  const [py, setPy] = useState<'idle' | 'loading' | 'ready' | 'failed'>('idle');
  const [busy, setBusy] = useState(false);
  // The step player.
  const [rec, setRec] = useState<Recording | null>(null);
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState('2x');
  const edRef = useRef<Parameters<OnMount>[0] | null>(null);
  const monacoRef = useRef<Parameters<OnMount>[1] | null>(null);
  const deco = useRef<string[]>([]);
  const shownScene = useRef(-1);
  const codeRef = useRef(code); codeRef.current = code;
  const langRef = useRef(lang); langRef.current = lang;

  const setCode = (v: string) => setCodes((c) => ({ ...c, [langRef.current]: v }));
  useEffect(() => { write(STORE.js, codes.js); write(STORE.python, codes.python); }, [codes]);
  useEffect(() => { write(LANG_STORE, lang); }, [lang]);
  useEffect(() => {
    const load = (e: Event) => { setLang('js'); setCodes((c) => ({ ...c, js: (e as CustomEvent<string>).detail })); };
    window.addEventListener('meshlab:load-script', load);
    return () => window.removeEventListener('meshlab:load-script', load);
  }, []);
  useEffect(() => {
    if (!incoming) return;
    closePlayer();
    setLang(incoming.lang);
    setCodes((c) => ({ ...c, [incoming.lang]: incoming.code }));
    setOut([]);
  }, [incoming?.n]); // eslint-disable-line react-hooks/exhaustive-deps

  const closePlayer = () => {
    setRec(null); setPlaying(false); shownScene.current = -1;
    if (edRef.current) deco.current = edRef.current.deltaDecorations(deco.current, []);
    editor.endPreview();
  };
  useEffect(() => () => editor.endPreview(), [editor]);

  const exec = async (record: boolean) => {
    if (busy) return;
    closePlayer();
    let r: ScriptResult & { recording?: Recording };
    if (langRef.current === 'python') {
      setBusy(true);
      if (py !== 'ready') setPy('loading');
      let pyodide: PyodideLike;
      try { pyodide = (await getPyodide()) as unknown as PyodideLike; setPy('ready'); }
      catch (e) { setPy('failed'); setBusy(false); setOut([{ text: `Python could not start: ${e instanceof Error ? e.message : e}`, error: true }]); return; }
      r = runPython(editor, pyodide, codeRef.current, 'Run Python script', { record });
      setBusy(false);
    } else r = runScript(editor, codeRef.current, 'Run script', { record });
    setOut([...r.output.map((t) => ({ text: t })), ...(r.error ? [{ text: `Error: ${r.error}\n(The scene was left unchanged.)`, error: true }] : [{ text: '✓ done — one undo step (Ctrl+Z) takes it all back', note: true }])]);
    if (record && r.recording && r.recording.events.length > 1) { setRec(r.recording); setStep(0); }
    else if (r.recording?.error?.line && edRef.current && monacoRef.current) {
      const l = r.recording.error.line;
      deco.current = edRef.current.deltaDecorations(deco.current, [{ range: new monacoRef.current.Range(l, 1, l, 1), options: { isWholeLine: true, className: 'ml-err-line' } }]);
    }
    onRun?.();
  };
  const execRef = useRef(exec); execRef.current = exec;

  // Step k is the k-th line that ran; what it shows is the state after it (event k + 1).
  const total = rec ? rec.events.length - 1 : 0;
  const cur = rec && total > 0 ? { line: rec.events[Math.min(step, total - 1)].line, after: rec.events[Math.min(step, total - 1) + 1] } : null;
  usePlaybackTicker(playing && !!rec, CODE_SPEEDS[speed] ?? CODE_SPEEDS['1x'], total, setStep, setPlaying);

  useEffect(() => {
    if (!rec || !cur) return;
    if (cur.after.scene !== shownScene.current) { shownScene.current = cur.after.scene; editor.preview(rec.scenes[cur.after.scene]); }
    const ed = edRef.current, m = monacoRef.current;
    if (!ed || !m) return;
    const marks = [{ range: new m.Range(cur.line, 1, cur.line, 1), options: { isWholeLine: true, className: 'ml-step-line', glyphMarginClassName: 'ml-step-glyph' } }];
    const last = step >= total - 1;
    if (last && rec.error?.line) marks.push({ range: new m.Range(rec.error.line, 1, rec.error.line, 1), options: { isWholeLine: true, className: 'ml-err-line', glyphMarginClassName: '' } });
    deco.current = ed.deltaDecorations(deco.current, marks);
    ed.revealLineInCenterIfOutsideViewport(cur.line);
  }, [rec, step]); // eslint-disable-line react-hooks/exhaustive-deps

  // Any real edit (a tool, undo) ends the preview; then the recording no longer matches the scene.
  useEffect(() => { if (rec && shownScene.current >= 0 && !editor.previewing) closePlayer(); });

  const mount: OnMount = (ed, monaco) => {
    edRef.current = ed; monacoRef.current = monaco;
    const ts = monaco.languages.typescript;
    ts.javascriptDefaults.setCompilerOptions({ target: ts.ScriptTarget.ES2020, allowNonTsExtensions: true, checkJs: false, lib: ['es2020'] });
    ts.javascriptDefaults.addExtraLib(API_DTS, 'meshlab-api.d.ts');
    ed.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => execRef.current(false));
  };

  const examples = lang === 'python' ? PY_EXAMPLES : EXAMPLES;
  const shownOut: Line[] = rec && cur
    ? [...rec.output.slice(0, cur.after.out).map((t) => ({ text: t })), ...(step >= total - 1 && rec.error ? [{ text: `Error: ${rec.error.message}`, error: true }] : [])]
    : out;

  return (
    <div style={{ display: 'flex', height: '100%', minHeight: 0 }}>
      <style>{STEP_CSS}</style>
      <div style={{ width: 190, borderRight: `1px solid ${C.border}`, overflowY: 'auto', flexShrink: 0 }}>
        <div style={{ padding: '6px 10px', color: C.dim, fontSize: 11, fontWeight: 600 }}>EXAMPLES · {lang === 'python' ? 'PYTHON' : 'JAVASCRIPT'}</div>
        {examples.map((ex) => (
          <div key={ex.id} title={ex.about} onClick={() => { closePlayer(); setCode(ex.code); }} style={{ padding: '5px 10px', cursor: 'pointer', fontSize: 12, color: C.text, borderTop: `1px solid ${C.border}` }}>
            {ex.title}
            <div style={{ color: C.faint, fontSize: 10.5, lineHeight: 1.35, marginTop: 2 }}>{ex.about}</div>
          </div>
        ))}
      </div>
      <div style={{ flex: 1.6, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', padding: '4px 8px', borderBottom: `1px solid ${C.border}` }}>
          <Btn small active={lang === 'js'} onClick={() => { closePlayer(); setLang('js'); }}>JavaScript</Btn>
          <Btn small active={lang === 'python'} onClick={() => { closePlayer(); setLang('python'); }} title="Python 3 in the browser (Pyodide). The same scene API; keyword arguments are the options: size=2">Python</Btn>
          <span style={{ width: 8 }} />
          <Btn small active disabled={busy} onClick={() => exec(false)} title="Ctrl/Cmd + Enter">▶ Run</Btn>
          <Btn small disabled={busy} onClick={() => exec(true)} title="Run, recording every line; then step back and forth and watch the scene change with the code">⏯ Step through</Btn>
          <span style={{ color: C.faint, fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {py === 'loading' ? 'Starting Python (the first time downloads it)…' : 'Ctrl/⌘+Enter · one undo step · a failing script changes nothing'}
          </span>
        </div>
        {rec && cur && (
          <div data-testid="step-player" style={{ display: 'flex', gap: 4, alignItems: 'center', padding: '4px 8px', borderBottom: `1px solid ${C.border}`, background: C.panel2, flexWrap: 'wrap' }}>
            <Btn small onClick={() => { setPlaying(false); setStep(0); }} title="First line">⏮</Btn>
            <Btn small onClick={() => { setPlaying(false); setStep((s) => Math.max(0, s - 1)); }} title="Back one line">◀</Btn>
            <Btn small active={playing} onClick={() => { if (step >= total - 1) setStep(0); setPlaying(!playing); }}>{playing ? '❚❚ Pause' : '▶ Play'}</Btn>
            <Btn small onClick={() => { setPlaying(false); setStep((s) => Math.min(total - 1, s + 1)); }} title="Forward one line">▶</Btn>
            <Btn small onClick={() => { setPlaying(false); setStep(total - 1); }} title="Last line">⏭</Btn>
            <input type="range" min={0} max={total - 1} value={step} onChange={(e) => { setPlaying(false); setStep(Number(e.target.value)); }} style={{ flex: 1, minWidth: 80, accentColor: C.accent }} />
            <span style={{ fontFamily: C.mono, fontSize: 11, color: C.text, whiteSpace: 'nowrap' }}>{step + 1}/{total} · line {cur.line}</span>
            {Object.keys(CODE_SPEEDS).map((k) => <Btn key={k} small active={speed === k} onClick={() => setSpeed(k)}>{k}</Btn>)}
            <Btn small onClick={closePlayer} title="Stop stepping and show the finished scene">Back to result</Btn>
          </div>
        )}
        <div style={{ flex: 1, minHeight: 0 }}>
          <MonacoEditor language={lang === 'python' ? 'python' : 'javascript'} theme="vs-dark" value={code}
            onChange={(v) => { if (rec) closePlayer(); setCode(v ?? ''); }} onMount={mount}
            options={{ minimap: { enabled: false }, fontSize: 12.5, scrollBeyondLastLine: false, tabSize: lang === 'python' ? 4 : 2, automaticLayout: true, lineNumbers: 'on', wordWrap: 'on', glyphMargin: true }} />
        </div>
      </div>
      <div style={{ flex: 1, borderLeft: `1px solid ${C.border}`, overflowY: 'auto', fontFamily: C.mono, fontSize: 11.5, padding: '6px 10px', minWidth: 0 }}>
        {rec && cur && (
          <div style={{ marginBottom: 10 }}>
            <div style={{ color: C.dim, fontFamily: 'system-ui', fontSize: 11, fontWeight: 600, marginBottom: 4 }}>VARIABLES AFTER LINE {cur.line}</div>
            {cur.after.vars.length === 0 && <div style={{ color: C.faint, fontFamily: 'system-ui' }}>None yet.</div>}
            {cur.after.vars.map(([k, v]) => (
              <div key={k} style={{ display: 'flex', gap: 8, padding: '2px 0', borderBottom: `1px solid ${C.panel2}` }}>
                <span style={{ color: C.accent, minWidth: 60 }}>{k}</span><span style={{ color: C.text, wordBreak: 'break-all' }}>{v}</span>
              </div>
            ))}
            <div style={{ color: C.faint, fontFamily: 'system-ui', fontSize: 11, marginTop: 6, lineHeight: 1.4 }}>
              The viewport shows the scene as it was after this line. {rec.scenes.length} different states in {total} lines.
              {rec.truncated && ' Recording stopped after 4000 lines; the script still ran to the end.'}
              {rec.scenesCapped && ' Scene copies stopped at the memory limit; later lines show the last copy.'}
            </div>
          </div>
        )}
        <div style={{ color: C.dim, fontFamily: 'system-ui', fontSize: 11, fontWeight: 600, marginBottom: 4 }}>OUTPUT{rec ? ' SO FAR' : ''}</div>
        {shownOut.length === 0 && <div style={{ color: C.faint, fontFamily: 'system-ui' }}>{rec ? 'Nothing printed yet.' : <>Run a script to see its output. <code>{lang === 'python' ? 'print(…)' : 'log(…)'}</code> prints here.</>}</div>}
        {shownOut.map((l, i) => <div key={i} style={{ color: l.error ? C.bad : l.note ? C.ok : C.text, whiteSpace: 'pre-wrap', wordBreak: 'break-word', marginBottom: 3 }}>{l.text}</div>)}
      </div>
    </div>
  );
}

export function LogPanel({ editor }: { editor: Editor }) {
  useEditorVersion(editor);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ block: 'nearest' }); }, [editor.log.length]);
  const all = editor.log.map((l) => l.code).filter(Boolean).join('\n');
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', padding: '4px 8px', borderBottom: `1px solid ${C.border}` }}>
        <span style={{ color: C.dim, fontSize: 11 }}>Every action you take, as the script line that does the same thing.</span>
        <span style={{ flex: 1 }} />
        <Btn small disabled={!all} onClick={() => window.dispatchEvent(new CustomEvent('meshlab:load-script', { detail: `// Recorded from the GUI. Run it on a new scene to rebuild the model.\n${all}` }))}>Open as script</Btn>
        <Btn small disabled={!all} onClick={() => navigator.clipboard?.writeText(all)}>Copy</Btn>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', fontFamily: C.mono, fontSize: 11.5, padding: '4px 10px' }}>
        {editor.log.length === 0 && <div style={{ color: C.faint, fontFamily: 'system-ui', fontSize: 12, padding: 6 }}>Nothing yet. Add an object, move it, extrude a face: each step appears here as code.</div>}
        {editor.log.map((l, i) => (
          <div key={i} style={{ padding: '3px 0', borderBottom: `1px solid ${C.panel2}` }}>
            <span style={{ color: C.faint }}>// {l.label}</span>
            <div style={{ color: '#c9d4e3', whiteSpace: 'pre-wrap' }}>{l.code}</div>
          </div>
        ))}
        <div ref={end} />
      </div>
    </div>
  );
}
