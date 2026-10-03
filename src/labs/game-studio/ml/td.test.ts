// The tabular TD methods (ml/qlearning.ts QLearner) against two results from Sutton & Barto, 2nd ed.:
//   Example 6.6, cliff walking: SARSA learns the safe path, Q-learning the optimal path along the edge (and so falls
//   off more while it explores);
//   Example 6.7, maximization bias: Q-learning overrates a risky branch early on, Double Q-learning does not.
import { describe, expect, it } from 'vitest';
import type { EnvSpec, GameEnv, StepResult } from './env';
import { seeded } from './env';
import { epsilonGreedyProbs, QLearner, scheduled, softmax, type QOptions, type QPolicy, type QTransition } from './qlearning';
import { greedy } from './brain';

/** A tabular environment from a step function, shaped like GameEnv (only what the learner uses). States are 0 … n − 1. */
function tabular(n: number, actions: number, start: () => number, step: (s: number, a: number) => { next: number; reward: number; done: boolean }, maxSteps = 500): GameEnv {
  let s = 0, steps = 0;
  return {
    spec: {} as EnvSpec, actionCount: actions, observationSize: 1, frameSkip: 1,
    bins: [Array.from({ length: n - 1 }, (_, i) => i + 0.5)],
    reset: () => { s = start(); steps = 0; return { observation: [s], info: { step: 0, errors: [] } }; },
    step: (a: number): StepResult => { const r = step(s, a); s = r.next; steps++; return { observation: [s], reward: r.reward, terminated: r.done, truncated: !r.done && steps >= maxSteps, info: { step: steps, errors: [] } }; },
  } as unknown as GameEnv;
}

function run(env: GameEnv, opts: QOptions): { policy: QPolicy; returns: number[]; transitions: QTransition[] } {
  const L = new QLearner(env, opts), returns: number[] = [], transitions: QTransition[] = [];
  for (;;) {
    const t = L.tick();
    if (t.transition) transitions.push(t.transition);
    if (t.episode) returns.push(t.episode.total);
    if (t.policy) return { policy: t.policy, returns, transitions };
  }
}

// The cliff: a 4 × 12 grid, start bottom-left, goal bottom-right, the cells between them a cliff. Each step costs 1;
// stepping into the cliff costs 100 and sends you back to the start. State = row × 12 + column.
const W = 12, H = 4, START = (H - 1) * W, GOAL = H * W - 1;
const MOVES = [[0, -1], [1, 0], [0, 1], [-1, 0]];   // up, right, down, left
const cliff = () => tabular(W * H, 4, () => START, (s, a) => {
  const x = Math.min(W - 1, Math.max(0, (s % W) + MOVES[a][0])), y = Math.min(H - 1, Math.max(0, Math.floor(s / W) + MOVES[a][1]));
  if (y === H - 1 && x > 0 && x < W - 1) return { next: START, reward: -100, done: false };
  const next = y * W + x;
  return { next, reward: -1, done: next === GOAL };
});
/** The greedy path from the start: its length, how many cells it walks along the edge (row 2, columns 1–10), and along the top row. */
function greedyPath(policy: QPolicy): { steps: number; edge: number; top: number } {
  let s = START, steps = 0, edge = 0, top = 0;
  while (s !== GOAL && steps < 100) {
    const a = greedy(policy.table[s]);
    const x = Math.min(W - 1, Math.max(0, (s % W) + MOVES[a][0])), y = Math.min(H - 1, Math.max(0, Math.floor(s / W) + MOVES[a][1]));
    s = y === H - 1 && x > 0 && x < W - 1 ? START : y * W + x;
    if (Math.floor(s / W) === H - 2 && s % W > 0 && s % W < W - 1) edge++;
    if (Math.floor(s / W) === 0) top++;
    steps++;
  }
  return { steps, edge, top };
}
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

