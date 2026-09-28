// The script editor and the GUI → code log.
import React, { useEffect, useRef, useState } from 'react';
import MonacoEditor, { type OnMount } from '@monaco-editor/react';
import type { Editor } from '../core/Editor';
import { runScript } from '../core/api';
import { EXAMPLES } from '../core/examples';
import { Btn, C, useEditorVersion } from './kit';

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
  loopCut(a: number, b: number, t?: number): Mesh; split(faces?: number[]): Mesh;
  /** Catmull–Clark subdivision. */ subdivide(levels?: number): Mesh;
  delete(what: { faces?: number[]; verts?: number[]; edges?: [number, number][] }): Mesh;
  merge(verts: number[], at?: Vec3): Mesh; flip(faces?: number[]): Mesh; weld(tol?: number): Mesh;
  translate(verts: number[], d: Vec3): Mesh; setVerts(map: Record<number, Vec3>): Mesh;
}
interface SceneObject {
  readonly id: string; name: string; readonly kind: 'mesh' | 'empty' | 'light';
  position: Vec3Handle; /** Radians, XYZ order. */ rotation: Vec3Handle; scale: Vec3Handle;
  visible: boolean; smooth: boolean; material: { color: string; roughness: number; metalness: number };
  parent: SceneObject | null; readonly children: SceneObject[];
  readonly mesh: Mesh | null; readonly geometry: Mesh | null;
  /** Column-major 4×4, like three.js Matrix4.elements. */ readonly localMatrix: number[]; readonly worldMatrix: number[];
  modifiers: { add(type: 'mirror' | 'subsurf', opts?: object): SceneObject; set(i: number, patch: object): SceneObject; remove(i: number): SceneObject; apply(): SceneObject; readonly list: object[] };
  delete(): void; duplicate(): SceneObject;
}
interface PrimOpts { name?: string; position?: Vec3; rotation?: Vec3; scale?: Vec3; parent?: SceneObject; size?: number; radius?: number; height?: number; segments?: number; rings?: number; subdivisions?: number; tube?: number; tubeSegments?: number }
declare const scene: {
  add: { cube(o?: PrimOpts): SceneObject; plane(o?: PrimOpts): SceneObject; grid(o?: PrimOpts): SceneObject; circle(o?: PrimOpts): SceneObject; cylinder(o?: PrimOpts): SceneObject; cone(o?: PrimOpts): SceneObject; uvSphere(o?: PrimOpts): SceneObject; torus(o?: PrimOpts): SceneObject; empty(o?: { name?: string; position?: Vec3 }): SceneObject; mesh(o: { name?: string; verts: Vec3[]; faces: number[][]; position?: Vec3 }): SceneObject };
  addCube(o?: PrimOpts): SceneObject; addSphere(o?: PrimOpts): SceneObject;
  get(nameOrId: string): SceneObject; find(nameOrId: string): SceneObject | null;
  readonly objects: SceneObject[]; readonly selected: SceneObject[]; readonly active: SceneObject | null;
  delete(o: SceneObject): void; clear(): void;
};
/** Print to the output panel. */ declare function log(...args: unknown[]): void;
declare function print(...args: unknown[]): void;
`;

const STORE = 'meshlab.script';

export function ScriptPanel({ editor, onRun }: { editor: Editor; onRun?: () => void }) {
  const [code, setCode] = useState(() => { try { return localStorage.getItem(STORE) ?? EXAMPLES[0].code; } catch { return EXAMPLES[0].code; } });
  const [out, setOut] = useState<{ text: string; error?: boolean }[]>([]);
  const codeRef = useRef(code);
  codeRef.current = code;

  const run = () => {
    const r = runScript(editor, codeRef.current);
    setOut([...r.output.map((t) => ({ text: t })), ...(r.error ? [{ text: `Error: ${r.error}\n(The scene was left unchanged.)`, error: true }] : [{ text: '✓ done — one undo step (Ctrl+Z) takes it all back' }])]);
    onRun?.();
  };
  useEffect(() => { try { localStorage.setItem(STORE, code); } catch { /* storage unavailable */ } }, [code]);
  useEffect(() => {
    const load = (e: Event) => setCode((e as CustomEvent<string>).detail);
    window.addEventListener('meshlab:load-script', load);
    return () => window.removeEventListener('meshlab:load-script', load);
  }, []);

  const mount: OnMount = (ed, monaco) => {
    const ts = monaco.languages.typescript;
    ts.javascriptDefaults.setCompilerOptions({ target: ts.ScriptTarget.ES2020, allowNonTsExtensions: true, checkJs: false, lib: ['es2020'] });
    ts.javascriptDefaults.addExtraLib(API_DTS, 'meshlab-api.d.ts');
    ed.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => run());
  };

  return (
    <div style={{ display: 'flex', height: '100%', minHeight: 0 }}>
      <div style={{ width: 190, borderRight: `1px solid ${C.border}`, overflowY: 'auto', flexShrink: 0 }}>
        <div style={{ padding: '6px 10px', color: C.dim, fontSize: 11, fontWeight: 600 }}>EXAMPLES</div>
        {EXAMPLES.map((ex) => (
          <div key={ex.id} title={ex.about} onClick={() => setCode(ex.code)} style={{ padding: '5px 10px', cursor: 'pointer', fontSize: 12, color: C.text, borderTop: `1px solid ${C.border}` }}>
            {ex.title}
            <div style={{ color: C.faint, fontSize: 10.5, lineHeight: 1.35, marginTop: 2 }}>{ex.about}</div>
          </div>
        ))}
      </div>
      <div style={{ flex: 1.6, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', padding: '4px 8px', borderBottom: `1px solid ${C.border}` }}>
          <Btn small active onClick={run} title="Ctrl/Cmd + Enter">▶ Run</Btn>
          <span style={{ color: C.faint, fontSize: 11 }}>Ctrl/⌘+Enter · the same scene the viewport edits · a failing script changes nothing</span>
        </div>
        <div style={{ flex: 1, minHeight: 0 }}>
          <MonacoEditor language="javascript" theme="vs-dark" value={code} onChange={(v) => setCode(v ?? '')} onMount={mount}
            options={{ minimap: { enabled: false }, fontSize: 12.5, scrollBeyondLastLine: false, tabSize: 2, automaticLayout: true, lineNumbers: 'on', wordWrap: 'on' }} />
        </div>
      </div>
      <div style={{ flex: 1, borderLeft: `1px solid ${C.border}`, overflowY: 'auto', fontFamily: C.mono, fontSize: 11.5, padding: '6px 10px', minWidth: 0 }}>
        <div style={{ color: C.dim, fontFamily: 'system-ui', fontSize: 11, fontWeight: 600, marginBottom: 4 }}>OUTPUT</div>
        {out.length === 0 && <div style={{ color: C.faint, fontFamily: 'system-ui' }}>Run a script to see its output. <code>log(…)</code> prints here.</div>}
        {out.map((l, i) => <div key={i} style={{ color: l.error ? C.bad : C.text, whiteSpace: 'pre-wrap', wordBreak: 'break-word', marginBottom: 3 }}>{l.text}</div>)}
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
