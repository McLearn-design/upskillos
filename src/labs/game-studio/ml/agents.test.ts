// NPCs that learn (docs/game-studio-learning-ai-plan.md): a script agent trained on the real engine, saved as a
// brain in the project, and driven by that brain when the game runs, in the editor's runtime and an exported game.
import { afterAll, describe, expect, it } from 'vitest';
import { strFromU8, unzipSync } from 'fflate';
import { Doc } from '../core/doc';
import { newProject } from '../core/project';
import { deserialize, problems, serialize } from '../core/serialize';
import { gameZip } from '../core/archive';
import { importOrder, rewriteImports } from '../runtime/scripts';
import { Game, scriptGlobals } from '../engine/game';
import { NODE_CLASSES, type Node } from '../engine/nodes';
import type { Project } from '../core/types';
import { GameEnv, type ClassLoader, type EnvSpec } from './env';
import { evaluate } from './cem';
import { evaluateQ, qLearning, type QEpisode, type QPolicy } from './qlearning';

// A chaser that learns to reach a target placed at random. It sees where the target is from it, in units of
// 60 px (binned into 5 × 5 states), moves 120 px/s in one of four directions, pays 0.01 a frame and earns 1 when
// it arrives.
const CHASER = `export default class Chaser extends Node2D {
  actions = ['up', 'down', 'left', 'right']
  observations = ['target across', 'target down']
  brain = 'brains/chaser.json'
  decideEvery = 4
  heading = -1
  earned = 0
  ready() { this.target = scene.get('Target') }
  observe() {
    const d = this.target.position.sub(this.position)
    return [d.x / 60, d.y / 60]
  }
  act(action) { this.heading = action }
  update(dt) {
    const step = [[0, -1], [0, 1], [-1, 0], [1, 0]][this.heading] ?? [0, 0]
    this.position = this.position.add(new Vec2(step[0], step[1]).scale(120 * dt))
    this.earned -= 0.01
    if (!this.arrived && this.target.position.sub(this.position).length() < 16) { this.earned += 1; this.arrived = true }
  }
  reward() { const r = this.earned; this.earned = 0; return r }
  done() { return !!this.arrived }
}`;
const TARGET = `export default class Target extends Node2D {
  ready() {
    this.position = new Vec2(100 + Math.floor(Math.random() * 6) * 60, 100 + Math.floor(Math.random() * 5) * 60)
    this.trained = ai.training
  }
}`;
const BUILD = `scene = project.createScene('scenes/main.scene', 'Node2D', 'Main')
project.setMainScene('scenes/main.scene')
project.writeScript('scripts/chaser.js', ${JSON.stringify(CHASER)})
project.writeScript('scripts/target.js', ${JSON.stringify(TARGET)})
scene.add('Node2D', { name: 'Chaser', position: { x: 280, y: 220 } })
scene.add('Node2D', { name: 'Target' })
scene.get('Chaser').script = 'scripts/chaser.js'
scene.get('Target').script = 'scripts/target.js'`;

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
const build = () => { const d = new Doc(newProject('Chase')); d.runCode('Build', BUILD); return d; };
const SPEC: EnvSpec = { agent: 'Chaser', bins: [[-1, -0.15, 0.15, 1], [-1, -0.15, 0.15, 1]], maxSteps: 150 };
afterAll(() => { for (const k of ['input', 'scene', 'time', 'math', 'physics', 'ai', 'Vec2', 'PhysicsBody2D', ...Object.keys(NODE_CLASSES)]) delete (globalThis as Record<string, unknown>)[k]; });

function train(run: Generator<QEpisode, QPolicy>): QPolicy {
  let r = run.next();
  while (!r.done) r = run.next();
  return r.value;
}

/** Play the game from its saved scene, as the editor's runtime does: how many frames until Chaser reaches Target. */
async function play(project: Project, frames: number): Promise<{ arrivedAt: number | null; game: Game }> {
  const classes = await load(project);
  Object.assign(globalThis, NODE_CLASSES);
  const game = new Game(project, project.scenes[0], { frame: () => {} }, { scriptClass: (p) => classes.get(p) as typeof Node | undefined, onError: (e) => { throw new Error(e.message); } });
  Object.assign(globalThis, scriptGlobals(game));
  game.start();
  for (let f = 1; f <= frames; f++) { game.step(1 / 60); if ((game.root.find('Chaser') as unknown as { arrived?: boolean }).arrived) return { arrivedAt: f, game }; }
  return { arrivedAt: null, game };
}