describe('cliff walking (Sutton & Barto, Example 6.6)', () => {
  const opts = (algorithm: QOptions['algorithm'], seed: number): QOptions => ({ episodes: 500, algorithm, alpha: 0.5, gamma: 1, epsilon: 0.1, schedule: 'constant', seed, checkEvery: 0 });
  it('Q-learning learns the optimal path along the edge; SARSA learns a safer, longer one', () => {
    const q = run(cliff(), opts('q', 1)), sarsa = run(cliff(), opts('sarsa', 1));
    expect(greedyPath(q.policy).steps).toBe(13);                       // the shortest path: up, 11 right, down
    expect(greedyPath(q.policy).edge).toBe(10);                         // every step along the row next to the cliff
    expect(greedyPath(sarsa.policy).steps).toBeGreaterThan(13);
    // It walks the top row, as far from the cliff as the grid allows (one seed passes the edge row once, on the way up).
    for (const seed of [1, 2, 3, 4, 5]) {
      const p = greedyPath(run(cliff(), opts('sarsa', seed)).policy);
      expect(p.edge).toBeLessThanOrEqual(1);
      expect(p.top).toBeGreaterThanOrEqual(8);
    }
  });

  it('while exploring, SARSA earns more per episode: Q-learning\'s edge path falls off when ε takes a random step', () => {
    const late = (algorithm: QOptions['algorithm']) => mean([1, 2, 3, 4, 5].map((seed) => mean(run(cliff(), opts(algorithm, seed)).returns.slice(-100))));
    const q = late('q'), sarsa = late('sarsa'), expected = late('expected-sarsa');
    expect(sarsa).toBeGreaterThan(q);
    expect(expected).toBeGreaterThan(q);
    expect(q).toBeLessThan(-30); expect(sarsa).toBeGreaterThan(-30);
  });
});

describe('maximization bias (Sutton & Barto, Example 6.7)', () => {
  // A (state 0): right ends the episode with 0; left goes to B (state 1) with 0. B: ten actions, each ending it with a
  // reward drawn from a normal distribution of mean −0.1. So left is worse; but the max of ten noisy estimates is high.
  const biased = (seed: number) => {
    const rand = seeded(seed + 99), normal = () => Math.sqrt(-2 * Math.log(1 - rand())) * Math.cos(2 * Math.PI * rand());
    return tabular(3, 10, () => 0, (s, a) => (s === 0 ? (a === 1 ? { next: 2, reward: 0, done: true } : a === 0 ? { next: 1, reward: 0, done: false } : { next: 2, reward: 0, done: true }) : { next: 2, reward: -0.1 + normal(), done: true }));
  };
  it('Q-learning goes left far more often than Double Q-learning in the first episodes', () => {
    const leftShare = (algorithm: QOptions['algorithm']) => mean(Array.from({ length: 40 }, (_, k) => {
      const { transitions } = run(biased(k), { episodes: 100, algorithm, alpha: 0.1, gamma: 1, epsilon: 0.1, schedule: 'constant', seed: k + 1, checkEvery: 0 });
      const first = transitions.filter((t) => t.s === 0 && t.episode <= 50);
      return mean(first.map((t) => (t.a === 0 ? 1 : 0)));
    }));
    const q = leftShare('q'), dq = leftShare('double-q');
    expect(q).toBeGreaterThan(dq + 0.1);
    expect(dq).toBeLessThan(0.25);
  });
});

describe('exploration', () => {
  it('ε-greedy and softmax probabilities, and the three schedules', () => {
    expect(epsilonGreedyProbs([1, 3, 3, 0], 0.2)).toEqual([0.05, 0.45, 0.45, 0.05]);
    const p = softmax([0, 1], 1);
    expect(p[1] / p[0]).toBeCloseTo(Math.E, 12);
    expect(softmax([0, 1], 0.01)[1]).toBeCloseTo(1, 12);
    expect(scheduled(0.3, 0.02, 50, 101, 'linear')).toBeCloseTo(0.16, 12);
    expect(scheduled(0.3, 0.03, 50, 101, 'exponential')).toBeCloseTo(0.3 * Math.sqrt(0.1), 12);
    expect(scheduled(0.3, 0.02, 50, 101, 'constant')).toBe(0.3);
  });

  it('optimistic starting values make a greedy agent try every action (ε = 0)', () => {
    const env = tabular(2, 4, () => 0, (_s, a) => ({ next: 1, reward: a === 3 ? 1 : 0, done: true }));
    const tried = (initialQ: number) => new Set(run(env, { episodes: 8, alpha: 0.5, epsilon: 0, epsilonEnd: 0, initialQ, checkEvery: 0 }).transitions.map((t) => t.a)).size;
    expect(tried(5)).toBe(4);
    expect(tried(0)).toBeLessThan(4);
  });

  it('every update reports its numbers: target, TD error, before and after', () => {
    const { transitions } = run(cliff(), { episodes: 1, alpha: 0.5, gamma: 1, epsilon: 0.1, seed: 4, checkEvery: 0 });
    for (const t of transitions) {
      expect(t.delta).toBeCloseTo(t.target - t.before, 12);
      expect(t.after).toBeCloseTo(t.before + 0.5 * t.delta, 12);
    }
  });
});
