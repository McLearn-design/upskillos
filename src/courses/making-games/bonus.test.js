// Lesson 8.1, "A game that learns": every notebook cell prints what the lesson's prose says, the challenge's own
// check passes the solution and fails the start, and the notebook's Breakout states are Game Studio's.
import { describe, expect, it } from 'vitest';
import lesson from './8-bonus-a-game-that-learns/001-a-game-that-learns.js';
import { stateOf } from '../../labs/game-studio/ml/qlearning';
import { BREAKOUT_SPEC } from '../../labs/game-studio/ml/breakout';

const notebook = lesson.intuition.visualizations.find((v) => v.id === 'JSNotebook').props.lesson.cells;
const run = (code) => {
  const out = [];
  const ctx = new Proxy({}, { get: () => () => {}, set: () => true });
  const document = { createElement: () => ({ style: {}, getContext: () => ctx }), body: { appendChild: () => {} } };
  new Function('console', 'document', code)({ log: (...a) => out.push(a.join(' ')) }, document);
  return out;
};

describe('lesson 8.1: Q-learning', () => {
  it('states, the return, one update', () => {
    expect(run(notebook[0].startCode)).toEqual(['states: 44, actions: 3, Q values: 132', 'random play catches 0.169 of the time']);
    expect(run(notebook[1].startCode)).toEqual(['G_0 by the sum: 0.912673', 'G_0 by the recursion: 0.912673', 'a Breakout brick 15 steps (1 second) away is worth 0.633 now']);
    expect(run(notebook[2].startCode)).toEqual(['target 1.7760, TD error δ 1.2760, new Q 0.7552']);
  });

  it('training, the table against Q*, and the picture', () => {
    expect(run(notebook[3].startCode).map((l) => l.trim())).toEqual(['0 episodes: greedy play catches 0', '10 episodes: greedy play catches 0.6', '25 episodes: greedy play catches 1', '50 episodes: greedy play catches 1', '300 episodes: greedy play catches 1']);
    const q = run(notebook[4].startCode);
    expect(q[1]).toContain('0.032  0.292  0.912       0.913  0.913  0.913');
    expect(q[2]).toContain('0.000  0.766  0.000      -0.970  0.970  0.970');
    expect(q.slice(-2)).toEqual(['ε = 1, 1000 episodes: largest |Q − Q*| 0.9700, greedy catches 1', 'ε = 1, 20000 episodes: largest |Q − Q*| 0.0002, greedy catches 1']);
    expect(run(notebook[6].startCode)).toEqual(['states tried: 26 of 44']);
  });

  it('Breakout\'s states in the notebook are the ones Game Studio uses', () => {
    const out = run(notebook[5].startCode);
    expect(out[0]).toBe('states: 14');
    const bins = BREAKOUT_SPEC.observation.map((o) => o.bins ?? []);
    for (const [line, o] of [[1, [0.2, 0.5, -0.3, 0.9]], [2, [-0.9, 0.5, 0.3, -0.9]], [3, [0, 0.84, 0, -0.94]]]) expect(out[line]).toBe(`[${o.join(', ')}] is in state ${stateOf(o, bins)}`);
  });

  it('the challenge checks itself: the solution passes every case, the start none', () => {
    const challenge = notebook.find((c) => c.type === 'challenge');
    expect(run(challenge.solutionCode).at(-1)).toBe('✓ All 4 cases pass: that is the Q-learning update.');
    expect(run(challenge.startCode).at(-1)).toBe('0 of 4 cases pass.');
    // A slip, forgetting that a finished episode has no future, fails exactly the two cases that end one.
    const slip = run(challenge.startCode.replace('  return q\n', '  return q + alpha * (reward + gamma * Math.max(...nextRow) - q)\n'));
    expect(slip.filter((l) => l.startsWith('✗')).map((l) => l.slice(0, 8))).toEqual(['✗ case 2', '✗ case 4']);
  });

  it('the Try it card opens the Q-learning task, and the ML Lab is linked', () => {
    const card = lesson.intuition.visualizations.find((v) => v.id === 'GameStudioTask');
    expect(card.props).toEqual({ task: 'q-agent', lesson: 'mg8-001', checkpoint: 'cp-mg8-001-4' });
    expect(JSON.stringify(lesson.intuition.callouts)).toContain('](#/lab/ml-lab)');
  });
});
