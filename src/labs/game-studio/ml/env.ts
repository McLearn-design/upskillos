// A Game Studio game as a reinforcement-learning environment, in the shape of Gymnasium's (Phase 9):
//
//   const env = await GameEnv.create(project, spec, loadScripts)
//   let { observation } = env.reset(seed)
//   const { observation, reward, terminated, truncated } = env.step(action)
//
// It runs the game's own scripts on the real engine, headless and faster than real time, as the task
// checks do (tasks/checker.ts). The agent sees the game's state, not its pixels: the observation is a
// list of numbers read from node properties. An action is a set of input actions held for one step,
// so the agent plays with the same controls as a person.
//
// The spec is plain JSON, so it can be written by hand, saved with an example, or sent from Python.
//
//   {
//     actions: [['jump'], ['jump', 'move_left'], ['jump', 'move_right']],
//     observation: [{ path: 'Ball:position.x', scale: 1 / 960 }, …],
//     reward: [{ path: 'Ball:score', scale: 0.1 }, { path: 'Ball:lives', scale: 1 }],
//     terminated: [{ path: 'Ball:lives', op: '<=', value: 0 }],
//     frameSkip: 4, maxSteps: 1000,
//   }
//
// A path is a node path, a colon, and a property chain: 'Ball:position.x' is the x of Ball's position,
// 'Player:velocity.y' a body's vertical speed, 'Ball:score' a field the game's own script keeps.

import type { Project, SceneData } from '../core/types';
import { Game, MATH, scriptGlobals } from '../engine/game';
import { NODE_CLASSES, PhysicsBody2D, type Node } from '../engine/nodes';
import { Vec2 } from '../engine/vec2';

/** A number read from the game: (value at path − value at minus + offset) × scale. */
export interface Reading {
  path: string; minus?: string; scale?: number; offset?: number;
  /** Cut points (increasing) that sort this reading into bins, for Q-learning's table of states (ml/qlearning.ts). */
  bins?: number[];
}
export interface EnvSpec {
  /** Each action the agent can take: the input actions held for one step ([] is "do nothing"). */
  actions: string[][];
  /** What the agent sees: each number is (value − minus + offset) × scale. `minus` gives a difference, such as the ball's x relative to the paddle's. */
  observation: Reading[];
  /** The reward for a step: the sum of scale × how much each value changed during it. */
  reward: Reading[];
  /** The episode ends when any of these holds. */
  terminated?: { path: string; op: '<=' | '>=' | '=='; value: number }[];
  /** Frames per step (4: the agent decides 15 times a second at 60 frames a second). */
  frameSkip?: number;
  /** Steps before an episode is cut short ("truncated"). */
  maxSteps?: number;
  /** Frames per second the game is stepped at (60). */
  fps?: number;
  /** The scene to play (the main scene unless given). */
  scene?: string;
}

export interface StepResult { observation: number[]; reward: number; terminated: boolean; truncated: boolean; info: { step: number; errors: string[] } }

/** Load a project's scripts as classes by path (runtime/scripts.ts loadScripts in a browser; data URLs in tests). */
export type ClassLoader = (project: Project) => Promise<Map<string, unknown>>;

/** A small, fast seeded generator (mulberry32), so an episode can be played again exactly. */
export function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/** Read a 'Node/Path:prop.sub' value from a running game: a number, or NaN when it is missing. */
export function readPath(game: Game, path: string): number {
  const at = path.indexOf(':');
  const node = game.root.find<Node>(at < 0 ? path : path.slice(0, at));
  if (!node) return NaN;
  let v: unknown = node;
  for (const k of (at < 0 ? '' : path.slice(at + 1)).split('.').filter(Boolean)) v = v == null ? undefined : (v as Record<string, unknown>)[k];
  return typeof v === 'number' ? v : typeof v === 'boolean' ? Number(v) : NaN;
}

/** What an agent sees in a running game, for a spec: the same numbers in training and when it plays in the runtime. */
export function observeGame(game: Game, spec: EnvSpec): number[] {
  return spec.observation.map((o) => {
    const v = readPath(game, o.path) - (o.minus ? readPath(game, o.minus) : 0);
    return Number.isFinite(v) ? (v + (o.offset ?? 0)) * (o.scale ?? 1) : 0;
  });
}

/** Hold an action's inputs, afresh: release what the last action held, then press this one's (so "just pressed" fires). */
export function pressAction(game: Game, input: Project['input'], held: string[], action: string[]): void {
  const keyOf = (name: string) => input.find((a) => a.name === name)?.keys ?? [];
  for (const a of held) for (const k of keyOf(a)) game.input.key(k, false);
  for (const a of action) { const k = keyOf(a)[0]; if (k) game.input.key(k, true); }
}

