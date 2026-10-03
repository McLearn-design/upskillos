// @vitest-environment happy-dom
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('../../components/math/MarkdownProse.jsx', () => ({ default: ({ text }) => <p>{text}</p> }));
vi.mock('./DiffBlock.jsx', () => ({ default: () => <pre>reference source</pre> }));
import LessonPanel from './LessonPanel.jsx';
import { parseLesson } from './parseTrack.js';

const C = {};
let root, host;
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  localStorage.clear();
  host = document.createElement('div'); document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount()); host.remove();
  delete globalThis.IS_REACT_ACT_ENVIRONMENT;
});

const LESSON = parseLesson([
  '---', 'title: Ties', '---', '',
  '## Ask the table',
  '',
  'Read this first.',
  '',
  '```predict',
  'question: Which action does argmax pick for a row of zeros?',
  'choice: up',
  'choice: right',
  'answer: up',
  'explain: Ties go to the first maximum.',
  '```',
  '',
  'Then this.',
  '',
  '```predict',
  'question: What will the window show?',
  'explain: Two arrows in most cells.',
  '```',
  '',
].join('\n'), 'track/ties');

async function render() {
  const step = LESSON.steps[0];
  await act(async () => root.render(<LessonPanel C={C} lesson={LESSON} lessons={[LESSON]} step={step} stepIndex={0} />));
}
const button = (text) => [...host.querySelectorAll('button')].find((b) => b.textContent.includes(text));

describe('prediction checkpoints in a lesson step', () => {
  it('shows the question where it was written and hides the explanation', async () => {
    await render();
    const text = host.textContent;
    expect(text.indexOf('Read this first.')).toBeLessThan(text.indexOf('Which action does argmax pick'));
    expect(text.indexOf('Which action does argmax pick')).toBeLessThan(text.indexOf('Then this.'));
    expect(text).not.toContain('Ties go to the first maximum.');
    expect(button('Lock in my prediction').disabled).toBe(true);
  });

  it('marks a choice once it is locked in, then reveals the explanation', async () => {
    await render();
    const radio = host.querySelector('input[value="right"]');
    await act(async () => radio.click());
    await act(async () => button('Lock in my prediction').click());
    expect(host.textContent).toContain('Your prediction: right');
    expect(host.textContent).toContain('not quite. The answer: up');
    expect(host.textContent).toContain('Ties go to the first maximum.');
  });

  it('remembers a locked prediction after the panel is shown again', async () => {
    await render();
    await act(async () => host.querySelector('input[value="up"]').click());
    await act(async () => button('Lock in my prediction').click());
    await act(async () => root.unmount());
    root = createRoot(host);
    await render();
    expect(host.textContent).toContain('Your prediction: up');
    expect(host.textContent).toContain('✓ right');
  });

  it('lets an open prediction be compared and rated by the learner', async () => {
    await render();
    const box = host.querySelectorAll('[data-prediction]')[1];
    const area = box.querySelector('textarea');
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set;
    await act(async () => { setter.call(area, 'one arrow per cell'); area.dispatchEvent(new Event('input', { bubbles: true })); });
    const lock = [...box.querySelectorAll('button')].find((b) => b.textContent.includes('Lock in'));
    await act(async () => lock.click());
    expect(box.textContent).toContain('Two arrows in most cells.');
    const partly = [...box.querySelectorAll('button')].find((b) => b.textContent === 'Partly');
    await act(async () => partly.click());
    expect(partly.getAttribute('aria-pressed')).toBe('true');
  });
});
