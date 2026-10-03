// The Cliff Walk example (examples/cliffWalk.ts) on the real engine with its own scripts: you can walk it with the
// keys, and the textbook result (Sutton & Barto, Example 6.6) comes out of Game Studio's own learners: Q-learning
// learns the shortest walk along the spikes, SARSA a safer walk along the top, and SARSA earns more while exploring.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';
import { Doc } from '../core/doc';
import { newProject } from '../core/project';
import { importOrder, rewriteImports } from '../runtime/scripts';
import { Game, scriptGlobals } from '../engine/game';
import { NODE_CLASSES, type Node } from '../engine/nodes';
import type { Project } from '../core/types';
import { cliffWalk, CLIFF_SPEC } from '../examples/cliffWalk';
import { GameEnv, type ClassLoader } from './env';
import { QLearner, type QOptions, type QPolicy } from './qlearning';
import { greedy } from './brain';

const pngSize = (path: string) => { const b = readFileSync(fileURLToPath(new URL(`../starter/${path.replace(/^assets\//, '')}`, import.meta.url))); return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) }; };
const load: ClassLoader = async (project) => {
  Object.assign(globalThis, NODE_CLASSES);   // a script's class extends a node class as it loads
  const classes = new Map<string, unknown>(), urls = new Map<string, string>();
  const { order, imports } = importOrder(project.scripts);
  for (const path of order) {
    const src = rewriteImports(project.scripts.find((x) => x.path === path)!.source, new Map([...imports.get(path)!].map(([spec, target]) => [spec, urls.get(target)!])));
    urls.set(path, `data:text/javascript;base64,${Buffer.from(src).toString('base64')}`);
    classes.set(path, (await import(/* @vite-ignore */ urls.get(path)!)).default);
  }
  return classes;
};
const build = () => { const d = new Doc(newProject('Cliff Walk')); for (const p of cliffWalk.images) d.importAsset(p, { mime: 'image/png', ...pngSize(p) }); d.runCode('Build', cliffWalk.code); return d; };
afterAll(() => { for (const k of ['input', 'scene', 'time', 'math', 'physics', 'ai', 'Vec2', 'PhysicsBody2D', ...Object.keys(NODE_CLASSES)]) delete (globalThis as Record<string, unknown>)[k]; });

function train(env: GameEnv, opts: QOptions): { policy: QPolicy; returns: number[] } {
  const L = new QLearner(env, opts), returns: number[] = [];
  for (;;) { const t = L.tick(); if (t.episode) returns.push(t.episode.total); if (t.policy) return { policy: t.policy, returns }; }
}
const textbook = (algorithm: QOptions['algorithm'], seed: number): QOptions => ({ episodes: 500, algorithm, alpha: 0.5, gamma: 1, epsilon: 0.1, schedule: 'constant', seed, checkEvery: 0 });
/** The greedy walk from the start (state = column × 4 + row): its moves, and its cells along the top row and next to the spikes. */
function walk(policy: QPolicy): { moves: number; top: number; edge: number } {
  let x = 0, y = 3, moves = 0, top = 0, edge = 0;
  while (!(x === 11 && y === 3) && moves < 60) {
    const a = greedy(policy.table[x * 4 + y]), d = [[0, -1], [1, 0], [0, 1], [-1, 0]][a];
    x = Math.min(11, Math.max(0, x + d[0])); y = Math.min(3, Math.max(0, y + d[1]));
    if (y === 3 && x > 0 && x < 11) { x = 0; y = 3; }
    moves++; if (y === 0) top++; if (y === 2 && x > 0 && x < 11) edge++;
  }
  return { moves, top, edge };
}
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

async function play(project: Project, frames: number, keys: string[] = []): Promise<{ x: number; y: number; total: number; atChest: boolean }> {
  const classes = await load(project);
  Object.assign(globalThis, NODE_CLASSES);
  const game = new Game(project, project.scenes[0], { frame: () => {} }, { scriptClass: (p) => classes.get(p) as typeof Node | undefined, onError: (e) => { throw new Error(e.message); } });
  Object.assign(globalThis, scriptGlobals(game));
  game.start();
  for (const k of keys) { game.input.key(k, true); game.step(1 / 60); game.input.key(k, false); game.step(1 / 60); }
  for (let f = 0; f < frames; f++) game.step(1 / 60);
  const w = game.root.find('Walker') as unknown as { cell: { x: number; y: number }; total: number; atChest: boolean };
  return { x: w.cell.x, y: w.cell.y, total: w.total, atChest: w.atChest };
}

describe('Cliff Walk', () => {
  it('a person walks it with the arrow keys: the best walk is 13 moves, return −13; the spikes send you back', async () => {
    const p = build().project;
    const best = ['ArrowUp', ...Array(11).fill('ArrowRight'), 'ArrowDown'];
    expect(await play(p, 0, best)).toEqual({ x: 11, y: 3, total: -13, atChest: true });
    expect(await play(p, 0, ['ArrowRight'])).toEqual({ x: 0, y: 3, total: -100, atChest: false });
  });

  it('its environment: 48 states (the cell), 4 moves, 6 frames a decision, drawn on the grid', async () => {
    const env = await GameEnv.create(build().project, CLIFF_SPEC, load);
    expect(env.actionNames).toEqual(['up', 'right', 'down', 'left']);
    expect(env.observationNames).toEqual(['column', 'row']);
    expect(env.frameSkip).toBe(6);
    expect(env.reset(1).observation).toEqual([0, 3]);
    expect(env.step(1)).toMatchObject({ observation: [0, 3], reward: -100, terminated: false });
  });

  it('Q-learning learns the shortest walk along the spikes; SARSA a safer one along the top (Example 6.6)', async () => {
    const env = await GameEnv.create(build().project, CLIFF_SPEC, load);
    const q = walk(train(env, textbook('q', 1)).policy), sarsa = walk(train(env, textbook('sarsa', 1)).policy);
    expect(q).toEqual({ moves: 13, top: 0, edge: 10 });
    expect(sarsa.edge).toBeLessThanOrEqual(1);
    expect(sarsa.top).toBeGreaterThanOrEqual(8);
  }, 120000);

  it('while exploring (ε = 0.1), SARSA earns more per episode than Q-learning, which falls off its edge path', async () => {
    const env = await GameEnv.create(build().project, CLIFF_SPEC, load);
    const late = (algorithm: QOptions['algorithm']) => mean([1, 2, 3].map((seed) => mean(train(env, textbook(algorithm, seed)).returns.slice(-100))));
    const q = late('q'), sarsa = late('sarsa');
    expect(sarsa).toBeGreaterThan(q);
  }, 180000);

  it('saved as a brain, it walks the game itself: 13 moves to the chest, no keys pressed', async () => {
    const d = build();
    const env = await GameEnv.create(d.project, CLIFF_SPEC, load);
    const { policy } = train(env, textbook('q', 1));
    d.saveBrain('brains/walker.json', { actions: env.actionNames, observation: env.observationNames, method: 'q', policy, trained: { steps: 500, score: -13, random: -1000 } });
    const r = await play(d.project, 13 * 6 - 1);   // 13 decisions, the first on frame 1
    expect(r).toEqual({ x: 11, y: 3, total: -13, atChest: true });
  }, 120000);
});
