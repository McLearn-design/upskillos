import { describe, expect, it } from 'vitest';
import { meshEngineLabLink, parseMeshEngineLabLink } from './links';
import { PROJECTS } from './core/projects';
import { CHALLENGES } from './core/challenges';

describe('links into the mesh-engine lab [mesh-engine lab]', () => {
  it('build a path for every project and challenge, and read it back', () => {
    for (const p of PROJECTS) {
      expect(parseMeshEngineLabLink('#' + meshEngineLabLink('project', p.id)))
        .toEqual({ kind: 'project', id: p.id });
    }
    for (const c of CHALLENGES) {
      expect(parseMeshEngineLabLink('#' + meshEngineLabLink('challenge', c.id)))
        .toEqual({ kind: 'challenge', id: c.id });
    }
  });

  it('point at this lab, not the other one', () => {
    // A lesson that links to the wrong lab opens a Blender-style modeller and the
    // reader has no idea why. The route is the only thing keeping them apart.
    const link = meshEngineLabLink('project', PROJECTS[0].id);
    expect(link).toBe(`/lab/mesh-engine-lab?project=${PROJECTS[0].id}`);
    expect(link).not.toContain('/lab/mesh-lab?');
  });

  it('refuse an id that does not exist, and ignore a plain lab link', () => {
    expect(() => meshEngineLabLink('project', 'no-such-thing')).toThrow(/no project called/);
    expect(() => meshEngineLabLink('challenge', 'no-such-thing')).toThrow(/no challenge called/);
    expect(parseMeshEngineLabLink('#/lab/mesh-engine-lab')).toBeNull();
  });

  it('refuse a MeshLab id, because the two labs share no content', () => {
    // MeshLab's projects are about making geometry and do not exist here. If one
    // of its ids ever resolves, the two labs' content has been mixed up — which
    // is exactly the failure that stopped this lab opening once already.
    for (const id of ['walk-cycle', 'rig-character', 'six-squares']) {
      expect(() => meshEngineLabLink('project', id), `${id} should not exist here`).toThrow();
    }
  });
});
