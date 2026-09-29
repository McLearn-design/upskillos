import { describe, expect, it } from 'vitest';
import { Editor } from './Editor';
import { runScript } from './api';
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
});
