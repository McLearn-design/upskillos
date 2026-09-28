// Python scripts, through Pyodide (CPython compiled to WebAssembly).
//
// Python gets the same `scene` as JavaScript. A thin layer in Python sits in
// between and converts at the boundary: lists, tuples and dicts become JS
// arrays and objects, keyword arguments become the options object the JS API
// takes (scene.add.cube(size=2) is scene.add.cube({ size: 2 })), Python
// functions passed as callbacks receive wrapped arguments, and JS arrays come
// back as Python lists. Recording uses sys.settrace, which calls back before
// every line, the Python counterpart of the statement calls added to JS.
//
// The Pyodide instance is passed in, so the same code runs in the browser and
// in the tests (which load Pyodide from node_modules).

import type { Editor, ScriptResult } from './Editor';
import { finishScript, makeApi, rollbackScript } from './api';
import { Recorder, type Recording } from './recorder';

/** The part of Pyodide used here. */
export interface PyodideLike {
  runPython(code: string, opts?: { globals?: unknown }): unknown;
  globals: { get(name: string): unknown; set(name: string, v: unknown): void };
  setStdout(o: { batched: (s: string) => void }): void;
  setStderr(o: { batched: (s: string) => void }): void;
}

const PRELUDE = String.raw`
import sys, math, inspect
from pyodide.ffi import JsProxy, to_js, create_proxy
from js import Object, Array

_proxies = []

def _arity(f):
    # JavaScript calls callbacks with extra arguments (filter passes element, index,
    # array); a Python function gets only as many as it declares.
    try:
        ps = list(inspect.signature(f).parameters.values())
    except (TypeError, ValueError):
        return None
    if any(p.kind == p.VAR_POSITIONAL for p in ps):
        return None
    return sum(1 for p in ps if p.kind in (p.POSITIONAL_ONLY, p.POSITIONAL_OR_KEYWORD))

def _to_js(v):
    if isinstance(v, _Js):
        return v._js
    if isinstance(v, _JsList):
        return to_js([_to_js(x) for x in v], depth=1)
    if isinstance(v, dict):
        return to_js({str(k): _to_js(x) for k, x in v.items()}, dict_converter=Object.fromEntries, depth=1)
    if isinstance(v, (list, tuple, range)):
        return to_js([_to_js(x) for x in v], depth=1)
    if callable(v) and not isinstance(v, JsProxy):
        f, n = v, _arity(v)
        p = create_proxy(lambda *a: _to_js(f(*[_wrap(x) for x in (a if n is None else a[:n])])))
        _proxies.append(p)
        return p
    return v

def _wrap(v):
    if not isinstance(v, JsProxy):
        return v
    if Array.isArray(v) or (v.typeof == 'object' and hasattr(v, 'BYTES_PER_ELEMENT')):
        return _JsList(v)
    return _Js(v)

class _Js:
    """A JavaScript object from the MeshLab API, used from Python."""
    __slots__ = ('_js',)
    def __init__(self, js):
        object.__setattr__(self, '_js', js)
    def __getattr__(self, k):
        if k.startswith('__'):
            raise AttributeError(k)
        try:
            v = getattr(self._js, k)
        except AttributeError:
            raise AttributeError(f"{self!r} has no attribute '{k}'") from None
        return _wrap(v)
    def __setattr__(self, k, v):
        setattr(self._js, k, _to_js(v))
    def __call__(self, *a, **kw):
        args = [_to_js(x) for x in a]
        if kw:
            args.append(_to_js(kw))
        return _wrap(self._js(*args))
    def __repr__(self):
        try:
            return str(self._js.toString())
        except Exception:
            return '<js object>'
    def __eq__(self, other):
        return isinstance(other, _Js) and self._js == other._js
    def __hash__(self):
        return id(self._js)

class _JsList(list):
    """A JavaScript array as a Python list; extra methods (faces.top()) still work."""
    def __init__(self, js):
        super().__init__(_wrap(x) for x in js)
        self._js = js
    def __getattr__(self, k):
        if k.startswith('__'):
            raise AttributeError(k)
        return _wrap(getattr(self._js, k))

def _vars(frame):
    out = []
    for k, v in list(frame.f_locals.items()):
        if k.startswith('_') or k in ('scene', 'log', 'math', 'pi', 'tau'):
            continue
        if type(v).__name__ in ('module', 'function', 'builtin_function_or_method', 'type'):
            continue
        try:
            r = repr(v)
        except Exception:
            r = '?'
        if len(r) > 70:
            r = r[:69] + '…'
        out.append([k, r])
    return out[-14:]

def _meshlab_run(code, jsapi, hook, record):
    ns = {'__name__': '__main__', 'scene': _wrap(jsapi.scene), 'log': print, 'math': math, 'pi': math.pi, 'tau': math.tau}
    compiled = compile(code, '<meshlab>', 'exec')
    def tracer(frame, event, arg):
        if frame.f_code.co_filename != '<meshlab>':
            return None
        if event == 'line':
            if not hook(frame.f_lineno, to_js(_vars(frame))):
                sys.settrace(None)
                return None
        return tracer
    if record:
        sys.settrace(tracer)
    try:
        exec(compiled, ns)
    finally:
        sys.settrace(None)
        for p in _proxies:
            p.destroy()
        _proxies.clear()
`;

