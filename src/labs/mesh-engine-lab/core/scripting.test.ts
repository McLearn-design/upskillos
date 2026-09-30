import { beforeAll, describe, expect, it } from 'vitest';
import { loadPyodide } from 'pyodide';
import { Editor } from '../../../engines/mesh/core/Editor';
import { runScript } from '../../../engines/mesh/core/api';
import { instrument } from '../../../engines/mesh/core/recorder';
import { runPython, type PyodideLike } from '../../../engines/mesh/core/python';

const fresh = () => { const e = new Editor(); e.newScene(); return e; };

describe('recording a JavaScript script [mesh-engine lab]', () => {
  it('instrumented code behaves like the original, including single-statement bodies', () => {
    const code = `let s = 0\nfor (let i = 0; i < 4; i++) s += i\nif (s > 5) s *= 2; else s = -1\nlet t = 0; while (t < 3) t++\nconst f = (x) => x * 2\nfunction g(y) { return y + 1 }\nreturn [s, t, f(3), g(1)]`;
    const plain = new Function(code)();
    const traced = new Function('__step', instrument(code))(() => {});
    expect(traced).toEqual(plain);
    expect(plain).toEqual([12, 3, 6, 2]);
  });

  it('records each line with its variables and the scene after it', () => {
    const e = fresh();
    const r = runScript(e, `const c = scene.add.cube({ name: 'A' })\nc.position.x = 2\nfor (let i = 0; i < 3; i++) {\n  c.position.y = i\n}\nlog('done')`, 'Run', { record: true });
    expect(r.error).toBeNull();
    const rec = r.recording!;
    expect(rec.events.map((x) => x.line)).toEqual([1, 2, 3, 4, 4, 4, 6, 6]);
    // Before line 2 runs, c exists at x = 0; after it (the event for line 3), x = 2.
    expect(rec.events[1].vars.find(([k]) => k === 'c')![1]).toBe('Mesh "A"');
    const at = (k: number) => rec.scenes[rec.events[k].scene].objects.find((o) => o.name === 'A');
    expect(at(0)).toBeUndefined();
    expect(at(1)!.position[0]).toBe(0);
    expect(at(2)!.position[0]).toBe(2);
    expect(at(7)!.position[1]).toBe(2);
    expect(rec.events.at(-1)!.out).toBe(1);
    // Unchanged states share one copy: 1 before the cube, then cube, x = 2, y = 1, y = 2.
    expect(rec.scenes.length).toBe(5);
    expect(e.undoStack.at(-1)!.label).toBe('Run');
  });

  it('reports the line of an error and leaves the scene untouched', () => {
    const e = fresh();
    const n = e.scene.objects.length;
    const r = runScript(e, `scene.add.cube()\nconst x = 1\nnope()`, 'Run', { record: true });
    expect(r.error).toMatch(/nope is not defined/);
    expect(r.recording!.error!.line).toBe(3);
    expect(e.scene.objects.length).toBe(n);
  });

  it('stops recording at the cap but still runs to the end', () => {
    const e = fresh();
    const r = runScript(e, `let s = 0\nfor (let i = 0; i < 10000; i++) s += i\nlog(s)`, 'Run', { record: true });
    expect(r.output).toEqual(['49995000']);
    expect(r.recording!.truncated).toBe(true);
    expect(r.recording!.events.length).toBe(4001);
  });

  it('assigning a whole position works', () => {
    const e = fresh();
    runScript(e, `const c = scene.add.cube({ name: 'P' }); c.position = [1, 2, 3]; c.scale = c.position`);
    const o = e.scene.get('P')!;
    expect(o.position).toEqual([1, 2, 3]);
    expect(o.scale).toEqual([1, 2, 3]);
  });
});

describe('Python [mesh-engine lab]', () => {
  let py: PyodideLike;
  beforeAll(async () => { py = (await loadPyodide()) as unknown as PyodideLike; }, 60000);

  it('uses the same scene API: keyword options, lists, handles, callbacks', () => {
    const e = fresh();
    const r = runPython(e, py, [
      "c = scene.add.cube(name='Py', size=2, position=[0, 1, 0])",
      'm = c.mesh',
      'top = m.faces.top()',
      'm.extrude(top, 0.5)',
      'for v in m.verts:',
      '    v.x *= 1.5',
      'c.rotation.y = pi / 4',
      'c.position = (3, 0, 0)',
      'big = m.faces.where(lambda f: f.area > 5)',
      "c.modifiers.add('subsurf', levels=1)",
      "print(len(m.verts), len(top), len(big), c)",
    ].join('\n'), 'Run Python');
    expect(r.error).toBeNull();
    // Faces over area 5 after widening x by 1.5: top, bottom and the two z-facing sides (3 × 2 = 6).
    // The x-facing sides are 2 × 2 = 4 and the new walls are 0.5 high.
    expect(r.output).toEqual(['12 1 4 Mesh "Py"']);
    const o = e.scene.get('Py')!;
    expect(o.position).toEqual([3, 0, 0]);
    expect(o.rotation[1]).toBeCloseTo(Math.PI / 4, 12);
    expect(o.mesh!.verts.every((v) => Math.abs(Math.abs(v[0]) - 1.5) < 1e-12)).toBe(true);
    expect(o.modifiers).toEqual([{ type: 'subsurf', levels: 1, enabled: true }]);
    expect(e.undoStack.at(-1)!.label).toBe('Run Python');
  });

  it('records lines and variables with sys.settrace', () => {
    const e = fresh();
    const r = runPython(e, py, "s = 0\nfor i in range(3):\n    s += i\nb = scene.add.uvSphere(name='B')\nprint(s)", 'Run', { record: true });
    expect(r.error).toBeNull();
    const ev = r.recording!.events;
    expect(ev.map((x) => x.line)).toEqual([1, 2, 3, 2, 3, 2, 3, 2, 4, 5, 5]);
    expect(Object.fromEntries(ev.at(-1)!.vars)).toMatchObject({ s: '3', b: 'Mesh "B"' });
    expect(r.recording!.scenes.length).toBe(2); // before the sphere, and after
  });

  it('a Python error names the line, and the scene is rolled back', () => {
    const e = fresh();
    const n = e.scene.objects.length;
    const r = runPython(e, py, "scene.add.cube()\nx = 1\nscene.get('Missing')", 'Run', { record: true });
    expect(r.error).toBe('Line 3: No object called "Missing"');
    expect(runPython(e, py, 'x = 1\ny = undefined_name').error).toBe("Line 2: NameError: name 'undefined_name' is not defined");
    expect(e.scene.objects.length).toBe(n);
    const s = runPython(e, py, 'def f(:\n  pass');
    expect(s.error).toMatch(/SyntaxError/);
  });
});

describe('Python examples [mesh-engine lab]', () => {
  let py: PyodideLike;
  beforeAll(async () => { py = (await loadPyodide()) as unknown as PyodideLike; }, 60000);

  it('every Python example runs, and the curvature one prints the exact Gauss–Bonnet total', async () => {
    const { PY_EXAMPLES } = await import('./examples');
    for (const ex of PY_EXAMPLES) {
      const e = fresh();
      const r = runPython(e, py, ex.code);
      expect(r.error, ex.id).toBeNull();
      if (ex.id === 'py-curvature') {
        expect(r.output[2]).toBe('sum of K * area 12.566371  4 pi = 12.566371');
        expect(e.field?.spec.kind).toBe('geodesic');
      }
      if (ex.id === 'py-stairs') expect(e.scene.objects.filter((o) => o.name.startsWith('Step')).length).toBe(6);
    }
  });
});
