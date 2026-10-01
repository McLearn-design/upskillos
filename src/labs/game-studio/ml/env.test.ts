// Phase 9: a game as a Gymnasium-style environment (ml/env.ts), and an agent that learns to play Breakout
// from the game's state (ml/cem.ts), on the real engine with the example's own scripts.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Doc } from '../core/doc';
import { newProject } from '../core/project';
import { importOrder, rewriteImports } from '../runtime/scripts';
import { NODE_CLASSES } from '../engine/nodes';
import { breakout } from '../examples/breakout';
import { GameEnv, readPath, type ClassLoader } from './env';
import { BREAKOUT_SPEC } from './breakout';
import { act, cem, evaluate, type LinearPolicy } from './cem';

const pngSize = (path: string) => { const b = readFileSync(fileURLToPath(new URL(`../starter/${path.replace(/^assets\//, '')}`, import.meta.url))); return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) }; };
/** Scripts as ES modules from data URLs, imports rewritten (as the game's iframe does with blob URLs). */
const load: ClassLoader = async (project) => {
  const classes = new Map<string, unknown>(), urls = new Map<string, string>();
  const { order, imports } = importOrder(project.scripts);
  for (const path of order) {
    const src = rewriteImports(project.scripts.find((x) => x.path === path)!.source, new Map([...imports.get(path)!].map(([spec, target]) => [spec, urls.get(target)!])));
    urls.set(path, `data:text/javascript;base64,${Buffer.from(src).toString('base64')}`);
    classes.set(path, (await import(/* @vite-ignore */ urls.get(path)!)).default);
  }
  return classes;
};
const project = () => { const d = new Doc(newProject('Breakout')); for (const p of breakout.images) d.importAsset(p, { mime: 'image/png', ...pngSize(p) }); d.runCode('Build', breakout.code); return d.project; };

let env: GameEnv;
beforeAll(async () => { env = await GameEnv.create(project(), BREAKOUT_SPEC, load); });
afterAll(() => { for (const k of ['input', 'scene', 'time', 'math', 'physics', 'Vec2', 'PhysicsBody2D', ...Object.keys(NODE_CLASSES)]) delete (globalThis as Record<string, unknown>)[k]; });

describe('a game as an environment', () => {
  it('reset gives what the agent sees; actions are the player\'s controls, held for a step', () => {
    const { observation } = env.reset(1);
    expect(observation).toHaveLength(4);
    expect(env.actionCount).toBe(2);
    expect(observation[0]).toBeCloseTo(0, 6);   // the ball rests on the paddle: no difference across
    const x0 = readPath(env.running!, 'Paddle:position.x');
    for (let i = 0; i < 10; i++) env.step(0);   // left, with Space: the ball launches
    expect(readPath(env.running!, 'Paddle:position.x')).toBeLessThan(x0 - 100);
    expect(readPath(env.running!, 'Ball:launched')).toBe(1);
  });

  it('rewards a brick and punishes a lost ball; ends when the balls run out', () => {
    env.reset(1);
    let total = 0, steps = 0, sawBrick = false, sawLoss = false;
    for (;;) {
      const r = env.step(0);   // always left: the ball breaks some bricks, then is missed
      total += r.reward; steps++;
      if (r.reward >= 1) sawBrick = true;
      if (r.reward <= -3 + 1e-9) sawLoss = true;
      if (r.terminated || r.truncated) { expect(r.terminated).toBe(true); break; }
    }
    expect(sawBrick && sawLoss).toBe(true);
    expect(readPath(env.running!, 'Ball:lives')).toBe(0);
    expect(total).toBeCloseTo(readPath(env.running!, 'Ball:score') * 0.1 - 9, 6);   // the rewards add up to the score, less 3 a ball
    expect(steps).toBeLessThan(BREAKOUT_SPEC.maxSteps!);
  });

  it('is repeatable: the same seed and actions give the same episode', () => {
    const run = () => { env.reset(42); const out: number[] = []; for (let i = 0; i < 200; i++) out.push(...env.step(i % 7 < 3 ? 0 : 1).observation); return out; };
    expect(run()).toEqual(run());
  });

  it('says what is wrong with a spec, before it plays', async () => {
    const p = project();
    await expect(GameEnv.create(p, { ...BREAKOUT_SPEC, actions: [['fly']] }, load)).rejects.toThrow(/input action "fly"/);
    await expect(GameEnv.create(p, { ...BREAKOUT_SPEC, scene: 'scenes/nope.scene' }, load)).rejects.toThrow(/no scene/);
    expect(() => env.step(5)).toThrow(/no action 5/);
  });
});

describe('an agent that learns Breakout from the game\'s state', () => {
  it('the cross-entropy method finds a policy far better than playing at random', () => {
    const random = evaluate(env, 'random', 3, 7);
    let last: { best: number } = { best: -Infinity }, policy: LinearPolicy | undefined;
    const run = cem(env, { generations: 10, population: 24, elite: 0.2, noise: 1, seed: 3 });
    for (let r = run.next(); ; r = run.next()) { if (r.done) { policy = r.value; break; } last = r.value; }
    const trained = evaluate(env, policy!, 3, 7);
    expect(random).toBeLessThan(0);          // at random it loses its balls quickly
    expect(trained).toBeGreaterThanOrEqual(30);   // trained, it keeps the ball in play and breaks 30+ bricks
    expect(last.best).toBeGreaterThanOrEqual(30);
    // What it learned: move towards the ball. The difference across (feature 0) decides left or right.
    const w = policy!.weights, toward = w[1][0] - w[0][0];
    expect(toward).toBeGreaterThan(0);
    expect(act(policy!, [0.5, 0.5, 0, 0])).toBe(1);   // the ball is to the right: go right
    expect(act(policy!, [-0.5, 0.5, 0, 0])).toBe(0);
  }, 180000);
});
