// Small helpers for writing task checks.
import type { Game } from '../engine/game';
import type { Node } from '../engine/nodes';
import type { NodeData } from '../core/types';
import type { PlayResult, ProjectView } from './types';

/** The first node with this name anywhere in a running game, or null. */
export function named<T = Node>(game: Game, name: string): T | null {
  const visit = (n: Node): Node | null => { if (n.name === name) return n; for (const c of n.children) { const f = visit(c); if (f) return f; } return null; };
  return visit(game.root) as T | null;
}

/** Fail with the first script error of a run, if there was one. */
export function noErrors(r: PlayResult): void { if (r.errors.length) throw new Error(r.errors[0]); }

/** A node's children of a type (in the expanded project). */
export const childrenOf = (n: NodeData | null, type: string): NodeData[] => (n ? n.children.filter((c) => c.type === type) : []);

/** The named node of a type, or a sentence saying it is missing. */
export function need(v: ProjectView, name: string, type: string): NodeData {
  const n = v.byName(name);
  if (!n) throw new Error(`There is no node called ${name} yet.`);
  if (n.type !== type) throw new Error(`${name} is a ${n.type}; it should be a ${type}.`);
  return n;
}

export type Pos = { x: number; y: number };
export type Body = Node & { position: Pos; velocity: Pos; isOnFloor(): boolean; isOnWall(): boolean };
