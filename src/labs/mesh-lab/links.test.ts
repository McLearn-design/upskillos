import { describe, expect, it } from 'vitest';
import { meshLabLink, parseMeshLabLink } from './links';
import { PROJECTS } from './core/projects';
import { CHALLENGES } from './core/challenges';

describe('links into MeshLab', () => {
  it('build a path for every project and challenge, and read it back', () => {
    for (const p of PROJECTS) expect(parseMeshLabLink('#' + meshLabLink('project', p.id))).toEqual({ kind: 'project', id: p.id });
    for (const c of CHALLENGES) expect(parseMeshLabLink('#' + meshLabLink('challenge', c.id))).toEqual({ kind: 'challenge', id: c.id });
    expect(meshLabLink('project', 'walk-cycle')).toBe('/lab/mesh-lab?project=walk-cycle');
  });
  it('refuse an id that does not exist, and ignore a plain lab link', () => {
    expect(() => meshLabLink('project', 'no-such-thing')).toThrow(/no project called/);
    expect(parseMeshLabLink('#/lab/mesh-lab')).toBeNull();
  });
});
