// Every script-panel example must run. One that throws teaches nothing, and one
// that quietly does nothing is worse - so each is also checked for having left
// something in the scene and printed something.
//
// The measurement assertions below are the point: they check the examples report
// the numbers their lessons claim, not merely that they execute.
import { describe, expect, it } from 'vitest';
import { Editor } from '../../../engines/mesh/core/Editor';
import { runScript } from '../../../engines/mesh/core/api';
import { EXAMPLES, PY_EXAMPLES } from './examples';

const fresh = () => { const e = new Editor(); e.newScene(); return e; };
const run = (id: string) => {
  const ex = EXAMPLES.find((x) => x.id === id);
  if (!ex) throw new Error(`no example called "${id}"`);
  const e = fresh();
  const r = runScript(e, ex.code);
  return { e, r, out: r.output.join('\n') };
};
const mesh = (e: Editor, name: string) => {
  const o = e.scene.objects.find((x) => x.name === name);
  if (!o?.mesh) throw new Error(`no mesh called "${name}"`);
  return o.mesh;
};
const edges = (m: ReturnType<typeof mesh>) => [...m.edges().values()];

describe('the JavaScript examples [mesh-engine lab]', () => {
  it('there are some, each with an id, a title, prose and code', () => {
    expect(EXAMPLES.length).toBeGreaterThanOrEqual(5);
    for (const ex of EXAMPLES) {
      expect(ex.id, `${ex.id} id`).toMatch(/^[a-z0-9-]+$/);
      expect(ex.title.length, `${ex.id} title`).toBeGreaterThan(8);
      expect(ex.about.length, `${ex.id} about`).toBeGreaterThan(40);
      expect(ex.code.length, `${ex.id} code`).toBeGreaterThan(80);
    }
    expect(new Set(EXAMPLES.map((e) => e.id)).size).toBe(EXAMPLES.length);
  });

  it('each names the lesson it pairs with, so the lab and the course stay tied', () => {
    for (const ex of EXAMPLES) {
      expect(ex.about, `${ex.id} should name its lesson`).toMatch(/Lessons? \d/);
    }
  });

  for (const ex of EXAMPLES) {
    it(`"${ex.title}" runs, builds something and prints something`, () => {
      const e = fresh();
      const r = runScript(e, ex.code);
      expect(r.error, `${ex.id}: ${r.error}`).toBeNull();
      expect(e.scene.objects.length, `${ex.id} left an empty scene`).toBeGreaterThan(0);
      expect(r.output.join('').trim().length, `${ex.id} printed nothing`).toBeGreaterThan(0);
    });
  }
});

describe('what the examples actually measure [mesh-engine lab]', () => {
  it('the hand-built cube is closed: 8 verts, 12 faces, 18 edges, Euler 2', () => {
    const { e } = run('cube-from-numbers');
    const m = mesh(e, 'Cube by hand');
    const E = edges(m);
    expect(m.verts.length).toBe(8);
    expect(m.faces.length).toBe(12);
    expect(E.length).toBe(18);
    expect(E.filter((x) => x.faces.length === 1).length, 'boundary edges').toBe(0);
    expect(E.filter((x) => x.faces.length > 2).length, 'non-manifold edges').toBe(0);
    expect(m.verts.length - E.length + m.faces.length, 'Euler').toBe(2);
  });

  it('the exploded cube starts at 36 corners and welds down to 8', () => {
    const { e, out } = run('welded-or-exploded');
    expect(mesh(e, 'Welded').verts.length).toBe(8);
    // The script welds the right-hand one at the end, so by now it matches.
    const was = mesh(e, 'Exploded');
    expect(was.verts.length, 'welding did not collapse the duplicates').toBe(8);
    expect(edges(was).filter((x) => x.faces.length === 1).length).toBe(0);
    // And it must have shown the before state, or the comparison is invisible.
    expect(out).toMatch(/Exploded\s+verts 36/);
    expect(out).toMatch(/after welding/i);
  });

  it('the distance example is explicit that a corner is not the surface', () => {
    const { out } = run('nearest-vertex');
    expect(out).toMatch(/nearest vertex/i);
    expect(out, 'it must say the corner overshoots').toMatch(/corner/i);
  });

  it('the threshold example flags fewer vertices as the threshold rises', () => {
    const { r } = run('threshold-live');
    const counts = r.output
      .map((l) => /^0\.\d+\s+(\d+)/.exec(l.trim()))
      .filter(Boolean)
      .map((m) => Number(m![1]));
    expect(counts.length, 'no threshold rows printed').toBeGreaterThanOrEqual(4);
    for (let i = 1; i < counts.length; i++) {
      expect(counts[i], `count rose from ${counts[i - 1]} to ${counts[i]}`)
        .toBeLessThanOrEqual(counts[i - 1]);
    }
    expect(counts[0], 'the loosest and tightest threshold flagged the same number')
      .toBeGreaterThan(counts[counts.length - 1]);
  });

  it('splitting the plate doubles the rim exactly and opens no interior crack', () => {
    const { e, out } = run('split-and-count');
    const m = mesh(e, 'Plate');
    expect(m.faces.length, 'the split did not happen').toBeGreaterThan(36);
    // A 6x6 grid has 36 quads and a 24-edge rim. Splitting every face makes
    // 144 faces and a 48-edge rim: each rim edge became two, and no interior
    // edge lost a neighbour. Anything other than exact doubling is a crack.
    const boundary = edges(m).filter((x) => x.faces.length === 1).length;
    expect(boundary, 'the rim should double, not merely change').toBe(48);
    expect(edges(m).filter((x) => x.faces.length > 2).length, 'non-manifold').toBe(0);
    expect(out).toMatch(/no interior crack/);
  });

  it('the colour example colours a scalar that has no features in it', () => {
    const { e, out } = run('ramp-honesty');
    expect(e.field, 'no heat map was shown').toBeTruthy();
    expect(out).toMatch(/27\.9x/);
  });
});

describe('the Python examples [mesh-engine lab]', () => {
  it('each has an id, a title, prose and code, and names its lesson', () => {
    expect(PY_EXAMPLES.length).toBeGreaterThanOrEqual(2);
    for (const ex of PY_EXAMPLES) {
      expect(ex.id).toMatch(/^[a-z0-9-]+$/);
      expect(ex.about, `${ex.id} should name its lesson`).toMatch(/Lessons? \d/);
      expect(ex.code.length).toBeGreaterThan(80);
    }
    expect(new Set(PY_EXAMPLES.map((e) => e.id)).size).toBe(PY_EXAMPLES.length);
  });

  it('they are Python, not JavaScript pasted into the wrong list', () => {
    for (const ex of PY_EXAMPLES) {
      expect(ex.code, `${ex.id} looks like JavaScript`).not.toMatch(/\bconst |\blet |=>/);
      expect(ex.code, `${ex.id} never prints`).toMatch(/print\(/);
    }
  });
});
