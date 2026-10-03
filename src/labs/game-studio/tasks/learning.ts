// The course's bonus chapter, "A game that learns": train a Q-learning agent to play Breakout
// (lesson 8.1; ml/qlearning.ts, the method of the ML Lab's lesson 37.4).
//
// The game is the finished Breakout example; what the learner builds is the environment around it. The
// task starts with Breakout's environment minus its bins, so the first two steps turn the game's numbers
// into the states of a Q table. Then it trains, watches the agent play, and trains again on coarser states
// to see what the table can no longer tell apart. Every step is done in Run › Train an agent…, so the
// checks are editor checks, on what the dialog holds and what training reported.

import type { GameTask, TrainingView } from './types';
import type { EnvSpec, Reading } from '../ml/env';
import { breakout } from '../examples/breakout';
import { BREAKOUT_SPEC } from '../ml/breakout';
import { cliffWalk, CLIFF_SPEC } from '../examples/cliffWalk';
import type { QOptions } from '../ml/qlearning';

/** Breakout's environment without bins: what the agent sees, does and earns, but no states yet. */
const UNBINNED: EnvSpec = { ...BREAKOUT_SPEC, observation: BREAKOUT_SPEC.observation!.map(({ bins: _bins, ...r }) => r) };
const ACROSS = [-0.25, -0.1, -0.03, 0.03, 0.1, 0.25], COARSE = [-0.1, 0.1];

const reading = (spec: EnvSpec | null | undefined, path: string, minus?: string): Reading | undefined =>
  spec?.observation?.find((o) => o.path === path && (minus === undefined || o.minus === minus));
const acrossOf = (spec: EnvSpec | null | undefined) => reading(spec, 'Ball:position.x', 'Paddle:position.x');
const cuts = (r: Reading | undefined) => (Array.isArray(r?.bins) ? r!.bins!.filter((c) => typeof c === 'number') : []);
const increasing = (c: number[]) => c.every((x, i) => i === 0 || x > c[i - 1]);

/** Bins on the ball-across reading: at least 5 increasing cuts, with one below and one above 0 (the paddle's middle). */
function fineAcross(spec: EnvSpec | null | undefined): true | string {
  if (!spec) return 'Open Run › Train an agent… to see the environment.';
  const r = acrossOf(spec);
  if (!r) return 'Keep the first reading: { "path": "Ball:position.x", "minus": "Paddle:position.x", … }.';
  const c = cuts(r);
  if (!c.length) return 'Add "bins": [-0.25, -0.1, -0.03, 0.03, 0.1, 0.25] to the first reading (the ball’s x minus the paddle’s).';
  if (!increasing(c)) return 'The cut points must go up: each one larger than the one before.';
  if (c.length < 5) return `${c.length} cut points make ${c.length + 1} bins. Use 6 (7 bins), so "over the paddle" and "just off it" are different states.`;
  if (!(c[0] < 0 && c[c.length - 1] > 0)) return 'Cut on both sides of 0, so "left of the paddle" and "right of it" are different states.';
  return true;
}

/** A finished Q-learning run whose spec has fine across bins and the up/down bin, and beat random play clearly. */
const goodRun = (runs: TrainingView['runs']) =>
  runs.find((r) => r.method === 'q' && fineAcross(r.spec) === true && cuts(reading(r.spec, 'Ball:velocity.y')).length > 0 && r.score > r.random + 10);

