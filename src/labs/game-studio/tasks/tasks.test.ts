// Every task is fair and real: its start does not already pass, its solution passes every step,
// and its links open it. Checks run exactly as in the editor (tasks/checker.ts), on the real engine.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';
import { Doc } from '../core/doc';
import { newProject } from '../core/project';
import { problems } from '../core/serialize';
import { NODE_CLASSES } from '../engine/nodes';
import { importOrder, rewriteImports } from '../runtime/scripts';
import { evaluateTask, type ScriptLoader } from './checker';
import { TASKS, chains, nextTask } from './index';
import { gameStudioLink, parseTaskLink } from './links';
import type { GameTask } from './types';

const pngSize = (path: string) => { const b = readFileSync(fileURLToPath(new URL(`../starter/${path.replace(/^assets\//, '')}`, import.meta.url))); return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) }; };

/** Scripts as ES modules from data URLs, imports rewritten (as the game's iframe does with blob URLs). */
const load: ScriptLoader = async (project) => {
  const classes = new Map<string, unknown>(), urls = new Map<string, string>();
  const { order, imports } = importOrder(project.scripts);
  for (const path of order) {
    const src = rewriteImports(project.scripts.find((x) => x.path === path)!.source, new Map([...imports.get(path)!].map(([spec, target]) => [spec, urls.get(target)!])));
    urls.set(path, `data:text/javascript;base64,${Buffer.from(src).toString('base64')}`);
    classes.set(path, (await import(/* @vite-ignore */ urls.get(path)!)).default);
  }
  return classes;
};

function begin(task: GameTask): Doc {
  const d = new Doc(newProject(task.title));
  for (const path of task.images) d.importAsset(path, { mime: 'image/png', ...pngSize(path) });
  d.runCode('Start', task.start);
  return d;
}

afterAll(() => { for (const k of ['input', 'scene', 'time', 'math', 'physics', 'Vec2', 'PhysicsBody2D', ...Object.keys(NODE_CLASSES)]) delete (globalThis as Record<string, unknown>)[k]; });

describe('every task', () => {
  for (const task of TASKS) {
    it(`"${task.title}": the start is sound and not already done; the solution passes every step`, async () => {
      const d = begin(task);
      expect(problems(d.project)).toEqual([]);
      const before = await evaluateTask(task, d.project, { ran: false }, load);
      expect(before.filter((r) => r === true).length, `${task.id} starts with every step done`).toBeLessThan(task.steps.length);
      expect(before[0], `${task.id}: the first step is already done at the start`).not.toBe(true);
      d.runCode('Solution', task.solution);
      expect(problems(d.project)).toEqual([]);
      const after = await evaluateTask(task, d.project, { ran: true }, load);
      expect(after).toEqual(task.steps.map(() => true));
    });
  }

});

describe('links', () => {
  it('a lesson’s link opens its task and carries the way back; an unknown task fails here, not in the browser', () => {
    const link = gameStudioLink('first-script', { from: '/chapter/game-studio-1/first-script', lesson: 'gs1-3', checkpoint: 'cp-gs1-3-4' });
    expect(link).toBe('/lab/game-studio?task=first-script&from=%2Fchapter%2Fgame-studio-1%2Ffirst-script&lesson=gs1-3&checkpoint=cp-gs1-3-4');
    expect(parseTaskLink(`#${link}`)).toEqual({ task: 'first-script', from: '/chapter/game-studio-1/first-script', lesson: 'gs1-3', checkpoint: 'cp-gs1-3-4' });
    expect(() => gameStudioLink('flying-cars')).toThrow(/no task called "flying-cars"/);
    expect(parseTaskLink('#/lab/game-studio')).toBe(null);
    expect(nextTask('first-sprite')?.id).toBe('run-and-stop');
  });
});