const ready = new WeakSet<object>();

/** Where in the script a Python error happened, and its last line (the exception). */
export function pythonError(e: unknown): { line: number | null; message: string } {
  const text = e instanceof Error ? e.message : String(e);
  const lines = [...text.matchAll(/File "<meshlab>", line (\d+)/g)];
  // An error thrown by the JS API arrives wrapped: "pyodide.ffi.JsException: Error: No object called …".
  const last = (text.trim().split('\n').filter(Boolean).at(-1) ?? text).replace(/^pyodide\.ffi\.JsException: (?:[A-Za-z]*Error: )?/, '');
  const line = lines.length ? Number(lines.at(-1)![1]) : (/line (\d+)/.exec(last)?.[1] ? Number(/line (\d+)/.exec(last)![1]) : null);
  return { line, message: line ? `Line ${line}: ${last}` : last };
}

/** Run a Python script as one undoable step; on any error the scene is left as it was. */
export function runPython(editor: Editor, py: PyodideLike, code: string, label = 'Run Python script', opts: { record?: boolean } = {}): ScriptResult & { recording?: Recording } {
  if (!ready.has(py)) { py.runPython(PRELUDE); ready.add(py); }
  editor.endPreview();
  const output: string[] = [];
  py.setStdout({ batched: (s) => output.push(s) });
  py.setStderr({ batched: (s) => output.push(s) });
  const before = editor.scene.toJSON();
  const api = makeApi(editor, (s) => output.push(s));
  const rec = opts.record ? new Recorder(editor, () => output.length) : null;
  let line: number | null = null;
  const hook = (l: number, vars: [string, string][]) => { line = l; return rec ? rec.event(l, Array.from(vars, (p) => [String(p[0]), String(p[1])] as [string, string])) : true; };
  const recording = (error: { line: number | null; message: string } | null): Recording | undefined => rec
    ? { lang: 'python', code, events: rec.events, scenes: rec.scenes, truncated: rec.truncated, scenesCapped: rec.scenesCapped, output, error }
    : undefined;
  editor.scripting = true;
  try {
    (py.globals.get('_meshlab_run') as (c: string, a: unknown, h: unknown, r: boolean) => void)(code, api, hook, !!opts.record);
    rec?.end();
    finishScript(editor, before, label, code);
    return { output, error: null, recording: recording(null) };
  } catch (e) {
    const err = pythonError(e);
    if (err.line === null && line !== null) err.line = line;
    rec?.end();
    rollbackScript(editor, before);
    return { output, error: err.message, recording: recording(err) };
  }
}
