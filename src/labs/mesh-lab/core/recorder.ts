// Stepping through a script: which line ran, what the variables held, and what
// the scene looked like afterwards.
//
// A script (JavaScript or Python) reports an event before each line runs. The
// recorder keeps the line, the variables and the number of output lines so far,
// and takes a copy of the scene only when it changed, found by a cheap hash
// rather than by serialising the whole scene on every line. The step player then
// shows line k together with the state at event k + 1: the state after line k.

import { parse } from 'acorn';
import type { Editor } from './Editor';
import type { Scene, SceneJSON } from './Scene';

export interface ScriptEvent { line: number; vars: [string, string][]; out: number; scene: number }
export interface Recording {
  lang: 'js' | 'python';
  code: string;
  /** One event before each line ran, and a last one when the script ended. */
  events: ScriptEvent[];
  scenes: SceneJSON[];
  /** Events stopped being recorded after this many; the script still ran to the end. */
  truncated: boolean;
  /** Scene copies stopped (memory cap); later events show the last copy taken. */
  scenesCapped: boolean;
  output: string[];
  error: { line: number | null; message: string } | null;
}

/** A hash of everything a script can change: names, transforms, hierarchy, meshes, modifiers, materials. */
export function sceneHash(scene: Scene): number {
  let h = 2166136261;
  const mix = (x: number) => { h ^= Math.round(x * 1e6) | 0; h = Math.imul(h, 16777619); };
  const mixS = (s: string) => { for (let i = 0; i < s.length; i++) mix(s.charCodeAt(i)); };
  mix(scene.objects.length); mix(scene.timeline.frame); mix(scene.timeline.start); mix(scene.timeline.end); mix(scene.timeline.fps);
  for (const o of scene.objects) {
    mixS(o.id); mixS(o.name); mixS(o.parent ?? '-'); mix(o.visible ? 1 : 0); mix(o.smooth ? 1 : 0);
    for (const v of [o.position, o.rotation, o.scale]) { mix(v[0]); mix(v[1]); mix(v[2]); }
    mixS(o.material.color); mix(o.material.roughness); mix(o.material.metalness);
    mixS(JSON.stringify(o.modifiers)); if (o.anim) mixS(JSON.stringify(o.anim));
    if (o.mesh) {
      mix(o.mesh.verts.length); mix(o.mesh.faces.length);
      for (const p of o.mesh.verts) { mix(p[0]); mix(p[1]); mix(p[2]); }
      for (const f of o.mesh.faces) { mix(f.length); for (const i of f) mix(i); }
    }
  }
  return h >>> 0;
}

export class Recorder {
  readonly events: ScriptEvent[] = [];
  readonly scenes: SceneJSON[] = [];
  truncated = false;
  scenesCapped = false;
  private lastHash = -1;
  private budget: number;

  constructor(private editor: Editor, private outCount: () => number, private maxEvents = 4000, sceneBudget = 3_000_000) {
    this.budget = sceneBudget;
  }

  /** Called before each line. Returns false once the cap is reached, so callers can stop tracing. */
  event(line: number, vars: [string, string][]): boolean {
    if (this.events.length >= this.maxEvents) { this.truncated = true; return false; }
    const h = sceneHash(this.editor.scene);
    if (h !== this.lastHash || !this.scenes.length) {
      // Budget in numbers stored (3 per vertex, plus face indices), so a big loop
      // over a big mesh cannot exhaust memory.
      const size = this.editor.scene.objects.reduce((s, o) => s + 20 + (o.mesh ? o.mesh.verts.length * 3 + o.mesh.faces.reduce((t, f) => t + f.length, 0) : 0), 0);
      if (this.budget >= size || !this.scenes.length) { this.scenes.push(this.editor.scene.toJSON()); this.budget -= size; this.lastHash = h; }
      else this.scenesCapped = true;
    }
    this.events.push({ line, vars, out: this.outCount(), scene: this.scenes.length - 1 });
    return true;
  }

  /** The final event: the state after the last line. */
  end(): void {
    const t = this.truncated;
    this.maxEvents = Infinity;
    this.event(this.events.at(-1)?.line ?? 0, this.events.at(-1)?.vars ?? []);
    this.truncated = t;
  }
}

