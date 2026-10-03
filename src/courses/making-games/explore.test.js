// Lesson 9.2, "Exploration": every notebook cell prints what the prose says, and the challenge checks itself.
import { describe, expect, it } from 'vitest';
import lesson from './9-game-ai-that-learns/002-exploration.js';

const cells = lesson.intuition.visualizations.find((v) => v.id === 'JSNotebook').props.lesson.cells;
const run = (code) => {
  const out = [];
  const ctx = new Proxy({}, { get: () => () => {}, set: () => true });
  const document = { createElement: () => ({ style: {}, getContext: () => ctx }), body: { appendChild: () => {} } };
  new Function('console', 'document', code)({ log: (...a) => out.push(a.join(' ')) }, document);
  return out;
};
const squash = (l) => l.replace(/\s+/g, ' ');

describe('lesson 9.2: exploration', () => {
  it('greedy, ε-greedy, optimism, UCB, softmax, the incremental average, the picture', () => {
    expect(run(cells[0].startCode).map(squash)).toEqual([
      'greedy (ε = 0) reward (last 100) 1.01, best arm 42%, reward (all 1000) 0.99',
      'ε-greedy, ε = 0.01 reward (last 100) 1.21, best arm 61%, reward (all 1000) 1.12',
      'ε-greedy, ε = 0.1 reward (last 100) 1.25, best arm 82%, reward (all 1000) 1.20',
    ]);
    expect(run(cells[1].startCode).map(squash)).toEqual([
      'ε-greedy, ε = 0.1, Q₀ = 0 reward (last 100) 1.23, best arm 76%, reward (all 1000) 1.15',
      'greedy, Q₀ = 5 (optimistic) reward (last 100) 1.41, best arm 87%, reward (all 1000) 1.19',
      'UCB, c = 2 reward (last 100) 1.39, best arm 86%, reward (all 1000) 1.27',
      'softmax, τ = 0.2 reward (last 100) 1.36, best arm 77%, reward (all 1000) 1.29',
    ]);
    expect(run(cells[2].startCode)).toEqual(['after 1 reward(s): Q = 2', 'after 2 reward(s): Q = 3', 'after 3 reward(s): Q = 5', 'constant α = 0.1: weights of the last 4 rewards 0.1, 0.09, 0.081, 0.0729']);
    expect(run(cells[3].startCode)).toEqual(['final smoothed reward: 1.03, 1.26, 1.43, 1.41']);
  });

  it('the challenge checks itself', () => {
    const challenge = cells.find((c) => c.type === 'challenge');
    expect(run(challenge.solutionCode).at(-1)).toBe('✓ All 4 cases pass: that is ε-greedy.');
    expect(run(challenge.startCode).at(-1)).toBe('0 of 4 cases pass.');
    // Forgetting to split among ties fails the two cases with ties.
    const slip = run(challenge.startCode.replace('  return Q.map(() => 0)\n', '  const best = Math.max(...Q)\n  return Q.map((q) => epsilon / Q.length + (q === best ? 1 - epsilon : 0))\n'));
    expect(slip.filter((l) => l.startsWith('✗')).map((l) => l.slice(0, 8))).toEqual(['✗ case 2', '✗ case 3']);
  });

  it('the Try it card opens explore-compare', () => {
    expect(lesson.intuition.visualizations.find((v) => v.id === 'GameStudioTask').props).toEqual({ task: 'explore-compare', lesson: 'mg9-002', checkpoint: 'cp-mg9-002-4' });
  });
});