export class GameEnv {
  private game: Game | null = null;
  private steps = 0;
  private last: number[] = [];
  private held: string[] = [];
  private errors: string[] = [];
  private random: () => number = Math.random;
  readonly fps: number;
  readonly frameSkip: number;
  readonly maxSteps: number;

  private constructor(readonly project: Project, readonly spec: EnvSpec, private classes: Map<string, unknown>, private scene: SceneData) {
    this.fps = spec.fps ?? 60;
    this.frameSkip = spec.frameSkip ?? 4;
    this.maxSteps = spec.maxSteps ?? 1000;
  }

  /** An environment for a project: its scripts are loaded once and reused by every episode. */
  static async create(project: Project, spec: EnvSpec, load: ClassLoader): Promise<GameEnv> {
    if (!spec.actions.length) throw new Error('The spec has no actions');
    const path = spec.scene ?? project.settings.mainScene;
    const scene = project.scenes.find((s) => s.path === path);
    if (!scene) throw new Error(`There is no scene "${path}" to play`);
    // A script's class extends a node class as soon as it is loaded, so those come first.
    Object.assign(globalThis, NODE_CLASSES, { Vec2, math: MATH, PhysicsBody2D });
    const env = new GameEnv(project, spec, await load(project), scene);
    // Every input action an action uses must exist, or the game would throw on its first step.
    const known = new Set(project.input.map((a) => a.name));
    for (const name of spec.actions.flat()) {
      if (!known.has(name)) throw new Error(`The spec uses an input action "${name}" the project does not have`);
      if (!project.input.find((a) => a.name === name)!.keys.length) throw new Error(`The input action "${name}" has no keys, so it cannot be pressed`);
    }
    return env;
  }

  get actionCount(): number { return this.spec.actions.length; }
  get observationNames(): string[] { return this.spec.observation.map((o) => o.path); }

  /** Start a new episode, from the scene as saved. A seed makes the game's own randomness repeat. */
  reset(seed?: number): { observation: number[]; info: { step: number; errors: string[] } } {
    this.random = seed === undefined ? Math.random : seeded(seed);
    this.errors = [];
    this.within(() => {
      Object.assign(globalThis, NODE_CLASSES, { Vec2, math: MATH, PhysicsBody2D });
      this.game = new Game(this.project, this.scene, { frame: () => {} }, {
        scriptClass: (p) => this.classes.get(p) as typeof Node | undefined,
        onError: (e) => this.errors.push(`${e.file ?? e.node}: ${e.message}`),
      });
      Object.assign(globalThis, scriptGlobals(this.game));
      this.game.start();
    });
    this.steps = 0; this.held = [];
    this.last = this.spec.reward.map((r) => readPath(this.game!, r.path));
    return { observation: this.observe(), info: { step: 0, errors: this.errors } };
  }

  /** Hold one action's inputs for frameSkip frames; what the agent sees after, and what it earned. */
  step(action: number): StepResult {
    const game = this.game;
    if (!game) throw new Error('Call reset() before step()');
    const keys = this.spec.actions[action];
    if (!keys) throw new Error(`There is no action ${action}: the actions are 0 to ${this.spec.actions.length - 1}`);
    this.within(() => {
      Object.assign(globalThis, scriptGlobals(game));
      // Every step presses its inputs afresh (up, then down), so "just pressed" is true on its first frame,
      // as when a player taps a key.
      pressAction(game, this.project.input, this.held, keys);
      this.held = keys;
      for (let f = 0; f < this.frameSkip; f++) game.step(1 / this.fps);
    });
    this.steps++;
    const now = this.spec.reward.map((r) => readPath(game, r.path));
    let reward = 0;
    now.forEach((v, i) => { const d = v - this.last[i]; if (Number.isFinite(d)) reward += d * (this.spec.reward[i].scale ?? 1); });
    this.last = now;
    const terminated = this.errors.length > 0 || (this.spec.terminated ?? []).some((t) => {
      const v = readPath(game, t.path);
      return t.op === '<=' ? v <= t.value : t.op === '>=' ? v >= t.value : v === t.value;
    });
    return { observation: this.observe(), reward, terminated, truncated: !terminated && this.steps >= this.maxSteps, info: { step: this.steps, errors: this.errors } };
  }

  /** The running game, to look at (the engine's own objects). */
  get running(): Game | null { return this.game; }

  private observe(): number[] { return observeGame(this.game!, this.spec); }

  /** Run with the game's randomness seeded: Math.random is the episode's generator only while the game runs. */
  private within(fn: () => void): void {
    const real = Math.random;
    Math.random = this.random;
    try { fn(); } finally { Math.random = real; }
  }
}
