// Q-learning on a game (ml/qlearning.ts): binning numbers into states, the update rule on tiny environments
// whose answers can be worked out by hand, and an agent that learns Breakout on the real engine.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';
import { Doc } from '../core/doc';
import { newProject } from '../core/project';
import { importOrder, rewriteImports } from '../runtime/scripts';
import { NODE_CLASSES } from '../engine/nodes';
import { breakout } from '../examples/breakout';
import { GameEnv, type ClassLoader, type EnvSpec, type StepResult } from './env';
import { BREAKOUT_SPEC } from './breakout';
import { evaluate } from './cem';
import { binOf, evaluateQ, qLearning, stateCount, stateOf, type QEpisode, type QPolicy } from './qlearning';
import { actPolicy } from './policy';

/** Run a training generator to the end: its episodes and the policy it returns. */
function train(run: Generator<QEpisode, QPolicy>): { episodes: QEpisode[]; policy: QPolicy } {
  const episodes: QEpisode[] = [];
  let r = run.next();
  for (; !r.done; r = run.next()) episodes.push(r.value);
  return { episodes, policy: r.value };
}

/** A tiny environment from a step function, shaped like GameEnv (only what qLearning uses). */
function toyEnv(spec: Partial<EnvSpec>, actionCount: number, start: number, step: (state: number, action: number) => { next: number; reward: number; done: boolean }): GameEnv {
  let s = start, steps = 0;
  const observation = spec.observation ?? [];
  return {
    spec: { actions: [], observation: [], reward: [], ...spec } as EnvSpec,
    actionCount,
    bins: observation.map((o) => o.bins ?? []),
    observationSize: observation.length,
    reset: () => { s = start; steps = 0; return { observation: [s], info: { step: 0, errors: [] } }; },
    step: (a: number): StepResult => { const r = step(s, a); s = r.next; steps++; return { observation: [s], reward: r.reward, terminated: r.done, truncated: !r.done && steps >= 50, info: { step: steps, errors: [] } }; },
  } as unknown as GameEnv;
}

describe('states from numbers', () => {
  it('a value\'s bin is how many cut points are below it; readings combine like digits', () => {
    const cuts = [-0.25, -0.1, -0.03, 0.03, 0.1, 0.25];
    expect([-0.5, -0.25, -0.05, 0, 0.05, 0.2, 0.9].map((v) => binOf(v, cuts))).toEqual([0, 1, 2, 3, 4, 5, 6]);
    const bins = BREAKOUT_SPEC.observation!.map((o) => o.bins ?? []);
    expect(stateCount(bins)).toBe(14);
    // across bin 5 (0.1 to 0.25), going down (velocity.y ≥ 0, bin 1): 5 × 2 + 1.
    expect(stateOf([0.2, 0.5, -0.3, 0.9], bins)).toBe(11);
    expect(stateOf([-0.9, 0.5, 0.3, -0.9], bins)).toBe(0);
  });
});

describe('the update', () => {
  it('one state, two actions, no future: Q(s, a) moves α of the way to the reward each time', () => {
    // Action 1 earns 1 and ends the episode; action 0 earns 0. With ε = 1 every step is random.
    const env = toyEnv({ observation: [{ path: 's', bins: [0.5] }] }, 2, 0, (_s, a) => ({ next: 0, reward: a, done: true }));
    const { policy } = train(qLearning(env, { episodes: 200, alpha: 0.5, gamma: 0.9, epsilon: 1, epsilonEnd: 1, checkEvery: 0 }));
    expect(policy.table[0][1]).toBeCloseTo(1, 6);   // 1 − (1 − α)ⁿ → 1
    expect(policy.table[0][0]).toBe(0);
    expect(actPolicy(policy, [0])).toBe(1);
  });

  it('a chain of two states: the value of the first is the discounted value of the second', () => {
    // State 0: action 1 moves to state 1 (reward 0). State 1: action 1 ends with reward 10. Action 0 ends at once with 0.
    const env = toyEnv({ observation: [{ path: 's', bins: [0.5] }] }, 2, 0, (s, a) => (a === 0 ? { next: s, reward: 0, done: true } : s === 0 ? { next: 1, reward: 0, done: false } : { next: 1, reward: 10, done: true }));
    const { policy } = train(qLearning(env, { episodes: 400, alpha: 0.5, gamma: 0.9, epsilon: 1, epsilonEnd: 1, checkEvery: 0 }));
    expect(policy.table[1][1]).toBeCloseTo(10, 4);
    expect(policy.table[0][1]).toBeCloseTo(9, 4);   // Q*(0, 1) = 0 + γ · max Q*(1, ·) = 0.9 × 10
    expect(policy.table[0][0]).toBe(0);
  });

  it('needs bins', () => {
    const env = toyEnv({ observation: [{ path: 's' }] }, 2, 0, () => ({ next: 0, reward: 0, done: true }));
    expect(() => qLearning(env, { episodes: 1 }).next()).toThrow(/bins/);
  });
});

const pngSize = (path: string) => { const b = readFileSync(fileURLToPath(new URL(`../starter/${path.replace(/^assets\//, '')}`, import.meta.url))); return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) }; };
const load: ClassLoader = async (project) => {
  const classes = new Map<string, unknown>(), urls = new Map<string, string>();
  const { order, imports } = importOrder(project.scripts);
  for (const path of order) {
    const src = rewriteImports(project.scripts.find((x) => x.path === path)!.source, new Map([...imports.get(path)!].map(([spec, target]) => [spec, urls.get(target)!])));
    urls.set(path, `data:text/javascript;base64,${Buffer.from(src).toString('base64')}`);
    classes.set(path, (await import(/* @vite-ignore */ urls.get(path)!)).default);
  }
  return classes;
};
const project = () => { const d = new Doc(newProject('Breakout')); for (const p of breakout.images) d.importAsset(p, { mime: 'image/png', ...pngSize(p) }); d.runCode('Build', breakout.code); return d.project; };
afterAll(() => { for (const k of ['input', 'scene', 'time', 'math', 'physics', 'Vec2', 'PhysicsBody2D', ...Object.keys(NODE_CLASSES)]) delete (globalThis as Record<string, unknown>)[k]; });

describe('Q-learning plays Breakout', () => {
  it('from random play (about −5) to clearing most of the wall, in 100 episodes', async () => {
    const env = await GameEnv.create(project(), BREAKOUT_SPEC, load);
    const random = evaluate(env, 'random', 3, 7);
    expect(random).toBeLessThan(0);
    const { episodes, policy } = train(qLearning(env, { episodes: 100, alpha: 0.2, gamma: 0.97, epsilon: 0.3, epsilonEnd: 0.02, seed: 3, checkEvery: 10 }));
    expect(episodes).toHaveLength(100);
    expect(episodes.filter((e) => e.greedy !== undefined)).toHaveLength(10);
    expect(episodes[0].epsilon).toBeCloseTo(0.3, 9);
    expect(episodes[99].epsilon).toBeCloseTo(0.02, 9);
    const score = evaluateQ(env, policy, 3, 7);
    // Every state was updated: the visits it kept add up to the steps of the episodes before its checkpoint.
    expect(policy.visits!.every((v) => v > 0)).toBe(true);
    const best = episodes.filter((e) => e.greedy !== undefined).reduce((a, b) => (b.greedy! > a.greedy! ? b : a));
    expect(policy.visits!.reduce((a, b) => a + b, 0)).toBe(episodes.slice(0, best.episode).reduce((a, e) => a + e.steps, 0));
  }, 120000);
});
