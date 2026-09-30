// Every project must open. A project whose script throws shows an error where
// the scene should be, which is exactly how this lab failed to open once: its
// content still reached for MeshLab's examples and the module threw on load.
//
// So: run each one, check it built something, check its setup names things that
// exist, and check every guide step that has a tick is not already ticked.
import { describe, expect, it } from 'vitest';
import { Editor } from '../../../engines/mesh/core/Editor';
import { PROJECTS, PROJECT_GROUPS, openProject, startState, stepText } from './projects';

const fresh = () => { const e = new Editor(); e.newScene(); return e; };

describe('the projects [mesh-engine lab]', () => {
  it('there are some, each fully filled in', () => {
    expect(PROJECTS.length).toBeGreaterThanOrEqual(6);
    for (const p of PROJECTS) {
      expect(p.id, `${p.id} id`).toMatch(/^[a-z0-9-]+$/);
      expect(p.title.length, `${p.id} title`).toBeGreaterThan(6);
      expect(p.desc.length, `${p.id} desc`).toBeGreaterThan(40);
      expect(p.code.length, `${p.id} code`).toBeGreaterThan(100);
      expect(p.guide.length, `${p.id} guide`).toBeGreaterThanOrEqual(3);
      expect(PROJECT_GROUPS, `${p.id} group`).toContain(p.group);
      expect(['js', 'python'], `${p.id} lang`).toContain(p.lang);
    }
    expect(new Set(PROJECTS.map((p) => p.id)).size, 'duplicate ids').toBe(PROJECTS.length);
  });

  it('each names the lesson it pairs with, so the lab and the course cannot drift', () => {
    for (const p of PROJECTS) {
      expect(p.lesson, `${p.id} lesson`).toMatch(/^Lessons? /);
      expect(p.lesson.length, `${p.id} lesson should name the title too`).toBeGreaterThan(14);
    }
  });

  it('every group has at least one project, so no tab in the browser is empty', () => {
    for (const g of PROJECT_GROUPS) {
      expect(PROJECTS.some((p) => p.group === g), `nothing in "${g}"`).toBe(true);
    }
  });

  for (const p of PROJECTS.filter((x) => x.lang === 'js')) {
    it(`"${p.title}" opens, builds a scene and prints something`, () => {
      const e = fresh();
      const r = openProject(e, p);
      expect(r.error, `${p.id}: ${r.error}`).toBeNull();
      const meshes = e.scene.objects.filter((o) => o.mesh);
      expect(meshes.length, `${p.id} built no geometry`).toBeGreaterThan(0);
      expect(r.output.join('').trim().length, `${p.id} printed nothing`).toBeGreaterThan(0);
    });
  }

  it("each setup selects an object the script actually made", () => {
    for (const p of PROJECTS.filter((x) => x.lang === 'js')) {
      if (!p.setup.select) continue;
      const e = fresh();
      expect(openProject(e, p).error, p.id).toBeNull();
      const names = e.scene.objects.map((o) => o.name);
      expect(names, `${p.id} selects "${p.setup.select}", which it never built`)
        .toContain(p.setup.select);
    }
  });

  it('no guide step is already ticked when the project opens', () => {
    // A step that starts done is not something to do, and it makes the guide
    // look half-finished before the reader has touched anything.
    for (const p of PROJECTS.filter((x) => x.lang === 'js')) {
      const e = fresh();
      expect(openProject(e, p).error, p.id).toBeNull();
      const start = startState(e);
      for (const g of p.guide) {
        if (typeof g === 'string') continue;
        expect(g.done(e, start), `${p.id}: "${stepText(g)}" is ticked before anything was done`)
          .toBe(false);
      }
    }
  });

  it('every guide step reads like an instruction, not a label', () => {
    for (const p of PROJECTS) {
      for (const g of p.guide) {
        expect(stepText(g).length, `${p.id}: a guide step is too short to act on`)
          .toBeGreaterThan(30);
      }
    }
  });
});

