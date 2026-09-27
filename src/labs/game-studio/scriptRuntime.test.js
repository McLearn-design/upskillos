import { describe, expect, it } from 'vitest';
import { compileLearnerScript, validateLearnerScript } from './scriptRuntime';

describe('Game Studio learner scripts', () => {
  it('runs a small script against the supplied API', () => {
    const calls = [];
    const run = compileLearnerScript('api.state.t = (api.state.t || 0) + api.delta; api.move(2, -1);');
    const api = { state: {}, delta: 0.5, move: (...args) => calls.push(args) };
    run(api);
    expect(api.state.t).toBe(0.5);
    expect(calls).toEqual([[2, -1]]);
  });

  it('rejects loops, browser access, network access, and dynamic constructors', () => {
    ['while (true) {}', 'window.alert(1)', 'fetch("/")', 'api.constructor.constructor("return 1")()'].forEach((source) => {
      expect(validateLearnerScript(source).valid).toBe(false);
    });
  });
});

