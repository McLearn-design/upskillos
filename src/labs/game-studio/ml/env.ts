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
//
// Or the agent is an NPC whose script says what it sees, does and earns (engine/game.ts drives the same
// methods from a brain when the game runs, so it behaves the same in training and in play):
//
//   { agent: 'Ghost', bins: [[-2, 0, 2], [-2, 0, 2]], maxSteps: 400 }
//
//   export default class Ghost extends Sprite2D {
//     actions = ['up', 'down', 'left', 'right']   what it can do, in order
//     observations = ['dx', 'dy']                 what it sees, by name
//     brain = 'brains/ghost.json'                 in the game, this brain decides
//     decideEvery = 8                             frames between decisions (and between training steps)
//     observe() { return [dx, dy] }               the numbers it sees now
//     act(action) { this.heading = action }       do action (it lasts until the next decision)
//     reward() { … }                              what it earned since the last decision
//     done() { return this.caught }               the episode is over
//   }
//
// While an agent trains, scripts see ai.training as true: a player script can play itself then.

import type { Project, SceneData } from '../core/types';
import { Game, MATH, decideEvery, isAgent, scriptGlobals, type AgentNode } from '../engine/game';
import { NODE_CLASSES, PhysicsBody2D, type Node } from '../engine/nodes';
import { Vec2 } from '../engine/vec2';

