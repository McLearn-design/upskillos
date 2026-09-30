// Every challenge must be startable, solvable, and not already solved.
//
// Three assertions carry the weight:
//   - the setup runs, so the challenge opens at all
//   - at least one check FAILS at the start, or there is nothing to do
//   - every check PASSES after the reference solution, or the challenge is
//     unwinnable and the reader will think they are wrong
//
// The second and third together are what a challenge actually is. A check that
// passes at the start is decoration; one that never passes is a trap.
import { describe, expect, it } from 'vitest';
import { Editor } from '../../../engines/mesh/core/Editor';
import { runScript } from '../../../engines/mesh/core/api';
import { CHALLENGES, startChallenge } from './challenges';

const fresh = () => { const e = new Editor(); e.newScene(); return e; };

describe('the challenges [mesh-engine lab]', () => {
  it('there are some, each fully filled in', () => {
    expect(CHALLENGES.length).toBeGreaterThanOrEqual(3);
    for (const c of CHALLENGES) {
      expect(c.id, `${c.id} id`).toMatch(/^[a-z0-9-]+$/);
      expect(c.title.length, `${c.id} title`).toBeGreaterThan(6);
      expect(c.brief.length, `${c.id} brief`).toBeGreaterThan(60);
      expect(c.setup.length, `${c.id} setup`).toBeGreaterThan(40);
      expect(c.solution.length, `${c.id} solution`).toBeGreaterThan(20);
      expect(c.hints.length, `${c.id} hints`).toBeGreaterThanOrEqual(2);
      for (const h of c.hints) expect(h.length, `${c.id} hint too short`).toBeGreaterThan(30);
    }
    expect(new Set(CHALLENGES.map((c) => c.id)).size, 'duplicate ids').toBe(CHALLENGES.length);
  });

  it('each names the lesson it pairs with', () => {
    for (const c of CHALLENGES) {
      expect(c.lesson, `${c.id} lesson`).toMatch(/^Lessons? /);
    }
  });

  it('the brief says what to achieve, not which button to press', () => {
    for (const c of CHALLENGES) {
      expect(c.brief, `${c.id} brief names a menu`).not.toMatch(/›|Mesh >|press [A-Z]\b/);
    }
  });

  for (const c of CHALLENGES) {
    it(`"${c.title}" starts without error`, () => {
      const e = fresh();
      expect(startChallenge(e, c), `${c.id}`).toBeNull();
      expect(e.scene.objects.some((o) => o.mesh), `${c.id} built no geometry`).toBe(true);
    });

    it(`"${c.title}" selects something that exists`, () => {
      if (!c.select) return;
      const e = fresh();
      expect(startChallenge(e, c)).toBeNull();
      expect(e.scene.objects.map((o) => o.name), `${c.id} selects "${c.select}"`)
        .toContain(c.select);
    });

    it(`"${c.title}" is not already solved when it opens`, () => {
      const e = fresh();
      expect(startChallenge(e, c)).toBeNull();
      const checks = c.check(e);
      expect(checks.length, `${c.id} has no checks`).toBeGreaterThan(0);
      expect(checks.some((x) => !x.ok),
        `${c.id}: every check already passes, so there is nothing to do`).toBe(true);
    });

    it(`"${c.title}" passes every check after its own solution`, () => {
      const e = fresh();
      expect(startChallenge(e, c)).toBeNull();
      const r = runScript(e, c.solution);
      expect(r.error, `${c.id} solution threw: ${r.error}`).toBeNull();
      const failed = c.check(e).filter((x) => !x.ok);
      expect(failed.map((x) => `${x.label}${x.detail ? ` (${x.detail})` : ''}`),
        `${c.id}: its own solution does not satisfy it`).toEqual([]);
    });

    it(`"${c.title}" gives every check a readable label`, () => {
      const e = fresh();
      expect(startChallenge(e, c)).toBeNull();
      for (const x of c.check(e)) {
        expect(x.label.length, `${c.id}: a check label is too terse`).toBeGreaterThan(8);
      }
    });
  }
});

describe('what the challenges are actually checking [mesh-engine lab]', () => {
  const start = (id: string) => {
    const c = CHALLENGES.find((x) => x.id === id);
    if (!c) throw new Error(`no challenge called "${id}"`);
    const e = fresh();
    expect(startChallenge(e, c)).toBeNull();
    return { e, c };
  };

  it('"make it a solid" starts exploded and will not accept a reshaped cube', () => {
    const { e, c } = start('weld-it');
    const m = e.scene.get('Part')!.mesh!;
    expect(m.verts.length, 'it should start with 36 separate corners').toBe(36);

    // Welding is the answer. Scaling it down to nothing is not, even though that
    // also changes the vertex count in some naive implementations.
    runScript(e, `scene.get('Part').mesh.weld(1e-6)`);
    expect(c.check(e).every((x) => x.ok)).toBe(true);

    // And a cube that lost faces must fail, not pass on vertex count alone.
    const e2 = fresh();
    startChallenge(e2, c);
    runScript(e2, `const m = scene.get('Part').mesh; m.weld(1e-6); m.delete({ faces: [0] })`);
    expect(c.check(e2).some((x) => !x.ok), 'a cube with a hole should not pass').toBe(true);
  });

  it('"close the hole" will not accept a part that was welded shut instead of filled', () => {
    const { e, c } = start('close-the-hole');
    expect(c.check(e).some((x) => !x.ok), 'it should start with a hole').toBe(true);
    // Deleting the whole mesh is not a fix, and neither is leaving it open.
    runScript(e, `scene.get('Part').mesh.weld(1e-6)`);
    expect(c.check(e).some((x) => !x.ok), 'welding does not close a missing face').toBe(true);
  });

  it('"split it without cracking it" rejects a lone face split', () => {
    const { e, c } = start('split-no-crack');
    // The failure the challenge is about: split one face, crack three edges.
    runScript(e, `scene.get('Part').mesh.split([0])`);
    const after = c.check(e);
    expect(after.some((x) => !x.ok), 'a lone split should not pass').toBe(true);
  });

  it('"flag only the bump" needs a heat map, not just a printed number', () => {
    const { e, c } = start('flag-the-bump');
    expect(c.check(e).some((x) => !x.ok), 'it should start unsatisfied').toBe(true);
    runScript(e, `log('threshold 0.002 flags 12')`);
    expect(c.check(e).some((x) => !x.ok), 'printing a number is not showing the field').toBe(true);
  });
});
