// Links into the mesh-engine lab, for lessons: open a finished example project or start a challenge.
//
//   #/lab/mesh-engine-lab?project=walk-cycle        opens the "Walk cycle" example project
//   #/lab/mesh-engine-lab?challenge=six-squares     starts the "Six squares" challenge
//
// Lessons build them with meshEngineLabLink(), so an id that does not exist fails a test
// instead of opening an empty lab.

import { PROJECTS } from './core/projects';
import { CHALLENGES } from './core/challenges';

export type MeshEngineLabTarget = { kind: 'project' | 'challenge'; id: string };

/** The in-app path (for <Link to> or navigate()) that opens a project or challenge. Throws on an unknown id. */
export function meshEngineLabLink(kind: 'project' | 'challenge', id: string): string {
  const known = kind === 'project' ? PROJECTS.some((p) => p.id === id) : CHALLENGES.some((c) => c.id === id);
  if (!known) throw new Error(`this lab has no ${kind} called "${id}"`);
  return `/lab/mesh-engine-lab?${kind}=${encodeURIComponent(id)}`;
}

/** What a location hash asks the lab to open, if anything. */
export function parseMeshEngineLabLink(hash: string): MeshEngineLabTarget | null {
  const q = new URLSearchParams(hash.split('?')[1] ?? '');
  const project = q.get('project'), challenge = q.get('challenge');
  if (project) return { kind: 'project', id: project };
  if (challenge) return { kind: 'challenge', id: challenge };
  return null;
}