describe('what the projects demonstrate [mesh-engine lab]', () => {
  const open = (id: string) => {
    const p = PROJECTS.find((x) => x.id === id);
    if (!p) throw new Error(`no project called "${id}"`);
    const e = fresh();
    const r = openProject(e, p);
    expect(r.error, `${id}: ${r.error}`).toBeNull();
    return { e, out: r.output.join('\n') };
  };
  const meshNamed = (e: Editor, name: string) => {
    const m = e.scene.objects.find((o) => o.name === name)?.mesh;
    if (!m) throw new Error(`no mesh called "${name}"`);
    return m;
  };
  const edges = (m: ReturnType<typeof meshNamed>) => [...m.edges().values()];

  it('the hand-built cube really is closed: 8 / 18 / 12, Euler 2', () => {
    const { e } = open('cube-by-hand');
    const m = meshNamed(e, 'Cube');
    const E = edges(m);
    expect([m.verts.length, E.length, m.faces.length]).toEqual([8, 18, 12]);
    expect(E.filter((x) => x.faces.length === 1).length, 'boundary').toBe(0);
    expect(m.verts.length - E.length + m.faces.length, 'Euler').toBe(2);
  });

  it('the welding project shows 8 against 36 before anything is welded', () => {
    const { e, out } = open('welded-or-exploded');
    expect(meshNamed(e, 'Welded').verts.length).toBe(8);
    expect(meshNamed(e, 'Exploded').verts.length, 'the exploded one should start at 36').toBe(36);
    expect(edges(meshNamed(e, 'Exploded')).filter((x) => x.faces.length === 1).length,
      'every edge of an exploded mesh is a boundary edge').toBe(36);
    expect(out).toMatch(/36/);
  });

  it('the boundary hunt leaves a real hole to find', () => {
    const { e } = open('boundary-hunt');
    const m = meshNamed(e, 'Part');
    expect(edges(m).filter((x) => x.faces.length === 1).length,
      'there is nothing to find').toBeGreaterThan(0);
    expect(e.field, 'the hole was not made findable').toBeTruthy();
  });

  it('the nearest-point project measures an overshoot rather than asserting one', () => {
    const { out } = open('nearest-and-why');
    const m = /overshoot\s+([\d.]+)%/.exec(out);
    expect(m, 'no overshoot was reported').toBeTruthy();
    expect(Number(m![1]), 'a corner should overshoot the surface distance').toBeGreaterThan(0);
  });

  it('the deviation project produces a signed field with material removed', () => {
    const { e, out } = open('deviation-field');
    expect(e.field, 'no heat map').toBeTruthy();
    const cut = /vertices cut\s+(\d+)/.exec(out);
    expect(cut, 'it never said how much was cut').toBeTruthy();
    expect(Number(cut![1]), 'nothing was cut, so there is no deviation to see')
      .toBeGreaterThan(0);
  });

  it('the threshold project flags fewer vertices as the threshold rises', () => {
    const { out } = open('threshold-decides');
    const counts = out.split('\n')
      .map((l) => /^0\.\d+\s+(\d+)/.exec(l.trim()))
      .filter(Boolean).map((m) => Number(m![1]));
    expect(counts.length, 'no threshold table').toBeGreaterThanOrEqual(4);
    for (let i = 1; i < counts.length; i++) expect(counts[i]).toBeLessThanOrEqual(counts[i - 1]);
    expect(counts[0]).toBeGreaterThan(counts[counts.length - 1]);
  });

  it('the splitting project doubles the rim exactly, and says that is not a crack', () => {
    const { e, out } = open('split-without-cracking');
    const m = meshNamed(e, 'Plate');
    expect(m.faces.length, 'nothing was split').toBeGreaterThan(36);
    expect(edges(m).filter((x) => x.faces.length === 1).length, 'rim should double 24 -> 48').toBe(48);
    expect(out).toMatch(/no interior crack/i);
  });

  it('the colour project colours a scalar with no features in it', () => {
    const { e, out } = open('ramp-honesty');
    expect(e.field, 'no heat map').toBeTruthy();
    expect(out, 'it should quote the measured non-uniformity').toMatch(/27\.9x/);
  });
});
