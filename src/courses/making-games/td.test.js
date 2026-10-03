// Lesson 9.1, "Learning from every step": every notebook cell prints what the prose says, and the challenge checks
// itself (the solution passes, the start does not, and a missed terminal state fails exactly the cases that end).
import { describe, expect, it } from 'vitest';
import lesson from './9-game-ai-that-learns/001-learning-from-every-step.js';

const cells = lesson.intuition.visualizations.find((v) => v.id === 'JSNotebook').props.lesson.cells;
const run = (code) => {
  const out = [];
  const ctx = new Proxy({}, { get: () => () => {}, set: () => true });
  const document = { createElement: () => ({ style: {}, getContext: () => ctx }), body: { appendChild: () => {} } };
  new Function('console', 'document', code)({ log: (...a) => out.push(a.join(' ')) }, document);
  return out;
};

describe('lesson 9.1: TD(0) and Monte Carlo', () => {
  it('the random walk, one episode two ways, the error curves, one Q update', () => {
    expect(run(cells[0].startCode)[0]).toBe('true values: A 0.1667, B 0.3333, C 0.5000, D 0.6667, E 0.8333');
    expect(run(cells[1].startCode)).toEqual([
      'episode: C → D → C → B → A → B → A, return 0',
      'Monte Carlo: A 0.4050, B 0.4050, C 0.4050, D 0.4500, E 0.5000',
      'TD(0):       A 0.4500, B 0.5000, C 0.5000, D 0.5000, E 0.5000',
    ]);
    const err = run(cells[2].startCode);
    expect(err[0]).toMatch(/TD\(0\) α 0.1: .*after 25 0.056, .*after 100 0.054$/);
    expect(err[1]).toMatch(/TD\(0\) α 0.05: .*after 100 0.035$/);
    expect(err[2]).toMatch(/Monte Carlo α 0.03: .*after 100 0.090$/);
    expect(err[3]).toMatch(/Monte Carlo α 0.01: .*after 100 0.094$/);
    expect(run(cells[3].startCode)).toEqual(['target -3.5, δ -1.5, new Q(S, right) -2.75']);
    expect(run(cells[4].startCode)).toEqual(['after 100 episodes: TD(0) 0.054, Monte Carlo 0.090']);
  });

  it('the challenge checks itself', () => {
    const challenge = cells.find((c) => c.type === 'challenge');
    expect(run(challenge.solutionCode).at(-1)).toBe('✓ All 4 cases pass: that is TD(0).');
    expect(run(challenge.startCode).at(-1)).toBe('0 of 4 cases pass.');
    const slip = run(challenge.startCode.replace('  return v\n', '  return v + alpha * (reward + gamma * vNext - v)\n'));
    expect(slip.filter((l) => l.startsWith('✗')).map((l) => l.slice(0, 8))).toEqual(['✗ case 2']);
  });

  it('the Try it card opens the td-step task', () => {
    expect(lesson.intuition.visualizations.find((v) => v.id === 'GameStudioTask').props).toEqual({ task: 'td-step', lesson: 'mg9-001', checkpoint: 'cp-mg9-001-4' });
  });
});
