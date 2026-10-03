// @vitest-environment happy-dom
// The trace writes each update in its algorithm's formula with the numbers the learner used, so the arithmetic on
// screen gives the learner's own target and new Q(S, A): checked here for all four algorithms on the cliff.
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { TrainTrace, stateText } from './TrainTrace';
import { QLearner, TD_ALGORITHMS, type QOptions, type QTransition } from '../ml/qlearning';
import type { EnvSpec, GameEnv, StepResult } from '../ml/env';

const W = 12, H = 4, START = (H - 1) * W, GOAL = H * W - 1, MOVES = [[0, -1], [1, 0], [0, 1], [-1, 0]];
function cliff(): GameEnv {
  let s = START, steps = 0;
  return {
    spec: {} as EnvSpec, actionCount: 4, observationSize: 1, frameSkip: 1, bins: [Array.from({ length: W * H - 1 }, (_, i) => i + 0.5)],
    reset: () => { s = START; steps = 0; return { observation: [s], info: { step: 0, errors: [] } }; },
    step: (a: number): StepResult => {
      const x = Math.min(W - 1, Math.max(0, (s % W) + MOVES[a][0])), y = Math.min(H - 1, Math.max(0, Math.floor(s / W) + MOVES[a][1]));
      let r = -1; s = y * W + x;
      if (y === H - 1 && x > 0 && x < W - 1) { r = -100; s = START; }
      steps++;
      return { observation: [s], reward: r, terminated: s === GOAL, truncated: s !== GOAL && steps >= 200, info: { step: steps, errors: [] } };
    },
  } as unknown as GameEnv;
}
const described = { actions: ['up', 'right', 'down', 'left'], observation: ['cell'], bins: [Array.from({ length: W * H - 1 }, (_, i) => i + 0.5)] };
/** The numbers in a rendered line, in order. */
const numbers = (text: string) => [...text.matchAll(/-?\d+(?:\.\d+)?/g)].map((m) => Number(m[0]));

describe('the trace', () => {
  for (const algorithm of TD_ALGORITHMS) {
    it(`${algorithm}: the formula's own arithmetic gives the learner's target and new Q`, () => {
      const opts: QOptions = { episodes: 30, algorithm, alpha: 0.5, gamma: 0.9, epsilon: 0.2, schedule: 'constant', seed: 5, checkEvery: 0 };
      const L = new QLearner(cliff(), opts);
      const ts: QTransition[] = [];
      for (let k = 0; k < 4000 && ts.length < 400; k++) { const t = L.tick(); if (t.transition) ts.push(t.transition); if (t.policy) break; }
      const later = ts.filter((t) => !t.terminal).slice(-5).concat(ts.filter((t) => t.terminal).slice(-1));
      for (const t of later) {
        const { container, unmount } = render(<TrainTrace t={t} live={null} options={opts} described={described} predict={false} />);
        const target = container.querySelector('[data-testid="trace-target"]')!.textContent!, update = container.querySelector('[data-testid="trace-update"]')!.textContent!;
        // The last number of each line is its result, rounded to 3 places, and is the learner's.
        expect(numbers(target).at(-1)).toBeCloseTo(+t.target.toFixed(3), 9);
        expect(numbers(update).at(-1)).toBeCloseTo(+t.after.toFixed(3), 9);
        // The update line's arithmetic: before + α × δ.
        const [before, alpha, delta] = numbers(update.split('α δ = ')[1]);
        expect(before + alpha * delta).toBeCloseTo(t.after, 2);
        if (algorithm === 'q' && !t.terminal) {
          const [r, gamma, ...rest] = numbers(target.split('max Q(S′, ·) = ')[1]);
          expect(r + gamma * Math.max(...rest.slice(0, 4))).toBeCloseTo(t.target, 2);
        }
        if (algorithm === 'expected-sarsa' && !t.terminal) expect(t.probs!.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 12);
        unmount();
      }
    });
  }

  it('Predict hides the target and the new Q until Check, then says if you were right', () => {
    const t: QTransition = { episode: 1, step: 1, s: START, a: 0, r: -1, next: START - W, terminal: false, target: -1.9, delta: -0.9, before: -1, after: -1.45, nextRow: [-1, -1.5, -2, -1], epsilon: 0.1 };
    const opts: QOptions = { episodes: 1, alpha: 0.5, gamma: 0.9 };
    const { container, getByTestId } = render(<TrainTrace t={t} live={null} options={opts} described={described} predict />);
    expect(container.querySelector('[data-testid="trace-target"]')).toBeNull();
    expect(stateText(START, described)).toBe('(cell 36)');
    (getByTestId('trace-check') as HTMLButtonElement).click();
  });
});
