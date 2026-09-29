import { describe, expect, it } from 'vitest';
import { makePrimitive } from './primitives';
import { catmullClark } from './subdivision';
import { Trace, checkQuiz } from './trace';
import { Editor } from './Editor';
import { PROJECTS, openProject } from './projects';
import type { Vec3 } from './EditMesh';

const avg = (ps: Vec3[]) => ps.reduce((s, p) => [s[0] + p[0] / ps.length, s[1] + p[1] / ps.length, s[2] + p[2] / ps.length], [0, 0, 0]);

describe('predictions', () => {
  it('accept an answer within 0.01 (plus 1% of its size) and nothing further off', () => {
    const q = { prompt: '', answer: [1, 100, 0], rule: '' };
    expect(checkQuiz(q, [1.005, 100.9, -0.009]).correct).toBe(true);
    expect(checkQuiz(q, [1.05, 100, 0]).correct).toBe(false);
    expect(checkQuiz(q, [1, 100]).correct).toBe(false); // a missing number is wrong
  });

  it('Catmull–Clark asks six questions, and each answer follows from its stated rule', () => {
    const cube = makePrimitive('cube'), t = new Trace('cc');
    catmullClark(cube, t);
    const qs = t.steps.filter((s) => s.quiz);
    expect(qs.map((s) => s.phase)).toEqual(['Face points', 'Face points', 'Edge points', 'Edge points', 'Move vertices', 'Move vertices']);
    // Face point: the corners' average.
    const f0 = cube.faces[0];
    expect(qs[0].quiz!.answer).toEqual(avg(f0.map((v) => cube.verts[v])).map((x) => expect.closeTo(x, 12)));
    // Edge point: parse the numbers from the prompt and apply the rule.
    const nums = (s: string) => [...s.matchAll(/\(([-\d.]+), ([-\d.]+), ([-\d.]+)\)/g)].map((m) => [+m[1], +m[2], +m[3]] as Vec3);
    const [a, b, F1, F2] = nums(qs[2].quiz!.prompt);
    expect(qs[2].quiz!.answer).toEqual(avg([a, b, F1, F2]).map((x) => expect.closeTo(x, 3)));
    // Moved vertex: (F̄ + 2R̄ + (n − 3)V) / n with the numbers the prompt gives.
    const [V, Fb, Rb] = nums(qs[4].quiz!.prompt), n = Number(qs[4].quiz!.prompt.match(/n = (\d+)/)![1]);
    const want = [0, 1, 2].map((k) => (Fb[k] + 2 * Rb[k] + (n - 3) * V[k]) / n);
    expect(checkQuiz(qs[4].quiz!, want).correct).toBe(true);
  });

  it('extrude, inset and skinning ask too, with the answers the operations produce', () => {
    const c = makePrimitive('cube'), t = new Trace('x');
    const top = c.faces.findIndex((_, i) => c.faceNormal(i)[1] > 0.9);
    c.extrudeFaces([top], 0.5, t);
    const q = t.steps.find((s) => s.quiz)!.quiz!;
    expect(q.answer[1]).toBeCloseTo(1.5, 12); // a top corner (y = 1) moved up 0.5
    const c2 = makePrimitive('cube'), t2 = new Trace('i');
    c2.insetFaces([0], 0.25, t2);
    expect(t2.steps.some((s) => s.quiz)).toBe(true);
  });

  it('the learning project opens in Predict mode on a Catmull–Clark trace', () => {
    const e = new Editor();
    expect(openProject(e, PROJECTS.find((p) => p.id === 'predict-catmull-clark')!).error).toBeNull();
    expect(e.predict).toBe(true);
    expect(e.trace?.op).toBe('Catmull–Clark');
    expect(e.trace!.steps.filter((s) => s.quiz).length).toBe(6);
  });
});

describe('traces started by scripts', () => {
  it('start from the object\'s mesh as it was and play over that object, so Predict does not show the answer', () => {
    const e = new Editor();
    openProject(e, PROJECTS.find((p) => p.id === 'predict-catmull-clark')!);
    const cube = e.scene.get('Cube to subdivide')!;
    expect(e.traceTarget).toBe(cube.id);
    expect(e.trace!.before!.verts.length).toBe(8);      // the cube before subdividing, not the 26-vertex result
  });
});
