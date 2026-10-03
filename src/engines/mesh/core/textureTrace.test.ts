import { describe, expect, it } from 'vitest';
import { traceTexture } from './textureTrace';
import { texelColor } from './shading';
import { Trace } from './trace';

describe('texture formulas', () => {
  it('the repeat keeps the fractional part, and the colour is the texture\'s own texel', () => {
    const t = new Trace('Trace the texture formula');
    const r = traceTexture('bricks', [0.3, 0.7], 2, t);
    expect(r.u).toBeCloseTo(0.6, 12);
    expect(r.v).toBeCloseTo(0.4, 12);
    expect(r.color).toEqual(texelColor('bricks', 0.6, 0.4));
    expect(t.steps.map((s) => s.phase)).toEqual(['Repeat', 'Formula', 'Colour']);
    expect(t.steps[1].quiz!.answer).toEqual([3]);
  });

  it('checker cells alternate; stripes depend only on u', () => {
    expect(traceTexture('checker', [0.06, 0.06]).color).toEqual([235, 235, 235]);
    expect(traceTexture('checker', [0.19, 0.06]).color).not.toEqual([235, 235, 235]);
    expect(traceTexture('stripes', [0.15, 0.1]).color).toEqual(traceTexture('stripes', [0.15, 0.9]).color);
  });
});
