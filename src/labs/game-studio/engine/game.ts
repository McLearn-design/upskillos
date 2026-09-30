// The running game: builds the node tree from a scene, runs the lifecycle, and hands
// the renderer a plain list of what to draw each frame (ADR 2, ADR 4).
//
// Each frame, in this order:
//   1. physicsUpdate(1/60) on every node, as many times as fit in the time that has
//      passed (at most 0.25 s, so a stall does not run hundreds of steps);
//   2. update(dt) on every node, with the frame's own time;
//   3. nodes freed this frame are removed (destroyed() runs);
//   4. the renderer gets the frame;
//   5. "just pressed" input is forgotten.
// ready() runs children first, so a parent's ready() can use its children.
//
// A lifecycle method that throws is reported once, and that node is skipped from
// then on; the rest of the game keeps running.

import type { NodeData, Project, PropValue, SceneData } from '../core/types';
import { propsOf } from '../core/registry';
import { decompose } from '../core/math2d';
import { Input } from './input';
import { NODE_CLASSES, Node, Node2D, Sprite2D } from './nodes';
import { Vec2 } from './vec2';

export const PHYSICS_DT = 1 / 60;

/** One thing to draw, in world coordinates. */
export interface DrawItem {
  id: number;
  texture: string;
  x: number; y: number; rotation: number; scaleX: number; scaleY: number;
  flipX: boolean; flipY: boolean; alpha: number;
  /** Drawing order: higher is on top. */
  depth: number;
}

export interface Renderer {
  /** Everything to draw this frame. Items not in the list are no longer drawn. */
  frame(items: DrawItem[]): void;
}

export interface ScriptError { message: string; file: string | null; stack: string; node: string; phase: string }

export interface GameOptions {
  /** The class for a node's script, or undefined if it has none. */
  scriptClass?: (path: string) => typeof Node | undefined;
  onError?: (e: ScriptError) => void;
}

export class Game {
  readonly input: Input;
  readonly root: Node;
  readonly time = { now: 0, frame: 0 };
  /** The time step now running: 1/60 in physicsUpdate, the frame time in update. */
  stepDelta = 0;
  private accumulator = 0;
  private freeQueue = new Set<Node>();
  private ids = new WeakMap<Node, number>();
  private nextDrawId = 1;
  private started = false;

  constructor(project: Project, scene: SceneData, private renderer: Renderer, private opts: GameOptions = {}) {
    this.input = new Input(project.input);
    this.root = this.build(scene.root);
    this.root._game = this;
  }

  /** Create the node for a saved one, its script class if it has one, and its children. */
  private build(data: NodeData): Node {
    const builtin = NODE_CLASSES[data.type];
    if (!builtin) throw new Error(`The engine has no node type "${data.type}"`);
    let Cls: typeof Node = builtin;
    if (data.script) {
      const S = this.opts.scriptClass?.(data.script);
      if (!S) throw new Error(`${data.script} did not load`);
      if (S !== builtin && !(S.prototype instanceof builtin)) {
        throw new Error(`${data.script}: the class must extend ${data.type}, because it is attached to a ${data.type} ("${data.name}"). Write: export default class … extends ${data.type}`);
      }
      Cls = S;
    }
    const node = new Cls();
    node.name = data.name;
    node._script = data.script;
    node._game = this;
    applyProps(node, data.type, data.props);
    for (const c of data.children) { const child = this.build(c); child._parent = node; node._children.push(child); }
    return node;
  }

  /** Run ready() everywhere, children first. Call once before the first step. */
  start(): void {
    if (this.started) return;
    this.started = true;
    const readyAll = (n: Node) => { for (const c of n._children) readyAll(c); this.call(n, 'ready'); };
    readyAll(this.root);
    this.draw();
  }

  /** Advance by dt seconds (the time since the last frame). */
  step(dt: number): void {
    this.time.frame++;
    this.time.now += dt;
    this.accumulator = Math.min(this.accumulator + dt, 0.25);
    while (this.accumulator >= PHYSICS_DT - 1e-12) {
      this.stepDelta = PHYSICS_DT;
      this.each((n) => this.call(n, 'physicsUpdate', PHYSICS_DT));
      this.accumulator -= PHYSICS_DT;
    }
    this.stepDelta = dt;
    this.each((n) => this.call(n, 'update', dt));
    this.flushFree();
    this.draw();
    this.input.endFrame();
  }