export const LEARNING: GameTask[] = [
  {
    id: 'q-agent',
    chain: 'A game that learns',
    title: 'Train an agent with Q-learning',
    goal: 'Turn Breakout into an environment with states, and train a Q-learning agent that clears the wall on its own.',
    images: breakout.images,
    start: breakout.code,
    agent: UNBINNED,
    steps: [
      {
        text: 'Open Run › Train an agent…. It starts with what the agent sees, does and earns in Breakout, but Q-learning keeps a table, one row per state, so the numbers must be cut into bins. On the first reading (the ball’s x minus the paddle’s), add "bins": [-0.25, -0.1, -0.03, 0.03, 0.1, 0.25]: seven bins, the middle one "over the paddle" (it is 104 pixels wide, ±0.11 here).',
        // Done once typed, and stays done after a run trained on it (step 5 changes the bins again).
        check: { kind: 'editor', test: (v) => (v.training?.runs ?? []).some((r) => fineAcross(r.spec) === true) || fineAcross(v.training?.draft) },
        hint: 'Inside the first { … } of "observation", after "scale": 0.0020833…, add a comma and "bins": [-0.25, -0.1, -0.03, 0.03, 0.1, 0.25].',
      },
      {
        text: 'On the ball’s velocity.y reading, add "bins": [0]: going up (below 0) or coming down. Now there are 7 × 2 = 14 states. The other two readings have no bins, so they are not part of the state.',
        check: { kind: 'editor', test: (v) => [v.training?.draft, ...(v.training?.runs ?? []).map((r) => r.spec)].some((spec) => cuts(reading(spec, 'Ball:velocity.y')).length > 0) || (v.training?.draft ? 'Add "bins": [0] to the reading with "path": "Ball:velocity.y".' : 'Open Run › Train an agent… to see the environment.') },
      },
      {
        text: 'With Q-learning chosen, press Train (headless, about 15 seconds), or ▶ Train in view to watch every episode in the game, with a speed control: 100 episodes, α 0.2, γ 0.97, ε falling from 0.3. Watch the faint line (each episode’s return) and the blue one (the last 10 averaged) climb above random play, and the green greedy checks. Then read the table: each row a state, the green number the action it takes there.',
        check: { kind: 'editor', test: (v) => !!goodRun(v.training?.runs ?? []) || ((v.training?.runs ?? []).some((r) => r.method === 'q') ? 'Trained, but not on 14 states, or it did not beat random play by much: check the bins and train again.' : 'Press Train with Q-learning chosen, and wait for "Trained."') },
      },
      {
        text: 'Press ▶ Watch it play. The real game runs with the agent at the controls: 15 times a second it reads the ball’s position, finds its row in the table, and holds the keys of the highest Q.',
        check: { kind: 'editor', test: (v) => v.training?.watched || 'Press ▶ Watch it play in the dialog after training.' },
      },
      {
        text: 'Experiment: change the first reading’s bins to [-0.1, 0.1], three bins (left of the paddle, over it, right of it), and train again. With fewer states the table cannot tell "just off the edge" from "far away": compare the score with the 14-state agent’s.',
        check: { kind: 'editor', test: (v) => (v.training?.runs ?? []).some((r) => r.method === 'q' && cuts(acrossOf(r.spec)).length > 0 && cuts(acrossOf(r.spec)).length <= 2) || 'Train once more with Q-learning, with only two cut points on the first reading, such as [-0.1, 0.1].' },
      },
    ],
    // Nothing to build in the project: every step is done in Run › Train an agent….
    solution: '// Every step of this task is done in Run › Train an agent…',
    done: 'You trained an agent with Q-learning. Back to the lesson for why the update works, and what the table holds.',
    solvedEditor: {
      training: {
        draft: { ...UNBINNED, observation: UNBINNED.observation!.map((r, i) => (i === 0 ? { ...r, bins: COARSE } : i === 3 ? { ...r, bins: [0] } : r)) },
        runs: [
          { method: 'q', spec: { ...UNBINNED, observation: UNBINNED.observation!.map((r, i) => (i === 0 ? { ...r, bins: ACROSS } : i === 3 ? { ...r, bins: [0] } : r)) }, score: 48, random: -5.3 },
          { method: 'q', spec: { ...UNBINNED, observation: UNBINNED.observation!.map((r, i) => (i === 0 ? { ...r, bins: COARSE } : i === 3 ? { ...r, bins: [0] } : r)) }, score: 34, random: -5.3 },
        ],
        watched: true,
      },
    },
  },

  // ── Chapter 9, "Game AI that learns" ─────────────────────────────────────
  {
    id: 'td-step',
    chain: 'Game AI that learns',
    title: 'Step through TD updates',
    goal: 'Watch Q-learning learn Cliff Walk one update at a time, predict updates yourself, and see what the step size α does.',
    images: cliffWalk.images,
    start: cliffWalk.code,
    agent: CLIFF_SPEC,
    steps: [
      {
        text: 'Open Run › Train an agent…. With Table (TD) and Q-learning, set episodes 200, α 0.5, γ 1, ε from 0.1 to 0.1, constant (the textbook\'s settings). Press ▶ Train in view, then Step: training pauses, and the panel writes out the last update with its numbers. Step through 5 updates, reading each line.',
        check: { kind: 'editor', test: (v) => (v.training?.stepped ?? 0) >= 5 || `Stepped ${v.training?.stepped ?? 0} of 5 updates: press Step under the game while it trains in view.` },
      },
      {
        text: 'Tick Predict. Before each Check, work out the target, R + γ · max Q(S′, ·), and the new Q(S, A) = Q(S, A) + α (target − Q(S, A)) from the numbers shown. Get 3 right (to within 0.01).',
        check: { kind: 'editor', test: (v) => { const p = v.training?.predictions ?? { right: 0, total: 0 }; return p.right >= 3 || `${p.right} right of ${p.total} checked: 3 needed. Step, work it out, type both numbers, then Check.`; } },
      },
      {
        text: 'Press Max and let it finish. The greedy walk (no exploring) should be the shortest, 13 moves: a return of −13. The arrows on the grid show why: along the row next to the spikes.',
        check: { kind: 'editor', test: (v) => !!(v.training?.runs ?? []).find((r) => r.inView && textbookQ(r.options, 0.5) && r.score === -13) || 'Let a Q-learning run in view with α 0.5 and γ 1 finish: the panel says "Trained."' },
      },
      {
        text: 'Now train in view again with α 0.05 instead of 0.5, the rest the same. Each update moves Q a tenth as far: after 200 episodes the greedy walk does not even reach the chest (it scores −200, the episode\'s step limit). A step size has to be big enough to learn in the time you have, and small enough not to chase noise.',
        check: { kind: 'editor', test: (v) => !!(v.training?.runs ?? []).find((r) => r.inView && textbookQ(r.options, 0.05)) || 'Train in view once more with α 0.05, and let it finish.' },
      },
    ],
    solution: '// Every step of this task is done in Run › Train an agent…',
    done: 'You followed TD updates by hand and saw the step size at work. Back to the lesson for TD(0) and Monte Carlo.',
    solvedEditor: {
      training: {
        draft: CLIFF_SPEC,
        runs: [
          { method: 'q', spec: CLIFF_SPEC, score: -13, random: -1751, inView: true, options: { episodes: 200, algorithm: 'q', alpha: 0.5, gamma: 1, epsilon: 0.1, epsilonEnd: 0.1, schedule: 'constant' } },
          { method: 'q', spec: CLIFF_SPEC, score: -200, random: -1751, inView: true, options: { episodes: 200, algorithm: 'q', alpha: 0.05, gamma: 1, epsilon: 0.1, epsilonEnd: 0.1, schedule: 'constant' } },
        ],
        watched: false, stepped: 5, predictions: { right: 3, total: 3 },
      },
    },
  },
];

/** A run with Q-learning, γ 1 and this α (the textbook's cliff settings otherwise). */
function textbookQ(o: QOptions | undefined, alpha: number): boolean {
  return !!o && (o.algorithm ?? 'q') === 'q' && Math.abs((o.alpha ?? 0.2) - alpha) < 1e-9 && (o.gamma ?? 0.97) === 1;
}
