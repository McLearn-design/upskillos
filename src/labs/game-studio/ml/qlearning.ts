// Training an agent: tabular Q-learning (Watkins 1989), the method of the ML Lab's lesson 37.4, on a game.
//
// A table can only hold finitely many states, and a game's numbers are continuous, so each reading the agent
// uses is cut into bins: a reading with cut points [c₁ < c₂ < … < cₖ] falls in bin i when i of the cuts are
// below it (0 to k). The state is the combination of every binned reading's bin (mixed radix), so two
// readings of 7 and 2 bins make 14 states. Readings without bins are not part of the state.
//
// For each state s and action a the table holds Q(s, a): the return the agent expects if it takes a in s
// and plays well afterwards. Each step it acts ε-greedily (a random action with probability ε, else the best
// in the table), sees the reward r and the next state s′, and moves Q(s, a) towards r + γ max Q(s′, ·):
//
//   δ = r + γ · max_a′ Q(s′, a′) − Q(s, a)      (the TD error; the max is 0 when the episode has ended)
//   Q(s, a) ← Q(s, a) + α δ
//
// ε falls linearly from `epsilon` to `epsilonEnd` over training, so the agent explores first and exploits
// later. A table learned on binned states is noisy: two tables a few episodes apart can play very differently,
// because one bin hides details that matter. So every `checkEvery` episodes the greedy policy (ε = 0) plays
// fixed seeds without learning, and the best table so far is kept (a checkpoint), as practitioners do.
// Seeded throughout, so a run can be repeated exactly (and tested).

import { seeded, type GameEnv, type Reading } from './env';
import { episode } from './cem';

/** A Q table over binned states. `visits[s]` counts the updates made from state s: a row updated rarely holds a
 *  rough estimate, however confident its numbers look. */
export interface QPolicy { kind: 'q'; bins: number[][]; table: number[][]; visits?: number[] }

/** Which bin a value falls in: how many of the (increasing) cut points are below it. */
export function binOf(value: number, cuts: number[]): number {
  let i = 0;
  while (i < cuts.length && value >= cuts[i]) i++;
  return i;
}

/** The cut points of each reading ([] for a reading that is not part of the state). */
export const binsOf = (readings: Reading[]): number[][] => readings.map((r) => r.bins ?? []);

/** How many states the bins make: the product of (cuts + 1) over the binned readings. */
export const stateCount = (bins: number[][]): number => bins.reduce((n, c) => (c.length ? n * (c.length + 1) : n), 1);

/** The state an observation is in: its readings' bins combined, the first reading the most significant. */
export function stateOf(observation: number[], bins: number[][]): number {
  let s = 0;
  bins.forEach((cuts, i) => { if (cuts.length) s = s * (cuts.length + 1) + binOf(observation[i], cuts); });
  return s;
}

/** The greedy action in a state: the first of the highest Q values. */
export function greedy(row: number[]): number {
  let best = 0;
  for (let a = 1; a < row.length; a++) if (row[a] > row[best]) best = a;
  return best;
}

/** The greedy action with ties broken at random (as the ML Lab's Q-learning does): an untried state's row is all
 *  zeros, and always taking the first action there would make the agent's exploration lopsided. */
function greedyRandomTies(row: number[], rand: () => number): number {
  const best = Math.max(...row), ties: number[] = [];
  row.forEach((q, a) => { if (q === best) ties.push(a); });
  return ties[Math.floor(rand() * ties.length)];
}

/** The action a Q policy takes for an observation. */
export const actQ = (policy: QPolicy, observation: number[]): number => greedy(policy.table[stateOf(observation, policy.bins)]);

export interface QOptions {
  episodes: number;
  /** Step size α: how far each update moves Q(s, a) towards its target. */
  alpha?: number;
  /** Discount γ per step: a reward k steps away is worth γᵏ now. */
  gamma?: number;
  /** Exploration ε at the start, falling linearly to epsilonEnd at the last episode. */
  epsilon?: number;
  epsilonEnd?: number;
  seed?: number;
  /** Every this many episodes, play the greedy policy (no learning) and keep the best table. 0: never. */
  checkEvery?: number;
  /** Episodes the greedy policy plays at each check. */
  checkEpisodes?: number;
}

/** One episode of training: its return, the ε it explored with, how many states have been visited so far, and
 *  (on a check) how the greedy policy scores now and a copy of the table. */
export interface QEpisode { episode: number; total: number; epsilon: number; visited: number; steps: number; greedy?: number; table?: number[][]; visits?: number[] }

/** The average return of a Q policy playing greedily on seeded episodes. */
export function evaluateQ(env: GameEnv, policy: QPolicy, episodes: number, seed: number): number {
  let sum = 0;
  for (let e = 0; e < episodes; e++) sum += episode(env, (o) => actQ(policy, o), seed + e).total;
  return sum / episodes;
}

/** Train, one episode at a time (so a page can draw the learning curve as it goes). */
export function* qLearning(env: GameEnv, opts: QOptions): Generator<QEpisode, QPolicy> {
  const bins = binsOf(env.spec.observation);
  if (!bins.some((c) => c.length)) throw new Error('Q-learning needs bins on at least one observation reading, to turn the numbers into states');
  const S = stateCount(bins), A = env.actionCount;
  const alpha = opts.alpha ?? 0.2, gamma = opts.gamma ?? 0.97, e0 = opts.epsilon ?? 0.3, e1 = opts.epsilonEnd ?? 0.02;
  const seed = opts.seed ?? 1, rand = seeded(seed);
  const table = Array.from({ length: S }, () => new Array(A).fill(0));
  const seen = new Set<number>(), visits = new Array(S).fill(0);
  const every = opts.checkEvery ?? 10, checks = opts.checkEpisodes ?? 2;
  let best: { score: number; table: number[][]; visits: number[] } | null = null;
  for (let ep = 0; ep < opts.episodes; ep++) {
    const epsilon = e0 + (e1 - e0) * (opts.episodes > 1 ? ep / (opts.episodes - 1) : 1);
    let s = stateOf(env.reset(seed * 1000 + ep).observation, bins), total = 0, steps = 0;
    seen.add(s);
    for (;;) {
      const a = rand() < epsilon ? Math.floor(rand() * A) : greedyRandomTies(table[s], rand);
      const r = env.step(a);
      const next = stateOf(r.observation, bins);
      // A truncated episode was cut short, not ended: its next state still has a future, so it is bootstrapped.
      const target = r.reward + (r.terminated ? 0 : gamma * Math.max(...table[next]));
      table[s][a] += alpha * (target - table[s][a]);
      visits[s]++;
      total += r.reward; steps++; s = next; seen.add(s);
      if (r.terminated || r.truncated) break;
    }
    let greedyScore: number | undefined;
    if (every > 0 && ((ep + 1) % every === 0 || ep + 1 === opts.episodes)) {
      greedyScore = evaluateQ(env, { kind: 'q', bins, table }, checks, 500);   // its own seeds: not the training games, nor the ones a final score is measured on
      if (!best || greedyScore > best.score) best = { score: greedyScore, table: table.map((row) => [...row]), visits: [...visits] };
    }
    yield { episode: ep + 1, total, epsilon, visited: seen.size, steps, ...(greedyScore === undefined ? {} : { greedy: greedyScore, table: table.map((row) => [...row]), visits: [...visits] }) };
  }
  return { kind: 'q', bins, table: best ? best.table : table, visits: best ? best.visits : visits };
}
