import { describe, expect, it } from 'vitest';
import { isCorrect, parseNumber, parsePrediction, MARKER_SPLIT } from './predictions.js';
import { parseLesson } from './parseTrack.js';

describe('prediction checkpoints', () => {
  it('parses a multiple-choice prediction', () => {
    const p = parsePrediction('question: Which way?\nchoice: up\nchoice: down\nanswer: down\nexplain: Ties go to the first.\n');
    expect(p).toMatchObject({ kind: 'choice', question: 'Which way?', choices: ['up', 'down'], answer: 'down', explain: 'Ties go to the first.' });
    expect(isCorrect(p, 'down')).toBe(true);
    expect(isCorrect(p, 'up')).toBe(false);
  });

  it('parses a number prediction with a tolerance', () => {
    const p = parsePrediction('question: How many?\nanswer: 0.25\ntolerance: 0.01\nexplain: One in four.');
    expect(p.kind).toBe('number');
    expect(isCorrect(p, '0.255')).toBe(true);
    expect(isCorrect(p, '1/4')).toBe(true);
    expect(isCorrect(p, '0.3')).toBe(false);
    expect(isCorrect(p, 'a quarter')).toBe(false);
  });

  it('treats a prediction without an answer as open', () => {
    const p = parsePrediction('question: What happens?\nexplain: It slides.');
    expect(p.kind).toBe('open');
    expect(isCorrect(p, 'anything')).toBeNull();
  });

  it('continues a field over several lines and paragraphs', () => {
    const p = parsePrediction('question: Q?\nexplain: First line\nsecond line\n\nNew paragraph.');
    expect(p.explain).toBe('First line\nsecond line\n\nNew paragraph.');
  });

  it('keeps the verify command for the walkthrough test', () => {
    const p = parsePrediction('question: Q?\nanswer: 3\nexplain: E\nverify: .venv/Scripts/python -c "print(3)"');
    expect(p.verify).toBe('.venv/Scripts/python -c "print(3)"');
  });

  it('rejects malformed predictions loudly', () => {
    expect(() => parsePrediction('choice: a\nchoice: b\nanswer: a\nexplain: E')).toThrow(/question/);
    expect(() => parsePrediction('question: Q?\nchoice: a\nchoice: b\nanswer: c\nexplain: E')).toThrow(/repeat one choice/);
    expect(() => parsePrediction('question: Q?\nanswer: lots\nexplain: E')).toThrow(/not a number/);
    expect(() => parsePrediction('question: Q?\nanswer: 2')).toThrow(/explain/);
  });

  it('reads plain numbers and simple fractions only', () => {
    expect(parseNumber('-3')).toBe(-3);
    expect(parseNumber('.5')).toBe(0.5);
    expect(parseNumber('1e-3')).toBe(0.001);
    expect(parseNumber('3/4')).toBe(0.75);
    expect(parseNumber('2+2')).toBeNaN();
  });

  it('leaves a marker where the prediction was written in a step', () => {
    const lesson = parseLesson([
      '---', 'title: T', '---', '', '## Step', '', 'Before.', '', '```predict', 'question: Q?', 'explain: E', '```', '', 'After.', '',
    ].join('\n'), 'track/lesson');
    const step = lesson.steps[0];
    expect(step.predictions).toHaveLength(1);
    const parts = step.prose.split(MARKER_SPLIT);
    expect(parts.map((p) => p.trim())).toEqual(['Before.', '0', 'After.']);
  });
});
