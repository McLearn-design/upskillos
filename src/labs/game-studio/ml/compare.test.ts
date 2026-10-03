// Comparing settings over seeds (ml/compare.ts): the averaged curve, the spread, and fair comparisons (same seeds).
import { describe, expect, it } from 'vitest';
import { mean, meanCurve, sd, summarise, type CompareConfig, type CompareRun } from './compare';

describe('comparing settings', () => {
  it('the sample standard deviation, and a curve averaged over runs then smoothed', () => {
    expect(sd([2, 4, 4, 4, 5, 5, 7, 9])).toBeCloseTo(2.138, 3);   // n − 1 in the denominator
    expect(sd([3])).toBe(0);
    expect(meanCurve([[0, 2, 4], [2, 4, 6]], 1)).toEqual([1, 3, 5]);
    expect(meanCurve([[0, 2, 4], [2, 4, 6]], 2)).toEqual([1, 2, 4]);
    expect(meanCurve([[0, 2, 4, 9], [2, 4, 6]], 1)).toEqual([1, 3, 5]);   // as long as the shortest run
  });

  it('each setting summarised from its own runs: late return and greedy score, mean ± spread', () => {
    const configs: CompareConfig[] = [{ label: 'a', options: { episodes: 3 } }, { label: 'b', options: { episodes: 3 } }];
    const runs: CompareRun[] = [
      { config: 0, seed: 1, returns: [1, 2, 3], greedy: 10 }, { config: 0, seed: 2, returns: [3, 4, 5], greedy: 14 },
      { config: 1, seed: 1, returns: [0, 0, 0], greedy: 5 },
    ];
    const [a, b] = summarise(configs, runs, 2, 1);
    expect(a.runs).toBe(2);
    expect(a.late).toEqual({ mean: mean([2.5, 4.5]), sd: sd([2.5, 4.5]) });
    expect(a.greedy.mean).toBe(12);
    expect(a.curve).toEqual([2, 3, 4]);
    expect(b.greedy).toEqual({ mean: 5, sd: 0 });
  });
});