describe('a script agent', () => {
  it('the environment takes its actions, what it sees and how often it decides from its script', async () => {
    const env = await GameEnv.create(build().project, SPEC, load);
    expect(env.actionNames).toEqual(['up', 'down', 'left', 'right']);
    expect(env.observationNames).toEqual(['target across', 'target down']);
    expect(env.bins).toEqual([[-1, -0.15, 0.15, 1], [-1, -0.15, 0.15, 1]]);
    expect(env.frameSkip).toBe(4);
    const { observation } = env.reset(3);
    expect(observation.every((x) => Number.isInteger(x * 60))).toBe(true);
    // While training, scripts see ai.training (the Target records it).
    expect((env.running!.root.find('Target') as unknown as { trained: boolean }).trained).toBe(true);
    const r = env.step(0);
    expect(r.reward).toBeCloseTo(-0.04, 9);   // four frames at 0.01 each
  });

  it('refuses a node that is not an agent, and bins that do not fit what it sees', async () => {
    await expect(GameEnv.create(build().project, { agent: 'Target' }, load)).rejects.toThrow(/not an agent/);
    await expect(GameEnv.create(build().project, { agent: 'Nobody' }, load)).rejects.toThrow(/no node "Nobody"/);
    await expect(GameEnv.create(build().project, { agent: 'Chaser', bins: [[0]] }, load)).rejects.toThrow(/observe\(\) gives 2 numbers/);
  });

  it('learns to chase: Q-learning against random moves', async () => {
    const env = await GameEnv.create(build().project, SPEC, load);
    const random = evaluate(env, 'random', 5, 11);
    const policy = train(qLearning(env, { episodes: 200, seed: 2 }));
    const score = evaluateQ(env, policy, 5, 11);
    expect(random).toBeLessThan(0);
    expect(score).toBeGreaterThan(0.5);   // it arrives, in fewer than 50 steps on average
  }, 60000);

  it('its brain is saved in the project, checked, survives saving and exporting, and drives it in the game', async () => {
    const d = build();
    const env = await GameEnv.create(d.project, SPEC, load);
    const policy = train(qLearning(env, { episodes: 200, seed: 2 }));
    // Before it has a brain, the engine leaves it alone: it never moves, so it never arrives.
    expect((await play(d.project, 600)).arrivedAt).toBeNull();
    d.saveBrain('brains/chaser.json', { actions: env.actionNames, observation: env.observationNames, method: 'q', policy, trained: { steps: 80, score: 1, random: -1 } });
    expect(problems(d.project)).toEqual([]);
    // GUI → code: saving is a line of Scene API code, and replaying the log rebuilds the brain.
    expect(d.log.at(-1)!.code).toMatch(/^project\.saveBrain\("brains\/chaser\.json", /);
    const replayed = new Doc(newProject('Chase'));
    for (const e of d.log) replayed.runCode(e.label, e.code);
    expect(replayed.project.brains).toEqual(d.project.brains);
    const again = deserialize(serialize(d.project));
    expect(again.brains[0].path).toBe('brains/chaser.json');
    const { arrivedAt, game } = await play(again, 600);
    expect(arrivedAt).not.toBeNull();   // the brain drives it to the target
    expect(game.ai.training).toBe(false);
    expect(game.ai.has('brains/chaser.json')).toBe(true);
    expect(game.ai.act('brains/chaser.json', [2, 0])).toBe(3);   // target well to the right: go right
    // The exported game carries it.
    const zip = unzipSync(gameZip(again, '/* runtime */', () => undefined));
    expect(JSON.parse(strFromU8(zip['project.json'])).brains[0].policy.table.length).toBe(25);
  }, 60000);

  it('a bad brain is reported, not run', () => {
    const d = build();
    expect(() => d.saveBrain('brains/chaser.json', { actions: ['up'], observation: [], method: 'q', policy: { kind: 'q', bins: [[0]], table: [[0], [0], [0]] }, trained: { steps: 1, score: 0, random: 0 } })).toThrow(/2 states, but its table has 3 rows/);
    expect(() => d.saveBrain('scripts/chaser.json', { actions: ['up'], observation: [], method: 'cem', policy: { weights: [[1]] }, trained: { steps: 1, score: 0, random: 0 } })).toThrow(/must be in brains\//);
  });

  it('older projects load with no brains', () => {
    const p = JSON.parse(serialize(build().project));
    delete p.brains; p.formatVersion = 3;
    expect(deserialize(JSON.stringify(p)).brains).toEqual([]);
  });
});