  /** Every node in tree order (parents before children). */
  each(fn: (n: Node) => void): void {
    const visit = (n: Node) => { if (n._freed) return; fn(n); for (const c of n._children) visit(c); };
    visit(this.root);
  }

  private call(n: Node, phase: 'ready' | 'update' | 'physicsUpdate' | 'destroyed', dt?: number): void {
    if (n._broken) return;
    try { (n[phase] as (dt?: number) => void).call(n, dt); }
    catch (e) {
      n._broken = true;
      const err = e instanceof Error ? e : new Error(String(e));
      this.opts.onError?.({ message: err.message, stack: err.stack ?? '', file: n._script, node: n.path, phase });
    }
  }

  /** A node added while running (addChild). */
  _attached(node: Node): void {
    const bind = (n: Node) => { n._game = this; for (const c of n._children) bind(c); };
    bind(node);
    if (this.started) { const readyAll = (n: Node) => { for (const c of n._children) readyAll(c); this.call(n, 'ready'); }; readyAll(node); }
  }

  _queueFree(node: Node): void { this.freeQueue.add(node); }

  private flushFree(): void {
    for (const node of this.freeQueue) {
      if (node._freed || node === this.root) continue;
      const gone = (n: Node) => { for (const c of n._children) gone(c); n._freed = true; this.call(n, 'destroyed'); };
      gone(node);
      if (node._parent) node._parent._children = node._parent._children.filter((c) => c !== node);
      node._parent = null;
    }
    this.freeQueue.clear();
  }

  /** The draw list: every visible Sprite2D with a texture, in world coordinates. */
  private draw(): void {
    const items: DrawItem[] = [];
    let order = 0;
    const visit = (n: Node, visible: boolean, z: number) => {
      if (n._freed) return;
      let vis = visible, zz = z;
      if (n instanceof Node2D) { vis = visible && n.visible; zz = z + n.zIndex; }
      if (vis && n instanceof Sprite2D && n.texture) {
        const t = decompose(n.worldTransform);
        let id = this.ids.get(n);
        if (id === undefined) { id = this.nextDrawId++; this.ids.set(n, id); }
        items.push({ id, texture: n.texture, x: t.position.x, y: t.position.y, rotation: t.rotation, scaleX: t.scale.x, scaleY: t.scale.y, flipX: n.flipX, flipY: n.flipY, alpha: n.opacity, depth: zz + (order++) * 1e-6 });
      }
      for (const c of n._children) visit(c, vis, zz);
    };
    visit(this.root, true, 0);
    this.renderer.frame(items);
  }

  /** Scripts' `scene` global: the tree from its root. */
  get sceneApi() {
    return { root: this.root, get: <T extends Node = Node>(path: string) => this.root.get<T>(path), find: <T extends Node = Node>(path: string) => this.root.find<T>(path) };
  }
}

/** Set a node's saved properties (registry names) on the runtime object. */
export function applyProps(node: Node, type: string, props: Record<string, PropValue>): void {
  for (const def of propsOf(type)) {
    if (!(def.name in props)) continue;
    const v = props[def.name];
    (node as unknown as Record<string, unknown>)[def.name] = v && typeof v === 'object' ? new Vec2((v as { x: number }).x, (v as { y: number }).y) : v;
  }
}

/** The globals a script sees (ADR 4). */
export function scriptGlobals(game: Game): Record<string, unknown> {
  return { input: game.input, scene: game.sceneApi, time: game.time, math: MATH, Vec2, ...NODE_CLASSES };
}

/** Small maths helpers scripts use all the time. */
export const MATH = {
  vec: (x = 0, y = 0) => new Vec2(x, y),
  clamp: (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v)),
  /** Partway from a to b: t = 0 is a, 1 is b. */
  lerp: (a: number, b: number, t: number) => a + (b - a) * t,
  degToRad: (d: number) => (d * Math.PI) / 180,
  radToDeg: (r: number) => (r * 180) / Math.PI,
  /** A random number in [lo, hi). */
  randRange: (lo: number, hi: number) => lo + Math.random() * (hi - lo),
};
