import { describe, expect, it } from 'vitest';
import { Editor } from '../../../engines/mesh/core/Editor';
import { runScript } from '../../../engines/mesh/core/api';
import { CHALLENGES, startChallenge } from './challenges';

describe('challenges', () => {
  for (const c of CHALLENGES) {
    it(`"${c.title}": the start does not pass, the solution does`, () => {
      const e = new Editor();
      expect(startChallenge(e, c)).toBeNull();
      expect(e.undoStack.length).toBe(0);
      const before = c.check(e);
      expect(before.length).toBeGreaterThan(1);
      expect(before.every((x) => x.ok), JSON.stringify(before)).toBe(false);
      const r = runScript(e, c.solution);
      expect(r.error).toBeNull();
      const after = c.check(e);
      expect(after.every((x) => x.ok), JSON.stringify(after)).toBe(true);
      expect(c.hints.length).toBeGreaterThanOrEqual(2);
    });
  }

  it('"Land on frame 20": a key at 20 in the wrong place, or the wrong easing, is not enough', () => {
    const e = new Editor(); startChallenge(e, CHALLENGES[0]);
    runScript(e, `scene.get('Ball').keyframe(20, { position: [0, 0.5, 0] })`);
    const r = CHALLENGES[0].check(e);
    expect(r.slice(0, 3).every((x) => x.ok)).toBe(true);
    expect(r[3].ok).toBe(false); // linear fall: not gravity
  });

  const byId = (id: string) => CHALLENGES.find((c) => c.id === id)!;
  const start = (id: string) => { const e = new Editor(); startChallenge(e, byId(id)); return e; };

  it('"Close the box": a lid wound the wrong way closes the box but fails the outward check', () => {
    const e = start('close-the-box');
    runScript(e, `const m = scene.get('Box').mesh
const f = m.fill(m.verts.filter((v) => v.y > 0.6).map((v) => v.index))
m.flip([f])`);
    expect(byId('close-the-box').check(e).map((x) => x.ok)).toEqual([true, true, false]);
  });

  it('"The farthest point": straight across the hole is the tempting answer, and it is only about 73% of the way', () => {
    const e = start('farthest-point');
    runScript(e, `const p = scene.get('Ring').mesh.verts[24 * 16 + 8]   // the inside, opposite the start
scene.get('Flag').position = [p.x, p.y, p.z]`);
    const r = byId('farthest-point').check(e);
    expect(r[0].ok).toBe(true);
    expect(r[1].ok).toBe(false);
    expect(r[1].detail).toMatch(/^7[23]\.\d% of the farthest distance$/);
  });

  it('"Script a staircase": steps floating off the floor, or all at the same place, are named in the checklist', () => {
    const e = start('staircase');
    runScript(e, `for (let k = 1; k <= 10; k++) scene.add.cube({ name: 'Step ' + k, size: 1, position: [0, 0.1 * k + 0.1, 0.15], scale: [1, 0.2, 0.3] })`);
    const r = byId('staircase').check(e);
    expect(r.map((x) => x.ok)).toEqual([true, true, false, false]);
    expect(r[2].detail).toMatch(/^wrong: Step 1, Step 2, Step 3…$/);
  });
});
