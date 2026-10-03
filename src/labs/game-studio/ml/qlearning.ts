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
import { actQ, stateCount, stateOf, type QPolicy } from './brain';

export { actQ, binOf, greedy, stateCount, stateOf, type QPolicy } from './brain';

/** The cut points of each reading ([] for a reading that is not part of the state). */
export const binsOf = (readings: Reading[]): number[][] => readings.map((r) => r.bins ?? []);

/** The greedy action with ties broken at random (as the ML Lab's Q-learning does): an untried state's row is all
 *  zeros, and always taking the first action there would make the agent's exploration lopsided. */
function greedyRandomTies(row: number[], rand: () => number): number {
  const best = Math.max(...row), ties: number[] = [];
  row.forEach((q, a) => { if (q === best) ties.push(a); });
  return ties[Math.floor(rand() * ties.length)];
}

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
  const learner = new QLearner(env, opts);
  for (;;) {
    const t = learner.tick();
    if (t.episode) yield t.episode;
    if (t.policy) return t.policy;
  }
}

/** What the learner is doing on its current step, for a page that shows training as it happens. */
export interface QLive { mode: 'reset' | 'learn' | 'check'; episode: number; episodes: number; epsilon: number; total: number; steps: number; checkGame: number }

/**
 * Q-learning one environment step at a time: Train an agent's worker runs it flat out, and Train in view runs it
 * inside the visible game, a few steps per drawn frame, so you can watch every episode. Both make the same random
 * draws in the same order, so they learn the same table. A tick is a reset, one learning step, or one step of a
 * greedy check game.
 */
export class QLearner {
  readonly bins: number[][];
  private readonly table: number[][];
  private readonly visits: number[];
  private readonly seen = new Set<number>();
  private readonly rand: () => number;
  private readonly A: number;
  private readonly alpha: number; private readonly gamma: number; private readonly e0: number; private readonly e1: number;
  private readonly seed: number; private readonly every: number; private readonly checks: number;
  private best: { score: number; table: number[][]; visits: number[] } | null = null;
  private mode: 'start' | 'learn' | 'checkStart' | 'check' | 'finished' = 'start';
  private ep = 0;
  private s = 0;
  private total = 0;
  private steps = 0;
  private epsilon = 0;
  private checkIndex = 0;
  private checkSum = 0;
  private checkTotal = 0;
  private checkObs: number[] = [];
  private lastEpisode: QEpisode | null = null;

  constructor(private readonly env: GameEnv, private readonly opts: QOptions) {
    this.bins = env.bins;
    if (!this.bins.some((c) => c.length)) throw new Error('Q-learning needs bins on at least one observation reading, to turn the numbers into states');
    this.A = env.actionCount;
    this.table = Array.from({ length: stateCount(this.bins) }, () => new Array(this.A).fill(0));
    this.visits = new Array(this.table.length).fill(0);
    this.alpha = opts.alpha ?? 0.2; this.gamma = opts.gamma ?? 0.97; this.e0 = opts.epsilon ?? 0.3; this.e1 = opts.epsilonEnd ?? 0.02;
    this.seed = opts.seed ?? 1;
    this.rand = seeded(this.seed);
    this.every = opts.checkEvery ?? 10; this.checks = opts.checkEpisodes ?? 2;
  }

  /** What it is doing now. */
  get live(): QLive {
    const mode = this.mode === 'learn' ? 'learn' : this.mode === 'check' || this.mode === 'checkStart' ? 'check' : 'reset';
    return { mode, episode: Math.min(this.ep + 1, this.opts.episodes), episodes: this.opts.episodes, epsilon: this.epsilon, total: mode === 'check' ? this.checkTotal : this.total, steps: this.steps, checkGame: this.checkIndex + 1 };
  }

  /** The table as it is now (a copy). */
  snapshot(): QPolicy { return { kind: 'q', bins: this.bins, table: this.table.map((r) => [...r]), visits: [...this.visits] }; }

  /** Advance by one tick. It reports an episode when one finishes (with its check, if one was due), and the policy at the end. */
  tick(): { episode?: QEpisode; policy?: QPolicy } {
    const { env, table } = this;
    switch (this.mode) {
      case 'finished':
        return { policy: { kind: 'q', bins: this.bins, table: this.best ? this.best.table : table, visits: this.best ? this.best.visits : this.visits } };
      case 'start': {
        const n = this.opts.episodes;
        this.epsilon = this.e0 + (this.e1 - this.e0) * (n > 1 ? this.ep / (n - 1) : 1);
        this.s = stateOf(env.reset(this.seed * 1000 + this.ep).observation, this.bins);
        this.total = 0; this.steps = 0;
        this.seen.add(this.s);
        this.mode = 'learn';
        return {};
      }
      case 'learn': {
        const s = this.s;
        const a = this.rand() < this.epsilon ? Math.floor(this.rand() * this.A) : greedyRandomTies(table[s], this.rand);
        const r = env.step(a);
        const next = stateOf(r.observation, this.bins);
        // A truncated episode was cut short, not ended: its next state still has a future, so it is bootstrapped.
        const target = r.reward + (r.terminated ? 0 : this.gamma * Math.max(...table[next]));
        table[s][a] += this.alpha * (target - table[s][a]);
        this.visits[s]++;
        this.total += r.reward; this.steps++; this.s = next; this.seen.add(next);
        if (!(r.terminated || r.truncated)) return {};
        this.lastEpisode = { episode: this.ep + 1, total: this.total, epsilon: this.epsilon, visited: this.seen.size, steps: this.steps };
        if (this.every > 0 && ((this.ep + 1) % this.every === 0 || this.ep + 1 === this.opts.episodes)) {
          this.mode = 'checkStart'; this.checkIndex = 0; this.checkSum = 0;
          return {};
        }
        return this.finishEpisode();
      }
      case 'checkStart':
        // Its own seeds: not the training games, nor the ones a final score is measured on.
        this.checkObs = env.reset(500 + this.checkIndex).observation;
        this.checkTotal = 0;
        this.mode = 'check';
        return {};
      case 'check': {
        const r = env.step(actQ({ kind: 'q', bins: this.bins, table }, this.checkObs));
        this.checkTotal += r.reward; this.checkObs = r.observation;
        if (!(r.terminated || r.truncated)) return {};
        this.checkSum += this.checkTotal;
        if (++this.checkIndex < this.checks) { this.mode = 'checkStart'; return {}; }
        const greedyScore = this.checkSum / this.checks;
        if (!this.best || greedyScore > this.best.score) this.best = { score: greedyScore, table: table.map((row) => [...row]), visits: [...this.visits] };
        this.lastEpisode = { ...this.lastEpisode!, greedy: greedyScore, table: table.map((row) => [...row]), visits: [...this.visits] };
        return this.finishEpisode();
      }
    }
  }

  private finishEpisode(): { episode: QEpisode } {
    const episode = this.lastEpisode!;
    this.ep++;
    this.mode = this.ep < this.opts.episodes ? 'start' : 'finished';
    return { episode };
  }
}