/** A number read from the game: (value at path − value at minus + offset) × scale. */
export interface Reading {
  path: string; minus?: string; scale?: number; offset?: number;
  /** Cut points (increasing) that sort this reading into bins, for Q-learning's table of states (ml/qlearning.ts). */
  bins?: number[];
}
export interface EnvSpec {
  /** A script agent: the path of a node whose script has observe() and act(action). Its script then says what it
   *  sees, does and earns, and actions, observation and reward are not used. */
  agent?: string;
  /** For a script agent: cut points for each number observe() returns ([] for one that is not part of the state). */
  bins?: number[][];
  /** Each action the agent can take: the input actions held for one step ([] is "do nothing"). */
  actions?: string[][];
  /** What the agent sees: each number is (value − minus + offset) × scale. `minus` gives a difference, such as the ball's x relative to the paddle's. */
  observation?: Reading[];
  /** The reward for a step: the sum of scale × how much each value changed during it. */
  reward?: Reading[];
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
  return (spec.observation ?? []).map((o) => {
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
  private agentNode: AgentNode | null = null;
  private steps = 0;
  private last: number[] = [];
  private held: string[] = [];
  private errors: string[] = [];
  private random: () => number = Math.random;
  readonly fps: number;
  readonly maxSteps: number;
  /** Frames per step: the spec's frameSkip, else a script agent's decideEvery, else 4. */
  frameSkip: number;
  /** The actions by name, and what the agent sees by name (for showing a brain). */
  actionNames: string[] = [];
  observationNames: string[] = [];
  /** Cut points for each number the agent sees ([] where it is not part of a Q table's state). */
  bins: number[][] = [];
  /** How many numbers the agent sees. */
  observationSize = 0;

  private constructor(readonly project: Project, readonly spec: EnvSpec, private classes: Map<string, unknown>, private scene: SceneData) {
    this.fps = spec.fps ?? 60;
    this.frameSkip = spec.frameSkip ?? 4;
    this.maxSteps = spec.maxSteps ?? 1000;
  }

  /** An environment for a project: its scripts are loaded once and reused by every episode. */
  static async create(project: Project, spec: EnvSpec, load: ClassLoader): Promise<GameEnv> {
    const path = spec.scene ?? project.settings.mainScene;
    const scene = project.scenes.find((s) => s.path === path);
    if (!scene) throw new Error(`There is no scene "${path}" to play`);
    // A script's class extends a node class as soon as it is loaded, so those come first.
    Object.assign(globalThis, NODE_CLASSES, { Vec2, math: MATH, PhysicsBody2D });
    const env = new GameEnv(project, spec, await load(project), scene);
    if (spec.agent) {
      // Play the first moment of an episode to meet the agent: its actions, what it sees, how often it decides.
      env.reset(0);
      const a = env.agentNode!;
      const actions = Array.isArray(a.actions) ? a.actions.map(String) : [];
      if (!actions.length) throw new Error(`${spec.agent}'s script needs a list of its actions: actions = ['left', 'right', …]`);
      const o = env.observe();
      if (env.errors.length) throw new Error(env.errors[0]);
      env.actionNames = actions;
      env.observationSize = o.length;
      env.observationNames = Array.isArray(a.observations) && a.observations.length === o.length ? a.observations.map(String) : o.map((_, i) => `seen ${i + 1}`);
      if (spec.bins && spec.bins.length !== o.length) throw new Error(`"bins" has ${spec.bins.length} lists, but observe() gives ${o.length} numbers: one list each ([] for a number that is not binned)`);
      env.bins = spec.bins ?? o.map(() => []);
      if (spec.frameSkip === undefined) env.frameSkip = decideEvery(a);
      return env;
    }
    if (!spec.actions?.length) throw new Error('The spec has no actions (or name an "agent": a node whose script has observe() and act())');
    if (!spec.observation?.length) throw new Error('The spec has no observation: what the agent sees');
    // Every input action an action uses must exist, or the game would throw on its first step.
    const known = new Set(project.input.map((a) => a.name));
    for (const name of spec.actions.flat()) {
      if (!known.has(name)) throw new Error(`The spec uses an input action "${name}" the project does not have`);
      if (!project.input.find((a) => a.name === name)!.keys.length) throw new Error(`The input action "${name}" has no keys, so it cannot be pressed`);
    }
    env.actionNames = spec.actions.map((keys) => keys.join('+') || 'nothing');
    env.observationNames = spec.observation.map((o) => o.minus ? `${o.path} − ${o.minus}` : o.path);
    env.bins = spec.observation.map((o) => o.bins ?? []);
    env.observationSize = spec.observation.length;
    return env;
  }

  get actionCount(): number { return this.actionNames.length; }

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
      this.game.training = true;
      if (this.spec.agent) {
        const n = this.game.root.find(this.spec.agent);
        if (!n) throw new Error(`There is no node "${this.spec.agent}" to train (give its path from the scene's root)`);
        if (!isAgent(n)) throw new Error(`${this.spec.agent} is not an agent: its script needs observe() (what it sees) and act(action) (what it does)`);
        this.agentNode = n;
        this.game.trainee = n;   // the engine leaves it to training, even if it names a brain
      }
      Object.assign(globalThis, scriptGlobals(this.game));
      this.game.start();
    });
    this.steps = 0; this.held = [];
    this.last = (this.spec.reward ?? []).map((r) => readPath(this.game!, r.path));
    return { observation: this.observe(), info: { step: 0, errors: this.errors } };
  }

  /** Take one action for frameSkip frames; what the agent sees after, and what it earned. */
  step(action: number): StepResult {
    const game = this.game;
    if (!game) throw new Error('Call reset() before step()');
    if (!(action >= 0 && action < this.actionCount)) throw new Error(`There is no action ${action}: the actions are 0 to ${this.actionCount - 1}`);
    const agent = this.agentNode;
    let reward = 0, ended = false;
    this.within(() => {
      Object.assign(globalThis, scriptGlobals(game));
      if (agent) game._run(agent, 'act', () => agent.act(action));
      else {
        // Every step presses its inputs afresh (up, then down), so "just pressed" is true on its first frame,
        // as when a player taps a key.
        const keys = this.spec.actions![action];
        pressAction(game, this.project.input, this.held, keys);
        this.held = keys;
      }
      for (let f = 0; f < this.frameSkip; f++) game.step(1 / this.fps);
      if (agent) {
        reward = Number(game._run(agent, 'reward', () => (agent.reward ? agent.reward() : 0)) ?? 0) || 0;
        ended = agent._freed || !!game._run(agent, 'done', () => (agent.done ? agent.done() : false));
      }
    });
    this.steps++;
    if (!agent) {
      const now = (this.spec.reward ?? []).map((r) => readPath(game, r.path));
      now.forEach((v, i) => { const d = v - this.last[i]; if (Number.isFinite(d)) reward += d * (this.spec.reward![i].scale ?? 1); });
      this.last = now;
      ended = (this.spec.terminated ?? []).some((t) => {
        const v = readPath(game, t.path);
        return t.op === '<=' ? v <= t.value : t.op === '>=' ? v >= t.value : v === t.value;
      });
    }
    const terminated = this.errors.length > 0 || ended;
    return { observation: this.observe(), reward, terminated, truncated: !terminated && this.steps >= this.maxSteps, info: { step: this.steps, errors: this.errors } };
  }

  /** The running game, to look at (the engine's own objects). */
  get running(): Game | null { return this.game; }

  private observe(): number[] {
    const game = this.game!, agent = this.agentNode;
    if (!agent) return observeGame(game, this.spec);
    let o: unknown;
    this.within(() => { Object.assign(globalThis, scriptGlobals(game)); o = game._run(agent, 'observe', () => agent.observe()); });
    const list = Array.isArray(o) ? o.map(Number) : [];
    if (!Array.isArray(o) && !this.errors.length) this.errors.push(`${this.spec.agent}: observe() must return a list of numbers`);
    // An episode that broke still hands back the right number of numbers, so training can stop cleanly.
    return this.observationSize && list.length !== this.observationSize ? new Array(this.observationSize).fill(0) : list.map((x) => (Number.isFinite(x) ? x : 0));
  }

  /** Run with the game's randomness seeded: Math.random is the episode's generator only while the game runs. */
  private within(fn: () => void): void {
    const real = Math.random;
    Math.random = this.random;
    try { fn(); } finally { Math.random = real; }
  }
}