/** A value, briefly, for the variables panel. */
export function brief(x: unknown, max = 70): string {
  let s: string;
  if (typeof x === 'string') s = JSON.stringify(x);
  else if (typeof x === 'function') s = 'ƒ';
  else if (x && typeof x === 'object' && typeof (x as { toString?: unknown }).toString === 'function' && (x as object).toString !== Object.prototype.toString && !Array.isArray(x)) s = String(x);
  else {
    try { s = JSON.stringify(x, (_k, v) => (typeof v === 'number' ? +v.toFixed(4) : ArrayBuffer.isView(v) ? Array.from(v as unknown as ArrayLike<number>) : v)) ?? String(x); }
    catch { s = String(x); }
  }
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

// ── JavaScript: insert a call before every statement ─────────────────────

type Node = { type: string; start: number; end: number; loc?: { start: { line: number } }; [k: string]: unknown };

function patternNames(p: Node | null | undefined, out: string[]): void {
  if (!p) return;
  if (p.type === 'Identifier') out.push(p.name as string);
  else if (p.type === 'ObjectPattern') for (const q of p.properties as Node[]) patternNames((q.type === 'RestElement' ? q.argument : q.value) as Node, out);
  else if (p.type === 'ArrayPattern') for (const q of p.elements as (Node | null)[]) patternNames(q, out);
  else if (p.type === 'RestElement') patternNames(p.argument as Node, out);
  else if (p.type === 'AssignmentPattern') patternNames(p.left as Node, out);
}

/** Names declared directly in a list of statements (var, let, const, function, class). */
function declared(body: Node[]): string[] {
  const out: string[] = [];
  for (const s of body) {
    if (s.type === 'VariableDeclaration') for (const d of s.declarations as Node[]) patternNames(d.id as Node, out);
    else if ((s.type === 'FunctionDeclaration' || s.type === 'ClassDeclaration') && s.id) out.push((s.id as Node).name as string);
  }
  return out;
}

const HIDDEN = new Set(['scene', 'log', 'print', 'console', '__step']);

/**
 * Rewrite a script so it calls `__step(line, () => variables)` before each
 * statement. Line numbers are those of the original code. Throws a SyntaxError
 * with the line when the script does not parse.
 */
export function instrument(code: string): string {
  const ast = parse(code, { ecmaVersion: 'latest', sourceType: 'script', locations: true, allowReturnOutsideFunction: true }) as unknown as Node;
  const edits: { pos: number; text: string; order: number }[] = [];
  let order = 0;
  const thunk = (names: string[]) => {
    const vis = [...new Set(names)].filter((n) => !HIDDEN.has(n)).slice(-14);
    return `() => { const __v = []; ${vis.map((n) => `try { __v.push([${JSON.stringify(n)}, ${n}]) } catch (__e) {}`).join(' ')} return __v }`;
  };
  const step = (s: Node, names: string[]) => `__step(${s.loc!.start.line}, ${thunk(names)}); `;

  const list = (body: Node[], scope: string[]) => {
    const names = [...scope, ...declared(body)];
    for (const s of body) {
      if (s.type !== 'FunctionDeclaration' && s.type !== 'ClassDeclaration' && s.type !== 'EmptyStatement') edits.push({ pos: s.start, text: step(s, names), order: order++ });
      visit(s, names);
    }
  };
  // A loop or if body that is a single statement: give it braces so the call fits.
  const body = (s: Node | null | undefined, scope: string[]) => {
    if (!s) return;
    if (s.type === 'BlockStatement') { visit(s, scope); return; }
    edits.push({ pos: s.start, text: `{ ${step(s, scope)}`, order: order++ });
    visit(s, scope);
    edits.push({ pos: s.end, text: ' }', order: 1e9 + order++ });
  };
  const fn = (f: Node, scope: string[]) => {
    const params: string[] = [];
    for (const p of f.params as Node[]) patternNames(p, params);
    const b = f.body as Node;
    if (b.type === 'BlockStatement') list(b.body as Node[], [...scope, ...params]);
    else visit(b, [...scope, ...params]);
  };
  const visit = (n: Node | null | undefined, scope: string[]): void => {
    if (!n || typeof n !== 'object') return;
    switch (n.type) {
      case 'Program': case 'BlockStatement': case 'StaticBlock': list(n.body as Node[], scope); return;
      case 'FunctionDeclaration': case 'FunctionExpression': case 'ArrowFunctionExpression': fn(n, scope); return;
      case 'IfStatement': visit(n.test as Node, scope); body(n.consequent as Node, scope); body(n.alternate as Node, scope); return;
      case 'ForStatement': case 'ForInStatement': case 'ForOfStatement': {
        const head: string[] = [];
        const init = (n.init ?? n.left) as Node | null;
        if (init?.type === 'VariableDeclaration') for (const d of init.declarations as Node[]) patternNames(d.id as Node, head);
        const inner = [...scope, ...head];
        for (const k of ['init', 'test', 'update', 'left', 'right']) visit(n[k] as Node, inner);
        body(n.body as Node, inner);
        return;
      }
      case 'WhileStatement': case 'DoWhileStatement': visit(n.test as Node, scope); body(n.body as Node, scope); return;
      case 'LabeledStatement': body(n.body as Node, scope); return;
      case 'SwitchStatement': visit(n.discriminant as Node, scope); for (const c of n.cases as Node[]) list(c.consequent as Node[], scope); return;
      case 'TryStatement': {
        visit(n.block as Node, scope);
        const h = n.handler as Node | null;
        if (h) { const ps: string[] = []; patternNames(h.param as Node, ps); visit(h.body as Node, [...scope, ...ps]); }
        visit(n.finalizer as Node, scope);
        return;
      }
    }
    for (const k of Object.keys(n)) {
      if (k === 'loc' || k === 'type' || k === 'start' || k === 'end') continue;
      const v = n[k];
      if (Array.isArray(v)) v.forEach((c) => c && typeof c === 'object' && 'type' in c && visit(c as Node, scope));
      else if (v && typeof v === 'object' && 'type' in (v as object)) visit(v as Node, scope);
    }
  };
  visit(ast, []);
  // Apply from the end so earlier positions stay valid. Text inserted later at the
  // same position lands in front, so closing braces (large order) are applied last
  // and come out before the next statement's call: `x(); }__step(…); y();`.
  edits.sort((a, b) => b.pos - a.pos || a.order - b.order);
  let out = code;
  for (const e of edits) out = out.slice(0, e.pos) + e.text + out.slice(e.pos);
  return out;
}
