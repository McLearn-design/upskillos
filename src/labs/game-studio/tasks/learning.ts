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

/** Breakout's environment without bins: what the agent sees, does and earns, but no states yet. */
const UNBINNED: EnvSpec = { ...BREAKOUT_SPEC, observation: BREAKOUT_SPEC.observation.map(({ bins: _bins, ...r }) => r) };
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
        text: 'With Q-learning chosen, press Train: 100 episodes, α 0.2, γ 0.97, ε falling from 0.3. Watch the faint line (each episode’s return) and the blue one (the last 10 averaged) climb above random play, and the green greedy checks. Then read the table: each row a state, the green number the action it takes there.',
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
        draft: { ...UNBINNED, observation: UNBINNED.observation.map((r, i) => (i === 0 ? { ...r, bins: COARSE } : i === 3 ? { ...r, bins: [0] } : r)) },
        runs: [
          { method: 'q', spec: { ...UNBINNED, observation: UNBINNED.observation.map((r, i) => (i === 0 ? { ...r, bins: ACROSS } : i === 3 ? { ...r, bins: [0] } : r)) }, score: 48, random: -5.3 },
          { method: 'q', spec: { ...UNBINNED, observation: UNBINNED.observation.map((r, i) => (i === 0 ? { ...r, bins: COARSE } : i === 3 ? { ...r, bins: [0] } : r)) }, score: 34, random: -5.3 },
        ],
        watched: true,
      },
    },
  },
];
